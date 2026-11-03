// Ícones estáticos do index.html (<i data-icon>) viram SVG
VoxIcons.hydrate();

const SERVER_URL = localStorage.getItem('vox-server-url') || 'http://127.0.0.1:3000';
const socket = io(SERVER_URL);

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
const updateText = document.getElementById('update-text');
const updateInstall = document.getElementById('update-install');
const notifyModeSelect = document.getElementById('notify-mode');
const tunnelToggle = document.getElementById('tunnel-toggle');
const tunnelStateEl = document.getElementById('tunnel-state');
const tunnelUrlRow = document.getElementById('tunnel-url-row');
const tunnelUrlInput = document.getElementById('tunnel-url');
const tunnelCopy = document.getElementById('tunnel-copy');

const memberList = document.getElementById('member-list');
const memberCount = document.getElementById('member-count');
const voiceConnection = document.getElementById('voice-connection');
const voiceConnName = document.getElementById('voice-conn-name');
const btnLeaveVoice = document.getElementById('btn-leave-voice');
const channelIcon = document.getElementById('channel-icon');

const btnMic = document.getElementById('btn-mic');
const btnCam = document.getElementById('btn-cam');
const btnScreen = document.getElementById('btn-screen');
const btnHangup = document.getElementById('btn-hangup');
const btnMusic = document.getElementById('btn-music');


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
const { DEFAULT_TEXT_CHANNEL, DEFAULT_VOICE_CHANNEL, isTextChannel, isVoiceChannel } = window.VoxChannels;
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

const VOICE_NAMES = {
  'voz-sala': 'Sala Principal',
  'voz-jogos': 'Jogos',
  'voz-musica': 'Música'
};

function roomDisplayName(room) {
  return VOICE_NAMES[room] || '#' + room;
}

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

// Login ou cadastro concluído: entra direto em #geral e na Sala Principal, com microfone aberto.
function enterApp(username, token) {
  sessionToken = token || null;
  unread = {};
  renderUnread();
  setMyIdentity(username);
  micEnabled = true;
  updateControlButtons();
  hideOverlays();
  joinText(DEFAULT_TEXT_CHANNEL);
  joinVoice(DEFAULT_VOICE_CHANNEL);
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
serverUrlInput.value = SERVER_URL;

function applyServerUrl() {
  let url = serverUrlInput.value.trim();
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
  serverStatus.textContent = `Conectado: ${SERVER_URL}`;
  serverStatus.style.color = 'var(--ok-text)';
  if (currentUser && sessionToken) resumeSession();
});
socket.on('connect_error', () => {
  serverStatus.textContent = 'Sem conexão. Confira o endereço do servidor.';
  serverStatus.style.color = 'var(--danger-text)';
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

if (socket.connected) {
  serverStatus.textContent = `Conectado: ${SERVER_URL}`;
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

function updateControlButtons() {
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
  const noVoice = !currentVoiceRoom;
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
    const st = pc.connectionState;
    if (st === 'connected') setPeerConn(id, 'connected');
    else if (st === 'failed') setPeerConn(id, 'failed');
    else if (st === 'disconnected') setPeerConn(id, 'reconnecting');
    else if (st === 'closed') { peerConn.delete(id); updateConnLabel(id); }
    else setPeerConn(id, 'connecting');
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        remoteStreams.delete(id);
        removeScreenAudio(id);
        analysers.delete(id);
        peers.delete(id);
        renderTiles();
      }
    }
    renderTiles();
  };

  return pc;
}

