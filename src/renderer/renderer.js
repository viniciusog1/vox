// Ícones estáticos do index.html (<i data-icon>) viram SVG
VoxIcons.hydrate();

// Versão do app no login e nas Configurações.
(function showAppVersion() {
  const v = window.electronAPI && window.electronAPI.appVersion;
  if (!v || !v.version) return;
  const text = `Vox ${v.version}${v.packaged ? '' : ' (desenvolvimento)'}`;
  document.querySelectorAll('[data-app-version]').forEach((el) => { el.textContent = text; });
})();

// O campo Servidor aceita o endereço direto ou o link fixo (Gist) do host.
const SERVER_INPUT = localStorage.getItem('vox-server-url') || 'http://127.0.0.1:3000';
const GIST_REF = VoxAddress.parseGistRef(SERVER_INPUT);
// Endereço real do servidor. Com link fixo, vem do Gist e muda quando o túnel do host reabre.
let SERVER_URL = GIST_REF ? '' : SERVER_INPUT;
const socket = io(GIST_REF ? 'http://127.0.0.1:3000' : SERVER_INPUT, { autoConnect: !GIST_REF });

/* ================= REFERÊNCIAS DOM ================= */
const authScreen = document.getElementById('auth-screen');
const sourcePicker = document.getElementById('source-picker');

const loginUser = document.getElementById('login-user');
const loginPass = document.getElementById('login-pass');
const btnLogin = document.getElementById('btn-login');
const errorLogin = document.getElementById('auth-error-login');

const regUser = document.getElementById('reg-user');
const regPass = document.getElementById('reg-pass');
const regPass2 = document.getElementById('reg-pass2');
const btnRegister = document.getElementById('btn-register');
const errorRegister = document.getElementById('auth-error-register');

const serverUrlInput = document.getElementById('server-url');
const serverApply = document.getElementById('server-apply');
const serverStatus = document.getElementById('server-status');

const myAvatar = document.getElementById('my-avatar');
const myName = document.getElementById('my-name');
const btnMicMini = document.getElementById('btn-mic-mini');

const channelName = document.getElementById('channel-name');
const videoGrid = document.getElementById('video-grid');
const callEmpty = document.getElementById('call-empty');

const messagesEl = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const attachInput = document.getElementById('attach-input');
const attachPreview = document.getElementById('attach-preview');
const attachThumb = document.getElementById('attach-thumb');
const attachName = document.getElementById('attach-name');
const attachRemove = document.getElementById('attach-remove');
const mentionPopup = document.getElementById('mention-popup');
const imageViewer = document.getElementById('image-viewer');
const imageViewerImg = document.getElementById('image-viewer-img');
const connBanner = document.getElementById('conn-banner');
const updateBanner = document.getElementById('update-banner');
const updateInstall = document.getElementById('update-install');
const notifyModeSelect = document.getElementById('notify-mode');
const tunnelToggle = document.getElementById('tunnel-toggle');
const tunnelStateEl = document.getElementById('tunnel-state');
const tunnelUrlRow = document.getElementById('tunnel-url-row');
const tunnelUrlInput = document.getElementById('tunnel-url');
const tunnelCopy = document.getElementById('tunnel-copy');

const memberList = document.getElementById('member-list');
const memberCount = document.getElementById('member-count');
const memberHeading = document.getElementById('member-heading');
const voiceConnection = document.getElementById('voice-connection');
const voiceConnName = document.getElementById('voice-conn-name');
const btnLeaveVoice = document.getElementById('btn-leave-voice');
const channelIcon = document.getElementById('channel-icon');

const btnMic = document.getElementById('btn-mic');
const btnCam = document.getElementById('btn-cam');
const btnScreen = document.getElementById('btn-screen');
const btnHangup = document.getElementById('btn-hangup');
const btnMusic = document.getElementById('btn-music');
const btnSoundboard = document.getElementById('btn-soundboard');


const sourceList = document.getElementById('source-list');
const sourceCancel = document.getElementById('source-cancel');
const shareResolutionSelect = document.getElementById('share-resolution');
const shareFpsSelect = document.getElementById('share-fps');
const shareAudioField = document.getElementById('share-audio-field');
const shareAudioCheckbox = document.getElementById('share-audio');

const myStatusEl = document.getElementById('my-status');
const myStatusDot = document.getElementById('my-status-dot');
const btnStatus = document.getElementById('btn-status');
const statusMenu = document.getElementById('status-menu');

const btnSettings = document.getElementById('btn-settings');
const btnLogout = document.getElementById('btn-logout');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const inputDeviceSelect = document.getElementById('input-device');
const outputDeviceSelect = document.getElementById('output-device');
const monitorToggle = document.getElementById('monitor-toggle');
const soundEffectsToggle = document.getElementById('sound-effects-toggle');
const monitorAudio = document.getElementById('monitor-audio');
const clearMyMessages = document.getElementById('clear-my-messages');
const settingsError = document.getElementById('settings-error');
const noiseSuppressionSelect = document.getElementById('noise-suppression');
const micGainInput = document.getElementById('mic-gain');
const micGainValueEl = document.getElementById('mic-gain-value');
const micAutoToggle = document.getElementById('mic-auto');
const micThresholdInput = document.getElementById('mic-threshold');
const micMeterEl = document.querySelector('.mic-meter');
const micMeterLevel = document.getElementById('mic-meter-level');
const micMeterThreshold = document.getElementById('mic-meter-threshold');

const fullscreenView = document.getElementById('fullscreen-view');
const fullscreenVideo = document.getElementById('fullscreen-video');
const fullscreenName = document.getElementById('fullscreen-name');
const fullscreenClose = document.getElementById('fullscreen-close');
const fullscreenNative = document.getElementById('fullscreen-native');
const fullscreenMusicHost = document.getElementById('fullscreen-music');

const musicPanel = document.getElementById('music-panel');
const musicPanelClose = document.getElementById('music-panel-close');
const musicUrlInput = document.getElementById('music-url');
const musicErrorEl = document.getElementById('music-error');
const musicToggleBtn = document.getElementById('music-toggle');
const musicSkipBtn = document.getElementById('music-skip');
const musicVolumeInput = document.getElementById('music-volume');
const musicVolumeValue = document.getElementById('music-volume-value');
const musicQueueEl = document.getElementById('music-queue');
const musicEmptyEl = document.getElementById('music-empty');

/* ================= ESTADO ================= */
const VoxFriendsRules = window.VoxFriends;
const { PROTOCOL_VERSION, VERSION_MISMATCH_MESSAGE, isCompatible } = window.VoxProtocol;
const { targetPositionMs, shouldCorrectSeek } = window.VoxMusic;

let currentUser = '';
let sessionToken = null;   // só na memória: reconecta sem senha, mas fechar o app pede login de novo
let currentTextRoom = '';  // sempre preenchido depois do login
let currentVoiceRoom = ''; // '' = fora de canal de voz
let voiceLeaves = 0;       // conta as saídas da voz; pedidos de mídia comparam para saber se a voz caiu
let pendingCam = false;    // pedido de câmera em andamento
let pendingShare = false;  // pedido de compartilhamento de tela em andamento

let localStream = null;
let screenStream = null;
let sharingScreen = false;
let micEnabled = true;
let camEnabled = false;

const peers = new Map();          // socketId -> RTCPeerConnection
const remoteStreams = new Map();  // socketId -> MediaStream
const userMap = new Map();        // socketId -> { username, muted }
let voiceRooms = {};              // room -> [{ id, username, muted, status }]
let peerVolumes = {};             // username -> volume (0..1)
try { peerVolumes = JSON.parse(localStorage.getItem('vox-peer-volumes') || '{}') || {}; } catch (e) { peerVolumes = {}; }

function getPeerVolume(name) {
  const v = peerVolumes[name];
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : 1;
}

function applyPeerVolume(name) {
  const vol = getPeerVolume(name);
  document.querySelectorAll('.tile[data-peer-key]').forEach((tile) => {
    if (tile.dataset.peerKey !== name) return;
    tile.querySelectorAll('video, audio').forEach((el) => { el.volume = vol; });
  });
  screenAudioEls.forEach((el, id) => {
    const u = userMap.get(id);
    if (u && u.username === name) el.volume = vol;
  });
}

function setPeerVolume(name, vol) {
  peerVolumes[name] = vol;
  localStorage.setItem('vox-peer-volumes', JSON.stringify(peerVolumes));
  applyPeerVolume(name);
}
const analysers = new Map();      // socketId -> AnalyserNode
const videoElements = new Map();  // stream.id -> <video> reaproveitado entre renders
const usedVideoIds = new Set();
const speakingStates = new Map(); // socketId (inclusive o próprio) -> estado do anel de fala
let localAnalyser = null;         // { trackId, analyser } do microfone enviado

let audioContext = null;
let rafId = null;
let lastUsersSignature = '';

// Processamento de áudio do microfone
let micPipeline = null;
let micProcessedTrack = null;
let noiseSuppressionMode = localStorage.getItem('vox-noise-suppression') || 'strong';
if (!['off', 'browser', 'strong'].includes(noiseSuppressionMode)) noiseSuppressionMode = 'strong';
const { clampNumber } = window.VoxMicGate;
let micGainPercent = clampNumber(localStorage.getItem('vox-mic-gain') ?? 100, 0, 200, 100);
let micAuto = localStorage.getItem('vox-mic-auto') !== '0';
let micThresholdDb = clampNumber(localStorage.getItem('vox-mic-threshold') ?? -50, -70, -10, -50);
const noiseGateContexts = new WeakSet();

// Música do YouTube na chamada
let musicState = null;     // último music-state recebido (+ receivedAt = Date.now() local); null = sem música
let musicPlayer = null;    // instância YT.Player ou null
let musicTileEl = null;    // tile persistente com o player: renderTiles nunca o remove nem o move
let musicPlayerReady = false;
let musicLoadedItemId = null; // item da fila carregado no player
let musicLastSeekAt = null;    // último seek corretivo no item carregado (limita a um por SEEK_COOLDOWN_MS)
let musicCommandUntil = 0;     // até quando mudanças de estado do player vêm de comandos do próprio Vox
let musicPlayerGen = 0;       // invalida criações de player pendentes (API ainda carregando)
let musicPlayerHost = null;   // onde o player atual está: host do tile ou o canto da tela cheia
let youTubeApiPromise = null;

// Tela cheia
let fullscreenStream = null;
let fullscreenMuteTimer = null;

// Qualidade do compartilhamento de tela
let shareResolution = localStorage.getItem('vox-share-resolution') || '1080';
let shareFps = Number(localStorage.getItem('vox-share-fps') || 30) === 60 ? 60 : 30;
// Áudio do PC na tela: só o Windows tem captura 'loopback' no Electron.
const SHARE_AUDIO_SUPPORTED = /Windows/.test(navigator.userAgent);
const screenAudioEls = new Map(); // socketId -> <audio> com o áudio do PC de quem compartilha

let statusMode = 'online'; // online | away | busy | invisible
let autoAway = false;
let idleTimer = null;
const IDLE_MS = 5 * 60 * 1000;

let monitorEnabled = localStorage.getItem('monitorEnabled') === '1';
let audioInputId = localStorage.getItem('audioInputId') || '';
let audioOutputId = localStorage.getItem('audioOutputId') || '';

const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Encoder de vídeo. Medido no Electron 28 (1080p, conteúdo em movimento):
// VP8 em modo "tela" cai para 1–4 fps; H.264 + contentHint "motion" mantém ~60 fps.
// Sem start-bitrate, a estimativa de banda começa em ~300 kbps e leva ~20 s
// subindo a resolução (480p → 1080p).
const VIDEO_START_KBPS = 6000;
const VIDEO_MIN_KBPS = 1500;
const SHARE_BITRATES = {
  '480': { 30: 1500000, 60: 2500000 },
  '720': { 30: 3000000, 60: 5000000 },
  '1080': { 30: 5000000, 60: 8000000 }
};

/* ================= UTIL ================= */
const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa61a', '#eb459e', '#ed4245', '#00a8fc', '#9b59b6', '#e67e22'];

function avatarColor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase();
}

// Fotos de perfil (username -> arquivo em /avatars), vindas de 'server-members'.
const avatarFiles = new Map();

// Foto da pessoa, ou iniciais sobre a cor dela. data-user permite atualizar
// todos os avatares da tela quando alguém troca a foto (refreshAvatars).
function applyAvatar(el, name) {
  el.dataset.user = name || '';
  el.style.background = avatarColor(name || '?');
  const file = name && avatarFiles.get(name);
  el.classList.toggle('has-image', !!file);
  if (!file) { el.textContent = initials(name); return; }
  const src = `${SERVER_URL}/avatars/${encodeURIComponent(file)}`;
  const current = el.querySelector('img');
  if (current && current.getAttribute('src') === src) return;
  const img = document.createElement('img');
  img.className = 'avatar-img';
  img.alt = '';
  img.src = src;
  img.addEventListener('error', () => { el.classList.remove('has-image'); el.textContent = initials(name); });
  el.textContent = '';
  el.appendChild(img);
}

function makeAvatar(name, extraClass = '') {
  const el = document.createElement('div');
  el.className = 'avatar ' + extraClass;
  applyAvatar(el, name);
  return el;
}

function refreshAvatars() {
  document.querySelectorAll('.avatar[data-user]').forEach((el) => {
    if (el.dataset.user) applyAvatar(el, el.dataset.user);
  });
}

function setMyIdentity(name) {
  currentUser = name;
  myName.textContent = name;
  applyAvatar(myAvatar, name);
  applyAvatar(document.getElementById('empty-avatar'), name);
}

/* ================= SERVIDORES (ESTADO) ================= */
let servers = [];             // servidores de que faço parte (evento 'servers')
let currentServerId = null;   // null = Início (amigos e diretas)
let friendsState = { friends: [], incoming: [], outgoing: [], dms: [] };

const serverById = (id) => servers.find((s) => s.id === id) || null;

// Canal (e servidor) de um id, ou null.
function channelInfo(room) {
  for (const server of servers) {
    const channel = server.channels.find((c) => c.id === room);
    if (channel) return { server, channel };
  }
  return null;
}

const isTextRoom = (room) => { const i = channelInfo(room); return (i && i.channel.type === 'text') || VoxFriendsRules.isDmKey(room); };
const isVoiceRoom = (room) => { const i = channelInfo(room); return (i && i.channel.type === 'voice') || VoxFriendsRules.isCallKey(room); };

function roomDisplayName(room) {
  const info = channelInfo(room);
  if (info) return info.channel.type === 'text' ? '#' + info.channel.name : info.channel.name;
  const other = currentUser ? VoxFriendsRules.otherOf(room, currentUser) : null;
  if (VoxFriendsRules.isDmKey(room)) return '@' + (other || '?');
  if (VoxFriendsRules.isCallKey(room)) return 'Chamada com ' + (other || '?');
  return room || '';
}

// Último servidor e último canal de cada servidor, para voltar onde parou.
function readJsonStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (e) { return fallback; }
}
let lastChannels = readJsonStorage('vox-last-channels', {});

/* ================= STATUS ================= */
const STATUS_LABELS = { online: 'Online', busy: 'Ocupado', away: 'Ausente', invisible: 'Invisível' };

const presence = window.VoxPresence;

function effectiveStatus() {
  return presence.effectiveStatus(statusMode, autoAway);
}

function updateMyStatusUI() {
  const s = effectiveStatus();
  myStatusEl.textContent = STATUS_LABELS[s] || 'Online';
  myStatusEl.style.color =
    s === 'busy' ? 'var(--danger-text)' :
    s === 'away' ? 'var(--warn-text)' :
    s === 'invisible' ? 'var(--muted)' : 'var(--ok-text)';
  myStatusDot.className = 'status-dot ' + s;
}

function sendStatus() {
  socket.emit('update-state', { muted: !micEnabled, status: effectiveStatus(), sharing: sharingScreen });
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (presence.onIdle(statusMode)) {
      autoAway = true;
      updateMyStatusUI();
      sendStatus();
    }
  }, IDLE_MS);
}

function markActive() {
  if (autoAway) {
    autoAway = presence.onActivity(autoAway);
    updateMyStatusUI();
    sendStatus();
  }
  resetIdleTimer();
}

['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => {
  window.addEventListener(ev, markActive, { passive: true });
});

btnStatus.addEventListener('click', (e) => {
  e.stopPropagation();
  statusMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!statusMenu.classList.contains('hidden') &&
      !statusMenu.contains(e.target) &&
      e.target !== btnStatus && !btnStatus.contains(e.target)) {
    statusMenu.classList.add('hidden');
  }
});

document.querySelectorAll('#status-menu button').forEach((btn) => {
  btn.addEventListener('click', () => {
    statusMode = btn.dataset.status;
    autoAway = false;
    updateMyStatusUI();
    sendStatus();
    if (effectiveStatus() === 'invisible') closeAllPeers();
    statusMenu.classList.add('hidden');
    resetIdleTimer();
  });
});

/* ================= TELAS ================= */
function hideOverlays() {
  authScreen.style.display = 'none';
}

// Login ou cadastro concluído. O servidor manda 'servers' logo em seguida; ao chegar a
// primeira lista, abre o último servidor usado (ou o primeiro), sem entrar em voz:
// a pessoa escolhe o canal de voz. Sem servidores, abre o Início.
// (Entrar todos na voz ao mesmo tempo no login deixava às vezes alguém sem ouvir o outro.)
let pendingAutoJoin = false;
function enterApp(username, token) {
  sessionToken = token || null;
  unread = {};
  renderUnread();
  setMyIdentity(username);
  micEnabled = true;
  updateControlButtons();
  hideOverlays();
  pendingAutoJoin = true;
}

function autoJoinAfterLogin() {
  pendingAutoJoin = false;
  const last = localStorage.getItem('vox-last-server');
  const server = serverById(last) || servers[0];
  if (!server) { openHome(); return; }
  selectServer(server.id);
}

// Servidor em outra versão: a resposta de sucesso não traz a mesma versão do protocolo.
function rejectIfIncompatible(res, errorEl) {
  if (isCompatible(res.protocol)) return false;
  errorEl.textContent = VERSION_MISMATCH_MESSAGE;
  socket.emit('logout', () => {});
  return true;
}

/* ================= AUTH ================= */
function switchAuthTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
  errorLogin.textContent = '';
  errorRegister.textContent = '';
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
});

/* ================= SERVIDOR ================= */
serverUrlInput.value = SERVER_INPUT;

function serverLabel() {
  return GIST_REF ? `Conectado pelo link fixo (${SERVER_URL})` : `Conectado: ${SERVER_URL}`;
}

/* ---------- Link fixo: lê no Gist do host o endereço atual do túnel ---------- */
const RESOLVE_MIN_GAP_MS = 20000;
let lastResolveAt = 0;
let resolving = null;

async function fetchWithTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { cache: 'no-store', signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readFixedAddress() {
  try {
    const res = await fetchWithTimeout(VoxAddress.apiUrl(GIST_REF.id));
    if (res.ok) {
      const url = VoxAddress.readGistResponse(await res.json());
      if (url) return url;
    }
  } catch (e) {}
  // Reserva: a API do GitHub limita leituras sem login (60 por hora).
  const raw = VoxAddress.rawUrl(GIST_REF.owner, GIST_REF.id, Date.now());
  if (!raw) return null;
  try {
    const res = await fetchWithTimeout(raw);
    if (res.ok) return VoxAddress.readPayloadText(await res.text());
  } catch (e) {}
  return null;
}

// Atualiza o endereço do socket; a próxima tentativa de reconexão já usa o novo.
function refreshServerAddress(force) {
  if (!GIST_REF) return Promise.resolve(SERVER_URL);
  if (resolving) return resolving;
  if (!force && Date.now() - lastResolveAt < RESOLVE_MIN_GAP_MS) return Promise.resolve(SERVER_URL);
  lastResolveAt = Date.now();
  resolving = readFixedAddress().then((url) => {
    resolving = null;
    if (url) {
      try { localStorage.setItem('vox-server-resolved', url); } catch (e) {}
    } else {
      url = SERVER_URL || localStorage.getItem('vox-server-resolved') || '';
    }
    if (url && url !== SERVER_URL) {
      SERVER_URL = url;
      socket.io.uri = url;
    }
    return SERVER_URL;
  });
  return resolving;
}

function startFixedAddress() {
  serverStatus.textContent = 'Procurando o servidor pelo link fixo...';
  serverStatus.style.color = 'var(--muted)';
  refreshServerAddress(true).then((url) => {
    if (url) return socket.connect();
    serverStatus.textContent = 'Não foi possível ler o link fixo. Confira o link e a internet; tentando de novo...';
    serverStatus.style.color = 'var(--danger-text)';
    setTimeout(startFixedAddress, RESOLVE_MIN_GAP_MS);
  });
}

function applyServerUrl() {
  let url = serverUrlInput.value.trim();
  const gist = VoxAddress.parseGistRef(url);
  if (gist) {
    localStorage.setItem('vox-server-url', VoxAddress.gistLink(gist.owner, gist.id));
    localStorage.removeItem('vox-server-resolved');
    serverStatus.textContent = 'Conectando...';
    serverStatus.style.color = 'var(--muted)';
    location.reload();
    return;
  }
  if (!url) url = 'http://127.0.0.1:3000';
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  url = url.replace(/\/+$/, '');

  try {
    new URL(url);
  } catch (e) {
    serverStatus.textContent = 'Endereço inválido.';
    serverStatus.style.color = 'var(--danger-text)';
    return;
  }

  localStorage.setItem('vox-server-url', url);
  serverStatus.textContent = 'Conectando...';
  serverStatus.style.color = 'var(--muted)';
  location.reload();
}

serverApply.addEventListener('click', applyServerUrl);
serverUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyServerUrl(); });

socket.on('connect', () => {
  serverStatus.textContent = serverLabel();
  serverStatus.style.color = 'var(--ok-text)';
  if (currentUser && sessionToken) resumeSession();
});
socket.on('connect_error', () => {
  serverStatus.textContent = GIST_REF
    ? 'Sem conexão. O host pode estar desligado ou com o túnel reabrindo; tentando de novo...'
    : 'Sem conexão. Confira o endereço do servidor.';
  serverStatus.style.color = 'var(--danger-text)';
  // O túnel do host pode ter reaberto com outro endereço: relê o link fixo.
  refreshServerAddress(false);
});
socket.on('disconnect', () => {
  serverStatus.textContent = 'Desconectado do servidor.';
  serverStatus.style.color = 'var(--danger-text)';
  // Sem servidor não há como controlar a música: para o player e some com o tile.
  resetMusic();
  // Logado: o Socket.io tenta reconectar sozinho; a chamada P2P segue enquanto der.
  if (currentUser) connBanner.classList.remove('hidden');
});

/* ================= RECONEXÃO ================= */
// O socket novo tem outro id: entra de novo no texto e na voz com o mesmo estado.
function resumeSession() {
  socket.emit('resume', { token: sessionToken, protocol: PROTOCOL_VERSION }, (res) => {
    if (!res || !res.success) {
      connBanner.classList.add('hidden');
      endSession((res && res.message) || 'Sua sessão expirou. Entre de novo.');
      return;
    }
    connBanner.classList.add('hidden');
    sendStatus(); // antes do join-voice: invisível continua invisível
    if (currentTextRoom) {
      socket.emit('join-text', currentTextRoom);
      reloadMessages();
    }
    if (currentVoiceRoom) {
      closeAllPeers();
      userMap.clear();
      lastUsersSignature = '';
      soundRoster = undefined; // a primeira lista depois de voltar não toca som
      socket.emit('join-voice', currentVoiceRoom);
      sendStatus();
    }
    renderMembers();
  });
}

