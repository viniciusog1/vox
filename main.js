const { app, BrowserWindow, ipcMain, session, desktopCapturer, Tray, Menu, safeStorage, shell } = require('electron');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { publicUser, applyStatePatch, joinVoiceRoom, leaveVoiceRoom, canUseTextRoom, socketRoomsToLeave } = require('./room-state');
const srv = require('./servers-state');
const fr = require('./friends-state');
const musicHistory = require('./music-history');
const sb = require('./soundboard-state');
const sbSynth = require('./soundboard-synth');
const { parseYouTubeId, lookupVideo } = require('./youtube');
const { RESYNC_INTERVAL_MS, createMusicState, addTrack, removeTrack, advanceIfCurrent, endedIfCurrent, togglePause, toPublic } = require('./music-state');
const { PROTOCOL_VERSION, VERSION_MISMATCH_MESSAGE, isCompatible } = require('./protocol');
const chat = require('./chat-state');
const { createSessionStore } = require('./sessions');
const { createTunnel } = require('./tunnel');
const { createAddressPublisher } = require('./address-publisher');
const { TOKEN_PAGE } = require('./fixed-address');

// ---------- Dados do antigo Concord ----------
// O app se chamava Concord. Na primeira execução como Vox, copia a pasta de dados
// antiga (contas e mensagens do app instalado; localStorage com tema e preferências).
const LEGACY_SKIP = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'Crashpad']);
function migrateLegacyUserData() {
  // O Electron já cria a pasta (vazia) antes deste código rodar; por isso a marca
  // e a checagem de dados próprios do Vox em vez de "a pasta existe".
  const current = app.getPath('userData');
  const marker = path.join(current, '.migrado-do-concord');
  if (fs.existsSync(marker)) return;
  const hasOwnData = ['Local Storage', 'users.json', 'messages.json'].some((n) => fs.existsSync(path.join(current, n)));
  const legacy = ['Concord', 'concord'].map((n) => path.join(app.getPath('appData'), n))
    .find((p) => fs.existsSync(p) && path.resolve(p) !== path.resolve(current));
  try {
    if (!hasOwnData && legacy) {
      fs.cpSync(legacy, current, {
        recursive: true, force: false,
        filter: (src) => !LEGACY_SKIP.has(path.basename(src)) && !path.basename(src).startsWith('Singleton')
      });
    }
    fs.mkdirSync(current, { recursive: true });
    fs.writeFileSync(marker, new Date().toISOString());
  } catch (e) {
    console.error('Falha ao copiar dados do Concord:', e.message);
  }
}
migrateLegacyUserData();

// ---------- Banco simples (arquivos JSON) ----------
// Em desenvolvimento os dados ficam na pasta do projeto.
// No app instalado, ficam na pasta de dados do usuário (o app.asar é somente leitura).
const DATA_DIR = app.isPackaged ? app.getPath('userData') : __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'messages.json');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');
const SERVERS_PATH = path.join(DATA_DIR, 'servers.json');
const FRIENDS_PATH = path.join(DATA_DIR, 'friends.json');
const MUSIC_HISTORY_PATH = path.join(DATA_DIR, 'music-history.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');
const SOUNDBOARD_DIR = path.join(DATA_DIR, 'soundboard');
const SOUNDBOARD_PATH = path.join(DATA_DIR, 'soundboard.json');
fs.mkdirSync(SOUNDBOARD_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(AVATARS_DIR, { recursive: true });

function readJsonFile(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function loadMessages() {
  return readJsonFile(DB_PATH);
}
function saveMessages(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function loadUsers() {
  return readJsonFile(USERS_PATH);
}
function saveUsers(data) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));
}

let messages = loadMessages();
let users = loadUsers();

// Servidores e amizades (servers-state.js / friends-state.js têm as regras).
const serversDb = { ...srv.emptyDb(), ...readJsonFile(SERVERS_PATH) };
const friendsDb = { ...fr.emptyDb(), ...readJsonFile(FRIENDS_PATH) };
function saveServers() { fs.writeFileSync(SERVERS_PATH, JSON.stringify(serversDb, null, 2)); }
function saveFriends() { fs.writeFileSync(FRIENDS_PATH, JSON.stringify(friendsDb, null, 2)); }

// Histórico de músicas por servidor (sugestões). Chamada direta usa a própria sala.
const musicHistoryDb = { ...musicHistory.emptyDb(), ...readJsonFile(MUSIC_HISTORY_PATH) };
function saveMusicHistory() { fs.writeFileSync(MUSIC_HISTORY_PATH, JSON.stringify(musicHistoryDb)); }
function musicScope(room) {
  const found = srv.findChannel(serversDb, room);
  return found ? found.server.id : room;
}
if (srv.migrateLegacy(serversDb, users) | srv.ensureLegacyAutoJoin(serversDb)) saveServers();

const randHex = (n) => crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
const randomCode = (n, alphabet) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join('');
const ids = () => ({ rand: randHex, randomCode, now: new Date().toISOString() });

// Quem pode ver uma sala: membros do servidor do canal, ou as duas pessoas da conversa/chamada direta.
function roomAudience(room) {
  const found = srv.findChannel(serversDb, room);
  if (found) return found.server.members;
  return fr.pairOf(room, fr.DM_PREFIX) || fr.pairOf(room, fr.CALL_PREFIX) || [];
}
const canSeeRoom = (room, user) => !!room && roomAudience(room).includes(user);

function canUseText(room, user) {
  const found = srv.findChannel(serversDb, room);
  if (found) return found.channel.type === 'text' && found.server.members.includes(user);
  return fr.canReadDm(room, user);
}

function canUseVoice(room, user) {
  const found = srv.findChannel(serversDb, room);
  if (found) return found.channel.type === 'voice' && found.server.members.includes(user);
  const other = fr.isCallKey(room) ? fr.otherOf(room, user) : null;
  return !!other && fr.areFriends(friendsDb, user, other);
}
if (chat.ensureIds(messages, () => crypto.randomUUID())) saveMessages(messages);

const sessions = createSessionStore({
  load: () => readJsonFile(SESSIONS_PATH),
  save: (data) => fs.writeFileSync(SESSIONS_PATH, JSON.stringify(data, null, 2))
});

// Imagens do chat ficam em uploads/ e somem junto com a mensagem.
function removeUpload(msg) {
  if (!msg || !msg.image || !chat.isUploadName(msg.image.file)) return;
  fs.rm(path.join(UPLOADS_DIR, msg.image.file), { force: true }, () => {});
}

// Apaga arquivos de uploads/ que nenhuma mensagem usa mais.
function pruneUploads() {
  const used = new Set();
  for (const list of Object.values(messages)) for (const m of list) if (m.image) used.add(m.image.file);
  for (const name of fs.readdirSync(UPLOADS_DIR)) {
    if (!used.has(name)) fs.rm(path.join(UPLOADS_DIR, name), { force: true }, () => {});
  }
}