function closeAllPeers() {
  peers.forEach((pc) => { try { pc.close(); } catch (e) {} });
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
  if (!isTextChannel(room) || room === currentTextRoom) return;
  currentTextRoom = room;
  socket.emit('join-text', room);
  channelName.textContent = room;
  channelIcon.textContent = '#';
  msgInput.placeholder = `Enviar mensagem em ${roomDisplayName(room)}`;
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
  if (!isVoiceChannel(room) || room === currentVoiceRoom) return;

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

/* ================= CANAIS ================= */
document.querySelectorAll('.channel').forEach((el) => {
  el.addEventListener('click', () => {
    if (el.classList.contains('voice')) joinVoice(el.dataset.room);
    else joinText(el.dataset.room);
  });
});

/* ================= SINALIZAÇÃO ================= */
socket.on('user-joined', async (id) => {
  if (effectiveStatus() === 'invisible') return;
  try {
    const pc = createPeer(id);
    preferVideoCodecs(pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { to: id, data: { offer } });
  } catch (e) {
    console.error('Erro ao criar oferta:', e);
  }
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
    let pc = peers.get(from);
    if (!pc) pc = createPeer(from);

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
  }

  // Remove conexões de pessoas que saíram da sala
  let removed = false;
  const ids = new Set(list.map((u) => u.id));
  [...peers.keys()].forEach((id) => {
    if (!ids.has(id)) {
      try { peers.get(id).close(); } catch (e) {}
      peers.delete(id);
      peerConn.delete(id);
      remoteStreams.delete(id);
      removeScreenAudio(id);
      analysers.delete(id);
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

function renderMembers() {
  memberList.innerHTML = '';
  memberCount.textContent = serverMembers.length;
  const groups = [['Online', serverMembers.filter((m) => m.online)], ['Offline', serverMembers.filter((m) => !m.online)]];
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
        <div style="font-size:12px;">Compartilhe o canal ${roomDisplayName(currentVoiceRoom)} com seus amigos.</div>
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
  musicPanel.classList.remove('hidden');
  btnMusic.setAttribute('aria-expanded', 'true');
  btnMusic.classList.add('primary');
  btnMusic.classList.remove('off');
  const vol = getMusicVolume();
  musicVolumeInput.value = String(vol);
  musicVolumeValue.textContent = String(vol);
  renderMusicPanel();
  musicUrlInput.focus();
}

function closeMusicPanel() {
  musicPanel.classList.add('hidden');
  btnMusic.setAttribute('aria-expanded', 'false');
  btnMusic.classList.remove('primary');
  btnMusic.classList.add('off');
  musicErrorEl.textContent = '';
}

// Fila, ⏯ e ⏭ conforme o último music-state (chamado a cada music-state).
function renderMusicPanel() {
  const queue = (musicState && musicState.queue) || [];
  musicQueueEl.replaceChildren(...queue.map((item, i) => {
    const row = document.createElement('div');
    row.className = 'music-item' + (i === 0 ? ' current' : '');
    row.dataset.itemId = item.id;
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    if (item.thumbnail) img.src = item.thumbnail;
    const info = document.createElement('div');
    info.className = 'music-item-info';
    const title = document.createElement('div');
    title.className = 'music-item-title';
    title.textContent = item.title || item.videoId;
    title.title = title.textContent;
    const meta = document.createElement('div');
    meta.className = 'music-item-meta';
    const by = `adicionada por ${item.addedBy || 'alguém'}`;
    meta.textContent = i === 0 ? `Tocando agora · ${by}` : by;
    info.append(title, meta);
    const remove = document.createElement('button');
    remove.className = 'music-icon-btn';
    remove.title = 'Tirar da fila';
    VoxIcons.setIcon(remove, 'x', '', 14);
    remove.addEventListener('click', () => socket.emit('music-remove', item.id));
    row.append(img, info, remove);
    return row;
  }));
  musicEmptyEl.classList.toggle('hidden', queue.length > 0);
  musicToggleBtn.disabled = queue.length === 0;
  musicSkipBtn.disabled = queue.length === 0;
  musicToggleBtn.title = musicState && musicState.playing ? 'Pausar para todos' : 'Tocar para todos';
  VoxIcons.setIcon(musicToggleBtn, musicState && musicState.playing ? 'pause' : 'play');
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

function playSoundEffect(name) {
  if (!soundEffectsEnabled) return;
  try {
    if (!soundContext) {
      soundContext = new (window.AudioContext || window.webkitAudioContext)();
      soundDestination = soundContext.createMediaStreamDestination();
      soundAudio.srcObject = soundDestination.stream;
      if (typeof soundAudio.setSinkId === 'function') soundAudio.setSinkId(audioOutputId || '').catch(() => {});
    }
    if (soundContext.state === 'suspended') soundContext.resume();
    soundAudio.play().catch(() => {});
    VoxSounds.playSound(soundContext, soundDestination, name);
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
const IS_LOCAL_SERVER = /^https?:\/\/(127\.0\.0\.1|localhost)(:3000)?$/i.test(SERVER_URL);
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

/* ================= ATUALIZAÇÃO AUTOMÁTICA ================= */
function renderUpdate(s) {
  if (!s || (s.state !== 'downloading' && s.state !== 'ready')) { updateBanner.classList.add('hidden'); return; }
  updateBanner.classList.remove('hidden');
  if (s.state === 'downloading') {
    updateText.textContent = `Baixando o Vox ${s.version || ''}… ${s.percent || 0}%`;
    updateInstall.classList.add('hidden');
  } else {
    updateText.textContent = `O Vox ${s.version || ''} está pronto. Ele instala ao reiniciar (ou quando você fechar o app).`;
    updateInstall.classList.remove('hidden');
  }
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

function memberNames() {
  const names = serverMembers.map((m) => m.username);
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
  document.title = total ? `(${total}) Vox` : 'Vox';
}

function notifyMessage(m, mention) {
  const status = effectiveStatus();
  const focused = document.hasFocus();
  if (mention && status !== 'busy' && !(focused && m.room === currentTextRoom)) playSoundEffect('mention');
  if (!VoxChatRules.shouldNotify({ mode: notifyMode, status, mention, focused, sameRoom: m.room === currentTextRoom })) return;
  if (!focused) window.electronAPI.flashFrame(true);
  if (typeof Notification === 'undefined') return;
  const body = m.text ? m.text.slice(0, 140) : 'Enviou uma imagem';
  const n = new Notification(`${m.user} em #${m.room}`, { body, silent: true });
  n.onclick = () => {
    window.electronAPI.focusWindow();
    joinText(m.room);
  };
}

socket.on('new-message', (m) => {
  if (!m || !currentUser) return;
  const own = m.user === currentUser;
  const mention = !own && Array.isArray(m.mentions) && m.mentions.some((n) => sameName(n, currentUser));
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