if (GIST_REF) {
  startFixedAddress();
} else if (socket.connected) {
  serverStatus.textContent = serverLabel();
  serverStatus.style.color = 'var(--ok-text)';
} else {
  serverStatus.textContent = 'Conectando ao servidor...';
  serverStatus.style.color = 'var(--muted)';
}

btnRegister.addEventListener('click', () => {
  const username = regUser.value.trim();
  const password = regPass.value;
  const confirm = regPass2.value;

  if (!username || !password) { errorRegister.textContent = 'Preencha todos os campos'; return; }
  if (password !== confirm) { errorRegister.textContent = 'As senhas não coincidem'; return; }
  if (!socket.connected) { errorRegister.textContent = 'Sem conexão com o servidor. Confira o endereço abaixo.'; return; }

  btnRegister.disabled = true;
  socket.emit('register', { username, password, protocol: PROTOCOL_VERSION }, (res) => {
    btnRegister.disabled = false;
    if (!res.success) { errorRegister.textContent = res.message; return; }
    if (rejectIfIncompatible(res, errorRegister)) return;
    enterApp(res.username, res.token);
  });
});

function doLogin() {
  const username = loginUser.value.trim();
  const password = loginPass.value;

  if (!username || !password) { errorLogin.textContent = 'Preencha todos os campos'; return; }
  if (!socket.connected) { errorLogin.textContent = 'Sem conexão com o servidor. Confira o endereço abaixo.'; return; }

  btnLogin.disabled = true;
  socket.emit('login', { username, password, protocol: PROTOCOL_VERSION }, (res) => {
    btnLogin.disabled = false;
    if (!res.success) { errorLogin.textContent = res.message; return; }
    if (rejectIfIncompatible(res, errorLogin)) return;
    enterApp(res.username, res.token);
  });
}

btnLogin.addEventListener('click', doLogin);
loginPass.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
regPass2.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnRegister.click(); });

/* ================= MÍDIA LOCAL ================= */
let localMediaPromise = null;

// Cliques rápidos em canais de voz reaproveitam o mesmo pedido de microfone.
function ensureLocalMedia() {
  if (localStream) return Promise.resolve(localStream);
  if (!localMediaPromise) {
    localMediaPromise = acquireLocalMedia().finally(() => { localMediaPromise = null; });
  }
  return localMediaPromise;
}

// Restrições do microfone: a redução de ruído do navegador só fica de fora no modo "Desligada".
function micAudioConstraints(deviceId) {
  const audio = {
    echoCancellation: true,
    noiseSuppression: noiseSuppressionMode !== 'off',
    autoGainControl: false,
    channelCount: 1
  };
  if (deviceId) audio.deviceId = { exact: deviceId };
  return audio;
}

async function acquireLocalMedia() {
  const savedAudio = micAudioConstraints(audioInputId);
  const defaultAudio = micAudioConstraints();

  const buildConstraints = (withVideo, audio) => {
    const constraints = { audio };
    if (withVideo) constraints.video = { width: 1280, height: 720, frameRate: 30 };
    return constraints;
  };

  // Câmera começa desligada: o áudio é sempre pedido, o vídeo só se o usuário ativou.
  const attempts = [
    [camEnabled, savedAudio],
    [camEnabled, defaultAudio],
    [false, defaultAudio]
  ];

  for (const [withVideo, audio] of attempts) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia(buildConstraints(withVideo, audio));
      if (!withVideo && camEnabled) camEnabled = false;
      break;
    } catch (e) {
      console.warn('Falha ao obter mídia:', e);
    }
  }

  if (localStream) {
    const mic = localStream.getAudioTracks()[0];
    if (mic) mic.enabled = micEnabled;
    const cam = localStream.getVideoTracks()[0];
    if (cam) cam.enabled = camEnabled;
    await rebuildMicProcessing();
    updateMonitor();
  }
  updateControlButtons();
  return localStream;
}

// Menu do ícone da bandeja: mudo, se está na voz e quantas mensagens não lidas.
function pushTrayState() {
  if (!window.electronAPI.reportTrayState) return;
  let pending = 0;
  try { pending = Object.values(unread).reduce((n, u) => n + u.count, 0); } catch (e) {} // `unread` ainda não existe no começo da carga
  window.electronAPI.reportTrayState({ muted: !micEnabled, inVoice: !!currentVoiceRoom, unread: pending });
}

function updateControlButtons() {
  pushTrayState();
  VoxIcons.setIcon(btnMic, micEnabled ? 'mic' : 'mic-off', 'Mic');
  btnMic.classList.toggle('off', !micEnabled);
  btnMic.classList.toggle('primary', micEnabled);

  VoxIcons.setIcon(btnCam, camEnabled ? 'video' : 'video-off', camEnabled ? 'Cam' : 'Cam Off');
  btnCam.classList.toggle('off', !camEnabled);
  btnCam.classList.toggle('primary', camEnabled);

  VoxIcons.setIcon(btnMicMini, micEnabled ? 'mic' : 'mic-off');
  btnMicMini.classList.toggle('off', !micEnabled);
}

// Câmera, tela, música e ✕ só funcionam com voz conectada; o microfone continua livre.
// Cam e Tela também ficam travados enquanto um pedido de câmera/tela está em andamento.
function updateVoiceDependentControls() {
  pushTrayState();
  const noVoice = !currentVoiceRoom;
  btnSoundboard.disabled = noVoice;
  btnSoundboard.title = noVoice ? 'Entre em um canal de voz' : 'Soundboard';
  if (noVoice) closeSoundboard();
  [btnCam, btnScreen, btnMusic, btnHangup].forEach((btn) => {
    if (noVoice) btn.title = 'Entre em um canal de voz';
    else btn.title = btn.dataset.title || btn.title;
  });
  btnCam.disabled = noVoice || pendingCam;
  btnScreen.disabled = noVoice || pendingShare;
  btnMusic.disabled = noVoice;
  btnHangup.disabled = noVoice;
}
[btnCam, btnScreen, btnMusic, btnHangup].forEach((btn) => { btn.dataset.title = btn.title; });

/* ================= PEERS (WebRTC) ================= */
// Transceiver de vídeo já negociado (com mid). No lado que responde à oferta,
// o addTransceiver('video') local não é reaproveitado pela oferta remota e fica
// sem mid: enviar por ele não chega ao outro lado.
function getVideoTransceiver(pc) {
  const list = pc.getTransceivers().filter(
    (t) => !t.stopped && t.receiver && t.receiver.track && t.receiver.track.kind === 'video'
  );
  return list.find((t) => t.mid !== null) || list[0] || null;
}

// Ao responder, cada m-line da oferta cria um transceiver novo (recvonly) e os
// criados aqui com addTransceiver ficam órfãos, sem mid. Sem isto, quem entrou
// depois na sala não consegue enviar vídeo (câmera/tela) para quem já estava.
async function adoptOfferTransceivers(pc) {
  const all = pc.getTransceivers();
  for (const kind of ['audio', 'video']) {
    const ofKind = all.filter((t) => !t.stopped && t.receiver && t.receiver.track && t.receiver.track.kind === kind);
    const negotiated = ofKind.find((t) => t.mid !== null);
    if (!negotiated) continue;
    for (const orphan of ofKind.filter((t) => t.mid === null)) {
      if (orphan.sender.track && !negotiated.sender.track) await negotiated.sender.replaceTrack(orphan.sender.track);
      orphan.stop();
    }
    // Inclui o segundo áudio (tela): sem sendrecv, quem respondeu não envia o áudio do PC.
    ofKind.filter((t) => t.mid !== null && t.direction === 'recvonly').forEach((t) => { t.direction = 'sendrecv'; });
  }
}

// Segundo transceiver de áudio negociado (o primeiro é o microfone): áudio do PC
// no compartilhamento de tela. Null com quem não tem essa m-line.
function getScreenAudioTransceiver(pc) {
  const list = pc.getTransceivers().filter(
    (t) => !t.stopped && t.mid !== null && t.receiver && t.receiver.track && t.receiver.track.kind === 'audio'
  );
  return list[1] || null;
}

function applyScreenAudio(pc) {
  const transceiver = getScreenAudioTransceiver(pc);
  if (!transceiver) return;
  const track = (sharingScreen && screenStream && screenStream.getAudioTracks()[0]) || null;
  if (transceiver.sender.track === track) return;
  transceiver.sender.replaceTrack(track)
    .catch((e) => console.warn('Falha ao trocar áudio da tela:', e));
}

// Elemento próprio: o <audio>/<video> do tile só toca a primeira faixa de áudio do stream.
function attachScreenAudio(id, track) {
  removeScreenAudio(id);
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.className = 'remote-audio';
  audio.style.display = 'none';
  audio.srcObject = new MediaStream([track]);
  const u = userMap.get(id);
  audio.volume = getPeerVolume(u ? u.username : '');
  if (typeof audio.setSinkId === 'function') audio.setSinkId(audioOutputId || '').catch(() => {});
  document.body.appendChild(audio);
  screenAudioEls.set(id, audio);
}

function removeScreenAudio(id) {
  const audio = screenAudioEls.get(id);
  if (!audio) return;
  audio.srcObject = null;
  audio.remove();
  screenAudioEls.delete(id);
}

function preferVideoCodecs(pc) {
  if (!window.RTCRtpReceiver || !RTCRtpReceiver.getCapabilities) return;
  const recvCaps = RTCRtpReceiver.getCapabilities('video');
  const sendCaps = RTCRtpSender.getCapabilities ? RTCRtpSender.getCapabilities('video') : null;
  if (!recvCaps) return;
  const canSendH264 = !!(sendCaps && sendCaps.codecs.some((c) => c.mimeType === 'video/H264'));
  const rank = (c) => {
    if (c.mimeType === 'video/H264' && canSendH264) return /packetization-mode=1/.test(c.sdpFmtpLine || '') ? 0 : 1;
    if (c.mimeType === 'video/VP8') return 2;
    return 3;
  };
  const sorted = recvCaps.codecs.slice().sort((a, b) => rank(a) - rank(b));
  pc.getTransceivers().forEach((t) => {
    if (t.stopped || !t.setCodecPreferences || !t.receiver || t.receiver.track.kind !== 'video') return;
    try { t.setCodecPreferences(sorted); } catch (e) { console.warn('setCodecPreferences falhou:', e); }
  });
}

// Parâmetros x-google-* do Chromium na descrição remota: a estimativa de banda
// já começa alta em vez de ~300 kbps.
function withVideoBitrateHints(desc) {
  const lines = desc.sdp.split('\r\n');
  const hint = `x-google-start-bitrate=${VIDEO_START_KBPS};x-google-min-bitrate=${VIDEO_MIN_KBPS}`;
  const out = [];
  let inVideo = false;
  const mediaPts = new Set();
  const withFmtp = new Set();

  const isMediaCodec = (line) => !/ (rtx|red|ulpfec|flexfec-03)\//i.test(line);

  // 1ª passada: codecs de mídia do vídeo e quais já têm a=fmtp
  lines.forEach((line) => {
    if (line.startsWith('m=')) inVideo = line.startsWith('m=video');
    if (!inVideo) return;
    let m = line.match(/^a=rtpmap:(\d+) /);
    if (m && isMediaCodec(line)) mediaPts.add(m[1]);
    m = line.match(/^a=fmtp:(\d+) /);
    if (m) withFmtp.add(m[1]);
  });

  inVideo = false;
  lines.forEach((line) => {
    if (line.startsWith('m=')) inVideo = line.startsWith('m=video');
    if (inVideo) {
      const fmtp = line.match(/^a=fmtp:(\d+) /);
      if (fmtp && mediaPts.has(fmtp[1]) && !line.includes('x-google-start-bitrate')) {
        out.push(`${line};${hint}`);
        return;
      }
      out.push(line);
      const rtpmap = line.match(/^a=rtpmap:(\d+) /);
      if (rtpmap && mediaPts.has(rtpmap[1]) && !withFmtp.has(rtpmap[1])) {
        out.push(`a=fmtp:${rtpmap[1]} ${hint}`);
      }
      return;
    }
    out.push(line);
  });

  return { type: desc.type, sdp: out.join('\r\n') };
}

function shareBitrate() {
  const byFps = SHARE_BITRATES[shareResolution] || SHARE_BITRATES['1080'];
  return byFps[shareFps] || byFps[30];
}

// 60 fps: prioriza fluidez (jogos/vídeo). 30 fps: prioriza nitidez (texto/código).
async function applyVideoSenderParams(pc) {
  const transceiver = getVideoTransceiver(pc);
  const sender = transceiver && transceiver.sender;
  if (!sender || !sender.getParameters) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || !params.encodings.length) return; // ainda não negociado
    const enc = params.encodings[0];
    if (sharingScreen) {
      enc.maxBitrate = shareBitrate();
      enc.maxFramerate = shareFps;
      enc.scaleResolutionDownBy = 1;
      params.degradationPreference = shareFps === 60 ? 'maintain-framerate' : 'maintain-resolution';
    } else {
      delete enc.maxBitrate;
      delete enc.maxFramerate;
      params.degradationPreference = 'balanced';
    }
    await sender.setParameters(params);
  } catch (e) {
    console.warn('Falha ao ajustar parâmetros de vídeo:', e);
  }
}

function createPeer(id) {
  if (peers.has(id)) return peers.get(id);

  const pc = new RTCPeerConnection(ICE_CONFIG);
  peers.set(id, pc);

  const audioTracks = getOutboundAudioTracks();
  const outboundStream = new MediaStream([
    ...audioTracks,
    ...((localStream && localStream.getVideoTracks()) || [])
  ]);

  if (audioTracks.length) {
    audioTracks.forEach((t) => pc.addTrack(t, outboundStream));
  } else {
    pc.addTransceiver('audio', { direction: 'sendrecv' });
  }

  const videoTrack = (sharingScreen && screenStream)
    ? screenStream.getVideoTracks()[0]
    : (localStream && localStream.getVideoTracks()[0]) || null;

  if (videoTrack) {
    pc.addTrack(videoTrack, sharingScreen ? screenStream : outboundStream);
  } else {
    // Transceiver de vídeo desde o início: permite ligar a câmera depois
    // com replaceTrack, sem precisar renegociar a conexão.
    pc.addTransceiver('video', { direction: 'sendrecv' });
  }

  // Áudio do PC no compartilhamento de tela, também sem renegociar (applyScreenAudio).
  pc.addTransceiver('audio', { direction: 'sendrecv' });

  pc._pendingCandidates = [];

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('signal', { to: id, data: { candidate: e.candidate } });
  };

  pc.ontrack = (e) => {
    if (e.track.kind === 'audio' && e.transceiver === getScreenAudioTransceiver(pc)) {
      attachScreenAudio(id, e.track);
      return;
    }
    let stream = remoteStreams.get(id);
    if (!stream) {
      stream = e.streams[0] || new MediaStream();
      remoteStreams.set(id, stream);
    }
    if (!stream.getTracks().some((t) => t.id === e.track.id)) {
      stream.addTrack(e.track);
    }
    if (e.track.kind === 'audio') setupAnalyser(id, stream);
    if (e.track.kind === 'video') {
      // "mute" dispara em qualquer pausa curta de frames; só troca para o
      // avatar se a pausa durar, senão um engasgo vira tela piscando.
      let muteTimer = null;
      e.track.addEventListener('mute', () => {
        clearTimeout(muteTimer);
        muteTimer = setTimeout(() => { if (e.track.muted) renderTiles(); }, 1500);
      });
      e.track.addEventListener('unmute', () => {
        clearTimeout(muteTimer);
        if (!videoElements.has(stream.id)) renderTiles();
      });
    }
    renderTiles();
  };

  setPeerConn(id, 'connecting');
  pc.onconnectionstatechange = () => {
    if (peers.get(id) !== pc) return; // conexão já substituída
    const st = pc.connectionState;
    if (st === 'connected') {
      setPeerConn(id, 'connected');
      clearRecovery(id);
    } else if (st === 'disconnected') {
      // Pela internet (sem TURN) a rota cai de vez em quando: espera um pouco e renegocia.
      setPeerConn(id, 'reconnecting');
      scheduleRecovery(id, pc, RECOVERY_GRACE_MS);
    } else if (st === 'failed') {
      // Antes a conexão era apagada aqui e só voltava saindo e entrando no canal.
      setPeerConn(id, 'reconnecting');
      scheduleRecovery(id, pc, 0);
    } else if (st === 'closed') {
      peerConn.delete(id);
      updateConnLabel(id);
      dropPeer(id);
    } else {
      setPeerConn(id, 'connecting');
    }
    renderTiles();
  };

  return pc;
}

/* ---------- Recuperação de conexão entre os PCs ---------- */
// Sem TURN, a rota direta entre dois PCs pela internet às vezes cai. Quem tem o
// menor id de socket conduz a recuperação (os dois nunca renegociam juntos):
// 1º reinicia o ICE na mesma conexão; se em RECOVERY_RESTART_MS não voltar,
// refaz a conexão do zero (oferta com fresh). O outro lado pede a reconstrução.
const RECOVERY_GRACE_MS = 4000;
const RECOVERY_RESTART_MS = 8000;
const peerRecovery = new Map(); // id -> { timer, attempt }

const leadsRecovery = (id) => socket.id < id;

function scheduleRecovery(id, pc, delay) {
  const r = peerRecovery.get(id) || { timer: null, attempt: 0 };
  if (r.timer) return;
  r.timer = setTimeout(() => { r.timer = null; recoverPeer(id, pc); }, delay);
  peerRecovery.set(id, r);
}

function clearRecovery(id) {
  const r = peerRecovery.get(id);
  if (r) clearTimeout(r.timer);
  peerRecovery.delete(id);
}

async function recoverPeer(id, pc) {
  if (peers.get(id) !== pc || !currentVoiceRoom || !userMap.has(id) || effectiveStatus() === 'invisible') return;
  if (pc.connectionState === 'connected') { clearRecovery(id); return; }
  const r = peerRecovery.get(id) || { timer: null, attempt: 0 };
  r.attempt += 1;
  peerRecovery.set(id, r);
  console.warn(`[voz] conexão com ${id} em "${pc.connectionState}", tentativa ${r.attempt}`);
  if (!leadsRecovery(id)) {
    socket.emit('signal', { to: id, data: { rebuild: true } });
    scheduleRecovery(id, pc, RECOVERY_RESTART_MS);
    return;
  }
  if (r.attempt === 1 && pc.signalingState === 'stable') {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: id, data: { offer, restart: true } });
      scheduleRecovery(id, pc, RECOVERY_RESTART_MS);
      return;
    } catch (e) {
      console.warn('[voz] reinício do ICE falhou; refazendo a conexão', e);
    }
  }
  await rebuildPeer(id);
}

// Tira a conexão da lista e limpa o que era dela (sem mexer no pc em si).
function dropPeer(id) {
  clearRecovery(id);
  peers.delete(id);
  remoteStreams.delete(id);
  removeScreenAudio(id);
  analysers.delete(id);
}

// Fecha a conexão velha e faz uma nova oferta do zero.
async function rebuildPeer(id) {
  const old = peers.get(id);
  dropPeer(id);
  if (old) { old.onconnectionstatechange = null; try { old.close(); } catch (e) {} }
  await offerTo(id, { fresh: true });
}

async function offerTo(id, extra = {}) {
  try {
    const pc = createPeer(id);
    preferVideoCodecs(pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { to: id, data: { offer, ...extra } });
  } catch (e) {
    console.error('Erro ao criar oferta:', e);
  }
}

function closeAllPeers() {
  peerRecovery.forEach((r) => clearTimeout(r.timer));
  peerRecovery.clear();
  peers.forEach((pc) => { pc.onconnectionstatechange = null; try { pc.close(); } catch (e) {} });
  peers.clear();
  peerConn.clear();
  remoteStreams.clear();
  [...screenAudioEls.keys()].forEach(removeScreenAudio);
  analysers.clear();
  renderTiles();
}

/* ================= CANAL DE TEXTO ================= */
// Troca só o chat: não mexe em microfone nem na chamada.
function joinText(room) {
  if (!isTextRoom(room) || room === currentTextRoom) return;
  currentTextRoom = room;
  socket.emit('join-text', room);
  const info = channelInfo(room);
  if (info) {
    lastChannels[info.server.id] = room;
    try { localStorage.setItem('vox-last-channels', JSON.stringify(lastChannels)); } catch (e) {}
  }
  showChatView(room);
  messagesEl.innerHTML = '';
  messageRows.clear();
  unread = VoxChatRules.clearUnread(unread, room);
  renderUnread();
  reloadMessages();
  updateActiveChannel();
}

/* ================= CANAL DE VOZ ================= */
let joinToken = 0;

async function joinVoice(room) {
  if (!isVoiceRoom(room) || room === currentVoiceRoom) return;

  const token = ++joinToken;
  ensureAudioContext();

  // O servidor tira o socket da voz anterior ao receber join-voice; aqui só fecham os peers.
  if (currentVoiceRoom) {
    closeAllPeers();
    userMap.clear();
    lastUsersSignature = '';
    resetMusic(); // o servidor manda o music-state do canal novo no join-voice
  }
  currentVoiceRoom = room;
  voiceConnName.textContent = roomDisplayName(room);
  voiceConnection.classList.remove('hidden');
  updateActiveChannel();
  updateVoiceDependentControls();
  if (isSoundboardOpen()) loadSoundboard(); // a biblioteca é a do servidor da voz nova

  await ensureLocalMedia();
  if (token !== joinToken) {
    // Saiu da voz enquanto o microfone abria: não deixa a mídia ligada sem chamada.
    if (!currentVoiceRoom) stopLocalMedia();
    return; // outra troca de canal começou
  }

  soundRoster = null; // a próxima lista é a do canal novo: toca só a minha entrada
  socket.emit('join-voice', room);
  sendStatus();
  updateMonitor();

  renderTiles();
  renderMembers();
  startAudioLoop();
}

function updateActiveChannel() {
  document.querySelectorAll('.channel').forEach((el) => {
    const current = el.classList.contains('voice') ? currentVoiceRoom : currentTextRoom;
    el.classList.toggle('active', el.dataset.room === current);
  });
}


/* ================= SINALIZAÇÃO ================= */
socket.on('user-joined', async (id) => {
  if (effectiveStatus() === 'invisible') return;
  // fresh: se o outro lado ainda tiver uma conexão velha comigo, troca pela nova.
  if (peers.has(id)) {
    const old = peers.get(id);
    dropPeer(id);
    old.onconnectionstatechange = null;
    try { old.close(); } catch (e) {}
  }
  await offerTo(id, { fresh: true });
});

async function flushCandidates(pc) {
  if (!pc._pendingCandidates || pc._pendingCandidates.length === 0) return;
  const pending = pc._pendingCandidates.slice();
  pc._pendingCandidates = [];
  for (const candidate of pending) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
  }
}

socket.on('signal', async ({ from, data }) => {
  if (effectiveStatus() === 'invisible') return;
  try {
    // O outro lado não conseguiu recuperar a conexão: quem conduz refaz do zero.
    if (data.rebuild) {
      if (leadsRecovery(from) && currentVoiceRoom && userMap.has(from)) await rebuildPeer(from);
      return;
    }

    let pc = peers.get(from);
    const unusable = !pc || ['closed', 'failed'].includes(pc.connectionState);
    // Reinício de ICE para uma conexão que aqui já não existe: pede para refazer.
    if (data.offer && data.restart && unusable) {
      socket.emit('signal', { to: from, data: { rebuild: true } });
      return;
    }
    // Oferta de conexão nova: descarta a velha (outro certificado; não dá para reaproveitar).
    if (data.offer && data.fresh && pc) {
      dropPeer(from);
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch (e) {}
      pc = null;
    }
    if (!pc) {
      if (!data.offer) return; // resposta ou candidato de uma conexão que já não existe
      pc = createPeer(from);
    } else if (pc.signalingState === 'closed') {
      return; // sobra da conexão que caiu; a recuperação refaz uma nova
    }

    if (data.offer) {
      await pc.setRemoteDescription(withVideoBitrateHints(data.offer));
      await flushCandidates(pc);
      await adoptOfferTransceivers(pc);
      preferVideoCodecs(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', { to: from, data: { answer } });
      applyVideoSenderParams(pc);
      applyScreenAudio(pc);
    } else if (data.answer) {
      await pc.setRemoteDescription(withVideoBitrateHints(data.answer));
      await flushCandidates(pc);
      applyVideoSenderParams(pc);
      applyScreenAudio(pc);
    } else if (data.candidate) {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        pc._pendingCandidates.push(data.candidate);
      }
    }
  } catch (e) {
    console.error('Erro na sinalização:', e);
  }
});

