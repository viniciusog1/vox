const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { resolveWebFile, webRoots } = require('../src/main/web-app.js');

const ROOT = path.join(__dirname, '..');
const roots = webRoots(ROOT);
const rel = (url) => {
  const f = resolveWebFile(url, roots);
  return f && path.relative(ROOT, f.file).split(path.sep).join('/');
};

test('entrega a interface, os módulos compartilhados e os ícones', () => {
  assert.equal(rel('/'), 'src/renderer/index.html');
  assert.equal(rel('/index.html?x=1'), 'src/renderer/index.html');
  assert.equal(rel('/renderer.js'), 'src/renderer/renderer.js');
  assert.equal(rel('/vendor/socket.io.min.js'), 'src/renderer/vendor/socket.io.min.js');
  assert.equal(rel('/shared/protocol.js'), 'src/shared/protocol.js');
  assert.equal(rel('/assets/icon.svg'), 'assets/icon.svg');
  assert.equal(rel('/manifest.webmanifest'), 'src/renderer/manifest.webmanifest');
  assert.equal(resolveWebFile('/mobile.css', roots).type, 'text/css; charset=utf-8');
});

test('recusa sair das pastas, arquivos ocultos e extensões fora da lista', () => {
  for (const url of [
    '/../users.json', '/%2e%2e/users.json', '/shared/../../users.json', '/..%2fmain%2fmain.js',
    '/shared/..%2f..%2fpackage.json', '/assets/tray.ico', '/users.json', '/.env', '/vendor/.hidden.js',
    '/shared/', '/a\\..\\b.js', '/%E0%A4%A', '/assets//icon.svg'
  ]) assert.equal(resolveWebFile(url, roots), null, url);
});

test('index.html só referencia arquivos que o servidor web entrega', () => {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css|svg|png|webmanifest))"/g)].map((m) => m[1]);
  assert.ok(refs.length > 10);
  for (const ref of refs) {
    const url = new URL(ref, 'http://host/index.html').pathname;
    const found = resolveWebFile(url, roots);
    assert.ok(found, `não servido: ${ref}`);
    assert.ok(fs.existsSync(found.file), `não existe: ${ref}`);
  }
});

test('web-shim.js carrega antes de themes.js e de qualquer script do app', () => {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(scripts[0], 'web-shim.js');
});
