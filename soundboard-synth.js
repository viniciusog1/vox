// Sons de fábrica do soundboard, sintetizados com Web Audio (sem arquivos e sem
// direitos autorais). Cada som é uma lista de "vozes": oscilador ou ruído com
// envelope, filtro e vibrato opcionais. Também roda no Node (testes).
(function () {
  // voz: { wave: 'sine'|'square'|'sawtooth'|'triangle'|'noise', freq, to?, start, dur,
  //        gain, filter?: { type, freq }, vibrato?: { rate, depth } }
  const BUILTIN = [
    {
      id: 'buzina', name: 'Buzina',
      voices: [440, 554.4, 659.3].flatMap((f) => [0, 0.32].map((s) => ({
        wave: 'sawtooth', freq: f, start: s, dur: s ? 0.75 : 0.26, gain: 0.16,
        filter: { type: 'lowpass', freq: 2600 }, vibrato: { rate: 7, depth: 6 }
      })))
    },
    {
      id: 'ba-dum-tss', name: 'Ba dum tss',
      voices: [
        { wave: 'sine', freq: 150, to: 55, start: 0, dur: 0.22, gain: 0.9 },
        { wave: 'noise', start: 0, dur: 0.12, gain: 0.25, filter: { type: 'bandpass', freq: 1800 } },
        { wave: 'sine', freq: 140, to: 50, start: 0.28, dur: 0.25, gain: 0.9 },
        { wave: 'noise', start: 0.55, dur: 0.9, gain: 0.45, filter: { type: 'highpass', freq: 6000 } }
      ]
    },
    {
      id: 'tchan', name: 'Tchan tchan tchaaan',
      voices: [[0, 0.22, 293.7], [0.3, 0.22, 261.6], [0.6, 1.3, 233.1]].flatMap(([s, d, f]) => [
        { wave: 'sawtooth', freq: f, start: s, dur: d, gain: 0.18, filter: { type: 'lowpass', freq: 1800 } },
        { wave: 'sawtooth', freq: f / 2, start: s, dur: d, gain: 0.14, filter: { type: 'lowpass', freq: 900 } }
      ])
    },
    {
      id: 'aplausos', name: 'Aplausos',
      voices: Array.from({ length: 26 }, (_, i) => ({
        wave: 'noise', start: (i * 0.073 + (i % 3) * 0.021), dur: 0.05, gain: 0.35 + (i % 4) * 0.08,
        filter: { type: 'bandpass', freq: 1500 + (i % 5) * 300 }
      }))
    },
    {
      id: 'vitoria', name: 'Vitória 8-bit',
      voices: [523.3, 659.3, 784, 1046.5, 784, 1046.5].map((f, i) => ({
        wave: 'square', freq: f, start: i * 0.11, dur: i === 5 ? 0.5 : 0.1, gain: 0.12
      }))
    },
    {
      id: 'trombone', name: 'Trombone triste',
      voices: [[0, 392, 380], [0.45, 370, 358], [0.9, 349.2, 337], [1.35, 329.6, 300]].map(([s, f, to], i) => ({
        wave: 'sawtooth', freq: f, to, start: s, dur: i === 3 ? 1.1 : 0.4, gain: 0.17,
        filter: { type: 'lowpass', freq: 1200 }, vibrato: i === 3 ? { rate: 6, depth: 9 } : null
      }))
    },
    {
      id: 'sino', name: 'Sino',
      voices: [[880, 0.3], [1760, 0.12], [2637, 0.06]].map(([f, g]) => ({ wave: 'sine', freq: f, start: 0, dur: 1.8, gain: g }))
    },
    {
      id: 'boing', name: 'Boing',
      voices: [{ wave: 'triangle', freq: 180, to: 520, start: 0, dur: 0.45, gain: 0.5, vibrato: { rate: 18, depth: 40 } }]
    }
  ];

  const byId = new Map(BUILTIN.map((s) => [s.id, s]));
  const isBuiltin = (id) => byId.has(id);
  const durationOf = (id) => {
    const s = byId.get(id);
    return s ? Math.max(...s.voices.map((v) => v.start + v.dur)) : 0;
  };

  let noiseBuffer = null;
  function noise(ctx) {
    if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  // Agenda o som em `destination`. volume de 0 a 1. Devolve false se o id não existe.
  function playBuiltin(ctx, destination, id, volume = 1) {
    const sound = byId.get(id);
    if (!sound) return false;
    const t0 = ctx.currentTime + 0.02;
    for (const v of sound.voices) {
      const start = t0 + v.start;
      const end = start + v.dur;
      let src;
      if (v.wave === 'noise') {
        src = ctx.createBufferSource();
        src.buffer = noise(ctx);
        src.loop = true;
      } else {
        src = ctx.createOscillator();
        src.type = v.wave;
        src.frequency.setValueAtTime(v.freq, start);
        if (v.to) src.frequency.exponentialRampToValueAtTime(v.to, end);
        if (v.vibrato) {
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = v.vibrato.rate;
          depth.gain.value = v.vibrato.depth;
          lfo.connect(depth).connect(src.frequency);
          lfo.start(start);
          lfo.stop(end + 0.05);
        }
      }
      const env = ctx.createGain();
      const peak = v.gain * volume;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(peak, start + Math.min(0.015, v.dur / 4));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      let last = src;
      if (v.filter) {
        const f = ctx.createBiquadFilter();
        f.type = v.filter.type;
        f.frequency.value = v.filter.freq;
        last = last.connect(f);
      }
      last.connect(env).connect(destination);
      src.start(start);
      src.stop(end + 0.05);
    }
    return true;
  }

  const api = { BUILTIN: BUILTIN.map(({ id, name }) => ({ id, name })), VOICES: BUILTIN, isBuiltin, durationOf, playBuiltin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxSoundboardSynth = api;
})();