/* ================= PARTICIPANTES ================= */
socket.on('room-users', (list) => {
  userMap.clear();
  list.forEach((u) => userMap.set(u.id, u));

  if (currentVoiceRoom) {
    const listIds = list.map((u) => u.id);
    // undefined = primeira lista depois de reconectar: só guarda, sem som
    const sound = soundRoster === undefined ? null : VoxSounds.rosterSound(soundRoster, listIds, socket.id);
    soundRoster = listIds;
    if (sound) playSoundEffect(sound);
    // Chamada direta: quando a outra pessoa desliga, a chamada acaba para mim também
    if (VoxFriendsRules.isCallKey(currentVoiceRoom)) {
      if (list.length > 1) callPeerSeen = true;
      else if (callPeerSeen) {
        callPeerSeen = false;
        setTimeout(() => { leaveVoice(); showToast('Chamada encerrada.'); }, 0);
      }
    }
  }

  // Remove conexões de pessoas que saíram da sala
  let removed = false;
  const ids = new Set(list.map((u) => u.id));
  [...peers.keys()].forEach((id) => {
    if (!ids.has(id)) {
      const pc = peers.get(id);
      dropPeer(id);
      peerConn.delete(id);
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch (e) {}
      removed = true;
    }
  });

  renderMembers();

  const signature = list.map((u) => u.id).sort().join('|');
  if (removed || signature !== lastUsersSignature) {
    lastUsersSignature = signature;
    renderTiles();
  }
});

socket.on('voice-rooms', (data) => {
  voiceRooms = data || {};
  renderMembers();
});

// Estado da conexão de áudio/vídeo com cada pessoa da chamada (painel Participantes)
const peerConn = new Map(); // socketId -> { state, rttMs }
const CONN_LABELS = {
  connecting: 'Conectando…', reconnecting: 'Reconectando…', failed: 'Falhou', connected: 'Conectado'
};

function setPeerConn(id, state) {
  const prev = peerConn.get(id) || {};
  peerConn.set(id, { state, rttMs: state === 'connected' ? prev.rttMs : null });
  updateConnLabel(id);
}

function connLabelText(id) {
  const c = peerConn.get(id);
  if (!c) return CONN_LABELS.connecting; // ainda sem conexão criada
  if (c.state === 'connected' && c.rttMs != null) return `Conectado · ${c.rttMs} ms`;
  return CONN_LABELS[c.state] || CONN_LABELS.connecting;
}

function updateConnLabel(id) {
  const state = (peerConn.get(id) || {}).state || 'connecting';
  document.querySelectorAll(`.member-conn[data-id="${CSS.escape(id)}"]`).forEach((el) => {
    el.textContent = connLabelText(id);
    el.dataset.state = state;
  });
}

// Ping de cada conexão: par de candidatos escolhido pelo WebRTC
setInterval(async () => {
  if (!currentVoiceRoom) return;
  for (const [id, pc] of peers) {
    if (pc.connectionState !== 'connected') continue;
    try {
      const stats = await pc.getStats();
      let rtt = null;
      stats.forEach((r) => {
        if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded' && r.currentRoundTripTime != null) {
          rtt = Math.round(r.currentRoundTripTime * 1000);
        }
      });
      const c = peerConn.get(id);
      if (c && c.state === 'connected' && rtt != null) {
        c.rttMs = rtt;
        updateConnLabel(id);
      }
    } catch (e) {}
  }
}, 2000);

// Canais de voz com música tocando (vem do servidor em 'music-rooms')
let musicRooms = new Set();
socket.on('music-rooms', (list) => {
  musicRooms = new Set(Array.isArray(list) ? list : []);
  renderMembers();
});

// Membros do servidor (todas as contas), vindos do servidor em 'server-members'
let serverMembers = [];
socket.on('server-members', (list) => {
  serverMembers = Array.isArray(list) ? list : [];
  let changed = false;
  for (const m of serverMembers) {
    const file = m.avatar && VoxChat.isAvatarName(m.avatar) ? m.avatar : null;
    if ((avatarFiles.get(m.username) || null) !== file) {
      changed = true;
      if (file) avatarFiles.set(m.username, file); else avatarFiles.delete(m.username);
    }
  }
  renderMembers();
  if (changed) { refreshAvatars(); renderAccountAvatar(); }
  // Presença dos amigos no Início (bolinhas das conversas e lista de amigos)
  if (!currentServerId && currentUser) {
    renderSidebar();
    if (chatWrap.classList.contains('friends-mode')) renderFriendsPanel();
  }
});

function appendMemberRow(u) {
  const isMe = u.username === currentUser;
  const inMyCall = !!(currentVoiceRoom && u.voiceRoom === currentVoiceRoom);
  const row = document.createElement('div');
  row.className = 'member' + (u.online ? '' : ' offline');
  // Bolinha de status sobre o avatar, como na lista do canal de voz (offline: sem bolinha)
  const avatarWrap = document.createElement('span');
  avatarWrap.className = 'avatar-wrap';
  avatarWrap.appendChild(makeAvatar(u.username));
  if (u.online) {
    const dot = document.createElement('span');
    dot.className = 'status-dot member-status-dot ' + (u.status || 'online');
    avatarWrap.appendChild(dot);
  }
  row.appendChild(avatarWrap);

  const name = document.createElement('div');
  name.className = 'member-name';
  name.appendChild(document.createTextNode(u.username));
  if (isMe) {
    const you = document.createElement('span');
    you.className = 'you';
    you.textContent = '(você)';
    name.appendChild(you);
  }
  if (!isMe && inMyCall && u.id) {
    // Nome em cima, estado da conexão embaixo
    const nameBox = document.createElement('div');
    nameBox.className = 'member-name-box';
    const conn = document.createElement('span');
    conn.className = 'member-conn';
    conn.dataset.id = u.id;
    conn.dataset.state = (peerConn.get(u.id) || {}).state || 'connecting';
    conn.textContent = connLabelText(u.id);
    nameBox.append(name, conn);
    row.appendChild(nameBox);
  } else {
    row.appendChild(name);
  }
  row.title = u.online ? (STATUS_LABELS[u.status || 'online'] || 'Online') : 'Offline';

  // Microfone só para quem está em algum canal de voz
  if (u.voiceRoom) {
    const status = document.createElement('span');
    status.className = 'muted-icon';
    VoxIcons.setIcon(status, u.muted ? 'mic-off' : 'mic', '', 14);
    status.style.opacity = u.muted ? '1' : '.35';
    row.appendChild(status);
  }
  memberList.appendChild(row);
}

// Pessoas da coluna da direita: membros do servidor aberto, ou os amigos no Início.
function visibleMembers() {
  const server = serverById(currentServerId);
  const names = new Set(server ? server.members : [...friendsState.friends, currentUser]);
  return serverMembers.filter((m) => names.has(m.username));
}

function renderMembers() {
  memberList.innerHTML = '';
  const members = visibleMembers();
  memberHeading.textContent = currentServerId ? 'Membros' : 'Amigos';
  memberCount.textContent = members.length;
  const groups = [['Online', members.filter((m) => m.online)], ['Offline', members.filter((m) => !m.online)]];
  groups.forEach(([label, list]) => {
    if (!list.length) return;
    const title = document.createElement('div');
    title.className = 'members-section';
    title.textContent = `${label} — ${list.length}`;
    memberList.appendChild(title);
    list.forEach(appendMemberRow);
  });

  // Mostra os usuários embaixo do canal de voz correspondente
  document.querySelectorAll('.channel.voice').forEach((channelEl) => {
    const room = channelEl.dataset.room;
    // Ícone do YouTube no canal que está com música
    const ytIcon = channelEl.querySelector('.channel-yt');
    if (musicRooms.has(room) && !ytIcon) {
      const icon = youtubeIcon();
      icon.classList.add('channel-yt');
      channelEl.appendChild(icon);
    } else if (!musicRooms.has(room) && ytIcon) {
      ytIcon.remove();
    }
    let listEl = channelEl.nextElementSibling;
    if (!listEl || !listEl.classList.contains('voice-users')) {
      listEl = document.createElement('div');
      listEl.className = 'voice-users';
      channelEl.insertAdjacentElement('afterend', listEl);
    }
    listEl.innerHTML = '';

    const list = (voiceRooms[room] || []).slice();
    list.sort((a, b) => {
      if (a.username === currentUser) return -1;
      if (b.username === currentUser) return 1;
      return a.username.localeCompare(b.username);
    });

    list.forEach((u) => {
      const line = document.createElement('div');
      line.className = 'voice-user';
      line.dataset.id = u.id;
      const state = speakingStates.get(u.id);
      if (state && state.speaking) line.classList.add('speaking');
      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'avatar-wrap';
      avatarWrap.appendChild(makeAvatar(u.username, 'vu-avatar'));
      const dot = document.createElement('span');
      dot.className = 'status-dot vu-status-dot ' + (u.status || 'online');
      avatarWrap.appendChild(dot);
      line.appendChild(avatarWrap);
      const name = document.createElement('span');
      name.className = 'vu-name';
      name.textContent = u.username;
      line.appendChild(name);
      const icons = document.createElement('span');
      icons.className = 'vu-icons';
      if (u.muted) icons.appendChild(VoxIcons.icon('mic-off', 13));
      if (u.sharing) {
        const live = document.createElement('span');
        live.className = 'live-badge';
        live.textContent = 'AO VIVO';
        icons.appendChild(live);
      }
      if (icons.childNodes.length) line.appendChild(icons);
      listEl.appendChild(line);
    });

    listEl.style.display = list.length ? '' : 'none';
  });
}

/* ================= TILES DE VÍDEO ================= */
function renderTiles() {
  // Limpa só os outros tiles: tirar o iframe do DOM recarregaria a música
  Array.from(videoGrid.children).forEach((el) => { if (el !== musicTileEl) el.remove(); });
  usedVideoIds.clear();
  syncMusicTile();

  // Sem voz: área de chamada mostra só o estado vazio
  callEmpty.style.display = currentVoiceRoom ? 'none' : '';
  if (!currentVoiceRoom) {
    // Solta os <video> reaproveitados da chamada que acabou
    videoElements.forEach((video) => { video.srcObject = null; });
    videoElements.clear();
    return;
  }

  // Tile local
  const localStreamToShow = sharingScreen
    ? screenStream
    : (localStream && localStream.getVideoTracks().length ? localStream : null);

  videoGrid.appendChild(buildTile(currentUser || 'Você', localStreamToShow, {
    mirrored: !sharingScreen,
    muted: true,
    badge: sharingScreen ? 'TELA' : null
  }));

  // Tiles remotos
  remoteStreams.forEach((stream, id) => {
    const user = userMap.get(id);
    videoGrid.appendChild(buildTile(
      user ? user.username : 'Participante',
      stream,
      { muted: false, remote: true, userId: id, username: user ? user.username : 'Participante' }
    ));
  });

  // Estado vazio
  if (remoteStreams.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'tile';
    empty.style.borderStyle = 'dashed';
    empty.style.background = 'color-mix(in srgb, var(--text) 2%, transparent)';
    empty.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--muted);padding:20px;text-align:center;">
        <i data-icon="hand" data-size="28"></i>
        <div style="font-weight:600;color:var(--text);">Aguardando alguém entrar...</div>
        <div style="font-size:12px;">${VoxFriendsRules.isCallKey(currentVoiceRoom)
          ? 'Chamando ' + escapeHtml(VoxFriendsRules.otherOf(currentVoiceRoom, currentUser) || '') + '…'
          : 'Chame seus amigos para o canal ' + escapeHtml(roomDisplayName(currentVoiceRoom)) + '.'}</div>
      </div>`;
    VoxIcons.hydrate(empty);
    videoGrid.appendChild(empty);
  }

  videoElements.forEach((video, streamId) => {
    if (!usedVideoIds.has(streamId)) {
      video.srcObject = null;
      videoElements.delete(streamId);
    }
  });

  applyOutputDevice();
  layoutTiles();
}

// Grade da chamada: escolhe o nº de colunas que deixa os tiles (16:9) maiores
// no espaço disponível; abaixo do mínimo, mantém o mínimo e a grade rola.
const TILE_RATIO = 16 / 9;
const TILE_GAP = 12;
const TILE_MIN_W = 260;
const MUSIC_TILE_MIN_H = 240; // player do YouTube (mín. 200) + faixa

function layoutTiles() {
  const tiles = [...videoGrid.children].filter((el) => !el.classList.contains('hidden') && el.style.display !== 'none');
  const n = tiles.length;
  if (!n) return;
  const cs = getComputedStyle(videoGrid);
  const W = videoGrid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const H = videoGrid.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (W <= 0 || H <= 0) return;

  let best = { cols: 1, w: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((W - TILE_GAP * (cols - 1)) / cols, ((H - TILE_GAP * (rows - 1)) / rows) * TILE_RATIO);
    if (w > best.w) best = { cols, w };
  }
  let cols = best.cols;
  let w = Math.floor(best.w);
  if (w < TILE_MIN_W) {
    w = Math.min(TILE_MIN_W, Math.floor(W));
    cols = Math.max(1, Math.floor((W + TILE_GAP) / (w + TILE_GAP)));
  }
  let h = Math.floor(w / TILE_RATIO);
  if (musicTileEl && tiles.includes(musicTileEl) && h < MUSIC_TILE_MIN_H) h = MUSIC_TILE_MIN_H;

  videoGrid.style.setProperty('--grid-cols', String(Math.min(cols, n)));
  videoGrid.style.setProperty('--tile-w', w + 'px');
  videoGrid.style.setProperty('--tile-h', h + 'px');
}

if (window.ResizeObserver) new ResizeObserver(() => layoutTiles()).observe(videoGrid);

/* ================= MÚSICA DO YOUTUBE ================= */
// Cada pessoa toca o player oficial; o servidor só diz o que toca, se está pausado e o minuto.
const YT_PLAYER_VARS = { controls: 0, disablekb: 1, playsinline: 1, rel: 0 };
const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
const UNPLAYABLE_CODES = [100, 101, 150]; // indisponível / incorporação não permitida

// Volume só local, 0–100 (padrão 50).
function getMusicVolume() {
  const raw = localStorage.getItem('vox-music-volume');
  const v = Number(raw);
  if (raw === null || raw === '' || !Number.isFinite(v)) return 50;
  return Math.min(100, Math.max(0, Math.round(v)));
}

// Injeta a IFrame API do YouTube uma vez só.
function ensureYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!youTubeApiPromise) {
    youTubeApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === 'function') previous();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        script.remove();
        youTubeApiPromise = null; // permite tentar de novo no próximo music-state
        reject(new Error('Falha ao carregar a API do YouTube'));
      };
      document.head.appendChild(script);
    });
  }
  return youTubeApiPromise;
}

// Cria o tile uma vez; o host do player é recriado só quando o player é destruído.
function ensureMusicTile() {
  if (musicTileEl) return musicTileEl;
  musicTileEl = document.createElement('div');
  musicTileEl.className = 'tile music-tile hidden';
  const host = document.createElement('div');
  host.className = 'music-player-host';
  const label = document.createElement('div');
  label.className = 'music-tile-label';
  label.title = 'Abrir o painel de música';
  const text = document.createElement('span');
  text.className = 'music-tile-text';
  const fsBtn = document.createElement('button');
  fsBtn.type = 'button';
  fsBtn.className = 'music-fs-btn';
  fsBtn.title = 'Ver em tela cheia';
  fsBtn.setAttribute('aria-label', 'Ver o vídeo da música em tela cheia');
  VoxIcons.setIcon(fsBtn, 'maximize', '', 14);
  fsBtn.addEventListener('click', openMusicFullscreen);
  label.append(youtubeIcon(), text, fsBtn);
  musicTileEl.append(host, label);
  // Cliques no próprio vídeo ficam dentro do iframe; o resto do tile abre o painel
  musicTileEl.addEventListener('click', openMusicPanel);
  return musicTileEl;
}

// Mostra/esconde o tile e atualiza a faixa; o tile fica sempre como primeiro filho da grade.
function syncMusicTile() {
  const active = !!(currentVoiceRoom && musicState && musicState.queue.length);
  if (fullscreenMusicHost) fullscreenMusicHost.classList.toggle('hidden', !active);
  if (!active) {
    if (musicTileEl) musicTileEl.classList.add('hidden');
    if (fullscreenMusicOnly) closeFullscreenView();
    layoutTiles();
    return;
  }
  ensureMusicTile();
  // Só entra na grade enquanto ainda não está nela (antes de haver iframe dentro)
  if (musicTileEl.parentNode !== videoGrid) videoGrid.prepend(musicTileEl);
  musicTileEl.classList.remove('hidden');
  const current = musicState.queue[0];
  musicTileEl.querySelector('.music-tile-text').textContent =
    `${current.title || current.videoId} · ${musicState.queue.length - 1} na fila`; // queue[0] é a atual
  if (fullscreenMusicOnly) setFullscreenMusicName(current);
  layoutTiles();
}

// Ícone no estilo do YouTube (desenhado aqui, nada é baixado)
function youtubeIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'yt-icon');
  svg.setAttribute('viewBox', '0 0 28 20');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '13');
  svg.setAttribute('aria-hidden', 'true');
  const rect = document.createElementNS(ns, 'rect');
  rect.setAttribute('width', '28');
  rect.setAttribute('height', '20');
  rect.setAttribute('rx', '5');
  rect.setAttribute('fill', '#FF0000');
  const play = document.createElementNS(ns, 'path');
  play.setAttribute('d', 'M11 5.5v9l8-4.5z');
  play.setAttribute('fill', '#FFFFFF');
  svg.append(rect, play);
  return svg;
}

function setFullscreenMusicName(item) {
  fullscreenName.textContent = '';
  fullscreenName.append(youtubeIcon(), ' ' + (item.title || item.videoId));
}

// Tela cheia só da música: o player grande no lugar do vídeo de alguém
let fullscreenMusicOnly = false;

function openMusicFullscreen(ev) {
  if (ev) ev.stopPropagation(); // não abre o painel
  if (!fullscreenView || !musicState || !musicState.queue.length) return;
  fullscreenMusicOnly = true;
  fullscreenView.classList.add('music-only');
  setFullscreenMusicName(musicState.queue[0]);
  fullscreenView.classList.remove('hidden');
  relocateMusicPlayer();
  if (fullscreenView.requestFullscreen) fullscreenView.requestFullscreen().catch(() => {});
}

// Host onde o player deve estar: o canto da tela cheia enquanto ela está aberta
// (só o que está dentro do elemento em tela cheia aparece), senão o tile.
function musicHostTarget() {
  if (fullscreenMusicHost && fullscreenView && !fullscreenView.classList.contains('hidden')) return fullscreenMusicHost;
  return ensureMusicTile().querySelector('.music-player-host');
}

// Remove o player sem mexer no tile nem no estado (usado também para trocá-lo de lugar).
function teardownMusicPlayer() {
  musicPlayerGen++;
  if (musicPlayer) {
    try { musicPlayer.destroy(); } catch (e) {}
  }
  musicPlayer = null;
  musicPlayerReady = false;
  musicLoadedItemId = null;
  musicLastSeekAt = null;
  musicPlayerHost = null;
  if (musicTileEl) musicTileEl.querySelector('.music-player-host').innerHTML = '';
  if (fullscreenMusicHost) fullscreenMusicHost.innerHTML = '';
}

function destroyMusicPlayer() {
  teardownMusicPlayer();
  if (musicTileEl) musicTileEl.classList.add('hidden');
  if (fullscreenMusicHost) fullscreenMusicHost.classList.add('hidden');
}

// Abrir/fechar a tela cheia: mover um iframe o recarrega, então o player é recriado
// no lugar novo e retoma no minuto compartilhado (recarga curta).
function relocateMusicPlayer() {
  if (!musicPlayer || musicPlayerHost === musicHostTarget()) return;
  teardownMusicPlayer();
  if (musicState && currentVoiceRoom) createMusicPlayer();
}

async function createMusicPlayer() {
  const gen = ++musicPlayerGen;
  try {
    await ensureYouTubeApi();
  } catch (e) {
    console.warn(e.message);
    return;
  }
  // Saiu da voz, a fila acabou ou outro player foi criado enquanto a API carregava
  if (gen !== musicPlayerGen || musicPlayer || !musicState || !currentVoiceRoom) return;

  const host = musicHostTarget();
  const target = document.createElement('div');
  host.appendChild(target);
  musicPlayerHost = host;
  musicPlayer = new window.YT.Player(target, {
    width: '100%',
    height: '100%',
    playerVars: YT_PLAYER_VARS,
    events: {
      onReady: () => {
        if (gen !== musicPlayerGen) return;
        musicPlayerReady = true;
        musicPlayer.setVolume(getMusicVolume());
        syncMusicPlayer();
      },
      onStateChange: (ev) => {
        if (gen !== musicPlayerGen) return;
        onMusicPlayerStateChange(ev.data);
      },
      onError: (ev) => {
        if (gen !== musicPlayerGen) return;
        if (UNPLAYABLE_CODES.includes(ev.data) && musicLoadedItemId) {
          socket.emit('music-error', { itemId: musicLoadedItemId, code: ev.data });
        } else {
          console.warn('Player do YouTube: erro', ev.data);
        }
      }
    }
  });
}

// Faz o player seguir o estado compartilhado.
function syncMusicPlayer() {
  if (!musicPlayer || !musicPlayerReady || !musicState || !musicState.queue.length) return;
  const item = musicState.queue[0];
  const targetMs = targetPositionMs(musicState, Date.now(), musicState.receivedAt);

  markMusicCommand();
  if (musicLoadedItemId !== item.id) {
    musicLoadedItemId = item.id;
    musicLastSeekAt = null;
    const opts = { videoId: item.videoId, startSeconds: targetMs / 1000 };
    if (musicState.playing) musicPlayer.loadVideoById(opts);
    else musicPlayer.cueVideoById(opts);
    return;
  }

  const state = musicPlayer.getPlayerState();
  if (state === YT_STATE.ENDED) return; // aguardando o servidor avançar a fila
  // seekTo num vídeo só "cued" começa a tocar; pausado e cued já está no ponto certo
  const seekable = musicState.playing || state === YT_STATE.PAUSED;
  const now = Date.now();
  // Um seek corretivo por janela: com buffering lento, o PLAYING seguinte ao seek já chega atrasado
  if (seekable && shouldCorrectSeek(musicPlayer.getCurrentTime() * 1000, targetMs, musicLastSeekAt, now)) {
    musicLastSeekAt = now;
    musicPlayer.seekTo(targetMs / 1000, true);
  }
  const running = state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING;
  if (musicState.playing && !running) musicPlayer.playVideo();
  else if (!musicState.playing && running) musicPlayer.pauseVideo();
}

function onMusicPlayerStateChange(state) {
  if (!musicState || !musicState.queue.length) return;
  const current = musicState.queue[0];
  if (state === YT_STATE.ENDED) {
    // Vários clientes avisam; o servidor só avança se o item ainda for o atual
    if (musicLoadedItemId === current.id) socket.emit('music-ended', current.id);
    return;
  }
  // Clique no botão central do vídeo (pausar/tocar): vale para todos, como o botão do painel.
  // Mudanças logo depois de um comando do próprio Vox não contam como clique.
  const clickedPause = state === YT_STATE.PAUSED && musicState.playing;
  const clickedPlay = state === YT_STATE.PLAYING && !musicState.playing;
  if ((clickedPause || clickedPlay) && Date.now() >= musicCommandUntil && musicLoadedItemId === current.id) {
    markMusicCommand();
    socket.emit('music-toggle', { playing: clickedPlay });
    return;
  }
  // Ao começar a tocar confere o minuto (o carregamento do vídeo atrasa a posição);
  // qualquer outra divergência volta ao estado compartilhado.
  if (clickedPause || clickedPlay || state === YT_STATE.PLAYING) syncMusicPlayer();
}

function markMusicCommand() {
  musicCommandUntil = Date.now() + 2500;
}

function applyMusicState(pub) {
  if (!currentVoiceRoom) return; // música só para quem está na voz
  if (!pub || !Array.isArray(pub.queue) || pub.queue.length === 0) {
    musicState = null;
    destroyMusicPlayer();
    renderMusicPanel();
    return;
  }
  musicState = { ...pub, receivedAt: Date.now() };
  syncMusicTile();
  if (!musicPlayer) createMusicPlayer(); // onReady aplica o estado
  else syncMusicPlayer();
  renderMusicPanel();
}

// Sair da voz (ou trocar de canal): a música para para esta pessoa.
function resetMusic() {
  musicState = null;
  destroyMusicPlayer();
  renderMusicPanel();
}

/* ---------- Painel da música ---------- */
function isMusicPanelOpen() {
  return !musicPanel.classList.contains('hidden');
}

function openMusicPanel() {
  if (!currentVoiceRoom) return;
  closeSoundboard(); // os dois painéis ocupam o mesmo lugar
  musicPanel.classList.remove('hidden');
  btnMusic.setAttribute('aria-expanded', 'true');
  btnMusic.classList.add('primary');
  btnMusic.classList.remove('off');
  const vol = getMusicVolume();
  musicVolumeInput.value = String(vol);
  musicVolumeValue.textContent = String(vol);
  renderMusicPanel();
  if (musicTab === 'sugestoes') loadSuggestions();
  musicUrlInput.focus();
}

function closeMusicPanel() {
  musicPanel.classList.add('hidden');
  btnMusic.setAttribute('aria-expanded', 'false');
  btnMusic.classList.remove('primary');
  btnMusic.classList.add('off');
  musicErrorEl.textContent = '';
}

// Linha de música (fila ou sugestão): capa, título, detalhe e um botão.
function musicRow({ thumbnail, title, meta, current, button }) {
  const row = document.createElement('div');
  row.className = 'music-item' + (current ? ' current' : '');
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  if (thumbnail) img.src = thumbnail;
  const info = document.createElement('div');
  info.className = 'music-item-info';
  const t = document.createElement('div');
  t.className = 'music-item-title';
  t.textContent = title;
  t.title = title;
  const m = document.createElement('div');
  m.className = 'music-item-meta';
  m.textContent = meta;
  info.append(t, m);
  row.append(img, info, button);
  return row;
}

function musicButton(icon, title, onClick, extraClass) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'music-icon-btn' + (extraClass ? ' ' + extraClass : '');
  b.title = title;
  b.setAttribute('aria-label', title);
  VoxIcons.setIcon(b, icon, '', 14);
  b.addEventListener('click', onClick);
  return b;
}

// Fila, ⏯ e ⏭ conforme o último music-state (chamado a cada music-state).
function renderMusicPanel() {
  const queue = (musicState && musicState.queue) || [];
  musicQueueEl.replaceChildren(...queue.map((item, i) => {
    const by = `adicionada por ${item.addedBy || 'alguém'}`;
    const row = musicRow({
      thumbnail: item.thumbnail,
      title: item.title || item.videoId,
      meta: i === 0 ? `Tocando agora · ${by}` : by,
      current: i === 0,
      button: musicButton('x', 'Tirar da fila', () => socket.emit('music-remove', item.id))
    });
    row.dataset.itemId = item.id;
    return row;
  }));
  musicQueueCount.textContent = queue.length ? `(${queue.length})` : '';
  if (musicTab === 'sugestoes') scheduleSuggestions();
  musicEmptyEl.classList.toggle('hidden', queue.length > 0);
  musicToggleBtn.disabled = queue.length === 0;
  musicSkipBtn.disabled = queue.length === 0;
  musicToggleBtn.title = musicState && musicState.playing ? 'Pausar para todos' : 'Tocar para todos';
  VoxIcons.setIcon(musicToggleBtn, musicState && musicState.playing ? 'pause' : 'play');
}

/* ---------- Abas Fila / Sugestões ---------- */
const musicQueueCount = document.getElementById('music-queue-count');
const musicSuggestionsEl = document.getElementById('music-suggestions');
const musicSuggestionsEmpty = document.getElementById('music-suggestions-empty');
let musicTab = 'fila';
let suggestionsTimer = null;

function showMusicTab(name) {
  musicTab = name;
  document.querySelectorAll('.music-tab').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.music-tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'music-tab-' + name));
  if (name === 'sugestoes') loadSuggestions();
}
document.querySelectorAll('.music-tab').forEach((b) => b.addEventListener('click', () => showMusicTab(b.dataset.tab)));

// A fila mudou com a aba aberta: atualiza (uma vez a cada várias mudanças seguidas).
function scheduleSuggestions() {
  clearTimeout(suggestionsTimer);
  suggestionsTimer = setTimeout(loadSuggestions, 300);
}

function loadSuggestions() {
  if (!currentVoiceRoom || !isMusicPanelOpen()) return;
  socket.emit('music-suggestions', (res) => {
    if (!res || !res.ok || musicTab !== 'sugestoes') return;
    renderSuggestions(res);
  });
}

function addSuggestion(item, button) {
  button.disabled = true;
  socket.emit('music-add', `https://www.youtube.com/watch?v=${item.videoId}`, (res) => {
    if (res && res.ok) return; // a lista se atualiza com o music-state
    button.disabled = false;
    showToast((res && res.message) || 'Não foi possível adicionar a música');
  });
}

