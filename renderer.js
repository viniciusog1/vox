const SERVER_URL = localStorage.getItem('concord-server-url') || 'http://127.0.0.1:3000';
const socket = io(SERVER_URL);

/* ================= REFERÊNCIAS DOM ================= */
const authScreen = document.getElementById('auth-screen');
const roomScreen = document.getElementById('room-screen');
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

const btnJoin = document.getElementById('btn-join');
const inputRoom = document.getElementById('input-room');
const roomStatus = document.getElementById('room-status');
const roomUserInfo = document.getElementById('room-user-info');

const myAvatar = document.getElementById('my-avatar');
const myName = document.getElementById('my-name');
const btnMicMini = document.getElementById('btn-mic-mini');

const channelName = document.getElementById('channel-name');
const videoGrid = document.getElementById('video-grid');
const callEmpty = document.getElementById('call-empty');
const audioLevelEl = document.getElementById('audio-level');
const audioLabel = document.getElementById('audio-label');

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
let currentUser = '';
let currentRoom = '';
let activeChannelEl = null;

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

let audioContext = null;
let rafId = null;
let lastUsersSignature = '';

// Processamento de áudio do microfone
let micPipeline = null;
let micProcessedTrack = null;
let noiseSuppressionMode = localStorage.getItem('concord-noise-suppression') || 'strong';
let noiseGateLevelValue = Number(localStorage.getItem('concord-noise-gate-level') || 35);
const noiseGateContexts = new WeakSet();

// Tela cheia
let fullscreenStream = null;
let fullscreenMuteTimer = null;

// Qualidade do compartilhamento de tela
let shareResolution = localStorage.getItem('concord-share-resolution') || '1080';
let shareFps = Number(localStorage.getItem('concord-share-fps') || 30) === 60 ? 60 : 30;

let statusMode = 'online'; // online | busy | invisible
let autoAway = false;
let idleTimer = null;
const IDLE_MS = 5 * 60 * 1000;

let monitorEnabled = localStorage.getItem('monitorEnabled') === '1';
let audioInputId = localStorage.getItem('audioInputId') || '';
let audioOutputId = localStorage.getItem('audioOutputId') || '';

const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
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

function effectiveStatus() {
  return statusMode === 'online' && autoAway ? 'away' : statusMode;
}

function updateMyStatusUI() {
  const s = effectiveStatus();
  myStatusEl.textContent = STATUS_LABELS[s] || 'Online';
  myStatusEl.style.color =
    s === 'busy' ? 'var(--red)' :
    s === 'away' ? 'var(--yellow)' :
    s === 'invisible' ? 'var(--muted)' : 'var(--green)';
  myStatusDot.className = 'status-dot ' + s;
}

function sendStatus() {
  socket.emit('update-state', { muted: !micEnabled, status: effectiveStatus() });
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (statusMode === 'online') {
      autoAway = true;
      updateMyStatusUI();
      sendStatus();
    }
  }, IDLE_MS);
}

function markActive() {
  if (autoAway) {
    autoAway = false;
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
  roomScreen.style.display = 'none';
}

function showRoomScreen() {
  authScreen.style.display = 'none';
  roomScreen.style.display = 'flex';
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
    serverStatus.style.color = 'var(--red)';
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
  serverStatus.style.color = 'var(--green)';
});
socket.on('connect_error', () => {
  serverStatus.textContent = 'Sem conexão. Confira o endereço do servidor.';
  serverStatus.style.color = 'var(--red)';
});
socket.on('disconnect', () => {
  serverStatus.textContent = 'Desconectado do servidor.';
  serverStatus.style.color = 'var(--red)';
});

if (socket.connected) {
  serverStatus.textContent = `Conectado: ${SERVER_URL}`;
  serverStatus.style.color = 'var(--green)';
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
  socket.emit('register', { username, password }, (res) => {
    btnRegister.disabled = false;
    if (!res.success) { errorRegister.textContent = res.message; return; }
    setMyIdentity(res.username);
    roomUserInfo.textContent = `Logado como ${res.username}`;
    showRoomScreen();
  });
});

function doLogin() {
  const username = loginUser.value.trim();
  const password = loginPass.value;

  if (!username || !password) { errorLogin.textContent = 'Preencha todos os campos'; return; }
  if (!socket.connected) { errorLogin.textContent = 'Sem conexão com o servidor. Confira o endereço abaixo.'; return; }

  btnLogin.disabled = true;
  socket.emit('login', { username, password }, (res) => {
    btnLogin.disabled = false;
    if (!res.success) { errorLogin.textContent = res.message; return; }
    setMyIdentity(res.username);
    roomUserInfo.textContent = `Logado como ${res.username}`;
    showRoomScreen();
  });
}

btnLogin.addEventListener('click', doLogin);
loginPass.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
regPass2.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnRegister.click(); });

