const test = require('node:test');
const assert = require('node:assert/strict');
const sb = require('../src/shared/soundboard-state.js');
const synth = require('../src/shared/soundboard-synth.js');

const base = { id: 's1', name: 'Buzina da Ana', file: '0b6c3f7e-1f2a-4b5c-8d9e-0123456789ab.mp3', by: 'ana', at: 't', duration: 2.34, bytes: 5000 };

test('adicionar: nome, tamanho, duração e limite por servidor', () => {
  const db = sb.emptyDb();
  const r = sb.addSound(db, 'srv', base);
  assert.equal(r.ok, true);
  assert.equal(r.sound.duration, 2.3);
  assert.equal(sb.addSound(db, 'srv', { ...base, name: '   ' }).ok, false);
  assert.equal(sb.addSound(db, 'srv', { ...base, name: 'x'.repeat(sb.MAX_NAME + 1) }).ok, false);
  assert.equal(sb.addSound(db, 'srv', { ...base, bytes: sb.MAX_BYTES + 1 }).ok, false);
  assert.equal(sb.addSound(db, 'srv', { ...base, duration: sb.MAX_SECONDS + 1 }).ok, false);
  assert.equal(sb.addSound(db, 'srv', { ...base, duration: 'abc' }).ok, false);
  for (let i = 1; i < sb.MAX_SOUNDS; i++) sb.addSound(db, 'srv', { ...base, id: 'x' + i });
  assert.equal(sb.soundsOf(db, 'srv').length, sb.MAX_SOUNDS);
  assert.equal(sb.addSound(db, 'srv', { ...base, id: 'demais' }).ok, false);
  assert.deepEqual(sb.soundsOf(db, 'outro'), []);
});

test('apagar: quem enviou ou a gerência', () => {
  const db = sb.emptyDb();
  sb.addSound(db, 'srv', base);
  assert.equal(sb.deleteSound(db, 'srv', 's1', 'bia', false).ok, false);
  assert.equal(sb.deleteSound(db, 'srv', 's1', 'bia', true).ok, true);
  sb.addSound(db, 'srv', base);
  assert.equal(sb.deleteSound(db, 'srv', 's1', 'ana', false).ok, true);
  assert.equal(sb.deleteSound(db, 'srv', 'nada', 'ana', true).ok, false);
});

test('servidor apagado leva os sons; tipos e nomes de arquivo', () => {
  const db = sb.emptyDb();
  sb.addSound(db, 'srv', base);
  assert.equal(sb.dropServer(db, 'srv').length, 1);
  assert.deepEqual(sb.soundsOf(db, 'srv'), []);
  assert.equal(sb.audioExtension('audio/mpeg'), 'mp3');
  assert.equal(sb.audioExtension('audio/x-wav'), 'wav');
  assert.equal(sb.audioExtension('video/mp4'), null);
  assert.equal(sb.isSoundFile(base.file), true);
  assert.equal(sb.isSoundFile('../users.json'), false);
  assert.equal(sb.isSoundFile('0b6c3f7e-1f2a-4b5c-8d9e-0123456789ab.exe'), false);
});

test('intervalo entre toques da mesma pessoa', () => {
  assert.equal(sb.canPlay(undefined, 1000), true);
  assert.equal(sb.canPlay(1000, 1000 + sb.COOLDOWN_MS - 1), false);
  assert.equal(sb.canPlay(1000, 1000 + sb.COOLDOWN_MS), true);
});

test('sons de fábrica: nomes únicos e curtos', () => {
  const ids = synth.BUILTIN.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 6);
  for (const { id } of synth.BUILTIN) {
    const d = synth.durationOf(id);
    assert.ok(d > 0.2 && d <= 3, `${id} dura ${d}s`);
    assert.equal(synth.isBuiltin(id), true);
  }
  assert.equal(synth.isBuiltin('nada'), false);
});

test('playBuiltin agenda as vozes num contexto de áudio', () => {
  let started = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect(n) { return n; } });
  const ctx = {
    currentTime: 0, sampleRate: 8000,
    createOscillator: () => ({ ...node(), frequency: param(), setPeriodicWave() {}, start() { started++; }, stop() {} }),
    createPeriodicWave: (real, imag) => ({ real, imag }),
    createBufferSource: () => ({ ...node(), start() { started++; }, stop() {} }),
    createBuffer: (ch, len, sr) => ({ sampleRate: sr, getChannelData: () => new Float32Array(len) }),
    createGain: () => ({ ...node(), gain: param() })
  };
  for (const { id } of synth.BUILTIN) assert.equal(synth.playBuiltin(ctx, node(), id, 0.5), true);
  assert.ok(started > synth.BUILTIN.length);
  assert.equal(synth.playBuiltin(ctx, node(), 'nada'), false);
});

test('sons de fábrica só usam ondas de console 8-bit, com valores válidos', () => {
  const waves = new Set(['pulse', 'square', 'triangle', 'chipnoise']);
  for (const s of synth.VOICES) {
    for (const v of s.voices) {
      assert.ok(waves.has(v.wave), `${s.id} usa ${v.wave}`);
      if (v.wave === 'pulse') assert.ok([0.125, 0.25, 0.5].includes(v.duty), `${s.id} duty ${v.duty}`);
      if (v.wave === 'chipnoise') assert.ok(v.rate >= 500 && v.rate <= 48000, `${s.id} rate ${v.rate}`);
      assert.ok(v.gain > 0 && v.gain <= 1, `${s.id} gain ${v.gain}`);
      assert.ok(v.dur > 0 && v.start >= 0, s.id);
      assert.ok(!v.sustain || v.sustain <= v.dur, `${s.id} sustain`);
      for (const f of [v.freq, v.to].filter(Boolean)) assert.ok(f >= 20 && f <= 12000, `${s.id} ${f} Hz`);
    }
  }
});

test('aplausos saem sempre iguais (sorteio com semente)', () => {
  delete require.cache[require.resolve('../src/shared/soundboard-synth.js')];
  const again = require('../src/shared/soundboard-synth.js');
  const pick = (m) => JSON.stringify(m.VOICES.find((s) => s.id === 'aplausos').voices);
  assert.equal(pick(again), pick(synth));
});