// Fotos de perfil sem conta que as use (trocadas ou removidas com o app fechado).
function pruneAvatars() {
  const used = new Set(Object.values(users).map((u) => u.avatar).filter(Boolean));
  for (const name of fs.readdirSync(AVATARS_DIR)) {
    if (!used.has(name)) fs.rm(path.join(AVATARS_DIR, name), { force: true }, () => {});
  }
}

// Soundboard: biblioteca por servidor (soundboard-state.js) e arquivos em soundboard/.
const soundboardDb = { ...sb.emptyDb(), ...readJsonFile(SOUNDBOARD_PATH) };
function saveSoundboard() { fs.writeFileSync(SOUNDBOARD_PATH, JSON.stringify(soundboardDb, null, 2)); }
function removeSoundFile(sound) {
  if (sound && sb.isSoundFile(sound.file)) fs.rm(path.join(SOUNDBOARD_DIR, sound.file), { force: true }, () => {});
}
// Arquivos sem som cadastrado (servidor apagado com o app fechado etc.).
function pruneSoundFiles() {
  const used = new Set(Object.values(soundboardDb).flat().map((s) => s.file));
  for (const name of fs.readdirSync(SOUNDBOARD_DIR)) {
    if (!used.has(name)) fs.rm(path.join(SOUNDBOARD_DIR, name), { force: true }, () => {});
  }
}

const UPLOAD_TYPES = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm'
};
const SERVED_DIRS = {
  uploads: { dir: UPLOADS_DIR, valid: (n) => chat.isUploadName(n) },
  avatars: { dir: AVATARS_DIR, valid: (n) => chat.isAvatarName(n) },
  soundboard: { dir: SOUNDBOARD_DIR, valid: (n) => sb.isSoundFile(n) }
};

// GET /uploads/, /avatars/ e /soundboard/<uuid>.<ext>: nomes aleatórios, só leitura, sem listar a pasta.
function handleHttp(req, res) {
  const m = /^\/(uploads|avatars|soundboard)\/([^/?#]+)$/.exec(req.url || '');
  if (req.method !== 'GET' || !m) return false;
  const served = SERVED_DIRS[m[1]];
  if (!served.valid(m[2])) return false;
  const file = path.join(served.dir, m[2]);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {
      'Content-Type': UPLOAD_TYPES[path.extname(file).slice(1)],
      'Cache-Control': 'private, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
  return true;
}

const authenticated = new Map(); // socket.id -> username
const roomUsers = new Map();     // room -> Map(socket.id -> { username, muted })

const musicByRoom = new Map();   // sala de voz -> estado da fila de música
const lastSoundAt = new Map();   // username -> último toque do soundboard (ms), para o intervalo mínimo

let mainWindow = null;
let io = null;
let pendingDisplayCallback = null;

// ---------- Janela ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0f13',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: !startHidden, // aberto pela inicialização do Windows: fica só na bandeja
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true
  });
  mainWindow.loadFile('index.html');
  // O X da janela manda o Vox para a bandeja (a opção pode ser desligada nas configurações).
  mainWindow.on('close', (e) => {
    if (quitting || !closeToTray || !tray) return;
    e.preventDefault();
    mainWindow.hide();
    if (!trayHintShown && process.platform === 'win32') {
      trayHintShown = true;
      tray.displayBalloon({
        iconType: 'info',
        title: 'O Vox continua aberto',
        content: 'Ele fica aqui, perto do relógio. Para sair, clique com o botão direito no ícone → Sair do Vox.'
      });
    }
  });
}

// ---------- Utilidades de presença ----------
// Monta a lista de usuários de uma sala para um visualizador específico.
// Usuários "invisíveis" não aparecem para os outros, mas aparecem para si mesmos.
function buildRoomUserList(room, viewerId) {
  const map = roomUsers.get(room);
  const list = [];

  if (map) {
    for (const [id, u] of map) {
      if (u.status === 'invisible' && id !== viewerId) continue;
      list.push(publicUser(id, u));
    }
  }

  return list;
}

function broadcastRoomUsers(room) {
  if (!io) return;
  const sockets = io.sockets.adapter.rooms.get(room);
  if (!sockets) return;

  for (const socketId of sockets) {
    io.to(socketId).emit('room-users', buildRoomUserList(room, socketId));
  }
}

// Salas de voz que quem vê pode enxergar (servidores dele e as próprias chamadas).
function buildVoiceRooms(viewerId) {
  const result = {};
  const viewer = authenticated.get(viewerId);
  for (const [room, map] of roomUsers) {
    if (!canSeeRoom(room, viewer)) continue;
    const list = [];
    for (const [id, u] of map) {
      if (u.status === 'invisible' && id !== viewerId) continue;
      list.push(publicUser(id, u));
    }
    if (list.length) result[room] = list;
  }
  return result;
}

function broadcastVoiceRooms() {
  if (!io) return;
  for (const socketId of authenticated.keys()) {
    io.to(socketId).emit('voice-rooms', buildVoiceRooms(socketId));
  }
  broadcastServerMembers();
}

// Membros do servidor (todas as contas, que hoje têm acesso ao servidor global)
// com presença, do ponto de vista de quem vê: invisível aparece offline para os outros.
// Presença de todas as contas da instalação (o cliente filtra pelos membros do
// servidor aberto e pelos amigos). A sala de voz só aparece para quem pode vê-la.
function buildServerMembers(viewerId) {
  const viewer = authenticated.get(viewerId);
  const online = new Map(); // username -> { id, status, voiceRoom, muted }
  for (const [socketId, username] of authenticated) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;
    const status = s.data.status || 'online';
    if (status === 'invisible' && socketId !== viewerId) continue;
    if (!online.has(username) || socketId === viewerId) {
      const voiceRoom = canSeeRoom(s.data.voiceRoom, viewer) ? s.data.voiceRoom : null;
      online.set(username, { id: socketId, status, voiceRoom, muted: !!s.data.muted });
    }
  }
  return Object.keys(users).sort((a, b) => a.localeCompare(b)).map((username) => {
    const o = online.get(username);
    const avatar = users[username].avatar || null;
    return o
      ? { username, avatar, online: true, ...o }
      : { username, avatar, online: false, id: null, status: 'offline', voiceRoom: null, muted: false };
  });
}

function broadcastServerMembers() {
  if (!io) return;
  for (const socketId of authenticated.keys()) {
    io.to(socketId).emit('server-members', buildServerMembers(socketId));
  }
}

// ---------- Retenção de mensagens (7 dias) ----------
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function purgeOldMessages() {
  const cutoff = Date.now() - RETENTION_MS;
  let changed = false;

  for (const room of Object.keys(messages)) {
    const before = messages[room].length;
    messages[room] = messages[room].filter((m) => {
      const t = Date.parse(m.created_at);
      const keep = Number.isNaN(t) ? true : t >= cutoff;
      if (!keep) removeUpload(m);
      return keep;
    });
    if (messages[room].length !== before) changed = true;
    if (messages[room].length === 0) {
      delete messages[room];
      changed = true;
    }
  }

  if (changed) {
    saveMessages(messages);
    console.log('[RETENÇÃO] Mensagens com mais de 7 dias foram removidas.');
  }
}

