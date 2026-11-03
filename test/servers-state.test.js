const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../servers-state.js');

// Geradores determinísticos.
function makeDeps() {
  let n = 0;
  let c = 0;
  return {
    rand: (len) => String(++n).padStart(len, '0'),
    now: '2026-01-01T00:00:00.000Z',
    randomCode: (len, alphabet) => {
      // Contador em base do alfabeto: cada chamada devolve um código distinto.
      let v = c++;
      let out = '';
      for (let i = 0; i < len; i++) { out = alphabet[v % alphabet.length] + out; v = Math.floor(v / alphabet.length); }
      return out;
    }
  };
}

// Servidor com dono "ana", admin "bia", membros "caio" e "duda".
function setup() {
  const deps = makeDeps();
  const db = S.emptyDb();
  const { server } = S.createServer(db, 'ana', 'Meu Servidor', deps);
  server.members.push('bia', 'caio', 'duda');
  server.admins.push('bia');
  return { db, server, deps };
}

test('migrateLegacy cria a casa com os 6 canais legados, dono mais antigo e todos membros', () => {
  const db = S.emptyDb();
  const users = {
    bia: { created_at: '2025-03-01T00:00:00Z' },
    ana: { created_at: '2025-01-01T00:00:00Z' },
    caio: { created_at: '2025-02-01T00:00:00Z' }
  };
  assert.equal(S.migrateLegacy(db, users), true);
  const casa = db.servers[S.LEGACY_ID];
  assert.equal(S.LEGACY_ID, 'casa');
  assert.equal(casa.owner, 'ana');
  assert.deepEqual(casa.members.sort(), ['ana', 'bia', 'caio']);
  assert.deepEqual(casa.admins, []);
  assert.deepEqual(casa.channels.map((c) => c.id), ['geral', 'jogos', 'musica', 'voz-sala', 'voz-jogos', 'voz-musica']);
  assert.deepEqual(casa.channels.map((c) => c.type), ['text', 'text', 'text', 'voice', 'voice', 'voice']);
});

test('migrateLegacy não roda se já há servidores ou se não há contas', () => {
  const db = S.emptyDb();
  assert.equal(S.migrateLegacy(db, {}), false);
  assert.deepEqual(db.servers, {});
  db.servers.x = { id: 'x' };
  assert.equal(S.migrateLegacy(db, { ana: { created_at: '2025-01-01' } }), false);
  assert.deepEqual(Object.keys(db.servers), ['x']);
});

test('createServer recusa nome inválido', () => {
  const db = S.emptyDb();
  const deps = makeDeps();
  for (const bad of ['', '   ', 'a'.repeat(S.MAX_SERVER_NAME + 1), null, 42]) {
    const r = S.createServer(db, 'ana', bad, deps);
    assert.equal(r.ok, false, String(bad));
    assert.ok(r.error);
  }
  assert.deepEqual(db.servers, {});
});

test('createServer cria 1 canal de texto e 1 de voz e o dono é membro', () => {
  const db = S.emptyDb();
  const r = S.createServer(db, 'ana', '  Meu   Servidor ', makeDeps());
  assert.equal(r.ok, true);
  assert.equal(r.server.name, 'Meu Servidor');
  assert.equal(r.server.owner, 'ana');
  assert.deepEqual(r.server.members, ['ana']);
  assert.deepEqual(r.server.admins, []);
  assert.equal(r.server.channels.length, 2);
  assert.deepEqual(r.server.channels.map((c) => c.type), ['text', 'voice']);
  assert.notEqual(r.server.channels[0].id, r.server.channels[1].id);
  assert.equal(db.servers[r.server.id], r.server);
});

test('roleOf e isManager', () => {
  const { server } = setup();
  assert.equal(S.roleOf(server, 'ana'), 'owner');
  assert.equal(S.roleOf(server, 'bia'), 'admin');
  assert.equal(S.roleOf(server, 'caio'), 'member');
  assert.equal(S.roleOf(server, 'zé'), null);
  assert.equal(S.roleOf(undefined, 'ana'), null);
  assert.equal(S.roleOf(server, ''), null);
  assert.equal(S.isManager(server, 'ana'), true);
  assert.equal(S.isManager(server, 'bia'), true);
  assert.equal(S.isManager(server, 'caio'), false);
  assert.equal(S.isManager(server, 'zé'), false);
});

