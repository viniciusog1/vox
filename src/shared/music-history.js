// Histórico de músicas pedidas, por servidor (ou por chamada direta), para a
// aba Sugestões do painel de música. Funções puras sobre o objeto gravado em
// music-history.json; main.js grava. Também roda no Node (testes).
(function () {
  const MAX_ENTRIES = 300;     // por servidor; as mais antigas saem
  const MAX_SUGGESTIONS = 12;  // por seção

  function emptyDb() {
    return {};
  }

  // Guarda um pedido. entry: { videoId, title, thumbnail, addedBy }
  function recordRequest(db, scope, entry, nowIso) {
    if (!scope || !entry || !entry.videoId) return;
    const list = db[scope] || (db[scope] = []);
    list.push({
      videoId: entry.videoId,
      title: entry.title || entry.videoId,
      thumbnail: entry.thumbnail || null,
      addedBy: entry.addedBy || null,
      at: nowIso
    });
    if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
  }

  function dropScope(db, scope) {
    if (!db[scope]) return false;
    delete db[scope];
    return true;
  }

  // { recent, top }: tocadas recentemente (sem repetir) e mais pedidas (2× ou mais).
  // Cada item: { videoId, title, thumbnail, count, lastBy, lastAt, inQueue }
  function suggestionsFor(db, scope, queuedIds = []) {
    const list = db[scope] || [];
    const queued = new Set(queuedIds);
    const byVideo = new Map();
    for (const e of list) {
      const cur = byVideo.get(e.videoId) || { videoId: e.videoId, count: 0 };
      cur.count += 1;
      cur.title = e.title;
      cur.thumbnail = e.thumbnail;
      cur.lastBy = e.addedBy;
      cur.lastAt = e.at;
      byVideo.set(e.videoId, cur);
    }
    const all = [...byVideo.values()].map((v) => ({ ...v, inQueue: queued.has(v.videoId) }));
    const recent = all.slice().sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt))).slice(0, MAX_SUGGESTIONS);
    const top = all.filter((v) => v.count >= 2)
      .sort((a, b) => b.count - a.count || String(b.lastAt).localeCompare(String(a.lastAt)))
      .slice(0, MAX_SUGGESTIONS);
    return { recent, top };
  }

  const api = { MAX_ENTRIES, MAX_SUGGESTIONS, emptyDb, recordRequest, dropScope, suggestionsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxMusicHistory = api;
})();
