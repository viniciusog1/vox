// Soundboard por servidor: biblioteca de sons enviados pelos membros e regras de
// tocar. Funções puras sobre o objeto gravado em soundboard.json; main.js grava
// os arquivos e difunde. Também roda no Node (testes).
(function () {
  const MAX_SOUNDS = 40;              // por servidor
  const MAX_BYTES = 1024 * 1024;      // 1 MB por arquivo
  const MAX_SECONDS = 8;
  const MAX_NAME = 24;
  const COOLDOWN_MS = 1500;           // por pessoa, para ninguém metralhar a sala
  const AUDIO_TYPES = { 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm' };
  const FILE_RE = /^[0-9a-f-]{36}\.(mp3|ogg|wav|webm)$/;

  const fail = (error) => ({ ok: false, error });

  function emptyDb() {
    return {};
  }

  function cleanName(name) {
    if (typeof name !== 'string') return null;
    const n = name.trim().replace(/\s+/g, ' ');
    return n && n.length <= MAX_NAME ? n : null;
  }

  const audioExtension = (mime) => AUDIO_TYPES[mime] || null;
  const isSoundFile = (name) => typeof name === 'string' && FILE_RE.test(name);

  function soundsOf(db, serverId) {
    return (db[serverId] || []).slice();
  }

  // sound: { id, name, file, by, at, duration }
  function addSound(db, serverId, { id, name, file, by, at, duration, bytes }) {
    const list = db[serverId] || [];
    if (list.length >= MAX_SOUNDS) return fail(`O soundboard deste servidor já tem ${MAX_SOUNDS} sons; apague algum.`);
    const n = cleanName(name);
    if (!n) return fail(`Dê um nome de 1 a ${MAX_NAME} caracteres ao som.`);
    if (!(bytes > 0) || bytes > MAX_BYTES) return fail('O arquivo precisa ter até 1 MB.');
    const secs = Number(duration);
    if (!(secs > 0) || secs > MAX_SECONDS + 0.25) return fail(`O som precisa ter até ${MAX_SECONDS} segundos.`);
    const sound = { id, name: n, file, by, at, duration: Math.round(secs * 10) / 10 };
    db[serverId] = [...list, sound];
    return { ok: true, sound };
  }

  // Quem enviou apaga o seu; dono e administradores apagam qualquer um.
  function deleteSound(db, serverId, soundId, user, isManager) {
    const list = db[serverId] || [];
    const sound = list.find((s) => s.id === soundId);
    if (!sound) return fail('Som não encontrado.');
    if (sound.by !== user && !isManager) return fail('Só quem enviou ou a gerência do servidor apaga este som.');
    db[serverId] = list.filter((s) => s.id !== soundId);
    return { ok: true, sound };
  }

  function dropServer(db, serverId) {
    const list = db[serverId] || [];
    delete db[serverId];
    return list;
  }

  // Pode tocar de novo? lastAt: último toque da pessoa (ms) ou undefined.
  function canPlay(lastAt, now) {
    return !lastAt || now - lastAt >= COOLDOWN_MS;
  }

  const api = {
    MAX_SOUNDS, MAX_BYTES, MAX_SECONDS, MAX_NAME, COOLDOWN_MS, AUDIO_TYPES,
    emptyDb, cleanName, audioExtension, isSoundFile, soundsOf, addSound, deleteSound, dropServer, canPlay
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxSoundboard = api;
})();
