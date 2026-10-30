// Estado de cada usuário numa sala (mudo, status, compartilhando tela) e o
// que dele é enviado aos outros clientes.
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

module.exports = { publicUser, applyStatePatch, ALLOWED_STATUS };
