const test = require('node:test');
const assert = require('node:assert/strict');
const { publicUser, applyStatePatch, joinVoiceRoom, leaveVoiceRoom, canUseTextRoom } = require('../room-state.js');

test('publicUser preenche padrões', () => {
  assert.deepEqual(publicUser('a', { username: 'ana' }),
    { id: 'a', username: 'ana', muted: false, status: 'online', sharing: false });
});

test('publicUser repassa sharing', () => {
  assert.equal(publicUser('b', { username: 'bruno', sharing: true }).sharing, true);
});

test('applyStatePatch aceita sharing booleano', () => {
  const entry = { username: 'ana' };
  applyStatePatch(entry, { sharing: true });
  assert.equal(entry.sharing, true);
  applyStatePatch(entry, { sharing: false });
  assert.equal(entry.sharing, false);
});

test('applyStatePatch ignora tipos errados', () => {
  const entry = { username: 'ana', muted: false, status: 'online', sharing: false };
  applyStatePatch(entry, { sharing: 'sim', muted: 1, status: 'hacker' });
  assert.deepEqual(entry, { username: 'ana', muted: false, status: 'online', sharing: false });
});

test('applyStatePatch não apaga campos ausentes', () => {
  const entry = { username: 'ana', sharing: true };
  applyStatePatch(entry, { status: 'busy' });
  assert.equal(entry.sharing, true);
  assert.equal(entry.status, 'busy');
});

test('applyStatePatch tolera patch vazio', () => {
  const entry = { username: 'ana' };
  assert.doesNotThrow(() => applyStatePatch(entry, undefined));
  assert.deepEqual(entry, { username: 'ana' });
});

test('joinVoiceRoom entra e devolve null', () => {
  const roomUsers = new Map();
  assert.equal(joinVoiceRoom(roomUsers, 'a', 'voz-sala', { username: 'ana' }), null);
  const entry = roomUsers.get('voz-sala').get('a');
  assert.equal(entry.username, 'ana');
  assert.equal(entry.sharing, false);
});

test('joinVoiceRoom troca de sala', () => {
  const roomUsers = new Map();
  joinVoiceRoom(roomUsers, 'a', 'voz-sala', { username: 'ana' });
  assert.equal(joinVoiceRoom(roomUsers, 'a', 'voz-jogos', { username: 'ana' }), 'voz-sala');
  assert.equal(roomUsers.has('voz-sala'), false);
  assert.equal(roomUsers.get('voz-jogos').has('a'), true);
});

test('joinVoiceRoom repetido na mesma sala não duplica', () => {
  const roomUsers = new Map();
  joinVoiceRoom(roomUsers, 'a', 'voz-sala', { username: 'ana' });
  roomUsers.get('voz-sala').get('a').sharing = true;
  joinVoiceRoom(roomUsers, 'a', 'voz-sala', { username: 'ana' });
  assert.equal(roomUsers.get('voz-sala').size, 1);
  assert.equal(roomUsers.get('voz-sala').get('a').sharing, false);
});

test('leaveVoiceRoom devolve sala e limpa', () => {
  const roomUsers = new Map();
  joinVoiceRoom(roomUsers, 'a', 'voz-sala', { username: 'ana' });
  assert.equal(leaveVoiceRoom(roomUsers, 'a'), 'voz-sala');
  assert.equal(roomUsers.has('voz-sala'), false);
  assert.equal(leaveVoiceRoom(roomUsers, 'a'), null);
});

test('leaveVoiceRoom mantém sala com outros', () => {
  const roomUsers = new Map();
  joinVoiceRoom(roomUsers, 'a', 'voz-sala', { username: 'ana' });
  joinVoiceRoom(roomUsers, 'b', 'voz-sala', { username: 'bruno' });
  leaveVoiceRoom(roomUsers, 'a');
  assert.deepEqual([...roomUsers.get('voz-sala').keys()], ['b']);
});

test('canUseTextRoom', () => {
  assert.equal(canUseTextRoom('geral', 'geral'), true);
  assert.equal(canUseTextRoom('geral', 'jogos'), false);
  assert.equal(canUseTextRoom('geral', 'voz-sala'), false);
  assert.equal(canUseTextRoom(undefined, 'geral'), false);
});
