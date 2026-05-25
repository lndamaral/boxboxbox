const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  onTelemetry: (callback) => ipcRenderer.on('telemetry', (_, data) => callback(data)),
  onConnectionState: (callback) => ipcRenderer.on('connectionState', (_, state) => callback(state)),
  onEditMode: (callback) => ipcRenderer.on('editMode', (_, enabled) => callback(enabled)),
  onOverlaysVisible: (callback) => ipcRenderer.on('overlaysVisible', (_, visible) => callback(visible)),
  toggleEditMode: () => ipcRenderer.send('toggle-edit-mode'),
  toggleVisibility: () => ipcRenderer.send('toggle-visibility'),
  resetPosition: (id) => ipcRenderer.send('reset-position', id),
  showOverlay: (id) => ipcRenderer.send('show-overlay', id),
  toggleOverlay: (id, enabled) => ipcRenderer.send('toggle-overlay', id, enabled),
});
