const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MAX_VOLUME, readVolume, softClipCurve, createBooster } = require('../src/renderer/volume-boost.js');

test('volume por pessoa vai de 0 a 200%; inválido vale 100%', () => {
  assert.equal(MAX_VOLUME, 2);
  assert.deepEqual([0, 0.4, 1, 1.5, 2].map(readVolume), [0, 0.4, 1, 1.5, 2]);
  assert.deepEqual([2.1, -1, NaN, '1', null, undefined].map(readVolume), [1, 1, 1, 1, 1, 1]);
});

test('a curva não mexe no som normal e nunca passa do máximo', () => {
  const n = 4097;
  const c = softClipCurve(n);
  const at = (x) => c[Math.round(((x / MAX_VOLUME + 1) / 2) * (n - 1))]; // x = amostra já amplificada
  for (const x of [-0.8, -0.3, 0, 0.1, 0.5, 0.8]) assert.ok(Math.abs(at(x) - x) < 0.002, `${x} -> ${at(x)}`);
  for (let i = 1; i < n; i++) assert.ok(c[i] >= c[i - 1], 'sempre crescente');
  assert.ok(c[n - 1] <= 1 && c[n - 1] > 0.95 && Math.abs(c[0] + c[n - 1]) < 1e-6);
});

// Elemento e contexto de mentira para conferir quem está tocando
function fakes(state = 'running') {
  const made = [];
  const node = (extra = {}) => ({ connect(n) { this.to = n; return n; }, disconnect() { this.off = true; }, ...extra });
  const listeners = [];
  const ctx = {
    state, currentTime: 0,
    addEventListener: (t, f) => listeners.push(f), removeEventListener: (t, f) => listeners.splice(listeners.indexOf(f), 1),
    createMediaStreamSource: () => node(),
    createGain: () => node({ gain: { value: 1, setTargetAtTime(v) { this.value = v; } } }),
    createWaveShaper: () => node(),
    createMediaStreamDestination: () => node({ stream: {} })
  };
  const booster = createBooster({
    getContext: () => ctx,
    createOutput: (stream) => {
      const o = { stream, removed: false, play: () => Promise.resolve(), remove() { this.removed = true; } };
      made.push(o);
      return o;
    }
  });
  return { booster, ctx, made, listeners, setState: (s) => { ctx.state = s; listeners.slice().forEach((f) => f()); } };
}
const tick = () => new Promise((r) => setImmediate(r));

test('até 100% toca o elemento original, sem amplificador', async () => {
  const f = fakes();
  const el = { srcObject: {}, volume: 1, muted: false };
  f.booster.set(el, 0.35);
  await tick();
  assert.deepEqual([el.volume, el.muted, f.made.length], [0.35, false, 0]);
});

test('acima de 100% toca só o amplificado; voltar desfaz', async () => {
  const f = fakes();
  const el = { srcObject: {}, volume: 1, muted: false };
  f.booster.set(el, 1.5);
  await tick();
  assert.deepEqual([el.volume, el.muted, f.made.length], [1, true, 1]);
  f.booster.set(el, 2);
  await tick();
  assert.equal(f.made.length, 1, 'mudar o ganho não recria');
  f.booster.set(el, 1);
  assert.deepEqual([el.muted, f.made[0].removed, f.listeners.length], [false, true, 0]);
});

test('se o amplificador não pode tocar, a voz original nunca fica muda', async () => {
  const f = fakes('suspended');
  const el = { srcObject: {}, volume: 1, muted: false };
  f.booster.set(el, 2);
  await tick();
  assert.equal(el.muted, false);
  f.setState('running');
  assert.equal(el.muted, true);
  f.setState('suspended');
  assert.equal(el.muted, false);

  const broken = createBooster({ getContext: () => { throw new Error('sem áudio'); }, createOutput: () => null });
  const el2 = { srcObject: {}, volume: 0.2, muted: false };
  broken.set(el2, 2);
  assert.deepEqual([el2.volume, el2.muted], [1, false]);
});

test('reabrir rápido não deixa a voz muda por um play() atrasado', async () => {
  const f = fakes();
  const el = { srcObject: {}, volume: 1, muted: false };
  f.booster.set(el, 1.5);
  f.booster.set(el, 1); // antes de o play() terminar
  await tick();
  assert.equal(el.muted, false);
});

test('renderer usa o amplificador na voz e na transmissão, e o solta junto com o elemento', () => {
  const dir = path.join(__dirname, '..', 'src', 'renderer');
  const js = fs.readFileSync(path.join(dir, 'renderer.js'), 'utf8').replace(/\r\n/g, '\n');
  const fn = (name) => js.match(new RegExp(`\\nfunction ${name}\\([\\s\\S]*?\\n}\\n`))[0];
  for (const n of ['attachVoiceAudio', 'attachScreenAudio']) assert.match(fn(n), /volumeBooster\.set\(audio,/);
  for (const n of ['removeVoiceAudio', 'removeScreenAudio']) assert.match(fn(n), /volumeBooster\.release\(audio\)/);
  assert.match(fn('makeUserVolume'), /VoxVolumeBoost\.MAX_VOLUME \* 100/);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(html.indexOf('src="volume-boost.js"') > 0 && html.indexOf('src="volume-boost.js"') < html.indexOf('src="renderer.js"'));
});
