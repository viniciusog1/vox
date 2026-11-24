const test = require('node:test');
const assert = require('node:assert/strict');
const rv = require('../src/renderer/remote-video.js');

test('sem quadros não há vídeo (só pacotes de sondagem)', () => {
  const s = rv.createRemoteVideo();
  for (let t = 0; t <= 10000; t += 500) assert.equal(rv.updateRemoteVideo(s, 0, t), false);
});

test('liga no primeiro quadro', () => {
  const s = rv.createRemoteVideo();
  rv.updateRemoteVideo(s, 0, 0);
  assert.equal(rv.updateRemoteVideo(s, 1, 500), true);
});

test('engasgo curto não desliga', () => {
  const s = rv.createRemoteVideo();
  rv.updateRemoteVideo(s, 10, 0);
  assert.equal(rv.updateRemoteVideo(s, 10, rv.VIDEO_HOLD_MS), true);
  assert.equal(rv.updateRemoteVideo(s, 11, rv.VIDEO_HOLD_MS + 500), true);
  assert.equal(rv.updateRemoteVideo(s, 11, rv.VIDEO_HOLD_MS * 2 + 500), true);
});

test('câmera desligada: sem quadros novos, desliga e volta ao ligar de novo', () => {
  const s = rv.createRemoteVideo();
  rv.updateRemoteVideo(s, 10, 0);
  assert.equal(rv.updateRemoteVideo(s, 10, rv.VIDEO_HOLD_MS + 1), false);
  assert.equal(rv.updateRemoteVideo(s, 10, 60000), false);
  assert.equal(rv.updateRemoteVideo(s, 11, 60500), true);
});

test('tela parada continua aparecendo enquanto a pessoa compartilha', () => {
  const s = rv.createRemoteVideo();
  rv.updateRemoteVideo(s, 10, 0, true);
  assert.equal(rv.updateRemoteVideo(s, 10, 60000, true), true);
  assert.equal(rv.updateRemoteVideo(s, 10, 60500, false), false);
});

test('compartilhar não mostra vídeo antes do primeiro quadro', () => {
  const s = rv.createRemoteVideo();
  assert.equal(rv.updateRemoteVideo(s, 0, 0, true), false);
  assert.equal(rv.updateRemoteVideo(s, 0, 5000, true), false);
});
