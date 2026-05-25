/**
 * Tire calibration — auto-learns pressure/temp thresholds per car.
 *
 * Collects samples during driving, computes percentiles for color bands.
 * Persisted per car in userData/tire-calibration/{carPath}.json.
 */

const MIN_SAMPLES = 18000; // ~10 min at 30Hz

/**
 * Compute percentile thresholds from samples.
 * @param {number[]} samples - raw values collected during driving
 * @returns {{ p10: number, p50: number, p90: number, sampleCount: number } | null}
 */
function calibrate(samples) {
  if (!samples || samples.length < MIN_SAMPLES) return null;

  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;

  return {
    p10: sorted[Math.floor(n * 0.10)],
    p50: sorted[Math.floor(n * 0.50)],
    p90: sorted[Math.floor(n * 0.90)],
    sampleCount: n,
  };
}

/**
 * Get color band for a value given calibration data.
 * @param {number} value
 * @param {{ p10: number, p50: number, p90: number }} cal
 * @returns {'cold'|'cool'|'ideal'|'warm'|'hot'|'crit'}
 */
function getColorBand(value, cal) {
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

/**
 * Merge new samples into existing calibration (running average).
 * @param {{ p10: number, p50: number, p90: number, sampleCount: number }} existing
 * @param {{ p10: number, p50: number, p90: number, sampleCount: number }} fresh
 * @returns {{ p10: number, p50: number, p90: number, sampleCount: number }}
 */
function mergeCalibrations(existing, fresh) {
  if (!existing) return fresh;
  if (!fresh) return existing;

  const totalOld = existing.sampleCount;
  const totalNew = fresh.sampleCount;
  const total = totalOld + totalNew;
  const wOld = totalOld / total;
  const wNew = totalNew / total;

  return {
    p10: existing.p10 * wOld + fresh.p10 * wNew,
    p50: existing.p50 * wOld + fresh.p50 * wNew,
    p90: existing.p90 * wOld + fresh.p90 * wNew,
    sampleCount: total,
  };
}

module.exports = { calibrate, getColorBand, mergeCalibrations, MIN_SAMPLES };
