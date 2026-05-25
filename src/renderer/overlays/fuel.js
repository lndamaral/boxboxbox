(function () {
  'use strict';

  const card = document.getElementById('card');

  function autoScale() {
    card.style.transform = '';
    card.style.width = '';
    card.style.height = '';
    const r = card.getBoundingClientRect();
    const s = Math.min(window.innerWidth / r.width, window.innerHeight / r.height, 1);
    if (s < 1) {
      card.style.transform = `scale(${s})`;
      card.style.transformOrigin = 'top left';
      card.style.width = (window.innerWidth / s) + 'px';
      card.style.height = (window.innerHeight / s) + 'px';
    }
  }
  window.addEventListener('resize', autoScale);
  autoScale();

  const elLevel = document.getElementById('fuelLevel');
  const elAvg = document.getElementById('fuelAvg');
  const elLapsLeft = document.getElementById('fuelLapsLeft');
  const elTarget = document.getElementById('fuelTarget');
  const elDelta = document.getElementById('fuelDelta');
  const connDot = document.getElementById('connDot');

  const MAX_LAP_HISTORY = 3;
  // iRacing returns 604800s (one week) as a sentinel for unlimited /
  // lap-based sessions. Treat anything past this threshold as no limit.
  const SESSION_TIME_MAX = 7200;
  let fuelPerLapHistory = [];
  let prevLap = -1;
  let prevFuelLevel = -1;

  function avgConsumption() {
    if (fuelPerLapHistory.length === 0) return 0;
    const sum = fuelPerLapHistory.reduce((a, b) => a + b, 0);
    return sum / fuelPerLapHistory.length;
  }

  function render(data) {
    const fuelLevel = data.FuelLevel;
    const lap = data.Lap;
    const sessionTimeRemain = data.SessionTimeRemain;
    const lastLapTime = data.LapLastLapTime;

    if (fuelLevel == null) return;

    // Track fuel consumption per lap
    if (lap != null && lap > 0 && lap !== prevLap) {
      if (prevLap > 0 && prevFuelLevel > 0) {
        const used = prevFuelLevel - fuelLevel;
        if (used > 0) {
          fuelPerLapHistory.push(used);
          if (fuelPerLapHistory.length > MAX_LAP_HISTORY) fuelPerLapHistory.shift();
        }
      }
      prevLap = lap;
      prevFuelLevel = fuelLevel;
    }
    if (prevLap < 0 && lap > 0) {
      prevLap = lap;
      prevFuelLevel = fuelLevel;
    }

    const avg = avgConsumption();
    const lapsLeft = avg > 0 ? fuelLevel / avg : Infinity;
    const avgLapTime = lastLapTime > 0 ? lastLapTime : 90;
    let sessionLaps = Infinity;
    if (sessionTimeRemain > 0 && sessionTimeRemain < SESSION_TIME_MAX && avgLapTime > 0) {
      sessionLaps = sessionTimeRemain / avgLapTime;
    }

    let target = 0;
    if (sessionLaps !== Infinity && avg > 0) {
      target = (sessionLaps + 1) * avg;
    }

    const delta = target > 0 ? target - fuelLevel : -fuelLevel;

    // Render level with color
    elLevel.textContent = fuelLevel.toFixed(1);
    const levelParent = elLevel.parentElement;
    levelParent.className = 'fuel-block-value';
    if (lapsLeft !== Infinity) {
      if (lapsLeft > 5) levelParent.classList.add('good');
      else if (lapsLeft > 2) levelParent.classList.add('warn');
      else levelParent.classList.add('alert');
    }

    elAvg.textContent = avg > 0 ? avg.toFixed(2) : '--';
    elLapsLeft.textContent = lapsLeft === Infinity ? '--' : lapsLeft.toFixed(1);
    elTarget.textContent = target > 0 ? target.toFixed(1) : '--';

    // Delta
    if (target > 0) {
      const sign = delta >= 0 ? '+' : '';
      elDelta.textContent = sign + delta.toFixed(1) + ' L';
      elDelta.className = 'fuel-delta-value';
      if (delta <= -2) elDelta.classList.add('good');
      else if (delta <= 0) elDelta.classList.add('warn');
      else elDelta.classList.add('bad');
    } else {
      elDelta.textContent = '--';
      elDelta.className = 'fuel-delta-value';
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
