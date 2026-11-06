const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/shared/friends-state.js');

const contas = new Set(['ana', 'bia', 'caio']);
const deps = { exists: (u) => contas.has(u), now: '2026-01-01T00:00:00.000Z' };

test('sendRequest: recusa a si mesmo, conta inexistente e vazio', () => {
  const db = F.emptyDb();
  assert.equal(F.sendRequest(db, 'ana', 'ana', deps).ok, false);
  assert.equal(F.sendRequest(db, 'ana', 'zé', deps).ok, false);
  assert.equal(F.sendRequest(db, 'ana', '', deps).ok, false);
  assert.equal(F.sendRequest(db, 'ana', undefined, deps).ok, false);
  assert.deepEqual(db.requests, []);
});

test('sendRequest: cria pedido e recusa duplicado', () => {
  const db = F.emptyDb();
  const r = F.sendRequest(db, 'ana', 'bia', deps);
  assert.deepEqual(r, { ok: true, accepted: false });
  assert.deepEqual(db.requests, [{ from: 'ana', to: 'bia', at: deps.now }]);
  assert.equal(F.sendRequest(db, 'ana', 'bia', deps).ok, false);
  assert.equal(db.requests.length, 1);
});

test('sendRequest: pedido cruzado vira amizade com accepted:true', () => {
  const db = F.emptyDb();
  F.sendRequest(db, 'ana', 'bia', deps);
  const r = F.sendRequest(db, 'bia', 'ana', deps);
  assert.deepEqual(r, { ok: true, accepted: true });
  assert.deepEqual(db.requests, []);
  assert.equal(F.areFriends(db, 'ana', 'bia'), true);
  assert.equal(F.areFriends(db, 'bia', 'ana'), true);
});

test('sendRequest: recusa quando já são amigos', () => {
  const db = F.emptyDb();
  F.sendRequest(db, 'ana', 'bia', deps);
  F.acceptRequest(db, 'bia', 'ana');
  assert.equal(F.sendRequest(db, 'ana', 'bia', deps).ok, false);
  assert.equal(F.sendRequest(db, 'bia', 'ana', deps).ok, false);
  assert.deepEqual(db.requests, []);
});

test('acceptRequest: só quem recebeu aceita', () => {
  const db = F.emptyDb();
  F.sendRequest(db, 'ana', 'bia', deps);
  assert.equal(F.acceptRequest(db, 'ana', 'bia').ok, false); // quem enviou não aceita
  assert.equal(F.acceptRequest(db, 'bia', 'caio').ok, false);
  assert.equal(F.areFriends(db, 'ana', 'bia'), false);
  assert.equal(F.acceptRequest(db, 'bia', 'ana').ok, true);
  assert.deepEqual(db.requests, []);
  assert.deepEqual(F.friendsOf(db, 'ana'), ['bia']);
  assert.deepEqual(F.friendsOf(db, 'bia'), ['ana']);
  assert.equal(F.acceptRequest(db, 'bia', 'ana').ok, false);
});

test('dropRequest: recusar e cancelar', () => {
  const db = F.emptyDb();
  F.sendRequest(db, 'ana', 'bia', deps);
  assert.equal(F.dropRequest(db, 'bia', 'ana').ok, true); // recusar
  assert.deepEqual(db.requests, []);
  F.sendRequest(db, 'ana', 'bia', deps);
  assert.equal(F.dropRequest(db, 'ana', 'bia').ok, true); // cancelar
  assert.deepEqual(db.requests, []);
  assert.equal(F.dropRequest(db, 'ana', 'bia').ok, false);
  assert.equal(F.areFriends(db, 'ana', 'bia'), false);
});

test('removeFriend: remove nos dois lados e falha se não são amigos', () => {
  const db = F.emptyDb();
  assert.equal(F.removeFriend(db, 'ana', 'bia').ok, false);
  F.sendRequest(db, 'ana', 'bia', deps);
  F.acceptRequest(db, 'bia', 'ana');
  F.sendRequest(db, 'ana', 'caio', deps);
  F.acceptRequest(db, 'caio', 'ana');
  assert.equal(F.removeFriend(db, 'bia', 'ana').ok, true);
  assert.equal(F.areFriends(db, 'ana', 'bia'), false);
  assert.equal(F.areFriends(db, 'bia', 'ana'), false);
  assert.deepEqual(F.friendsOf(db, 'ana'), ['caio']);
  assert.equal(F.removeFriend(db, 'ana', 'bia').ok, false);
});

