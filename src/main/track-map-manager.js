/**
 * Track map manager — records samples during first lap, builds SVG, persists.
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { buildPath, validatePath } = require('./calculators/map-builder');

class TrackMapManager {
  constructor() {
    this.trackKey = null;
    this.mapData = null; // { svgPathD, viewBox, length }
    this.samples = [];
    this.recording = false;
    this.built = false;
    this._prevLapDistPct = -1;
    this._dir = path.join(app.getPath('userData'), 'tracks');
  }

  setTrack(trackName) {
    const key = this._sanitize(trackName);
    if (key === this.trackKey) return;

    this.trackKey = key;
    this.samples = [];
    this.recording = false;
    this.built = false;
    this.mapData = this._load(key);
    if (this.mapData) this.built = true;
  }

  /**
   * Process a telemetry tick. Records samples if in recording state.
   * Returns true if map was just built this tick.
   */
  tick(data) {
    if (!this.trackKey || this.built) return false;

    const playerLapDist = data.CarIdxLapDistPct ? data.CarIdxLapDistPct[data.PlayerCarIdx] : null;
    if (playerLapDist == null) return false;

    const vx = data.VelocityX;
    const vy = data.VelocityY;
    const onPit = data.CarIdxOnPitRoad ? data.CarIdxOnPitRoad[data.PlayerCarIdx] : false;

    // Don't record while in pit
    if (onPit) {
      if (this.samples.length > 0) {
        // Invalidate — pit during recording
        this.samples = [];
        this.recording = false;
      }
      this._prevLapDistPct = playerLapDist;
      return false;
    }

    // Start recording when player begins a lap (crosses near 0)
    if (!this.recording) {
      if (playerLapDist < 0.05 && this._prevLapDistPct > 0.95) {
        this.recording = true;
        this.samples = [];
      }
      this._prevLapDistPct = playerLapDist;
      return false;
    }

    // Record sample
    if (vx != null && vy != null) {
      this.samples.push({ vx, vy, dt: 1 / 30 });
    }

    // Detect lap completion (cross from near 1.0 back to near 0.0)
    if (playerLapDist < 0.05 && this._prevLapDistPct > 0.95) {
      // Try to build
      const result = buildPath(this.samples);
      if (result) {
        this.mapData = result;
        this.built = true;
        this._save();
        this._prevLapDistPct = playerLapDist;
        return true; // just built
      } else {
        // Invalid — restart
        this.samples = [];
        this.recording = false;
      }
    }

    this._prevLapDistPct = playerLapDist;
    return false;
  }

  getState() {
    return {
      built: this.built,
      recording: this.recording,
      mapData: this.mapData,
      sampleCount: this.samples.length,
    };
  }

  _load(key) {
    try {
      const filePath = path.join(this._dir, key + '.json');
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  _save() {
    if (!this.trackKey || !this.mapData) return;
    try {
      if (!fs.existsSync(this._dir)) fs.mkdirSync(this._dir, { recursive: true });
      const filePath = path.join(this._dir, this.trackKey + '.json');
      fs.writeFileSync(filePath, JSON.stringify(this.mapData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[TrackMap] Save failed:', err.message);
    }
  }

  _sanitize(name) {
    return (name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }
}

module.exports = TrackMapManager;
