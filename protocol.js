// Versão do protocolo cliente/servidor. Cliente e servidor precisam ter a mesma
// versão para entrar. Também roda no Node (testes).
(function () {
  const PROTOCOL_VERSION = 4;
  const VERSION_MISMATCH_MESSAGE =
    'Seu Vox está em uma versão diferente da do servidor. Atualize para entrar.';

  function isCompatible(version) {
    return version === PROTOCOL_VERSION;
  }

  const api = { PROTOCOL_VERSION, VERSION_MISMATCH_MESSAGE, isCompatible };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ConcordProtocol = api;
})();
