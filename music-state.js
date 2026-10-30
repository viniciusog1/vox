// Regras da fila de música por canal de voz. Módulo puro: sem I/O nem timers,
// todas as funções recebem `now` (ms). Usado pelo servidor (estado oficial) e
// pelo cliente (posição-alvo do player). Também roda no Node (testes).
(function () {
  const MAX_QUEUE = 50;
  const SYNC_TOLERANCE_MS = 2000;
  const RESYNC_INTERVAL_MS = 15000;
  // Intervalo mínimo entre seeks corretivos no mesmo item: com buffering lento depois de um
  // seek, a deriva volta a passar da tolerância e corrigir de novo entraria em laço.
  const SEEK_COOLDOWN_MS = 5000;

  function createMusicState() {
    return { queue: [], playing: false, positionMs: 0, startedAt: null };
  }

  function positionAt(state, now) {
    return state.playing ? state.positionMs + (now - state.startedAt) : state.positionMs;
  }

  // A atual mudou: a primeira da fila começa do zero; fila vazia para.
  function startCurrent(state, now) {
    state.positionMs = 0;
    if (state.queue.length > 0) {
      state.playing = true;
      state.startedAt = now;
    } else {
      state.playing = false;
      state.startedAt = null;
    }
  }

  function addTrack(state, item, now) {
    if (state.queue.length >= MAX_QUEUE) return { ok: false, error: 'full' };
    state.queue.push(item);
    if (state.queue.length === 1) startCurrent(state, now);
    return { ok: true };
  }

  function removeTrack(state, itemId, now) {
    const index = state.queue.findIndex((t) => t.id === itemId);
    if (index === -1) return false;
    state.queue.splice(index, 1);
    if (index === 0) startCurrent(state, now);
    return true;
  }

  function advanceIfCurrent(state, itemId, now) {
    if (!state.queue[0] || state.queue[0].id !== itemId) return false;
    return removeTrack(state, itemId, now);
  }

  function endedIfCurrent(state, itemId, now) {
    if (!state.playing) return false;
    return advanceIfCurrent(state, itemId, now);
  }

  function togglePause(state, now) {
    if (state.queue.length === 0) return;
    if (state.playing) {
      state.positionMs = positionAt(state, now);
      state.playing = false;
      state.startedAt = null;
    } else {
      state.playing = true;
      state.startedAt = now;
    }
  }

  function toPublic(state, now) {
    return {
      queue: state.queue.slice(),
      playing: state.playing,
      positionMs: positionAt(state, now),
      serverNow: now
    };
  }

  // Posição esperada no cliente: usa o relógio local desde o recebimento
  // (não compensa latência de rede).
  function targetPositionMs(pub, clientNow, receivedAtClient) {
    return pub.playing ? pub.positionMs + (clientNow - receivedAtClient) : pub.positionMs;
  }

  function needsSeek(currentMs, targetMs) {
    return Math.abs(currentMs - targetMs) > SYNC_TOLERANCE_MS;
  }

  // lastSeekAtMs: quando foi o último seek corretivo no item atual (null = nenhum).
  function shouldCorrectSeek(currentMs, targetMs, lastSeekAtMs, nowMs) {
    if (!needsSeek(currentMs, targetMs)) return false;
    return lastSeekAtMs === null || nowMs - lastSeekAtMs >= SEEK_COOLDOWN_MS;
  }

  const api = {
    MAX_QUEUE, SYNC_TOLERANCE_MS, RESYNC_INTERVAL_MS, SEEK_COOLDOWN_MS,
    createMusicState, addTrack, removeTrack, advanceIfCurrent, endedIfCurrent,
    togglePause, positionAt, toPublic, targetPositionMs, needsSeek, shouldCorrectSeek
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ConcordMusic = api;
})();
