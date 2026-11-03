// Túnel do Cloudflare (trycloudflare.com) aberto pelo próprio Vox no PC do host.
// O cloudflared.exe é baixado do GitHub oficial da Cloudflare na primeira vez.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DOWNLOAD_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
// api.trycloudflare.com é o serviço que cria o túnel, não o endereço público.
const URL_RE = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i;
const RESTART_DELAY_MS = 3000;

// Endereço público numa linha do log do cloudflared, ou null.
function parseTunnelUrl(line) {
  const m = URL_RE.exec(String(line || ''));
  return m ? m[0].toLowerCase() : null;
}

function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Vox' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume();
        return resolve(download(res.headers.location, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const total = Number(res.headers['content-length']) || 0;
      let got = 0;
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      res.on('data', (chunk) => { got += chunk.length; if (total) onProgress(got / total); });
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); resolve(); }));
      out.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Estado: { state: 'off' | 'downloading' | 'starting' | 'on' | 'error', url, progress, message }
function createTunnel({ binDirs, downloadDir, port = 3000, onStatus = () => {} }) {
  let proc = null;
  let wanted = false;
  let restartTimer = null;
  let status = { state: 'off', url: null };

  const set = (s) => { status = s; onStatus(status); };

  function findBinary() {
    for (const dir of binDirs) {
      const p = path.join(dir, 'cloudflared.exe');
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  async function ensureBinary() {
    const found = findBinary();
    if (found) return found;
    fs.mkdirSync(downloadDir, { recursive: true });
    const dest = path.join(downloadDir, 'cloudflared.exe');
    set({ state: 'downloading', url: null, progress: 0 });
    await download(DOWNLOAD_URL, dest, (p) => set({ state: 'downloading', url: null, progress: p }));
    return dest;
  }

  function launch(bin) {
    set({ state: 'starting', url: null });
    // 127.0.0.1 e não localhost: o cloudflared tenta [::1] primeiro, onde o Vox não escuta.
    proc = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { windowsHide: true });
    const onData = (buf) => {
      const url = parseTunnelUrl(buf.toString());
      if (url && proc) set({ state: 'on', url });
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', (e) => { proc = null; set({ state: 'error', url: null, message: e.message }); });
    proc.on('exit', () => {
      proc = null;
      if (!wanted) return set({ state: 'off', url: null });
      // Caiu sozinho: reabre (o endereço muda).
      set({ state: 'starting', url: null, message: 'O túnel caiu; reabrindo com um endereço novo…' });
      restartTimer = setTimeout(() => { if (wanted) launch(bin); }, RESTART_DELAY_MS);
    });
  }

  return {
    status: () => status,
    async start() {
      if (wanted) return status;
      wanted = true;
      try {
        const bin = await ensureBinary();
        if (wanted) launch(bin);
      } catch (e) {
        wanted = false;
        set({ state: 'error', url: null, message: 'Não foi possível baixar o cloudflared: ' + e.message });
      }
      return status;
    },
    stop() {
      wanted = false;
      clearTimeout(restartTimer);
      if (proc) { try { proc.kill(); } catch (e) {} } else set({ state: 'off', url: null });
    }
  };
}

module.exports = { parseTunnelUrl, createTunnel, DOWNLOAD_URL };
