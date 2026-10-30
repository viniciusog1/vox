// Links do YouTube e consulta de título/miniatura via oEmbed. Roda no servidor
// (Node, main.js) e no renderer (navegador).
(function () {
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'];

  function parseYouTubeId(input) {
    if (typeof input !== 'string') return null;
    let texto = input.trim();
    if (!texto) return null;
    if (!/^https?:\/\//i.test(texto)) texto = 'https://' + texto;
    let url;
    try { url = new URL(texto); } catch { return null; }
    const host = url.hostname.toLowerCase();
    if (!HOSTS.includes(host)) return null;
    let id = null;
    if (host.endsWith('youtu.be')) {
      id = url.pathname.split('/')[1];
    } else {
      const partes = url.pathname.split('/');
      if (partes[1] === 'watch') id = url.searchParams.get('v');
      else if (partes[1] === 'shorts' || partes[1] === 'embed') id = partes[2];
    }
    return id && ID_RE.test(id) ? id : null;
  }

  function thumbnailUrl(id) {
    return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  }

  // 400/401/403/404 = vídeo privado, removido ou inexistente (o id já passou
  // na validação por regex, então 400 do oEmbed significa "id sem vídeo").
  // Qualquer outra falha
  // (rede, timeout, status inesperado) aceita o vídeo com título provisório.
  async function lookupVideo(id, fetchImpl = fetch, timeoutMs = 4000) {
    const fallback = { ok: true, title: id, thumbnail: thumbnailUrl(id) };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
      const res = await fetchImpl(url, { signal: controller.signal });
      if ([400, 401, 403, 404].includes(res.status)) return { ok: false };
      if (res.status !== 200) return fallback;
      const json = await res.json();
      return { ok: true, title: json.title || id, thumbnail: json.thumbnail_url || thumbnailUrl(id) };
    } catch {
      return fallback;
    } finally {
      clearTimeout(timer);
    }
  }

  const api = { parseYouTubeId, thumbnailUrl, lookupVideo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ConcordYouTube = api;
})();
