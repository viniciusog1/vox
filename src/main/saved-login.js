// Login mantido entre uma abertura e outra do app: guarda o código da sessão (o mesmo da
// reconexão) cifrado, um por servidor, para nunca mandar o código de um servidor a outro.
const fs = require('fs');

const MAX_KEY = 500;
const validKey = (key) => typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY && key !== '__proto__';
const validLogin = (l) => !!l && typeof l.username === 'string' && l.username.length > 0 && l.username.length <= 64 &&
  typeof l.token === 'string' && /^[0-9a-f]{64}$/.test(l.token);

// encrypt(texto) → base64 e decrypt(base64) → texto; podem lançar erro (sem cofre, outro PC).
function createSavedLogin({ file, encrypt, decrypt }) {
  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (e) {
      return {};
    }
  }

  // Grava em outro arquivo e troca: desligar o PC no meio não estraga o que já estava salvo.
  function write(data) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }

  return {
    get(server) {
      if (!validKey(server)) return null;
      const data = read();
      const entry = Object.hasOwn(data, server) ? data[server] : null;
      try {
        const login = { username: entry.username, token: decrypt(entry.data) };
        return validLogin(login) ? login : null;
      } catch (e) {
        return null;
      }
    },
    set(server, login) {
      if (!validKey(server) || !validLogin(login)) return false;
      try {
        write({ ...read(), [server]: { username: login.username, data: encrypt(login.token) } });
        return true;
      } catch (e) {
        return false;
      }
    },
    clear(server) {
      const data = read();
      if (!validKey(server) || !Object.hasOwn(data, server)) return;
      delete data[server];
      try { write(data); } catch (e) {}
    }
  };
}

module.exports = { createSavedLogin };
