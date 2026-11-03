const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const snd = require('../sounds.js');

test('chave e padrão ligado', () => {
  assert.equal(snd.STORAGE_KEY, 'vox-sound-effects');
  assert.equal(snd.isEnabled(null), true);
  assert.equal(snd.isEnabled('1'), true);
  assert.equal(snd.isEnabled('0'), false);
});

test('primeira lista depois de entrar toca só a minha entrada', () => {
  assert.equal(snd.rosterSound(null, ['a', 'b', 'eu'], 'eu'), 'join');
});

test('primeira lista sem mim não toca nada', () => {
  assert.equal(snd.rosterSound(null, ['a', 'b'], 'eu'), null);
});

test('alguém entra', () => {
  assert.equal(snd.rosterSound(['eu', 'a'], ['eu', 'a', 'b'], 'eu'), 'join');
});

test('alguém sai', () => {
  assert.equal(snd.rosterSound(['eu', 'a', 'b'], ['eu', 'a'], 'eu'), 'leave');
});

test('mesma lista (mudo, status, tela) não toca', () => {
  assert.equal(snd.rosterSound(['eu', 'a'], ['a', 'eu'], 'eu'), null);
});

test('entrada e saída juntas tocam a entrada', () => {
  assert.equal(snd.rosterSound(['eu', 'a'], ['eu', 'b'], 'eu'), 'join');
});

test('mudanças no meu próprio id não tocam pela lista', () => {
  assert.equal(snd.rosterSound(['eu', 'a'], ['a'], 'eu'), null);
  assert.equal(snd.rosterSound(['a'], ['a', 'eu'], 'eu'), null);
});

test('mudo e desmudo têm sons próprios', () => {
  assert.equal(snd.soundFor(true), 'mute');
  assert.equal(snd.soundFor(false), 'unmute');
  const names = ['join', 'leave', 'mute', 'unmute'];
  names.forEach((n) => assert.ok(snd.SOUNDS[n].notes.length > 0, n));
  const shapes = names.map((n) => JSON.stringify(snd.SOUNDS[n]));
  assert.equal(new Set(shapes).size, names.length);
});

test('sons curtos (até 0,4 s)', () => {
  for (const [name, s] of Object.entries(snd.SOUNDS)) {
    const end = Math.max(...s.notes.map((n) => n.start + n.dur));
    assert.ok(end <= 0.4, `${name} dura ${end}s`);
  }
});

test('playSound agenda um oscilador por nota', () => {
  const started = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect(n) { return n; } });
  const ctx = {
    currentTime: 1,
    createOscillator: () => ({ ...node(), frequency: param(), start(t) { started.push(t); }, stop() {} }),
    createGain: () => ({ ...node(), gain: param() })
  };
  snd.playSound(ctx, node(), 'join');
  assert.equal(started.length, snd.SOUNDS.join.notes.length);
  snd.playSound(ctx, node(), 'inexistente');
  assert.equal(started.length, snd.SOUNDS.join.notes.length);
});

test('opção na aba Áudio, ligada por padrão, e script carregado antes do renderer', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const audioTab = html.slice(html.indexOf('id="settings-tab-audio"'));
  assert.match(audioTab, /<input type="checkbox" id="sound-effects-toggle" checked>/);
  assert.ok(html.indexOf('<script src="sounds.js"></script>') < html.indexOf('<script src="renderer.js"></script>'));
  assert.ok(html.includes('<script src="sounds.js"></script>'));
});