function suggestionRow(item, meta) {
  const button = item.inQueue
    ? musicButton('check', 'Já está na fila', () => {}, '')
    : musicButton('plus', 'Pôr na fila', () => addSuggestion(item, button), 'add');
  if (item.inQueue) button.disabled = true;
  return musicRow({ thumbnail: item.thumbnail, title: item.title || item.videoId, meta, button });
}

function renderSuggestions({ recent = [], top = [] }) {
  const nodes = [];
  const section = (text) => {
    const t = document.createElement('div');
    t.className = 'music-section';
    t.textContent = text;
    nodes.push(t);
  };
  if (top.length) {
    section('Mais pedidas');
    top.forEach((s) => nodes.push(suggestionRow(s, `pedida ${s.count}× · última por ${s.lastBy || 'alguém'}`)));
  }
  if (recent.length) {
    section('Tocadas recentemente');
    recent.forEach((s) => nodes.push(suggestionRow(s, `pedida por ${s.lastBy || 'alguém'}${s.count > 1 ? ` · ${s.count}×` : ''}`)));
  }
  musicSuggestionsEl.replaceChildren(...nodes);
  musicSuggestionsEmpty.classList.toggle('hidden', nodes.length > 0);
}

function submitMusicUrl() {
  const url = musicUrlInput.value.trim();
  if (!url || !currentVoiceRoom) return;
  musicErrorEl.textContent = '';
  socket.emit('music-add', url, (res) => {
    if (res && res.ok) {
      if (musicUrlInput.value.trim() === url) musicUrlInput.value = '';
    } else {
      musicErrorEl.textContent = (res && res.message) || 'Não foi possível adicionar a música';
    }
  });
}

btnMusic.addEventListener('click', () => {
  if (isMusicPanelOpen()) closeMusicPanel();
  else openMusicPanel();
});
musicPanelClose.addEventListener('click', closeMusicPanel);
musicUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitMusicUrl();
});
musicUrlInput.addEventListener('input', () => { musicErrorEl.textContent = ''; });
musicToggleBtn.addEventListener('click', () => socket.emit('music-toggle'));
musicSkipBtn.addEventListener('click', () => {
  if (musicState && musicState.queue.length) socket.emit('music-skip', musicState.queue[0].id);
});
// Volume só local: salva e aplica no player desta pessoa
musicVolumeInput.addEventListener('input', () => {
  const vol = Math.min(100, Math.max(0, Math.round(Number(musicVolumeInput.value) || 0)));
  localStorage.setItem('vox-music-volume', String(vol));
  musicVolumeValue.textContent = String(vol);
  if (musicPlayer && musicPlayerReady) musicPlayer.setVolume(vol);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isMusicPanelOpen() && fullscreenView.classList.contains('hidden')) closeMusicPanel();
});

let toastTimer = null;
function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 4000);
}

socket.on('music-state', (pub) => applyMusicState(pub));
socket.on('music-notice', (notice) => {
  if (notice && typeof notice.text === 'string') showToast(notice.text);
});

/* ================= VISUALIZAÇÃO EM TELA CHEIA ================= */
function openFullscreenView(stream, name) {
  if (!stream || !fullscreenView || !fullscreenVideo) return;
  const hasVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
  if (!hasVideo) return;

  fullscreenStream = stream;
  fullscreenName.textContent = name || 'Compartilhamento';
  fullscreenVideo.muted = true;
  fullscreenVideo.srcObject = stream;
  fullscreenView.classList.remove('hidden');
  fullscreenVideo.play().catch(() => {});
  relocateMusicPlayer(); // player da música vai para o canto da tela cheia

  const track = stream.getVideoTracks()[0];
  if (track) {
    track.addEventListener('ended', closeFullscreenView, { once: true });
    track.addEventListener('mute', () => {
      clearTimeout(fullscreenMuteTimer);
      fullscreenMuteTimer = setTimeout(() => {
        if (track.muted && fullscreenStream === stream) closeFullscreenView();
      }, 1800);
    });
    track.addEventListener('unmute', () => clearTimeout(fullscreenMuteTimer));
  }

  if (fullscreenView.requestFullscreen) {
    fullscreenView.requestFullscreen().catch(() => {});
  }
}

function closeFullscreenView() {
  clearTimeout(fullscreenMuteTimer);
  fullscreenMuteTimer = null;
  fullscreenStream = null;
  fullscreenMusicOnly = false;
  if (fullscreenVideo) fullscreenVideo.srcObject = null;
  if (fullscreenView) fullscreenView.classList.add('hidden');
  if (fullscreenView) fullscreenView.classList.remove('music-only');
  relocateMusicPlayer(); // de volta ao tile
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

if (fullscreenClose) fullscreenClose.addEventListener('click', closeFullscreenView);
if (fullscreenNative) {
  fullscreenNative.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (fullscreenView && fullscreenView.requestFullscreen) fullscreenView.requestFullscreen().catch(() => {});
  });
}
if (fullscreenVideo) fullscreenVideo.addEventListener('dblclick', closeFullscreenView);

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && (fullscreenStream || fullscreenMusicOnly)) closeFullscreenView();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (fullscreenStream || fullscreenMusicOnly) && !document.fullscreenElement) {
    closeFullscreenView();
  }
});

function buildTile(name, stream, opts = {}) {
  const tile = document.createElement('div');
  tile.className = 'tile' + (opts.mirrored ? ' mirrored' : '');
  const peerKey = opts.username || name;
  if (opts.remote) tile.dataset.peerKey = peerKey;

  const hasVideo = !!(
    stream &&
    stream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted)
  );

  if (stream && hasVideo) {
    // Reaproveita o <video> do render anterior: recriar reinicia a reprodução
    // e deixa o quadro preto até chegar o próximo keyframe.
    let video = videoElements.get(stream.id);
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      videoElements.set(stream.id, video);
    }
    usedVideoIds.add(stream.id);
    video.muted = !!opts.muted;
    video.volume = getPeerVolume(peerKey);
    video.classList.toggle('remote-video', !!opts.remote);
    tile.appendChild(video);
  } else {
    if (stream && opts.remote) {
      // Participante com câmera desligada: mantém o áudio e mostra o avatar.
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.volume = getPeerVolume(peerKey);
      audio.srcObject = stream;
      audio.className = 'remote-audio';
      audio.style.display = 'none';
      tile.appendChild(audio);
    }
    tile.appendChild(makeAvatar(name));
  }

  const actions = document.createElement('div');
  actions.className = 'tile-actions';

  if (stream && hasVideo) {
    const fullBtn = document.createElement('button');
    fullBtn.className = 'tile-btn';
    fullBtn.title = 'Ver em tela cheia';
    VoxIcons.setIcon(fullBtn, 'maximize', '', 16);
    fullBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openFullscreenView(stream, name);
    });
    actions.appendChild(fullBtn);
    tile.addEventListener('dblclick', () => openFullscreenView(stream, name));
  }

  if (opts.remote) {
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.className = 'tile-volume';
    vol.title = 'Volume deste usuário';
    vol.value = String(Math.round(getPeerVolume(peerKey) * 100));
    vol.addEventListener('input', (ev) => {
      ev.stopPropagation();
      setPeerVolume(peerKey, Number(vol.value) / 100);
    });
    vol.addEventListener('click', (ev) => ev.stopPropagation());
    actions.appendChild(vol);
  }

  if (actions.children.length) tile.appendChild(actions);

  const label = document.createElement('div');
  label.className = 'tile-name';
  label.textContent = name + (opts.badge ? '' : '');
  tile.appendChild(label);

  if (opts.badge) {
    const badge = document.createElement('div');
    badge.className = 'tile-badge';
    badge.textContent = opts.badge;
    tile.appendChild(badge);
  }

  return tile;
}

/* ================= ÁUDIO / ANALISADOR ================= */
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

/* ================= EFEITOS SONOROS ================= */
// Contexto próprio (o audioContext da chamada é fechado ao sair da voz) tocando
// num <audio>, para seguir a saída escolhida via setSinkId.
let soundEffectsEnabled = VoxSounds.isEnabled(localStorage.getItem(VoxSounds.STORAGE_KEY));
let soundContext = null;
let soundDestination = null;
let soundRoster = null; // ids da última lista da voz; null até a primeira depois de entrar
const soundAudio = document.getElementById('sound-effects-audio');

// Saída dos sons do app (efeitos e soundboard): contexto próprio no dispositivo de saída escolhido.
function ensureSoundOutput() {
  if (!soundContext) {
    soundContext = new (window.AudioContext || window.webkitAudioContext)();
    soundDestination = soundContext.createMediaStreamDestination();
    soundAudio.srcObject = soundDestination.stream;
    if (typeof soundAudio.setSinkId === 'function') soundAudio.setSinkId(audioOutputId || '').catch(() => {});
  }
  if (soundContext.state === 'suspended') soundContext.resume();
  soundAudio.play().catch(() => {});
  return { ctx: soundContext, dest: soundDestination };
}

function playSoundEffect(name) {
  if (!soundEffectsEnabled) return;
  try {
    const { ctx, dest } = ensureSoundOutput();
    VoxSounds.playSound(ctx, dest, name);
  } catch (e) {
    console.error('Erro ao tocar efeito sonoro:', e);
  }
}

/* ================= REDUÇÃO DE RUÍDO DO MICROFONE ================= */
// Cadeia: microfone → volume → [passa-alta/passa-baixa] → gate (sensibilidade) → [compressor] → faixa enviada.
// A lógica do gate fica em mic-gate.js (createGate), testada no Node e copiada para o worklet.
const NOISE_GATE_WORKLET = `
const createGate = ${window.VoxMicGate.createGate.toString()};
class VoxMicGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.gate = createGate(sampleRate);
    this.params = null;
    this.blocks = 0;
    this.port.onmessage = (e) => { this.params = e.data; };
  }
  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!input || !output || !this.params) return true;
    const s = this.gate.processBlock(input, output, this.params);
    // Nível para o medidor das configurações, ~20 vezes por segundo
    if (++this.blocks % 18 === 0) this.port.postMessage({ levelDb: s.levelDb, thresholdDb: s.thresholdDb, open: s.open });
    return true;
  }
}
registerProcessor('vox-mic-gate', VoxMicGate);
`;

async function ensureNoiseGateWorklet(ctx) {
  if (noiseGateContexts.has(ctx)) return;
  const blob = new Blob([NOISE_GATE_WORKLET], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await ctx.audioWorklet.addModule(url);
    noiseGateContexts.add(ctx);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function currentGateParams() {
  return window.VoxMicGate.gateParams({ auto: micAuto, thresholdDb: micThresholdDb, mode: noiseSuppressionMode });
}

function sendGateParams() {
  if (micPipeline && micPipeline.gate) micPipeline.gate.port.postMessage(currentGateParams());
}

function destroyMicProcessing() {
  if (micProcessedTrack) {
    try { micProcessedTrack.stop(); } catch (e) {}
    micProcessedTrack = null;
  }
  if (micPipeline) {
    for (const node of micPipeline.nodes) { try { node.disconnect(); } catch (e) {} }
    if (micPipeline.gate) micPipeline.gate.port.onmessage = null;
    micPipeline = null;
  }
  renderMicMeter(null);
}

function getOutboundAudioTracks() {
  if (micProcessedTrack && micProcessedTrack.readyState === 'live') return [micProcessedTrack];
  if (localStream) return localStream.getAudioTracks();
  return [];
}

async function rebuildMicProcessing() {
  destroyMicProcessing();
  if (!localStream) return;
  const rawTrack = localStream.getAudioTracks()[0];
  if (!rawTrack) return;

  try {
    const ctx = ensureAudioContext();
    const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));
    const nodes = [source];
    const chain = (node) => { nodes[nodes.length - 1].connect(node); nodes.push(node); return node; };

    const inputGain = chain(ctx.createGain());
    inputGain.gain.value = micGainPercent / 100;

    if (noiseSuppressionMode !== 'off') {
      const highpass = chain(ctx.createBiquadFilter());
      highpass.type = 'highpass';
      highpass.frequency.value = noiseSuppressionMode === 'strong' ? 100 : 80;
      highpass.Q.value = 0.7;
      if (noiseSuppressionMode === 'strong') {
        const lowpass = chain(ctx.createBiquadFilter()); // corta chiado acima da voz
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 9000;
        lowpass.Q.value = 0.7;
      }
    }

    let gate = null;
    try {
      await ensureNoiseGateWorklet(ctx);
      gate = new AudioWorkletNode(ctx, 'vox-mic-gate', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      gate.port.postMessage(currentGateParams());
      gate.port.onmessage = (e) => renderMicMeter(e.data);
      chain(gate);
    } catch (e) {
      console.warn('Gate do microfone indisponível, seguindo sem ele:', e);
      gate = null;
    }

    if (noiseSuppressionMode !== 'off') {
      const compressor = chain(ctx.createDynamicsCompressor());
      compressor.threshold.value = -26;
      compressor.knee.value = 24;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      chain(ctx.createGain()).gain.value = 1.25; // repõe o volume tirado pelo compressor
    }

    const dest = ctx.createMediaStreamDestination();
    dest.channelCount = 1;
    dest.channelCountMode = 'explicit';
    nodes[nodes.length - 1].connect(dest);

    micPipeline = { nodes, inputGain, gate, dest };
    micProcessedTrack = dest.stream.getAudioTracks()[0];
  } catch (e) {
    console.warn('Falha ao criar processamento de áudio:', e);
    destroyMicProcessing();
  }
}

function replaceAudioTrackOnPeers() {
  const outTrack = getOutboundAudioTracks()[0];
  if (!outTrack) return;
  peers.forEach((pc) => {
    const transceiver = pc.getTransceivers().find(
      (t) => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio'
    );
    if (transceiver && transceiver.sender) transceiver.sender.replaceTrack(outTrack);
    else if (localStream) pc.addTrack(outTrack, localStream);
    else pc.addTrack(outTrack);
  });
}

// Medidor da sensibilidade: barra do nível (verde com o gate aberto) e linha do limite.
function renderMicMeter(m) {
  if (!micMeterEl || settingsModal.classList.contains('hidden')) return;
  const { meterPercent } = window.VoxMicGate;
  const threshold = m ? m.thresholdDb : micThresholdDb;
  micMeterLevel.style.width = (m ? meterPercent(m.levelDb) : 0) + '%';
  micMeterThreshold.style.left = `calc(${meterPercent(threshold)}% - 1px)`;
  micMeterEl.classList.toggle('open', !!(m && m.open));
  // No automático, o controle acompanha o limite calculado.
  if (m && micAuto) micThresholdInput.value = String(Math.round(threshold));
}

function applyNoiseSuppressionUI() {
  if (noiseSuppressionSelect) noiseSuppressionSelect.value = noiseSuppressionMode;
  micGainInput.value = String(micGainPercent);
  micGainValueEl.textContent = String(micGainPercent);
  micAutoToggle.checked = micAuto;
  micThresholdInput.disabled = micAuto;
  if (!micAuto) micThresholdInput.value = String(micThresholdDb);
  renderMicMeter(null);
}

function setupAnalyser(id, stream) {
  try {
    if (!stream.getAudioTracks().length) return;
    if (analysers.has(id)) return;
    const ctx = ensureAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analysers.set(id, analyser);
  } catch (e) {
    console.warn('Não foi possível criar analisador:', e);
  }
}

// Analisa a faixa que é enviada aos outros (já com redução de ruído).
// Refeito quando a faixa muda (troca de microfone ou de modo de ruído).
function getLocalAnalyser() {
  const track = getOutboundAudioTracks()[0];
  if (!track) return null;
  if (!localAnalyser || localAnalyser.trackId !== track.id) {
    try {
      const ctx = ensureAudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
      localAnalyser = { trackId: track.id, analyser };
    } catch (e) {
      console.warn('Não foi possível analisar o microfone:', e);
      return null;
    }
  }
  return localAnalyser.analyser;
}

// Anel de "falando" nos avatares do canal de voz atual
function updateSpeakingRings() {
  const { levelFromAnalyser, createSpeakingState, updateSpeaking } = window.VoxSpeaking;
  const now = performance.now();
  const levels = new Map();
  analysers.forEach((analyser, id) => levels.set(id, levelFromAnalyser(analyser)));
  const mine = micEnabled ? getLocalAnalyser() : null;
  levels.set(socket.id, mine ? levelFromAnalyser(mine) : 0);

  levels.forEach((level, id) => {
    let state = speakingStates.get(id);
    if (!state) { state = createSpeakingState(); speakingStates.set(id, state); }
    const was = state.speaking;
    if (updateSpeaking(state, level, now) === was) return;
    document.querySelectorAll(`.voice-user[data-id="${CSS.escape(id)}"]`)
      .forEach((el) => el.classList.toggle('speaking', state.speaking));
  });
  speakingStates.forEach((_, id) => { if (!levels.has(id)) speakingStates.delete(id); });
}

function startAudioLoop() {
  if (rafId) return;
  const loop = () => {
    if (currentVoiceRoom) updateSpeakingRings();
    rafId = requestAnimationFrame(loop);
  };
  loop();
}

/* ================= TEMAS ================= */
const themeGrid = document.getElementById('theme-grid');
let themeStorage = null;
try { themeStorage = window.localStorage; } catch (e) {}

function buildThemeOption(theme, currentId) {
  const { themeCssVars, applyTheme, saveThemeId } = window.VoxThemes;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-option' + (theme.id === currentId ? ' selected' : '');
  btn.dataset.themeId = theme.id;
  btn.setAttribute('aria-pressed', String(theme.id === currentId));

  const thumb = document.createElement('div');
  thumb.className = 'theme-thumb';
  thumb.dataset.preview = theme.id;
  const vars = themeCssVars(theme);
  Object.keys(vars).forEach((k) => thumb.style.setProperty(k, vars[k]));
  thumb.innerHTML = `
    <div class="tt-rail"></div>
    <div class="tt-chs"><div class="tt-ch"></div><div class="tt-ch on"></div><div class="tt-ch"></div></div>
    <div class="tt-main"><div class="tt-line"></div><div class="tt-line link"></div><div class="tt-btn"></div></div>`;
  btn.appendChild(thumb);

  const name = document.createElement('span');
  name.className = 'theme-name';
  name.textContent = theme.name;
  btn.appendChild(name);

  btn.addEventListener('click', () => {
    const applied = applyTheme(theme.id);
    saveThemeId(themeStorage, applied);
    themeGrid.querySelectorAll('.theme-option').forEach((el) => {
      const on = el.dataset.themeId === applied;
      el.classList.toggle('selected', on);
      el.setAttribute('aria-pressed', String(on));
    });
  });
  return btn;
}

const reduceMotionBox = document.getElementById('reduce-motion');
if (reduceMotionBox && window.VoxThemes) {
  reduceMotionBox.checked = window.VoxThemes.loadReduceMotion(themeStorage);
  reduceMotionBox.addEventListener('change', () => {
    window.VoxThemes.saveReduceMotion(themeStorage, reduceMotionBox.checked);
    window.VoxThemes.applyReduceMotion(reduceMotionBox.checked);
  });
}

function renderThemePicker() {
  if (!themeGrid || !window.VoxThemes) return;
  const currentId = document.documentElement.dataset.theme || window.VoxThemes.DEFAULT_THEME_ID;
  themeGrid.innerHTML = '';
  window.VoxThemes.THEME_GROUPS.forEach(([group, label]) => {
    const title = document.createElement('div');
    title.className = 'theme-group-title';
    title.textContent = label;
    const row = document.createElement('div');
    row.className = 'theme-row';
    row.dataset.group = group;
    window.VoxThemes.THEMES.filter((t) => t.group === group)
      .forEach((t) => row.appendChild(buildThemeOption(t, currentId)));
    themeGrid.append(title, row);
  });
}

// Abas das configurações (Aparência / Áudio)
function showSettingsTab(name) {
  document.querySelectorAll('.settings-tab').forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.settings-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== 'settings-tab-' + name);
  });
}

