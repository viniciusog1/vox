const SERVER_URL = localStorage.getItem('concord-server-url') || 'http://127.0.0.1:3000';
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
const audioLevelEl = document.getElementById('audio-level');
const audioLabel = document.getElementById('audio-label');
const audioIndicator = document.getElementById('audio-indicator');

const messagesEl = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');

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

const btnMin = document.getElementById('btn-min');
const btnMax = document.getElementById('btn-max');
const btnClose = document.getElementById('btn-close');

const sourceList = document.getElementById('source-list');
const sourceCancel = document.getElementById('source-cancel');
const shareResolutionSelect = document.getElementById('share-resolution');
const shareFpsSelect = document.getElementById('share-fps');

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
const monitorAudio = document.getElementById('monitor-audio');
const clearMyMessages = document.getElementById('clear-my-messages');
const settingsError = document.getElementById('settings-error');
const noiseSuppressionSelect = document.getElementById('noise-suppression');
const noiseGateLevel = document.getElementById('noise-gate-level');
const noiseGateValue = document.getElementById('noise-gate-value');
const noiseGateField = document.getElementById('noise-gate-field');

const fullscreenView = document.getElementById('fullscreen-view');
const fullscreenVideo = document.getElementById('fullscreen-video');
const fullscreenName = document.getElementById('fullscreen-name');
const fullscreenClose = document.getElementById('fullscreen-close');
const fullscreenNative = document.getElementById('fullscreen-native');

/* ================= ESTADO ================= */
const { DEFAULT_TEXT_CHANNEL, DEFAULT_VOICE_CHANNEL, isTextChannel, isVoiceChannel } = window.ConcordChannels;
const { PROTOCOL_VERSION, VERSION_MISMATCH_MESSAGE, isCompatible } = window.ConcordProtocol;
const { targetPositionMs, needsSeek } = window.ConcordMusic;
const NO_VOICE_TEXT = 'Você não está em um canal de voz';

let currentUser = '';
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
try { peerVolumes = JSON.parse(localStorage.getItem('concord-peer-volumes') || '{}') || {}; } catch (e) { peerVolumes = {}; }

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
}

function setPeerVolume(name, vol) {
  peerVolumes[name] = vol;
  localStorage.setItem('concord-peer-volumes', JSON.stringify(peerVolumes));
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
let noiseSuppressionMode = localStorage.getItem('concord-noise-suppression') || 'strong';
let noiseGateLevelValue = Number(localStorage.getItem('concord-noise-gate-level') || 35);
const noiseGateContexts = new WeakSet();

// Música do YouTube na chamada
let musicState = null;     // último music-state recebido (+ receivedAt = Date.now() local); null = sem música
let musicPlayer = null;    // instância YT.Player ou null
let musicTileEl = null;    // tile persistente com o player: renderTiles nunca o remove nem o move
let musicPlayerReady = false;
let musicLoadedItemId = null; // item da fila carregado no player
let musicPlayerGen = 0;       // invalida criações de player pendentes (API ainda carregando)
let youTubeApiPromise = null;

// Tela cheia
let fullscreenStream = null;
let fullscreenMuteTimer = null;

// Qualidade do compartilhamento de tela
let shareResolution = localStorage.getItem('concord-share-resolution') || '1080';
let shareFps = Number(localStorage.getItem('concord-share-fps') || 30) === 60 ? 60 : 30;

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

function makeAvatar(name, extraClass = '') {
  const el = document.createElement('div');
  el.className = 'avatar ' + extraClass;
  el.textContent = initials(name);
  el.style.background = avatarColor(name || '?');
  return el;
}

function setMyIdentity(name) {
  currentUser = name;
  myName.textContent = name;
  myAvatar.textContent = initials(name);
  myAvatar.style.background = avatarColor(name);
  document.getElementById('empty-avatar').textContent = initials(name);
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

const presence = window.ConcordPresence;

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
function enterApp(username) {
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

  localStorage.setItem('concord-server-url', url);
  serverStatus.textContent = 'Conectando...';
  serverStatus.style.color = 'var(--muted)';
  location.reload();
}

serverApply.addEventListener('click', applyServerUrl);
serverUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyServerUrl(); });

