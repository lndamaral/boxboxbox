(function () {
  'use strict';

  const card = document.getElementById('card');
  const body = document.getElementById('body');
  const sessionBadge = document.getElementById('sessionBadge');
  const trackNameEl = document.getElementById('trackName');
  const connDot = document.getElementById('connDot');

  // Auto-scale: shrink content to fit if window is smaller than content
  function autoScale() {
    card.style.transform = '';
    card.style.width = '';
    card.style.height = '';

    const cardRect = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const scaleX = vw / cardRect.width;
    const scaleY = vh / cardRect.height;
    const scale = Math.min(scaleX, scaleY, 1);

    if (scale < 1) {
      card.style.transform = `scale(${scale})`;
      card.style.width = (vw / scale) + 'px';
      card.style.height = (vh / scale) + 'px';
    } else {
      card.style.width = '100%';
      card.style.height = '100%';
    }
  }

  window.addEventListener('resize', autoScale);
  autoScale();

  const LICENSE_COLORS = {
    P: 'var(--lic-pro)',
    A: 'var(--lic-a)',
    B: 'var(--lic-b)',
    C: 'var(--lic-c)',
    D: 'var(--lic-d)',
    R: 'var(--lic-r)',
  };

  function pickDeltaMode(sessionType) {
    if (!sessionType) return 'race';
    const st = sessionType.toLowerCase();
    if (st === 'race') return 'race';
    if (st.includes('qualify') || st === 'lone qualifying' || st === 'open qualify') return 'qualy';
    if (st.includes('practice') || st === 'offline testing') return 'qualy';
    return 'race';
  }

  if (typeof window !== 'undefined') {
    window._pickDeltaMode = pickDeltaMode;
  }

  function sessionLabel(sessionType) {
    if (!sessionType) return '';
    const st = sessionType.toLowerCase();
    if (st === 'race') return 'RACE';
    if (st.includes('qualify')) return 'QUALY';
    if (st.includes('practice') || st === 'offline testing') return 'PRAC';
    return sessionType.toUpperCase().slice(0, 5);
  }

  function formatDelta(seconds) {
    const abs = Math.abs(seconds);
    if (abs < 10) return abs.toFixed(2);
    if (abs < 100) return abs.toFixed(1);
    return abs.toFixed(0);
  }

  function formatLapTime(seconds) {
    if (!seconds || seconds <= 0) return '\u2014';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + secs.toFixed(3).padStart(6, '0');
  }

  function buildRow() {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="row-pos"></div>
      <div class="row-num"></div>
      <div class="row-name"></div>
      <div class="row-ir"></div>
      <div class="row-sr"></div>
      <div class="row-last"></div>
      <div class="row-delta"></div>
    `;
    return row;
  }

  function render(data) {
    if (!data || data.PlayerCarIdx === undefined) return;

    const playerIdx = data.PlayerCarIdx;
    const drivers = data.drivers || [];
    const lapDistPct = data.CarIdxLapDistPct || [];
    const positions = data.CarIdxPosition || [];
    const onPit = data.CarIdxOnPitRoad || [];
    const lastLapTimes = data.CarIdxLastLapTime || [];
    const bestLapTimes = data.CarIdxBestLapTime || [];
    const sessionType = data.SessionType || '';

    if (drivers.length === 0) return;

    // Update header
    const label = sessionLabel(sessionType);
    if (sessionBadge.textContent !== label) sessionBadge.textContent = label;

    const trackName = data.TrackName || '';
    if (trackNameEl.textContent !== trackName.toUpperCase()) {
      trackNameEl.textContent = trackName.toUpperCase();
    }

    const deltaMode = pickDeltaMode(sessionType);
    const playerDist = lapDistPct[playerIdx] || 0;
    const playerBest = bestLapTimes[playerIdx] || 0;

    // Build entries
    const entries = [];
    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      if (!driver || !driver.name) continue;

      let relDist = lapDistPct[i] - playerDist;
      if (relDist > 0.5) relDist -= 1;
      if (relDist < -0.5) relDist += 1;

      entries.push({
        idx: i,
        name: driver.name,
        carNum: driver.carNum,
        license: driver.license || '',
        classColor: driver.classColor,
        iRating: driver.iRating || 0,
        position: positions[i] || 0,
        relDist,
        inPit: onPit[i] || false,
        isPlayer: i === playerIdx,
        lastLapTime: lastLapTimes[i] || 0,
        bestLapTime: bestLapTimes[i] || 0,
      });
    }

    entries.sort((a, b) => b.relDist - a.relDist);

    // Limit to 3 ahead + player + 3 behind
    const playerIndex = entries.findIndex(e => e.isPlayer);
    if (playerIndex >= 0 && entries.length > 7) {
      const start = Math.max(0, playerIndex - 3);
      const end = Math.min(entries.length, start + 7);
      const adjustedStart = Math.max(0, end - 7);
      entries.splice(0, adjustedStart);
      entries.length = Math.min(entries.length, 7);
    }

    while (body.children.length < entries.length) body.appendChild(buildRow());
    while (body.children.length > entries.length) body.removeChild(body.lastChild);

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const row = body.children[i];

      row.className = 'row';
      if (e.isPlayer) row.classList.add('player');
      if (e.inPit) row.classList.add('in-pit');

      // Class stripe via CSS custom property
      if (e.classColor !== undefined) {
        const hex = '#' + (e.classColor & 0xFFFFFF).toString(16).padStart(6, '0');
        row.style.setProperty('--class-color', e.isPlayer ? '' : hex);
      }

      const pos = row.children[0];
      const num = row.children[1];
      const name = row.children[2];
      const ir = row.children[3];
      const sr = row.children[4];
      const last = row.children[5];
      const delta = row.children[6];

      // Position
      pos.textContent = e.position;

      // Car number with optional pit chip
      if (e.inPit) {
        num.innerHTML = e.carNum + '<span class="pit-chip">P</span>';
      } else {
        num.textContent = e.carNum;
      }

      // Name
      name.textContent = e.name;

      // iRating
      ir.textContent = (e.iRating / 1000).toFixed(1) + 'k';

      // SR / License badge
      const licLetter = e.license.charAt(0);
      const licColor = LICENSE_COLORS[licLetter] || 'var(--text-muted)';
      sr.textContent = e.license;
      sr.style.background = licColor;

      // Last lap time
      last.textContent = formatLapTime(e.lastLapTime);

      // Delta
      if (e.isPlayer) {
        delta.textContent = '\u2501'; // horizontal bar
        delta.className = 'row-delta delta-player';
      } else if (deltaMode === 'race') {
        const estLapTime = 90;
        const deltaSeconds = Math.abs(e.relDist) * estLapTime;
        const sign = e.relDist > 0 ? '+' : '-';
        delta.textContent = sign + formatDelta(deltaSeconds);
        delta.className = 'row-delta ' + (e.relDist > 0 ? 'delta-ahead' : 'delta-behind');
      } else {
        if (playerBest <= 0 || e.bestLapTime <= 0) {
          delta.textContent = '0.000';
          delta.className = 'row-delta delta-player';
        } else {
          const bestDelta = e.bestLapTime - playerBest;
          const sign = bestDelta >= 0 ? '+' : '\u2212';
          delta.textContent = sign + Math.abs(bestDelta).toFixed(3);
          delta.className = 'row-delta ' + (bestDelta <= 0 ? 'delta-behind' : 'delta-ahead');
        }
      }
    }
  }

  window.overlayAPI.onEditMode((enabled) => {
    document.body.classList.toggle('edit-mode', enabled);
  });

  window.overlayAPI.onConnectionState((connected) => {
    connDot.classList.toggle('connected', connected);
  });

  window.overlayAPI.onTelemetry(render);
})();
