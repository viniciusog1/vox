// Lado do host da retransmissão (TURN): guarda a configuração (segredos cifrados pelo Windows)
// e entrega a lista de servidores para quem entra. Com a Cloudflare, gera credenciais
// temporárias pela API (a chave fica só neste PC). Usado por main.js.
const fs = require('fs');
const ice = require('../shared/ice-servers');

const CF_API = 'https://rtc.live.cloudflare.com/v1/turn/keys';
const TTL_S = 24 * 60 * 60;          // validade das credenciais geradas
const RENEW_BEFORE_MS = 2 * 60 * 60 * 1000; // renova 2 h antes de vencer

function cloudflareError(status) {
  if (status === 401 || status === 403) return 'A Cloudflare recusou o token da API. Confira o token da chave TURN.';
  if (status === 404) return 'A Cloudflare não achou essa chave TURN. Confira o Turn Token ID.';
  return `A Cloudflare respondeu com erro ${status}. Tente de novo em instantes.`;
}

function createRelay({ file, fetchImpl, encrypt, decrypt, now = () => Date.now() }) {
  let config = load();
  let cache = null; // { servers, expires }
  let state = { state: config.mode && config.mode !== 'off' ? 'ok' : 'idle' };

  function load() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
    fs.renameSync(tmp, file);
  }

  const secret = (v) => { try { return v ? decrypt(v) : null; } catch (e) { return null; } };

  function status() {
    return {
      mode: config.mode || 'off',
      keyId: config.mode === 'cloudflare' ? config.keyId : null,
      urls: config.mode === 'manual' ? config.urls : null,
      username: config.mode === 'manual' ? config.username : null,
      ...state
    };
  }

  async function generate(keyId, apiToken) {
    let res;
    try {
      res = await fetchImpl(`${CF_API}/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_S })
      });
    } catch (e) {
      throw new Error('Sem conexão com a Cloudflare. Confira a internet e tente de novo.');
    }
    if (!res.ok) throw new Error(cloudflareError(res.status));
    const data = await res.json();
    const servers = ice.cleanIceServers(data && data.iceServers).filter((s) => s.username);
    if (!ice.hasRelay(servers)) throw new Error('A Cloudflare não devolveu servidores de retransmissão.');
    return servers;
  }

  async function configure(next = {}) {
    if (next.mode === 'off') {
      config = { mode: 'off' };
      cache = null;
      state = { state: 'idle' };
      save();
      return status();
    }
    if (next.mode === 'cloudflare') {
      const keyId = String(next.keyId || '').trim();
      const apiToken = String(next.apiToken || '').trim() || secret(config.mode === 'cloudflare' && config.keyId === keyId ? config.apiToken : null);
      if (!keyId || !/^[\w-]{1,128}$/.test(keyId)) throw new Error('Cole o Turn Token ID da chave TURN da Cloudflare.');
      if (!apiToken) throw new Error('Cole o API Token da chave TURN da Cloudflare.');
      const servers = await generate(keyId, apiToken);
      config = { mode: 'cloudflare', keyId, apiToken: encrypt(apiToken) };
      cache = { servers, expires: now() + TTL_S * 1000 };
      state = { state: 'ok', at: now() };
      save();
      return status();
    }
    if (next.mode === 'manual') {
      const credential = String(next.credential || '') || secret(config.mode === 'manual' ? config.credential : null) || '';
      const parsed = ice.parseManual({ urls: next.urls, username: next.username, credential });
      if (!parsed.ok) throw new Error(parsed.error);
      const s = parsed.servers[0];
      config = { mode: 'manual', urls: s.urls.join(', '), username: s.username, credential: encrypt(s.credential) };
      cache = null;
      state = { state: 'ok', at: now() };
      save();
      return status();
    }
    throw new Error('Escolha como usar a retransmissão.');
  }

  // Lista para mandar aos clientes ([] = sem retransmissão). Nunca lança erro.
  async function iceServers() {
    if (config.mode === 'manual') {
      const parsed = ice.parseManual({ urls: config.urls, username: config.username, credential: secret(config.credential) });
      return parsed.ok ? parsed.servers : [];
    }
    if (config.mode !== 'cloudflare') return [];
    if (cache && cache.expires - now() > RENEW_BEFORE_MS) return cache.servers;
    try {
      const servers = await generate(config.keyId, secret(config.apiToken));
      cache = { servers, expires: now() + TTL_S * 1000 };
      state = { state: 'ok', at: now() };
    } catch (e) {
      state = { state: 'error', message: e.message };
    }
    return cache && cache.expires > now() ? cache.servers : [];
  }

  return { status, configure, iceServers };
}

module.exports = { createRelay };
