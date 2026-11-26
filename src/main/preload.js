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

  // LoL Arena (teste temporário)
  arenaStatus: () => ipcRenderer.invoke('arena-status'),
  arenaEnable: (on) => ipcRenderer.invoke('arena-enable', !!on),
  arenaCrop: (crop) => ipcRenderer.invoke('arena-crop', {
    x: Number(crop && crop.x), y: Number(crop && crop.y), w: Number(crop && crop.w), h: Number(crop && crop.h)
  }),
  arenaPreview: () => ipcRenderer.invoke('arena-preview'),
  onArenaStatus: (cb) => ipcRenderer.on('arena-status', (event, s) => cb(s)),
  onArenaShot: (cb) => ipcRenderer.on('arena-shot', (event, shot) => cb(shot)),

  relayStatus: () => ipcRenderer.invoke('relay-status'),
  relayConfigure: (cfg) => ipcRenderer.invoke('relay-configure', {
    mode: String((cfg && cfg.mode) || ''),
    keyId: String((cfg && cfg.keyId) || ''),
    apiToken: String((cfg && cfg.apiToken) || ''),
    urls: String((cfg && cfg.urls) || ''),
    username: String((cfg && cfg.username) || ''),
    credential: String((cfg && cfg.credential) || '')
  }),

  addressStatus: () => ipcRenderer.invoke('address-status'),
  addressConnect: (token) => ipcRenderer.invoke('address-connect', String(token || '')),
  addressDisconnect: () => ipcRenderer.invoke('address-disconnect'),
  setAutoTunnel: (on) => ipcRenderer.invoke('address-auto-tunnel', !!on),
  openTokenPage: () => ipcRenderer.send('address-token-page'),
  onAddressStatus: (cb) => ipcRenderer.on('address-status', (event, s) => cb(s)),

  savedLoginGet: (server) => ipcRenderer.invoke('saved-login-get', String(server || '')),
  savedLoginSet: (server, login) => ipcRenderer.invoke('saved-login-set', String(server || ''), login),
  savedLoginClear: (server) => ipcRenderer.invoke('saved-login-clear', String(server || '')),

  appVersion: ipcRenderer.sendSync('app-version'),
  updateStatus: () => ipcRenderer.invoke('update-status'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (event, s) => cb(s)),
  installUpdate: () => ipcRenderer.send('update-install')
});
