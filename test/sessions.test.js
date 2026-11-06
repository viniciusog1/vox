const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionStore, hashToken } = require('../src/main/sessions.js');

test('emite, resolve e revoga; grava só o hash do token', () => {
  let saved = null;
  const store = createSessionStore({ save: (d) => { saved = JSON.parse(JSON.stringify(d)); } });
  const token = store.issue('ana');
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(store.resolve(token), 'ana');
  assert.ok(saved[hashToken(token)]);
  assert.ok(!JSON.stringify(saved).includes(token));
  store.revoke(token);
  assert.equal(store.resolve(token), null);
});

test('token vencido, inválido ou de conta apagada não vale', () => {
  let t = 1000;
  const store = createSessionStore({ now: () => t, ttlMs: 500 });
  const token = store.issue('ana');
  assert.equal(store.resolve(token, (u) => u !== 'ana'), null);
  assert.equal(store.resolve('x'), null);
  assert.equal(store.resolve(undefined), null);
  t = 1600;
  assert.equal(store.resolve(token), null);
});

test('carrega sessões gravadas', () => {
  const first = createSessionStore();
  const token = first.issue('bia');
  let data;
  const writer = createSessionStore({ save: (d) => { data = d; } });
  const t2 = writer.issue('bia');
  const reloaded = createSessionStore({ load: () => data });
  assert.equal(reloaded.resolve(t2), 'bia');
  assert.equal(reloaded.resolve(token), null);
});