purgeOldMessages();
pruneUploads();
pruneAvatars();
pruneSoundFiles();
sessions.prune();
setInterval(() => { purgeOldMessages(); sessions.prune(); }, 60 * 60 * 1000);

// ---------- Música ----------
function emptyMusicState() {
  return { queue: [], playing: false, positionMs: 0, serverNow: Date.now() };
}

function musicStateFor(room) {
  const state = musicByRoom.get(room);
  return state ? toPublic(state, Date.now()) : emptyMusicState();
}

// Canais de voz com música (para o ícone do YouTube na lista de canais).
// Só difunde quando a lista muda.
let lastMusicRoomsKey = '';
function musicRoomsList(viewer) {
  return [...musicByRoom.keys()].filter((room) => canSeeRoom(room, viewer)).sort();
}
function broadcastMusicRooms(force = false) {
  if (!io) return;
  const key = [...musicByRoom.keys()].sort().join('|');
  if (key === lastMusicRoomsKey && !force) return;
  lastMusicRoomsKey = key;
  for (const [socketId, user] of authenticated) io.to(socketId).emit('music-rooms', musicRoomsList(user));
}

// Difunde o estado da sala; fila vazia apaga o estado.
function broadcastMusic(room) {
  if (!io) return;
  const state = musicByRoom.get(room);
  if (state && state.queue.length === 0) musicByRoom.delete(room);
  io.to(room).emit('music-state', musicStateFor(room));
  broadcastMusicRooms();
}

// Sala de voz sem ninguém: a fila some junto.
function dropMusicIfRoomEmpty(room) {
  if (!room) return;
  const map = roomUsers.get(room);
  if (!map || map.size === 0) musicByRoom.delete(room);
  broadcastMusicRooms();
}

// Reenvia periodicamente a posição para corrigir deriva nos clientes.
setInterval(() => {
  for (const [room, state] of musicByRoom) {
    if (state.playing) broadcastMusic(room);
  }
}, RESYNC_INTERVAL_MS);

function emitToUser(username, event, payload) {
  if (!io) return;
  for (const [socketId, u] of authenticated) if (u === username) io.to(socketId).emit(event, payload);
}

// Lista de servidores de cada pessoa (com canais, cargos e, para quem administra, convites).
function sendServersTo(username) {
  emitToUser(username, 'servers', srv.serversOf(serversDb, username).map((s) => srv.publicServer(s, username)));
}

// Conversas diretas com mensagens guardadas, para a lista do Início.
function dmListFor(username) {
  return Object.keys(messages)
    .filter((k) => fr.isDmKey(k) && fr.otherOf(k, username) && messages[k].length)
    .map((k) => ({ user: fr.otherOf(k, username), lastAt: messages[k][messages[k].length - 1].created_at }));
}

function sendFriendsTo(username) {
  emitToUser(username, 'friends', {
    friends: fr.friendsOf(friendsDb, username),
    ...fr.requestsFor(friendsDb, username),
    dms: dmListFor(username)
  });
}

// Quem pode ver uma sala mudou (entrou/saiu de servidor, canal apagado...): reenvia a presença.
function refreshVisibility() {
  broadcastServerMembers();
  broadcastVoiceRooms();
  broadcastMusicRooms(true);
}

// Tira da voz e do texto as pessoas que perderam acesso a uma sala.
// shouldLeave(room, username) decide; quem sai da voz recebe 'voice-removed'.
function evictFromRooms(shouldLeave) {
  if (!io) return;
  for (const [socketId, username] of authenticated) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;
    if (s.data.voiceRoom && shouldLeave(s.data.voiceRoom, username)) {
      const room = s.data.voiceRoom;
      leaveVoiceFor(s);
      s.emit('voice-removed', { room });
    }
    if (s.data.textRoom && shouldLeave(s.data.textRoom, username)) {
      s.leave(s.data.textRoom);
      s.data.textRoom = null;
    }
  }
}

// Canais apagados levam junto as mensagens (e imagens) e a fila de música.
function deleteRoomData(roomIds) {
  let changed = false;
  for (const id of roomIds) {
    if (messages[id]) { messages[id].forEach(removeUpload); delete messages[id]; changed = true; }
    musicByRoom.delete(id);
  }
  if (changed) saveMessages(messages);
}

// Chamadas diretas tocando: sala call:a|b -> { from, to, timer }
const pendingCalls = new Map();
const CALL_RING_MS = 45000;

// Para de tocar. reason (missed, declined, cancelled, answered) vai para os dois.
function endPendingCall(room, reason) {
  const p = pendingCalls.get(room);
  if (!p) return;
  clearTimeout(p.timer);
  pendingCalls.delete(room);
  for (const u of [p.from, p.to]) emitToUser(u, 'call-ended', { room, reason: reason || 'answered' });
}

function leaveVoiceFor(socket) {
  const left = leaveVoiceRoom(roomUsers, socket.id);
  socket.data.voiceRoom = null;
  if (left) {
    socket.leave(left);
    dropMusicIfRoomEmpty(left);
    broadcastRoomUsers(left);
    // Quem ligou desistiu antes de atenderem
    if (pendingCalls.has(left) && !roomUsers.has(left)) endPendingCall(left, 'cancelled');
  }
  broadcastVoiceRooms();
}

function removeSocketFromRooms(socketId) {
  const left = leaveVoiceRoom(roomUsers, socketId);
  if (left) {
    dropMusicIfRoomEmpty(left);
    broadcastRoomUsers(left);
    if (pendingCalls.has(left) && !roomUsers.has(left)) endPendingCall(left, 'cancelled');
  }
  broadcastVoiceRooms();
}

