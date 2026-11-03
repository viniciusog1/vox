// Regras puras do chat: texto, menções, editar/apagar e imagens anexadas.
// Usado por main.js e renderer.js. Também roda no Node (testes).
(function () {
  const MAX_TEXT = 2000;
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // depois da compressão no cliente
  const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const UPLOAD_NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

  // Texto limpo ou '' (vazio é aceito quando há imagem); null quando inválido.
  function cleanText(text) {
    if (text === undefined || text === null) return '';
    if (typeof text !== 'string') return null;
    const t = text.trim();
    return t.length > MAX_TEXT ? null : t;
  }

  function imageExtension(mime) {
    return IMAGE_TYPES[mime] || null;
  }

  function isUploadName(name) {
    return typeof name === 'string' && UPLOAD_NAME_RE.test(name);
  }

  // Dá id às mensagens antigas (gravadas antes de existir editar/apagar).
  function ensureIds(messagesByRoom, genId) {
    let changed = false;
    for (const room of Object.keys(messagesByRoom)) {
      for (const m of messagesByRoom[room]) {
        if (!m.id) { m.id = genId(); changed = true; }
      }
    }
    return changed;
  }

  // Edita o texto de uma mensagem da própria pessoa. Devolve a mensagem ou null.
  function editMessage(list, id, username, text, nowIso) {
    const msg = (list || []).find((m) => m.id === id);
    if (!msg || msg.user !== username) return null;
    const t = cleanText(text);
    if (t === null || (!t && !msg.image)) return null;
    msg.text = t;
    msg.edited_at = nowIso;
    return msg;
  }

  // Tira uma mensagem da própria pessoa da lista. Devolve a removida ou null.
  function deleteMessage(list, id, username) {
    const i = (list || []).findIndex((m) => m.id === id);
    if (i < 0 || list[i].user !== username) return null;
    return list.splice(i, 1)[0];
  }

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Divide o texto em pedaços comuns e menções (@nome de alguém do servidor).
  // Nomes mais longos primeiro, para "@ana" não engolir "@anabela".
  function splitMentions(text, usernames) {
    const names = [...new Set(usernames || [])].filter(Boolean).sort((a, b) => b.length - a.length);
    if (!text || !names.length) return text ? [{ text }] : [];
    const re = new RegExp(`(^|[^\\w@])@(${names.map(escapeRe).join('|')})(?![\\w])`, 'giu');
    const parts = [];
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      const start = m.index + m[1].length;
      if (start > last) parts.push({ text: text.slice(last, start) });
      const name = names.find((n) => n.toLowerCase() === m[2].toLowerCase());
      parts.push({ text: '@' + m[2], mention: name });
      last = start + 1 + m[2].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  }

  function mentionsOf(text, usernames) {
    return [...new Set(splitMentions(text, usernames).filter((p) => p.mention).map((p) => p.mention))];
  }

  // Contadores de não lidas por canal: { room: { count, mention } }.
  function addUnread(unread, room, mention) {
    const cur = unread[room] || { count: 0, mention: false };
    return { ...unread, [room]: { count: cur.count + 1, mention: cur.mention || !!mention } };
  }

  function clearUnread(unread, room) {
    if (!unread[room]) return unread;
    const next = { ...unread };
    delete next[room];
    return next;
  }

  // Quando avisar no sistema: ocupado não recebe nada; "mentions" só menções;
  // "all" tudo, mas só com a janela sem foco ou em outro canal.
  function shouldNotify({ mode, status, mention, focused, sameRoom }) {
    if (mode === 'off' || status === 'busy') return false;
    if (mention) return !(focused && sameRoom);
    if (mode !== 'all') return false;
    return !(focused && sameRoom);
  }

  const api = {
    MAX_TEXT, MAX_IMAGE_BYTES, IMAGE_TYPES,
    cleanText, imageExtension, isUploadName, ensureIds, editMessage, deleteMessage,
    splitMentions, mentionsOf, addUnread, clearUnread, shouldNotify
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxChat = api;
})();