document.querySelectorAll('.settings-tab').forEach((btn) => {
  btn.addEventListener('click', () => showSettingsTab(btn.dataset.tab));
});

/* ================= FOTO DE PERFIL ================= */
const accountAvatar = document.getElementById('account-avatar');
const avatarChangeBtn = document.getElementById('avatar-change');
const avatarRemoveBtn = document.getElementById('avatar-remove');
const avatarInput = document.getElementById('avatar-input');

function renderAccountAvatar() {
  if (!currentUser) return;
  applyAvatar(accountAvatar, currentUser);
  avatarRemoveBtn.disabled = !avatarFiles.has(currentUser);
}

// Recorta o centro em quadrado e reduz para 256 px em WebP (GIF vira imagem parada).
async function prepareAvatar(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Escolha uma imagem (PNG, JPG, WebP ou GIF).');
  const bitmap = await createImageBitmap(file);
  const { sx, sy, size } = VoxChat.centerSquare(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = VoxChat.AVATAR_SIZE;
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, sx, sy, size, size, 0, 0, VoxChat.AVATAR_SIZE, VoxChat.AVATAR_SIZE);
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.65]) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', quality));
    if (blob && blob.size <= VoxChat.MAX_AVATAR_BYTES) return { data: await blob.arrayBuffer(), type: 'image/webp' };
  }
  throw new Error('Não foi possível reduzir essa imagem.');
}

function sendAvatar(image) {
  settingsError.textContent = '';
  if (!socket.connected) { settingsError.textContent = 'Sem conexão com o servidor.'; return; }
  avatarChangeBtn.disabled = true;
  avatarRemoveBtn.disabled = true;
  socket.timeout(20000).emit('set-avatar', image, (err, res) => {
    avatarChangeBtn.disabled = false;
    if (err || !res || !res.success) settingsError.textContent = (res && res.message) || 'Não foi possível trocar a foto.';
    // A foto nova chega para todos (inclusive aqui) pelo 'server-members'.
    renderAccountAvatar();
  });
}

avatarChangeBtn.addEventListener('click', () => avatarInput.click());
avatarInput.addEventListener('change', async () => {
  const file = avatarInput.files && avatarInput.files[0];
  avatarInput.value = '';
  if (!file) return;
  try {
    sendAvatar(await prepareAvatar(file));
  } catch (e) {
    settingsError.textContent = e.message || 'Não foi possível usar essa imagem.';
  }
});
avatarRemoveBtn.addEventListener('click', () => {
  if (window.confirm('Remover sua foto de perfil?')) sendAvatar(null);
});

/* ================= TÚNEL (ABRIR PARA AMIGOS) ================= */
// Só faz sentido no PC que hospeda: o túnel aponta para o servidor deste processo.
const IS_LOCAL_SERVER = !GIST_REF && /^https?:\/\/(127\.0\.0\.1|localhost)(:3000)?$/i.test(SERVER_INPUT);
let tunnelState = { state: 'off', url: null };

function renderTunnel(s) {
  tunnelState = s || { state: 'off', url: null };
  const labels = {
    off: 'Fechado',
    downloading: `Baixando o cloudflared… ${Math.round((tunnelState.progress || 0) * 100)}%`,
    starting: tunnelState.message || 'Abrindo…',
    on: 'Aberto',
    error: tunnelState.message || 'Falhou'
  };
  tunnelStateEl.textContent = IS_LOCAL_SERVER ? (labels[tunnelState.state] || '') : 'Disponível só no PC que hospeda o servidor (endereço 127.0.0.1).';
  tunnelStateEl.dataset.state = tunnelState.state;
  const active = ['downloading', 'starting', 'on'].includes(tunnelState.state);
  tunnelToggle.querySelector('span').textContent = active ? 'Fechar túnel' : 'Abrir para amigos';
  tunnelToggle.disabled = !IS_LOCAL_SERVER;
  tunnelUrlRow.classList.toggle('hidden', !tunnelState.url);
  tunnelUrlInput.value = tunnelState.url || '';
}

tunnelToggle.addEventListener('click', async () => {
  const active = ['downloading', 'starting', 'on'].includes(tunnelState.state);
  renderTunnel(active ? await window.electronAPI.tunnelStop() : { state: 'starting', url: null });
  if (!active) window.electronAPI.tunnelStart();
});
tunnelCopy.addEventListener('click', async () => {
  if (!tunnelState.url) return;
  try {
    await navigator.clipboard.writeText(tunnelState.url);
    showToast('Endereço copiado. Mande para o seu amigo.');
  } catch (e) {
    tunnelUrlInput.select();
  }
});
window.electronAPI.onTunnelStatus(renderTunnel);
window.electronAPI.tunnelStatus().then(renderTunnel);

/* ---------- Link fixo (host): grava o endereço do túnel num Gist ---------- */
const tunnelAuto = document.getElementById('tunnel-auto');
const addressSetup = document.getElementById('address-setup');
const addressReady = document.getElementById('address-ready');
const addressToken = document.getElementById('address-token');
const addressConnectBtn = document.getElementById('address-connect');
const addressError = document.getElementById('address-error');
const addressLinkInput = document.getElementById('address-link');
const addressStateEl = document.getElementById('address-state');
let addressState = null;

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderAddress(s) {
  addressState = s || addressState;
  if (!addressState) return;
  const local = IS_LOCAL_SERVER;
  tunnelAuto.checked = !!addressState.autoTunnel;
  tunnelAuto.disabled = !local;
  addressSetup.classList.toggle('hidden', addressState.connected);
  addressReady.classList.toggle('hidden', !addressState.connected);
  addressToken.disabled = !local;
  addressConnectBtn.disabled = !local;
  addressLinkInput.value = addressState.link || '';
  const p = addressState.publish || { state: 'idle' };
  const labels = {
    idle: 'Esperando o túnel abrir para gravar o endereço.',
    publishing: 'Gravando o endereço atual no Gist…',
    ok: p.at ? `Endereço atual gravado às ${formatTime(p.at)}.` : 'Endereço atual gravado.',
    error: p.message || 'Não foi possível gravar o endereço.'
  };
  addressStateEl.textContent = labels[p.state] || '';
  addressStateEl.dataset.state = p.state === 'ok' ? 'on' : p.state;
}

tunnelAuto.addEventListener('change', async () => {
  renderAddress(await window.electronAPI.setAutoTunnel(tunnelAuto.checked));
});
document.getElementById('address-token-page').addEventListener('click', () => window.electronAPI.openTokenPage());
async function connectAddress() {
  addressError.textContent = '';
  addressConnectBtn.disabled = true;
  addressConnectBtn.textContent = 'Conectando…';
  const res = await window.electronAPI.addressConnect(addressToken.value);
  addressConnectBtn.textContent = 'Conectar';
  addressConnectBtn.disabled = false;
  if (!res.ok) {
    addressError.textContent = res.message;
    return;
  }
  addressToken.value = '';
  renderAddress(res.status);
  showToast('Link fixo pronto. Mande para os seus amigos uma única vez.');
  if (res.status.autoTunnel && !['downloading', 'starting', 'on'].includes(tunnelState.state)) {
    renderTunnel({ state: 'starting', url: null });
    window.electronAPI.tunnelStart();
  }
}
addressConnectBtn.addEventListener('click', connectAddress);
addressToken.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectAddress(); });
document.getElementById('address-copy').addEventListener('click', async () => {
  if (!addressState || !addressState.link) return;
  try {
    await navigator.clipboard.writeText(addressState.link);
    showToast('Link fixo copiado. Seu amigo cola no campo Servidor do login.');
  } catch (e) {
    addressLinkInput.select();
  }
});
document.getElementById('address-disconnect').addEventListener('click', async () => {
  if (!window.confirm('Desconectar o link fixo? O Vox para de atualizar o Gist e seus amigos voltam a precisar do endereço novo toda vez que o túnel abrir.')) return;
  renderAddress(await window.electronAPI.addressDisconnect());
});
window.electronAPI.onAddressStatus(renderAddress);
window.electronAPI.addressStatus().then(renderAddress);

/* ================= ATUALIZAÇÃO AUTOMÁTICA ================= */
// A faixa aparece na tela principal e, no login, uma cópia dela no cartão de entrada.
const authUpdate = document.getElementById('auth-update');
const UPDATE_STATES = ['downloading', 'ready', 'installing', 'error'];

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: bytes < 10 * 1024 * 1024 ? 1 : 0 });
}

function updateMessage(s) {
  const v = s.version ? `o Vox ${s.version}` : 'a atualização';
  if (s.state === 'downloading') {
    const pct = Math.floor(s.percent || 0);
    const parts = [`Baixando ${v}… ${pct}%`];
    if (s.total) parts.push(`${formatMB(s.transferred || 0)} de ${formatMB(s.total)} MB`);
    if (s.bytesPerSecond) parts.push(`${formatMB(s.bytesPerSecond)} MB/s`);
    return parts.join(' · ');
  }
  if (s.state === 'ready') return `Pronto: clique em Reiniciar e atualizar para instalar ${v}.`;
  if (s.state === 'installing') return `Instalando ${v}… o Vox fecha e abre de novo sozinho.`;
  return `Não foi possível baixar ${v}. O Vox tenta de novo mais tarde.`;
}

function renderUpdate(s) {
  const show = !!s && UPDATE_STATES.includes(s.state);
  updateBanner.classList.toggle('hidden', !show);
  authUpdate.classList.toggle('hidden', !show);
  if (!show) return;
  const text = updateMessage(s);
  // Barra: avança no download, cheia quando pronto ou instalando, some no erro.
  const percent = s.state === 'downloading' ? (s.percent || 0) : 100;
  for (const box of [updateBanner, authUpdate]) {
    box.classList.toggle('warn', s.state === 'error');
    box.querySelector('[data-update-text]').textContent = text;
    const bar = box.querySelector('[data-update-progress]');
    bar.classList.toggle('hidden', s.state === 'error');
    bar.setAttribute('aria-valuenow', String(Math.floor(percent)));
    bar.querySelector('.update-progress-fill').style.width = `${percent}%`;
  }
  updateInstall.classList.toggle('hidden', s.state !== 'ready');
}
updateInstall.addEventListener('click', () => {
  const hosting = IS_LOCAL_SERVER && serverMembers.some((m) => m.online && m.username !== currentUser);
  if (hosting && !window.confirm('Você hospeda o servidor: reiniciar desconecta todo mundo por alguns segundos. Continuar?')) return;
  window.electronAPI.installUpdate();
});
window.electronAPI.onUpdateStatus(renderUpdate);
window.electronAPI.updateStatus().then(renderUpdate);

/* ================= DISPOSITIVOS DE ÁUDIO ================= */
function fillDeviceSelect(select, devices, savedId, defaultLabel) {
  select.innerHTML = '';

  const def = document.createElement('option');
  def.value = 'default';
  def.textContent = defaultLabel;
  select.appendChild(def);

  devices.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || `Dispositivo ${i + 1}`;
    select.appendChild(opt);
  });

  select.value = savedId && [...select.options].some((o) => o.value === savedId) ? savedId : 'default';
}

async function refreshDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    fillDeviceSelect(
      inputDeviceSelect,
      devices.filter((d) => d.kind === 'audioinput'),
      audioInputId,
      'Padrão do sistema'
    );
    fillDeviceSelect(
      outputDeviceSelect,
      devices.filter((d) => d.kind === 'audiooutput'),
      audioOutputId,
      'Padrão do sistema'
    );
  } catch (e) {
    settingsError.textContent = 'Não foi possível listar os dispositivos.';
  }
}

// stopFirst: fecha o microfone atual antes de abrir de novo. Necessário quando muda a
// redução de ruído do navegador: com o mesmo dispositivo ainda aberto, o Chromium
// devolve a faixa nova com o processamento antigo (medido).
async function changeInputDevice(id, { stopFirst = false } = {}) {
  settingsError.textContent = '';
  // Fora da voz só a preferência é gravada; ela vale na próxima entrada em voz.
  if (!currentVoiceRoom) return;
  const leaves = voiceLeaves;
  if (stopFirst && localStream) {
    localStream.getAudioTracks().forEach((t) => { t.stop(); localStream.removeTrack(t); });
  }
  try {
    const constraints = { audio: micAudioConstraints(id) };
    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    const newTrack = newStream.getAudioTracks()[0];
    if (!newTrack) return;
    if (leaves !== voiceLeaves || !currentVoiceRoom) {
      newStream.getTracks().forEach((t) => t.stop()); // saiu da voz enquanto o microfone abria
      return;
    }

    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.stop();
        localStream.removeTrack(t);
      });
      localStream.addTrack(newTrack);
    } else {
      localStream = new MediaStream([newTrack]);
    }

    newTrack.enabled = micEnabled;

    await rebuildMicProcessing();
    replaceAudioTrackOnPeers();

    updateMonitor();
    updateControlButtons();
    await refreshDevices();
  } catch (e) {
    console.error('Erro ao trocar microfone:', e);
    settingsError.textContent = 'Não foi possível usar esse microfone.';
    await refreshDevices();
  }
}

async function applyOutputDevice() {
  const targets = [...document.querySelectorAll('.remote-video, .remote-audio')];
  if (monitorAudio) targets.push(monitorAudio);
  targets.push(soundAudio);

  for (const el of targets) {
    if (typeof el.setSinkId !== 'function') continue;
    try {
      await el.setSinkId(audioOutputId || '');
    } catch (e) {
      // Dispositivo indisponível: mantém a saída padrão
    }
  }
}

function updateMonitor() {
  if (!monitorAudio) return;

  const outbound = getOutboundAudioTracks();
  if (!monitorEnabled || outbound.length === 0) {
    monitorAudio.srcObject = null;
    return;
  }

  monitorAudio.srcObject = new MediaStream(outbound);
  monitorAudio.play().catch(() => {});
  applyOutputDevice();
}

// Eventos da janela de configurações
btnSettings.addEventListener('click', async () => {
  statusMenu.classList.add('hidden');
  settingsError.textContent = '';
  renderThemePicker();
  document.getElementById('account-name').textContent = currentUser || '—';
  renderAccountAvatar();
  showSettingsTab('audio');
  settingsModal.classList.remove('hidden');
  monitorToggle.checked = monitorEnabled;
  soundEffectsToggle.checked = soundEffectsEnabled;
  applyNoiseSuppressionUI();
  await refreshDevices();
});

settingsClose.addEventListener('click', () => settingsModal.classList.add('hidden'));

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

inputDeviceSelect.addEventListener('change', async () => {
  audioInputId = inputDeviceSelect.value === 'default' ? '' : inputDeviceSelect.value;
  localStorage.setItem('audioInputId', audioInputId);
  await changeInputDevice(audioInputId);
});

outputDeviceSelect.addEventListener('change', async () => {
  audioOutputId = outputDeviceSelect.value === 'default' ? '' : outputDeviceSelect.value;
  localStorage.setItem('audioOutputId', audioOutputId);
  await applyOutputDevice();
});

monitorToggle.addEventListener('change', () => {
  monitorEnabled = monitorToggle.checked;
  localStorage.setItem('monitorEnabled', monitorEnabled ? '1' : '0');
  updateMonitor();
});

soundEffectsToggle.addEventListener('change', () => {
  soundEffectsEnabled = soundEffectsToggle.checked;
  localStorage.setItem(VoxSounds.STORAGE_KEY, soundEffectsEnabled ? '1' : '0');
});

if (noiseSuppressionSelect) {
  noiseSuppressionSelect.addEventListener('change', async () => {
    noiseSuppressionMode = noiseSuppressionSelect.value;
    localStorage.setItem('vox-noise-suppression', noiseSuppressionMode);
    applyNoiseSuppressionUI();
    // A redução do navegador é escolhida ao abrir o microfone: reabre com a nova opção.
    if (currentVoiceRoom && localStream) await changeInputDevice(audioInputId, { stopFirst: true });
  });
}

micGainInput.addEventListener('input', () => {
  micGainPercent = clampNumber(micGainInput.value, 0, 200, 100);
  localStorage.setItem('vox-mic-gain', String(micGainPercent));
  micGainValueEl.textContent = String(micGainPercent);
  if (micPipeline) micPipeline.inputGain.gain.setTargetAtTime(micGainPercent / 100, micPipeline.inputGain.context.currentTime, 0.02);
});

micAutoToggle.addEventListener('change', () => {
  micAuto = micAutoToggle.checked;
  localStorage.setItem('vox-mic-auto', micAuto ? '1' : '0');
  // Ao sair do automático, começa do limite que ele estava usando.
  if (!micAuto) {
    micThresholdDb = clampNumber(micThresholdInput.value, -70, -10, -50);
    localStorage.setItem('vox-mic-threshold', String(micThresholdDb));
  }
  applyNoiseSuppressionUI();
  sendGateParams();
});

micThresholdInput.addEventListener('input', () => {
  micThresholdDb = clampNumber(micThresholdInput.value, -70, -10, -50);
  localStorage.setItem('vox-mic-threshold', String(micThresholdDb));
  sendGateParams();
  renderMicMeter(null);
});

applyNoiseSuppressionUI();

clearMyMessages.addEventListener('click', () => {
  if (!currentTextRoom) {
    settingsError.textContent = 'Entre em um canal primeiro.';
    return;
  }
  if (!window.confirm('Apagar todas as suas mensagens deste canal?')) return;

  socket.emit('delete-my-messages', { room: currentTextRoom }, (res) => {
    if (res && res.success) {
      settingsError.textContent = `${res.count} mensagem(ns) apagada(s).`;
    }
  });
});

/* ================= MIC / CAM ================= */
function toggleMic() {
  micEnabled = !micEnabled;
  if (localStream) {
    localStream.getAudioTracks().forEach((t) => { t.enabled = micEnabled; });
  }
  if (micProcessedTrack) micProcessedTrack.enabled = micEnabled;
  playSoundEffect(VoxSounds.soundFor(!micEnabled));
  updateControlButtons();
  sendStatus();
  renderMembers();
}

btnMic.addEventListener('click', toggleMic);
btnMicMini.addEventListener('click', toggleMic);

async function enableCamera() {
  const leaves = voiceLeaves;
  // Saiu da voz enquanto a câmera abria: desliga o que chegou.
  const voiceGone = (stream) => {
    if (leaves === voiceLeaves && currentVoiceRoom && localStream) return false;
    stream.getTracks().forEach((t) => t.stop());
    return true;
  };

  if (!localStream) {
    try {
      const camOnly = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 }
      });
      if (leaves !== voiceLeaves || !currentVoiceRoom || localStream) {
        camOnly.getTracks().forEach((t) => t.stop());
        return false;
      }
      localStream = new MediaStream([camOnly.getVideoTracks()[0]]);
    } catch (e) {
      console.warn('Não foi possível acessar a câmera:', e);
      return false;
    }
  }

  const existing = localStream.getVideoTracks()[0];
  if (existing) {
    existing.enabled = true;
    return true;
  }

  try {
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, frameRate: 30 }
    });
    if (voiceGone(camStream)) return false;
    const track = camStream.getVideoTracks()[0];
    if (!track) return false;

    localStream.addTrack(track);

    // Se estiver compartilhando tela, a câmera fica pronta para quando parar.
    if (!sharingScreen) {
      peers.forEach((pc) => {
        const transceiver = getVideoTransceiver(pc);
        if (transceiver && transceiver.sender) transceiver.sender.replaceTrack(track);
        else pc.addTrack(track, localStream);
      });
    }
    return true;
  } catch (e) {
    console.warn('Não foi possível ligar a câmera:', e);
    return false;
  }
}

function disableCamera() {
  if (!localStream) return;

  localStream.getVideoTracks().forEach((t) => {
    t.stop();
    localStream.removeTrack(t);
  });

  if (!sharingScreen) {
    peers.forEach((pc) => {
      const transceiver = getVideoTransceiver(pc);
      if (transceiver && transceiver.sender) transceiver.sender.replaceTrack(null);
    });
  }
}

btnCam.addEventListener('click', async () => {
  if (!currentVoiceRoom || pendingCam) return;
  pendingCam = true;
  updateVoiceDependentControls();
  try {
    if (camEnabled) {
      camEnabled = false;
      disableCamera();
    } else {
      camEnabled = await enableCamera();
    }
  } finally {
    pendingCam = false;
    updateVoiceDependentControls();
    updateControlButtons();
    renderTiles();
  }
});

/* ================= COMPARTILHAMENTO DE TELA ================= */

const SHARE_RESOLUTIONS = {
  '480': { width: 854, height: 480 },
  '720': { width: 1280, height: 720 },
  '1080': { width: 1920, height: 1080 }
};

function currentShareVideoConstraints() {
  const res = SHARE_RESOLUTIONS[shareResolution] || SHARE_RESOLUTIONS['1080'];
  return {
    width: { ideal: res.width, max: res.width },
    height: { ideal: res.height, max: res.height },
    frameRate: { ideal: shareFps, max: shareFps }
  };
}

function applyShareQualityUI() {
  if (shareResolutionSelect) shareResolutionSelect.value = shareResolution;
  if (shareFpsSelect) shareFpsSelect.value = String(shareFps);
}

if (shareResolutionSelect) {
  shareResolutionSelect.addEventListener('change', () => {
    shareResolution = shareResolutionSelect.value;
    localStorage.setItem('vox-share-resolution', shareResolution);
  });
}

if (shareFpsSelect) {
  shareFpsSelect.addEventListener('change', () => {
    shareFps = Number(shareFpsSelect.value) === 60 ? 60 : 30;
    localStorage.setItem('vox-share-fps', String(shareFps));
  });
}

