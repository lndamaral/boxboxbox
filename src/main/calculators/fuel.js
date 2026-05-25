/**
 * Fuel calculator — pure logic, no side effects.
 *
 * All inputs come from telemetry or derived state.
 * Units: fuel in liters, time in seconds.
 */

/**
 * Calculate average fuel consumption per lap from recent lap data.
 * @param {number[]} fuelPerLap - Array of fuel used per lap (last N laps)
 * @returns {number} Average fuel/lap, or 0 if no data
 */
function avgConsumption(fuelPerLap) {
  if (!fuelPerLap || fuelPerLap.length === 0) return 0;
  const sum = fuelPerLap.reduce((a, b) => a + b, 0);
  return sum / fuelPerLap.length;
}

/**
 * Estimate laps remaining with current fuel.
 * @param {number} fuelLevel - Current fuel in liters
 * @param {number} avgFuelPerLap - Average consumption per lap
 * @returns {number} Estimated laps remaining, or Infinity if no consumption data
 */
function lapsRemaining(fuelLevel, avgFuelPerLap) {
  if (avgFuelPerLap <= 0) return Infinity;
  return fuelLevel / avgFuelPerLap;
}

/**
 * Estimate laps left in the session.
 * @param {object} opts
 * @param {number} opts.sessionTimeRemain - Seconds remaining (for timed sessions), -1 if lap-limited
 * @param {number} opts.avgLapTime - Average lap time in seconds
 * @param {number} opts.totalLaps - Total laps in session (for lap-limited), -1 if timed
 * @param {number} opts.currentLap - Current lap number
 * @returns {number} Estimated laps to finish, or Infinity if undetermined
 */
function sessionLapsRemaining(opts) {
  const { sessionTimeRemain, avgLapTime, totalLaps, currentLap } = opts;

  // Lap-limited session
  if (totalLaps > 0 && currentLap > 0) {
    return Math.max(0, totalLaps - currentLap);
  }

  // Timed session
  if (sessionTimeRemain > 0 && avgLapTime > 0) {
    return sessionTimeRemain / avgLapTime;
  }

  return Infinity;
}

/**
 * Calculate fuel needed to finish the session.
 * @param {number} lapsToGo - Laps remaining in session
 * @param {number} avgFuelPerLap - Average consumption per lap
 * @returns {number} Total fuel needed, or 0 if no data
 */
function fuelToFinish(lapsToGo, avgFuelPerLap) {
  if (lapsToGo === Infinity || avgFuelPerLap <= 0) return 0;
  // Add 1 lap margin (standard in iRacing fuel calcs — the +1 covers the lap you're currently on)
  return (lapsToGo + 1) * avgFuelPerLap;
}

/**
 * Delta between fuel needed and fuel in tank.
 * Positive = need to add fuel. Negative = have excess.
 * @param {number} fuelNeeded - From fuelToFinish()
 * @param {number} fuelLevel - Current fuel
 * @returns {number} Delta (positive = short, negative = excess)
 */
function fuelDelta(fuelNeeded, fuelLevel) {
  if (fuelNeeded <= 0) return -fuelLevel;
  return fuelNeeded - fuelLevel;
}

module.exports = {
  avgConsumption,
  lapsRemaining,
  sessionLapsRemaining,
  fuelToFinish,
  fuelDelta,
};
