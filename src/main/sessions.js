// Sessões para entrar sem senha: o cliente guarda o token cifrado (saved-login.js) e o servidor
// guarda só o hash em sessions.json, então reiniciar o Vox do host não derruba quem está conectado.
// Cada uso renova o prazo.
const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * DAY_MS;

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// store: { hash: { username, expires } }
function createSessionStore({ load = () => ({}), save = () => {}, now = () => Date.now(), ttlMs = SESSION_TTL_MS } = {}) {
  let sessions = load() || {};

  function prune() {
    const t = now();
    let changed = false;
    for (const [h, s] of Object.entries(sessions)) {
      if (!s || s.expires <= t) { delete sessions[h]; changed = true; }
    }
    return changed;
  }

  return {
    issue(username) {
      prune();
      const token = crypto.randomBytes(32).toString('hex');
      sessions[hashToken(token)] = { username, expires: now() + ttlMs };
      save(sessions);
      return token;
    },
    // Nome do usuário da sessão, ou null (token inválido, vencido ou conta apagada).
    resolve(token, userExists = () => true) {
      if (typeof token !== 'string' || !token) return null;
      const s = sessions[hashToken(token)];
      if (!s || s.expires <= now() || !userExists(s.username)) return null;
      return s.username;
    },
    // Volta a contar o prazo a partir de agora (no máximo uma gravação por dia).
    renew(token) {
      if (typeof token !== 'string') return;
      const s = sessions[hashToken(token)];
      const t = now();
      if (!s || s.expires <= t || s.expires > t + ttlMs - DAY_MS) return;
      s.expires = t + ttlMs;
      save(sessions);
    },
    revoke(token) {
      if (typeof token !== 'string') return;
      const h = hashToken(token);
      if (sessions[h]) { delete sessions[h]; save(sessions); }
    },
    prune() { if (prune()) save(sessions); }
  };
}

module.exports = { SESSION_TTL_MS, hashToken, createSessionStore };