socket.on('connect', () => {
  serverStatus.textContent = `Conectado: ${SERVER_URL}`;
  serverStatus.style.color = 'var(--ok-text)';
});
socket.on('connect_error', () => {
  serverStatus.textContent = 'Sem conexão. Confira o endereço do servidor.';
  serverStatus.style.color = 'var(--danger-text)';
});
socket.on('disconnect', () => {
  serverStatus.textContent = 'Desconectado do servidor.';
  serverStatus.style.color = 'var(--danger-text)';
});

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
    enterApp(res.username);
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
    enterApp(res.username);
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

async function acquireLocalMedia() {
  const audioBase = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
    channelCount: 1
  };
  const savedAudio = { ...audioBase };
  if (audioInputId) savedAudio.deviceId = { exact: audioInputId };
  const defaultAudio = { ...audioBase };

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
  btnMic.textContent = micEnabled ? '🎙️ Mic' : '🔇 Mic';
  btnMic.classList.toggle('off', !micEnabled);
  btnMic.classList.toggle('primary', micEnabled);

  btnCam.textContent = camEnabled ? '📷 Cam' : '📷 Cam Off';
  btnCam.classList.toggle('off', !camEnabled);
  btnCam.classList.toggle('primary', camEnabled);

  btnMicMini.textContent = micEnabled ? '🎙️' : '🔇';
  btnMicMini.classList.toggle('off', !micEnabled);
}

