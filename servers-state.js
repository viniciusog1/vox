// Servidores (como as "guildas" do Discord) dentro da mesma instalação do Vox:
// nome, dono, administradores, membros, canais e convites. Funções puras sobre
// o objeto gravado em servers.json; main.js grava e difunde. Também roda no Node (testes).
(function () {
  const MAX_SERVER_NAME = 40;
  const MAX_CHANNEL_NAME = 32;
  const MAX_CHANNELS = 50;
  const MAX_INVITES = 20;
  const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I
  const LEGACY_ID = 'casa';

  // Nome limpo ou null (vazio ou longo demais).
  function cleanName(name, max) {
    if (typeof name !== 'string') return null;
    const n = name.trim().replace(/\s+/g, ' ');
    return n && n.length <= max ? n : null;
  }

  function newChannelId(rand) {
    return 'c' + rand(10);
  }

  function emptyDb() {
    return { servers: {} };
  }

  // A antiga Casa dos Amigos vira um servidor comum. Mantém os ids dos canais
  // (as mensagens gravadas usam esses ids). Dono: a conta mais antiga.
  function migrateLegacy(db, users) {
    if (Object.keys(db.servers).length) return false;
    const names = Object.keys(users);
    if (!names.length) return false;
    const owner = names.slice().sort((a, b) => String(users[a].created_at).localeCompare(String(users[b].created_at)))[0];
    db.servers[LEGACY_ID] = {
      id: LEGACY_ID,
      name: 'Casa dos Amigos',
      owner,
      admins: [],
      members: names.slice(),
      channels: [
        { id: 'geral', name: 'geral', type: 'text' },
        { id: 'jogos', name: 'jogos', type: 'text' },
        { id: 'musica', name: 'música', type: 'text' },
        { id: 'voz-sala', name: 'Sala Principal', type: 'voice' },
        { id: 'voz-jogos', name: 'Jogos', type: 'voice' },
        { id: 'voz-musica', name: 'Música', type: 'voice' }
      ],
      invites: {},
      autoJoin: true,
      createdAt: new Date(0).toISOString()
    };
    return true;
  }

  // A Casa dos Amigos é o lugar de todo mundo: contas novas entram sem convite.
  // Para servers.json gravado antes dessa regra existir.
  function ensureLegacyAutoJoin(db) {
    const casa = db.servers[LEGACY_ID];
    if (!casa || casa.autoJoin !== undefined) return false;
    casa.autoJoin = true;
    return true;
  }

  // Conta recém-criada entra nos servidores marcados com autoJoin. Devolve os servidores.
  function joinAutoServers(db, user) {
    const joined = [];
    for (const server of Object.values(db.servers)) {
      if (server.autoJoin && !server.members.includes(user)) {
        server.members.push(user);
        joined.push(server);
      }
    }
    return joined;
  }

  function roleOf(server, user) {
    if (!server || !user) return null;
    if (server.owner === user) return 'owner';
    if (!server.members.includes(user)) return null;
    return server.admins.includes(user) ? 'admin' : 'member';
  }

  const isManager = (server, user) => ['owner', 'admin'].includes(roleOf(server, user));

  function serversOf(db, user) {
    return Object.values(db.servers).filter((s) => s.members.includes(user));
  }

  function findChannel(db, channelId) {
    for (const server of Object.values(db.servers)) {
      const channel = server.channels.find((c) => c.id === channelId);
      if (channel) return { server, channel };
    }
    return null;
  }

  // Resultado padrão: { ok: true, ... } ou { ok: false, error }
  const fail = (error) => ({ ok: false, error });

  function createServer(db, owner, name, { rand, now }) {
    const n = cleanName(name, MAX_SERVER_NAME);
    if (!n) return fail(`O nome do servidor deve ter de 1 a ${MAX_SERVER_NAME} caracteres.`);
    let id;
    do { id = 's' + rand(10); } while (db.servers[id]);
    const server = {
      id, name: n, owner, admins: [], members: [owner],
      channels: [
        { id: newChannelId(rand), name: 'geral', type: 'text' },
        { id: newChannelId(rand), name: 'Geral', type: 'voice' }
      ],
      invites: {},
      createdAt: now
    };
    db.servers[id] = server;
    return { ok: true, server };
  }

  function renameServer(db, serverId, user, name) {
    const server = db.servers[serverId];
    if (!isManager(server, user)) return fail('Só o dono e os administradores podem mudar o servidor.');
    const n = cleanName(name, MAX_SERVER_NAME);
    if (!n) return fail(`O nome do servidor deve ter de 1 a ${MAX_SERVER_NAME} caracteres.`);
    server.name = n;
    return { ok: true, server };
  }

  function deleteServer(db, serverId, user) {
    const server = db.servers[serverId];
    if (roleOf(server, user) !== 'owner') return fail('Só o dono pode apagar o servidor.');
    delete db.servers[serverId];
    return { ok: true, server };
  }

  function createChannel(db, serverId, user, type, name, { rand }) {
    const server = db.servers[serverId];
    if (!isManager(server, user)) return fail('Só o dono e os administradores podem criar canais.');
    if (type !== 'text' && type !== 'voice') return fail('Tipo de canal inválido.');
    if (server.channels.length >= MAX_CHANNELS) return fail(`O servidor já tem ${MAX_CHANNELS} canais.`);
    const n = cleanName(name, MAX_CHANNEL_NAME);
    if (!n) return fail(`O nome do canal deve ter de 1 a ${MAX_CHANNEL_NAME} caracteres.`);
    const channel = { id: newChannelId(rand), name: type === 'text' ? n.toLowerCase().replace(/ /g, '-') : n, type };
    server.channels.push(channel);
    return { ok: true, server, channel };
  }

  function renameChannel(db, channelId, user, name) {
    const found = findChannel(db, channelId);
    if (!found || !isManager(found.server, user)) return fail('Só o dono e os administradores podem mudar canais.');
    const n = cleanName(name, MAX_CHANNEL_NAME);
    if (!n) return fail(`O nome do canal deve ter de 1 a ${MAX_CHANNEL_NAME} caracteres.`);
    found.channel.name = found.channel.type === 'text' ? n.toLowerCase().replace(/ /g, '-') : n;
    return { ok: true, ...found };
  }

  // O servidor precisa manter ao menos um canal de texto.
  function deleteChannel(db, channelId, user) {
    const found = findChannel(db, channelId);
    if (!found || !isManager(found.server, user)) return fail('Só o dono e os administradores podem apagar canais.');
    const { server, channel } = found;
    if (channel.type === 'text' && server.channels.filter((c) => c.type === 'text').length === 1) {
      return fail('O servidor precisa de pelo menos um canal de texto.');
    }
    server.channels = server.channels.filter((c) => c.id !== channelId);
    return { ok: true, server, channel };
  }

  function createInvite(db, serverId, user, { rand, now, randomCode }) {
    const server = db.servers[serverId];
    if (!isManager(server, user)) return fail('Só o dono e os administradores podem convidar.');
    if (Object.keys(server.invites).length >= MAX_INVITES) return fail(`Limite de ${MAX_INVITES} convites; revogue algum.`);
    let code;
    let tries = 0;
    do {
      if (++tries > 20) return fail('Não foi possível gerar um código novo; tente de novo.');
      code = randomCode(8, INVITE_ALPHABET);
    } while (findInvite(db, code));
    server.invites[code] = { by: user, at: now };
    return { ok: true, server, code };
  }

  function revokeInvite(db, serverId, user, code) {
    const server = db.servers[serverId];
    if (!isManager(server, user)) return fail('Só o dono e os administradores podem revogar convites.');
    if (!server.invites[code]) return fail('Convite não encontrado.');
    delete server.invites[code];
    return { ok: true, server };
  }

  // Aceita o código com ou sem o prefixo "vox-" e em minúsculas.
  function normalizeCode(code) {
    return typeof code === 'string' ? code.trim().toUpperCase().replace(/^VOX-/, '') : '';
  }

  function findInvite(db, code) {
    const c = normalizeCode(code);
    return Object.values(db.servers).find((s) => s.invites[c]) || null;
  }

  function joinByInvite(db, code, user) {
    const server = findInvite(db, code);
    if (!server) return fail('Convite inválido ou revogado.');
    if (server.members.includes(user)) return { ok: true, server, already: true };
    server.members.push(user);
    return { ok: true, server };
  }

  function leaveServer(db, serverId, user) {
    const server = db.servers[serverId];
    const role = roleOf(server, user);
    if (!role) return fail('Você não está nesse servidor.');
    if (role === 'owner') return fail('O dono não pode sair: passe a posse para outra pessoa ou apague o servidor.');
    removeMember(server, user);
    return { ok: true, server };
  }

  function removeMember(server, user) {
    server.members = server.members.filter((m) => m !== user);
    server.admins = server.admins.filter((m) => m !== user);
  }

  // Dono expulsa qualquer um; administrador só expulsa membro comum.
  function kickMember(db, serverId, user, target) {
    const server = db.servers[serverId];
    const role = roleOf(server, user);
    const targetRole = roleOf(server, target);
    if (!targetRole) return fail('Essa pessoa não está no servidor.');
    if (target === user) return fail('Para sair, use "Sair do servidor".');
    const allowed = role === 'owner' || (role === 'admin' && targetRole === 'member');
    if (!allowed) return fail('Você não pode expulsar essa pessoa.');
    removeMember(server, target);
    return { ok: true, server };
  }

  function setAdmin(db, serverId, user, target, admin) {
    const server = db.servers[serverId];
    if (roleOf(server, user) !== 'owner') return fail('Só o dono pode mudar administradores.');
    const targetRole = roleOf(server, target);
    if (!targetRole || targetRole === 'owner') return fail('Escolha um membro do servidor.');
    server.admins = server.admins.filter((m) => m !== target);
    if (admin) server.admins.push(target);
    return { ok: true, server };
  }

  // O dono antigo continua como administrador.
  function transferOwnership(db, serverId, user, target) {
    const server = db.servers[serverId];
    if (roleOf(server, user) !== 'owner') return fail('Só o dono pode passar a posse.');
    if (!['admin', 'member'].includes(roleOf(server, target))) return fail('Escolha um membro do servidor.');
    server.owner = target;
    server.admins = server.admins.filter((m) => m !== target);
    if (!server.admins.includes(user)) server.admins.push(user);
    return { ok: true, server };
  }

  // O que cada pessoa recebe do servidor: convites só para quem administra.
  function publicServer(server, viewer) {
    const manager = isManager(server, viewer);
    return {
      id: server.id,
      name: server.name,
      owner: server.owner,
      admins: server.admins.slice(),
      members: server.members.slice(),
      channels: server.channels.map((c) => ({ ...c })),
      role: roleOf(server, viewer),
      invites: manager ? Object.entries(server.invites).map(([code, v]) => ({ code, by: v.by, at: v.at })) : []
    };
  }

  const api = {
    MAX_SERVER_NAME, MAX_CHANNEL_NAME, MAX_CHANNELS, MAX_INVITES, INVITE_ALPHABET, LEGACY_ID,
    cleanName, emptyDb, migrateLegacy, ensureLegacyAutoJoin, joinAutoServers, roleOf, isManager, serversOf, findChannel,
    createServer, renameServer, deleteServer, createChannel, renameChannel, deleteChannel,
    createInvite, revokeInvite, normalizeCode, findInvite, joinByInvite, leaveServer,
    kickMember, setAdmin, transferOwnership, publicServer
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxServers = api;
})();
