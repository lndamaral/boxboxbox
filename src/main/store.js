const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
  constructor(filename) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, filename);
    this.data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(this.path, 'utf-8'));
    } catch {
      return {};
    }
  }

  get(key, defaultValue) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this._save();
  }

  _save() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Store] Failed to save:', err.message);
    }
  }
}

module.exports = Store;
