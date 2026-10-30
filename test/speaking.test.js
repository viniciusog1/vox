const test = require('node:test');
const assert = require('node:assert/strict');
const sp = require('../speaking.js');

test('constantes da spec', () => {
  assert.equal(sp.SPEAK_ON_LEVEL, 0.12);
  assert.equal(sp.SPEAK_HOLD_MS, 250);
});

test('liga acima do limiar', () => {
  assert.equal(sp.updateSpeaking(sp.createSpeakingState(), 0.2, 0), true);
});

test('não liga abaixo do limiar', () => {
  assert.equal(sp.updateSpeaking(sp.createSpeakingState(), 0.1, 0), false);
});

test('segura durante pausa curta', () => {
  const s = sp.createSpeakingState();
  sp.updateSpeaking(s, 0.2, 0);
  assert.equal(sp.updateSpeaking(s, 0, 200), true);
});

test('apaga após 250 ms em silêncio', () => {
  const s = sp.createSpeakingState();
  sp.updateSpeaking(s, 0.2, 0);
  assert.equal(sp.updateSpeaking(s, 0, 251), false);
});

test('pico isolado não fica preso', () => {
  const s = sp.createSpeakingState();
  sp.updateSpeaking(s, 0.5, 0);
  sp.updateSpeaking(s, 0, 100);
  sp.updateSpeaking(s, 0, 300);
  assert.equal(sp.updateSpeaking(s, 0, 600), false);
});

function fakeAnalyser(value) {
  return { frequencyBinCount: 32, getByteFrequencyData(arr) { arr.fill(value); } };
}

test('levelFromAnalyser no máximo e no silêncio', () => {
  assert.equal(sp.levelFromAnalyser(fakeAnalyser(255)), 1);
  assert.equal(sp.levelFromAnalyser(fakeAnalyser(0)), 0);
});

test('levelFromAnalyser usa a métrica do medidor (média × 1.6)', () => {
  assert.ok(Math.abs(sp.levelFromAnalyser(fakeAnalyser(51)) - 0.32) < 1e-9);
});
