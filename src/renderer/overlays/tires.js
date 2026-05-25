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

  const headerMeta = document.getElementById('headerMeta');
  const CORNERS = ['LF', 'RF', 'LR', 'RR'];
  const ZONES = ['CL', 'CM', 'CR'];

  const pressureEls = {};
  const tempEls = {};
  const lapBadgeEls = {};

  for (const c of CORNERS) {
    pressureEls[c] = document.getElementById('p' + c);
    lapBadgeEls[c] = document.getElementById('lap' + c);
    tempEls[c] = {};
    for (const z of ZONES) {
      tempEls[c][z] = document.getElementById('t' + c + '_' + z);
    }
  }

  // Band → CSS class mapping for temp cells
  const BAND_CLASS = {
    cold: 'tt-cold',
    cool: 'tt-cool',
    ideal: 'tt-ideal',
    warm: 'tt-warm',
    hot: 'tt-hot',
    crit: 'tt-crit',
    uncalibrated: 'tt-uncal',
  };

  // Band → pressure color class
  const PRESSURE_BAND = {
    cold: 'cold',
    cool: 'cold',
    ideal: 'ideal',
    warm: 'high',
    hot: 'high',
    crit: 'crit',
    uncalibrated: 'uncal',
  };

  function render(data) {
    const calState = data.tireCalState;
    const isCalibrated = calState && calState.calibrated;
    const calibration = calState && calState.calibration;

    // Header badge
    if (!isCalibrated) {
      const progress = calState ? Math.round(calState.progress * 100) : 0;
      headerMeta.textContent = 'CAL ' + progress + '%';
    } else {
      const tempLap = data.TireTempLap;
      headerMeta.textContent = tempLap > 0 ? 'LAP ' + tempLap : '';
    }

    // Pressures — live
    for (const c of CORNERS) {
      const key = c + 'pressure';
      const val = data[key];
      if (val != null) {
        const el = pressureEls[c];
        el.innerHTML = val.toFixed(1) + '<span class="unit">kPa</span>';

        if (!isCalibrated) {
          el.className = 'tire-pressure uncal';
        } else {
          const band = getColorBandLocal(val, calibration.pressure[c]);
          el.className = 'tire-pressure ' + (PRESSURE_BAND[band] || 'uncal');
        }
      }
    }

    // Temperatures — snapshot per lap
    for (const c of CORNERS) {
      for (const z of ZONES) {
        const key = c + 'temp' + z;
        const val = data[key];
        if (val != null) {
          const el = tempEls[c][z];
          el.textContent = Math.round(val);

          if (!isCalibrated) {
            el.className = 'tire-temp-cell tt-uncal';
          } else {
            const band = getColorBandLocal(val, calibration.temp ? calibration.temp[c] : null);
            el.className = 'tire-temp-cell ' + (BAND_CLASS[band] || 'tt-uncal');
          }
        }
      }
    }

    // Per-quadrant lap badges
    const tempLap = data.TireTempLap;
    for (const c of CORNERS) {
      lapBadgeEls[c].textContent = (tempLap != null && tempLap > 0) ? 'L' + tempLap : '';
    }
  }

  // Local implementation of getColorBand (same logic as calculator)
  function getColorBandLocal(value, cal) {
    if (!cal) return 'uncalibrated';
    const range = cal.p90 - cal.p10;
    const lowCrit = cal.p10 - range * 0.3;
    const highCrit = cal.p90 + range * 0.3;

    if (value <= lowCrit) return 'cold';
    if (value <= cal.p10) return 'cool';
    if (value <= cal.p90) return 'ideal';
    if (value <= highCrit) return 'warm';
    if (value <= highCrit + range * 0.2) return 'hot';
    return 'crit';
  }

  window.overlayAPI.onEditMode((enabled) => {
    document.body.classList.toggle('edit-mode', enabled);
  });

  window.overlayAPI.onTelemetry(render);
})();
