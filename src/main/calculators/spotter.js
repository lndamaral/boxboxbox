/**
 * Spotter calculator — determines nearby adversaries and their position.
 *
 * Uses CarIdxLapDistPct for distance and CarLeftRight for lateral assignment.
 * 8 categorical slots: N, NE, E, SE, S, SW, W, NW.
 *
 * CarLeftRight values (iRacing SDK):
 *   1 = LRClear (no cars)
 *   2 = LRCarLeft
 *   3 = LRCarRight
 *   4 = LRCarLeftRight (both sides)
 *   5 = LR2CarsLeft
 *   6 = LR2CarsRight
 */

/**
 * Get nearby adversaries with position classification.
 *
 * @param {object} opts
 * @param {number[]} opts.carIdxLapDistPct
 * @param {number} opts.playerCarIdx
 * @param {number} opts.trackLength - meters
 * @param {number} opts.carLeftRight - SDK enum value
 * @param {number[]} opts.carIdxTrackSurface - filter out garage/DNF (optional)
 * @param {number} [opts.maxDistance=15] - max detection range in meters
 * @returns {Array<{carIdx: number, distance: number, isAhead: boolean, side: string}>}
 */
function getNearbyAdversaries({ carIdxLapDistPct, playerCarIdx, trackLength, carLeftRight, carIdxTrackSurface, maxDistance = 15 }) {
  if (!carIdxLapDistPct || !trackLength || trackLength <= 0) return [];

  const playerDist = carIdxLapDistPct[playerCarIdx];
  if (playerDist == null) return [];

  const nearby = [];

  for (let i = 0; i < carIdxLapDistPct.length; i++) {
    if (i === playerCarIdx) continue;
    const dist = carIdxLapDistPct[i];
    if (dist == null || dist < 0) continue;

    // Filter cars not on track (if surface data available)
    if (carIdxTrackSurface && carIdxTrackSurface[i] != null && carIdxTrackSurface[i] < 0) continue;

    let delta = dist - playerDist;
    if (delta > 0.5) delta -= 1.0;
    if (delta < -0.5) delta += 1.0;

    const distance = Math.abs(delta) * trackLength;
    if (distance > maxDistance) continue;

    nearby.push({
      carIdx: i,
      distance,
      isAhead: delta > 0,
      delta,
    });
  }

  // Sort by distance ascending (closest first)
  nearby.sort((a, b) => a.distance - b.distance);

  // Assign lateral positions based on CarLeftRight
  const result = assignSides(nearby, carLeftRight);
  return result;
}

/**
 * Assign side ('left', 'right', 'front', 'back') based on CarLeftRight enum.
 */
function assignSides(nearby, carLeftRight) {
  // Determine how many go left/right based on CarLeftRight
  let leftCount = 0;
  let rightCount = 0;

  switch (carLeftRight) {
    case 2: leftCount = 1; break;           // LRCarLeft
    case 3: rightCount = 1; break;          // LRCarRight
    case 4: leftCount = 1; rightCount = 1; break; // LRCarLeftRight
    case 5: leftCount = 2; break;           // LR2CarsLeft
    case 6: rightCount = 2; break;          // LR2CarsRight
    default: break;                         // LRClear or unknown
  }

  const totalLateral = leftCount + rightCount;
  let assignedLeft = 0;
  let assignedRight = 0;

  return nearby.map((entry) => {
    let side;

    // Close cars (<5m) get lateral assignment from CarLeftRight
    if (entry.distance < 5 && (assignedLeft < leftCount || assignedRight < rightCount)) {
      if (assignedLeft < leftCount) {
        side = 'left';
        assignedLeft++;
      } else if (assignedRight < rightCount) {
        side = 'right';
        assignedRight++;
      }
    }

    // Medium/far cars (or exhausted lateral slots): front/back by delta sign
    if (!side) {
      side = entry.isAhead ? 'front' : 'back';
    }

    return {
      carIdx: entry.carIdx,
      distance: entry.distance,
      isAhead: entry.isAhead,
      side,
    };
  });
}

module.exports = { getNearbyAdversaries };
