const test = require('node:test');
const assert = require('node:assert/strict');
const mg = require('../src/renderer/mic-gate.js');

const SR = 48000;
const BLOCK = 128;
const db = (d) => Math.pow(10, d / 20);
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const noise = (level) => rnd() * level * Math.sqrt(3); // RMS = level

// Roda o gate em blocos de 128 amostras (como o AudioWorklet) e mede.
function run(gen, seconds, params, gate = mg.createGate(SR)) {
  const input = new Float32Array(BLOCK);
  const output = new Float32Array(BLOCK);
  const blocks = Math.round((seconds * SR) / BLOCK);
  let t = 0;
  const trace = [];
  for (let b = 0; b < blocks; b++) {
    for (let i = 0; i < BLOCK; i++) input[i] = gen((t + i) / SR);
    t += BLOCK;
    const s = gate.processBlock(input, output, params);
    trace.push({ t: t / SR, open: s.open, gain: s.gain, thr: s.thresholdDb, level: s.levelDb });
  }
  return { gate, trace };
}

const flips = (trace) => trace.reduce((n, s, i) => n + (i && s.open !== trace[i - 1].open ? 1 : 0), 0);
const voice = (level) => (t) => Math.sin(2 * Math.PI * 220 * t) * level * Math.SQRT2 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 5 * t));

const auto = mg.gateParams({ auto: true, mode: 'browser' });

test('automático: ruído de fundo constante não abre o gate', () => {
  for (const level of [-60, -45, -35]) {
    const { trace } = run(() => noise(db(level)), 6, auto);
    const late = trace.filter((s) => s.t > 2);
    assert.ok(late.every((s) => !s.open), `ruído ${level} dB abriu`);
  }
});

test('automático: fala baixa (-40 dB) com ruído -60 dB abre', () => {
  const { gate } = run(() => noise(db(-60)), 2, auto);
  const { trace } = run((t) => noise(db(-60)) + voice(db(-40))(t), 1, auto, gate);
  assert.ok(trace.filter((s) => s.t > 0.05).every((s) => s.open));
});

test('não picota nas pausas entre palavras (150 ms)', () => {
  const { gate } = run(() => noise(db(-60)), 2, auto);
  const words = (t) => noise(db(-60)) + ((t % 0.45) < 0.3 ? voice(db(-25))(t) : 0);
  const { trace } = run(words, 5, auto, gate);
  assert.equal(flips(trace.filter((s) => s.t > 0.05)), 0);
  assert.ok(Math.min(...trace.filter((s) => s.t > 0.05).map((s) => s.gain)) > 0.95);
});

test('fala contínua por 8 s (sem respiro) não fecha', () => {
  const { gate } = run(() => noise(db(-60)), 2, auto);
  const { trace } = run((t) => noise(db(-60)) + voice(db(-25))(t), 8, auto, gate);
  assert.ok(trace.filter((s) => s.t > 0.05).every((s) => s.open));
});

test('fecha depois da espera quando a fala acaba', () => {
  const { gate } = run(() => noise(db(-60)), 2, auto);
  run((t) => voice(db(-25))(t), 1, auto, gate);
  const { trace } = run(() => noise(db(-60)), 1, auto, gate);
  const closedAt = trace.find((s) => !s.open).t;
  assert.ok(closedAt > 0.2 && closedAt < 0.45, `fechou em ${closedAt}s`);
  assert.ok(trace[trace.length - 1].gain < 0.01);
});

test('automático se adapta quando o ruído aumenta (ventilador ligado)', () => {
  const { gate } = run(() => noise(db(-65)), 2, auto);
  const { trace } = run(() => noise(db(-40)), 20, auto, gate);
  assert.ok(!trace[trace.length - 1].open, 'continuou aberto com ruído constante');
});

test('manual: respeita o limite escolhido', () => {
  const manual = mg.gateParams({ auto: false, thresholdDb: -30, mode: 'browser' });
  assert.ok(run(() => voice(db(-35))(0.01), 1, manual).trace.every((s) => !s.open));
  const { trace } = run(voice(db(-25)), 1, manual);
  assert.ok(trace[trace.length - 1].open);
  assert.equal(trace[trace.length - 1].thr, -30);
});

test('modo forte usa margem maior que o padrão', () => {
  assert.ok(mg.gateParams({ auto: true, mode: 'strong' }).margin > mg.gateParams({ auto: true, mode: 'browser' }).margin);
});

test('medidor e limites dos números', () => {
  assert.equal(mg.meterPercent(-70), 0);
  assert.equal(mg.meterPercent(-40), 50);
  assert.equal(mg.meterPercent(-5), 100);
  assert.equal(mg.clampNumber('abc', 0, 200, 100), 100);
  assert.equal(mg.clampNumber('250', 0, 200, 100), 200);
});
