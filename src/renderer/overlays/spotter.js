(function () {
  'use strict';

  const svgNS = 'http://www.w3.org/2000/svg';
  const card = document.getElementById('card');
  const adversariesGroup = document.getElementById('adversaries');
  const speedEl = document.getElementById('speed');

  const CENTER = 90;
  const MAX_DIST = 15; // meters

  // Ring radii map to distances: 85px=15m, 55px=5m, 28px=3m
  // Linear mapping: pixels = (distance / MAX_DIST) * 85
  function distToRadius(distance) {
    return (distance / MAX_DIST) * 85;
  }

  // Color by proximity
  function proximityColor(distance) {
    if (distance < 3) return '#f87171';              // red — critical
    if (distance < 5) return '#fbbf24';              // yellow — caution
    return 'rgba(255, 255, 255, 0.32)';              // grey — visible but far
  }

  // Car size by proximity (closer = larger)
  function carSize(distance) {
    if (distance < 3) return { w: 14, h: 28 };
    if (distance < 5) return { w: 13, h: 26 };
    return { w: 12, h: 22 };
  }

  // Map side + isAhead to angle (radians from north, clockwise)
  // N=0, NE=π/4, E=π/2, SE=3π/4, S=π, SW=5π/4, W=3π/2, NW=7π/4
  function slotAngle(side, isAhead) {
    if (side === 'front') return 0;                    // N
    if (side === 'back') return Math.PI;               // S
    if (side === 'left' && isAhead) return -Math.PI / 4;  // NW
    if (side === 'left') return -Math.PI / 2;          // W (side-by-side or behind)
    if (side === 'right' && isAhead) return Math.PI / 4;  // NE
    if (side === 'right') return Math.PI / 2;          // E
    return 0;
  }

  // Pool of adversary car-shaped polygons (hexagonal silhouette: narrow at
  // front/rear, wider in the middle — reads as a car from above).
  const carPool = [];

  function getOrCreateCar(idx) {
    if (idx < carPool.length) return carPool[idx];
    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('stroke', '#0a0a0d');
    poly.setAttribute('stroke-width', '1');
    poly.setAttribute('stroke-linejoin', 'round');
    adversariesGroup.appendChild(poly);
    carPool.push(poly);
    return poly;
  }

  function carShapePoints(x, y, w, h) {
    const taper = w * 0.18;
    const shoulder = h * 0.16;
    return [
      `${x + taper},${y}`,
      `${x + w - taper},${y}`,
      `${x + w},${y + shoulder}`,
      `${x + w},${y + h - shoulder}`,
      `${x + w - taper},${y + h}`,
      `${x + taper},${y + h}`,
      `${x},${y + h - shoulder}`,
      `${x},${y + shoulder}`,
    ].join(' ');
  }

  function render(data) {
    if (!data || data.PlayerCarIdx === undefined) {
      card.classList.add('empty');
      return;
    }

    // Speed display
    const speed = data.Speed != null ? data.Speed : 0;
    speedEl.textContent = Math.round(speed * 3.6) + ' KM/H';

    // Calculate nearby adversaries inline (no shared module in renderer)
    const playerIdx = data.PlayerCarIdx;
    const lapDistPct = data.CarIdxLapDistPct || [];
    const trackLength = data.TrackLength || 3700;
    const carLeftRight = data.CarLeftRight || 1;
    const drivers = data.drivers || [];
    const playerDist = lapDistPct[playerIdx];

    if (playerDist == null) {
      card.classList.add('empty');
      return;
    }

    // Find nearby cars
    const nearby = [];
    for (let i = 0; i < lapDistPct.length; i++) {
      if (i === playerIdx) continue;
      if (!drivers[i] || !drivers[i].name) continue;
      const d = lapDistPct[i];
      if (d == null || d < 0) continue;

      let delta = d - playerDist;
      if (delta > 0.5) delta -= 1.0;
      if (delta < -0.5) delta += 1.0;

      const distance = Math.abs(delta) * trackLength;
      if (distance > MAX_DIST) continue;

      nearby.push({ carIdx: i, distance, isAhead: delta > 0 });
    }

    nearby.sort((a, b) => a.distance - b.distance);

    // Assign sides based on CarLeftRight
    let leftSlots = 0, rightSlots = 0;
    switch (carLeftRight) {
      case 2: leftSlots = 1; break;
      case 3: rightSlots = 1; break;
      case 4: leftSlots = 1; rightSlots = 1; break;
      case 5: leftSlots = 2; break;
      case 6: rightSlots = 2; break;
    }

    let usedLeft = 0, usedRight = 0;
    const positioned = nearby.map(entry => {
      let side;
      if (entry.distance < 5 && (usedLeft < leftSlots || usedRight < rightSlots)) {
        if (usedLeft < leftSlots) { side = 'left'; usedLeft++; }
        else if (usedRight < rightSlots) { side = 'right'; usedRight++; }
      }
      if (!side) side = entry.isAhead ? 'front' : 'back';
      return { ...entry, side };
    });

    // Render adversary cars
    for (let i = 0; i < positioned.length; i++) {
      const adv = positioned[i];
      const poly = getOrCreateCar(i);
      const color = proximityColor(adv.distance);
      const size = carSize(adv.distance);
      const angle = slotAngle(adv.side, adv.isAhead);
      const r = distToRadius(adv.distance);

      const x = CENTER + Math.sin(angle) * r - size.w / 2;
      const y = CENTER - Math.cos(angle) * r - size.h / 2;

      poly.setAttribute('points', carShapePoints(x, y, size.w, size.h));
      poly.setAttribute('fill', color);
      poly.style.display = '';
    }

    // Hide unused cars
    for (let i = positioned.length; i < carPool.length; i++) {
      carPool[i].style.display = 'none';
    }

    // Hide whole card when no adversary is within range
    card.classList.toggle('empty', positioned.length === 0);
  }

  window.overlayAPI.onEditMode((enabled) => {
    document.body.classList.toggle('edit-mode', enabled);
  });

  window.overlayAPI.onTelemetry(render);
})();