test('renameServer: admin renomeia, membro não, nome inválido falha', () => {
  const { db, server } = setup();
  assert.equal(S.renameServer(db, server.id, 'bia', 'Novo').ok, true);
  assert.equal(server.name, 'Novo');
  assert.equal(S.renameServer(db, server.id, 'caio', 'Outro').ok, false);
  assert.equal(server.name, 'Novo');
  assert.equal(S.renameServer(db, server.id, 'ana', '  ').ok, false);
  assert.equal(S.renameServer(db, 'inexistente', 'ana', 'x').ok, false);
});

test('deleteServer: só o dono apaga', () => {
  const { db, server } = setup();
  assert.equal(S.deleteServer(db, server.id, 'bia').ok, false);
  assert.equal(S.deleteServer(db, server.id, 'caio').ok, false);
  assert.ok(db.servers[server.id]);
  const r = S.deleteServer(db, server.id, 'ana');
  assert.equal(r.ok, true);
  assert.equal(db.servers[server.id], undefined);
  assert.equal(S.deleteServer(db, server.id, 'ana').ok, false);
});

test('createChannel: tipo inválido, nome de texto em minúsculo com hífens, membro comum não pode', () => {
  const { db, server, deps } = setup();
  assert.equal(S.createChannel(db, server.id, 'ana', 'video', 'x', deps).ok, false);
  const t = S.createChannel(db, server.id, 'bia', 'text', 'Meu Canal Legal', deps);
  assert.equal(t.ok, true);
  assert.equal(t.channel.name, 'meu-canal-legal');
  assert.equal(t.channel.type, 'text');
  const v = S.createChannel(db, server.id, 'ana', 'voice', 'Sala Legal', deps);
  assert.equal(v.channel.name, 'Sala Legal');
  assert.equal(S.createChannel(db, server.id, 'caio', 'text', 'x', deps).ok, false);
  assert.equal(S.createChannel(db, server.id, 'ana', 'text', '', deps).ok, false);
  assert.equal(S.createChannel(db, server.id, 'ana', 'text', 'a'.repeat(S.MAX_CHANNEL_NAME + 1), deps).ok, false);
});

test('createChannel respeita MAX_CHANNELS', () => {
  const { db, server, deps } = setup();
  while (server.channels.length < S.MAX_CHANNELS) {
    assert.equal(S.createChannel(db, server.id, 'ana', 'text', 'c', deps).ok, true);
  }
  assert.equal(server.channels.length, S.MAX_CHANNELS);
  const r = S.createChannel(db, server.id, 'ana', 'text', 'extra', deps);
  assert.equal(r.ok, false);
  assert.equal(server.channels.length, S.MAX_CHANNELS);
});

test('renameChannel: texto vira minúsculo com hífens, voz mantém, permissões', () => {
  const { db, server } = setup();
  const [text, voice] = server.channels;
  const r = S.renameChannel(db, text.id, 'bia', 'Papo Novo');
  assert.equal(r.ok, true);
  assert.equal(text.name, 'papo-novo');
  assert.equal(S.renameChannel(db, voice.id, 'ana', 'Sala Nova').ok, true);
  assert.equal(voice.name, 'Sala Nova');
  assert.equal(S.renameChannel(db, text.id, 'caio', 'x').ok, false);
  assert.equal(S.renameChannel(db, 'nada', 'ana', 'x').ok, false);
  assert.equal(S.renameChannel(db, text.id, 'ana', '').ok, false);
  assert.equal(text.name, 'papo-novo');
});

test('deleteChannel: não apaga o último canal de texto; voz pode; texto extra pode', () => {
  const { db, server, deps } = setup();
  const [text, voice] = server.channels;
  assert.equal(S.deleteChannel(db, text.id, 'ana').ok, false);
  assert.equal(server.channels.length, 2);
  assert.equal(S.deleteChannel(db, voice.id, 'caio').ok, false);
  assert.equal(S.deleteChannel(db, voice.id, 'bia').ok, true);
  assert.equal(S.findChannel(db, voice.id), null);
  const extra = S.createChannel(db, server.id, 'ana', 'text', 'extra', deps).channel;
  assert.equal(S.deleteChannel(db, text.id, 'ana').ok, true);
  assert.deepEqual(server.channels.map((c) => c.id), [extra.id]);
  assert.equal(S.deleteChannel(db, extra.id, 'ana').ok, false);
  assert.equal(S.deleteChannel(db, 'nada', 'ana').ok, false);
});

