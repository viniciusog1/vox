const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  onDisplaySources: (cb) => ipcRenderer.on('display-sources', (event, list) => cb(list)),
  selectDisplaySource: (id) => ipcRenderer.send('display-source-selected', id),
  cancelDisplaySource: () => ipcRenderer.send('display-source-cancelled')
});
