const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSavedLogin } = require('../src/main/saved-login.js');

const TOKEN = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const HOST = 'http://127.0.0.1:3000';
const encrypt = (t) => Buffer.from('cifrado:' + [...t].reverse().join('')).toString('base64');
const decrypt = (b) => {
  const s = Buffer.from(b, 'base64').toString();
  if (!s.startsWith('cifrado:')) throw new Error('não é deste PC');
  return [...s.slice(8)].reverse().join('');
};
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vox-sessao-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'sessao.json');
}

test('guarda cifrado e devolve depois de reabrir', (t) => {
  const file = temp(t);
  const saved = createSavedLogin({ file, encrypt, decrypt });
  assert.equal(saved.get(HOST), null);
  assert.equal(saved.set(HOST, { username: 'ana', token: TOKEN }), true);
  assert.ok(!fs.readFileSync(file, 'utf8').includes(TOKEN));
  assert.deepEqual(createSavedLogin({ file, encrypt, decrypt }).get(HOST), { username: 'ana', token: TOKEN });
});

test('cada servidor tem o próprio login: o código de um nunca vai para outro', (t) => {
  const saved = createSavedLogin({ file: temp(t), encrypt, decrypt });
  saved.set(HOST, { username: 'ana', token: TOKEN });
  assert.equal(saved.get('http://outro:3000'), null);
  saved.set('http://outro:3000', { username: 'bia', token: OTHER });
  saved.clear(HOST);
  assert.equal(saved.get(HOST), null);
  assert.equal(saved.get('http://outro:3000').token, OTHER);
});

test('entrada inválida, arquivo estragado ou de outro PC não quebra nada', (t) => {
  const file = temp(t);
  const saved = createSavedLogin({ file, encrypt, decrypt });
  for (const bad of [null, {}, { username: 'ana' }, { username: 'ana', token: 'curto' }, { username: 5, token: TOKEN }]) {
    assert.equal(saved.set(HOST, bad), false);
  }
  for (const key of ['', null, '__proto__', 'x'.repeat(600)]) assert.equal(saved.set(key, { username: 'ana', token: TOKEN }), false);
  assert.equal(fs.existsSync(file), false);
  fs.writeFileSync(file, '{lixo');
  assert.equal(saved.get(HOST), null);
  fs.writeFileSync(file, JSON.stringify({ [HOST]: { username: 'ana', data: 'b3V0cm8=' } }));
  assert.equal(saved.get(HOST), null);
  saved.clear('http://nunca-salvo:1');
});

test('sem como cifrar, não guarda', (t) => {
  const file = temp(t);
  const saved = createSavedLogin({ file, encrypt: () => { throw new Error('sem cofre'); }, decrypt });
  assert.equal(saved.set(HOST, { username: 'ana', token: TOKEN }), false);
  assert.equal(fs.existsSync(file), false);
});

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', 'src', ...p), 'utf8').replace(/\r\n/g, '\n');

test('o app guarda ao entrar, esquece ao sair da conta e só apaga se a sessão venceu', () => {
  const js = read('renderer', 'renderer.js');
  const fn = (name) => js.match(new RegExp(`\\n(?:async )?function ${name}\\([\\s\\S]*?\\n}\\n`))[0];
  assert.match(fn('enterApp'), /savedLoginSet\(SERVER_INPUT/);
  assert.match(fn('logout'), /forgetLogin\(\)/);
  assert.match(fn('forgetLogin'), /savedLoginClear\(SERVER_INPUT\)/);
  assert.match(fn('resumeSession'), /if \(sessionExpired\(res\)\) forgetLogin\(\)/);
  assert.match(fn('restoreLogin'), /if \(sessionExpired\(res\)\)/);
  assert.doesNotMatch(fn('restoreLogin'), /emit\('logout'/);
});

test('a senha nunca é guardada', () => {
  assert.doesNotMatch(read('main', 'saved-login.js'), /password|senha\s*[:=]/i);
});