/* ================= MÍDIA LOCAL ================= */
async function ensureLocalMedia() {
  if (localStream) return localStream;

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

/* ================= PEERS (WebRTC) ================= */
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
      e.track.addEventListener('mute', renderTiles);
      e.track.addEventListener('unmute', renderTiles);
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

/* ================= ENTRAR / TROCAR CANAL ================= */
let joinToken = 0;

async function joinRoom(room) {
  if (!room) return;
  if (room === currentRoom) return;

  const token = ++joinToken;
  ensureAudioContext();

  if (currentRoom) socket.emit('leave-room', currentRoom);

  closeAllPeers();
  userMap.clear();
  lastUsersSignature = '';
  messagesEl.innerHTML = '';
  currentRoom = room;
  channelName.textContent = VOICE_NAMES[room] || room;
  channelIcon.textContent = room.startsWith('voz-') ? '🔊' : '#';
  msgInput.placeholder = `Enviar mensagem em ${roomDisplayName(room)}`;
  voiceConnName.textContent = 'Conectado a ' + roomDisplayName(room);
  voiceConnection.classList.remove('hidden');

  await ensureLocalMedia();
  if (token !== joinToken) return; // outra troca de canal começou

  socket.emit('join-room', room);
  sendStatus();
  reloadMessages();
  updateMonitor();

  updateActiveChannel();
  hideOverlays();
  renderTiles();
  renderMembers();
  startAudioLoop();
}

function updateActiveChannel() {
  document.querySelectorAll('.channel').forEach((el) => {
    const isText = !el.classList.contains('voice');
    el.classList.toggle('active', el.dataset.room === currentRoom && (activeChannelEl ? el === activeChannelEl : isText));
  });
}

btnJoin.addEventListener('click', () => {
  const room = (inputRoom.value.trim() || 'geral').toLowerCase().replace(/\s+/g, '-');
  roomStatus.textContent = 'Entrando...';
  activeChannelEl = document.querySelector(`.channel[data-room="${room}"]:not(.voice)`) || null;
  joinRoom(room).then(() => { roomStatus.textContent = ''; });
});

/* ================= CANAIS ================= */
document.querySelectorAll('.channel').forEach((el) => {
  el.addEventListener('click', () => {
    activeChannelEl = el;
    if (el.dataset.room === currentRoom) {
      updateActiveChannel();
      return;
    }
    joinRoom(el.dataset.room);
  });
});

/* ================= SINALIZAÇÃO ================= */
socket.on('user-joined', async (id) => {
  if (effectiveStatus() === 'invisible') return;
  try {
    const pc = createPeer(id);
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
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', { to: from, data: { answer } });
    } else if (data.answer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      await flushCandidates(pc);
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
  const users = [...userMap.values()];

  // Inclui você mesmo, caso o servidor ainda não tenha enviado a lista
  if (users.length === 0 && currentUser) {
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
      const dot = document.createElement('span');
      dot.className = 'status-dot ' + (u.status || 'online');
      dot.style.width = '8px';
      dot.style.height = '8px';
      line.appendChild(dot);
      line.appendChild(document.createTextNode(u.username));
      if (u.muted) {
        const mute = document.createElement('span');
        mute.textContent = '🔇';
        mute.style.marginLeft = '4px';
        mute.style.fontSize = '11px';
        line.appendChild(mute);
      }
      listEl.appendChild(line);
    });

    listEl.style.display = list.length ? '' : 'none';
  });
}

