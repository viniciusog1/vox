// Sons de fábrica do soundboard, sintetizados com Web Audio (sem arquivos e sem
// direitos autorais), todos no estilo 8-bit de console antigo: ondas de pulso,
// triângulo para o grave e ruído "granulado". Também roda no Node (testes).
(function () {
  // voz: { wave: 'pulse'|'square'|'triangle'|'chipnoise', freq, to?, glide?, duty? (pulso: 0.125, 0.25, 0.5),
  //        rate? (chipnoise: trocas de valor por segundo; mais alto = mais chiado), start, dur, gain,
  //        attack?, sustain? (segura o volume e solta nos últimos `sustain` s), vibrato?: { rate, depth, to? } }
  // Sem `sustain`, a voz cai exponencialmente desde o ataque.
  // `to` desliza a frequência em `glide` s (padrão: a voz inteira); no vibrato, a profundidade vai até `to`.

  // Sorteio com semente: sons com variação saem sempre iguais (e os testes também)
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  // Nota com eco curto, como nos jogos de 8 bits (a mesma nota mais baixa logo depois)
  function withEcho(voice, delay = 0.12, level = 0.3) {
    return [voice, { ...voice, start: voice.start + delay, gain: voice.gain * level }];
  }

  // Aplausos 8-bit: rajada de estalos de ruído granulado, cada um com timbre próprio
  function applause() {
    const rand = seeded(11);
    const voices = [];
    let t = 0;
    while (t < 1.7) {
      const fade = t > 1.1 ? Math.max(0.15, 1 - (t - 1.1) / 0.6) : Math.min(1, 0.6 + t * 2);
      voices.push({
        wave: 'chipnoise', rate: 4000 + rand() * 9000, start: t, dur: 0.03 + rand() * 0.03,
        gain: 0.5 * fade * (0.6 + rand() * 0.4), attack: 0.001
      });
      t += 0.025 + rand() * 0.035;
    }
    // "Êêê!" da plateia no fim: arpejo rápido subindo
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => voices.push(...withEcho({
      wave: 'pulse', duty: 0.25, freq: f, start: 0.15 + i * 0.06, dur: i === 3 ? 0.35 : 0.06, gain: 0.12, attack: 0.002, sustain: 0.03
    })));
    return voices;
  }

  const BUILTIN = [
    {
      // "Fom-fóóm": duas notas juntas em pulso fino, com uma subidinha no começo
      id: 'buzina', name: 'Buzina',
      voices: [[0, 0.16], [0.24, 0.42]].flatMap(([s, d]) => [[349.2, 0.25], [440, 0.125]].map(([f, duty]) => ({
        wave: 'pulse', duty, freq: f * 0.9, to: f, glide: 0.03, start: s, dur: d, gain: 0.13, attack: 0.002, sustain: 0.04,
        vibrato: { rate: 12, depth: 5 }
      })).concat({ wave: 'triangle', freq: 174.6, start: s, dur: d, gain: 0.35, attack: 0.002, sustain: 0.04 }))
    },
    {
      // Bateria de console: tom no triângulo caindo rápido, tom mais grave e prato de ruído
      id: 'ba-dum-tss', name: 'Ba dum tss',
      voices: [
        { wave: 'triangle', freq: 300, to: 90, glide: 0.06, start: 0, dur: 0.16, gain: 0.6, attack: 0.001 },
        { wave: 'chipnoise', rate: 5000, start: 0, dur: 0.05, gain: 0.2, attack: 0.001 },
        { wave: 'triangle', freq: 200, to: 55, glide: 0.08, start: 0.2, dur: 0.24, gain: 0.7, attack: 0.001 },
        { wave: 'chipnoise', rate: 3500, start: 0.2, dur: 0.05, gain: 0.2, attack: 0.001 },
        { wave: 'chipnoise', rate: 18000, start: 0.46, dur: 1.0, gain: 0.3, attack: 0.001 },
        { wave: 'chipnoise', rate: 9000, start: 0.46, dur: 0.25, gain: 0.15, attack: 0.001 }
      ]
    },
    {
      // Três acordes dramáticos descendo; o último segura, treme e ganha um prato
      id: 'tchan', name: 'Tchan tchan tchaaan',
      voices: [[0, 0.2, 293.7], [0.28, 0.2, 261.6], [0.56, 1.2, 233.1]].flatMap(([s, d, f], i) => {
        const last = i === 2;
        const shape = { start: s, dur: d, attack: 0.003, sustain: last ? 0.5 : 0.04, vibrato: last ? { rate: 6, depth: 0.5, to: 8 } : undefined };
        return [
          { ...shape, wave: 'pulse', duty: 0.5, freq: f, gain: 0.08 },
          { ...shape, wave: 'pulse', duty: 0.25, freq: f * 1.189, gain: 0.05 }, // terça menor: soa sombrio
          { ...shape, wave: 'triangle', freq: f / 2, gain: 0.28, vibrato: undefined },
          { wave: 'chipnoise', rate: last ? 12000 : 2500, start: s, dur: last ? 0.7 : 0.08, gain: last ? 0.12 : 0.1, attack: 0.001 }
        ];
      })
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
      // "Fim de jogo": quatro notas descendo, cada uma caindo um pouco, a última escorrega e treme
      id: 'trombone', name: 'Trombone triste',
      voices: [[0, 392], [0.36, 370], [0.72, 349.2], [1.08, 329.6]].flatMap(([s, f], i) => {
        const last = i === 3;
        const shape = {
          start: s, dur: last ? 1.1 : 0.3, attack: 0.004, sustain: last ? 0.4 : 0.06,
          to: last ? f * 0.84 : f * 0.97, glide: last ? 0.9 : 0.3
        };
        return [
          { ...shape, wave: 'pulse', duty: 0.25, freq: f, gain: 0.13, vibrato: last ? { rate: 5, depth: 1, to: 14 } : undefined },
          { ...shape, wave: 'triangle', freq: f / 2, gain: 0.35 }
        ];
      })
    },
    {
      // "Plim!" de item coletado: duas notas agudas em pulso fino, com dois ecos
      id: 'sino', name: 'Sino',
      voices: [[1318.5, 0], [1975.5, 0.07]].flatMap(([f, s]) => {
        const note = { wave: 'pulse', duty: 0.125, freq: f, start: s, dur: 0.5, gain: 0.32, attack: 0.001 };
        return [note, { ...note, start: s + 0.18, gain: 0.07 }, { ...note, start: s + 0.36, gain: 0.03 }];
      }).concat({ wave: 'triangle', freq: 659.3, start: 0, dur: 0.6, gain: 0.45, attack: 0.001 })
    },
    {
      // Pulo de mola: sobe rápido e fica balançando cada vez menos
      id: 'boing', name: 'Boing',
      voices: [
        { wave: 'pulse', duty: 0.25, freq: 150, to: 600, glide: 0.1, start: 0, dur: 0.6, gain: 0.16, attack: 0.002, sustain: 0.25,
          vibrato: { rate: 16, depth: 90, to: 3 } },
        { wave: 'triangle', freq: 75, to: 300, glide: 0.1, start: 0, dur: 0.45, gain: 0.35, attack: 0.002, vibrato: { rate: 16, depth: 45, to: 2 } }
      ]
    }
  ];

  const byId = new Map(BUILTIN.map((s) => [s.id, s]));
  const isBuiltin = (id) => byId.has(id);
  const durationOf = (id) => {
    const s = byId.get(id);
    return s ? Math.max(...s.voices.map((v) => v.start + v.dur)) : 0;
  };

  // Ruído de console: valor ±1 que só troca `rate` vezes por segundo (som granulado, não chiado de rádio)
  const chipNoiseCache = new Map();
  function chipNoise(ctx, rate) {
    const hold = Math.max(1, Math.round(ctx.sampleRate / rate));
    const key = `${ctx.sampleRate}:${hold}`;
    let buf = chipNoiseCache.get(key);
    if (!buf) {
      buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let value = 0;
      for (let i = 0; i < data.length; i++) {
        if (i % hold === 0) value = Math.random() < 0.5 ? -1 : 1;
        data[i] = value;
      }
      chipNoiseCache.set(key, buf);
    }
    return buf;
  }

  // Onda de pulso com largura `duty` (série de Fourier), uma por contexto e largura
  const pulseCache = new WeakMap();
  function pulseWave(ctx, duty) {
    let byDuty = pulseCache.get(ctx);
    if (!byDuty) pulseCache.set(ctx, (byDuty = new Map()));
    let wave = byDuty.get(duty);
    if (!wave) {
      const n = 64;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
        imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
      }
      wave = ctx.createPeriodicWave(real, imag);
      byDuty.set(duty, wave);
    }
    return wave;
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
      if (v.wave === 'chipnoise') {
        src = ctx.createBufferSource();
        src.buffer = chipNoise(ctx, v.rate);
        src.loop = true;
      } else {
        src = ctx.createOscillator();
        if (v.wave === 'pulse') src.setPeriodicWave(pulseWave(ctx, v.duty));
        else src.type = v.wave;
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
      // Começa calado já agora: o ganho padrão é 1, e o primeiro valor do ruído
      // (±1) escapava cheio antes do evento em `start` (medido: pico 1,0)
      env.gain.setValueAtTime(0.0001, ctx.currentTime);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(peak, attackEnd);
      if (v.sustain) env.gain.setValueAtTime(peak, Math.max(attackEnd, end - v.sustain));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      src.connect(env).connect(destination);
      // Ruído começa num trecho sorteado: estalos curtos não saem todos idênticos
      if (v.wave === 'chipnoise') src.start(start, Math.random() * 0.9);
      else src.start(start);
      src.stop(end + 0.05);
    }
    return true;
  }

  const api = { BUILTIN: BUILTIN.map(({ id, name }) => ({ id, name })), VOICES: BUILTIN, isBuiltin, durationOf, playBuiltin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxSoundboardSynth = api;
})();
