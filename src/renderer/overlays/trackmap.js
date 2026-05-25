(function () {
  'use strict';

  const svgNS = 'http://www.w3.org/2000/svg';
  const carDotsGroup = document.getElementById('carDots');
  const trackPlaceholder = document.getElementById('trackPlaceholder');
  const trackBuilt = document.getElementById('trackBuilt');
  const trackMeta = document.getElementById('trackMeta');
  const posLabel = document.getElementById('posLabel');
  const posValue = document.getElementById('posValue');
  const mapSvg = document.getElementById('mapSvg');

  // Active track element (placeholder or built path)
  let activeTrack = trackPlaceholder;
  let trackLength = activeTrack.getTotalLength();
  let mapApplied = false;

  const dotPool = new Map();

  function needsDarkText(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
  }

  function getOrCreateDot(idx) {
    let group = dotPool.get(idx);
    if (!group) {
      group = document.createElementNS(svgNS, 'g');
      group.classList.add('car-group');

      const halo = document.createElementNS(svgNS, 'circle');
      halo.classList.add('car-halo');
      halo.setAttribute('r', '12');
      halo.style.display = 'none';
      group.appendChild(halo);

      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('r', '9');
      group.appendChild(circle);

      const text = document.createElementNS(svgNS, 'text');
      text.classList.add('car-label');
      group.appendChild(text);

      carDotsGroup.appendChild(group);
      dotPool.set(idx, group);
    }
    return group;
  }

  function applyBuiltMap(mapData) {
    if (mapApplied) return;
    trackBuilt.setAttribute('d', mapData.svgPathD);
    if (mapData.viewBox) mapSvg.setAttribute('viewBox', mapData.viewBox);
    trackPlaceholder.style.display = 'none';
    trackBuilt.style.display = '';
    activeTrack = trackBuilt;
    trackLength = activeTrack.getTotalLength();
    mapApplied = true;
  }

  function render(data) {
    if (!data || data.PlayerCarIdx === undefined) return;

    const playerIdx = data.PlayerCarIdx;
    const drivers = data.drivers || [];
    const lapDistPct = data.CarIdxLapDistPct || [];
    const positions = data.CarIdxPosition || [];
    const onPit = data.CarIdxOnPitRoad || [];

    if (drivers.length === 0) return;

    // Check if built map is available
    const mapState = data.trackMapState;
    if (mapState && mapState.built && mapState.mapData && !mapApplied) {
      applyBuiltMap(mapState.mapData);
      window.overlayAPI.showOverlay('trackmap');
    }

    // Don't render anything until map is built
    if (!mapApplied) return;

    // Header meta
    if (data.TrackName) {
      trackMeta.textContent = data.TrackName.toUpperCase();
    }

    const activeIndices = new Set();
    let playerPos = 0;

    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      if (!driver || !driver.name) continue;

      const pct = lapDistPct[i];
      if (pct == null || pct < 0) continue;

      activeIndices.add(i);
      const group = getOrCreateDot(i);

      const point = activeTrack.getPointAtLength(pct * trackLength);
      const isPlayer = i === playerIdx;
      const inPit = onPit[i] || false;
      const pos = positions[i] || 0;

      if (isPlayer) playerPos = pos;

      const halo = group.children[0];
      const circle = group.children[1];
      const text = group.children[2];

      halo.setAttribute('cx', point.x);
      halo.setAttribute('cy', point.y);
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      text.setAttribute('x', point.x);
      text.setAttribute('y', point.y);

      text.textContent = pos;

      if (isPlayer) {
        circle.setAttribute('fill', '#00e5ff');
        halo.style.display = '';
        text.setAttribute('fill', '#000');
      } else {
        halo.style.display = 'none';
        if (driver.classColor !== undefined) {
          const hex = '#' + (driver.classColor & 0xFFFFFF).toString(16).padStart(6, '0');
          circle.setAttribute('fill', hex);
          text.setAttribute('fill', needsDarkText(hex) ? '#000' : '#fff');
        } else {
          circle.setAttribute('fill', 'rgba(255,255,255,0.5)');
          text.setAttribute('fill', '#000');
        }
      }

      group.classList.toggle('in-pit', inPit);
    }

    for (const [idx, group] of dotPool) {
      if (!activeIndices.has(idx)) {
        group.remove();
        dotPool.delete(idx);
      }
    }

    const playerGroup = dotPool.get(playerIdx);
    if (playerGroup) carDotsGroup.appendChild(playerGroup);

    posLabel.textContent = 'YOUR POS';
    posValue.textContent = 'P' + playerPos + ' / ' + drivers.length;
  }

  window.overlayAPI.onEditMode((enabled) => {
    document.body.classList.toggle('edit-mode', enabled);
  });

  window.overlayAPI.onTelemetry(render);
})();
