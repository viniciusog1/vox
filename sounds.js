// Efeitos sonoros (entrar/sair da voz, mutar/desmutar, menção, chamada), gerados com
// Web Audio API: nada é baixado. A decisão de quando tocar é pura e também
// roda no Node (testes).
(function () {
  const STORAGE_KEY = 'vox-sound-effects';
  // 0.12 ficou baixo demais na prática; acima de ~0.6 as notas sobrepostas estouram.
  const SOUND_VOLUME = 0.55;

  // Cada nota: { freq (Hz), start (s), dur (s) } e, opcionais: to (desliza até
  // essa frequência em `glide` s), type, gain (fração do volume), attack (s),
  // vibrato { rate, depth } e noise (ruído filtrado em passa-banda em vez de
  // tom; `q` = largura). Ataque rápido + queda exponencial soa como coisa
  // batida/soprada, não como bipe de aparelho.
  const SOUNDS = {
    // Duas bolhas subindo: "blup-blip!"
    join: { type: 'sine', notes: [
      { freq: 260, to: 720, glide: 0.07, start: 0, dur: 0.12 },
      { freq: 400, to: 1150, glide: 0.07, start: 0.1, dur: 0.15 },
      { freq: 2300, type: 'triangle', start: 0.12, dur: 0.07, gain: 0.12 }
    ] },
    // Apito de êmbolo descendo, com tremido, e um "plof" no fim: "fiuuu… plof"
    leave: { type: 'sine', notes: [
      { freq: 1150, to: 280, glide: 0.28, start: 0, dur: 0.3, attack: 0.02, vibrato: { rate: 13, depth: 22 } },
      { freq: 240, to: 90, glide: 0.06, start: 0.28, dur: 0.1, gain: 0.7 }
    ] },
    // Tampa fechando: "toc-tóc" de madeira, caindo
    mute: { type: 'sine', notes: [
      { freq: 620, to: 210, glide: 0.04, start: 0, dur: 0.08 },
      { noise: true, freq: 2000, q: 3, start: 0, dur: 0.025, gain: 0.5 },
      { freq: 380, to: 130, glide: 0.04, start: 0.085, dur: 0.09, gain: 0.8 },
      { noise: true, freq: 1300, q: 3, start: 0.085, dur: 0.025, gain: 0.4 }
    ] },
    // Rolha saindo: "póp!" com um brilho no fim
    unmute: { type: 'sine', notes: [
      { noise: true, freq: 900, to: 3200, q: 1.5, start: 0, dur: 0.045, gain: 0.8 },
      { freq: 330, to: 1250, glide: 0.05, start: 0.01, dur: 0.12 },
      { freq: 1870, type: 'triangle', start: 0.07, dur: 0.07, gain: 0.15 }
    ] },
    // Menção no chat: "plim-plim" de kalimba (fundamental + harmônico curto)
    mention: { type: 'sine', notes: [
      { freq: 1046.5, start: 0, dur: 0.22 },
      { freq: 2930, start: 0, dur: 0.05, gain: 0.25 },
      { freq: 1568, start: 0.1, dur: 0.28 },
      { freq: 4390, start: 0.1, dur: 0.05, gain: 0.2 }
    ] },
    // Chamada direta tocando: frase de marimba, repetida (renderer.js) a cada 0,5 s
    ring: { type: 'sine', notes: [
      { freq: 784, start: 0, dur: 0.2 },
      { freq: 3136, start: 0, dur: 0.04, gain: 0.2 },
      { freq: 988, start: 0.11, dur: 0.2 },
      { freq: 3952, start: 0.11, dur: 0.04, gain: 0.2 },
      { freq: 1175, start: 0.22, dur: 0.18, vibrato: { rate: 6, depth: 6 } }
    ] }
  };

  // Padrão ligado: só '0' desliga.
  function isEnabled(stored) {
    return stored !== '0';
  }

  // Decide o som a partir da lista anterior e da nova lista da voz (ids).
  // prevIds null = primeira lista depois de eu entrar: toca só a minha entrada,
  // não a de quem já estava lá. Invisíveis nem vêm na lista (o servidor filtra).
  function rosterSound(prevIds, nextIds, selfId) {
    if (!prevIds) return nextIds.includes(selfId) ? 'join' : null;
    const prev = new Set(prevIds);
    const next = new Set(nextIds);
    const joined = nextIds.some((id) => id !== selfId && !prev.has(id));
    if (joined) return 'join';
    const left = prevIds.some((id) => id !== selfId && !next.has(id));
    return left ? 'leave' : null;
  }

  function soundFor(muted) {
    return muted ? 'mute' : 'unmute';
  }

  // Agenda as notas no contexto e manda para `destination`.
  function playSound(ctx, destination, name, volume = SOUND_VOLUME) {
    const sound = SOUNDS[name];
    if (!sound) return;
    const t0 = ctx.currentTime + 0.01;
    for (const note of sound.notes) {
      const start = t0 + note.start;
      const end = start + note.dur;
      const gain = ctx.createGain();
      // Sobe rápido (sem estalo) e cai exponencialmente, como algo percutido
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume * (note.gain ?? 1), start + (note.attack ?? 0.004));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      gain.connect(destination);

      let src;
      if (note.noise) {
        src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = note.q ?? 1;
        filter.frequency.setValueAtTime(note.freq, start);
        if (note.to) filter.frequency.exponentialRampToValueAtTime(note.to, end);
        src.connect(filter).connect(gain);
      } else {
        src = ctx.createOscillator();
        src.type = note.type || sound.type;
        src.frequency.setValueAtTime(note.freq, start);
        if (note.to) src.frequency.exponentialRampToValueAtTime(note.to, start + (note.glide ?? note.dur));
        if (note.vibrato) {
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = note.vibrato.rate;
          depth.gain.value = note.vibrato.depth;
          lfo.connect(depth).connect(src.frequency);
          lfo.start(start);
          lfo.stop(end + 0.02);
        }
        src.connect(gain);
      }
      src.start(start);
      src.stop(end + 0.02);
    }
  }

  // Meio segundo de ruído branco, criado uma vez por contexto
  const noiseBuffers = new WeakMap();
  function noiseBuffer(ctx) {
    let buf = noiseBuffers.get(ctx);
    if (!buf) {
      buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noiseBuffers.set(ctx, buf);
    }
    return buf;
  }

  const api = { STORAGE_KEY, SOUND_VOLUME, SOUNDS, isEnabled, rosterSound, soundFor, playSound };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxSounds = api;
})();