function sendToWindow(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

// Procura versão nova nas releases do GitHub (só no app instalado). Baixa sozinho
// e avisa a interface; instala ao clicar em "Reiniciar" ou ao fechar o Vox.
let updateStatus = { state: 'idle' };
// Versão mostrada no login e nas Configurações. Síncrona (o preload expõe como valor),
// por isso fica registrada antes de qualquer janela abrir.
ipcMain.on('app-version', (event) => {
  event.returnValue = { version: app.getVersion(), packaged: app.isPackaged };
});

function setupAutoUpdate() {
  ipcMain.handle('update-status', () => updateStatus);
  if (!app.isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  const set = (s) => { updateStatus = s; sendToWindow('update-status', s); };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => set({ ...updateStatus, state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (e) => console.error('[UPDATE]', e.message));
  ipcMain.on('update-install', () => { quitting = true; autoUpdater.quitAndInstall(); });
  const check = () => autoUpdater.checkForUpdates().catch((e) => console.error('[UPDATE]', e.message));
  check();
  setInterval(check, 4 * 60 * 60 * 1000);
}

// Sem isso o Windows não mostra as notificações (o id é o mesmo do instalador).
if (process.platform === 'win32') app.setAppUserModelId(app.isPackaged ? 'com.seunome.concord' : process.execPath);

// ---------- Bandeja (ícone ao lado do relógio) ----------
// Fechar a janela só esconde: o Vox (e o servidor, no PC de quem hospeda) continua
// rodando na bandeja. Sair de verdade é pelo menu do ícone.
let tray = null;
let quitting = false;
let closeToTray = true;     // opção em Configurações → Conta (vem do renderer)
let trayHintShown = false;  // aviso "continua aberto" uma vez por execução
let trayState = { muted: false, inVoice: false, unread: 0 };

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function updateTray() {
  if (!tray) return;
  const { muted, inVoice, unread } = trayState;
  tray.setToolTip(unread ? `Vox — ${unread} mensagem(ns) não lida(s)` : 'Vox');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Vox', click: showWindow },
    { label: muted ? 'Ativar microfone' : 'Mutar microfone', enabled: inVoice, click: () => sendToWindow('tray-toggle-mic') },
    { type: 'separator' },
    { label: 'Sair do Vox', click: () => { quitting = true; app.quit(); } }
  ]));
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', process.platform === 'win32' ? 'tray.ico' : 'icon.png'));
  tray.on('click', showWindow);
  updateTray();
}

app.on('before-quit', () => { quitting = true; });

// ---------- Iniciar com o Windows ----------
// Entra pelo registro de inicialização do usuário com --hidden: abre direto na bandeja.
// Só no app instalado (em desenvolvimento registraria o electron.exe solto).
const AUTOSTART_ARGS = ['--hidden'];
const startHidden = process.argv.includes('--hidden');
const autostartSupported = () => app.isPackaged && ['win32', 'darwin'].includes(process.platform);

function autostartState() {
  const supported = autostartSupported();
  return { supported, enabled: supported && app.getLoginItemSettings({ args: AUTOSTART_ARGS }).openAtLogin };
}

function setAutostart(on) {
  if (!autostartSupported()) return autostartState();
  app.setLoginItemSettings({ openAtLogin: !!on, args: AUTOSTART_ARGS });
  return autostartState();
}

// Ligado por padrão: na primeira execução do app instalado liga uma vez; depois vale a escolha da pessoa.
function autostartFirstRun() {
  if (!autostartSupported()) return;
  const marker = path.join(app.getPath('userData'), '.inicio-automatico-configurado');
  if (fs.existsSync(marker)) return;
  setAutostart(true);
  try { fs.writeFileSync(marker, new Date().toISOString()); } catch (e) {}
}

// Um Vox por perfil: abrir de novo com ele na bandeja só mostra a janela (e não briga pela porta 3000).
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', showWindow);

