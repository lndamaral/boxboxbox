const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPath, validatePath, MIN_SAMPLES } = require('../src/main/calculators/map-builder');

function generateOvalSamples(count) {
  // Simulate an oval circuit (elliptical path)
  const samples = [];
  const dt = 1 / 30;
  const laps = 1;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2 * laps;
    // Velocity is derivative of position on ellipse
    const vx = -Math.sin(t) * 100; // 100m semi-major
    const vy = Math.cos(t) * 60;   // 60m semi-minor
    samples.push({ vx, vy, dt });
  }
  return samples;
}

test('buildPath returns valid SVG for oval samples', () => {
  const samples = generateOvalSamples(2000);
  const result = buildPath(samples);
  assert.ok(result !== null, 'Should build successfully');
  assert.ok(result.svgPathD.startsWith('M'), 'Path should start with M');
  assert.ok(result.svgPathD.endsWith('Z'), 'Path should close with Z');
  assert.equal(result.viewBox, '0 0 320 200');
  assert.ok(result.length > 0, 'Length should be positive');
});

test('buildPath returns null for too few samples', () => {
  const samples = generateOvalSamples(100); // way below MIN_SAMPLES
  assert.equal(buildPath(samples), null);
});

test('buildPath returns null for non-closing path', () => {
  // Straight line — doesn't close
  const samples = [];
  for (let i = 0; i < MIN_SAMPLES; i++) {
    samples.push({ vx: 50, vy: 0, dt: 1 / 30 });
  }
  assert.equal(buildPath(samples), null);
});

test('validatePath rejects short samples', () => {
  assert.equal(validatePath(null), false);
  assert.equal(validatePath([]), false);
  assert.equal(validatePath(new Array(100).fill({ vx: 0, vy: 0, dt: 0.033 })), false);
});

test('validatePath accepts valid oval', () => {
  const samples = generateOvalSamples(2000);
  assert.equal(validatePath(samples), true);
});

test('validatePath rejects non-closing path', () => {
  const samples = [];
  for (let i = 0; i < MIN_SAMPLES; i++) {
    samples.push({ vx: 50, vy: 0, dt: 1 / 30 });
  }
  assert.equal(validatePath(samples), false);
});
