// Gera assets/icon.png (256 px) e build/icon.ico (16 a 256 px) a partir de assets/icon.svg
// (32 px para cima) e assets/icon-small.svg (até 24 px, desenho simplificado).
// Uso: npx electron scripts/gerar-icone.js
// O SVG é desenhado num canvas de uma janela escondida do próprio Electron.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const SMALL_MAX = 24;

// Entrada de ícone em BMP 32 bits (BGRA, de baixo para cima) + máscara AND vazia.
// BMP em vez de PNG dentro do .ico: o NSIS e o rcedit aceitam sem surpresas.
function dibEntry(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // altura dobrada: cor + máscara
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4, 20);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = ((size - 1 - y) * size + x) * 4;
      const dst = (y * size + x) * 4;
      pixels[dst] = rgba[src + 2];
      pixels[dst + 1] = rgba[src + 1];
      pixels[dst + 2] = rgba[src];
      pixels[dst + 3] = rgba[src + 3];
    }
  }
  const maskRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)]);
}

function buildIco(images) {
  const dir = Buffer.alloc(6 + 16 * images.length);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(images.length, 4);
  let offset = dir.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    dir.writeUInt8(size >= 256 ? 0 : size, e);
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1);
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(data.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([dir, ...images.map((im) => im.data)]);
}

app.whenReady().then(async () => {
  const b64 = (name) => fs.readFileSync(path.join(ROOT, 'assets', name)).toString('base64');
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<!doctype html><body></body>');
  const result = await win.webContents.executeJavaScript(`(async () => {
    const load = async (data) => { const img = new Image(); img.src = 'data:image/svg+xml;base64,' + data; await img.decode(); return img; };
    const big = await load('${b64('icon.svg')}');
    const small = await load('${b64('icon-small.svg')}');
    const out = {};
    for (const size of ${JSON.stringify(SIZES)}) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(size <= ${SMALL_MAX} ? small : big, 0, 0, size, size);
      out[size] = { rgba: Array.from(g.getImageData(0, 0, size, size).data), png: c.toDataURL('image/png') };
    }
    return out;
  })()`);

  const images = SIZES.map((size) => ({ size, data: dibEntry(size, Buffer.from(result[size].rgba)) }));
  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build', 'icon.ico'), buildIco(images));
  fs.writeFileSync(path.join(ROOT, 'assets', 'icon.png'), Buffer.from(result[256].png.split(',')[1], 'base64'));
  console.log('Gerados: build/icon.ico (' + SIZES.join(', ') + ' px) e assets/icon.png (256 px)');
  app.quit();
});
