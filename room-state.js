// Estado de cada usuário numa sala (mudo, status, compartilhando tela) e o
// que dele é enviado aos outros clientes.
const { isTextChannel } = require('./channels');
const ALLOWED_STATUS = ['online', 'busy', 'away', 'invisible'];

function publicUser(id, entry) {
  return {
    id,
    username: entry.username,
    muted: !!entry.muted,
    status: entry.status || 'online',
    sharing: !!entry.sharing
  };
}

function applyStatePatch(entry, patch) {
  if (!patch) return;
  if (typeof patch.muted === 'boolean') entry.muted = patch.muted;
  if (typeof patch.sharing === 'boolean') entry.sharing = patch.sharing;
  if (typeof patch.status === 'string' && ALLOWED_STATUS.includes(patch.status)) entry.status = patch.status;
}

// Remove o socket de qualquer sala de voz em que esteja; apaga a sala se
// ficar vazia. Devolve a sala de onde saiu (ou null).
function leaveVoiceRoom(roomUsers, socketId) {
  let left = null;
  for (const [room, map] of roomUsers) {
    if (map.has(socketId)) {
      map.delete(socketId);
      if (map.size === 0) roomUsers.delete(room);
      left = room;
    }
  }
  return left;
}

// Entra numa sala de voz (saindo antes da anterior). Devolve a sala anterior.
function joinVoiceRoom(roomUsers, socketId, room, entry) {
  const previous = leaveVoiceRoom(roomUsers, socketId);
  if (!roomUsers.has(room)) roomUsers.set(room, new Map());
  roomUsers.get(room).set(socketId, { ...entry, sharing: false });
  return previous;
}

// O socket só usa o canal de texto em que está de fato.
function canUseTextRoom(textRoom, room) {
  return isTextChannel(room) && room === textRoom;
}

module.exports = {
  publicUser, applyStatePatch, ALLOWED_STATUS,
  leaveVoiceRoom, joinVoiceRoom, canUseTextRoom
};
