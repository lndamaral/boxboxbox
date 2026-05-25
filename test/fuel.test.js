const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  avgConsumption,
  lapsRemaining,
  sessionLapsRemaining,
  fuelToFinish,
  fuelDelta,
} = require('../src/main/calculators/fuel');

// --- avgConsumption ---

test('avgConsumption returns 0 with empty array', () => {
  assert.equal(avgConsumption([]), 0);
});

test('avgConsumption returns 0 with null/undefined', () => {
  assert.equal(avgConsumption(null), 0);
  assert.equal(avgConsumption(undefined), 0);
});

test('avgConsumption with 1 lap', () => {
  assert.equal(avgConsumption([2.5]), 2.5);
});

test('avgConsumption with 2 laps', () => {
  assert.equal(avgConsumption([2.0, 3.0]), 2.5);
});

test('avgConsumption with 3+ laps', () => {
  const result = avgConsumption([2.1, 2.3, 2.2]);
  assert.ok(Math.abs(result - 2.2) < 0.001);
});

// --- lapsRemaining ---

test('lapsRemaining returns Infinity when no consumption data', () => {
  assert.equal(lapsRemaining(10, 0), Infinity);
});

test('lapsRemaining calculates correctly', () => {
  assert.equal(lapsRemaining(10, 2.5), 4);
});

test('lapsRemaining with fractional result', () => {
  const result = lapsRemaining(5, 2);
  assert.equal(result, 2.5);
});

// --- sessionLapsRemaining ---

test('sessionLapsRemaining for lap-limited session', () => {
  const result = sessionLapsRemaining({
    sessionTimeRemain: -1,
    avgLapTime: 90,
    totalLaps: 20,
    currentLap: 12,
  });
  assert.equal(result, 8);
});

test('sessionLapsRemaining for timed session', () => {
  const result = sessionLapsRemaining({
    sessionTimeRemain: 450, // 7.5 min
    avgLapTime: 90,
    totalLaps: -1,
    currentLap: 5,
  });
  assert.equal(result, 5); // 450/90
});

test('sessionLapsRemaining returns Infinity when no data', () => {
  const result = sessionLapsRemaining({
    sessionTimeRemain: -1,
    avgLapTime: 0,
    totalLaps: -1,
    currentLap: 0,
  });
  assert.equal(result, Infinity);
});

test('sessionLapsRemaining returns 0 when at last lap', () => {
  const result = sessionLapsRemaining({
    sessionTimeRemain: -1,
    avgLapTime: 90,
    totalLaps: 10,
    currentLap: 10,
  });
  assert.equal(result, 0);
});

// --- fuelToFinish ---

test('fuelToFinish returns 0 when lapsToGo is Infinity', () => {
  assert.equal(fuelToFinish(Infinity, 2.5), 0);
});

test('fuelToFinish returns 0 when no consumption data', () => {
  assert.equal(fuelToFinish(5, 0), 0);
});

test('fuelToFinish adds +1 lap margin', () => {
  // 5 laps to go + 1 margin = 6 laps × 2.5 = 15
  assert.equal(fuelToFinish(5, 2.5), 15);
});

// --- fuelDelta ---

test('fuelDelta positive means need more fuel', () => {
  // Need 15L, have 10L → short 5L
  assert.equal(fuelDelta(15, 10), 5);
});

test('fuelDelta negative means excess fuel', () => {
  // Need 10L, have 15L → excess 5L
  assert.equal(fuelDelta(10, 15), -5);
});

test('fuelDelta with zero fuel needed returns negative fuelLevel', () => {
  assert.equal(fuelDelta(0, 8), -8);
});
