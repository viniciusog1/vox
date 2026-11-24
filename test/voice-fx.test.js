const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('../src/shared/voice-fx.js');

test('lista de efeitos: Normal primeiro, ids únicos e nomes', () => {
  assert.equal(fx.EFFECTS[0].id, 'normal');
  const ids = fx.EFFECTS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ['normal', 'robo', 'vilao', 'grave', 'esquilo', 'radio', 'megafone', 'caverna', 'alien']);
  assert.equal(fx.nameOf('vilao'), 'Vilão espacial');
  assert.equal(fx.nameOf('nada'), 'Normal');
});

test('isVoiceFx só aceita ids conhecidos', () => {
  for (const e of fx.EFFECTS) assert.ok(fx.isVoiceFx(e.id));
  for (const bad of ['', 'Robo', 'darth', null, undefined, 3, {}]) assert.equal(fx.isVoiceFx(bad), false);
});

// Frequência dominante pelo número de cruzamentos por zero (sinal senoidal).
function freqOf(samples, sampleRate) {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) if ((samples[i - 1] < 0) !== (samples[i] < 0)) crossings++;
  return (crossings / 2) / (samples.length / sampleRate);
}

function shift(ratio, freq) {
  const sr = 48000;
  const ps = fx.createPitchShifter(sr, 60);
  const total = sr; // 1 s, em blocos de 128 como no AudioWorklet
  const out = new Float32Array(total);
  for (let start = 0; start < total; start += 128) {
    const input = new Float32Array(128);
    for (let n = 0; n < 128; n++) input[n] = Math.sin((2 * Math.PI * freq * (start + n)) / sr);
    const o = new Float32Array(128);
    ps.process(input, o, ratio);
    out.set(o, start);
  }
  return { out: out.subarray(sr / 4), sr, W: ps.windowSamples };
}

test('tom 1: a voz sai igual, só atrasada meia janela', () => {
  const sr = 48000;
  const ps = fx.createPitchShifter(sr, 60);
  const input = new Float32Array(4096).map((_, i) => Math.sin(i / 7));
  const out = new Float32Array(4096);
  for (let s = 0; s < 4096; s += 128) ps.process(input.subarray(s, s + 128), out.subarray(s, s + 128), 1);
  const lag = ps.windowSamples / 2;
  for (let i = lag + 10; i < 4096; i += 97) assert.ok(Math.abs(out[i] - input[i - lag]) < 1e-3, `amostra ${i}`);
});

test('mudança de tom: 200 Hz vira ~400 Hz (x2), ~100 Hz (x0,5) e ~320 Hz (Esquilo)', () => {
  const near = (got, want) => assert.ok(Math.abs(got - want) / want < 0.08, `esperava ~${want} Hz, deu ${got.toFixed(1)}`);
  let r = shift(2, 200); near(freqOf(r.out, r.sr), 400);
  r = shift(0.5, 200); near(freqOf(r.out, r.sr), 100);
  r = shift(fx.PITCH.esquilo, 200); near(freqOf(r.out, r.sr), 320);
});

test('mudança de tom não estoura o volume', () => {
  for (const ratio of [0.5, 0.72, 1.3, 2]) {
    const { out } = shift(ratio, 300);
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak <= 1.0001, `tom ${ratio}: pico ${peak}`);
  }
});

test('curva de distorção: limitada a ±1, crescente e simétrica', () => {
  const c = fx.makeDriveCurve(25, 257);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1]);
  assert.ok(Math.abs(c[0] + 1) < 1e-6 && Math.abs(c[256] - 1) < 1e-6);
  assert.ok(Math.abs(c[128]) < 1e-6);
});

test('eco da caverna: sempre igual e decaindo até o silêncio', () => {
  const a = fx.makeCaveImpulse(48000, 2.2, 3);
  const b = fx.makeCaveImpulse(48000, 2.2, 3);
  assert.equal(a.length, Math.round(48000 * 2.2));
  assert.deepEqual(Array.from(a.subarray(0, 50)), Array.from(b.subarray(0, 50)));
  const energy = (s) => s.reduce((t, v) => t + v * v, 0);
  assert.ok(energy(a.subarray(0, 10000)) > energy(a.subarray(a.length - 10000)) * 50);
});

// Contexto de áudio falso: guarda as ligações para conferir o caminho entrada → saída.
function fakeContext() {
  const edges = new Map();
  let started = 0;
  let stopped = 0;
  const param = (v) => ({ value: v });
  const mk = (extra) => {
    const n = {
      connect(to) { if (!edges.has(n)) edges.set(n, []); edges.get(n).push(to); return to; },
      disconnect() { edges.delete(n); },
      ...extra
    };
    return n;
  };
  const ctx = {
    sampleRate: 48000,
    createGain: () => mk({ gain: param(1) }),
    createBiquadFilter: () => mk({ type: '', frequency: param(0), Q: param(1), gain: param(0) }),
    createWaveShaper: () => mk({ curve: null, oversample: 'none' }),
    createDelay: () => mk({ delayTime: param(0) }),
    createConvolver: () => mk({ buffer: null }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createOscillator: () => mk({ type: 'sine', frequency: param(0), start() { started++; }, stop() { stopped++; } })
  };
  const reaches = (from, to) => {
    const seen = new Set();
    const stack = [from];
    while (stack.length) {
      const n = stack.pop();
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const next of edges.get(n) || []) stack.push(next);
    }
    return false;
  };
  return { ctx, reaches, counts: () => ({ started, stopped }) };
}

test('todo efeito monta um caminho da entrada até a saída e desliga os osciladores', () => {
  for (const { id } of fx.EFFECTS) {
    const { ctx, reaches, counts } = fakeContext();
    const pitchCalls = [];
    const built = fx.buildEffect(ctx, id, {
      pitchNode: (ratio) => { pitchCalls.push(ratio); return ctx.createGain(); }
    });
    assert.ok(built.input && built.output, id);
    assert.ok(reaches(built.input, built.output), `${id}: entrada não chega na saída`);
    if (fx.PITCH[id]) assert.deepEqual(pitchCalls, [fx.PITCH[id]], `${id}: tom`);
    else assert.equal(pitchCalls.length, 0, `${id}: não deveria mudar o tom`);
    built.dispose();
    assert.equal(counts().started, counts().stopped, `${id}: oscilador ficou ligado`);
  }
});

test('descartar o efeito encerra o worklet de tom', () => {
  for (const id of Object.keys(fx.PITCH)) {
    const { ctx } = fakeContext();
    const sent = [];
    const built = fx.buildEffect(ctx, id, {
      pitchNode: () => Object.assign(ctx.createGain(), { port: { postMessage: (m) => sent.push(m) } })
    });
    assert.deepEqual(sent, [], id);
    built.dispose();
    assert.deepEqual(sent, ['stop'], id);
  }
});

test('sem o worklet de tom, os efeitos ainda montam (só sem mudar o tom)', () => {
  for (const id of Object.keys(fx.PITCH)) {
    const { ctx, reaches } = fakeContext();
    const built = fx.buildEffect(ctx, id, {});
    assert.ok(reaches(built.input, built.output), id);
  }
});