// Câmera, tela e ✕ só funcionam com voz conectada; o microfone continua livre.
// Cam e Tela também ficam travados enquanto um pedido de câmera/tela está em andamento.
function updateVoiceDependentControls() {
  const noVoice = !currentVoiceRoom;
  [btnCam, btnScreen, btnHangup].forEach((btn) => {
    if (noVoice) btn.title = 'Entre em um canal de voz';
    else btn.title = btn.dataset.title || btn.title;
  });
  btnCam.disabled = noVoice || pendingCam;
  btnScreen.disabled = noVoice || pendingShare;
  btnHangup.disabled = noVoice;
}
[btnCam, btnScreen, btnHangup].forEach((btn) => { btn.dataset.title = btn.title; });

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
    if (negotiated.direction === 'recvonly') negotiated.direction = 'sendrecv';
  }
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

  pc._pendingCandidates = [];

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('signal', { to: id, data: { candidate: e.candidate } });
  };

  pc.ontrack = (e) => {
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

  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        remoteStreams.delete(id);
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
  remoteStreams.clear();
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
  voiceConnName.textContent = 'Conectado a ' + roomDisplayName(room);
  voiceConnection.classList.remove('hidden');
  updateActiveChannel();
  updateVoiceDependentControls();

  await ensureLocalMedia();
  if (token !== joinToken) {
    // Saiu da voz enquanto o microfone abria: não deixa a mídia ligada sem chamada.
    if (!currentVoiceRoom) stopLocalMedia();
    return; // outra troca de canal começou
  }

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
    } else if (data.answer) {
      await pc.setRemoteDescription(withVideoBitrateHints(data.answer));
      await flushCandidates(pc);
      applyVideoSenderParams(pc);
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

  // Remove conexões de pessoas que saíram da sala
  let removed = false;
  const ids = new Set(list.map((u) => u.id));
  [...peers.keys()].forEach((id) => {
    if (!ids.has(id)) {
      try { peers.get(id).close(); } catch (e) {}
      peers.delete(id);
      remoteStreams.delete(id);
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

function renderMembers() {
  memberList.innerHTML = '';
  const users = currentVoiceRoom ? [...userMap.values()] : [];

  if (!currentVoiceRoom) {
    const empty = document.createElement('div');
    empty.className = 'members-empty';
    empty.textContent = NO_VOICE_TEXT;
    memberList.appendChild(empty);
  }

  // Inclui você mesmo, caso o servidor ainda não tenha enviado a lista
  if (currentVoiceRoom && users.length === 0 && currentUser) {
    users.push({ id: 'me', username: currentUser, muted: !micEnabled });
  }

  memberCount.textContent = users.length;

  users.forEach((u) => {
    const isMe = u.username === currentUser;
    const row = document.createElement('div');
    row.className = 'member';
    row.appendChild(makeAvatar(u.username));

    const name = document.createElement('div');
    name.className = 'member-name';

    const dot = document.createElement('span');
    dot.className = 'status-dot ' + (u.status || 'online');
    dot.style.marginRight = '6px';
    name.appendChild(dot);
    name.appendChild(document.createTextNode(u.username));

    if (isMe) {
      const you = document.createElement('span');
      you.className = 'you';
      you.textContent = '(você)';
      name.appendChild(you);
    }
    row.appendChild(name);
    row.title = STATUS_LABELS[u.status || 'online'] || 'Online';

    const status = document.createElement('span');
    status.className = 'muted-icon';
    status.textContent = u.muted ? '🔇' : '🎙️';
    status.style.opacity = u.muted ? '1' : '.35';
    row.appendChild(status);

    memberList.appendChild(row);
  });

  // Mostra os usuários embaixo do canal de voz correspondente
  document.querySelectorAll('.channel.voice').forEach((channelEl) => {
    const room = channelEl.dataset.room;
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
      if (u.muted) icons.appendChild(document.createTextNode('🔇'));
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
  audioIndicator.style.display = currentVoiceRoom ? '' : 'none';
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
        <div style="font-size:28px;">👋</div>
        <div style="font-weight:600;color:var(--text);">Aguardando alguém entrar...</div>
        <div style="font-size:12px;">Compartilhe o canal ${roomDisplayName(currentVoiceRoom)} com seus amigos.</div>
      </div>`;
    videoGrid.appendChild(empty);
  }

  videoElements.forEach((video, streamId) => {
    if (!usedVideoIds.has(streamId)) {
      video.srcObject = null;
      videoElements.delete(streamId);
    }
  });

  applyOutputDevice();
}

/* ================= MÚSICA DO YOUTUBE ================= */
// Cada pessoa toca o player oficial; o servidor só diz o que toca, se está pausado e o minuto.
const YT_PLAYER_VARS = { controls: 0, disablekb: 1, playsinline: 1, rel: 0 };
const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
const UNPLAYABLE_CODES = [100, 101, 150]; // indisponível / incorporação não permitida

// Volume só local, 0–100 (padrão 50).
function getMusicVolume() {
  const raw = localStorage.getItem('concord-music-volume');
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
  musicTileEl.append(host, label);
  return musicTileEl;
}

// Mostra/esconde o tile e atualiza a faixa; o tile fica sempre como primeiro filho da grade.
function syncMusicTile() {
  const active = !!(currentVoiceRoom && musicState && musicState.queue.length);
  if (!active) {
    if (musicTileEl) musicTileEl.classList.add('hidden');
    return;
  }
  ensureMusicTile();
  // Só entra na grade enquanto ainda não está nela (antes de haver iframe dentro)
  if (musicTileEl.parentNode !== videoGrid) videoGrid.prepend(musicTileEl);
  musicTileEl.classList.remove('hidden');
  const current = musicState.queue[0];
  musicTileEl.querySelector('.music-tile-label').textContent =
    `🎵 ${current.title || current.videoId} · ${musicState.queue.length} na fila`;
}

function destroyMusicPlayer() {
  musicPlayerGen++;
  if (musicPlayer) {
    try { musicPlayer.destroy(); } catch (e) {}
  }
  musicPlayer = null;
  musicPlayerReady = false;
  musicLoadedItemId = null;
  if (musicTileEl) {
    const host = musicTileEl.querySelector('.music-player-host');
    host.innerHTML = '';
    musicTileEl.classList.add('hidden');
  }
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

  const host = musicTileEl.querySelector('.music-player-host');
  const target = document.createElement('div');
  host.appendChild(target);
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

  if (musicLoadedItemId !== item.id) {
    musicLoadedItemId = item.id;
    const opts = { videoId: item.videoId, startSeconds: targetMs / 1000 };
    if (musicState.playing) musicPlayer.loadVideoById(opts);
    else musicPlayer.cueVideoById(opts);
    return;
  }

  const state = musicPlayer.getPlayerState();
  if (state === YT_STATE.ENDED) return; // aguardando o servidor avançar a fila
  // seekTo num vídeo só "cued" começa a tocar; pausado e cued já está no ponto certo
  const seekable = musicState.playing || state === YT_STATE.PAUSED;
  if (seekable && needsSeek(musicPlayer.getCurrentTime() * 1000, targetMs)) {
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
  // Pausa por clique no vídeo (ou play com o estado pausado): volta ao estado compartilhado.
  // Ao começar a tocar também confere o minuto (o carregamento do vídeo atrasa a posição).
  const contradicts = state === YT_STATE.PAUSED && musicState.playing;
  if (contradicts || state === YT_STATE.PLAYING) syncMusicPlayer();
}

function applyMusicState(pub) {
  if (!currentVoiceRoom) return; // música só para quem está na voz
  if (!pub || !Array.isArray(pub.queue) || pub.queue.length === 0) {
    musicState = null;
    destroyMusicPlayer();
    return;
  }
  musicState = { ...pub, receivedAt: Date.now() };
  syncMusicTile();
  if (!musicPlayer) createMusicPlayer(); // onReady aplica o estado
  else syncMusicPlayer();
}

// Sair da voz (ou trocar de canal): a música para para esta pessoa.
function resetMusic() {
  musicState = null;
  destroyMusicPlayer();
}

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
  if (fullscreenVideo) fullscreenVideo.srcObject = null;
  if (fullscreenView) fullscreenView.classList.add('hidden');
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
  if (!document.fullscreenElement && fullscreenStream) {
    clearTimeout(fullscreenMuteTimer);
    fullscreenMuteTimer = null;
    fullscreenStream = null;
    if (fullscreenVideo) fullscreenVideo.srcObject = null;
    if (fullscreenView) fullscreenView.classList.add('hidden');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fullscreenStream && !document.fullscreenElement) {
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
    fullBtn.textContent = '⛶';
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

/* ================= REDUÇÃO DE RUÍDO DO MICROFONE ================= */
const NOISE_GATE_WORKLET = `
class ConcordNoiseGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: 0.015, minValue: 0, maxValue: 1 },
      { name: 'attack', defaultValue: 0.005, minValue: 0.0005, maxValue: 0.5 },
      { name: 'release', defaultValue: 0.18, minValue: 0.01, maxValue: 1.5 },
      { name: 'makeup', defaultValue: 1.0, minValue: 0, maxValue: 4 }
    ];
  }
  constructor() {
    super();
    this.env = 0;
    this.gain = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length || !input[0]) return true;
    const inCh = input[0];
    const outCh = output[0];
    const threshold = parameters.threshold[0];
    const attack = parameters.attack[0];
    const release = parameters.release[0];
    const makeup = parameters.makeup[0];
    const sr = sampleRate;
    const atk = 1 - Math.exp(-1 / Math.max(1, attack * sr));
    const rel = 1 - Math.exp(-1 / Math.max(1, release * sr));
    for (let i = 0; i < inCh.length; i++) {
      const x = inCh[i];
      const abs = Math.abs(x);
      this.env += (abs - this.env) * (abs > this.env ? 0.5 : 0.0006);
      const open = this.env >= threshold;
      this.gain += ((open ? 1 : 0) - this.gain) * (open ? atk : rel);
      outCh[i] = x * this.gain * makeup;
    }
    return true;
  }
}
registerProcessor('concord-noise-gate', ConcordNoiseGate);
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

function gateThreshold() {
  const v = Math.max(0, Math.min(100, noiseGateLevelValue)) / 100;
  return 0.002 + v * 0.038;
}

function destroyMicProcessing() {
  if (micProcessedTrack) {
    try { micProcessedTrack.stop(); } catch (e) {}
    micProcessedTrack = null;
  }
  if (micPipeline) {
    try { micPipeline.source.disconnect(); } catch (e) {}
    try { micPipeline.highpass.disconnect(); } catch (e) {}
    if (micPipeline.gate) { try { micPipeline.gate.disconnect(); } catch (e) {} }
    try { micPipeline.compressor.disconnect(); } catch (e) {}
    try { micPipeline.makeup.disconnect(); } catch (e) {}
    micPipeline = null;
  }
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
  if (noiseSuppressionMode === 'off') return;

  try {
    const ctx = ensureAudioContext();
    const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;
    highpass.Q.value = 0.7;
    source.connect(highpass);

    let last = highpass;
    let gate = null;
    if (noiseSuppressionMode === 'strong') {
      try {
        await ensureNoiseGateWorklet(ctx);
        gate = new AudioWorkletNode(ctx, 'concord-noise-gate', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        gate.parameters.get('threshold').value = gateThreshold();
        last.connect(gate);
        last = gate;
      } catch (e) {
        console.warn('Gate de ruído indisponível, usando apenas filtros:', e);
        gate = null;
      }
    }

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -26;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const makeup = ctx.createGain();
    makeup.gain.value = 1.25;

    const dest = ctx.createMediaStreamDestination();
    dest.channelCount = 1;
    dest.channelCountMode = 'explicit';

    last.connect(compressor);
    compressor.connect(makeup);
    makeup.connect(dest);

    micPipeline = { source, highpass, gate, compressor, makeup, dest };
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

function applyNoiseSuppressionUI() {
  if (noiseSuppressionSelect) noiseSuppressionSelect.value = noiseSuppressionMode;
  if (noiseGateLevel) noiseGateLevel.value = String(noiseGateLevelValue);
  if (noiseGateValue) noiseGateValue.textContent = String(noiseGateLevelValue);
  if (noiseGateField) noiseGateField.style.display = noiseSuppressionMode === 'strong' ? '' : 'none';
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
  const { levelFromAnalyser, createSpeakingState, updateSpeaking } = window.ConcordSpeaking;
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
    if (analysers.size === 0) {
      audioLevelEl.style.width = '0%';
      audioLabel.textContent = 'Ninguém falando';
    } else {
      let max = 0;
      analysers.forEach((analyser) => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < 24; i++) sum += data[i];
        const avg = sum / 24 / 255;
        if (avg > max) max = avg;
      });
      const pct = Math.min(100, Math.round(max * 160));
      audioLevelEl.style.width = pct + '%';
      audioLabel.textContent = pct > 12 ? 'Falando...' : 'Ninguém falando';
    }
    rafId = requestAnimationFrame(loop);
  };
  loop();
}

/* ================= TEMAS ================= */
const themeGrid = document.getElementById('theme-grid');
let themeStorage = null;
try { themeStorage = window.localStorage; } catch (e) {}

function buildThemeOption(theme, currentId) {
  const { themeCssVars, applyTheme, saveThemeId } = window.ConcordThemes;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-option' + (theme.id === currentId ? ' selected' : '');
  btn.dataset.themeId = theme.id;
  btn.setAttribute('aria-pressed', String(theme.id === currentId));

  const thumb = document.createElement('div');
  thumb.className = 'theme-thumb';
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

function renderThemePicker() {
  if (!themeGrid || !window.ConcordThemes) return;
  const currentId = document.documentElement.dataset.theme || window.ConcordThemes.DEFAULT_THEME_ID;
  themeGrid.innerHTML = '';
  [['dark', 'Escuros'], ['light', 'Claros']].forEach(([kind, label]) => {
    const title = document.createElement('div');
    title.className = 'theme-group-title';
    title.textContent = label;
    const row = document.createElement('div');
    row.className = 'theme-row';
    row.dataset.kind = kind;
    window.ConcordThemes.THEMES.filter((t) => t.kind === kind)
      .forEach((t) => row.appendChild(buildThemeOption(t, currentId)));
    themeGrid.append(title, row);
  });
}

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

async function changeInputDevice(id) {
  settingsError.textContent = '';
  // Fora da voz só a preferência é gravada; ela vale na próxima entrada em voz.
  if (!currentVoiceRoom) return;
  const leaves = voiceLeaves;
  try {
    const constraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } };
    if (id) constraints.audio.deviceId = { exact: id };

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
  settingsModal.classList.remove('hidden');
  monitorToggle.checked = monitorEnabled;
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

if (noiseSuppressionSelect) {
  noiseSuppressionSelect.addEventListener('change', async () => {
    noiseSuppressionMode = noiseSuppressionSelect.value;
    localStorage.setItem('concord-noise-suppression', noiseSuppressionMode);
    applyNoiseSuppressionUI();
    await rebuildMicProcessing();
    replaceAudioTrackOnPeers();
    updateMonitor();
  });
}

if (noiseGateLevel) {
  noiseGateLevel.addEventListener('input', () => {
    noiseGateLevelValue = Number(noiseGateLevel.value) || 0;
    localStorage.setItem('concord-noise-gate-level', String(noiseGateLevelValue));
    if (noiseGateValue) noiseGateValue.textContent = String(noiseGateLevelValue);
    if (micPipeline && micPipeline.gate) {
      try { micPipeline.gate.parameters.get('threshold').value = gateThreshold(); } catch (e) {}
    }
  });
}

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
    localStorage.setItem('concord-share-resolution', shareResolution);
  });
}