applyShareQualityUI();

btnScreen.addEventListener('click', async () => {
  if (sharingScreen) { stopScreenShare(); return; }
  if (!currentVoiceRoom || pendingShare) return;

  pendingShare = true;
  updateVoiceDependentControls();
  const leaves = voiceLeaves;

  try {
    ensureAudioContext();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: currentShareVideoConstraints(),
      // O áudio só vem se marcado no seletor (main.js). restrictOwnAudio tira do
      // loopback tudo que o próprio Vox toca (vozes da chamada, música, sons).
      audio: SHARE_AUDIO_SUPPORTED ? { restrictOwnAudio: true } : false
    });
    if (leaves !== voiceLeaves || !currentVoiceRoom) {
      stream.getTracks().forEach((t) => t.stop()); // saiu da voz antes de escolher a tela
      return;
    }
    screenStream = stream;

    const screenTrack = screenStream.getVideoTracks()[0];
    screenTrack.contentHint = shareFps === 60 ? 'motion' : 'detail';
    sharingScreen = true;
    sendStatus();
    replaceVideoTrackEverywhere(screenTrack, screenStream);
    peers.forEach(applyScreenAudio);
    renderTiles();

    VoxIcons.setIcon(btnScreen, 'monitor-stop', 'Parar');
    btnScreen.classList.remove('off');
    btnScreen.classList.add('primary');

    screenStream.getVideoTracks()[0].addEventListener('ended', stopScreenShare);
  } catch (e) {
    console.warn('Compartilhamento cancelado ou falhou:', e);
  } finally {
    pendingShare = false;
    updateVoiceDependentControls();
  }
});

function replaceVideoTrackEverywhere(track, stream) {
  peers.forEach((pc) => {
    const transceiver = getVideoTransceiver(pc);
    if (transceiver && transceiver.sender) {
      transceiver.sender.replaceTrack(track)
        .then(() => applyVideoSenderParams(pc))
        .catch((e) => console.warn('Falha ao trocar faixa de vídeo:', e));
    } else if (track) pc.addTrack(track, stream);
  });
}

function stopScreenShare() {
  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  sharingScreen = false;
  sendStatus();
  peers.forEach(applyScreenAudio);

  const camTrack = localStream ? localStream.getVideoTracks()[0] : null;
  replaceVideoTrackEverywhere(camTrack || null, localStream);

  VoxIcons.setIcon(btnScreen, 'monitor-up', 'Tela');
  btnScreen.classList.remove('primary');
  btnScreen.classList.add('off');
  renderTiles();
}

/* ================= SELETOR DE TELA ================= */
window.electronAPI.onDisplaySources((sources) => {
  // Pedido abandonado (saiu da voz antes do seletor abrir): libera o pedido no processo principal.
  if (!pendingShare) { window.electronAPI.cancelDisplaySource(); return; }
  sourceList.innerHTML = '';

  if (!sources.length) {
    sourceList.textContent = 'Nenhuma tela encontrada.';
  }

  sources.forEach((src) => {
    const item = document.createElement('div');
    item.className = 'source-item';

    if (src.thumbnail) {
      const img = document.createElement('img');
      img.src = src.thumbnail;
      img.alt = src.name;
      item.appendChild(img);
    }

    const label = document.createElement('div');
    label.className = 'source-label';
    label.textContent = src.name;
    item.appendChild(label);

    item.addEventListener('click', () => {
      sourcePicker.classList.add('hidden');
      window.electronAPI.selectDisplaySource(src.id, {
        audio: SHARE_AUDIO_SUPPORTED && shareAudioCheckbox.checked
      });
    });

    sourceList.appendChild(item);
  });

  applyShareQualityUI();
  // Sempre desmarcado: o áudio do PC leva também as vozes da chamada.
  shareAudioCheckbox.checked = false;
  shareAudioField.classList.toggle('hidden', !SHARE_AUDIO_SUPPORTED);
  sourcePicker.classList.remove('hidden');
});

sourceCancel.addEventListener('click', () => {
  sourcePicker.classList.add('hidden');
  window.electronAPI.cancelDisplaySource();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sourcePicker.classList.contains('hidden')) {
    sourcePicker.classList.add('hidden');
    window.electronAPI.cancelDisplaySource();
  }
});

/* ================= CHAT ================= */
const VoxChatRules = window.VoxChat;
const messageRows = new Map(); // id -> { row, msg }

// Nomes que podem ser mencionados: membros do servidor aberto (ou os dois da conversa direta).
function memberNames() {
  const info = channelInfo(currentTextRoom);
  const names = info ? info.server.members.slice() : [VoxFriendsRules.otherOf(currentTextRoom, currentUser)].filter(Boolean);
  if (currentUser && !names.includes(currentUser)) names.push(currentUser);
  return names;
}

const sameName = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function showEmptyChat() {
  const empty = document.createElement('div');
  empty.className = 'msg-user';
  empty.id = 'chat-empty';
  empty.textContent = 'Nenhuma mensagem ainda. Diga olá!';
  messagesEl.appendChild(empty);
}

function reloadMessages() {
  if (!currentTextRoom) return;
  const room = currentTextRoom;
  socket.emit('get-messages', room, (rows) => {
    if (room !== currentTextRoom) return;
    messagesEl.innerHTML = '';
    messageRows.clear();
    if (!rows || rows.length === 0) { showEmptyChat(); return; }
    rows.forEach((m) => appendMessage(m, { scroll: false }));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

socket.on('messages-cleared', () => reloadMessages());

// Texto com as menções (@nome) destacadas, sem innerHTML.
function fillMessageText(el, text) {
  el.textContent = '';
  for (const part of VoxChatRules.splitMentions(text, memberNames())) {
    if (part.mention) {
      const span = document.createElement('span');
      span.className = 'msg-mention';
      span.textContent = part.text;
      el.appendChild(span);
    } else {
      el.appendChild(document.createTextNode(part.text));
    }
  }
}

function uploadUrl(file) {
  return `${SERVER_URL}/uploads/${encodeURIComponent(file)}`;
}

function buildMessageRow(m) {
  const own = m.user === currentUser;
  const mentionsMe = !own && VoxChatRules.mentionsOf(m.text, memberNames()).some((n) => sameName(n, currentUser));
  const row = document.createElement('div');
  row.className = 'msg-row' + (own ? ' own' : '') + (mentionsMe ? ' mentions-me' : '');
  row.dataset.id = m.id || '';
  row.appendChild(makeAvatar(m.user));

  const body = document.createElement('div');
  body.className = 'msg-body';

  const head = document.createElement('div');
  head.className = 'msg-head';
  const name = document.createElement('div');
  name.className = 'msg-user';
  name.textContent = m.user;
  head.appendChild(name);
  if (m.edited_at) {
    const edited = document.createElement('span');
    edited.className = 'msg-edited';
    edited.textContent = '(editada)';
    head.appendChild(edited);
  }
  body.appendChild(head);

  if (m.image && VoxChatRules.isUploadName(m.image.file)) {
    const img = document.createElement('img');
    img.className = 'msg-image';
    img.alt = 'Imagem enviada por ' + m.user;
    img.loading = 'lazy';
    if (m.image.width && m.image.height) { img.width = m.image.width; img.height = m.image.height; }
    img.src = uploadUrl(m.image.file);
    img.addEventListener('click', () => openImageViewer(img.src, img.alt));
    img.addEventListener('load', () => { if (nearBottom(200)) messagesEl.scrollTop = messagesEl.scrollHeight; });
    body.appendChild(img);
  }

  if (m.text) {
    const content = document.createElement('div');
    content.className = 'msg-text';
    fillMessageText(content, m.text);
    body.appendChild(content);
  }
  row.appendChild(body);

  if (own && m.id) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'msg-action';
    edit.title = 'Editar';
    edit.setAttribute('aria-label', 'Editar mensagem');
    VoxIcons.setIcon(edit, 'pencil', '', 16);
    edit.addEventListener('click', () => startEditMessage(m.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'msg-action danger';
    del.title = 'Apagar';
    del.setAttribute('aria-label', 'Apagar mensagem');
    VoxIcons.setIcon(del, 'trash-2', '', 16);
    del.addEventListener('click', () => deleteOwnMessage(m.id));
    actions.append(edit, del);
    row.appendChild(actions);
  }
  return row;
}

function nearBottom(px = 80) {
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < px;
}

function appendMessage(m, { scroll = true } = {}) {
  const empty = document.getElementById('chat-empty');
  if (empty) empty.remove();
  const stick = nearBottom();
  const row = buildMessageRow(m);
  messagesEl.appendChild(row);
  if (m.id) messageRows.set(m.id, { row, msg: m });
  if (scroll && (stick || m.user === currentUser)) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function replaceMessageRow(id) {
  const entry = messageRows.get(id);
  if (!entry) return;
  const row = buildMessageRow(entry.msg);
  entry.row.replaceWith(row);
  entry.row = row;
}

// Edição no lugar: Enter salva, Esc cancela.
function startEditMessage(id) {
  const entry = messageRows.get(id);
  if (!entry) return;
  const body = entry.row.querySelector('.msg-body');
  const textEl = body.querySelector('.msg-text');
  const input = document.createElement('textarea');
  input.className = 'msg-edit-input';
  input.maxLength = VoxChatRules.MAX_TEXT;
  input.value = entry.msg.text || '';
  const hint = document.createElement('div');
  hint.className = 'msg-edit-hint';
  hint.textContent = 'Enter salva · Esc cancela';
  if (textEl) textEl.replaceWith(input); else body.appendChild(input);
  body.appendChild(hint);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const text = input.value.trim();
    const previous = entry.msg.text || '';
    if (!save || text === previous || (!text && !entry.msg.image)) { replaceMessageRow(id); return; }
    entry.msg = { ...entry.msg, text };
    replaceMessageRow(id);
    socket.emit('edit-message', { room: currentTextRoom, id, text }, (res) => {
      if (res && res.success) return;
      showToast((res && res.message) || 'Não foi possível editar.');
      const cur = messageRows.get(id);
      if (cur) { cur.msg = { ...cur.msg, text: previous }; replaceMessageRow(id); }
    });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => finish(false));
}

function deleteOwnMessage(id) {
  if (!window.confirm('Apagar esta mensagem?')) return;
  socket.emit('delete-message', { room: currentTextRoom, id }, (res) => {
    if (!res || !res.success) showToast((res && res.message) || 'Não foi possível apagar.');
  });
}

socket.on('message-updated', (u) => {
  if (!u || u.room !== currentTextRoom) return;
  const entry = messageRows.get(u.id);
  if (!entry) return;
  entry.msg = { ...entry.msg, text: u.text, edited_at: u.edited_at };
  // Não atrapalha quem está editando esta mesma mensagem agora
  if (!entry.row.querySelector('.msg-edit-input')) replaceMessageRow(u.id);
});

socket.on('message-deleted', (d) => {
  if (!d || d.room !== currentTextRoom) return;
  const entry = messageRows.get(d.id);
  if (!entry) return;
  entry.row.remove();
  messageRows.delete(d.id);
  if (!messageRows.size) showEmptyChat();
});

/* ---------- Envio, com imagem opcional ---------- */
let pendingAttachment = null; // { data: ArrayBuffer, type, width, height, previewUrl, name }
let sending = false;

function sendMessage() {
  const text = msgInput.value.trim();
  if ((!text && !pendingAttachment) || !currentTextRoom || sending) return;
  if (!socket.connected) { showToast('Sem conexão com o servidor. Tente de novo quando reconectar.'); return; }
  const payload = { room: currentTextRoom, text };
  if (pendingAttachment) {
    const { data, type, width, height } = pendingAttachment;
    payload.image = { data, type, width, height };
  }
  sending = true;
  sendBtn.disabled = true;
  socket.timeout(20000).emit('save-message', payload, (err, res) => {
    sending = false;
    sendBtn.disabled = false;
    if (err || !res || !res.success) {
      showToast((res && res.message) || 'A mensagem não foi enviada.');
      return;
    }
    // A mensagem aparece pelo 'new-message', como para todo mundo.
    if (msgInput.value.trim() === text) msgInput.value = '';
    clearAttachment();
    hideMentionPopup();
  });
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
  if (handleMentionKey(e)) return;
  if (e.key === 'Enter') sendMessage();
});

// Reduz e recomprime no próprio PC (lado maior até 1920 px), para caber em 2 MB.
// GIF vai como está para não perder a animação.
async function prepareImage(file) {
  if (!VoxChatRules.imageExtension(file.type)) throw new Error('Formato não suportado. Use PNG, JPG, WebP ou GIF.');
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (file.type === 'image/gif') {
    bitmap.close();
    if (file.size > VoxChatRules.MAX_IMAGE_BYTES) throw new Error('O GIF passa de 2 MB.');
    return { data: await file.arrayBuffer(), type: file.type, width, height };
  }
  const scale = Math.min(1, 1920 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', quality));
    if (blob && blob.size <= VoxChatRules.MAX_IMAGE_BYTES) {
      return { data: await blob.arrayBuffer(), type: 'image/webp', width: w, height: h };
    }
  }
  throw new Error('A imagem ficou grande demais mesmo depois de reduzida.');
}

async function attachImage(file) {
  if (!file) return;
  if (!currentTextRoom) return;
  try {
    const prepared = await prepareImage(file);
    clearAttachment();
    pendingAttachment = { ...prepared, previewUrl: URL.createObjectURL(new Blob([prepared.data], { type: prepared.type })), name: file.name || 'Imagem colada' };
    attachThumb.src = pendingAttachment.previewUrl;
    attachName.textContent = `${pendingAttachment.name} · ${(prepared.data.byteLength / 1024).toFixed(0)} KB`;
    attachPreview.classList.remove('hidden');
    msgInput.focus();
  } catch (e) {
    showToast(e.message || 'Não foi possível usar essa imagem.');
  }
}

function clearAttachment() {
  if (pendingAttachment && pendingAttachment.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
  pendingAttachment = null;
  attachPreview.classList.add('hidden');
  attachThumb.removeAttribute('src');
  attachInput.value = '';
}

attachBtn.addEventListener('click', () => attachInput.click());
attachInput.addEventListener('change', () => attachImage(attachInput.files && attachInput.files[0]));
attachRemove.addEventListener('click', clearAttachment);
msgInput.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  attachImage(item.getAsFile());
});
messagesEl.addEventListener('dragover', (e) => {
  if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); messagesEl.classList.add('drag-over'); }
});
messagesEl.addEventListener('dragleave', () => messagesEl.classList.remove('drag-over'));
messagesEl.addEventListener('drop', (e) => {
  messagesEl.classList.remove('drag-over');
  const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  attachImage(file);
});

function openImageViewer(src, alt) {
  imageViewerImg.src = src;
  imageViewerImg.alt = alt || '';
  imageViewer.classList.remove('hidden');
}
function closeImageViewer() {
  imageViewer.classList.add('hidden');
  imageViewerImg.removeAttribute('src');
}
imageViewer.addEventListener('click', closeImageViewer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !imageViewer.classList.contains('hidden')) closeImageViewer();
});

/* ---------- Menções: sugestões ao digitar @ ---------- */
let mentionMatches = [];
let mentionIndex = 0;

function mentionQuery() {
  const pos = msgInput.selectionStart || 0;
  const m = /(^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(msgInput.value.slice(0, pos));
  return m ? { query: m[2], start: pos - m[2].length - 1, end: pos } : null;
}

function hideMentionPopup() {
  mentionMatches = [];
  mentionPopup.classList.add('hidden');
}

function updateMentionPopup() {
  const q = mentionQuery();
  if (!q) return hideMentionPopup();
  mentionMatches = memberNames()
    .filter((n) => n !== currentUser && n.toLowerCase().startsWith(q.query.toLowerCase()))
    .slice(0, 6);
  if (!mentionMatches.length) return hideMentionPopup();
  mentionIndex = Math.min(mentionIndex, mentionMatches.length - 1);
  mentionPopup.innerHTML = '';
  mentionMatches.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = i === mentionIndex ? 'active' : '';
    btn.setAttribute('role', 'option');
    btn.textContent = '@' + name;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); insertMention(name); });
    mentionPopup.appendChild(btn);
  });
  mentionPopup.classList.remove('hidden');
}

function insertMention(name) {
  const q = mentionQuery();
  if (!q) return;
  const v = msgInput.value;
  msgInput.value = v.slice(0, q.start) + '@' + name + ' ' + v.slice(q.end);
  const caret = q.start + name.length + 2;
  msgInput.setSelectionRange(caret, caret);
  hideMentionPopup();
}

// Setas escolhem, Tab/Enter inserem, Esc fecha. Devolve true se tratou a tecla.
function handleMentionKey(e) {
  if (!mentionMatches.length) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    mentionIndex = (mentionIndex + (e.key === 'ArrowDown' ? 1 : -1) + mentionMatches.length) % mentionMatches.length;
    updateMentionPopup();
    return true;
  }
  if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault();
    insertMention(mentionMatches[mentionIndex]);
    return true;
  }
  if (e.key === 'Escape') { hideMentionPopup(); return true; }
  return false;
}

msgInput.addEventListener('input', () => { mentionIndex = 0; updateMentionPopup(); });
msgInput.addEventListener('blur', () => setTimeout(hideMentionPopup, 100));

/* ---------- Não lidas e notificações ---------- */
let unread = {}; // room -> { count, mention }
let notifyMode = localStorage.getItem('vox-notify-mode') || 'all';
if (!['all', 'mentions', 'off'].includes(notifyMode)) notifyMode = 'all';
notifyModeSelect.value = notifyMode;
notifyModeSelect.addEventListener('change', () => {
  notifyMode = notifyModeSelect.value;
  localStorage.setItem('vox-notify-mode', notifyMode);
});

function renderUnread() {
  pushTrayState();
  let total = 0;
  document.querySelectorAll('.channel:not(.voice)').forEach((el) => {
    const u = unread[el.dataset.room];
    let badge = el.querySelector('.unread-badge');
    el.classList.toggle('has-unread', !!u);
    if (!u) { if (badge) badge.remove(); return; }
    total += u.count;
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'unread-badge';
      el.appendChild(badge);
    }
    badge.classList.toggle('mention', u.mention);
    badge.textContent = u.mention ? '@' : (u.count > 99 ? '99+' : String(u.count));
    badge.title = u.mention ? 'Você foi mencionado' : `${u.count} mensagem(ns) não lida(s)`;
  });
  // Total de todas as salas (não só as da coluna visível) no título
  const all = Object.values(unread).reduce((n, u) => n + u.count, 0);
  document.title = all ? `(${all}) Vox` : 'Vox';
  renderRail();
}

function notifyMessage(m, mention) {
  const status = effectiveStatus();
  const focused = document.hasFocus();
  if (mention && status !== 'busy' && !(focused && m.room === currentTextRoom)) playSoundEffect('mention');
  if (!VoxChatRules.shouldNotify({ mode: notifyMode, status, mention, focused, sameRoom: m.room === currentTextRoom })) return;
  if (!focused) window.electronAPI.flashFrame(true);
  if (typeof Notification === 'undefined') return;
  const body = m.text ? m.text.slice(0, 140) : 'Enviou uma imagem';
  const info = channelInfo(m.room);
  const title = info ? `${m.user} em ${roomDisplayName(m.room)} (${info.server.name})` : m.user;
  const n = new Notification(title, { body, silent: true });
  n.onclick = () => {
    window.electronAPI.focusWindow();
    openRoom(m.room);
  };
}

socket.on('new-message', (m) => {
  if (!m || !currentUser) return;
  const own = m.user === currentUser;
  const mention = !own && Array.isArray(m.mentions) && m.mentions.some((n) => sameName(n, currentUser));
  // Conversa direta: sobe para o topo da lista do Início
  if (VoxFriendsRules.isDmKey(m.room)) {
    const other = VoxFriendsRules.otherOf(m.room, currentUser);
    friendsState.dms = [{ user: other, lastAt: m.created_at }, ...friendsState.dms.filter((d) => d.user !== other)];
    if (!currentServerId) renderSidebar();
  }
  if (m.room === currentTextRoom) {
    appendMessage(m);
    if (!own && !document.hasFocus()) { unread = VoxChatRules.addUnread(unread, m.room, mention); renderUnread(); }
  } else if (!own) {
    unread = VoxChatRules.addUnread(unread, m.room, mention);
    renderUnread();
  }
  if (!own) notifyMessage(m, mention);
});

// Voltar para a janela marca o canal aberto como lido.
window.addEventListener('focus', () => {
  if (currentTextRoom && unread[currentTextRoom]) {
    unread = VoxChatRules.clearUnread(unread, currentTextRoom);
    renderUnread();
  }
});

/* ================= SAIR DA VOZ ================= */
// Para microfone, análise de áudio e AudioContext.
function stopLocalMedia() {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (monitorAudio) monitorAudio.srcObject = null;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  analysers.clear();
  speakingStates.clear();
  localAnalyser = null;
  destroyMicProcessing();

  if (audioContext) {
    try { audioContext.close(); } catch (e) {}
    audioContext = null;
  }
}

// Sai só da voz: o canal de texto continua.
function leaveVoice() {
  ++joinToken; // cancela uma entrada em voz ainda em andamento
  ++voiceLeaves; // pedidos de câmera/tela/microfone em andamento descartam o que chegar

  // Seletor de tela aberto ou por abrir: cancela o pedido
  if (pendingShare) {
    pendingShare = false;
    sourcePicker.classList.add('hidden');
    window.electronAPI.cancelDisplaySource();
  }
  if (currentVoiceRoom) {
    socket.emit('leave-voice');
    playSoundEffect('leave');
  }
  soundRoster = null;
  closeAllPeers();

  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  stopLocalMedia();
  closeFullscreenView();
  resetMusic();
  closeMusicPanel();

  sharingScreen = false;
  camEnabled = false;
  currentVoiceRoom = '';
  userMap.clear();
  lastUsersSignature = '';

  VoxIcons.setIcon(btnScreen, 'monitor-up', 'Tela');
  btnScreen.classList.remove('primary');
  btnScreen.classList.add('off');
  voiceConnection.classList.add('hidden');

  updateControlButtons();
  updateVoiceDependentControls();
  updateActiveChannel();
  renderTiles();
  renderMembers();
}

btnHangup.addEventListener('click', leaveVoice);
btnLeaveVoice.addEventListener('click', leaveVoice);

function logout() {
  if (!window.confirm('Sair da conta?')) return;
  socket.emit('logout');
  endSession('');
}

// Volta para a tela de login (saída da conta ou sessão que não pôde ser retomada).
function endSession(message) {
  sessionToken = null;
  unread = {};
  pendingAutoJoin = false;
  servers = [];
  currentServerId = null;
  friendsState = { friends: [], incoming: [], outgoing: [], dms: [] };
  dmUsers.clear();
  stopRinging();
  serverModal.classList.add('hidden');
  closeFormModal();
  channelScroll.innerHTML = '';
  guildName.textContent = 'Início';
  renderUnread();
  clearAttachment();
  errorLogin.textContent = message || '';
  serverMembers = [];
  settingsModal.classList.add('hidden');
  leaveVoice();
  currentTextRoom = '';
  messagesEl.innerHTML = '';
  messageRows.clear();
  updateActiveChannel();
  currentUser = '';
  voiceRooms = {};
  myName.textContent = '—';
  myAvatar.classList.remove('has-image');
  delete myAvatar.dataset.user;
  myAvatar.textContent = '?';
  myAvatar.style.background = '';
  myStatusEl.textContent = 'Online';
  myStatusEl.style.color = '';
  myStatusDot.className = 'status-dot online';
  statusMode = 'online';
  autoAway = false;
  updateMyStatusUI();
  loginPass.value = '';
  regPass.value = '';
  regPass2.value = '';
  renderMembers();
  authScreen.style.display = 'flex';
}

