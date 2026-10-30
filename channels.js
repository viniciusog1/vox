// Canais de texto e de voz. Lista fixa compartilhada entre servidor (Node) e
// navegador. Também roda no Node (testes).
(function () {
  const TEXT_CHANNELS = ['geral', 'jogos', 'musica'];
  const VOICE_CHANNELS = ['voz-sala', 'voz-jogos', 'voz-musica'];
  const DEFAULT_TEXT_CHANNEL = 'geral';
  const DEFAULT_VOICE_CHANNEL = 'voz-sala';

  function isTextChannel(id) {
    return TEXT_CHANNELS.includes(id);
  }

  function isVoiceChannel(id) {
    return VOICE_CHANNELS.includes(id);
  }

  const api = {
    TEXT_CHANNELS,
    VOICE_CHANNELS,
    DEFAULT_TEXT_CHANNEL,
    DEFAULT_VOICE_CHANNEL,
    isTextChannel,
    isVoiceChannel,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxChannels = api;
})();
