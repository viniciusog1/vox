// Sons de fábrica do soundboard, sintetizados com Web Audio (sem arquivos e sem
// direitos autorais). Cada som é uma lista de "vozes": oscilador ou ruído com
// envelope, filtro e vibrato opcionais. Também roda no Node (testes).
(function () {
  // voz: { wave: 'sine'|'square'|'sawtooth'|'triangle'|'noise', freq, to?, glide?, detune?,
  //        start, dur, gain, attack?, sustain? (segura o volume e solta nos últimos `sustain` s),
  //        filter?: { type, freq, to?, time?, q? }, vibrato?: { rate, depth, to? } }
  // Sem `sustain`, a voz cai exponencialmente desde o ataque (som batido).
  // `to` desliza a frequência em `glide` s (padrão: a voz inteira); no filtro, em `time` s;
  // no vibrato, a profundidade vai até `to` no fim da voz.

  // Sorteio com semente: os aplausos saem sempre iguais (e os testes também)
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  // Metal brilhante (prato): quadradas desafinadas entre si num passa-alta, como na 808
  function cymbal(start, dur, gain) {
    return [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => ({
      wave: 'square', freq: f, start, dur, gain: gain / 6, attack: 0.001, filter: { type: 'highpass', freq: 7000 }
    })).concat({ wave: 'noise', start, dur, gain, attack: 0.001, filter: { type: 'highpass', freq: 6500 } });
  }

  // Metal de sopro: duas serras desafinadas + oitava abaixo, filtro que "abre" no ataque
  function brass(freq, start, dur, gain, extra = {}) {
    const release = extra.release || 0.08;
    const filter = { type: 'lowpass', freq: 500, to: extra.bright || 2600, time: 0.08, q: 1.2 };
    return [-9, 9].map((detune) => ({
      wave: 'sawtooth', freq, detune, start, dur, gain, attack: 0.03, sustain: release, filter, vibrato: extra.vibrato
    })).concat({
      wave: 'sawtooth', freq: freq / 2, start, dur, gain: gain * 0.8, attack: 0.03, sustain: release,
      filter: { type: 'lowpass', freq: 400, to: 1200, time: 0.08 }
    });
  }

  function applause() {
    const rand = seeded(7);
    const voices = [];
    // 9 pessoas batendo palmas ~4 vezes por segundo, fora de sincronia, sumindo no fim
    for (let p = 0; p < 9; p++) {
      const tone = 900 + rand() * 1400;
      let t = rand() * 0.25;
      while (t < 1.9) {
        const fade = t > 1.3 ? 1 - (t - 1.3) / 0.7 : 1;
        // Cada palma são dois estalos colados (as mãos não batem de uma vez só)
        for (const [off, g] of [[0, 1], [0.008 + rand() * 0.006, 0.6]]) {
          voices.push({
            wave: 'noise', start: t + off, dur: 0.035 + rand() * 0.02, gain: 0.9 * g * fade * (0.6 + rand() * 0.4),
            attack: 0.001, filter: { type: 'bandpass', freq: tone * (0.9 + rand() * 0.2), q: 0.9 }
          });
        }
        t += 0.2 + rand() * 0.12;
      }
    }
    // Ruído de plateia ao fundo
    voices.push({ wave: 'noise', start: 0, dur: 2.1, gain: 0.15, attack: 0.15, sustain: 0.6, filter: { type: 'bandpass', freq: 1500, q: 0.6 } });
    return voices;
  }

  const BUILTIN = [
    {
      // Buzina de palhaço: dois "fom" anasalados com um guincho no começo
      id: 'buzina', name: 'Buzina',
      voices: [[0, 0.22], [0.3, 0.5]].flatMap(([s, d]) => [-14, 14].map((detune) => ({
        wave: 'sawtooth', freq: 330, to: 370, glide: 0.04, detune, start: s, dur: d, gain: 0.3, attack: 0.012, sustain: 0.06,
        filter: { type: 'bandpass', freq: 1100, q: 2.5 }, vibrato: { rate: 9, depth: 4 }
      })).concat({
        wave: 'square', freq: 165, to: 185, glide: 0.04, start: s, dur: d, gain: 0.08, attack: 0.012, sustain: 0.06,
        filter: { type: 'lowpass', freq: 900 }
      }))
    },
    {
      // Tom, tom mais grave e prato
      id: 'ba-dum-tss', name: 'Ba dum tss',
      voices: [
        { wave: 'sine', freq: 210, to: 120, glide: 0.08, start: 0, dur: 0.22, gain: 0.7, attack: 0.002 },
        { wave: 'noise', start: 0, dur: 0.09, gain: 0.35, attack: 0.001, filter: { type: 'bandpass', freq: 2200, q: 0.8 } },
        { wave: 'sine', freq: 130, to: 65, glide: 0.1, start: 0.22, dur: 0.32, gain: 0.85, attack: 0.002 },
        { wave: 'noise', start: 0.22, dur: 0.07, gain: 0.25, attack: 0.001, filter: { type: 'bandpass', freq: 1200, q: 0.8 } },
        ...cymbal(0.5, 1.3, 0.3)
      ]
    },
    {
      // Metais dramáticos com tímpano; a última nota segura e treme
      id: 'tchan', name: 'Tchan tchan tchaaan',
      voices: [
        ...brass(293.7, 0, 0.24, 0.13),
        ...brass(261.6, 0.32, 0.24, 0.13),
        ...brass(233.1, 0.64, 1.4, 0.13, { release: 0.5, bright: 3200, vibrato: { rate: 5.5, depth: 0.5, to: 5 } }),
        ...[0, 0.32, 0.64].flatMap((s, i) => [
          { wave: 'sine', freq: i === 2 ? 73.4 : 98, to: i === 2 ? 70 : 94, start: s, dur: i === 2 ? 1.4 : 0.4, gain: 0.5, attack: 0.003 },
          { wave: 'noise', start: s, dur: 0.06, gain: 0.2, attack: 0.001, filter: { type: 'lowpass', freq: 500 } }
        ])
      ]
    },
    { id: 'aplausos', name: 'Aplausos', voices: applause() },
    {
      // Fanfarra de videogame: melodia em quadrada, baixo em triângulo e um eco
      id: 'vitoria', name: 'Vitória 8-bit',
      voices: [[523.3, 0], [659.3, 0.1], [784, 0.2], [1046.5, 0.3], [784, 0.45], [1046.5, 0.55]].flatMap(([f, s], i) => {
        const last = i === 5;
        const note = {
          wave: 'square', freq: f, start: s, dur: last ? 0.7 : 0.09, gain: 0.1, attack: 0.003, sustain: last ? 0.3 : 0.02,
          vibrato: last ? { rate: 7, depth: 0.5, to: 12 } : undefined
        };
        return [note, { ...note, start: s + 0.12, gain: 0.03 }];
      }).concat([[130.8, 0, 0.3], [196, 0.3, 0.25], [261.6, 0.55, 0.7]].map(([f, s, d]) => ({
        wave: 'triangle', freq: f, start: s, dur: d, gain: 0.3, attack: 0.003, sustain: 0.1
      })))
    },
    {
      // "Uá uá uá uáááá": metal com surdina (o filtro abre a cada nota) e a última escorregando
      id: 'trombone', name: 'Trombone triste',
      voices: [[0, 392, 382], [0.48, 370, 360], [0.96, 349.2, 340], [1.44, 329.6, 290]].flatMap(([s, f, to], i) => {
        const last = i === 3;
        const filter = { type: 'lowpass', freq: 300, to: last ? 1300 : 1500, time: last ? 0.35 : 0.2, q: 4 };
        return [-7, 7].map((detune) => ({
          wave: 'sawtooth', freq: f, to, detune, start: s, dur: last ? 1.3 : 0.42, gain: 0.2,
          attack: 0.04, sustain: last ? 0.5 : 0.12, filter, vibrato: last ? { rate: 5, depth: 1, to: 10 } : undefined
        }));
      })
    },
    {
      // Sino de verdade tem parciais fora da série harmônica; as graves duram mais
      id: 'sino', name: 'Sino',
      voices: [[0.5, 0.18, 2.4], [1, 0.3, 2], [1.003, 0.15, 2], [1.19, 0.12, 1.4], [1.5, 0.1, 1.1], [2, 0.12, 0.9], [2.74, 0.07, 0.6], [3.76, 0.05, 0.4]]
        .map(([ratio, gain, dur]) => ({ wave: 'sine', freq: 660 * ratio, start: 0, dur, gain, attack: 0.002 }))
        .concat({ wave: 'noise', start: 0, dur: 0.03, gain: 0.15, attack: 0.001, filter: { type: 'bandpass', freq: 4000, q: 1 } })
    },
    {
      // Mola: estalo, a nota sobe e fica tremendo cada vez menos ("dóóóim")
      id: 'boing', name: 'Boing',
      voices: [
        { wave: 'noise', start: 0, dur: 0.04, gain: 0.3, attack: 0.001, filter: { type: 'lowpass', freq: 900 } },
        { wave: 'triangle', freq: 110, to: 330, glide: 0.07, start: 0, dur: 0.8, gain: 0.55, attack: 0.004, vibrato: { rate: 22, depth: 70, to: 4 } },
        { wave: 'sine', freq: 220, to: 660, glide: 0.07, start: 0, dur: 0.5, gain: 0.15, attack: 0.004, vibrato: { rate: 22, depth: 140, to: 8 } }
      ]
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
        if (v.detune) src.detune.value = v.detune;
        src.frequency.setValueAtTime(v.freq, start);
        if (v.to) src.frequency.exponentialRampToValueAtTime(v.to, start + (v.glide || v.dur));
        if (v.vibrato) {
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = v.vibrato.rate;
          depth.gain.setValueAtTime(v.vibrato.depth, start);
          if (v.vibrato.to != null) depth.gain.linearRampToValueAtTime(v.vibrato.to, end);
          lfo.connect(depth).connect(src.frequency);
          lfo.start(start);
          lfo.stop(end + 0.05);
        }
      }
      // Ataque curto e queda exponencial; com `sustain`, segura antes de soltar
      const env = ctx.createGain();
      const peak = Math.max(0.0002, v.gain * volume);
      const attackEnd = start + (v.attack || Math.min(0.015, v.dur / 4));
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(peak, attackEnd);
      if (v.sustain) env.gain.setValueAtTime(peak, Math.max(attackEnd, end - v.sustain));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      let last = src;
      if (v.filter) {
        const f = ctx.createBiquadFilter();
        f.type = v.filter.type;
        if (v.filter.q) f.Q.value = v.filter.q;
        f.frequency.setValueAtTime(v.filter.freq, start);
        if (v.filter.to) f.frequency.exponentialRampToValueAtTime(v.filter.to, start + (v.filter.time || v.dur));
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
