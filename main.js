const { app, BrowserWindow, ipcMain, session, desktopCapturer } = require('electron');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { publicUser, applyStatePatch, joinVoiceRoom, leaveVoiceRoom, canUseTextRoom, socketRoomsToLeave } = require('./room-state');
const { isTextChannel, isVoiceChannel } = require('./channels');
const { parseYouTubeId, lookupVideo } = require('./youtube');
const { RESYNC_INTERVAL_MS, createMusicState, addTrack, removeTrack, advanceIfCurrent, endedIfCurrent, togglePause, toPublic } = require('./music-state');
const { PROTOCOL_VERSION, VERSION_MISMATCH_MESSAGE, isCompatible } = require('./protocol');
const chat = require('./chat-state');
const { createSessionStore } = require('./sessions');
const { createTunnel } = require('./tunnel');

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
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

const UPLOAD_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

// GET /uploads/<uuid>.<ext>: nomes aleatórios, só leitura, sem listar a pasta.
function handleHttp(req, res) {
  const m = /^\/uploads\/([^/?#]+)$/.exec(req.url || '');
  if (req.method !== 'GET' || !m || !chat.isUploadName(m[1])) return false;
  const file = path.join(UPLOADS_DIR, m[1]);
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true
  });
  mainWindow.loadFile('index.html');
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

function buildVoiceRooms(viewerId) {
  const result = {};
  for (const [room, map] of roomUsers) {
    if (!room.startsWith('voz-')) continue;
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
function buildServerMembers(viewerId) {
  const online = new Map(); // username -> { id, status, voiceRoom, muted }
  for (const [socketId, username] of authenticated) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;
    const status = s.data.status || 'online';
    if (status === 'invisible' && socketId !== viewerId) continue;
    if (!online.has(username) || socketId === viewerId) {
      online.set(username, { id: socketId, status, voiceRoom: s.data.voiceRoom || null, muted: !!s.data.muted });
    }
  }
  return Object.keys(users).sort((a, b) => a.localeCompare(b)).map((username) => {
    const o = online.get(username);
    return o
      ? { username, online: true, ...o }
      : { username, online: false, id: null, status: 'offline', voiceRoom: null, muted: false };
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
function musicRoomsList() {
  return [...musicByRoom.keys()].sort();
}
function broadcastMusicRooms() {
  if (!io) return;
  const list = musicRoomsList();
  const key = list.join('|');
  if (key === lastMusicRoomsKey) return;
  lastMusicRoomsKey = key;
  for (const socketId of authenticated.keys()) io.to(socketId).emit('music-rooms', list);
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

function removeSocketFromRooms(socketId) {
  const left = leaveVoiceRoom(roomUsers, socketId);
  if (left) {
    dropMusicIfRoomEmpty(left);
    broadcastRoomUsers(left);
  }
  broadcastVoiceRooms();
}

function sendToWindow(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

// Procura versão nova nas releases do GitHub (só no app instalado). Baixa sozinho
// e avisa a interface; instala ao clicar em "Reiniciar" ou ao fechar o Vox.
let updateStatus = { state: 'idle' };
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
  ipcMain.on('update-install', () => autoUpdater.quitAndInstall());
  const check = () => autoUpdater.checkForUpdates().catch((e) => console.error('[UPDATE]', e.message));
  check();
  setInterval(check, 4 * 60 * 60 * 1000);
}

// Sem isso o Windows não mostra as notificações (o id é o mesmo do instalador).
if (process.platform === 'win32') app.setAppUserModelId(app.isPackaged ? 'com.seunome.concord' : process.execPath);

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
      socket.emit('music-rooms', musicRoomsList());
      broadcastServerMembers();
    }

    socket.on('register', ({ username, password, protocol } = {}, callback) => {
      if (typeof callback !== 'function') return;
      if (!isCompatible(protocol)) return callback({ success: false, message: VERSION_MISMATCH_MESSAGE });
      if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        return callback({ success: false, message: 'Preencha usuário e senha' });
      }
      if (!/^[\p{L}\p{N}_.-]{2,24}$/u.test(username) || ['__proto__', 'constructor', 'prototype'].includes(username)) {
        return callback({ success: false, message: 'O usuário deve ter de 2 a 24 letras, números, ponto, hífen ou _' });
      }
      if (Object.keys(users).some((u) => u.toLowerCase() === username.toLowerCase())) {
        return callback({ success: false, message: 'Usuário já existe' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      users[username] = { salt, hash, created_at: new Date().toISOString() };
      saveUsers(users);
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

    socket.on('join-text', (room) => {
      if (!requireAuth()) return;
      if (!isTextChannel(room)) return;
      if (socket.data.textRoom) socket.leave(socket.data.textRoom);
      socket.join(room);
      socket.data.textRoom = room;
    });

    socket.on('join-voice', (room) => {
      if (!requireAuth()) return;
      if (!isVoiceChannel(room)) return;
      const username = authenticated.get(socket.id);

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

    socket.on('leave-voice', () => {
      const left = leaveVoiceRoom(roomUsers, socket.id);
      socket.data.voiceRoom = null;
      if (left) {
        socket.leave(left);
        dropMusicIfRoomEmpty(left);
        broadcastRoomUsers(left);
      }
      broadcastVoiceRooms();
    });

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
      reply({ ok: true });
      broadcastMusic(room);
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
    function broadcastChat(event, payload) {
      for (const socketId of authenticated.keys()) io.to(socketId).emit(event, payload);
    }

    // O autor é sempre o usuário logado neste socket, nunca um campo do cliente.
    socket.on('save-message', ({ room, text, image } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply)) return;
      if (!canUseTextRoom(socket.data.textRoom, room)) return reply({ success: false, message: 'Canal inválido' });
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
      broadcastChat('new-message', { room, ...msg, mentions: chat.mentionsOf(clean, Object.keys(users)) });
    });

    socket.on('edit-message', ({ room, id, text } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply) || !canUseTextRoom(socket.data.textRoom, room)) return reply({ success: false });
      const msg = chat.editMessage(messages[room], id, authenticated.get(socket.id), text, new Date().toISOString());
      if (!msg) return reply({ success: false, message: 'Não foi possível editar.' });
      saveMessages(messages);
      reply({ success: true });
      broadcastChat('message-updated', { room, id: msg.id, text: msg.text, edited_at: msg.edited_at });
    });

    socket.on('delete-message', ({ room, id } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply) || !canUseTextRoom(socket.data.textRoom, room)) return reply({ success: false });
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
      if (!requireAuth() || !canUseTextRoom(socket.data.textRoom, room)) { callback([]); return; }
      purgeOldMessages();
      callback(messages[room] || []);
    });

    // Apaga apenas as mensagens do próprio usuário em um canal
    socket.on('delete-my-messages', ({ room } = {}, callback) => {
      const reply = typeof callback === 'function' ? callback : () => {};
      if (!requireAuth(reply)) return;
      if (!canUseTextRoom(socket.data.textRoom, room)) return reply({ success: false });
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

  // ---------- Túnel (abrir para amigos) ----------
  const tunnel = createTunnel({
    binDirs: [path.join(__dirname, 'tools'), path.join(app.getPath('userData'), 'tools')],
    downloadDir: path.join(app.getPath('userData'), 'tools'),
    onStatus: (s) => sendToWindow('tunnel-status', s)
  });
  ipcMain.handle('tunnel-start', () => tunnel.start());
  ipcMain.handle('tunnel-stop', () => { tunnel.stop(); return tunnel.status(); });
  ipcMain.handle('tunnel-status', () => tunnel.status());
  app.on('before-quit', () => tunnel.stop());

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
