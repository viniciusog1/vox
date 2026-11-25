const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Um controle só mexia na voz e no som da transmissão: abaixar a transmissão de alguém deixava
// a voz da pessoa muda na chamada. São dois volumes, guardados em chaves separadas.
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'renderer.js'), 'utf8').replace(/\r\n/g, '\n');
function between(a, b) {
  const i = src.indexOf(a);
  const j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, `não achei ${a}`);
  return src.slice(i, j);
}

function setup(stored = {}) {
  const store = { ...stored };
  const ctx = vm.createContext({
    VoxVolumeBoost: require('../src/renderer/volume-boost.js'),
    volumeBooster: { set: (el, v) => { el.volume = v; } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    userMap: new Map([['s1', { username: 'ana' }], ['s2', { username: 'bia' }]]),
    voiceAudioEls: new Map([['s1', { volume: 1 }], ['s2', { volume: 1 }]]),
    screenAudioEls: new Map([['s1', { volume: 1 }], ['s2', { volume: 1 }]])
  });
  vm.runInContext(between('function readVolumes', 'const analysers = new Map()') +
    '\nObject.assign(globalThis, { getPeerVolume, setPeerVolume, getScreenVolume, setScreenVolume, applyPeerVolumes });', ctx);
  return { ctx, store, v: (id) => ctx.voiceAudioEls.get(id).volume, s: (id) => ctx.screenAudioEls.get(id).volume };
}

test('abaixar a transmissão não mexe na voz da pessoa', () => {
  const t = setup();
  t.ctx.setScreenVolume('ana', 0);
  assert.deepEqual([t.v('s1'), t.s('s1'), t.v('s2'), t.s('s2')], [1, 0, 1, 1]);
  assert.equal(t.ctx.getPeerVolume('ana'), 1);
});

test('abaixar a voz não mexe na transmissão da pessoa', () => {
  const t = setup();
  t.ctx.setPeerVolume('ana', 0.25);
  assert.deepEqual([t.v('s1'), t.s('s1'), t.v('s2'), t.s('s2')], [0.25, 1, 1, 1]);
  assert.equal(t.ctx.getScreenVolume('ana'), 1);
});

test('cada volume é guardado na própria chave e volta ao abrir', () => {
  const t = setup();
  t.ctx.setPeerVolume('ana', 1.6);
  t.ctx.setScreenVolume('ana', 0.1);
  assert.deepEqual(JSON.parse(t.store['vox-peer-volumes']), { ana: 1.6 });
  assert.deepEqual(JSON.parse(t.store['vox-screen-volumes']), { ana: 0.1 });
  const again = setup(t.store);
  again.ctx.applyPeerVolumes();
  assert.deepEqual([again.v('s1'), again.s('s1')], [1.6, 0.1]);
});

test('valor guardado inválido vale 100%', () => {
  const t = setup({ 'vox-peer-volumes': 'lixo', 'vox-screen-volumes': '{"ana":7,"bia":"x"}' });
  assert.deepEqual([t.ctx.getPeerVolume('ana'), t.ctx.getScreenVolume('ana'), t.ctx.getScreenVolume('bia')], [1, 1, 1]);
});

test('o elemento da transmissão nasce com o volume da transmissão', () => {
  assert.match(between('function attachScreenAudio', '\n}\n'), /getScreenVolume\(/);
  assert.doesNotMatch(between('function attachScreenAudio', '\n}\n'), /getPeerVolume\(/);
});

test('o tile tem o controle da voz e, com a tela compartilhada, o da transmissão', () => {
  const tile = between('function buildTile', '\n}\n');
  assert.match(tile, /makeUserVolume\('voice', peerKey\)/);
  assert.match(tile, /if \(opts\.sharing\)[^\n]*makeUserVolume\('screen', peerKey\)/);
  // começar ou parar de compartilhar redesenha os tiles mesmo com a câmera já ligada
  assert.match(src, /const signature = list\.map\(\(u\) => u\.id \+ \(u\.sharing \? '\*' : ''\)\)/);
});
