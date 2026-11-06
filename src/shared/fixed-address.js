// Link fixo para os amigos: o host grava o endereço atual do túnel num Gist do
// próprio GitHub, e o Vox dos amigos lê o Gist para saber onde conectar.
// Regras puras (sem rede): usado por main.js e renderer.js (VoxAddress).
(function (root) {
  const GIST_FILE = 'vox-endereco.json';
  const GIST_DESCRIPTION = 'Endereço do servidor Vox (atualizado automaticamente pelo Vox)';
  // Página do GitHub para criar um token clássico só com a permissão "gist".
  const TOKEN_PAGE = 'https://github.com/settings/tokens/new?scopes=gist&description=Vox%20-%20link%20fixo';

  const ID_RE = /^[0-9a-f]{20,40}$/i;
  const OWNER_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;

  // Aceita o link do Gist (gist.github.com/<dono>/<id>, com ou sem https://),
  // o link "raw" (gist.githubusercontent.com/<dono>/<id>/raw/...) ou só o id.
  // Devolve { owner, id } (owner pode ser null) ou null se não for um Gist.
  function parseGistRef(input) {
    let s = String(input || '').trim();
    if (!s) return null;
    if (ID_RE.test(s)) return { owner: null, id: s.toLowerCase() };
    s = s.replace(/^https?:\/\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    const parts = s.split('/');
    const host = (parts.shift() || '').toLowerCase();
    if (host !== 'gist.github.com' && host !== 'gist.githubusercontent.com') return null;
    if (parts.length === 1 && ID_RE.test(parts[0])) return { owner: null, id: parts[0].toLowerCase() };
    if (parts.length >= 2 && OWNER_RE.test(parts[0]) && ID_RE.test(parts[1])) {
      return { owner: parts[0], id: parts[1].toLowerCase() };
    }
    return null;
  }

  function gistLink(owner, id) {
    return owner ? `https://gist.github.com/${owner}/${id}` : `https://gist.github.com/${id}`;
  }

  function apiUrl(id) {
    return `https://api.github.com/gists/${id}`;
  }

  // Reserva quando a API do GitHub recusar (limite de 60 leituras por hora sem login).
  // O parâmetro t evita a cópia antiga guardada no cache do GitHub.
  function rawUrl(owner, id, now) {
    if (!owner) return null;
    return `https://gist.githubusercontent.com/${owner}/${id}/raw/${GIST_FILE}?t=${Number(now) || 0}`;
  }

  // Endereço de servidor aceito: http(s), só origem (sem caminho), sem espaços.
  function cleanServerUrl(url) {
    if (typeof url !== 'string') return null;
    const s = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(s)) return null;
    return s.toLowerCase();
  }

  function buildPayload(url, now) {
    return JSON.stringify({
      app: 'vox',
      url: cleanServerUrl(url),
      updatedAt: new Date(Number(now) || Date.now()).toISOString()
    }, null, 2);
  }

  // Conteúdo do arquivo (texto) → endereço, ou null.
  function readPayloadText(text) {
    try {
      const data = JSON.parse(String(text || ''));
      if (!data || data.app !== 'vox') return null;
      return cleanServerUrl(data.url);
    } catch (e) {
      return null;
    }
  }

  // Resposta da API (GET /gists/<id>) → endereço, ou null.
  function readGistResponse(gist) {
    const file = gist && gist.files && gist.files[GIST_FILE];
    if (!file || file.truncated) return null;
    return readPayloadText(file.content);
  }

  // Dono do Gist na resposta da API, para montar o link.
  function ownerOf(gist) {
    const login = gist && gist.owner && gist.owner.login;
    return typeof login === 'string' && OWNER_RE.test(login) ? login : null;
  }

  // Na lista de Gists da pessoa, o Gist do Vox (para reaproveitar o mesmo link).
  function findVoxGist(list) {
    if (!Array.isArray(list)) return null;
    return list.find((g) => g && g.files && g.files[GIST_FILE] && ID_RE.test(String(g.id || ''))) || null;
  }

  // Formato de token do GitHub: clássico (ghp_) ou granular (github_pat_).
  function looksLikeToken(token) {
    return /^(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$/.test(String(token || '').trim());
  }

  const api = {
    GIST_FILE, GIST_DESCRIPTION, TOKEN_PAGE,
    parseGistRef, gistLink, apiUrl, rawUrl, cleanServerUrl,
    buildPayload, readPayloadText, readGistResponse, ownerOf, findVoxGist, looksLikeToken
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VoxAddress = api;
})(typeof window !== 'undefined' ? window : globalThis);
