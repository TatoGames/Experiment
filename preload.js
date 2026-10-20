const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSave: () => ipcRenderer.invoke('save:load'),
  writeSave: (obj) => ipcRenderer.invoke('save:write', obj),
});
