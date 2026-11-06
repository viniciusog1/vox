const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  onDisplaySources: (cb) => ipcRenderer.on('display-sources', (event, list) => cb(list)),
  selectDisplaySource: (id, opts) => ipcRenderer.send('display-source-selected', id, { audio: !!(opts && opts.audio) }),
  cancelDisplaySource: () => ipcRenderer.send('display-source-cancelled'),

  focusWindow: () => ipcRenderer.send('focus-window'),
  setCloseToTray: (on) => ipcRenderer.send('set-close-to-tray', !!on),
  getAutostart: () => ipcRenderer.invoke('autostart-get'),
  setAutostart: (on) => ipcRenderer.invoke('autostart-set', !!on),
  reportTrayState: (s) => ipcRenderer.send('tray-state', { muted: !!s.muted, inVoice: !!s.inVoice, unread: Number(s.unread) || 0 }),
  onTrayToggleMic: (cb) => ipcRenderer.on('tray-toggle-mic', () => cb()),
  flashFrame: (on) => ipcRenderer.send('flash-frame', !!on),

  tunnelStart: () => ipcRenderer.invoke('tunnel-start'),
  tunnelStop: () => ipcRenderer.invoke('tunnel-stop'),
  tunnelStatus: () => ipcRenderer.invoke('tunnel-status'),
  onTunnelStatus: (cb) => ipcRenderer.on('tunnel-status', (event, s) => cb(s)),

  addressStatus: () => ipcRenderer.invoke('address-status'),
  addressConnect: (token) => ipcRenderer.invoke('address-connect', String(token || '')),
  addressDisconnect: () => ipcRenderer.invoke('address-disconnect'),
  setAutoTunnel: (on) => ipcRenderer.invoke('address-auto-tunnel', !!on),
  openTokenPage: () => ipcRenderer.send('address-token-page'),
  onAddressStatus: (cb) => ipcRenderer.on('address-status', (event, s) => cb(s)),

  updateStatus: () => ipcRenderer.invoke('update-status'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (event, s) => cb(s)),
  installUpdate: () => ipcRenderer.send('update-install')
});
