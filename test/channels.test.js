const test = require('node:test');
const assert = require('node:assert/strict');
const ch = require('../channels.js');

test('listas e padrões de canais', () => {
  assert.deepEqual(ch.TEXT_CHANNELS, ['geral', 'jogos', 'musica']);
  assert.deepEqual(ch.VOICE_CHANNELS, ['voz-sala', 'voz-jogos', 'voz-musica']);
  assert.equal(ch.DEFAULT_TEXT_CHANNEL, 'geral');
  assert.equal(ch.DEFAULT_VOICE_CHANNEL, 'voz-sala');
});

test('isTextChannel e isVoiceChannel', () => {
  assert.equal(ch.isTextChannel('geral'), true);
  assert.equal(ch.isTextChannel('voz-sala'), false);
  assert.equal(ch.isVoiceChannel('voz-musica'), true);
  assert.equal(ch.isVoiceChannel('geral'), false);
  for (const bad of ['qualquer', undefined, 42, null, '']) {
    assert.equal(ch.isTextChannel(bad), false);
    assert.equal(ch.isVoiceChannel(bad), false);
  }
});