if (shareFpsSelect) {
  shareFpsSelect.addEventListener('change', () => {
    shareFps = Number(shareFpsSelect.value) === 60 ? 60 : 30;
    localStorage.setItem('concord-share-fps', String(shareFps));
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
      audio: false
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
    renderTiles();

    btnScreen.textContent = '⏹️ Parar';
    btnScreen.classList.remove('warn');
    btnScreen.classList.add('danger');

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

  const camTrack = localStream ? localStream.getVideoTracks()[0] : null;
  replaceVideoTrackEverywhere(camTrack || null, localStream);

  btnScreen.textContent = '🖥️ Tela';
  btnScreen.classList.remove('danger');
  btnScreen.classList.add('warn');
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
      window.electronAPI.selectDisplaySource(src.id);
    });

    sourceList.appendChild(item);
  });

  applyShareQualityUI();
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
function reloadMessages() {
  if (!currentTextRoom) return;
  socket.emit('get-messages', currentTextRoom, (rows) => {
    messagesEl.innerHTML = '';
    if (!rows || rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'msg-user';
      empty.textContent = 'Nenhuma mensagem ainda. Diga olá!';
      messagesEl.appendChild(empty);
      return;
    }
    rows.forEach((m) => appendMessage(m.user, m.text, m.user === currentUser));
  });
}