/* ================= TILES DE VÍDEO ================= */
function renderTiles() {
  videoGrid.innerHTML = '';
  callEmpty.style.display = 'none';

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
        <div style="font-size:12px;">Compartilhe o canal #${currentRoom} com seus amigos.</div>
      </div>`;
    videoGrid.appendChild(empty);
  }

  applyOutputDevice();
}

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
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = !!opts.muted;
    video.volume = getPeerVolume(peerKey);
    video.srcObject = stream;
    if (opts.remote) video.classList.add('remote-video');
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

function startAudioLoop() {
  if (rafId) return;
  const loop = () => {
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
  try {
    const constraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } };
    if (id) constraints.audio.deviceId = { exact: id };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    const newTrack = newStream.getAudioTracks()[0];
    if (!newTrack) return;

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
  if (!currentRoom) {
    settingsError.textContent = 'Entre em um canal primeiro.';
    return;
  }
  if (!window.confirm('Apagar todas as suas mensagens deste canal?')) return;

  socket.emit('delete-my-messages', { room: currentRoom }, (res) => {
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
  if (!localStream) {
    try {
      const camOnly = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 }
      });
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
    const track = camStream.getVideoTracks()[0];
    if (!track) return false;

    localStream.addTrack(track);

    // Se estiver compartilhando tela, a câmera fica pronta para quando parar.
    if (!sharingScreen) {
      peers.forEach((pc) => {
        const transceiver = pc.getTransceivers().find(
          (t) => t.receiver && t.receiver.track && t.receiver.track.kind === 'video'
        );
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
      const transceiver = pc.getTransceivers().find(
        (t) => t.receiver && t.receiver.track && t.receiver.track.kind === 'video'
      );
      if (transceiver && transceiver.sender) transceiver.sender.replaceTrack(null);
    });
  }
}

btnCam.addEventListener('click', async () => {
  btnCam.disabled = true;
  try {
    if (camEnabled) {
      camEnabled = false;
      disableCamera();
    } else {
      camEnabled = await enableCamera();
    }
  } finally {
    btnCam.disabled = false;
    updateControlButtons();
    renderTiles();
  }
});

/* ================= COMPARTILHAMENTO DE TELA ================= */
let pendingShare = false;

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
  if (!currentRoom) return;

  pendingShare = true;
  btnScreen.disabled = true;

  try {
    ensureAudioContext();
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: currentShareVideoConstraints(),
      audio: false
    });

    sharingScreen = true;
    replaceVideoTrackEverywhere(screenStream.getVideoTracks()[0], screenStream);
    renderTiles();

    btnScreen.textContent = '⏹️ Parar';
    btnScreen.classList.remove('warn');
    btnScreen.classList.add('danger');

    screenStream.getVideoTracks()[0].addEventListener('ended', stopScreenShare);
  } catch (e) {
    console.warn('Compartilhamento cancelado ou falhou:', e);
  } finally {
    pendingShare = false;
    btnScreen.disabled = false;
  }
});

function replaceVideoTrackEverywhere(track, stream) {
  peers.forEach((pc) => {
    const transceiver = pc.getTransceivers().find(
      (t) => t.receiver && t.receiver.track && t.receiver.track.kind === 'video'
    );
    if (transceiver && transceiver.sender) transceiver.sender.replaceTrack(track);
    else if (track) pc.addTrack(track, stream);
  });
}

function stopScreenShare() {
  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  sharingScreen = false;

  const camTrack = localStream ? localStream.getVideoTracks()[0] : null;
  replaceVideoTrackEverywhere(camTrack || null, localStream);

  btnScreen.textContent = '🖥️ Tela';
  btnScreen.classList.remove('danger');
  btnScreen.classList.add('warn');
  renderTiles();
}

/* ================= SELETOR DE TELA ================= */
window.electronAPI.onDisplaySources((sources) => {
  if (!pendingShare) return;
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
  if (!currentRoom) return;
  socket.emit('get-messages', currentRoom, (rows) => {
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
  if (!text || !currentRoom) return;
  socket.emit('save-message', { room: currentRoom, user: currentUser, text });
  appendMessage(currentUser, text, true);
  msgInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

socket.on('new-message', (m) => {
  appendMessage(m.user, m.text, m.user === currentUser);
});

/* ================= SAIR ================= */
function leaveCall() {
  if (currentRoom) socket.emit('leave-room', currentRoom);
  closeAllPeers();

  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (monitorAudio) monitorAudio.srcObject = null;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  analysers.clear();
  destroyMicProcessing();
  closeFullscreenView();

  if (audioContext) {
    try { audioContext.close(); } catch (e) {}
    audioContext = null;
  }

  sharingScreen = false;
  camEnabled = false;
  currentRoom = '';
  activeChannelEl = null;
  userMap.clear();
  lastUsersSignature = '';

  messagesEl.innerHTML = '';
  roomStatus.textContent = '';
  audioLevelEl.style.width = '0%';
  audioLabel.textContent = 'Ninguém falando';

  voiceConnection.classList.add('hidden');
  channelIcon.textContent = '#';
  channelName.textContent = 'geral';

  updateControlButtons();
  document.querySelectorAll('.channel').forEach((el) => el.classList.remove('active'));
  renderTiles();
  renderMembers();
  showRoomScreen();
}

btnHangup.addEventListener('click', leaveCall);
btnLeaveVoice.addEventListener('click', leaveCall);

function logout() {
  if (!window.confirm('Sair da conta?')) return;
  socket.emit('logout');
  leaveCall();
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
  roomScreen.style.display = 'none';
}

if (btnLogout) btnLogout.addEventListener('click', logout);

/* ================= JANELA ================= */
btnMin.addEventListener('click', () => window.electronAPI.minimize());
btnMax.addEventListener('click', () => window.electronAPI.maximize());
btnClose.addEventListener('click', () => window.electronAPI.close());

/* ================= INICIALIZAÇÃO ================= */
updateControlButtons();
updateMyStatusUI();
resetIdleTimer();
renderTiles();
renderMembers();
