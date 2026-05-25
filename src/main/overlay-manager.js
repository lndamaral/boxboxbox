const { BrowserWindow, screen } = require('electron');
const path = require('path');
const Store = require('./store');

class OverlayManager {
  constructor() {
    this.overlays = new Map();
    this.hiddenOverlays = new Set(); // overlays created with hidden:true that haven't been shown yet
    this.controlWindow = null;
    this.editMode = false;
    this.visible = true;
    this.boundsStore = new Store('overlay-bounds.json');
  }

  createControlWindow() {
    this.controlWindow = new BrowserWindow({
      width: 380,
      height: 500,
      title: 'BoxBoxBox — Control',
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.controlWindow.loadFile(
      path.join(__dirname, '..', 'renderer', 'control.html')
    );

    this.controlWindow.on('closed', () => {
      this.controlWindow = null;
      this.destroyAll();
    });
  }

  createOverlay(id, options = {}) {
    const defaults = { width: 420, height: 520 };
    const savedBounds = this.boundsStore.get(id);
    const bounds = savedBounds || {
      width: options.width || defaults.width,
      height: options.height || defaults.height,
    };

    if (!savedBounds) {
      if (options.x != null && options.y != null) {
        bounds.x = options.x;
        bounds.y = options.y;
      } else {
        const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
        const offset = this.overlays.size * 40;
        bounds.x = Math.round(screenW - bounds.width - 40 - offset);
        bounds.y = Math.round((screenH - bounds.height) / 2 + offset);
      }
    }

    const win = new BrowserWindow({
      ...bounds,
      show: !options.hidden,
      transparent: true,
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      backgroundThrottling: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true, { forward: true });

    win.loadFile(
      path.join(__dirname, '..', 'renderer', 'overlays', `${id}.html`)
    );

    win.on('moved', () => this._saveBounds(id, win));
    win.on('resized', () => this._saveBounds(id, win));

    if (options.hidden) this.hiddenOverlays.add(id);
    this.overlays.set(id, win);
    return win;
  }

  _saveBounds(id, win) {
    if (!win.isDestroyed()) {
      this.boundsStore.set(id, win.getBounds());
    }
  }

  broadcast(channel, data) {
    for (const [, win] of this.overlays) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send(channel, data);
    }
  }

  toggleEditMode() {
    this.editMode = !this.editMode;

    for (const [, win] of this.overlays) {
      if (win.isDestroyed()) continue;
      win.setIgnoreMouseEvents(!this.editMode, { forward: true });
      win.setFocusable(this.editMode);
      win.setResizable(this.editMode);
      win.webContents.send('editMode', this.editMode);
    }

    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send('editMode', this.editMode);
    }
  }

  toggleVisibility() {
    this.visible = !this.visible;

    for (const [id, win] of this.overlays) {
      if (win.isDestroyed()) continue;
      if (this.hiddenOverlays.has(id)) continue; // skip unrevealed overlays
      if (this.visible) {
        win.show();
      } else {
        win.hide();
      }
    }

    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send('overlaysVisible', this.visible);
    }
  }

  resetPosition(id) {
    const win = this.overlays.get(id);
    if (!win || win.isDestroyed()) return;

    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const bounds = win.getBounds();
    const x = Math.round(screenW - bounds.width - 40);
    const y = Math.round((screenH - bounds.height) / 2);
    win.setBounds({ x, y, width: bounds.width, height: bounds.height });
    this._saveBounds(id, win);
  }

  showOverlay(id) {
    this.hiddenOverlays.delete(id);
    const win = this.overlays.get(id);
    if (win && !win.isDestroyed() && !win.isVisible() && this.visible) {
      win.show();
    }
  }

  hideOverlay(id) {
    this.hiddenOverlays.add(id);
    const win = this.overlays.get(id);
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide();
    }
  }

  destroyAll() {
    for (const [, win] of this.overlays) {
      if (!win.isDestroyed()) win.destroy();
    }
    this.overlays.clear();
  }
}

module.exports = OverlayManager;