socket.on('messages-cleared', () => reloadMessages());

function appendMessage(user, text, own) {
  const row = document.createElement('div');
  row.className = 'msg-row' + (own ? ' own' : '');
  row.appendChild(makeAvatar(user));

  const body = document.createElement('div');
  body.className = 'msg-body';

  const name = document.createElement('div');
  name.className = 'msg-user';
  name.textContent = user;

  const content = document.createElement('div');
  content.className = 'msg-text';
  content.textContent = text;

  body.appendChild(name);
  body.appendChild(content);
  row.appendChild(body);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !currentTextRoom) return;
  socket.emit('save-message', { room: currentTextRoom, user: currentUser, text });
  appendMessage(currentUser, text, true);
  msgInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

socket.on('new-message', (m) => {
  appendMessage(m.user, m.text, m.user === currentUser);
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
  if (currentVoiceRoom) socket.emit('leave-voice');
  closeAllPeers();

  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  stopLocalMedia();
  closeFullscreenView();
  resetMusic();

  sharingScreen = false;
  camEnabled = false;
  currentVoiceRoom = '';
  userMap.clear();
  lastUsersSignature = '';

  audioLevelEl.style.width = '0%';
  audioLabel.textContent = 'Ninguém falando';

  btnScreen.textContent = '🖥️ Tela';
  btnScreen.classList.remove('danger');
  btnScreen.classList.add('warn');
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
  leaveVoice();
  currentTextRoom = '';
  messagesEl.innerHTML = '';
  updateActiveChannel();
  currentUser = '';
  voiceRooms = {};
  myName.textContent = '—';
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

/* ================= JANELA ================= */
btnMin.addEventListener('click', () => window.electronAPI.minimize());
btnMax.addEventListener('click', () => window.electronAPI.maximize());
btnClose.addEventListener('click', () => window.electronAPI.close());

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
