const { app, globalShortcut, ipcMain } = require('electron');
const OverlayManager = require('./overlay-manager');
const TelemetryBridge = require('./telemetry');
const TireCalibrationManager = require('./tire-calibration-manager');
const TrackMapManager = require('./track-map-manager');

let manager;
let telemetry;
let tireCal;
let trackMap;

app.whenReady().then(() => {
  manager = new OverlayManager();
  telemetry = new TelemetryBridge();

  manager.createControlWindow();
  manager.createOverlay('relative');
  manager.createOverlay('inputs', { width: 360, height: 140 });
  manager.createOverlay('fuel', { width: 280, height: 180 });
  manager.createOverlay('tires', { width: 280, height: 160 });
  manager.createOverlay('trackmap', { width: 360, height: 260, hidden: true });
  manager.createOverlay('standings', { width: 460, height: 500 });
  manager.createOverlay('spotter', { width: 220, height: 240 });

  tireCal = new TireCalibrationManager();
  trackMap = new TrackMapManager();

  telemetry.on('telemetry', (data) => {
    // Feed tire calibration
    tireCal.addSample(data);
    data.tireCalState = tireCal.getState();

    // Feed track map builder
    trackMap.tick(data);
    data.trackMapState = trackMap.getState();

    manager.broadcast('telemetry', data);
  });

  telemetry.on('sessionInfo', () => {
    // Detect car for calibration
    const drivers = telemetry._drivers;
    const playerIdx = telemetry._mockState ? telemetry._mockState.playerIdx : 0;
    if (drivers[playerIdx] && drivers[playerIdx].carPath) {
      tireCal.setCarPath(drivers[playerIdx].carPath);
    }
    // Set track for map building
    if (telemetry._trackName) {
      trackMap.setTrack(telemetry._trackName);
    }
  });

  telemetry.on('connectionState', (state) => {
    manager.broadcast('connectionState', state);
  });

  // Broadcast initial state once windows are ready
  const broadcastInitialState = () => {
    manager.broadcast('connectionState', telemetry.connected);
  };

  telemetry.start();

  // Re-broadcast connection state after windows load
  setTimeout(broadcastInitialState, 1000);

  // Global shortcuts
  globalShortcut.register('F9', () => manager.toggleEditMode());
  globalShortcut.register('F10', () => manager.toggleVisibility());

  // IPC from control window
  ipcMain.on('toggle-edit-mode', () => manager.toggleEditMode());
  ipcMain.on('toggle-visibility', () => manager.toggleVisibility());
  ipcMain.on('reset-position', (_, id) => manager.resetPosition(id));
  ipcMain.on('show-overlay', (_, id) => manager.showOverlay(id));
  ipcMain.on('toggle-overlay', (_, id, enabled) => {
    if (enabled) manager.showOverlay(id);
    else manager.hideOverlay(id);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (telemetry) telemetry.stop();
  if (manager) manager.destroyAll();
});