if (btnLogout) btnLogout.addEventListener('click', logout);

/* ================= NAVEGAÇÃO: SERVIDORES E INÍCIO ================= */
const serverListEl = document.getElementById('server-list');
const railHome = document.getElementById('rail-home');
const railAdd = document.getElementById('rail-add');
const guildHeader = document.getElementById('guild-header');
const guildName = document.getElementById('guild-name');
const serverMenu = document.getElementById('server-menu');
const channelScroll = document.getElementById('channel-scroll');
const chatWrap = document.getElementById('chat-wrap');
const btnDmCall = document.getElementById('btn-dm-call');
const dmUsers = new Set(); // conversas abertas nesta sessão (ainda sem mensagens)

function serverInitials(name) {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
}

const serverHasUnread = (s) => s.channels.some((c) => unread[c.id]);

function renderRail() {
  serverListEl.innerHTML = '';
  for (const s of servers) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rail-btn rail-guild' + (s.id === currentServerId ? ' active' : '') + (serverHasUnread(s) ? ' has-unread' : '');
    b.title = s.name;
    b.setAttribute('aria-label', s.name);
    b.textContent = serverInitials(s.name);
    b.addEventListener('click', () => selectServer(s.id));
    serverListEl.appendChild(b);
  }
  railHome.classList.toggle('active', !currentServerId);
  // Início: conversas diretas não lidas e pedidos de amizade recebidos
  const dmCount = Object.entries(unread).filter(([room]) => VoxFriendsRules.isDmKey(room)).reduce((n, [, u]) => n + u.count, 0);
  const total = dmCount + friendsState.incoming.length;
  let badge = railHome.querySelector('.rail-badge');
  if (!total) { if (badge) badge.remove(); return; }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'unread-badge mention rail-badge';
    railHome.appendChild(badge);
  }
  badge.textContent = total > 99 ? '99+' : String(total);
}

function selectServer(id) {
  const server = serverById(id);
  if (!server) { openHome(); return; }
  const changed = currentServerId !== id;
  currentServerId = id;
  try { localStorage.setItem('vox-last-server', id); } catch (e) {}
  if (changed || !currentTextRoom || !channelInfo(currentTextRoom)) {
    const last = server.channels.find((c) => c.id === lastChannels[id] && c.type === 'text');
    const text = last || server.channels.find((c) => c.type === 'text');
    if (text && text.id !== currentTextRoom) joinText(text.id);
  }
  renderSidebar();
  renderRail();
  renderMembers();
}

// Início sem conversa aberta: painel de amigos.
function openHome() {
  currentServerId = null;
  currentTextRoom = '';
  messagesEl.innerHTML = '';
  messageRows.clear();
  chatWrap.classList.add('friends-mode');
  channelIcon.textContent = '';
  VoxIcons.setIcon(channelIcon, 'users', '', 18);
  channelName.textContent = 'Amigos';
  btnDmCall.classList.add('hidden');
  renderSidebar();
  renderRail();
  renderMembers();
  renderFriendsPanel();
}

function openDm(user) {
  if (!currentUser || !user) return;
  dmUsers.add(user);
  currentServerId = null;
  joinText(VoxFriendsRules.dmKey(currentUser, user));
  renderSidebar();
  renderRail();
  renderMembers();
}

// Abre a sala de uma notificação ou link: canal de algum servidor ou conversa direta.
function openRoom(room) {
  if (VoxFriendsRules.isDmKey(room)) { openDm(VoxFriendsRules.otherOf(room, currentUser)); return; }
  const info = channelInfo(room);
  if (!info) return;
  if (currentServerId !== info.server.id) selectServer(info.server.id);
  joinText(room);
}

// Cabeçalho e área do chat do canal/conversa aberto.
function showChatView(room) {
  chatWrap.classList.remove('friends-mode');
  const dmOther = VoxFriendsRules.isDmKey(room) ? VoxFriendsRules.otherOf(room, currentUser) : null;
  channelIcon.textContent = dmOther ? '@' : '#';
  channelName.textContent = dmOther || (channelInfo(room) ? channelInfo(room).channel.name : room);
  msgInput.placeholder = `Enviar mensagem em ${roomDisplayName(room)}`;
  btnDmCall.classList.toggle('hidden', !(dmOther && friendsState.friends.includes(dmOther)));
}

function makeChannelItem({ room, label, icon, voice, editable, onClick }) {
  const el = document.createElement('div');
  el.className = 'channel' + (voice ? ' voice' : '');
  if (room) el.dataset.room = room;
  const ic = document.createElement('span');
  ic.className = voice ? 'voice-icon' : 'hash';
  if (icon === '#') ic.textContent = '#'; else ic.appendChild(VoxIcons.icon(icon, 16));
  const name = document.createElement('span');
  name.className = 'channel-name';
  name.textContent = label;
  el.append(ic, name);
  if (editable) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'channel-edit';
    edit.title = 'Editar canal';
    edit.setAttribute('aria-label', 'Editar canal ' + label);
    edit.appendChild(VoxIcons.icon('settings', 14));
    edit.addEventListener('click', (e) => { e.stopPropagation(); editChannel(room); });
    el.appendChild(edit);
  }
  el.addEventListener('click', onClick);
  return el;
}

function sectionTitle(text, onAdd) {
  const head = document.createElement('div');
  head.className = 'section-title section-head';
  const span = document.createElement('span');
  span.textContent = text;
  head.appendChild(span);
  if (onAdd) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'section-add';
    add.title = 'Criar canal';
    add.setAttribute('aria-label', 'Criar canal');
    add.appendChild(VoxIcons.icon('plus', 14));
    add.addEventListener('click', onAdd);
    head.appendChild(add);
  }
  return head;
}

// Coluna de canais: do servidor aberto, ou amigos e conversas diretas no Início.
function renderSidebar() {
  channelScroll.innerHTML = '';
  const server = serverById(currentServerId);
  serverMenu.classList.add('hidden');
  if (server) {
    guildName.textContent = server.name;
    guildHeader.classList.remove('no-menu');
    const manager = ['owner', 'admin'].includes(server.role);
    for (const [type, title] of [['text', 'Canais de texto'], ['voice', 'Canais de voz']]) {
      channelScroll.appendChild(sectionTitle(title, manager ? () => createChannelDialog(type) : null));
      server.channels.filter((c) => c.type === type).forEach((c) => {
        channelScroll.appendChild(makeChannelItem({
          room: c.id, label: c.name, icon: type === 'text' ? '#' : 'volume-2', voice: type === 'voice', editable: manager,
          onClick: () => (type === 'voice' ? joinVoice(c.id) : joinText(c.id))
        }));
      });
    }
  } else {
    guildName.textContent = 'Início';
    guildHeader.classList.add('no-menu');
    const friendsItem = makeChannelItem({ label: 'Amigos', icon: 'users', onClick: openHome });
    friendsItem.classList.toggle('active', !currentTextRoom);
    if (friendsState.incoming.length) {
      const b = document.createElement('span');
      b.className = 'unread-badge mention';
      b.textContent = String(friendsState.incoming.length);
      friendsItem.appendChild(b);
    }
    channelScroll.appendChild(friendsItem);
    channelScroll.appendChild(sectionTitle('Mensagens diretas'));
    const people = new Map(friendsState.dms.map((d) => [d.user, d.lastAt]));
    dmUsers.forEach((u) => { if (!people.has(u)) people.set(u, ''); });
    const list = [...people.entries()].sort((a, b) => String(b[1]).localeCompare(String(a[1])));
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'channel-empty';
      empty.textContent = 'Nenhuma conversa ainda. Abra uma pela lista de amigos.';
      channelScroll.appendChild(empty);
    }
    for (const [user] of list) {
      const room = VoxFriendsRules.dmKey(currentUser, user);
      const el = makeChannelItem({ room, label: user, icon: 'message-circle', onClick: () => openDm(user) });
      el.classList.add('dm');
      const presence = serverMembers.find((m) => m.username === user);
      const wrap = document.createElement('span');
      wrap.className = 'avatar-wrap';
      wrap.appendChild(makeAvatar(user));
      if (presence && presence.online) {
        const dot = document.createElement('span');
        dot.className = 'status-dot member-status-dot ' + (presence.status || 'online');
        wrap.appendChild(dot);
      }
      el.firstChild.replaceWith(wrap);
      channelScroll.appendChild(el);
    }
  }
  updateActiveChannel();
  renderMembers();
  renderUnread();
}

railHome.addEventListener('click', openHome);

/* ---------- Eventos do servidor ---------- */
socket.on('servers', (list) => {
  servers = Array.isArray(list) ? list : [];
  if (pendingAutoJoin) { renderRail(); autoJoinAfterLogin(); return; }
  if (currentServerId && !serverById(currentServerId)) {
    openHome();
  } else if (currentServerId && currentTextRoom && !VoxFriendsRules.isDmKey(currentTextRoom) && !channelInfo(currentTextRoom)) {
    currentTextRoom = '';
    selectServer(currentServerId); // canal aberto foi apagado: vai para o primeiro
  } else {
    renderSidebar();
    if (currentTextRoom) showChatView(currentTextRoom); // nomes podem ter mudado
  }
  if (currentVoiceRoom) voiceConnName.textContent = roomDisplayName(currentVoiceRoom);
  renderRail();
  if (!serverModal.classList.contains('hidden')) renderServerModal();
});

socket.on('voice-removed', ({ room } = {}) => {
  if (room && room === currentVoiceRoom) {
    leaveVoice();
    showToast('Você saiu do canal de voz: ele foi apagado ou você perdeu o acesso.');
  }
});

socket.on('server-kicked', ({ name } = {}) => showToast(`Você foi removido do servidor ${name || ''}.`));

/* ---------- Formulário curto ---------- */
const formModal = document.getElementById('form-modal');
const formCard = document.getElementById('form-card');
const formTitle = document.getElementById('form-title');
const formHint = document.getElementById('form-hint');
const formFields = document.getElementById('form-fields');
const formError = document.getElementById('form-error');
const formSubmit = document.getElementById('form-submit');
const formCancel = document.getElementById('form-cancel');
let formState = null;

// fields: [{ name, label, value, placeholder, readonly, maxlength }]; extra: { label, danger, onClick }.
// onSubmit(values) devolve uma mensagem de erro (mantém aberto) ou nada (fecha).
function openFormModal({ title, hint = '', fields = [], submit = 'Salvar', extra = null, onSubmit }) {
  formTitle.textContent = title;
  formHint.textContent = hint;
  formHint.classList.toggle('hidden', !hint);
  formError.textContent = '';
  formFields.innerHTML = '';
  for (const f of fields) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.name = f.name;
    input.value = f.value || '';
    input.placeholder = f.placeholder || '';
    input.readOnly = !!f.readonly;
    if (f.maxlength) input.maxLength = f.maxlength;
    input.autocomplete = 'off';
    input.spellcheck = false;
    label.htmlFor = input.id = 'form-field-' + f.name;
    wrap.append(label, input);
    formFields.appendChild(wrap);
  }
  formSubmit.textContent = submit;
  const actions = formCancel.parentElement;
  actions.querySelectorAll('.form-extra').forEach((b) => b.remove());
  if (extra) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'form-extra ' + (extra.danger ? 'btn-danger-outline' : 'btn-secondary');
    b.textContent = extra.label;
    b.addEventListener('click', async () => { if (await extra.onClick()) closeFormModal(); });
    actions.insertBefore(b, formCancel);
  }
  formState = { onSubmit };
  formModal.classList.remove('hidden');
  const first = formFields.querySelector('input:not([readonly])') || formFields.querySelector('input');
  if (first) { first.focus(); first.select(); }
}

function closeFormModal() {
  formModal.classList.add('hidden');
  formState = null;
}

formCard.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!formState) return;
  const values = Object.fromEntries([...formFields.querySelectorAll('input')].map((i) => [i.name, i.value]));
  formSubmit.disabled = true;
  try {
    const error = await formState.onSubmit(values);
    if (error) formError.textContent = error; else closeFormModal();
  } finally {
    formSubmit.disabled = false;
  }
});
formCancel.addEventListener('click', closeFormModal);
formModal.addEventListener('click', (e) => { if (e.target === formModal) closeFormModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !formModal.classList.contains('hidden')) closeFormModal();
});

// Emite e espera a resposta; devolve a mensagem de erro (string) ou o objeto de sucesso.
function request(event, payload) {
  return new Promise((resolve) => {
    if (!socket.connected) { resolve({ success: false, message: 'Sem conexão com o servidor.' }); return; }
    socket.timeout(15000).emit(event, payload, (err, res) => {
      resolve(err ? { success: false, message: 'O servidor não respondeu.' } : (res || { success: false }));
    });
  });
}

/* ---------- Criar ou entrar em servidor ---------- */
railAdd.addEventListener('click', () => {
  openFormModal({
    title: 'Adicionar servidor',
    hint: 'Crie um servidor novo ou cole o código de convite que alguém te mandou (ex.: VOX-AB12CD34). Use só um dos campos.',
    fields: [
      { name: 'name', label: 'Nome do servidor novo', placeholder: 'Ex.: Turma do jogo', maxlength: 40 },
      { name: 'code', label: 'Ou código de convite', placeholder: 'Ex.: VOX-AB12CD34', maxlength: 16 }
    ],
    submit: 'Continuar',
    onSubmit: async ({ name, code }) => {
      if (code.trim()) {
        const res = await request('invite-join', { code });
        if (!res.success) return res.message || 'Convite inválido.';
        if (res.already) showToast('Você já está nesse servidor.');
        openServerWhenReady(res.serverId);
        return null;
      }
      if (!name.trim()) return 'Escreva o nome do servidor ou o código de convite.';
      const res = await request('server-create', { name });
      if (!res.success) return res.message;
      openServerWhenReady(res.serverId);
      return null;
    }
  });
});

// Servidor recém-criado/entrado: o servidor manda a lista nova antes da resposta,
// então em geral já dá para abrir; senão, abre quando a lista chegar.
let pendingServerSelect = null;
function openServerWhenReady(id) {
  if (serverById(id)) selectServer(id); else pendingServerSelect = id;
}
socket.on('servers', () => {
  if (pendingServerSelect && serverById(pendingServerSelect)) {
    const id = pendingServerSelect;
    pendingServerSelect = null;
    selectServer(id);
  }
});

/* ---------- Menu do servidor ---------- */
guildHeader.addEventListener('click', (e) => {
  e.stopPropagation();
  const server = serverById(currentServerId);
  if (!server) return;
  const manager = ['owner', 'admin'].includes(server.role);
  serverMenu.querySelectorAll('[data-manage]').forEach((b) => b.classList.toggle('hidden', !manager));
  serverMenu.querySelector('[data-action="invite"]').classList.toggle('hidden', !manager);
  serverMenu.querySelector('[data-action="leave"]').classList.toggle('hidden', server.role === 'owner');
  serverMenu.classList.toggle('hidden');
  guildHeader.setAttribute('aria-expanded', String(!serverMenu.classList.contains('hidden')));
});
document.addEventListener('click', (e) => {
  if (!serverMenu.classList.contains('hidden') && !serverMenu.contains(e.target)) serverMenu.classList.add('hidden');
});

serverMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  serverMenu.classList.add('hidden');
  const server = serverById(currentServerId);
  if (!server) return;
  const action = btn.dataset.action;
  if (action === 'invite') inviteDialog(server);
  else if (action === 'settings') openServerModal();
  else if (action === 'new-text') createChannelDialog('text');
  else if (action === 'new-voice') createChannelDialog('voice');
  else if (action === 'leave') {
    if (!window.confirm(`Sair do servidor ${server.name}?`)) return;
    const res = await request('server-leave', { serverId: server.id });
    if (!res.success) showToast(res.message || 'Não foi possível sair.');
  }
});

async function inviteDialog(server) {
  const existing = server.invites[0];
  let code = existing && existing.code;
  if (!code) {
    const res = await request('invite-create', { serverId: server.id });
    if (!res.success) { showToast(res.message || 'Não foi possível criar o convite.'); return; }
    code = res.code;
  }
  openFormModal({
    title: `Convidar para ${server.name}`,
    hint: 'Mande este código para a pessoa. Ela clica em + na barra da esquerda e cola o código. Os códigos ficam em Configurações do servidor → Convites.',
    fields: [{ name: 'code', label: 'Código de convite', value: 'VOX-' + code, readonly: true }],
    submit: 'Copiar e fechar',
    onSubmit: async () => {
      try { await navigator.clipboard.writeText('VOX-' + code); showToast('Código copiado.'); } catch (err) {}
      return null;
    }
  });
}

function createChannelDialog(type) {
  const server = serverById(currentServerId);
  if (!server) return;
  openFormModal({
    title: type === 'text' ? 'Criar canal de texto' : 'Criar canal de voz',
    fields: [{ name: 'name', label: 'Nome do canal', placeholder: type === 'text' ? 'ex.: avisos' : 'ex.: Sala de jogos', maxlength: 32 }],
    submit: 'Criar',
    onSubmit: async ({ name }) => {
      const res = await request('channel-create', { serverId: server.id, type, name });
      if (!res.success) return res.message;
      if (type === 'text') openChannelWhenReady(res.channelId);
      return null;
    }
  });
}

let pendingChannelOpen = null;
function openChannelWhenReady(id) {
  if (channelInfo(id)) joinText(id); else pendingChannelOpen = id;
}
socket.on('servers', () => {
  if (pendingChannelOpen && channelInfo(pendingChannelOpen)) {
    const id = pendingChannelOpen;
    pendingChannelOpen = null;
    joinText(id);
  }
});

function editChannel(room) {
  const info = channelInfo(room);
  if (!info) return;
  const { channel } = info;
  openFormModal({
    title: 'Editar canal',
    fields: [{ name: 'name', label: 'Nome do canal', value: channel.name, maxlength: 32 }],
    submit: 'Salvar',
    extra: {
      label: 'Apagar canal',
      danger: true,
      onClick: async () => {
        const kind = channel.type === 'text' ? 'as mensagens dele somem para todo mundo' : 'quem estiver nele sai da voz';
        if (!window.confirm(`Apagar o canal ${roomDisplayName(room)}? ${kind[0].toUpperCase() + kind.slice(1)}.`)) return false;
        const res = await request('channel-delete', { channelId: room });
        if (!res.success) { formError.textContent = res.message || 'Não foi possível apagar.'; return false; }
        return true;
      }
    },
    onSubmit: async ({ name }) => {
      const res = await request('channel-update', { channelId: room, name });
      return res.success ? null : res.message;
    }
  });
}

/* ---------- Configurações do servidor ---------- */
const serverModal = document.getElementById('server-modal');
const serverModalError = document.getElementById('server-modal-error');
const serverNameInput = document.getElementById('server-name-input');
const serverMemberList = document.getElementById('server-member-list');
const inviteList = document.getElementById('invite-list');

function showServerTab(name) {
  document.querySelectorAll('.server-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.server-panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'server-tab-' + name));
}
document.querySelectorAll('.server-tab').forEach((b) => b.addEventListener('click', () => showServerTab(b.dataset.tab)));

function openServerModal() {
  const server = serverById(currentServerId);
  if (!server) return;
  serverNameInput.value = server.name;
  serverModalError.textContent = '';
  showServerTab('geral');
  renderServerModal();
  serverModal.classList.remove('hidden');
}

function smallButton(label, onClick, danger) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (danger) b.className = 'danger';
  b.addEventListener('click', onClick);
  return b;
}

async function serverAction(event, payload, confirmText) {
  if (confirmText && !window.confirm(confirmText)) return;
  serverModalError.textContent = '';
  const res = await request(event, payload);
  if (!res.success) serverModalError.textContent = res.message || 'Não foi possível.';
  return res;
}

function renderServerModal() {
  const server = serverById(currentServerId);
  if (!server) { serverModal.classList.add('hidden'); return; }
  const owner = server.role === 'owner';
  const manager = owner || server.role === 'admin';
  document.getElementById('server-modal-title').textContent = server.name;
  document.getElementById('server-owner-line').textContent = `Dono: ${server.owner}. ${server.admins.length ? 'Administradores: ' + server.admins.join(', ') + '.' : 'Sem administradores.'}`;
  document.getElementById('server-rename').disabled = !manager;
  serverNameInput.disabled = !manager;
  document.getElementById('server-delete').classList.toggle('hidden', !owner);

  serverMemberList.innerHTML = '';
  const roleOf = (u) => (u === server.owner ? 'owner' : server.admins.includes(u) ? 'admin' : 'member');
  const sorted = server.members.slice().sort((a, b) => ['owner', 'admin', 'member'].indexOf(roleOf(a)) - ['owner', 'admin', 'member'].indexOf(roleOf(b)) || a.localeCompare(b));
  for (const u of sorted) {
    const row = document.createElement('div');
    row.className = 'server-member';
    row.appendChild(makeAvatar(u));
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.textContent = u + (u === currentUser ? ' (você)' : '');
    const role = document.createElement('span');
    role.className = 'role';
    const r = roleOf(u);
    role.appendChild(VoxIcons.icon(r === 'owner' ? 'crown' : r === 'admin' ? 'shield' : 'users', 12));
    role.appendChild(document.createTextNode(r === 'owner' ? ' Dono' : r === 'admin' ? ' Administrador' : ' Membro'));
    info.append(name, role);
    row.appendChild(info);
    const actions = document.createElement('div');
    actions.className = 'member-actions';
    if (u !== currentUser && r !== 'owner') {
      if (owner) {
        actions.appendChild(smallButton(r === 'admin' ? 'Tirar admin' : 'Tornar admin',
          () => serverAction('member-role', { serverId: server.id, user: u, admin: r !== 'admin' })));
        actions.appendChild(smallButton('Passar posse',
          () => serverAction('server-transfer', { serverId: server.id, user: u }, `Passar a posse de ${server.name} para ${u}? Você vira administrador.`)));
      }
      if (owner || (manager && r === 'member')) {
        actions.appendChild(smallButton('Expulsar',
          () => serverAction('member-kick', { serverId: server.id, user: u }, `Expulsar ${u} de ${server.name}?`), true));
      }
    }
    row.appendChild(actions);
    serverMemberList.appendChild(row);
  }

  inviteList.innerHTML = '';
  document.getElementById('invite-new').disabled = !manager;
  if (!server.invites.length) {
    const empty = document.createElement('p');
    empty.className = 'settings-hint';
    empty.textContent = 'Nenhum código ativo.';
    inviteList.appendChild(empty);
  }
  for (const inv of server.invites) {
    const row = document.createElement('div');
    row.className = 'invite-row';
    const info = document.createElement('div');
    const code = document.createElement('div');
    code.className = 'invite-code';
    code.textContent = 'VOX-' + inv.code;
    const meta = document.createElement('div');
    meta.className = 'invite-meta';
    meta.textContent = `Criado por ${inv.by} em ${new Date(inv.at).toLocaleDateString('pt-BR')}`;
    info.append(code, meta);
    const actions = document.createElement('div');
    actions.className = 'member-actions';
    actions.appendChild(smallButton('Copiar', async () => {
      try { await navigator.clipboard.writeText('VOX-' + inv.code); showToast('Código copiado.'); } catch (e) {}
    }));
    actions.appendChild(smallButton('Revogar', () => serverAction('invite-revoke', { serverId: server.id, code: inv.code }, 'Revogar este código? Ninguém mais entra com ele.'), true));
    row.append(info, actions);
    inviteList.appendChild(row);
  }
}

