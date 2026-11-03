const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../music-history.js');

const at = (n) => `2026-11-03T10:00:${String(n).padStart(2, '0')}.000Z`;

test('guarda pedidos por servidor e limita o histórico', () => {
  const db = H.emptyDb();
  for (let i = 0; i < H.MAX_ENTRIES + 5; i++) H.recordRequest(db, 's1', { videoId: 'v' + i, title: 'T' + i }, at(i % 60));
  assert.equal(db.s1.length, H.MAX_ENTRIES);
  assert.equal(db.s1[0].videoId, 'v5');
  H.recordRequest(db, 's2', { videoId: 'x' }, at(1));
  assert.equal(db.s2.length, 1);
  H.recordRequest(db, '', { videoId: 'x' }, at(1));
  H.recordRequest(db, 's3', {}, at(1));
  assert.equal(db[''], undefined);
  assert.equal(db.s3, undefined);
});

test('recentes sem repetir, da mais nova para a mais antiga', () => {
  const db = H.emptyDb();
  H.recordRequest(db, 's', { videoId: 'a', title: 'A', addedBy: 'ana' }, at(1));
  H.recordRequest(db, 's', { videoId: 'b', title: 'B', addedBy: 'bia' }, at(2));
  H.recordRequest(db, 's', { videoId: 'a', title: 'A', addedBy: 'caio' }, at(3));
  const { recent } = H.suggestionsFor(db, 's');
  assert.deepEqual(recent.map((r) => r.videoId), ['a', 'b']);
  assert.equal(recent[0].count, 2);
  assert.equal(recent[0].lastBy, 'caio');
});

test('mais pedidas: só 2× ou mais, ordenadas pela contagem', () => {
  const db = H.emptyDb();
  const add = (id, n) => H.recordRequest(db, 's', { videoId: id, title: id }, at(n));
  add('a', 1); add('b', 2); add('b', 3); add('c', 4); add('c', 5); add('c', 6);
  const { top } = H.suggestionsFor(db, 's');
  assert.deepEqual(top.map((t) => [t.videoId, t.count]), [['c', 3], ['b', 2]]);
});

test('marca o que já está na fila e separa servidores', () => {
  const db = H.emptyDb();
  H.recordRequest(db, 's', { videoId: 'a' }, at(1));
  H.recordRequest(db, 's', { videoId: 'b' }, at(2));
  const { recent } = H.suggestionsFor(db, 's', ['b']);
  assert.deepEqual(recent.map((r) => [r.videoId, r.inQueue]), [['b', true], ['a', false]]);
  assert.deepEqual(H.suggestionsFor(db, 'outro'), { recent: [], top: [] });
});

test('limite de sugestões e apagar o histórico de um servidor', () => {
  const db = H.emptyDb();
  for (let i = 0; i < 30; i++) { H.recordRequest(db, 's', { videoId: 'v' + i }, at(i)); H.recordRequest(db, 's', { videoId: 'v' + i }, at(i)); }
  const s = H.suggestionsFor(db, 's');
  assert.equal(s.recent.length, H.MAX_SUGGESTIONS);
  assert.equal(s.top.length, H.MAX_SUGGESTIONS);
  assert.equal(H.dropScope(db, 's'), true);
  assert.equal(H.dropScope(db, 's'), false);
});
