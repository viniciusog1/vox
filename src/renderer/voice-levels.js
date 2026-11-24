// Nível de voz de cada pessoa da chamada, para os temas que reagem à voz (Azulejo e Rádio).
// Lê os medidores que o Vox já mantém em renderer.js; não abre microfone nem cria áudio.
(function () {
  const HOLD_MS = 350; // pausa curta entre palavras não apaga o destaque

  // [{ name, level }]; name null = eu. null quando não há chamada.
  function read() {
    try {
      if (!currentVoiceRoom) return null;
      const list = [];
      analysers.forEach((an, id) => {
        const user = userMap.get(id);
        if (user) list.push({ name: user.username, level: VoxSpeaking.levelFromAnalyser(an) });
      });
      const mine = micEnabled ? getLocalAnalyser() : null;
      list.push({ name: null, level: mine ? VoxSpeaking.levelFromAnalyser(mine) : 0 });
      return list;
    } catch (e) {
      return null;
    }
  }

  // Tile de uma pessoa na grade da chamada (name null = o meu).
  function tileOf(name) {
    const tiles = [...document.querySelectorAll('#video-grid > .tile:not(.music-tile)')];
    return tiles.find((t) => (name ? t.dataset.peerKey === name : !t.dataset.peerKey && t.querySelector('.tile-name'))) || null;
  }

  // Marca/desmarca `cls` no tile com a mesma folga do anel de fala. Devolve se está falando agora.
  function markSpeaking(tile, level, cls) {
    const speaking = level >= VoxSpeaking.SPEAK_ON_LEVEL;
    const now = performance.now();
    if (speaking) tile._voxFalaAte = now + HOLD_MS;
    tile.classList.toggle(cls, now < (tile._voxFalaAte || 0));
    return speaking;
  }

  window.VoxVoiceLevels = { read, tileOf, markSpeaking };
})();