document.getElementById('server-rename').addEventListener('click', () => {
  serverAction('server-update', { serverId: currentServerId, name: serverNameInput.value }).then((res) => {
    if (res && res.success) showToast('Nome salvo.');
  });
});
serverNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('server-rename').click(); });
document.getElementById('invite-new').addEventListener('click', () => serverAction('invite-create', { serverId: currentServerId }));
document.getElementById('server-delete').addEventListener('click', async () => {
  const server = serverById(currentServerId);
  if (!server) return;
  const typed = window.confirm(`Apagar o servidor ${server.name}? Todos os canais e mensagens somem para todo mundo. Não dá para desfazer.`);
  if (!typed) return;
  const res = await serverAction('server-delete', { serverId: server.id });
  if (res && res.success) serverModal.classList.add('hidden');
});
document.getElementById('server-modal-close').addEventListener('click', () => serverModal.classList.add('hidden'));
serverModal.addEventListener('click', (e) => { if (e.target === serverModal) serverModal.classList.add('hidden'); });

/* ================= AMIGOS ================= */
const friendsList = document.getElementById('friends-list');
const friendsAdd = document.getElementById('friends-add');
const friendNameInput = document.getElementById('friend-name');
const friendAddStatus = document.getElementById('friend-add-status');
const pendingCountEl = document.getElementById('pending-count');
let friendsTab = 'online';

document.querySelectorAll('.friends-tab').forEach((b) => b.addEventListener('click', () => {
  friendsTab = b.dataset.tab;
  renderFriendsPanel();
  if (friendsTab === 'add') friendNameInput.focus();
}));

function roundButton(icon, title, onClick, kind) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'round-btn' + (kind ? ' ' + kind : '');
  b.title = title;
  b.setAttribute('aria-label', title);
  b.appendChild(VoxIcons.icon(icon, 16));
  b.addEventListener('click', onClick);
  return b;
}

async function friendAction(event, user, confirmText) {
  if (confirmText && !window.confirm(confirmText)) return;
  const res = await request(event, { user });
  if (!res.success) showToast(res.message || 'Não foi possível.');
}

function friendRow(user, sub, actions) {
  const row = document.createElement('div');
  row.className = 'friend-row';
  const wrap = document.createElement('span');
  wrap.className = 'avatar-wrap';
  wrap.appendChild(makeAvatar(user));
  const presence = serverMembers.find((m) => m.username === user);
  if (presence && presence.online) {
    const dot = document.createElement('span');
    dot.className = 'status-dot member-status-dot ' + (presence.status || 'online');
    wrap.appendChild(dot);
  }
  const info = document.createElement('div');
  info.className = 'friend-info';
  const name = document.createElement('div');
  name.className = 'friend-name';
  name.textContent = user;
  const s = document.createElement('div');
  s.className = 'friend-sub';
  s.textContent = sub;
  info.append(name, s);
  const box = document.createElement('div');
  box.className = 'friend-actions';
  actions.forEach((a) => box.appendChild(a));
  row.append(wrap, info, box);
  return row;
}

function renderFriendsPanel() {
  document.querySelectorAll('.friends-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === friendsTab));
  pendingCountEl.textContent = String(friendsState.incoming.length);
  pendingCountEl.classList.toggle('hidden', !friendsState.incoming.length);
  friendsAdd.classList.toggle('hidden', friendsTab !== 'add');
  friendsList.innerHTML = '';
  if (friendsTab === 'add') return;

  const section = (text) => {
    const t = document.createElement('div');
    t.className = 'friends-section';
    t.textContent = text;
    friendsList.appendChild(t);
  };
  const empty = (text) => {
    const p = document.createElement('div');
    p.className = 'friends-empty';
    p.textContent = text;
    friendsList.appendChild(p);
  };

  if (friendsTab === 'pending') {
    if (!friendsState.incoming.length && !friendsState.outgoing.length) return empty('Nenhum pedido de amizade pendente.');
    if (friendsState.incoming.length) section(`Recebidos — ${friendsState.incoming.length}`);
    friendsState.incoming.forEach(({ user }) => friendsList.appendChild(friendRow(user, 'Quer ser seu amigo', [
      roundButton('check', 'Aceitar', () => friendAction('friend-accept', user), 'ok'),
      roundButton('x', 'Recusar', () => friendAction('friend-drop', user), 'danger')
    ])));
    if (friendsState.outgoing.length) section(`Enviados — ${friendsState.outgoing.length}`);
    friendsState.outgoing.forEach(({ user }) => friendsList.appendChild(friendRow(user, 'Pedido enviado', [
      roundButton('x', 'Cancelar pedido', () => friendAction('friend-drop', user), 'danger')
    ])));
    return;
  }

  const presenceOf = (u) => serverMembers.find((m) => m.username === u);
  let list = friendsState.friends.slice().sort((a, b) => a.localeCompare(b));
  if (friendsTab === 'online') list = list.filter((u) => (presenceOf(u) || {}).online);
  if (!list.length) {
    return empty(friendsTab === 'online'
      ? 'Nenhum amigo online agora.'
      : 'Você ainda não tem amigos aqui. Use "Adicionar amigo" com o nome de usuário da pessoa.');
  }
  section(`${friendsTab === 'online' ? 'Online' : 'Todos os amigos'} — ${list.length}`);
  for (const u of list) {
    const p = presenceOf(u);
    const sub = p && p.online ? (STATUS_LABELS[p.status] || 'Online') : 'Offline';
    friendsList.appendChild(friendRow(u, sub, [
      roundButton('message-circle', 'Mensagem', () => openDm(u)),
      roundButton('phone', 'Ligar', () => startCall(u), 'ok'),
      roundButton('user-x', 'Desfazer amizade', () => friendAction('friend-remove', u, `Desfazer a amizade com ${u}? A conversa continua guardada, mas vocês não poderão mandar mensagens nem ligar.`), 'danger')
    ]));
  }
}

async function sendFriendRequest() {
  const user = friendNameInput.value.trim();
  friendAddStatus.classList.remove('ok');
  if (!user) { friendAddStatus.textContent = 'Digite um nome de usuário.'; return; }
  const res = await request('friend-request', { user });
  if (!res.success) { friendAddStatus.textContent = res.message || 'Não foi possível.'; return; }
  friendAddStatus.classList.add('ok');
  friendAddStatus.textContent = `Pedido enviado para ${user}.`;
  friendNameInput.value = '';
}
document.getElementById('friend-send').addEventListener('click', sendFriendRequest);
friendNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendFriendRequest(); });

socket.on('friends', (data) => {
  const before = new Set(friendsState.incoming.map((r) => r.user));
  friendsState = {
    friends: Array.isArray(data && data.friends) ? data.friends : [],
    incoming: Array.isArray(data && data.incoming) ? data.incoming : [],
    outgoing: Array.isArray(data && data.outgoing) ? data.outgoing : [],
    dms: Array.isArray(data && data.dms) ? data.dms : []
  };
  const fresh = friendsState.incoming.filter((r) => !before.has(r.user));
  if (fresh.length && before.size + fresh.length > 0 && currentUser) {
    showToast(`${fresh[0].user} quer ser seu amigo.`);
    playSoundEffect('mention');
  }
  if (!currentServerId) renderSidebar();
  if (chatWrap.classList.contains('friends-mode')) renderFriendsPanel();
  if (currentTextRoom) showChatView(currentTextRoom);
  renderRail();
  renderMembers();
});

/* ================= CHAMADA DIRETA ================= */
const callRing = document.getElementById('call-ring');
let ringingCall = null; // { room, from } tocando aqui
let ringTimer = null;
let callPeerSeen = false; // a outra pessoa chegou a entrar na chamada atual

function stopRinging() {
  ringingCall = null;
  clearInterval(ringTimer);
  ringTimer = null;
  callRing.classList.add('hidden');
}

async function startCall(user) {
  const res = await request('call-start', { user });
  if (!res.success) { showToast(res.message || 'Não foi possível ligar.'); return; }
  callPeerSeen = false;
  joinVoice(res.room);
}

btnDmCall.addEventListener('click', () => {
  const other = VoxFriendsRules.isDmKey(currentTextRoom) ? VoxFriendsRules.otherOf(currentTextRoom, currentUser) : null;
  if (other) startCall(other);
});

socket.on('call-incoming', ({ from, room } = {}) => {
  if (!from || !room) return;
  ringingCall = { room, from };
  applyAvatar(document.getElementById('call-ring-avatar'), from);
  document.getElementById('call-ring-name').textContent = from;
  callRing.classList.remove('hidden');
  playSoundEffect('ring');
  clearInterval(ringTimer);
  let beat = 0; // dois toques seguidos e uma pausa, como um telefone
  ringTimer = setInterval(() => { if (++beat % 3 !== 0) playSoundEffect('ring'); }, 500);
  if (effectiveStatus() !== 'busy' && typeof Notification !== 'undefined' && !document.hasFocus()) {
    const n = new Notification(`${from} está te ligando`, { body: 'Abra o Vox para atender.', silent: true });
    n.onclick = () => window.electronAPI.focusWindow();
    window.electronAPI.flashFrame(true);
  }
});

document.getElementById('call-accept').addEventListener('click', () => {
  if (!ringingCall) return;
  const { room } = ringingCall;
  stopRinging();
  callPeerSeen = false;
  joinVoice(room);
});

document.getElementById('call-decline').addEventListener('click', () => {
  if (!ringingCall) return;
  socket.emit('call-decline', { room: ringingCall.room }, () => {});
  stopRinging();
});

const CALL_END_TEXT = { declined: 'recusou a chamada', missed: 'não atendeu', cancelled: 'desistiu da chamada' };
socket.on('call-ended', ({ room, reason } = {}) => {
  if (ringingCall && ringingCall.room === room) {
    if (reason === 'cancelled') showToast(`${ringingCall.from} ${CALL_END_TEXT.cancelled}.`);
    stopRinging();
  }
  // Eu liguei e a outra pessoa recusou ou não atendeu: sai da sala da chamada
  if (room === currentVoiceRoom && (reason === 'declined' || reason === 'missed')) {
    showToast(`${VoxFriendsRules.otherOf(room, currentUser)} ${CALL_END_TEXT[reason]}.`);
    leaveVoice();
  }
});

/* ================= SOUNDBOARD ================= */
// Sons de fábrica (soundboard-synth.js) e os enviados ao servidor da voz atual.
// Tocar avisa a sala ('soundboard-play'); cada PC toca localmente ao receber 'soundboard-played'.
const SB = window.VoxSoundboard;
const SBSynth = window.VoxSoundboardSynth;
let soundboardSounds = [];             // sons do servidor da voz atual
let soundboardServerId = null;
let soundboardVolume = clampNumber(localStorage.getItem('vox-soundboard-volume') ?? 70, 0, 100, 70);
let soundboardEnabled = localStorage.getItem('vox-soundboard-enabled') !== '0';
const soundBuffers = new Map();        // arquivo -> Promise<AudioBuffer>
let pendingSoundFile = null;           // { data, type, duration }

const $sb = (id) => document.getElementById(id);

// Busca por id a cada chamada: roda também no começo, antes das constantes abaixo existirem.
function closeSoundboard() {
  const panel = $sb('soundboard-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  panel.classList.add('hidden');
  btnSoundboard.setAttribute('aria-expanded', 'false');
  btnSoundboard.classList.remove('primary');
  btnSoundboard.classList.add('off');
}

const isSoundboardOpen = () => !$sb('soundboard-panel').classList.contains('hidden');

function voiceServerId() {
  const info = channelInfo(currentVoiceRoom);
  return info ? info.server.id : null;
}

function openSoundboard() {
  if (!currentVoiceRoom) return;
  closeMusicPanel();
  $sb('soundboard-panel').classList.remove('hidden');
  btnSoundboard.setAttribute('aria-expanded', 'true');
  btnSoundboard.classList.add('primary');
  btnSoundboard.classList.remove('off');
  $sb('soundboard-volume').value = String(soundboardVolume);
  $sb('soundboard-volume-value').textContent = String(soundboardVolume);
  $sb('soundboard-enabled').checked = soundboardEnabled;
  $sb('soundboard-error').textContent = '';
  loadSoundboard();
}

function loadSoundboard() {
  const serverId = voiceServerId();
  soundboardServerId = serverId;
  if (!serverId) { soundboardSounds = []; renderSoundboard(); return; }
  socket.emit('soundboard-list', { serverId }, (res) => {
    if (res && res.success && soundboardServerId === serverId) soundboardSounds = res.sounds || [];
    renderSoundboard();
  });
  renderSoundboard();
}

function soundButton({ id, name, deletable }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sound-btn';
  b.dataset.sound = id;
  b.title = `Tocar "${name}" para todos na voz`;
  b.appendChild(VoxIcons.icon('audio-lines', 14));
  const label = document.createElement('span');
  label.className = 'sound-name';
  label.textContent = name;
  b.appendChild(label);
  if (deletable) {
    const del = document.createElement('span');
    del.className = 'sound-del';
    del.setAttribute('role', 'button');
    del.title = 'Apagar som';
    del.appendChild(VoxIcons.icon('x', 12));
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteSound(id, name); });
    b.appendChild(del);
  }
  b.addEventListener('click', () => playSoundboard(id));
  return b;
}

function renderSoundboard() {
  const panel = $sb('soundboard-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  $sb('soundboard-builtin').replaceChildren(...SBSynth.BUILTIN.map((s) => soundButton({ id: s.id, name: s.name })));
  const server = serverById(soundboardServerId);
  const manager = server && ['owner', 'admin'].includes(server.role);
  const inServer = !!soundboardServerId;
  panel.querySelector('.soundboard-server-title').textContent = inServer ? `Sons de ${server ? server.name : 'este servidor'}` : 'Sons do servidor';
  $sb('soundboard-custom').replaceChildren(...soundboardSounds.map((s) => soundButton({ id: s.id, name: s.name, deletable: manager || s.by === currentUser })));
  const empty = $sb('soundboard-custom-empty');
  empty.textContent = inServer ? 'Nenhum som ainda. Envie o primeiro!' : 'Na chamada direta só há os sons do Vox.';
  empty.classList.toggle('hidden', soundboardSounds.length > 0);
  $sb('soundboard-add').classList.toggle('hidden', !inServer);
}

function playSoundboard(id) {
  socket.emit('soundboard-play', { soundId: id }, (res) => {
    if (res && !res.success) $sb('soundboard-status').textContent = res.message || 'Não foi possível tocar.';
  });
}

async function deleteSound(id, name) {
  if (!window.confirm(`Apagar o som "${name}" do servidor?`)) return;
  const res = await request('soundboard-delete', { serverId: soundboardServerId, soundId: id });
  if (!res.success) $sb('soundboard-error').textContent = res.message || 'Não foi possível apagar.';
}

function soundBuffer(ctx, file) {
  if (!soundBuffers.has(file)) {
    const p = fetch(`${SERVER_URL}/soundboard/${encodeURIComponent(file)}`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((buf) => ctx.decodeAudioData(buf));
    p.catch(() => soundBuffers.delete(file)); // tenta de novo na próxima vez
    soundBuffers.set(file, p);
  }
  return soundBuffers.get(file);
}

socket.on('soundboard-played', async (p) => {
  if (!p || !currentVoiceRoom) return;
  $sb('soundboard-status').textContent = p.by ? `${p.by} tocou "${p.name}"` : `Tocou "${p.name}"`;
  const btn = document.querySelector(`.sound-btn[data-sound="${CSS.escape(p.id)}"]`);
  if (btn) { btn.classList.add('playing'); setTimeout(() => btn.classList.remove('playing'), 900); }
  if (!soundboardEnabled || soundboardVolume === 0) return;
  try {
    const { ctx, dest } = ensureSoundOutput();
    const volume = soundboardVolume / 100;
    if (p.builtin) { SBSynth.playBuiltin(ctx, dest, p.id, volume); return; }
    if (!SB.isSoundFile(p.file)) return;
    const buffer = await soundBuffer(ctx, p.file);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = volume;
    src.connect(gain).connect(dest);
    src.start();
  } catch (e) {
    console.warn('Soundboard: não foi possível tocar', e);
  }
});

socket.on('soundboard-updated', ({ serverId, sounds } = {}) => {
  if (serverId !== soundboardServerId) return;
  soundboardSounds = Array.isArray(sounds) ? sounds : [];
  renderSoundboard();
});

btnSoundboard.addEventListener('click', () => (isSoundboardOpen() ? closeSoundboard() : openSoundboard()));
$sb('soundboard-close').addEventListener('click', closeSoundboard);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isSoundboardOpen() && fullscreenView.classList.contains('hidden')) closeSoundboard();
});

$sb('soundboard-volume').addEventListener('input', (e) => {
  soundboardVolume = clampNumber(e.target.value, 0, 100, 70);
  $sb('soundboard-volume-value').textContent = String(soundboardVolume);
  try { localStorage.setItem('vox-soundboard-volume', String(soundboardVolume)); } catch (err) {}
});
$sb('soundboard-enabled').addEventListener('change', (e) => {
  soundboardEnabled = e.target.checked;
  try { localStorage.setItem('vox-soundboard-enabled', soundboardEnabled ? '1' : '0'); } catch (err) {}
});

/* ---------- Enviar som ---------- */
$sb('soundboard-pick').addEventListener('click', () => $sb('soundboard-file').click());

$sb('soundboard-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  const err = $sb('soundboard-error');
  err.textContent = '';
  if (!file) return;
  const type = file.type === 'audio/mp3' ? 'audio/mpeg' : file.type;
  if (!SB.audioExtension(type)) { err.textContent = 'Use um arquivo MP3, OGG, WAV ou WebM.'; return; }
  if (file.size > SB.MAX_BYTES) { err.textContent = 'O arquivo passa de 1 MB.'; return; }
  try {
    const data = await file.arrayBuffer();
    const { ctx } = ensureSoundOutput();
    const decoded = await ctx.decodeAudioData(data.slice(0)); // decodeAudioData consome o buffer
    if (decoded.duration > SB.MAX_SECONDS + 0.25) {
      err.textContent = `O som tem ${decoded.duration.toFixed(1)} s; o limite é ${SB.MAX_SECONDS} s.`;
      return;
    }
    pendingSoundFile = { data, type, duration: decoded.duration };
    $sb('soundboard-name').value = file.name.replace(/\.[^.]+$/, '').slice(0, SB.MAX_NAME);
    $sb('soundboard-form').classList.remove('hidden');
    $sb('soundboard-name').focus();
    $sb('soundboard-name').select();
  } catch (e2) {
    err.textContent = 'Não consegui ler esse áudio.';
  }
});

async function sendSound() {
  if (!pendingSoundFile || !soundboardServerId) return;
  const err = $sb('soundboard-error');
  const btn = $sb('soundboard-send');
  btn.disabled = true;
  const res = await request('soundboard-add', { serverId: soundboardServerId, name: $sb('soundboard-name').value, ...pendingSoundFile });
  btn.disabled = false;
  if (!res.success) { err.textContent = res.message || 'Não foi possível enviar.'; return; }
  pendingSoundFile = null;
  $sb('soundboard-form').classList.add('hidden');
  err.textContent = '';
}
$sb('soundboard-send').addEventListener('click', sendSound);
$sb('soundboard-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendSound(); });

/* ================= BANDEJA (ÍCONE AO LADO DO RELÓGIO) ================= */
const closeToTrayToggle = document.getElementById('close-to-tray');
let closeToTray = localStorage.getItem('vox-close-to-tray') !== '0';
closeToTrayToggle.checked = closeToTray;
window.electronAPI.setCloseToTray(closeToTray);
closeToTrayToggle.addEventListener('change', () => {
  closeToTray = closeToTrayToggle.checked;
  try { localStorage.setItem('vox-close-to-tray', closeToTray ? '1' : '0'); } catch (e) {}
  window.electronAPI.setCloseToTray(closeToTray);
});
// Iniciar com o Windows (quem guarda é o próprio Windows; o main responde o estado real)
const autostartToggle = document.getElementById('autostart');
function renderAutostart(s) {
  autostartToggle.checked = !!(s && s.enabled);
  autostartToggle.disabled = !(s && s.supported);
  if (s && !s.supported) {
    document.getElementById('autostart-hint').textContent = 'Disponível só no Vox instalado (não no modo de desenvolvimento).';
  }
}
window.electronAPI.getAutostart().then(renderAutostart);
autostartToggle.addEventListener('change', async () => {
  renderAutostart(await window.electronAPI.setAutostart(autostartToggle.checked));
});

// "Mutar microfone" no menu do ícone
window.electronAPI.onTrayToggleMic(() => { if (currentVoiceRoom) toggleMic(); });
pushTrayState();

/* ================= DIAGNÓSTICO DE VÍDEO (Ctrl+Shift+D) ================= */
// Mostra, por participante, o que sai e o que chega: fps, resolução, banda,
// codec e o motivo de limitação reportado pelo WebRTC.
let statsHud = null;
let statsTimer = null;
const statsPrev = new Map(); // `${peerId}:${statId}` -> { bytes, ts }

function kbpsFor(key, bytes, ts) {
  const prev = statsPrev.get(key);
  statsPrev.set(key, { bytes, ts });
  if (!prev || ts <= prev.ts) return 0;
  return Math.round(((bytes - prev.bytes) * 8) / (ts - prev.ts));
}

async function updateStatsHud() {
  const lines = [];
  for (const [id, pc] of peers) {
    const user = userMap.get(id);
    lines.push(`▸ ${user ? user.username : id.slice(0, 6)}  (${pc.connectionState})`);
    let report;
    try { report = await pc.getStats(); } catch (e) { continue; }
    const codecs = new Map();
    report.forEach((r) => { if (r.type === 'codec') codecs.set(r.id, r.mimeType.replace('video/', '')); });
    report.forEach((r) => {
      if (r.kind !== 'video') return;
      if (r.type === 'outbound-rtp' && r.framesEncoded) {
        const kbps = kbpsFor(`${id}:${r.id}`, r.bytesSent, r.timestamp);
        const encMs = r.framesEncoded ? ((r.totalEncodeTime * 1000) / r.framesEncoded).toFixed(1) : '-';
        lines.push(`  envio   ${r.frameWidth || '?'}x${r.frameHeight || '?'} ${r.framesPerSecond || 0}fps ${kbps}kbps ` +
          `${codecs.get(r.codecId) || '?'} enc ${encMs}ms lim:${r.qualityLimitationReason}`);
      }
      if (r.type === 'inbound-rtp' && r.framesDecoded) {
        const kbps = kbpsFor(`${id}:${r.id}`, r.bytesReceived, r.timestamp);
        const jb = r.jitterBufferEmittedCount ? Math.round((r.jitterBufferDelay * 1000) / r.jitterBufferEmittedCount) : 0;
        lines.push(`  recebe  ${r.frameWidth || '?'}x${r.frameHeight || '?'} ${r.framesPerSecond || 0}fps ${kbps}kbps ` +
          `${codecs.get(r.codecId) || '?'} jb ${jb}ms perdidos ${r.packetsLost || 0} travadas ${r.freezeCount || 0}`);
      }
    });
  }
  if (statsHud) statsHud.textContent = lines.length ? lines.join('\n') : 'Sem conexões de mídia.';
}

function toggleStatsHud() {
  if (statsHud) {
    clearInterval(statsTimer);
    statsHud.remove();
    statsHud = null;
    statsPrev.clear();
    return;
  }
  statsHud = document.createElement('pre');
  statsHud.style.cssText = 'position:fixed;top:40px;right:12px;z-index:9999;margin:0;padding:8px 10px;' +
    'background:rgba(0,0,0,.8);color:#9f9;font:11px/1.4 monospace;border-radius:6px;pointer-events:none;white-space:pre;';
  document.body.appendChild(statsHud);
  updateStatsHud();
  statsTimer = setInterval(updateStatsHud, 1000);
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
    e.preventDefault();
    toggleStatsHud();
  }
});

/* ================= INICIALIZAÇÃO ================= */
updateControlButtons();
updateVoiceDependentControls();
updateMyStatusUI();
resetIdleTimer();
renderTiles();
renderMembers();
