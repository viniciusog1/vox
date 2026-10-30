const test = require('node:test');
const assert = require('node:assert/strict');
const { publicUser, applyStatePatch } = require('../room-state.js');

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
