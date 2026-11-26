// TESTE TEMPORÁRIO (prints do LoL Arena). Para tirar: apagar este arquivo, lol-arena-watcher.js
// e os trechos marcados com "LoL Arena" em main.js, preload.js, renderer.js e index.html.
//
// Regras puras: o canal "dano-arena-lol" na Casa dos Amigos, com mensagens que somem em 30 min;
// as mortes do jogador vindas da API local da Riot (Live Client Data, 127.0.0.1:2999); e o
// recorte do canto da tela onde o jogo mostra o dano da rodada. Também é módulo Node (testes).
(function () {
  const ARENA_CHANNEL = { id: 'dano-arena-lol', name: 'dano-arena-lol', type: 'text', ttlMinutes: 30 };
  const HOME_SERVER = 'casa';
  const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
  // Canto superior esquerdo, com folga (ajustável em Configurações → Jogos).
  const DEFAULT_CROP = { x: 0, y: 0, w: 0.17, h: 0.5 };

  function ensureArenaChannel(db, user) {
    const server = db && db.servers && db.servers[HOME_SERVER];
    if (!server) return { ok: false, error: 'A Casa dos Amigos não existe neste servidor.' };
    if (!server.members.includes(user)) return { ok: false, error: 'Só quem é da Casa dos Amigos manda prints.' };
    const found = server.channels.find((c) => c.id === ARENA_CHANNEL.id);
    if (found) return { ok: true, created: false, server, channel: found };
    const channel = { ...ARENA_CHANNEL };
    server.channels.push(channel);
    return { ok: true, created: true, server, channel };
  }

  function retentionMs(channel) {
    const ttl = channel && Number(channel.ttlMinutes);
    return ttl > 0 ? ttl * 60 * 1000 : DEFAULT_RETENTION_MS;
  }

  // A API dá o nome com a tag ("Nome#BR1") num lugar e às vezes sem no outro.
  const baseName = (n) => String(n || '').split('#')[0].trim().toLowerCase();
  const sameRiotName = (a, b) => !!baseName(a) && baseName(a) === baseName(b);

  // Mortes do jogador depois do último evento já visto.
  function newDeaths(events, me, lastId) {
    if (!Array.isArray(events)) return { deaths: [], lastId };
    let last = lastId;
    const deaths = [];
    for (const e of events) {
      if (!e || typeof e.EventID !== 'number' || e.EventID <= lastId) continue;
      last = Math.max(last, e.EventID);
      if (e.EventName === 'ChampionKill' && sameRiotName(e.VictimName, me)) deaths.push({ id: e.EventID, time: e.EventTime });
    }
    return { deaths, lastId: last };
  }

  function gameClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  const clamp = (v, min, max, fallback) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(max, Math.max(min, Number(v))) : fallback);

  function cleanCrop(c = {}) {
    return {
      x: clamp(c.x, 0, 0.95, DEFAULT_CROP.x),
      y: clamp(c.y, 0, 0.95, DEFAULT_CROP.y),
      w: clamp(c.w, 0.05, 1, DEFAULT_CROP.w),
      h: clamp(c.h, 0.05, 1, DEFAULT_CROP.h)
    };
  }

  function cropRect(size, crop) {
    const c = cleanCrop(crop);
    const x = Math.round(size.width * c.x);
    const y = Math.round(size.height * c.y);
    return {
      x, y,
      width: Math.max(1, Math.min(size.width - x, Math.round(size.width * c.w))),
      height: Math.max(1, Math.min(size.height - y, Math.round(size.height * c.h)))
    };
  }

  const api = { ARENA_CHANNEL, HOME_SERVER, DEFAULT_CROP, ensureArenaChannel, retentionMs, sameRiotName, newDeaths, gameClock, cleanCrop, cropRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxArena = api;
})();
