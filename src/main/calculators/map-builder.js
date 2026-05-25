/**
 * Track map builder — constructs SVG path from motion vectors.
 *
 * Records Yaw, VelocityX, VelocityY at 30Hz during first lap.
 * Integrates to build (X,Y) trajectory, normalizes to SVG viewBox.
 */

const MIN_SAMPLES = 1500; // ~50s of lap (minimum valid lap)
const CLOSE_TOLERANCE = 0.05; // 5% of bounding box for path closure

/**
 * Build an SVG path from velocity/yaw samples.
 *
 * iRacing emits VelocityX/Y in the car's body frame (vx=lateral,
 * vy=longitudinal), so each sample must be rotated by yaw into the
 * world frame before integrating, otherwise the trajectory just
 * accumulates forward speed in a straight line and never closes.
 *
 * @param {Array<{vx: number, vy: number, yaw: number, dt: number}>} samples
 * @returns {{ svgPathD: string, viewBox: string, length: number } | null}
 */
function buildPath(samples) {
  if (!validatePath(samples)) return null;

  const points = [];
  let x = 0, y = 0;

  for (const s of samples) {
    const c = Math.cos(s.yaw);
    const sn = Math.sin(s.yaw);
    const wx = s.vx * c - s.vy * sn;
    const wy = s.vx * sn + s.vy * c;
    x += wx * s.dt;
    y += wy * s.dt;
    points.push({ x, y });
  }

  // Normalize to viewBox
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const padding = 20;
  const vbW = 320;
  const vbH = 200;
  const scale = Math.min((vbW - padding * 2) / width, (vbH - padding * 2) / height);

  const normalized = points.map(p => ({
    x: (p.x - minX) * scale + padding + ((vbW - padding * 2) - width * scale) / 2,
    y: (p.y - minY) * scale + padding + ((vbH - padding * 2) - height * scale) / 2,
  }));

  // Build SVG path with line segments (smooth enough at 30Hz density)
  const first = normalized[0];
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;

  // Downsample to ~200 points for SVG performance
  const step = Math.max(1, Math.floor(normalized.length / 200));
  for (let i = step; i < normalized.length; i += step) {
    d += ` L ${normalized[i].x.toFixed(1)} ${normalized[i].y.toFixed(1)}`;
  }
  d += ' Z'; // Close path

  // Estimate path length from points
  let length = 0;
  for (let i = 1; i < normalized.length; i++) {
    const dx = normalized[i].x - normalized[i - 1].x;
    const dy = normalized[i].y - normalized[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }

  return {
    svgPathD: d,
    viewBox: `0 0 ${vbW} ${vbH}`,
    length,
  };
}

/**
 * Validate samples before building.
 * Checks: enough samples + path must close (last point near first).
 * @param {Array<{vx: number, vy: number, dt: number}>} samples
 * @returns {boolean}
 */
function validatePath(samples) {
  if (!samples || samples.length < MIN_SAMPLES) return false;

  // Integrate world-frame displacement (rotate body-frame velocity by yaw)
  let x = 0, y = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  for (const s of samples) {
    const c = Math.cos(s.yaw);
    const sn = Math.sin(s.yaw);
    const wx = s.vx * c - s.vy * sn;
    const wy = s.vx * sn + s.vy * c;
    x += wx * s.dt;
    y += wy * s.dt;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Path must approximately close
  const bboxDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
  if (bboxDiag === 0) return false;

  const closure = Math.sqrt(x * x + y * y);
  return (closure / bboxDiag) <= CLOSE_TOLERANCE;
}

module.exports = { buildPath, validatePath, MIN_SAMPLES, CLOSE_TOLERANCE };