test('createInvite: só gerente, código de 8 caracteres do alfabeto, limite MAX_INVITES', () => {
  const { db, server, deps } = setup();
  assert.equal(S.createInvite(db, server.id, 'caio', deps).ok, false);
  assert.equal(S.createInvite(db, server.id, 'zé', deps).ok, false);
  const r = S.createInvite(db, server.id, 'bia', deps);
  assert.equal(r.ok, true);
  assert.equal(r.code.length, 8);
  for (const ch of r.code) assert.ok(S.INVITE_ALPHABET.includes(ch), ch);
  assert.deepEqual(server.invites[r.code], { by: 'bia', at: deps.now });
  assert.ok(!/[01OI]/.test(S.INVITE_ALPHABET));
  while (Object.keys(server.invites).length < S.MAX_INVITES) {
    assert.equal(S.createInvite(db, server.id, 'ana', deps).ok, true);
  }
  assert.equal(Object.keys(server.invites).length, S.MAX_INVITES);
  assert.equal(S.createInvite(db, server.id, 'ana', deps).ok, false);
});

test('createInvite gera códigos distintos', () => {
  const { db, server, deps } = setup();
  const a = S.createInvite(db, server.id, 'ana', deps).code;
  const b = S.createInvite(db, server.id, 'ana', deps).code;
  assert.notEqual(a, b);
});

test('revokeInvite: só gerente e só convite existente', () => {
  const { db, server, deps } = setup();
  const { code } = S.createInvite(db, server.id, 'ana', deps);
  assert.equal(S.revokeInvite(db, server.id, 'caio', code).ok, false);
  assert.ok(server.invites[code]);
  assert.equal(S.revokeInvite(db, server.id, 'ana', 'NAOEXISTE').ok, false);
  assert.equal(S.revokeInvite(db, server.id, 'bia', code).ok, true);
  assert.equal(server.invites[code], undefined);
});

test('normalizeCode aceita prefixo vox- e minúsculas', () => {
  assert.equal(S.normalizeCode('vox-abcd2345'), 'ABCD2345');
  assert.equal(S.normalizeCode('  VOX-ABCD2345 '), 'ABCD2345');
  assert.equal(S.normalizeCode('abcd2345'), 'ABCD2345');
  assert.equal(S.normalizeCode(null), '');
  assert.equal(S.normalizeCode(42), '');
});

test('joinByInvite: entra com código em minúsculo, already se já é membro, revogado falha', () => {
  const { db, server, deps } = setup();
  const { code } = S.createInvite(db, server.id, 'ana', deps);
  const r = S.joinByInvite(db, 'vox-' + code.toLowerCase(), 'eva');
  assert.equal(r.ok, true);
  assert.equal(r.already, undefined);
  assert.ok(server.members.includes('eva'));
  assert.equal(S.roleOf(server, 'eva'), 'member');
  const again = S.joinByInvite(db, code, 'eva');
  assert.equal(again.ok, true);
  assert.equal(again.already, true);
  assert.equal(server.members.filter((m) => m === 'eva').length, 1);
  assert.equal(S.joinByInvite(db, code, 'caio').already, true);
  S.revokeInvite(db, server.id, 'ana', code);
  const rev = S.joinByInvite(db, code, 'fabio');
  assert.equal(rev.ok, false);
  assert.ok(!server.members.includes('fabio'));
  assert.equal(S.joinByInvite(db, 'lixo', 'fabio').ok, false);
  assert.equal(S.joinByInvite(db, undefined, 'fabio').ok, false);
});

test('leaveServer: membro e admin saem, dono não, quem não está falha', () => {
  const { db, server } = setup();
  assert.equal(S.leaveServer(db, server.id, 'ana').ok, false);
  assert.equal(S.leaveServer(db, server.id, 'zé').ok, false);
  assert.equal(S.leaveServer(db, server.id, 'caio').ok, true);
  assert.ok(!server.members.includes('caio'));
  assert.equal(S.leaveServer(db, server.id, 'bia').ok, true);
  assert.ok(!server.admins.includes('bia'));
  assert.ok(!server.members.includes('bia'));
  assert.equal(S.leaveServer(db, 'nada', 'ana').ok, false);
});

