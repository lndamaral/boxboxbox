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

  const canvas = document.getElementById('traceCanvas');
  const steeringBar = document.getElementById('steeringBar');
  const steerDeg = document.getElementById('steerDeg');
  const headerMeta = document.getElementById('headerMeta');

  const dpr = window.devicePixelRatio || 1;
  canvas.width = 358 * dpr;
  canvas.height = 96 * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const HISTORY_LEN = 150;
  const throttleHistory = new Float32Array(HISTORY_LEN);
  const brakeHistory = new Float32Array(HISTORY_LEN);
  const clutchHistory = new Float32Array(HISTORY_LEN);
  let writeIdx = 0;
  let filled = false;

  const THROTTLE_COLOR = '#4ade80';
  const BRAKE_COLOR = '#f87171';
  const CLUTCH_COLOR = '#60a5fa';

  const W = 358;
  const H = 96;

  function pushSample(throttle, brake, clutch) {
    throttleHistory[writeIdx] = throttle;
    brakeHistory[writeIdx] = brake;
    clutchHistory[writeIdx] = clutch;
    writeIdx++;
    if (writeIdx >= HISTORY_LEN) {
      writeIdx = 0;
      filled = true;
    }
  }

  function drawTrace(history, color) {
    const count = filled ? HISTORY_LEN : writeIdx;
    if (count < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;

    for (let i = 0; i < count; i++) {
      const readIdx = filled ? (writeIdx + i) % HISTORY_LEN : i;
      const x = (i / (HISTORY_LEN - 1)) * W;
      const y = H - history[readIdx] * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function render(data) {
    const throttle = data.Throttle != null ? data.Throttle : 0;
    const brake = data.Brake != null ? data.Brake : 0;
    const clutch = data.Clutch != null ? data.Clutch : 0;
    const steering = data.SteeringWheelAngle != null ? data.SteeringWheelAngle : 0;

    pushSample(throttle, brake, clutch);

    // Clear and redraw
    ctx.clearRect(0, 0, W, H);

    // Half line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    drawTrace(throttleHistory, THROTTLE_COLOR);
    drawTrace(brakeHistory, BRAKE_COLOR);
    drawTrace(clutchHistory, CLUTCH_COLOR);

    // Header meta: Gear · RPM · Speed
    const gear = data.Gear != null ? data.Gear : 0;
    const rpm = data.RPM != null ? data.RPM : 0;
    const speed = data.Speed != null ? data.Speed : 0;
    const kph = Math.round(speed * 3.6);
    headerMeta.textContent = 'G' + gear + ' \u00B7 ' + (rpm / 1000).toFixed(1) + 'K RPM \u00B7 ' + kph + ' KPH';

    // Steering
    const maxAngle = 1.2;
    const normalized = Math.max(-1, Math.min(1, steering / maxAngle));
    const barWidth = Math.abs(normalized) * 50;
    const center = 50;
    const left = normalized >= 0 ? center : center - barWidth;
    steeringBar.style.left = left + '%';
    steeringBar.style.width = barWidth + '%';

    // Degree readout
    const degrees = Math.round(steering * (180 / Math.PI));
    const sign = degrees >= 0 ? '+' : '';
    steerDeg.textContent = sign + degrees + '\u00B0';
  }

  window.overlayAPI.onEditMode((enabled) => {
    document.body.classList.toggle('edit-mode', enabled);
  });

  window.overlayAPI.onTelemetry(render);
})();
