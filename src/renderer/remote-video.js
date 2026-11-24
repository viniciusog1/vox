// Decide se a outra pessoa está mandando vídeo (câmera ou tela) para o tile mostrar
// o <video> ou o avatar. Não dá para usar track.muted: no Chromium a faixa remota
// desmuta no primeiro pacote, inclusive os de sondagem de banda (sem quadro nenhum),
// e não volta a mutar quando a câmera desliga. O que vale são os quadros decodificados.
// Também roda no Node (testes).
(function () {
  const VIDEO_POLL_MS = 500;
  const VIDEO_HOLD_MS = 1500; // pausa curta de quadros não troca para o avatar

  function createRemoteVideo() {
    return { active: false, frames: 0, lastFrameAt: -Infinity };
  }

  // sharing: a pessoa está compartilhando a tela; uma tela parada pode ficar sem quadros novos.
  function updateRemoteVideo(state, frames, nowMs, sharing) {
    if (frames > state.frames) {
      state.active = true;
      state.lastFrameAt = nowMs;
    } else if (state.active && !sharing && nowMs - state.lastFrameAt > VIDEO_HOLD_MS) {
      state.active = false;
    }
    state.frames = frames;
    return state.active;
  }

  const api = { VIDEO_POLL_MS, VIDEO_HOLD_MS, createRemoteVideo, updateRemoteVideo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxRemoteVideo = api;
})();
