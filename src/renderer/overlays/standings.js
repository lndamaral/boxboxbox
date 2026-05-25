(function () {
  'use strict';

  const body = document.getElementById('body');
  const columnsHeader = document.getElementById('columnsHeader');
  const trackNameEl = document.getElementById('trackName');
  const sessionInfoEl = document.getElementById('sessionInfo');
  const irEstimator = document.getElementById('irEstimator');
  const irValue = document.getElementById('irValue');

  const B = 1600 / Math.LN2;

  let lastMode = '';
  let lastMulticlass = false;

  function sessionLabel(sessionType) {
    if (!sessionType) return '';
    const st = sessionType.toLowerCase();
    if (st === 'race') return 'RACE';
    if (st.includes('qualify')) return 'QUALY';
    if (st.includes('practice') || st === 'offline testing') return 'PRAC';
    return sessionType.toUpperCase().slice(0, 5);
  }

  function pickMode(sessionType) {
    if (!sessionType) return 'race';
    const st = sessionType.toLowerCase();
    if (st === 'race') return 'race';
    if (st.includes('qualify')) return 'qualy';
    if (st.includes('practice') || st === 'offline testing') return 'practice';
    return 'race';
  }

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '\u2014';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + secs.toFixed(3).padStart(6, '0');
  }

  function formatGap(seconds) {
    if (seconds == null) return '';
    const abs = Math.abs(seconds);
    if (abs < 10) return '+' + abs.toFixed(2);
    if (abs < 100) return '+' + abs.toFixed(1);
    return '+' + abs.toFixed(0);
  }

  function getColumns(mode, multiclass) {
    const cls = multiclass ? [{ key: 'cls', label: 'CLS', width: '30px' }] : [];
    if (mode === 'race') {
      return [
        { key: 'pos', label: 'P', width: '22px' },
        ...cls,
        { key: 'car', label: 'CAR', width: '32px' },
        { key: 'name', label: 'DRIVER', width: '1fr' },
        { key: 'ir', label: 'iR', width: '36px' },
        { key: 'gapLeader', label: 'GAP', width: '52px' },
        { key: 'gapAhead', label: 'INT', width: '48px' },
        { key: 'last', label: 'LAST', width: '56px' },
        { key: 'best', label: 'BEST', width: '56px' },
      ];
    } else if (mode === 'qualy') {
      return [
        { key: 'pos', label: 'P', width: '22px' },
        ...cls,
        { key: 'car', label: 'CAR', width: '32px' },
        { key: 'name', label: 'DRIVER', width: '1fr' },
        { key: 'ir', label: 'iR', width: '36px' },
        { key: 'best', label: 'BEST', width: '58px' },
        { key: 'deltaP1', label: '\u0394P1', width: '52px' },
        { key: 'last', label: 'LAST', width: '56px' },
        { key: 'status', label: 'ST', width: '44px' },
      ];
    } else {
      return [
        { key: 'pos', label: 'P', width: '22px' },
        ...cls,
        { key: 'car', label: 'CAR', width: '32px' },
        { key: 'name', label: 'DRIVER', width: '1fr' },
        { key: 'ir', label: 'iR', width: '36px' },
        { key: 'best', label: 'BEST', width: '58px' },
        { key: 'deltaP1', label: '\u0394P1', width: '52px' },
        { key: 'last', label: 'LAST', width: '56px' },
        { key: 'laps', label: 'L', width: '28px' },
      ];
    }
  }

  function setupColumns(mode, multiclass) {
    const cols = getColumns(mode, multiclass);
    const gridTemplate = cols.map(c => c.width).join(' ');
    columnsHeader.style.gridTemplateColumns = gridTemplate;
    columnsHeader.innerHTML = cols.map(c => `<span class="col-header">${c.label}</span>`).join('');
    return { cols, gridTemplate };
  }

  function estimateIR(drivers, playerIdx, multiclass) {
    if (!drivers || drivers.length < 2) return 0;
    const player = drivers[playerIdx];
    if (!player || !player.iRating) return 0;

    let field = drivers;
    if (multiclass && player.classId != null) {
      field = drivers.filter(d => d.classId === player.classId);
      if (field.length < 2) return 0;
    }

    const N = field.length;
    const playerIR = player.iRating;
    const playerPos = multiclass
      ? field.filter(d => d.position <= player.position).length
      : player.position;

    let expected = 0;
    for (const d of field) {
      if (d === player) continue;
      expected += 1 / (1 + Math.exp((d.iRating - playerIR) / B));
    }

    const actual = N - playerPos;
    const K = (200 / (N - 1)) / 0.8;
    return Math.round(K * (actual - expected));
  }

  // Find fastest (minimum positive) best lap per class, or overall if single class
  function findFastestBest(entries, multiclass) {
    const fastest = {};
    for (const e of entries) {
      if (!e.bestLap || e.bestLap <= 0) continue;
      const key = multiclass ? (e.classId || 0) : 0;
      if (!fastest[key] || e.bestLap < fastest[key]) {
        fastest[key] = e.bestLap;
      }
    }
    return fastest;
  }

  function isFastest(e, fastestMap, multiclass) {
    const key = multiclass ? (e.classId || 0) : 0;
    return e.bestLap > 0 && fastestMap[key] === e.bestLap;
  }

  // Class name lookup
  const CLASS_NAMES = { 1: 'GT3', 2: 'LMP3', 3: 'GT4' };

  /**
   * Group entries by class, ordered by fastest class first (lowest bestLap).
   * Returns array of { classId, classColor, className, entries, isPlayerClass }.
   */
  function groupByClass(entries, playerIdx) {
    const groups = {};
    for (const e of entries) {
      const cid = e.classId || 0;
      if (!groups[cid]) {
        groups[cid] = {
          classId: cid,
          classColor: e.classColor,
          className: CLASS_NAMES[cid] || ('Class ' + cid),
          entries: [],
          isPlayerClass: false,
          fastestLap: Infinity,
        };
      }
      groups[cid].entries.push(e);
      if (e.idx === playerIdx) groups[cid].isPlayerClass = true;
      if (e.bestLap > 0 && e.bestLap < groups[cid].fastestLap) {
        groups[cid].fastestLap = e.bestLap;
      }
    }

    // Sort by fastest class first
    return Object.values(groups).sort((a, b) => a.fastestLap - b.fastestLap);
  }

  function buildClassHeader(group) {
    const hdr = document.createElement('div');
    hdr.className = 'class-group-hdr';
    const hex = '#' + ((group.classColor || 0) & 0xFFFFFF).toString(16).padStart(6, '0');
    hdr.innerHTML = `
      <span class="gh-stripe" style="background:${hex}"></span>
      <span class="gh-name" style="color:${hex}">${group.className}</span>
      <span class="gh-meta">${group.entries.length} cars</span>
      ${group.isPlayerClass ? '<span class="gh-your">YOUR CLASS</span>' : ''}
    `;
    return hdr;
  }

  // --- Render functions ---

  function renderRace(data, cols, gridTemplate, multiclass) {
    const playerIdx = data.PlayerCarIdx;
    const drivers = data.drivers || [];
    const positions = data.CarIdxPosition || [];
    const classPositions = data.CarIdxClassPosition || [];
    const laps = data.CarIdxLap || [];
    const lastTimes = data.CarIdxLastLapTime || [];
    const bestTimes = data.CarIdxBestLapTime || [];

    const entries = [];
    for (let i = 0; i < drivers.length; i++) {
      if (!drivers[i] || !drivers[i].name) continue;
      entries.push({ idx: i, ...drivers[i], position: positions[i], classPosition: classPositions[i], lap: laps[i], lastLap: lastTimes[i], bestLap: bestTimes[i] });
    }
    entries.sort((a, b) => a.position - b.position);

    const classTotals = {};
    for (const e of entries) classTotals[e.classId] = (classTotals[e.classId] || 0) + 1;

    const fastestMap = findFastestBest(entries, multiclass);

    // Grouped or flat
    if (multiclass) {
      const groups = groupByClass(entries, playerIdx);
      body.innerHTML = '';
      for (const group of groups) {
        body.appendChild(buildClassHeader(group));
        for (const e of group.entries) {
          const row = buildRow(cols.length);
          row.style.gridTemplateColumns = gridTemplate;
          populateRaceRow(row, e, entries, data, playerIdx, classTotals, fastestMap, multiclass, cols);
          body.appendChild(row);
        }
      }
    } else {
      ensureRows(entries.length, gridTemplate);
      for (let i = 0; i < entries.length; i++) {
        populateRaceRow(body.children[i], entries[i], entries, data, playerIdx, classTotals, fastestMap, multiclass, cols);
      }
    }
  }

  function populateRaceRow(row, e, allEntries, data, playerIdx, classTotals, fastestMap, multiclass, cols) {
    const isPlayer = e.idx === playerIdx;
    row.className = 's-row' + (isPlayer ? ' player' : '');
    if (e.classColor != null) {
      row.style.setProperty('--class-color', '#' + (e.classColor & 0xFFFFFF).toString(16).padStart(6, '0'));
    }

    let colIdx = 0;
    row.children[colIdx++].textContent = e.position;
    if (multiclass) row.children[colIdx++].textContent = e.classPosition + '/' + classTotals[e.classId];
    row.children[colIdx++].textContent = e.carNum;
    row.children[colIdx++].textContent = e.name;
    row.children[colIdx++].textContent = (e.iRating / 1000).toFixed(1) + 'k';

    const leaderLap = allEntries.length > 0 ? allEntries[0].lap : 0;
    const posInList = allEntries.indexOf(e);

    const gapLeaderEl = row.children[colIdx++];
    const lapDiff = leaderLap - e.lap;
    if (posInList === 0) {
      gapLeaderEl.textContent = '\u2014';
      gapLeaderEl.className = 's-delta neutral';
    } else if (lapDiff > 0) {
      gapLeaderEl.textContent = '+' + lapDiff + (lapDiff === 1 ? ' LAP' : ' LAPS');
      gapLeaderEl.className = 's-delta lap-down';
    } else {
      const leader = allEntries[0];
      const distGap = Math.abs((data.CarIdxLapDistPct[leader.idx] || 0) - (data.CarIdxLapDistPct[e.idx] || 0));
      gapLeaderEl.textContent = formatGap(distGap * 90);
      gapLeaderEl.className = 's-delta neutral';
    }

    const gapAheadEl = row.children[colIdx++];
    if (posInList <= 0) {
      gapAheadEl.textContent = '\u2014';
      gapAheadEl.className = 's-delta neutral';
    } else {
      const ahead = allEntries[posInList - 1];
      if (ahead.lap - e.lap > 0) {
        gapAheadEl.textContent = '+' + (ahead.lap - e.lap) + 'L';
        gapAheadEl.className = 's-delta lap-down';
      } else {
        let d = (data.CarIdxLapDistPct[ahead.idx] || 0) - (data.CarIdxLapDistPct[e.idx] || 0);
        if (d < 0) d += 1;
        gapAheadEl.textContent = formatGap(d * 90);
        gapAheadEl.className = 's-delta neutral';
      }
    }

    row.children[colIdx].textContent = formatTime(e.lastLap);
    row.children[colIdx].className = 's-time';
    colIdx++;

    const bestEl = row.children[colIdx];
    bestEl.textContent = formatTime(e.bestLap);
    bestEl.className = 's-time' + (isFastest(e, fastestMap, multiclass) ? ' fastest' : '');
    colIdx++;
  }

  function renderQualy(data, cols, gridTemplate, multiclass) {
    const playerIdx = data.PlayerCarIdx;
    const drivers = data.drivers || [];
    const bestTimes = data.CarIdxBestLapTime || [];
    const lastTimes = data.CarIdxLastLapTime || [];
    const onPit = data.CarIdxOnPitRoad || [];
    const laps = data.CarIdxLap || [];
    const classPositions = data.CarIdxClassPosition || [];

    const entries = [];
    for (let i = 0; i < drivers.length; i++) {
      if (!drivers[i] || !drivers[i].name) continue;
      entries.push({ idx: i, ...drivers[i], bestLap: bestTimes[i], lastLap: lastTimes[i], inPit: onPit[i], lap: laps[i], classPosition: classPositions[i] });
    }
    entries.sort((a, b) => {
      if (!a.bestLap || a.bestLap <= 0) return 1;
      if (!b.bestLap || b.bestLap <= 0) return -1;
      return a.bestLap - b.bestLap;
    });

    const classTotals = {};
    for (const e of entries) classTotals[e.classId] = (classTotals[e.classId] || 0) + 1;
    const fastestMap = findFastestBest(entries, multiclass);
    const p1Best = entries.length > 0 && entries[0].bestLap > 0 ? entries[0].bestLap : 0;

    const populateRow = (row, e, pos) => {
      const isPlayer = e.idx === playerIdx;
      row.className = 's-row' + (isPlayer ? ' player' : '');
      if (e.classColor != null) row.style.setProperty('--class-color', '#' + (e.classColor & 0xFFFFFF).toString(16).padStart(6, '0'));
      let colIdx = 0;
      row.children[colIdx++].textContent = pos;
      if (multiclass) row.children[colIdx++].textContent = e.classPosition + '/' + classTotals[e.classId];
      row.children[colIdx++].textContent = e.carNum;
      row.children[colIdx++].textContent = e.name;
      row.children[colIdx++].textContent = (e.iRating / 1000).toFixed(1) + 'k';
      const bestEl = row.children[colIdx];
      bestEl.textContent = formatTime(e.bestLap);
      bestEl.className = 's-time' + (isFastest(e, fastestMap, multiclass) ? ' fastest' : '');
      colIdx++;
      const deltaEl = row.children[colIdx++];
      if (pos === 1 || !e.bestLap || e.bestLap <= 0 || p1Best <= 0) {
        deltaEl.textContent = pos === 1 ? '\u2014' : '';
        deltaEl.className = 's-delta neutral';
      } else {
        deltaEl.textContent = '+' + (e.bestLap - p1Best).toFixed(3);
        deltaEl.className = 's-delta bad';
      }
      row.children[colIdx].textContent = formatTime(e.lastLap);
      row.children[colIdx].className = 's-time';
      colIdx++;
      const statusEl = row.children[colIdx++];
      if (e.inPit) { statusEl.textContent = 'IN LAP'; statusEl.className = 's-status in'; }
      else if (e.lap <= 1) { statusEl.textContent = 'OUT LAP'; statusEl.className = 's-status out'; }
      else { statusEl.textContent = 'FLYING'; statusEl.className = 's-status flying'; }
    };

    if (multiclass) {
      const groups = groupByClass(entries, playerIdx);
      body.innerHTML = '';
      for (const group of groups) {
        body.appendChild(buildClassHeader(group));
        group.entries.forEach((e, i) => {
          const row = buildRow(cols.length);
          row.style.gridTemplateColumns = gridTemplate;
          populateRow(row, e, entries.indexOf(e) + 1);
          body.appendChild(row);
        });
      }
    } else {
      ensureRows(entries.length, gridTemplate);
      for (let i = 0; i < entries.length; i++) {
        populateRow(body.children[i], entries[i], i + 1);
      }
    }
  }

  function renderPractice(data, cols, gridTemplate, multiclass) {
    const playerIdx = data.PlayerCarIdx;
    const drivers = data.drivers || [];
    const bestTimes = data.CarIdxBestLapTime || [];
    const lastTimes = data.CarIdxLastLapTime || [];
    const laps = data.CarIdxLap || [];
    const classPositions = data.CarIdxClassPosition || [];

    const entries = [];
    for (let i = 0; i < drivers.length; i++) {
      if (!drivers[i] || !drivers[i].name) continue;
      entries.push({ idx: i, ...drivers[i], bestLap: bestTimes[i], lastLap: lastTimes[i], lap: laps[i], classPosition: classPositions[i] });
    }
    entries.sort((a, b) => {
      if (!a.bestLap || a.bestLap <= 0) return 1;
      if (!b.bestLap || b.bestLap <= 0) return -1;
      return a.bestLap - b.bestLap;
    });

    const classTotals = {};
    for (const e of entries) classTotals[e.classId] = (classTotals[e.classId] || 0) + 1;
    const fastestMap = findFastestBest(entries, multiclass);
    const p1Best = entries.length > 0 && entries[0].bestLap > 0 ? entries[0].bestLap : 0;

    const populateRow = (row, e, pos) => {
      const isPlayer = e.idx === playerIdx;
      row.className = 's-row' + (isPlayer ? ' player' : '');
      if (e.classColor != null) row.style.setProperty('--class-color', '#' + (e.classColor & 0xFFFFFF).toString(16).padStart(6, '0'));
      let colIdx = 0;
      row.children[colIdx++].textContent = pos;
      if (multiclass) row.children[colIdx++].textContent = e.classPosition + '/' + classTotals[e.classId];
      row.children[colIdx++].textContent = e.carNum;
      row.children[colIdx++].textContent = e.name;
      row.children[colIdx++].textContent = (e.iRating / 1000).toFixed(1) + 'k';
      const bestEl = row.children[colIdx];
      bestEl.textContent = formatTime(e.bestLap);
      bestEl.className = 's-time' + (isFastest(e, fastestMap, multiclass) ? ' fastest' : '');
      colIdx++;
      const deltaEl = row.children[colIdx++];
      if (pos === 1 || !e.bestLap || e.bestLap <= 0 || p1Best <= 0) {
        deltaEl.textContent = pos === 1 ? '\u2014' : '';
        deltaEl.className = 's-delta neutral';
      } else {
        deltaEl.textContent = '+' + (e.bestLap - p1Best).toFixed(3);
        deltaEl.className = 's-delta bad';
      }
      row.children[colIdx].textContent = formatTime(e.lastLap);
      row.children[colIdx].className = 's-time';
      colIdx++;
      row.children[colIdx++].textContent = e.lap || 0;
    };

    if (multiclass) {
      const groups = groupByClass(entries, playerIdx);
      body.innerHTML = '';
      for (const group of groups) {
        body.appendChild(buildClassHeader(group));
        group.entries.forEach((e, i) => {
          const row = buildRow(cols.length);
          row.style.gridTemplateColumns = gridTemplate;
          populateRow(row, e, entries.indexOf(e) + 1);
          body.appendChild(row);
        });
      }
    } else {
      ensureRows(entries.length, gridTemplate);
      for (let i = 0; i < entries.length; i++) {
        populateRow(body.children[i], entries[i], i + 1);
      }
    }
  }

  // --- DOM helpers ---

  function buildRow(numCols) {
    const row = document.createElement('div');
    row.className = 's-row';
    for (let i = 0; i < numCols; i++) {
      row.appendChild(document.createElement('div'));
    }
    return row;
  }

  function ensureRows(count, gridTemplate) {
    const numCols = gridTemplate.split(' ').length;
    while (body.children.length < count) {
      const row = buildRow(numCols);
      row.style.gridTemplateColumns = gridTemplate;
      body.appendChild(row);
    }
    while (body.children.length > count) body.removeChild(body.lastChild);
    for (let i = 0; i < body.children.length; i++) {
      body.children[i].style.gridTemplateColumns = gridTemplate;
    }
  }

  // --- Main render ---

  function render(data) {
    if (!data || data.PlayerCarIdx === undefined) return;

    const sessionType = data.SessionType || '';
    const mode = pickMode(sessionType);
    const multiclass = (data.NumCarClasses || 1) > 1;
    const drivers = data.drivers || [];

    // Update header
    if (data.TrackName) trackNameEl.textContent = data.TrackName.toUpperCase();
    sessionInfoEl.textContent = sessionLabel(sessionType) + (multiclass ? ' \u00B7 ' + (data.NumCarClasses || 1) + ' CLASSES' : '');

    if (mode !== lastMode || multiclass !== lastMulticlass) {
      lastMode = mode;
      lastMulticlass = multiclass;
      body.innerHTML = '';
    }

    const { cols, gridTemplate } = setupColumns(mode, multiclass);

    // iR estimator — race only
    if (mode === 'race' && drivers.length >= 2) {
      irEstimator.classList.add('visible');
      const driversWithPos = drivers.map((d, i) => ({
        ...d,
        position: (data.CarIdxPosition || [])[i],
        carIdx: i,
        carClassId: d.classId,
      }));
      const delta = estimateIR(driversWithPos, data.PlayerCarIdx, multiclass);
      const prefix = '~';
      if (delta > 0) {
        irValue.textContent = prefix + '+' + delta;
        irValue.className = 'std-ir-value good';
      } else if (delta < 0) {
        irValue.textContent = prefix + delta;
        irValue.className = 'std-ir-value bad';
      } else {
        irValue.textContent = prefix + '+0';
        irValue.className = 'std-ir-value zero';
      }
    } else {
      irEstimator.classList.remove('visible');
    }

    if (mode === 'race') renderRace(data, cols, gridTemplate, multiclass);
    else if (mode === 'qualy') renderQualy(data, cols, gridTemplate, multiclass);
    else renderPractice(data, cols, gridTemplate, multiclass);
  }

  window.overlayAPI.onEditMode((enabled) => {
    document.body.classList.toggle('edit-mode', enabled);
  });

  window.overlayAPI.onTelemetry(render);
})();
