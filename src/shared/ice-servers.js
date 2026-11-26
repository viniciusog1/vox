// Servidores ICE das chamadas: o STUN de sempre e, se o host configurar, uma retransmissão
// (TURN) para quando a rota direta entre dois PCs não existe (redes com NAT restritivo, CGNAT).
// Funções puras usadas por relay.js, main.js e renderer.js (VoxIce). Também é módulo Node (testes).
(function () {
  const DEFAULT_STUN = { urls: 'stun:stun.l.google.com:19302' };
  const SCHEME = /^(stun|turn|turns):[^\s]+$/i;
  // Porta 53: os navegadores bloqueiam e a tentativa só atrasa a conexão (aviso da Cloudflare).
  const BLOCKED_PORT = /:53(\?|$)/;

  const cleanUrl = (u) => typeof u === 'string' && SCHEME.test(u.trim()) && !BLOCKED_PORT.test(u.trim());

  // Aceita um servidor ({ urls, username, credential }) ou uma lista deles. TURN sem usuário e
  // senha não funciona, então fica de fora.
  function cleanIceServers(input) {
    const list = Array.isArray(input) ? input : input && typeof input === 'object' ? [input] : [];
    const out = [];
    for (const s of list) {
      if (!s || typeof s !== 'object') continue;
      const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter(cleanUrl).map((u) => u.trim());
      if (!urls.length) continue;
      const relay = urls.some((u) => /^turns?:/i.test(u));
      const auth = typeof s.username === 'string' && s.username && typeof s.credential === 'string' && s.credential;
      if (relay && !auth) continue;
      out.push(auth ? { urls, username: s.username, credential: s.credential } : { urls });
    }
    return out;
  }

  const withDefaults = (servers) => [DEFAULT_STUN, ...cleanIceServers(servers)];
  const hasRelay = (servers) => cleanIceServers(servers).some((s) => s.urls.some((u) => /^turns?:/i.test(u)));

  // Servidor próprio (coturn, Metered…) digitado nas configurações.
  function parseManual({ urls, username, credential } = {}) {
    const list = String(urls || '').split(/[\s,]+/).filter(Boolean);
    if (!list.length || !list.every((u) => /^turns?:/i.test(u) && cleanUrl(u))) {
      return { ok: false, error: 'Use endereços que começam com turn: ou turns:, separados por vírgula.' };
    }
    if (!username || !credential) return { ok: false, error: 'Preencha o usuário e a senha da retransmissão.' };
    return { ok: true, servers: [{ urls: list, username: String(username), credential: String(credential) }] };
  }

  // A conexão está passando pela retransmissão? (par de candidatos escolhido, lado local)
  function usesRelay(stats) {
    let local = null;
    stats.forEach((r) => {
      if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') local = r.localCandidateId;
    });
    if (!local) return false;
    const cand = stats.get(local);
    return !!cand && cand.candidateType === 'relay';
  }

  const api = { DEFAULT_STUN, cleanIceServers, withDefaults, hasRelay, parseManual, usesRelay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxIce = api;
})();
