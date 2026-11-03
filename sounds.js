// Efeitos sonoros da voz (entrar/sair do canal, mutar/desmutar), gerados com
// Web Audio API: nada é baixado. A decisão de quando tocar é pura e também
// roda no Node (testes).
(function () {
  const STORAGE_KEY = 'vox-sound-effects';
  // 0.12 ficou baixo demais na prática; acima de ~0.6 as notas sobrepostas estouram.
  const SOUND_VOLUME = 0.55;

  // Notas curtas: { freq (Hz), start (s), dur (s) }. Entrar/sair em senoide,
  // mudo em triângulo e mais rápido, para não confundir os dois pares.
  const SOUNDS = {
    join: { type: 'sine', notes: [{ freq: 659.25, start: 0, dur: 0.12 }, { freq: 880, start: 0.09, dur: 0.16 }] },
    leave: { type: 'sine', notes: [{ freq: 880, start: 0, dur: 0.12 }, { freq: 587.33, start: 0.09, dur: 0.18 }] },
    mute: { type: 'triangle', notes: [{ freq: 392, start: 0, dur: 0.06 }, { freq: 293.66, start: 0.06, dur: 0.09 }] },
    unmute: { type: 'triangle', notes: [{ freq: 440, start: 0, dur: 0.06 }, { freq: 587.33, start: 0.06, dur: 0.09 }] }
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = sound.type;
      osc.frequency.value = note.freq;
      const start = t0 + note.start;
      const end = start + note.dur;
      // Ataque e queda suaves para não estalar
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  const api = { STORAGE_KEY, SOUND_VOLUME, SOUNDS, isEnabled, rosterSound, soundFor, playSound };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxSounds = api;
})();
