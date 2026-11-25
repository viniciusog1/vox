const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { profileOf, placeCard } = require('../src/renderer/profile-card.js');

const base = (over = {}) => ({
  user: 'ana', me: 'eu',
  friends: { friends: [], incoming: [], outgoing: [] },
  members: [{ username: 'ana', online: true, status: 'online' }, { username: 'eu', online: true, status: 'online' }],
  servers: [
    { id: 's1', name: 'Casa', owner: 'ana', admins: ['bia'], members: ['ana', 'bia', 'eu'] },
    { id: 's2', name: 'Jogos', owner: 'eu', admins: [], members: ['eu'] }
  ],
  serverId: 's1', call: null, ...over
});
const ids = (p) => p.actions.map((a) => a.id);

test('quem não é amigo: pedir amizade', () => {
  const p = profileOf(base());
  assert.equal(p.relation, 'none');
  assert.deepEqual(ids(p), ['request']);
});

test('pedido enviado, recebido e amizade mudam os botões', () => {
  const f = (over) => profileOf(base({ friends: { friends: [], incoming: [], outgoing: [], ...over } }));
  assert.deepEqual(ids(f({ outgoing: [{ user: 'ana' }] })), ['cancel']);
  assert.deepEqual(ids(f({ incoming: [{ user: 'ana' }] })), ['accept', 'refuse']);
  assert.deepEqual(ids(f({ friends: ['ana'] })), ['message', 'call', 'unfriend']);
});

test('não dá para ligar para amigo offline nem para quem já está na chamada', () => {
  const friends = { friends: ['ana'], incoming: [], outgoing: [] };
  assert.deepEqual(ids(profileOf(base({ friends, members: [{ username: 'ana', online: false }] }))), ['message', 'unfriend']);
  assert.deepEqual(ids(profileOf(base({ friends, call: [{ username: 'ana' }] }))), ['message', 'unfriend']);
});

test('meu próprio perfil só leva às configurações, sem volume', () => {
  const p = profileOf(base({ user: 'eu', call: [{ username: 'eu', sharing: true }] }));
  assert.equal(p.relation, 'me');
  assert.deepEqual(ids(p), ['settings']);
  assert.deepEqual(p.volumes, []);
});

test('volumes: voz só com a pessoa na mesma chamada, transmissão só se ela compartilha', () => {
  assert.deepEqual(profileOf(base()).volumes, []);
  assert.deepEqual(profileOf(base({ call: [{ username: 'bia' }] })).volumes, []);
  assert.deepEqual(profileOf(base({ call: [{ username: 'ana' }] })).volumes, ['voice']);
  assert.deepEqual(profileOf(base({ call: [{ username: 'ana', sharing: true }] })).volumes, ['voice', 'screen']);
});

test('cargo no servidor aberto, servidores em comum e status', () => {
  assert.equal(profileOf(base()).role, 'owner');
  assert.equal(profileOf(base({ user: 'bia' })).role, 'admin');
  assert.equal(profileOf(base({ user: 'eu' })).role, null);
  assert.equal(profileOf(base({ serverId: null })).role, null);
  assert.deepEqual(profileOf(base()).mutual, ['Casa']);
  assert.equal(profileOf(base()).status, 'online');
  assert.equal(profileOf(base({ members: [{ username: 'ana', online: false, status: 'offline' }] })).status, 'offline');
});

test('conta que não existe mais: só o nome, sem ações', () => {
  const p = profileOf(base({ user: 'fantasma' }));
  assert.equal(p.exists, false);
  assert.deepEqual(p.actions, []);
});

test('o cartão fica ao lado do avatar e nunca sai da janela', () => {
  const card = { width: 300, height: 400 };
  const win = { width: 1280, height: 800 };
  const at = (left, top, w = 200) => placeCard({ left, top, right: left + w, bottom: top + 30 }, card, win);
  assert.deepEqual(at(80, 280), { left: 288, top: 280 });       // lista da voz: à direita
  assert.deepEqual(at(1070, 100), { left: 762, top: 100 });     // membros: à esquerda
  assert.equal(at(80, 780).top, 392);                           // perto do fim: sobe
  for (const [l, t, w] of [[0, 0, 1280], [500, 790, 300], [1270, 0, 10]]) {
    const p = at(l, t, w);
    assert.ok(p.left >= 8 && p.left + 300 <= 1272 && p.top >= 8 && p.top + 400 <= 792, JSON.stringify(p));
  }
  assert.deepEqual(placeCard({ left: 0, top: 0, right: 50, bottom: 20 }, { width: 300, height: 900 }, win).top, 8);
});

test('o cartão é carregado depois do renderer.js e fecha ao sair da conta', () => {
  const dir = path.join(__dirname, '..', 'src', 'renderer');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(html.indexOf('src="profile-card.js"') > html.indexOf('src="renderer.js"'));
  const js = fs.readFileSync(path.join(dir, 'renderer.js'), 'utf8');
  assert.match(js.slice(js.indexOf('function endSession'), js.indexOf('function endSession') + 900), /VoxProfile\.close\(\)/);
});