test('friendsOf devolve cópia e [] para desconhecido', () => {
  const db = F.emptyDb();
  assert.deepEqual(F.friendsOf(db, 'ninguem'), []);
  F.sendRequest(db, 'ana', 'bia', deps);
  F.acceptRequest(db, 'bia', 'ana');
  F.friendsOf(db, 'ana').push('x');
  assert.deepEqual(F.friendsOf(db, 'ana'), ['bia']);
});

test('requestsFor separa recebidos e enviados', () => {
  const db = F.emptyDb();
  F.sendRequest(db, 'ana', 'bia', deps);
  F.sendRequest(db, 'caio', 'ana', deps);
  assert.deepEqual(F.requestsFor(db, 'ana'), {
    incoming: [{ user: 'caio', at: deps.now }],
    outgoing: [{ user: 'bia', at: deps.now }]
  });
  assert.deepEqual(F.requestsFor(db, 'bia'), { incoming: [{ user: 'ana', at: deps.now }], outgoing: [] });
  assert.deepEqual(F.requestsFor(db, 'zé'), { incoming: [], outgoing: [] });
});

test('dmKey e callKey em ordem alfabética, iguais nos dois sentidos', () => {
  assert.equal(F.dmKey('bia', 'ana'), 'dm:ana|bia');
  assert.equal(F.dmKey('ana', 'bia'), 'dm:ana|bia');
  assert.equal(F.callKey('bia', 'ana'), 'call:ana|bia');
  assert.equal(F.callKey('ana', 'bia'), F.callKey('bia', 'ana'));
  assert.equal(F.DM_PREFIX, 'dm:');
  assert.equal(F.CALL_PREFIX, 'call:');
});

test('pairOf aceita chave válida e rejeita malformadas', () => {
  assert.deepEqual(F.pairOf('dm:ana|bia', F.DM_PREFIX), ['ana', 'bia']);
  assert.deepEqual(F.pairOf('call:ana|bia', F.CALL_PREFIX), ['ana', 'bia']);
  for (const bad of ['dm:a', 'dm:a|a', 'dm:', 'dm:|a', 'dm:a|', 'dm:a|b|c', 'outra', 'call:a|b', null, undefined, 42]) {
    assert.equal(F.pairOf(bad, F.DM_PREFIX), null, String(bad));
  }
  assert.equal(F.pairOf('dm:ana|bia', F.CALL_PREFIX), null);
  assert.equal(F.isDmKey('dm:ana|bia'), true);
  assert.equal(F.isDmKey('call:ana|bia'), false);
  assert.equal(F.isCallKey('call:ana|bia'), true);
  assert.equal(F.isCallKey('dm:a|a'), false);
});

test('otherOf devolve o outro ou null', () => {
  assert.equal(F.otherOf('dm:ana|bia', 'ana'), 'bia');
  assert.equal(F.otherOf('dm:ana|bia', 'bia'), 'ana');
  assert.equal(F.otherOf('call:ana|bia', 'bia'), 'ana');
  assert.equal(F.otherOf('dm:ana|bia', 'caio'), null);
  assert.equal(F.otherOf('geral', 'ana'), null);
  assert.equal(F.otherOf('dm:a', 'a'), null);
});

test('canReadDm: só os dois participantes', () => {
  assert.equal(F.canReadDm('dm:ana|bia', 'ana'), true);
  assert.equal(F.canReadDm('dm:ana|bia', 'bia'), true);
  assert.equal(F.canReadDm('dm:ana|bia', 'caio'), false);
  assert.equal(F.canReadDm('call:ana|bia', 'ana'), false);
  assert.equal(F.canReadDm('geral', 'ana'), false);
});

test('canWriteDm exige amizade; depois de removeFriend lê mas não escreve', () => {
  const db = F.emptyDb();
  const key = F.dmKey('ana', 'bia');
  assert.equal(F.canWriteDm(db, key, 'ana'), false);
  F.sendRequest(db, 'ana', 'bia', deps);
  F.acceptRequest(db, 'bia', 'ana');
  assert.equal(F.canWriteDm(db, key, 'ana'), true);
  assert.equal(F.canWriteDm(db, key, 'bia'), true);
  assert.equal(F.canWriteDm(db, key, 'caio'), false);
  assert.equal(F.canWriteDm(db, 'call:ana|bia', 'ana'), false);
  assert.equal(F.canWriteDm(db, 'geral', 'ana'), false);
  F.removeFriend(db, 'ana', 'bia');
  assert.equal(F.canReadDm(key, 'ana'), true);
  assert.equal(F.canReadDm(key, 'bia'), true);
  assert.equal(F.canWriteDm(db, key, 'ana'), false);
  assert.equal(F.canWriteDm(db, key, 'bia'), false);
});
