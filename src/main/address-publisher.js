// Lado do host do link fixo: guarda o token do GitHub (cifrado pelo Windows) e
// grava o endereço atual do túnel no Gist sempre que ele muda. Usado por main.js.
const fs = require('fs');
const addr = require('../shared/fixed-address');

const API = 'https://api.github.com';
const RETRY_MS = 60 * 1000;

function friendlyError(status, fallback) {
  if (status === 401) return 'O token do GitHub venceu ou foi apagado. Conecte de novo com um token novo.';
  if (status === 403) return 'O GitHub recusou: o token precisa da permissão "gist".';
  if (status === 404) return 'O Gist do Vox não foi encontrado (apagado?). Conecte de novo.';
  return fallback || `O GitHub respondeu com erro ${status}.`;
}

// fetchImpl, encrypt e decrypt vêm de fora (Electron em main.js, falsos nos testes).
function createAddressPublisher({ file, fetchImpl, encrypt, decrypt, onStatus = () => {}, now = () => Date.now() }) {
  let config = load();
  let publishState = { state: 'idle' };
  let wantedUrl = null;
  let retryTimer = null;
  let running = null;

  function load() {
    try {
      const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
  }

  function token() {
    if (!config.token) return null;
    try { return decrypt(config.token); } catch (e) { return null; }
  }

  function connected() {
    return !!(config.id && config.token);
  }

  function status() {
    return {
      connected: connected(),
      owner: config.owner || null,
      id: config.id || null,
      link: connected() ? addr.gistLink(config.owner, config.id) : null,
      autoTunnel: !!config.autoTunnel,
      publish: publishState
    };
  }

  function emit() { onStatus(status()); }

  async function gh(method, url, tok, body) {
    const res = await fetchImpl(API + url, {
      method,
      headers: {
        Authorization: `Bearer ${tok}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Vox',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  function filesFor(url) {
    return { [addr.GIST_FILE]: { content: addr.buildPayload(url, now()) } };
  }

  // Valida o token, reaproveita o Gist do Vox se já existir (o link continua o mesmo)
  // ou cria um secreto. Lança Error com mensagem para a pessoa.
  async function connect(rawToken, currentUrl) {
    const tok = String(rawToken || '').trim();
    if (!addr.looksLikeToken(tok)) throw new Error('Isso não parece um token do GitHub (começa com ghp_ ou github_pat_).');
    let me;
    try {
      me = await gh('GET', '/user', tok);
    } catch (e) {
      throw new Error('Sem conexão com o GitHub. Confira a internet e tente de novo.');
    }
    if (!me.ok) throw new Error(friendlyError(me.status));
    const scopes = me.headers && me.headers.get && me.headers.get('x-oauth-scopes');
    if (typeof scopes === 'string' && !scopes.split(',').map((s) => s.trim()).includes('gist')) {
      throw new Error('O token precisa da permissão "gist". Crie outro marcando só essa caixa.');
    }
    const login = me.data && me.data.login;

    const list = await gh('GET', '/gists?per_page=100', tok);
    const existing = list.ok ? addr.findVoxGist(list.data) : null;
    let gist;
    if (existing) {
      gist = await gh('PATCH', `/gists/${existing.id}`, tok, { files: filesFor(currentUrl) });
    } else {
      gist = await gh('POST', '/gists', tok, {
        description: addr.GIST_DESCRIPTION,
        public: false,
        files: filesFor(currentUrl)
      });
    }
    if (!gist.ok || !gist.data || !gist.data.id) throw new Error(friendlyError(gist.status));

    config = {
      ...config,
      owner: addr.ownerOf(gist.data) || login || null,
      id: String(gist.data.id).toLowerCase(),
      token: encrypt(tok)
    };
    if (config.autoTunnel === undefined) config.autoTunnel = true;
    save();
    publishState = currentUrl
      ? { state: 'ok', url: addr.cleanServerUrl(currentUrl), at: now() }
      : { state: 'idle' };
    if (publishState.url) wantedUrl = publishState.url;
    emit();
    return status();
  }

  function disconnect() {
    clearTimeout(retryTimer);
    delete config.token;
    delete config.id;
    delete config.owner;
    save();
    publishState = { state: 'idle' };
    emit();
    return status();
  }

  function setAutoTunnel(on) {
    config.autoTunnel = !!on;
    save();
    emit();
    return status();
  }

  async function attempt() {
    const url = wantedUrl;
    const tok = token();
    if (!url || !tok || !config.id) return;
    publishState = { state: 'publishing', url };
    emit();
    let res;
    try {
      res = await gh('PATCH', `/gists/${config.id}`, tok, { files: filesFor(url) });
    } catch (e) {
      res = { ok: false, status: 0 };
    }
    if (url !== wantedUrl) return; // chegou endereço mais novo enquanto isso
    if (res.ok) {
      publishState = { state: 'ok', url, at: now() };
    } else {
      const fatal = [401, 404].includes(res.status);
      publishState = {
        state: 'error', url, at: now(),
        message: res.status ? friendlyError(res.status) : 'Sem conexão com o GitHub; tentando de novo.'
      };
      if (!fatal) retryTimer = setTimeout(() => publish(url), RETRY_MS);
    }
    emit();
  }

  // Grava o endereço no Gist. Chamadas repetidas com o mesmo endereço não regravam.
  function publish(url) {
    const clean = addr.cleanServerUrl(url);
    if (!clean || !connected()) return Promise.resolve();
    if (clean === wantedUrl && publishState.state === 'ok' && publishState.url === clean) return Promise.resolve();
    wantedUrl = clean;
    clearTimeout(retryTimer);
    running = (running || Promise.resolve()).then(attempt, attempt);
    return running;
  }

  function stop() { clearTimeout(retryTimer); }

  return { status, connect, disconnect, setAutoTunnel, publish, stop, autoTunnel: () => !!config.autoTunnel };
}

module.exports = { createAddressPublisher };
