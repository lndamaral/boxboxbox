const { test } = require('node:test');
const assert = require('node:assert/strict');

// Extract pickDeltaMode logic (same as in relative.js)
function pickDeltaMode(sessionType) {
  if (!sessionType) return 'race';
  const st = sessionType.toLowerCase();
  if (st === 'race') return 'race';
  if (st.includes('qualify') || st === 'lone qualifying' || st === 'open qualify') return 'qualy';
  if (st.includes('practice') || st === 'offline testing') return 'qualy';
  return 'race';
}

test('pickDeltaMode returns "race" for Race session', () => {
  assert.equal(pickDeltaMode('Race'), 'race');
});

test('pickDeltaMode returns "qualy" for Qualifying', () => {
  assert.equal(pickDeltaMode('Qualifying'), 'qualy');
});

test('pickDeltaMode returns "qualy" for Lone Qualifying', () => {
  assert.equal(pickDeltaMode('Lone Qualifying'), 'qualy');
});

test('pickDeltaMode returns "qualy" for Open Qualify', () => {
  assert.equal(pickDeltaMode('Open Qualify'), 'qualy');
});

test('pickDeltaMode returns "qualy" for Practice', () => {
  assert.equal(pickDeltaMode('Practice'), 'qualy');
});

test('pickDeltaMode returns "qualy" for Open Practice', () => {
  assert.equal(pickDeltaMode('Open Practice'), 'qualy');
});

test('pickDeltaMode returns "qualy" for Offline Testing', () => {
  assert.equal(pickDeltaMode('Offline Testing'), 'qualy');
});

test('pickDeltaMode returns "race" for unknown/empty value', () => {
  assert.equal(pickDeltaMode(''), 'race');
  assert.equal(pickDeltaMode(null), 'race');
  assert.equal(pickDeltaMode(undefined), 'race');
  assert.equal(pickDeltaMode('Warmup'), 'race');
});
