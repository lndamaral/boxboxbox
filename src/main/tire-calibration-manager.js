/**
 * Manages tire calibration lifecycle:
 * - Collects pressure/temp samples from telemetry
 * - Detects car identity from session info
 * - Loads/saves calibration per car
 * - Broadcasts calibration state to overlays
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { calibrate, getColorBand, mergeCalibrations, MIN_SAMPLES } = require('./calculators/tire-calibration');

class TireCalibrationManager {
  constructor() {
    this.carPath = null;
    this.calibration = null; // { pressure: {LF,RF,LR,RR}, temp: {LF,RF,LR,RR} }
    this.samples = { pressure: { LF: [], RF: [], LR: [], RR: [] }, temp: { LF: [], RF: [], LR: [], RR: [] } };
    this.calibrated = false;
    this._dir = path.join(app.getPath('userData'), 'tire-calibration');
  }

  setCarPath(carPath) {
    if (carPath === this.carPath) return;
    // Save current if we had data
    if (this.carPath) this._save();

    this.carPath = carPath;
    this.samples = { pressure: { LF: [], RF: [], LR: [], RR: [] }, temp: { LF: [], RF: [], LR: [], RR: [] } };
    this.calibration = this._load(carPath);
    this.calibrated = this.calibration !== null;
  }

  addSample(data) {
    if (!this.carPath) return;

    const corners = ['LF', 'RF', 'LR', 'RR'];
    for (const c of corners) {
      const p = data[c + 'pressure'];
      if (p != null && p > 0) this.samples.pressure[c].push(p);

      const zones = ['CL', 'CM', 'CR'];
      for (const z of zones) {
        const t = data[c + 'temp' + z];
        if (t != null && t > 0) {
          if (!this.samples.temp[c]) this.samples.temp[c] = [];
          this.samples.temp[c].push(t);
        }
      }
    }

    // Check if we've reached enough samples to calibrate
    if (!this.calibrated) {
      const lfCount = this.samples.pressure.LF.length;
      if (lfCount >= MIN_SAMPLES) {
        this._computeCalibration();
      }
    }
  }

  getState() {
    return {
      calibrated: this.calibrated,
      calibration: this.calibration,
      carPath: this.carPath,
      progress: this.calibrated ? 1 : Math.min(1, (this.samples.pressure.LF.length || 0) / MIN_SAMPLES),
    };
  }

  /**
   * Get color band for a pressure/temp value.
   */
  getColorBandForPressure(corner, value) {
    if (!this.calibration || !this.calibration.pressure[corner]) return 'uncalibrated';
    return getColorBand(value, this.calibration.pressure[corner]);
  }

  getColorBandForTemp(corner, value) {
    if (!this.calibration || !this.calibration.temp[corner]) return 'uncalibrated';
    return getColorBand(value, this.calibration.temp[corner]);
  }

  _computeCalibration() {
    const corners = ['LF', 'RF', 'LR', 'RR'];
    const pressure = {};
    const temp = {};

    for (const c of corners) {
      pressure[c] = calibrate(this.samples.pressure[c]);
      temp[c] = calibrate(this.samples.temp[c]);
    }

    // If any corner fails, don't mark as calibrated
    if (corners.some(c => !pressure[c])) return;

    const newCal = { pressure, temp };

    if (this.calibration) {
      // Merge with existing
      for (const c of corners) {
        newCal.pressure[c] = mergeCalibrations(this.calibration.pressure[c], newCal.pressure[c]);
        if (this.calibration.temp[c] && newCal.temp[c]) {
          newCal.temp[c] = mergeCalibrations(this.calibration.temp[c], newCal.temp[c]);
        }
      }
    }

    this.calibration = newCal;
    this.calibrated = true;
    this._save();
  }

  _load(carPath) {
    try {
      const filePath = path.join(this._dir, this._sanitize(carPath) + '.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data;
    } catch {
      return null;
    }
  }

  _save() {
    if (!this.carPath || !this.calibration) return;
    try {
      if (!fs.existsSync(this._dir)) fs.mkdirSync(this._dir, { recursive: true });
      const filePath = path.join(this._dir, this._sanitize(this.carPath) + '.json');
      fs.writeFileSync(filePath, JSON.stringify(this.calibration, null, 2), 'utf-8');
    } catch (err) {
      console.error('[TireCalibration] Save failed:', err.message);
    }
  }

  _sanitize(name) {
    return (name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

module.exports = TireCalibrationManager;
