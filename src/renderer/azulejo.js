// Tema Azulejo: mural que reage à voz, azulejo de cada pessoa e a troca animada do tema.
// Liga e desliga sozinho conforme <html data-theme>. As cores ficam em themes.js e o
// layout em azulejo.css. As funções puras também são módulo Node (testes).
(function () {
  const THEME_ID = 'azulejo';

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    return h >>> 0;
  };
  const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  /* ---------- Azulejo de cada pessoa (SVG gerado a partir do nome) ---------- */
  const INKS = [['#1b46b8', '#ffc531'], ['#0b1c55', '#ff7d72'], ['#1b46b8', '#4fe0a0'], ['#0b1c55', '#ffc531'],
    ['#1277c9', '#ffc531'], ['#1b46b8', '#ff7d72'], ['#0f6f7a', '#ffc531'], ['#0b1c55', '#4fe0a0']];
  function pieceSvg(name) {
    const r = rng(hash(name));
    for (let i = 0; i < 4; i++) r();
    const [a, b] = INKS[Math.floor(r() * INKS.length)];
    let out = '<rect width="100" height="100" fill="#f2f6ff"/>';
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const c = r() < 0.6 ? a : b;
        const kind = Math.floor(r() * 4);
        const rot = Math.floor(r() * 4) * 90;
        const shape = [
          `<path d="M0 0H50A50 50 0 0 1 0 50Z" fill="${c}"/>`,
          `<path d="M0 0H50V25H0Z" fill="${c}"/><path d="M0 50A25 25 0 0 1 50 50Z" fill="${c === a ? b : a}"/>`,
          `<rect width="50" height="50" fill="${c}"/><path d="M50 50H0A50 50 0 0 1 50 0Z" fill="#f2f6ff"/>`,
          `<path d="M0 0H25A25 25 0 0 1 0 25ZM50 50H25A25 25 0 0 1 50 25Z" fill="${c}"/>`
        ][kind];
        out += `<g transform="translate(${x * 50} ${y * 50}) rotate(${rot} 25 25)">${shape}</g>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${out}</svg>`;
  }
  const mix = (c1, c2, t) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1); const b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hash, rng, pieceSvg, mix };
    return;
  }

  const root = document.documentElement;
  const reduced = () => root.dataset.reduceMotion === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pieceUrl = (name) => 'url("data:image/svg+xml,' + encodeURIComponent(pieceSvg(name)) + '")';

  let pieceStyle = null;
  const pieces = new Set();
  function syncPieces() {
    document.querySelectorAll('.avatar[data-user]').forEach((el) => {
      const name = el.dataset.user;
      if (!name || pieces.has(name)) return;
      pieces.add(name);
      pieceStyle.sheet.insertRule(`.avatar[data-user="${CSS.escape(name)}"] { --az-peca: ${pieceUrl(name)}; }`);
    });
  }

  /* ---------- Mural: peças que giram e acendem com a voz ---------- */
  const CELL = 54;
  const BASES = ['#1b46b8', '#1b46b8', '#1a42ad', '#1d4bc2'];
  const SHAPES = ['#2a5ad6', '#153a9e', '#2351c8', '#17409f'];
  class Mural {
    constructor(host, inlay = 0) {
      this.host = host;
      this.inlay = inlay; // parte das peças que já nasce colorida
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'az-mural';
      this.canvas.setAttribute('aria-hidden', 'true');
      host.prepend(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.moving = new Set();
      this.raf = 0;
      this.ro = new ResizeObserver(() => this.build());
      this.ro.observe(host);
      this.build();
    }
    build() {
      const w = this.host.clientWidth; const h = this.host.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cols = Math.ceil(w / CELL); this.rows = Math.ceil(h / CELL);
      this.cells = [];
      this.moving.clear();
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const r = rng(hash(x + ':' + y)); r(); r();
          const turn = Math.floor(r() * 4);
          const cell = {
            x, y, kind: Math.floor(r() * 5), turn, angle: turn, lit: 0,
            base: BASES[Math.floor(r() * 4)], ink: SHAPES[Math.floor(r() * 4)], hot: r() < 0.3 ? '#ffc531' : '#f2f6ff'
          };
          if (r() < this.inlay) cell.ink = cell.hot;
          this.cells.push(cell);
          this.draw(cell);
        }
      }
    }
    draw(c) {
      const g = this.ctx; const s = CELL; const px = c.x * s; const py = c.y * s;
      g.save();
      g.beginPath(); g.rect(px, py, s, s); g.clip();
      const glow = Math.min(1, c.lit * 4); // cor cheia até quase apagar: a mistura lenta passava por cinza
      g.fillStyle = mix(c.base, '#12348f', glow * 0.6);
      g.fillRect(px, py, s, s);
      g.translate(px + s / 2, py + s / 2); g.rotate(c.angle * Math.PI / 2); g.translate(-s / 2, -s / 2);
      g.fillStyle = mix(c.ink, c.hot, glow);
      g.beginPath();
      if (c.kind === 0) { g.moveTo(0, 0); g.arc(0, 0, s, 0, Math.PI / 2); g.closePath(); }
      else if (c.kind === 1) g.rect(0, 0, s, s / 2);
      else if (c.kind === 2) {
        g.moveTo(0, 0); g.arc(0, 0, s / 2, 0, Math.PI / 2); g.closePath();
        g.moveTo(s, s); g.arc(s, s, s / 2, Math.PI, Math.PI * 1.5); g.closePath();
      } else if (c.kind === 3) { g.moveTo(0, s); g.arc(s / 2, s, s / 2, Math.PI, 0); g.closePath(); }
      else { g.moveTo(0, 0); g.lineTo(s, 0); g.arc(s, s, s, -Math.PI / 2, -Math.PI, true); g.closePath(); }
      g.fill();
      g.restore();
      g.strokeStyle = '#153893'; g.lineWidth = 1; // rejunte
      g.strokeRect(px + 0.5, py + 0.5, s, s);
    }
    excite(px, py, strength) {
      if (!this.cells || px < 0 || py < 0 || px >= this.cols * CELL) return;
      const cell = this.cells[Math.floor(py / CELL) * this.cols + Math.floor(px / CELL)];
      if (!cell) return;
      if (!reduced() && Math.abs(cell.turn - cell.angle) < 0.02) cell.turn += 1;
      cell.lit = Math.min(1, Math.max(cell.lit, 0.45 + strength * 0.9));
      this.moving.add(cell);
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.tick(t)); }
    }
    tick(t) {
      const dt = Math.max(0, Math.min(0.05, (t - this.last) / 1000)); this.last = t;
      for (const c of this.moving) {
        c.angle += (c.turn - c.angle) * (1 - Math.exp(-dt * 9));
        if (c.turn - c.angle < 0.004) c.angle = c.turn;
        c.lit = Math.max(0, c.lit - dt * 0.28);
        this.draw(c);
        if (c.lit === 0 && c.angle === c.turn) { c.turn %= 4; c.angle = c.turn; this.moving.delete(c); }
      }
      this.raf = this.moving.size ? requestAnimationFrame((n) => this.tick(n)) : 0;
    }
    destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.canvas.remove(); }
  }

  // Acende a parede em volta de quem fala.
  function listen() {
    if (document.hidden || !callMural) return;
    const area = callMural.host.getBoundingClientRect();
    for (const { name, level } of VoxVoiceLevels.read() || []) {
      const tile = VoxVoiceLevels.tileOf(name);
      if (!tile || !VoxVoiceLevels.markSpeaking(tile, level, 'az-falando')) continue;
      const r = tile.getBoundingClientRect();
      const cx = r.left - area.left + r.width / 2; const cy = r.top - area.top + r.height / 2;
      for (let i = Math.ceil(level * 5); i > 0; i--) {
        // Ponto fora da borda do tile, mais longe quanto mais alta a voz
        const a = Math.random() * Math.PI * 2;
        const edge = 1 / Math.max(Math.abs(Math.cos(a)) / (r.width / 2), Math.abs(Math.sin(a)) / (r.height / 2));
        const dist = edge + (0.2 + Math.random()) * (40 + level * 150);
        callMural.excite(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, level);
      }
    }
  }

  // No login, as peças giram sob o cursor.
  let stirred = -1;
  function stir(e) {
    const key = Math.floor(e.clientY / CELL) * 1000 + Math.floor(e.clientX / CELL);
    if (key === stirred || e.target.closest('.overlay-card')) return;
    stirred = key;
    authMural.excite(e.clientX, e.clientY, 0.4);
  }

  /* ---------- Ligar e desligar ---------- */
  let callMural = null; let authMural = null; let observer = null; let timer = 0;
  function turnOn() {
    pieceStyle = document.createElement('style');
    document.head.appendChild(pieceStyle);
    pieces.clear();
    syncPieces();
    callMural = new Mural(document.getElementById('call-area'));
    const auth = document.getElementById('auth-screen');
    authMural = new Mural(auth, 0.09);
    auth.addEventListener('pointermove', stir);
    observer = new MutationObserver(syncPieces);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-user'] });
    timer = setInterval(listen, 90);
  }
  function turnOff() {
    clearInterval(timer);
    observer.disconnect();
    authMural.host.removeEventListener('pointermove', stir);
    callMural.destroy(); authMural.destroy();
    callMural = authMural = null;
    pieceStyle.remove();
    document.querySelectorAll('.az-falando').forEach((el) => el.classList.remove('az-falando'));
  }
  function sync() {
    const on = root.dataset.theme === THEME_ID;
    if (on && !callMural) turnOn();
    else if (!on && callMural) turnOff();
  }

  // Troca de tema: azulejos cobrem a janela a partir da miniatura, o tema muda por baixo e
  // eles saem. Com vídeo ou música na tela a troca é direta: nada pode cobrir os vídeos nem
  // o player do YouTube.
  const coversVideo = () => !!document.querySelector('#video-grid video, .music-tile:not(.hidden), #fullscreen-view:not(.hidden)');
  let swapping = false;
  function transition(toId, el, change) {
    const from = root.dataset.theme;
    const involved = toId !== from && (toId === THEME_ID || from === THEME_ID);
    if (swapping) return;
    if (!involved || coversVideo() || document.hidden || reduced()) { change(); return; }
    swapping = true;
    const b = el.getBoundingClientRect();
    const ox = b.left + b.width / 2; const oy = b.top + b.height / 2;
    const canvas = document.createElement('canvas');
    canvas.id = 'az-troca';
    const W = innerWidth; const H = innerHeight; const S = 92;
    canvas.width = W; canvas.height = H;
    document.body.appendChild(canvas);
    const g = canvas.getContext('2d');
    const cells = [];
    const far = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy)) + S;
    for (let y = 0; y * S < H; y++) {
      for (let x = 0; x * S < W; x++) {
        const r = rng(hash('t' + x + ':' + y)); r(); r();
        const k = r();
        cells.push({
          x: x * S, y: y * S, d: Math.hypot(x * S + S / 2 - ox, y * S + S / 2 - oy) / far, turn: Math.floor(r() * 4),
          bg: k < 0.6 ? '#1b46b8' : k < 0.85 ? '#0b1c55' : '#15389c',
          ink: r() < 0.22 ? '#ffc531' : r() < 0.5 ? '#f2f6ff' : '#2a5ad6'
        });
      }
    }
    const IN = 520; const OUT = 520; const SPREAD = 0.6;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const start = performance.now();
    let done = false;
    const frame = (now) => {
      const t = Math.max(0, now - start);
      const leaving = t > IN;
      const cut = coversVideo(); // vídeo ou música apareceu no meio: corta a animação
      if ((leaving || cut) && !done) { done = true; change(); }
      const p = leaving ? (t - IN) / OUT : t / IN;
      g.clearRect(0, 0, W, H);
      for (const c of cells) {
        const local = Math.min(1, Math.max(0, (p - c.d * SPREAD) / (1 - SPREAD)));
        const s = leaving ? 1 - ease(local) : ease(local);
        if (s <= 0) continue;
        const size = S * s + (s > 0.995 ? 1 : 0);
        g.save();
        g.translate(c.x + S / 2, c.y + S / 2);
        g.rotate((1 - s) * (leaving ? 0.6 : -0.6));
        g.fillStyle = c.bg; g.fillRect(-size / 2, -size / 2, size, size);
        g.rotate(c.turn * Math.PI / 2);
        g.fillStyle = c.ink; g.beginPath(); g.moveTo(-size / 2, -size / 2);
        g.arc(-size / 2, -size / 2, size, 0, Math.PI / 2); g.closePath(); g.fill();
        g.restore();
      }
      if (cut || (leaving && p >= 1)) { canvas.remove(); swapping = false; return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  sync();
  window.VoxAzulejo = { transition };
})();
