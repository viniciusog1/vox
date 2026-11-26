// Volume por pessoa de 0 a 200%. Um <audio> só vai até 100%; acima disso o som passa por um
// amplificador (Web Audio) que toca em outro <audio>, e o original fica mudo. Também é módulo Node (testes).
(function () {
  const MAX_VOLUME = 2;
  const KNEE = 0.85; // abaixo disto o som sai igual; acima, é arredondado em vez de estourar

  function readVolume(v) {
    return typeof v === 'number' && v >= 0 && v <= MAX_VOLUME ? v : 1;
  }

  // Curva do WaveShaper. A entrada vem dividida por MAX_VOLUME, para caber em -1..1.
  function softClipCurve(n) {
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = ((i / (n - 1)) * 2 - 1) * MAX_VOLUME;
      const a = Math.abs(x);
      curve[i] = Math.sign(x) * (a <= KNEE ? a : KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE)));
    }
    return curve;
  }

  // getContext() → AudioContext; createOutput(stream) → <audio> já na página e na saída escolhida.
  function createBooster({ getContext, createOutput }) {
    const boosts = new Map(); // <audio> original -> amplificador

    function release(el) {
      const b = boosts.get(el);
      if (!b) return;
      boosts.delete(el);
      b.ctx.removeEventListener('statechange', b.sync);
      [b.source, b.gain, b.shaper].forEach((n) => n.disconnect());
      b.out.srcObject = null;
      b.out.remove();
      el.muted = false;
    }

    function start(el) {
      const ctx = getContext();
      const source = ctx.createMediaStreamSource(el.srcObject);
      const gain = ctx.createGain();
      const shaper = ctx.createWaveShaper();
      const dest = ctx.createMediaStreamDestination();
      shaper.curve = softClipCurve(4097);
      source.connect(gain);
      gain.connect(shaper);
      shaper.connect(dest);
      const b = { ctx, source, gain, shaper, out: createOutput(dest.stream), playing: false };
      // O original só fica mudo com o amplificado tocando de verdade: na dúvida, a pessoa é ouvida a 100%.
      b.sync = () => { if (boosts.get(el) === b) el.muted = b.playing && ctx.state === 'running'; };
      boosts.set(el, b);
      ctx.addEventListener('statechange', b.sync);
      Promise.resolve(b.out.play()).then(() => { b.playing = true; b.sync(); }, () => {});
      return b;
    }

    function set(el, volume) {
      el.volume = Math.min(1, volume);
      if (volume <= 1) { release(el); return; }
      const b = boosts.get(el);
      try {
        const { gain, ctx } = b || start(el);
        if (b) gain.gain.setTargetAtTime(volume / MAX_VOLUME, ctx.currentTime, 0.02);
        else gain.gain.value = volume / MAX_VOLUME;
      } catch (e) {
        release(el);
        el.muted = false;
      }
    }

    return { set, release };
  }

  // O que esta pessoa não está ouvindo de alguém por ter zerado a barra: 'voice', 'screen' ou null.
  // Sem aviso, a voz zerada parece defeito: o anel de fala acende (mede o que chega) e não sai som.
  function silencedFor(voiceVolume, screenVolume, sharing) {
    if (voiceVolume === 0) return 'voice';
    if (sharing && screenVolume === 0) return 'screen';
    return null;
  }

  const api = { MAX_VOLUME, readVolume, softClipCurve, createBooster, silencedFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxVolumeBoost = api;
})();
