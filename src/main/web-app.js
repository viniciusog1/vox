// Versão web do Vox: o próprio servidor do host entrega a interface ao navegador.
// Quem abre o endereço do host (ou do túnel) no navegador ou no celular usa o Vox sem instalar nada.
// Os caminhos espelham os relativos do index.html: "../shared/x.js" → /shared/x.js e
// "../../assets/icon.svg" → /assets/icon.svg.
const fs = require('fs');
const path = require('path');

const TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  ico: 'image/x-icon'
};

// Só estes arquivos saem das pastas: nada de dados, ferramentas ou código do processo principal.
function webRoots(rootDir) {
  return [
    { prefix: '/shared/', dir: path.join(rootDir, 'src', 'shared'), exts: ['js'] },
    { prefix: '/assets/', dir: path.join(rootDir, 'assets'), exts: ['svg', 'png'] },
    { prefix: '/', dir: path.join(rootDir, 'src', 'renderer'), exts: ['html', 'js', 'css', 'webmanifest', 'svg', 'png'] }
  ];
}

// Caminho do arquivo para a URL pedida, ou null. Recusa "..", pontos no começo e extensões fora da lista.
function resolveWebFile(url, roots) {
  let pathname;
  try { pathname = decodeURIComponent(String(url || '').split(/[?#]/)[0]); } catch (e) { return null; }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0')) return null;
  const root = roots.find((r) => pathname.startsWith(r.prefix));
  if (!root) return null;
  const rel = pathname.slice(root.prefix.length);
  const parts = rel.split('/');
  if (!rel || parts.some((p) => !p || p.startsWith('.'))) return null;
  const ext = path.extname(rel).slice(1).toLowerCase();
  if (!root.exts.includes(ext)) return null;
  const file = path.join(root.dir, ...parts);
  if (!file.startsWith(root.dir + path.sep)) return null;
  return { file, type: TYPES[ext] };
}

function createWebApp(rootDir) {
  const roots = webRoots(rootDir);
  return function serveWebApp(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const found = resolveWebFile(req.url, roots);
    if (!found) return false;
    fs.readFile(found.file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, {
        'Content-Type': found.type,
        // Sem cache: depois de atualizar o host, o navegador já pega a interface nova.
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
    return true;
  };
}

module.exports = { createWebApp, resolveWebFile, webRoots };
