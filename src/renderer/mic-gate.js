// Gate do microfone (sensibilidade de entrada). createGate roda dentro do
// AudioWorklet (o código vai como texto, por isso não usa nada de fora dela)
// e também no Node (testes). O resto são conversões para a interface.
(function () {
  // Nível RMS em janela de ~10 ms; abre acima do limite, fecha 4 dB abaixo
  // (histerese) só depois de 250 ms sem voz (espera), para não picotar
  // entre palavras. Modo automático: o limite fica `margin` dB acima do ruído
  // de fundo, estimado pelo menor nível dos últimos 2 s (estatística de mínimos):
  // na fala sempre há respiros que mostram o ruído; ruído constante vira o mínimo.
  function createGate(sampleRate) {
    const MIN_DB = -100;
    const CHUNK_SEC = 0.25;
    const CHUNKS = 8; // 8 × 250 ms = janela de 2 s
    const coef = (seconds) => 1 - Math.exp(-1 / Math.max(1, seconds * sampleRate));
    const rmsCoef = coef(0.01);
    const toDb = (power) => (power > 1e-10 ? 10 * Math.log10(power) : MIN_DB);
    const state = { power: 0, levelDb: MIN_DB, floorDb: null, open: false, holdLeft: 0, gain: 0, thresholdDb: -50 };
    const chunkMins = [];
    let chunkMin = Infinity;
    let chunkTime = 0;

    // p: { auto, thresholdDb, margin, holdMs, attackMs, releaseMs, minDb, maxDb, hysteresisDb }
    function processBlock(input, output, p) {
      const attack = coef(p.attackMs / 1000);
      const release = coef(p.releaseMs / 1000);
      const holdSamples = Math.round((p.holdMs / 1000) * sampleRate);
      const blockSec = input.length / sampleRate;
      for (let i = 0; i < input.length; i++) {
        const x = input[i];
        state.power += (x * x - state.power) * rmsCoef;
      }
      state.levelDb = toDb(state.power);

      // Ruído de fundo: mínimo da janela; desce na hora, sobe no máximo 3 dB/s.
      chunkMin = Math.min(chunkMin, state.levelDb);
      chunkTime += blockSec;
      if (chunkTime >= CHUNK_SEC) {
        chunkMins.push(chunkMin);
        if (chunkMins.length > CHUNKS) chunkMins.shift();
        chunkMin = Infinity;
        chunkTime = 0;
      }
      const windowMin = Math.min(chunkMin, ...chunkMins);
      if (state.floorDb === null || windowMin < state.floorDb) state.floorDb = windowMin;
      else state.floorDb = Math.min(windowMin, state.floorDb + 3 * blockSec);
      state.floorDb = Math.max(-90, Math.min(-20, state.floorDb));

      const openDb = p.auto
        ? Math.max(p.minDb, Math.min(p.maxDb, state.floorDb + p.margin))
        : p.thresholdDb;
      state.thresholdDb = openDb;
      const closeDb = openDb - p.hysteresisDb;

      if (state.levelDb >= openDb) { state.open = true; state.holdLeft = holdSamples; }
      else if (state.open && state.levelDb >= closeDb) state.holdLeft = holdSamples;
      else if (state.open) {
        state.holdLeft -= input.length;
        if (state.holdLeft <= 0) state.open = false;
      }

      const target = state.open ? 1 : 0;
      const k = state.open ? attack : release;
      for (let i = 0; i < input.length; i++) {
        state.gain += (target - state.gain) * k;
        output[i] = input[i] * state.gain;
      }
      return state;
    }

    return { processBlock, state };
  }

  const DEFAULTS = { holdMs: 250, attackMs: 3, releaseMs: 120, hysteresisDb: 4, minDb: -65, maxDb: -25 };
  // Margem acima do ruído no modo automático: maior no modo "Forte".
  const MARGIN_DB = { off: 8, browser: 8, strong: 12 };
  const METER_MIN_DB = -70;
  const METER_MAX_DB = -10; // mesma escala do controle manual de sensibilidade

  function gateParams({ auto, thresholdDb, mode }) {
    return { ...DEFAULTS, auto: !!auto, thresholdDb: Number(thresholdDb), margin: MARGIN_DB[mode] || MARGIN_DB.browser };
  }

  // Posição (0–100%) de um nível em dB no medidor.
  function meterPercent(db) {
    const v = (db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB);
    return Math.round(Math.max(0, Math.min(1, v)) * 100);
  }

  const clampNumber = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };

  const api = { createGate, gateParams, meterPercent, clampNumber, DEFAULTS, MARGIN_DB, METER_MIN_DB, METER_MAX_DB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxMicGate = api;
})();
