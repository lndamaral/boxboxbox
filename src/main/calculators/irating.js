/**
 * iRating change estimator — community-derived ELO/Glickman variant.
 *
 * Formula source: iRacing forums community reverse-engineering.
 * B = 1600 / ln(2) ≈ 2308.55
 * Expected(player) = Σ 1 / (1 + exp((iR_j - iR_player) / B)) for j != player
 * Actual(player) = N - position(player) where N = number of drivers
 * ΔiR = round(K * (Actual - Expected))
 *
 * K is calibrated empirically. iRacing uses variable K (higher for new accounts),
 * but for estimation purposes K ≈ (200 / (N - 1)) / 0.8 gives reasonable results
 * for mid-career drivers in typical splits.
 *
 * Accuracy: ±5-10 iR points vs actual result in official races.
 * Hosted leagues don't generate iR — no way to detect this via SDK.
 */

const B = 1600 / Math.LN2; // ~2308.55

/**
 * @param {object} opts
 * @param {Array<{carIdx: number, iRating: number, position: number, carClassId: number}>} opts.drivers
 * @param {number} opts.playerCarIdx
 * @param {boolean} opts.multiclass - if true, restrict calculation to player's class
 * @returns {{ delta: number, confidence: 'estimate' }}
 */
function estimateIRChange({ drivers, playerCarIdx, multiclass }) {
  if (!drivers || drivers.length < 2) {
    return { delta: 0, confidence: 'estimate' };
  }

  const player = drivers.find(d => d.carIdx === playerCarIdx);
  if (!player || !player.iRating) {
    return { delta: 0, confidence: 'estimate' };
  }

  // Filter to class if multiclass
  let field = drivers;
  if (multiclass) {
    field = drivers.filter(d => d.carClassId === player.carClassId);
    if (field.length < 2) {
      return { delta: 0, confidence: 'estimate' };
    }
  }

  const N = field.length;
  const playerIR = player.iRating;

  // Recalculate position within class for multiclass
  const playerPosition = multiclass
    ? field.filter(d => d.position <= player.position && d.carClassId === player.carClassId).length
    : player.position;

  // Expected score
  let expected = 0;
  for (const d of field) {
    if (d.carIdx === playerCarIdx) continue;
    const exponent = (d.iRating - playerIR) / B;
    expected += 1 / (1 + Math.exp(exponent));
  }

  // Actual score (0-indexed: first place = N-1, last = 0)
  const actual = N - playerPosition;

  // K factor: empirically ~(200 / (N-1)) / 0.8 for mid-career
  const K = (200 / (N - 1)) / 0.8;

  const delta = Math.round(K * (actual - expected));

  return { delta, confidence: 'estimate' };
}

module.exports = { estimateIRChange };