// ---------- App ----------
app.whenReady().then(() => {
  // O player do YouTube recusa (erro 153) páginas file:// sem Referer; injeta o do projeto.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube.com/*', 'https://*.youtube.com/*', 'https://*.googlevideo.com/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://github.com/viniciusog1/vox';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  createWindow();

  // Permissões de câmera, microfone e captura de tela
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
    callback(allowed.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return ['media', 'display-capture'].includes(permission);
  });

  // Seletor nativo de tela (necessário para getDisplayMedia funcionar no Electron)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 }
      });

      const list = sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL()
      }));

      mainWindow.webContents.send('display-sources', list);

      pendingDisplayCallback = async (sourceId, opts = {}) => {
        if (!sourceId) return callback({});
        const fresh = await desktopCapturer.getSources({ types: ['screen', 'window'] });
        const chosen = fresh.find((s) => s.id === sourceId);
        if (!chosen) return callback({});
        // 'loopback' só existe no Windows e captura todo o som do PC (inclusive a chamada).
        const withAudio = opts.audio && request.audioRequested && process.platform === 'win32';
        return callback(withAudio ? { video: chosen, audio: 'loopback' } : { video: chosen });
      };
    } catch (e) {
      console.error('[DISPLAY] Erro ao listar fontes:', e);
      callback({});
    }
  });

  ipcMain.on('display-source-selected', async (event, sourceId, opts) => {
    const cb = pendingDisplayCallback;
    pendingDisplayCallback = null;
    if (cb) await cb(sourceId, opts);
  });

  ipcMain.on('display-source-cancelled', () => {
    const cb = pendingDisplayCallback;
    pendingDisplayCallback = null;
    if (cb) cb(null);
  });

  // ---------- Servidor HTTP + Socket.io ----------
  const server = http.createServer((req, res) => {
    if (!handleHttp(req, res)) { res.writeHead(404); res.end(); }
  });
  // 3 MB: cabe uma imagem de até 2 MB (chat-state.MAX_IMAGE_BYTES) com folga.
  io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 3 * 1024 * 1024 });

  io.on('connection', (socket) => {
    console.log('[SOCKET] Conectado:', socket.id);

    // Login, cadastro ou retomada aceitos: o token permite reconectar sem senha.
    function signIn(username, callback, token = sessions.issue(username)) {
      authenticated.set(socket.id, username);
      socket.data.token = token;
      callback({ success: true, username, token, protocol: PROTOCOL_VERSION });
      sendServersTo(username);
      sendFriendsTo(username);
      socket.emit('music-rooms', musicRoomsList(username));
      broadcastServerMembers();
    }

    socket.on('register', ({ username, password, protocol } = {}, callback) => {
      if (typeof callback !== 'function') return;
      if (!isCompatible(protocol)) return callback({ success: false, message: VERSION_MISMATCH_MESSAGE });
      if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        return callback({ success: false, message: 'Preencha usuário e senha' });
      }
      if (!/^[\p{L}\p{N}_.-]{2,24}$/u.test(username) || ['__proto__', 'constructor', 'prototype'].includes(username.toLowerCase())) {
        return callback({ success: false, message: 'O usuário deve ter de 2 a 24 letras, números, ponto, hífen ou _' });
      }
      if (Object.keys(users).some((u) => u.toLowerCase() === username.toLowerCase())) {
        return callback({ success: false, message: 'Usuário já existe' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      users[username] = { salt, hash, created_at: new Date().toISOString() };
      saveUsers(users);
      // Primeira conta da instalação: cria a Casa dos Amigos; as seguintes entram nela sem convite.
      const joined = srv.migrateLegacy(serversDb, users) ? [serversDb.servers[srv.LEGACY_ID]] : srv.joinAutoServers(serversDb, username);
      if (joined.length) {
        saveServers();
        for (const s of joined) for (const m of s.members) if (m !== username) sendServersTo(m);
      }
      signIn(username, callback);
    });

    socket.on('login', ({ username, password, protocol } = {}, callback) => {
      if (typeof callback !== 'function') return;
      if (!isCompatible(protocol)) return callback({ success: false, message: VERSION_MISMATCH_MESSAGE });
      const user = typeof username === 'string' && Object.hasOwn(users, username) ? users[username] : null;
      if (!user) return callback({ success: false, message: 'Usuário não encontrado' });

      const hash = crypto.pbkdf2Sync(String(password || ''), user.salt, 100000, 64, 'sha512').toString('hex');
      if (hash !== user.hash) return callback({ success: false, message: 'Senha incorreta' });

      signIn(username, callback);
    });

    // Reconexão: o cliente manda o token recebido no login.
    socket.on('resume', ({ token, protocol } = {}, callback) => {
      if (typeof callback !== 'function') return;
      if (!isCompatible(protocol)) return callback({ success: false, message: VERSION_MISMATCH_MESSAGE });
      const username = sessions.resolve(token, (u) => Object.hasOwn(users, u));
      if (!username) return callback({ success: false, message: 'Sua sessão expirou. Entre de novo.' });
      signIn(username, callback, token);
    });

    socket.on('logout', (callback) => {
      if (socket.data.token) { sessions.revoke(socket.data.token); socket.data.token = null; }
      const username = authenticated.get(socket.id);
      if (username) {
        // Sai das salas do Socket.io antes dos broadcasts, para não receber mais eventos
        for (const room of socketRoomsToLeave(socket.data)) socket.leave(room);
        removeSocketFromRooms(socket.id);
        authenticated.delete(socket.id);
        socket.data.voiceRoom = null;
        socket.data.textRoom = null;
        broadcastServerMembers();
      }
      if (typeof callback === 'function') callback({ success: true });
    });

    function requireAuth(callback) {
      if (!authenticated.has(socket.id)) {
        if (callback) callback({ success: false, message: 'Não autenticado' });
        return false;
      }
      return true;
    }

    // Canal de texto de um servidor do qual é membro, ou conversa direta da qual faz parte.
    socket.on('join-text', (room) => {
      if (!requireAuth()) return;
      if (!canUseText(room, authenticated.get(socket.id))) return;
      if (socket.data.textRoom) socket.leave(socket.data.textRoom);
      socket.join(room);
      socket.data.textRoom = room;
    });

    // Canal de voz de um servidor do qual é membro, ou chamada direta com um amigo.
    socket.on('join-voice', (room) => {
      if (!requireAuth()) return;
      const username = authenticated.get(socket.id);
      if (!canUseVoice(room, username)) return;
      // Atender: a chamada deixa de tocar para quem foi chamado
      const pending = pendingCalls.get(room);
      if (pending && pending.to === username) endPendingCall(room, null);

      const previous = joinVoiceRoom(roomUsers, socket.id, room, {
        username,
        muted: !!socket.data.muted,
        status: socket.data.status || 'online'
      });
      if (previous) {
        socket.leave(previous);
        if (previous !== room) {
          dropMusicIfRoomEmpty(previous);
          broadcastRoomUsers(previous);
        }
      }
      socket.join(room);
      socket.data.voiceRoom = room;

      if ((socket.data.status || 'online') !== 'invisible') {
        socket.to(room).emit('user-joined', socket.id);
      }
      broadcastRoomUsers(room);
      broadcastVoiceRooms();
      socket.emit('music-state', musicStateFor(room));
    });

    socket.on('leave-voice', () => leaveVoiceFor(socket));

    // Exige login e voz; devolve a sala de voz ou null (e responde { ok: false }).
    function requireVoice(callback) {
      const room = authenticated.has(socket.id) ? socket.data.voiceRoom : null;
      if (!room) {
        if (typeof callback === 'function') callback({ ok: false });
        return null;
      }
      return room;
    }

    socket.on('music-add', async (url, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      const room = requireVoice(reply);
      if (!room) return;
      const id = parseYouTubeId(url);
      if (!id) return reply({ ok: false, message: 'Link do YouTube inválido' });
      const info = await lookupVideo(id);
      if (!info.ok) {
        return reply({ ok: false, message: 'Esse vídeo não pode ser tocado aqui (privado, removido ou com incorporação desativada).' });
      }
      // Durante a consulta a pessoa pode ter saído da voz ou trocado de sala
      if (!authenticated.has(socket.id) || socket.data.voiceRoom !== room) return reply({ ok: false });
      let state = musicByRoom.get(room);
      if (!state) state = createMusicState();
      const item = {
        id: crypto.randomUUID(),
        videoId: id,
        title: info.title,
        thumbnail: info.thumbnail,
        addedBy: socket.data.status === 'invisible' ? null : authenticated.get(socket.id)
      };
      const result = addTrack(state, item, Date.now());
      if (!result.ok) return reply({ ok: false, message: 'A fila está cheia (50 músicas).' });
      musicByRoom.set(room, state);
      musicHistory.recordRequest(musicHistoryDb, musicScope(room), item, new Date().toISOString());
      saveMusicHistory();
      reply({ ok: true });
      broadcastMusic(room);
    });

    // Aba Sugestões: histórico do servidor da voz atual (ou da chamada direta).
    socket.on('music-suggestions', (callback) => {
      if (typeof callback !== 'function') return;
      const room = requireVoice(callback);
      if (!room) return;
      const state = musicByRoom.get(room);
      const queued = state ? state.queue.map((t) => t.videoId) : [];
      callback({ ok: true, ...musicHistory.suggestionsFor(musicHistoryDb, musicScope(room), queued) });
    });

    // Aplica uma função da fila ao estado da sala e difunde se algo mudou.
    function musicMutate(apply) {
      const room = requireVoice();
      const state = room && musicByRoom.get(room);
      if (!state) return;
      const result = apply(state);
      if (result) broadcastMusic(room);
      return result;
    }

    socket.on('music-remove', (itemId) => {
      musicMutate((state) => removeTrack(state, itemId, Date.now()));
    });
    socket.on('music-skip', (itemId) => {
      musicMutate((state) => advanceIfCurrent(state, itemId, Date.now()));
    });
    socket.on('music-ended', (itemId) => {
      musicMutate((state) => endedIfCurrent(state, itemId, Date.now()));
    });
    // Sem argumento alterna; com { playing } só muda se for diferente (cliques
    // simultâneos no vídeo de duas pessoas não se anulam).
    socket.on('music-toggle', (want) => {
      musicMutate((state) => {
        if (want && typeof want.playing === 'boolean' && want.playing === state.playing) return false;
        togglePause(state, Date.now());
        return true;
      });
    });
    socket.on('music-error', (payload) => {
      const { itemId } = payload || {};
      const room = requireVoice();
      const state = room && musicByRoom.get(room);
      if (!state) return;
      const current = state.queue[0];
      const title = current && current.id === itemId ? current.title : null;
      if (!advanceIfCurrent(state, itemId, Date.now())) return;
      broadcastMusic(room);
      io.to(room).emit('music-notice', { text: `Não foi possível tocar «${title}»` });
    });

    // Foto de perfil: { data: ArrayBuffer, type } troca; null remove. Vale para a conta do socket.
    socket.on('set-avatar', (image, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply)) return;
      const username = authenticated.get(socket.id);
      let file = null;
      if (image) {
        const ext = chat.avatarExtension(image.type);
        const data = Buffer.isBuffer(image.data) ? image.data : null;
        if (!ext || !data || !data.length) return reply({ success: false, message: 'Imagem inválida.' });
        if (data.length > chat.MAX_AVATAR_BYTES) return reply({ success: false, message: 'A foto passa de 512 KB.' });
        file = `${crypto.randomUUID()}.${ext}`;
        fs.writeFileSync(path.join(AVATARS_DIR, file), data);
      }
      const old = users[username].avatar;
      if (file) users[username].avatar = file;
      else delete users[username].avatar;
      saveUsers(users);
      if (old && chat.isAvatarName(old)) fs.rm(path.join(AVATARS_DIR, old), { force: true }, () => {});
      reply({ success: true, avatar: file });
      broadcastServerMembers();
    });

    // ---------- Servidores, canais e convites ----------
    // Executa uma regra de servers-state/friends-state e responde { success, message } ao cliente.
    function act(callback, fn) {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply)) return;
      const result = fn(authenticated.get(socket.id));
      if (!result.ok) return reply({ success: false, message: result.error });
      reply({ success: true, ...(result.reply || {}) });
    }

    const notifyMembers = (server, extra = []) => {
      for (const u of new Set([...server.members, ...extra])) sendServersTo(u);
    };
    const channelIdsOf = (server) => new Set(server.channels.map((c) => c.id));

    socket.on('server-create', ({ name } = {}, callback) => act(callback, (user) => {
      const r = srv.createServer(serversDb, user, name, ids());
      if (r.ok) { saveServers(); sendServersTo(user); r.reply = { serverId: r.server.id }; }
      return r;
    }));

    socket.on('server-update', ({ serverId, name } = {}, callback) => act(callback, (user) => {
      const r = srv.renameServer(serversDb, serverId, user, name);
      if (r.ok) { saveServers(); notifyMembers(r.server); }
      return r;
    }));

    socket.on('server-delete', ({ serverId } = {}, callback) => act(callback, (user) => {
      const r = srv.deleteServer(serversDb, serverId, user);
      if (!r.ok) return r;
      const rooms = channelIdsOf(r.server);
      saveServers();
      evictFromRooms((room) => rooms.has(room));
      deleteRoomData(rooms);
      if (musicHistory.dropScope(musicHistoryDb, r.server.id)) saveMusicHistory();
      const gone = sb.dropServer(soundboardDb, r.server.id);
      if (gone.length) { gone.forEach(removeSoundFile); saveSoundboard(); }
      notifyMembers(r.server);
      refreshVisibility();
      return r;
    }));

    // ---------- Soundboard ----------
    const memberServer = (serverId, user) => {
      const server = serversDb.servers[serverId];
      return server && server.members.includes(user) ? server : null;
    };
    const sendSoundboard = (server) => {
      for (const m of server.members) emitToUser(m, 'soundboard-updated', { serverId: server.id, sounds: sb.soundsOf(soundboardDb, server.id) });
    };

    socket.on('soundboard-list', ({ serverId } = {}, callback) => act(callback, (user) => {
      if (!memberServer(serverId, user)) return { ok: false, error: 'Você não está nesse servidor.' };
      return { ok: true, reply: { sounds: sb.soundsOf(soundboardDb, serverId) } };
    }));

    // Qualquer membro envia sons (até 1 MB e 8 s; a duração vem do cliente, que decodifica o áudio).
    socket.on('soundboard-add', ({ serverId, name, type, duration, data } = {}, callback) => act(callback, (user) => {
      const server = memberServer(serverId, user);
      if (!server) return { ok: false, error: 'Você não está nesse servidor.' };
      const ext = sb.audioExtension(type);
      if (!ext || !Buffer.isBuffer(data)) return { ok: false, error: 'Use um arquivo MP3, OGG, WAV ou WebM.' };
      const file = `${crypto.randomUUID()}.${ext}`;
      const r = sb.addSound(soundboardDb, serverId, {
        id: crypto.randomUUID(), name, file, by: user, at: new Date().toISOString(), duration, bytes: data.length
      });
      if (!r.ok) return r;
      fs.writeFileSync(path.join(SOUNDBOARD_DIR, file), data);
      saveSoundboard();
      sendSoundboard(server);
      return r;
    }));

    socket.on('soundboard-delete', ({ serverId, soundId } = {}, callback) => act(callback, (user) => {
      const server = memberServer(serverId, user);
      if (!server) return { ok: false, error: 'Você não está nesse servidor.' };
      const r = sb.deleteSound(soundboardDb, serverId, soundId, user, srv.isManager(server, user));
      if (!r.ok) return r;
      removeSoundFile(r.sound);
      saveSoundboard();
      sendSoundboard(server);
      return r;
    }));

    // Toca para todos da sala de voz: cada PC toca o som localmente.
    socket.on('soundboard-play', ({ soundId } = {}, callback) => act(callback, (user) => {
      const room = socket.data.voiceRoom;
      if (!room) return { ok: false, error: 'Entre num canal de voz para usar o soundboard.' };
      const now = Date.now();
      if (!sb.canPlay(lastSoundAt.get(user), now)) return { ok: false, error: 'Calma! Espere um instante entre um som e outro.' };
      let payload;
      if (sbSynth.isBuiltin(soundId)) {
        payload = { id: soundId, builtin: true, name: sbSynth.BUILTIN.find((s) => s.id === soundId).name };
      } else {
        const found = srv.findChannel(serversDb, room);
        const sound = found && sb.soundsOf(soundboardDb, found.server.id).find((s) => s.id === soundId);
        if (!sound) return { ok: false, error: 'Som não encontrado neste servidor.' };
        payload = { id: sound.id, builtin: false, name: sound.name, file: sound.file };
      }
      lastSoundAt.set(user, now);
      payload.by = socket.data.status === 'invisible' ? null : user;
      io.to(room).emit('soundboard-played', payload);
      return { ok: true };
    }));

    socket.on('channel-create', ({ serverId, type, name } = {}, callback) => act(callback, (user) => {
      const r = srv.createChannel(serversDb, serverId, user, type, name, ids());
      if (r.ok) { saveServers(); notifyMembers(r.server); r.reply = { channelId: r.channel.id }; }
      return r;
    }));

    socket.on('channel-update', ({ channelId, name } = {}, callback) => act(callback, (user) => {
      const r = srv.renameChannel(serversDb, channelId, user, name);
      if (r.ok) { saveServers(); notifyMembers(r.server); }
      return r;
    }));

    socket.on('channel-delete', ({ channelId } = {}, callback) => act(callback, (user) => {
      const r = srv.deleteChannel(serversDb, channelId, user);
      if (!r.ok) return r;
      saveServers();
      evictFromRooms((room) => room === channelId);
      deleteRoomData([channelId]);
      notifyMembers(r.server);
      refreshVisibility();
      return r;
    }));

    socket.on('invite-create', ({ serverId } = {}, callback) => act(callback, (user) => {
      const r = srv.createInvite(serversDb, serverId, user, ids());
      if (r.ok) { saveServers(); notifyMembers(r.server); r.reply = { code: r.code }; }
      return r;
    }));

    socket.on('invite-revoke', ({ serverId, code } = {}, callback) => act(callback, (user) => {
      const r = srv.revokeInvite(serversDb, serverId, user, code);
      if (r.ok) { saveServers(); notifyMembers(r.server); }
      return r;
    }));

    socket.on('invite-join', ({ code } = {}, callback) => act(callback, (user) => {
      const r = srv.joinByInvite(serversDb, code, user);
      if (r.ok) {
        r.reply = { serverId: r.server.id, already: !!r.already };
        if (!r.already) { saveServers(); notifyMembers(r.server); refreshVisibility(); }
      }
      return r;
    }));

    // Perder acesso a um servidor (sair ou ser expulso) tira a pessoa dos canais dele.
    function dropFromServer(server, target) {
      const rooms = channelIdsOf(server);
      evictFromRooms((room, u) => u === target && rooms.has(room));
      notifyMembers(server, [target]);
      refreshVisibility();
    }

    socket.on('server-leave', ({ serverId } = {}, callback) => act(callback, (user) => {
      const r = srv.leaveServer(serversDb, serverId, user);
      if (r.ok) { saveServers(); dropFromServer(r.server, user); }
      return r;
    }));

    socket.on('member-kick', ({ serverId, user: target } = {}, callback) => act(callback, (user) => {
      const r = srv.kickMember(serversDb, serverId, user, target);
      if (r.ok) {
        saveServers();
        dropFromServer(r.server, target);
        emitToUser(target, 'server-kicked', { serverId, name: r.server.name });
      }
      return r;
    }));

    socket.on('member-role', ({ serverId, user: target, admin } = {}, callback) => act(callback, (user) => {
      const r = srv.setAdmin(serversDb, serverId, user, target, !!admin);
      if (r.ok) { saveServers(); notifyMembers(r.server); }
      return r;
    }));

    socket.on('server-transfer', ({ serverId, user: target } = {}, callback) => act(callback, (user) => {
      const r = srv.transferOwnership(serversDb, serverId, user, target);
      if (r.ok) { saveServers(); notifyMembers(r.server); }
      return r;
    }));

    // ---------- Amigos ----------
    const friendAction = (apply) => (payload, callback) => act(callback, (user) => {
      const other = payload && typeof payload.user === 'string' ? payload.user : '';
      const r = apply(user, other);
      if (r.ok) { saveFriends(); sendFriendsTo(user); if (other) sendFriendsTo(other); }
      return r;
    });

    socket.on('friend-request', friendAction((user, other) =>
      fr.sendRequest(friendsDb, user, other, { exists: (u) => Object.hasOwn(users, u), now: new Date().toISOString() })));
    socket.on('friend-accept', friendAction((user, other) => fr.acceptRequest(friendsDb, user, other)));
    socket.on('friend-drop', friendAction((user, other) => fr.dropRequest(friendsDb, user, other)));
    socket.on('friend-remove', friendAction((user, other) => fr.removeFriend(friendsDb, user, other)));

    // ---------- Chamada direta ----------
    // Toca para o amigo; quem liga entra na sala call:a|b logo em seguida (join-voice).
    socket.on('call-start', ({ user: target } = {}, callback) => act(callback, (user) => {
      if (!fr.areFriends(friendsDb, user, target)) return { ok: false, error: 'Só dá para ligar para amigos.' };
      const online = [...authenticated].some(([sid, u]) => {
        const s = io.sockets.sockets.get(sid);
        return u === target && s && (s.data.status || 'online') !== 'invisible';
      });
      if (!online) return { ok: false, error: `${target} está offline.` };
      const room = fr.callKey(user, target);
      if (!pendingCalls.has(room) && !roomUsers.has(room)) {
        pendingCalls.set(room, { from: user, to: target, timer: setTimeout(() => endPendingCall(room, 'missed'), CALL_RING_MS) });
        emitToUser(target, 'call-incoming', { from: user, room });
      }
      return { ok: true, reply: { room } };
    }));

    socket.on('call-decline', ({ room } = {}, callback) => act(callback, (user) => {
      const p = pendingCalls.get(room);
      if (!p || p.to !== user) return { ok: false, error: 'Chamada não encontrada.' };
      endPendingCall(room, 'declined');
      return { ok: true };
    }));

    socket.on('update-state', (patch) => {
      if (!requireAuth()) return;
      const room = socket.data.voiceRoom;
      const map = room ? roomUsers.get(room) : null;
      const entry = map && map.get(socket.id);

      const before = socket.data.status || 'online';
      // Fora da voz o estado só é espelhado em socket.data
      const target = entry || {
        muted: !!socket.data.muted,
        status: socket.data.status || 'online'
      };
      applyStatePatch(target, patch);
      socket.data.muted = !!target.muted;
      socket.data.status = target.status || 'online';
      const after = socket.data.status;

      if (!entry) { broadcastServerMembers(); return; }

      // Ao voltar de invisível, os outros precisam refazer a conexão de mídia
      if (before === 'invisible' && after !== 'invisible') {
        socket.to(room).emit('user-joined', socket.id);
      }

      broadcastRoomUsers(room);
      broadcastVoiceRooms();
    });

    socket.on('signal', ({ to, data } = {}) => {
      if (!requireAuth()) return;
      // Só entre pessoas logadas: um socket anônimo não recebe nem manda sinalização.
      if (!authenticated.has(to)) return;
      io.to(to).emit('signal', { from: socket.id, data });
    });

    // Eventos de chat vão para todas as pessoas logadas (com o canal), para os
    // contadores de não lidas e as menções em outros canais.
    // (Só para quem tem acesso à sala: membros do servidor ou as duas pessoas da conversa.)
    function broadcastChat(event, payload) {
      for (const [socketId, user] of authenticated) {
        if (canSeeRoom(payload.room, user)) io.to(socketId).emit(event, payload);
      }
    }

    // Canal de texto aberto neste socket e ainda acessível (pode ter sido expulso).
    const inTextRoom = (room) => canUseTextRoom(socket.data.textRoom, room) && canUseText(room, authenticated.get(socket.id));

    // O autor é sempre o usuário logado neste socket, nunca um campo do cliente.
    socket.on('save-message', ({ room, text, image } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply)) return;
      if (!inTextRoom(room)) return reply({ success: false, message: 'Canal inválido' });
      if (fr.isDmKey(room) && !fr.canWriteDm(friendsDb, room, authenticated.get(socket.id))) {
        return reply({ success: false, message: 'Vocês não são mais amigos: não dá para mandar mensagens.' });
      }
      const clean = chat.cleanText(text);
      if (clean === null) return reply({ success: false, message: `A mensagem passa de ${chat.MAX_TEXT} caracteres.` });

      let imageInfo = null;
      if (image) {
        const ext = chat.imageExtension(image.type);
        const data = Buffer.isBuffer(image.data) ? image.data : null;
        if (!ext || !data || !data.length) return reply({ success: false, message: 'Imagem inválida.' });
        if (data.length > chat.MAX_IMAGE_BYTES) return reply({ success: false, message: 'A imagem passa de 2 MB.' });
        const file = `${crypto.randomUUID()}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, file), data);
        imageInfo = {
          file,
          width: Math.max(0, Math.min(10000, Number(image.width) || 0)),
          height: Math.max(0, Math.min(10000, Number(image.height) || 0))
        };
      }
      if (!clean && !imageInfo) return reply({ success: false, message: 'Mensagem vazia.' });

      purgeOldMessages();
      if (!messages[room]) messages[room] = [];
      const msg = { id: crypto.randomUUID(), user: authenticated.get(socket.id), text: clean, created_at: new Date().toISOString() };
      if (imageInfo) msg.image = imageInfo;
      messages[room].push(msg);
      if (messages[room].length > 200) messages[room].splice(0, messages[room].length - 200).forEach(removeUpload);
      saveMessages(messages);
      reply({ success: true, id: msg.id });
      broadcastChat('new-message', { room, ...msg, mentions: chat.mentionsOf(clean, roomAudience(room)) });
    });

    socket.on('edit-message', ({ room, id, text } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply) || !inTextRoom(room)) return reply({ success: false });
      const msg = chat.editMessage(messages[room], id, authenticated.get(socket.id), text, new Date().toISOString());
      if (!msg) return reply({ success: false, message: 'Não foi possível editar.' });
      saveMessages(messages);
      reply({ success: true });
      broadcastChat('message-updated', { room, id: msg.id, text: msg.text, edited_at: msg.edited_at });
    });

    socket.on('delete-message', ({ room, id } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply) || !inTextRoom(room)) return reply({ success: false });
      const removed = chat.deleteMessage(messages[room], id, authenticated.get(socket.id));
      if (!removed) return reply({ success: false, message: 'Não foi possível apagar.' });
      if (messages[room].length === 0) delete messages[room];
      removeUpload(removed);
      saveMessages(messages);
      reply({ success: true });
      broadcastChat('message-deleted', { room, id });
    });

    socket.on('get-messages', (room, callback) => {
      if (typeof callback !== 'function') return;
      if (!requireAuth() || !inTextRoom(room)) { callback([]); return; }
      purgeOldMessages();
      callback(messages[room] || []);
    });

    // Apaga apenas as mensagens do próprio usuário em um canal
    socket.on('delete-my-messages', ({ room } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply)) return;
      if (!inTextRoom(room)) return reply({ success: false });
      const username = authenticated.get(socket.id);
      let removed = 0;

      if (messages[room]) {
        const before = messages[room].length;
        messages[room] = messages[room].filter((m) => {
          if (m.user !== username) return true;
          removeUpload(m);
          return false;
        });
        removed = before - messages[room].length;
        if (messages[room].length === 0) delete messages[room];
        saveMessages(messages);
      }

      io.to(room).emit('messages-cleared', { user: username });
      reply({ success: true, count: removed });
    });

    socket.on('disconnect', () => {
      removeSocketFromRooms(socket.id);
      socket.data.voiceRoom = null;
      socket.data.textRoom = null;
      const wasAuthenticated = authenticated.delete(socket.id);
      if (wasAuthenticated) broadcastServerMembers();
      console.log('[SOCKET] Desconectado:', socket.id);
    });
  });

  server.on('error', (err) => {
    // Se outra instância já estiver usando a porta, o app ainda pode se conectar a ela.
    console.error('[SERVER] Falha ao iniciar:', err.message);
  });

  server.listen(3000, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    const ips = [];
    Object.values(nets).forEach((list) => {
      (list || []).forEach((net) => {
        if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
      });
    });
    console.log('[SERVER] Rodando em http://127.0.0.1:3000');
    if (ips.length) {
      console.log('[SERVER] Na rede local: ' + ips.map((ip) => `http://${ip}:3000`).join(', '));
    }
  });

  // ---------- Link fixo (endereço do túnel num Gist do host) ----------
  const address = createAddressPublisher({
    file: path.join(app.getPath('userData'), 'link-fixo.json'),
    fetchImpl: (...args) => fetch(...args),
    encrypt: (text) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Não foi possível guardar o token com segurança neste PC.');
      return safeStorage.encryptString(text).toString('base64');
    },
    decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
    onStatus: (s) => sendToWindow('address-status', s)
  });

  // ---------- Túnel (abrir para amigos) ----------
  const tunnel = createTunnel({
    binDirs: [path.join(__dirname, 'tools'), path.join(app.getPath('userData'), 'tools')],
    downloadDir: path.join(app.getPath('userData'), 'tools'),
    onStatus: (s) => {
      sendToWindow('tunnel-status', s);
      if (s.state === 'on' && s.url) address.publish(s.url);
    }
  });
  ipcMain.handle('tunnel-start', () => tunnel.start());
  ipcMain.handle('tunnel-stop', () => { tunnel.stop(); return tunnel.status(); });
  ipcMain.handle('tunnel-status', () => tunnel.status());
  app.on('before-quit', () => { tunnel.stop(); address.stop(); });

  ipcMain.handle('address-status', () => address.status());
  ipcMain.handle('address-connect', async (event, token) => {
    try {
      const current = tunnel.status();
      return { ok: true, status: await address.connect(token, current.state === 'on' ? current.url : null) };
    } catch (e) {
      return { ok: false, message: e.message, status: address.status() };
    }
  });
  ipcMain.handle('address-disconnect', () => address.disconnect());
  ipcMain.handle('address-auto-tunnel', (event, on) => address.setAutoTunnel(on));
  ipcMain.on('address-token-page', () => shell.openExternal(TOKEN_PAGE));
  // Com o link fixo, o túnel abre sozinho junto com o Vox (inclusive ao iniciar com o Windows).
  if (address.autoTunnel()) {
    server.once('listening', () => tunnel.start());
    if (server.listening) tunnel.start();
  }

  // ---------- Bandeja ----------
  createTray();
  autostartFirstRun();
  ipcMain.handle('autostart-get', () => autostartState());
  ipcMain.handle('autostart-set', (event, on) => setAutostart(on));
  ipcMain.on('set-close-to-tray', (event, on) => { closeToTray = !!on; });
  ipcMain.on('tray-state', (event, s) => {
    trayState = {
      muted: !!(s && s.muted),
      inVoice: !!(s && s.inVoice),
      unread: Math.max(0, Math.min(9999, Number(s && s.unread) || 0))
    };
    updateTray();
  });

  // ---------- Notificações ----------
  ipcMain.on('focus-window', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  ipcMain.on('flash-frame', (event, on) => {
    if (mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(!!on);
  });
  mainWindow.on('focus', () => mainWindow.flashFrame(false));

  // ---------- Atualização automática ----------
  setupAutoUpdate();

  // ---------- Controles de janela ----------
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow.close());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
