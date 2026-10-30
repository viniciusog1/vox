// Detecção de "falando" para o anel do avatar no canal de voz. Liga acima do
// limiar e só desliga depois de um tempo em silêncio, para não piscar entre
// palavras ou com ruído curto. Também roda no Node (testes).
(function () {
  const SPEAK_ON_LEVEL = 0.12;
  const SPEAK_HOLD_MS = 250;

  // Mesma métrica do medidor de áudio: média dos graves (24 primeiros bins) × 1.6
  function levelFromAnalyser(analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += data[i];
    return Math.min(1, (sum / 24 / 255) * 1.6);
  }

  function createSpeakingState() {
    return { speaking: false, lastLoudAt: -Infinity };
  }

  function updateSpeaking(state, level, nowMs) {
    if (level >= SPEAK_ON_LEVEL) {
      state.speaking = true;
      state.lastLoudAt = nowMs;
    } else if (state.speaking && nowMs - state.lastLoudAt > SPEAK_HOLD_MS) {
      state.speaking = false;
    }
    return state.speaking;
  }

  const api = { SPEAK_ON_LEVEL, SPEAK_HOLD_MS, levelFromAnalyser, createSpeakingState, updateSpeaking };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ConcordSpeaking = api;
})();
