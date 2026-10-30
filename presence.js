// Regras de presença: modo escolhido pelo usuário + "ausente" automático por
// inatividade (só vale no modo online). Também roda no Node (testes).
(function () {
  const STATUS_MODES = ['online', 'away', 'busy', 'invisible'];

  // Status enviado aos outros: o ausente automático só se aplica ao modo online
  function effectiveStatus(mode, autoAway) {
    return mode === 'online' && autoAway ? 'away' : mode;
  }

  // Novo autoAway após 5 min parado
  function onIdle(mode) {
    return mode === 'online';
  }

  // Atividade só desfaz o automático; o ausente manual é o próprio mode
  function onActivity(autoAway) { // eslint-disable-line no-unused-vars
    return false;
  }

  const api = { STATUS_MODES, effectiveStatus, onIdle, onActivity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ConcordPresence = api;
})();
