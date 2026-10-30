const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../music-state.js');

const item = (id) => ({ id, videoId: 'v' + id, title: 'T' + id, thumbnail: 't', addedBy: null });

test('primeira música começa tocando do zero', () => {
  const s = M.createMusicState();
  assert.deepEqual(M.addTrack(s, item('A'), 1000), { ok: true });
  assert.equal(s.playing, true);
  assert.equal(M.positionAt(s, 4000), 3000);
});

test('fila cheia', () => {
  const s = M.createMusicState();
  for (let i = 0; i < 50; i++) assert.deepEqual(M.addTrack(s, item('i' + i), 0), { ok: true });
  assert.deepEqual(M.addTrack(s, item('x'), 0), { ok: false, error: 'full' });
  assert.equal(s.queue.length, 50);
});

test('pular duas vezes o mesmo item pula uma música só', () => {
  const s = M.createMusicState();
  ['A', 'B', 'C'].forEach((id) => M.addTrack(s, item(id), 0));
  assert.equal(M.advanceIfCurrent(s, 'A', 10), true);
  assert.equal(M.advanceIfCurrent(s, 'A', 11), false);
  assert.equal(s.queue[0].id, 'B');
  assert.equal(s.queue.length, 2);
});

test('terminar com a música pausada é ignorado', () => {
  const s = M.createMusicState();
  M.addTrack(s, item('A'), 0);
  M.togglePause(s, 100);
  assert.equal(M.endedIfCurrent(s, 'A', 200), false);
  assert.equal(s.queue.length, 1);
});

test('terminar a atual tocando avança', () => {
  const s = M.createMusicState();
  M.addTrack(s, item('A'), 0);
  M.addTrack(s, item('B'), 0);
  assert.equal(M.endedIfCurrent(s, 'A', 500), true);
  assert.equal(s.queue[0].id, 'B');
  assert.equal(M.positionAt(s, 700), 200);
});

test('pausar e continuar mantém a posição', () => {
  const s = M.createMusicState();
  M.addTrack(s, item('A'), 0);
  M.togglePause(s, 5000);
  assert.equal(s.playing, false);
  assert.equal(M.positionAt(s, 99999), 5000);
  M.togglePause(s, 100000);
  assert.equal(s.playing, true);
  assert.equal(M.positionAt(s, 101000), 6000);
});

test('togglePause sem música não faz nada', () => {
  const s = M.createMusicState();
  M.togglePause(s, 100);
  assert.deepEqual(s, M.createMusicState());
});

test('remover a atual começa a próxima do zero', () => {
  const s = M.createMusicState();
  M.addTrack(s, item('A'), 0);
  M.addTrack(s, item('B'), 0);
  assert.equal(M.removeTrack(s, 'A', 8000), true);
  assert.equal(s.queue[0].id, 'B');
  assert.equal(s.playing, true);
  assert.equal(M.positionAt(s, 9000), 1000);
});

test('remover outra não mexe na atual', () => {
  const s = M.createMusicState();
  M.addTrack(s, item('A'), 0);
  M.addTrack(s, item('B'), 0);
  assert.equal(M.removeTrack(s, 'B', 8000), true);
  assert.equal(M.positionAt(s, 9000), 9000);
  assert.equal(M.removeTrack(s, 'nope', 8000), false);
});

test('fim da fila para', () => {
  const s = M.createMusicState();
  M.addTrack(s, item('A'), 0);
  assert.equal(M.advanceIfCurrent(s, 'A', 100), true);
  assert.equal(s.queue.length, 0);
  assert.equal(s.playing, false);
  assert.equal(M.positionAt(s, 5000), 0);
});

test('toPublic e targetPositionMs', () => {
  const s = M.createMusicState();
  M.addTrack(s, item('A'), 0);
  const pub = M.toPublic(s, 10000);
  assert.equal(pub.positionMs, 10000);
  assert.equal(pub.serverNow, 10000);
  assert.equal(pub.playing, true);
  assert.equal(M.targetPositionMs(pub, 2500, 500), 12000);
  M.togglePause(s, 10000);
  const paused = M.toPublic(s, 50000);
  assert.equal(M.targetPositionMs(paused, 2500, 500), 10000);
});

test('needsSeek', () => {
  assert.equal(M.needsSeek(10000, 11900), false);
  assert.equal(M.needsSeek(10000, 12100), true);
});
