const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getNearbyAdversaries } = require('../src/main/calculators/spotter');

test('adversary with positive delta is classified as isAhead: true', () => {
  const result = getNearbyAdversaries({
    carIdxLapDistPct: [0.50, 0.503], // car 1 ~11m ahead on 3700m track
    playerCarIdx: 0,
    trackLength: 3700,
    carLeftRight: 1, // clear
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].carIdx, 1);
  assert.equal(result[0].isAhead, true);
  assert.ok(result[0].distance > 0);
});

test('wrap correct at start/finish line — car 0.05 vs player 0.95 = ahead ~5%', () => {
  const result = getNearbyAdversaries({
    carIdxLapDistPct: [0.95, 0.05], // car 1 just past S/F, player approaching
    playerCarIdx: 0,
    trackLength: 100, // 100m track for easy math
    carLeftRight: 1,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].isAhead, true);
  assert.ok(Math.abs(result[0].distance - 10) < 1, `Expected ~10m, got ${result[0].distance}`);
});

test('CarLeftRight=4 (three wide) assigns 1 left + 1 right', () => {
  const result = getNearbyAdversaries({
    carIdxLapDistPct: [0.50, 0.501, 0.499], // two cars very close
    playerCarIdx: 0,
    trackLength: 3700,
    carLeftRight: 4, // LRCarLeftRight
  });
  assert.equal(result.length, 2);
  const sides = result.map(r => r.side).sort();
  assert.deepEqual(sides, ['left', 'right']);
});

test('CarLeftRight=5 (2 cars left) assigns 2 closest to left', () => {
  const result = getNearbyAdversaries({
    // 3 cars: idx 1 at 1.8m, idx 2 at 3.7m, idx 3 at 12m
    carIdxLapDistPct: [0.50, 0.5005, 0.501, 0.5035],
    playerCarIdx: 0,
    trackLength: 3700,
    carLeftRight: 5, // LR2CarsLeft
  });
  assert.ok(result.length === 3);
  // Two closest should be left, third should be front/back
  const leftCars = result.filter(r => r.side === 'left');
  assert.equal(leftCars.length, 2);
  const nonLeftCar = result.find(r => r.side !== 'left');
  assert.ok(nonLeftCar.side === 'front' || nonLeftCar.side === 'back');
});

test('adversary beyond 15m is filtered out', () => {
  const result = getNearbyAdversaries({
    carIdxLapDistPct: [0.50, 0.55], // 5% of 3700m = 185m, way beyond 15m
    playerCarIdx: 0,
    trackLength: 3700,
    carLeftRight: 1,
  });
  assert.equal(result.length, 0);
});

test('returns empty array with no data', () => {
  assert.deepEqual(getNearbyAdversaries({ carIdxLapDistPct: null, playerCarIdx: 0, trackLength: 3700, carLeftRight: 1 }), []);
  assert.deepEqual(getNearbyAdversaries({ carIdxLapDistPct: [0.5], playerCarIdx: 0, trackLength: 0, carLeftRight: 1 }), []);
});
