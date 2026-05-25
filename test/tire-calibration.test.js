const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calibrate, getColorBand, mergeCalibrations, MIN_SAMPLES } = require('../src/main/calculators/tire-calibration');

test('calibrate returns null with too few samples', () => {
  assert.equal(calibrate([]), null);
  assert.equal(calibrate(null), null);
  assert.equal(calibrate(new Array(100).fill(150)), null);
});

test('calibrate computes correct percentiles for uniform data', () => {
  // Generate MIN_SAMPLES values uniformly from 130 to 170
  const samples = [];
  for (let i = 0; i < MIN_SAMPLES; i++) {
    samples.push(130 + (i / MIN_SAMPLES) * 40);
  }
  const result = calibrate(samples);
  assert.ok(result !== null);
  assert.ok(Math.abs(result.p10 - 134) < 1, `p10=${result.p10}`);
  assert.ok(Math.abs(result.p50 - 150) < 1, `p50=${result.p50}`);
  assert.ok(Math.abs(result.p90 - 166) < 1, `p90=${result.p90}`);
  assert.equal(result.sampleCount, MIN_SAMPLES);
});

test('getColorBand returns correct bands', () => {
  const cal = { p10: 140, p50: 150, p90: 160 };
  // range = 20
  assert.equal(getColorBand(125, cal), 'cold');  // below p10 - range*0.3 = 134
  assert.equal(getColorBand(137, cal), 'cool');   // between lowCrit and p10
  assert.equal(getColorBand(150, cal), 'ideal');   // between p10 and p90
  assert.equal(getColorBand(163, cal), 'warm');    // between p90 and highCrit
  assert.equal(getColorBand(170, cal), 'hot');     // above highCrit
  assert.equal(getColorBand(180, cal), 'crit');    // well above
});

test('getColorBand returns uncalibrated when no calibration', () => {
  assert.equal(getColorBand(150, null), 'uncalibrated');
});

test('mergeCalibrations weighted average', () => {
  const existing = { p10: 140, p50: 150, p90: 160, sampleCount: 20000 };
  const fresh = { p10: 145, p50: 155, p90: 165, sampleCount: 20000 };
  const merged = mergeCalibrations(existing, fresh);
  // Equal weight → average
  assert.ok(Math.abs(merged.p10 - 142.5) < 0.1);
  assert.ok(Math.abs(merged.p50 - 152.5) < 0.1);
  assert.equal(merged.sampleCount, 40000);
});

test('mergeCalibrations handles null gracefully', () => {
  const cal = { p10: 140, p50: 150, p90: 160, sampleCount: 20000 };
  assert.deepEqual(mergeCalibrations(null, cal), cal);
  assert.deepEqual(mergeCalibrations(cal, null), cal);
});
