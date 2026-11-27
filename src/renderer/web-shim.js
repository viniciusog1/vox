// Versão web (navegador e celular): sem o Electron não existe window.electronAPI.
// Este arquivo cria um substituto com o que faz sentido no navegador e marca a página
// com data-platform="web" (e data-mobile="1" em telas de toque), para o CSS esconder
// o que só existe no app do Windows (túnel, link fixo, retransmissão, bandeja, LoL Arena).
// No Electron não faz nada.
(function () {
  if (window.electronAPI) return;
  const root = document.documentElement;
  root.dataset.platform = 'web';
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (touch) root.dataset.mobile = '1';

  const never = () => new Promise(() => {}); // recursos do host: a tela nunca recebe status
  const noop = () => {};
  const LOGIN_KEY = 'vox-web-login';

  function readLogins() {
    try { return JSON.parse(localStorage.getItem(LOGIN_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeLogins(all) {
    try { localStorage.setItem(LOGIN_KEY, JSON.stringify(all)); } catch (e) { /* modo privado */ }
  }

  window.VOX_WEB = true;
  window.electronAPI = {
    // O navegador mostra o próprio seletor de tela: o do Vox nunca é chamado.
    onDisplaySources: noop,
    selectDisplaySource: noop,
    cancelDisplaySource: noop,

    focusWindow: () => { try { window.focus(); } catch (e) { /* sem permissão */ } },
    flashFrame: noop,
    setCloseToTray: noop,
    getAutostart: never,
    setAutostart: never,
    reportTrayState: noop,
    onTrayToggleMic: noop,

    tunnelStart: never,
    tunnelStop: never,
    tunnelStatus: never,
    onTunnelStatus: noop,

    arenaStatus: never,
    arenaEnable: never,
    arenaCrop: never,
    arenaPreview: never,
    onArenaStatus: noop,
    onArenaShot: noop,

    relayStatus: never,
    relayConfigure: never,

    addressStatus: never,
    addressConnect: never,
    addressDisconnect: never,
    setAutoTunnel: never,
    openTokenPage: noop,
    onAddressStatus: noop,

    // Login mantido no navegador: o token fica no localStorage desta origem (o endereço do host).
    // O app do Windows cifra com safeStorage; aqui não há como, e "Sair da conta" apaga.
    savedLoginGet: async (server) => readLogins()[String(server || '')] || null,
    savedLoginSet: async (server, login) => {
      if (!login || typeof login.username !== 'string' || typeof login.token !== 'string') return false;
      const all = readLogins();
      all[String(server || '')] = { username: login.username, token: login.token };
      writeLogins(all);
      return true;
    },
    savedLoginClear: async (server) => {
      const all = readLogins();
      delete all[String(server || '')];
      writeLogins(all);
      return true;
    },

    appVersion: null,
    updateStatus: never,
    onUpdateStatus: noop,
    installUpdate: noop
  };

  // Notificações: o navegador só pergunta depois de um gesto da pessoa.
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    const ask = () => {
      window.removeEventListener('pointerdown', ask, true);
      try { Notification.requestPermission().catch(noop); } catch (e) { /* Safari antigo */ }
    };
    window.addEventListener('pointerdown', ask, true);
  }
})();
