const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimateIRChange } = require('../src/main/calculators/irating');

test('homogeneous field, player mid-pack → ΔiR near zero', () => {
  // 9 drivers all at 2000 iR, player finishes 5th (exact middle)
  // Expected = (N-1)/2 = 4, Actual = 9-5 = 4 → ΔiR = 0
  const drivers = Array.from({ length: 9 }, (_, i) => ({
    carIdx: i,
    iRating: 2000,
    position: i + 1,
    carClassId: 1,
  }));
  const result = estimateIRChange({ drivers, playerCarIdx: 4, multiclass: false });
  assert.ok(Math.abs(result.delta) <= 5, `Expected near zero, got ${result.delta}`);
  assert.equal(result.confidence, 'estimate');
});

test('underdog wins → ΔiR strongly positive', () => {
  // Player has 1500 iR, others have 3000+, player wins
  const drivers = [
    { carIdx: 0, iRating: 1500, position: 1, carClassId: 1 }, // player, P1
    { carIdx: 1, iRating: 3000, position: 2, carClassId: 1 },
    { carIdx: 2, iRating: 3200, position: 3, carClassId: 1 },
    { carIdx: 3, iRating: 2800, position: 4, carClassId: 1 },
    { carIdx: 4, iRating: 3100, position: 5, carClassId: 1 },
    { carIdx: 5, iRating: 2900, position: 6, carClassId: 1 },
  ];
  const result = estimateIRChange({ drivers, playerCarIdx: 0, multiclass: false });
  assert.ok(result.delta > 30, `Expected strongly positive, got ${result.delta}`);
});

test('favorite loses → ΔiR strongly negative', () => {
  // Player has 4000 iR, others ~1500, player finishes last
  const drivers = [
    { carIdx: 0, iRating: 1500, position: 1, carClassId: 1 },
    { carIdx: 1, iRating: 1600, position: 2, carClassId: 1 },
    { carIdx: 2, iRating: 1400, position: 3, carClassId: 1 },
    { carIdx: 3, iRating: 1550, position: 4, carClassId: 1 },
    { carIdx: 4, iRating: 1450, position: 5, carClassId: 1 },
    { carIdx: 5, iRating: 4000, position: 6, carClassId: 1 }, // player, last
  ];
  const result = estimateIRChange({ drivers, playerCarIdx: 5, multiclass: false });
  assert.ok(result.delta < -30, `Expected strongly negative, got ${result.delta}`);
});

test('multiclass: player in LMP3, other classes ignored', () => {
  const drivers = [
    // LMP2 class (id: 1)
    { carIdx: 0, iRating: 5000, position: 1, carClassId: 1 },
    { carIdx: 1, iRating: 4800, position: 2, carClassId: 1 },
    { carIdx: 2, iRating: 4600, position: 3, carClassId: 1 },
    // LMP3 class (id: 2) — player is here
    { carIdx: 3, iRating: 2000, position: 4, carClassId: 2 }, // player, P1 in class
    { carIdx: 4, iRating: 2100, position: 5, carClassId: 2 },
    { carIdx: 5, iRating: 1900, position: 6, carClassId: 2 },
    { carIdx: 6, iRating: 2050, position: 7, carClassId: 2 },
    // GT3 class (id: 3)
    { carIdx: 7, iRating: 3000, position: 8, carClassId: 3 },
    { carIdx: 8, iRating: 2900, position: 9, carClassId: 3 },
  ];
  const result = estimateIRChange({ drivers, playerCarIdx: 3, multiclass: true });
  // Player is P1 in a 4-car class with similar iRating → moderate positive
  assert.ok(result.delta > 0, `Expected positive for class winner, got ${result.delta}`);
  assert.equal(result.confidence, 'estimate');
});

test('single driver returns 0', () => {
  const result = estimateIRChange({
    drivers: [{ carIdx: 0, iRating: 2000, position: 1, carClassId: 1 }],
    playerCarIdx: 0,
    multiclass: false,
  });
  assert.equal(result.delta, 0);
});

test('missing player returns 0', () => {
  const drivers = [
    { carIdx: 0, iRating: 2000, position: 1, carClassId: 1 },
    { carIdx: 1, iRating: 2100, position: 2, carClassId: 1 },
  ];
  const result = estimateIRChange({ drivers, playerCarIdx: 99, multiclass: false });
  assert.equal(result.delta, 0);
});