test('kickMember: dono expulsa admin e membro; admin só membro; ninguém se auto-expulsa', () => {
  const { db, server } = setup();
  server.members.push('edu');
  server.admins.push('edu');
  // admin não expulsa admin nem dono
  assert.equal(S.kickMember(db, server.id, 'bia', 'edu').ok, false);
  assert.equal(S.kickMember(db, server.id, 'bia', 'ana').ok, false);
  // membro comum não expulsa
  assert.equal(S.kickMember(db, server.id, 'caio', 'duda').ok, false);
  // auto-expulsão
  assert.equal(S.kickMember(db, server.id, 'ana', 'ana').ok, false);
  assert.equal(S.kickMember(db, server.id, 'bia', 'bia').ok, false);
  // alvo fora do servidor
  assert.equal(S.kickMember(db, server.id, 'ana', 'zé').ok, false);
  // admin expulsa membro
  assert.equal(S.kickMember(db, server.id, 'bia', 'caio').ok, true);
  assert.ok(!server.members.includes('caio'));
  // dono expulsa admin e some de admins
  assert.equal(S.kickMember(db, server.id, 'ana', 'edu').ok, true);
  assert.ok(!server.members.includes('edu'));
  assert.ok(!server.admins.includes('edu'));
  assert.ok(server.members.includes('ana'));
});

test('setAdmin: só o dono, nunca no dono, só em membros', () => {
  const { db, server } = setup();
  assert.equal(S.setAdmin(db, server.id, 'bia', 'caio', true).ok, false);
  assert.equal(S.setAdmin(db, server.id, 'ana', 'ana', true).ok, false);
  assert.equal(S.setAdmin(db, server.id, 'ana', 'zé', true).ok, false);
  assert.equal(S.setAdmin(db, server.id, 'ana', 'caio', true).ok, true);
  assert.equal(S.roleOf(server, 'caio'), 'admin');
  assert.equal(S.setAdmin(db, server.id, 'ana', 'caio', true).ok, true);
  assert.equal(server.admins.filter((a) => a === 'caio').length, 1);
  assert.equal(S.setAdmin(db, server.id, 'ana', 'caio', false).ok, true);
  assert.equal(S.roleOf(server, 'caio'), 'member');
});

test('transferOwnership: antigo dono vira admin, novo dono sai de admins', () => {
  const { db, server } = setup();
  assert.equal(S.transferOwnership(db, server.id, 'bia', 'caio').ok, false);
  assert.equal(S.transferOwnership(db, server.id, 'ana', 'zé').ok, false);
  assert.equal(S.transferOwnership(db, server.id, 'ana', 'ana').ok, false);
  const r = S.transferOwnership(db, server.id, 'ana', 'bia');
  assert.equal(r.ok, true);
  assert.equal(server.owner, 'bia');
  assert.ok(!server.admins.includes('bia'));
  assert.ok(server.admins.includes('ana'));
  assert.equal(S.roleOf(server, 'ana'), 'admin');
  assert.equal(S.roleOf(server, 'bia'), 'owner');
  // para um membro comum
  assert.equal(S.transferOwnership(db, server.id, 'bia', 'caio').ok, true);
  assert.equal(server.owner, 'caio');
  assert.ok(server.admins.includes('bia'));
  assert.equal(server.admins.filter((a) => a === 'bia').length, 1);
});

test('publicServer: convites só para gerentes e role correto', () => {
  const { db, server, deps } = setup();
  const { code } = S.createInvite(db, server.id, 'ana', deps);
  const dono = S.publicServer(server, 'ana');
  const admin = S.publicServer(server, 'bia');
  const membro = S.publicServer(server, 'caio');
  const fora = S.publicServer(server, 'zé');
  assert.equal(dono.role, 'owner');
  assert.equal(admin.role, 'admin');
  assert.equal(membro.role, 'member');
  assert.equal(fora.role, null);
  assert.deepEqual(dono.invites, [{ code, by: 'ana', at: deps.now }]);
  assert.equal(admin.invites.length, 1);
  assert.deepEqual(membro.invites, []);
  assert.deepEqual(fora.invites, []);
  assert.equal(dono.id, server.id);
  assert.equal(dono.name, server.name);
  // cópias: mudar o resultado não altera o servidor
  dono.members.push('x');
  dono.channels[0].name = 'mexido';
  assert.ok(!server.members.includes('x'));
  assert.notEqual(server.channels[0].name, 'mexido');
});

test('findChannel e serversOf', () => {
  const { db, server, deps } = setup();
  const other = S.createServer(db, 'caio', 'Outro', deps).server;
  const ch = server.channels[0];
  const found = S.findChannel(db, ch.id);
  assert.equal(found.server, server);
  assert.equal(found.channel, ch);
  assert.equal(S.findChannel(db, 'nada'), null);
  assert.deepEqual(S.serversOf(db, 'caio').map((s) => s.id).sort(), [server.id, other.id].sort());
  assert.deepEqual(S.serversOf(db, 'ana').map((s) => s.id), [server.id]);
  assert.deepEqual(S.serversOf(db, 'zé'), []);
});
