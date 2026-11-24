// Tema Rádio: visor com as salas de voz como estações (clicar ou arrastar o ponteiro troca de
// sala), alto-falantes que vibram com a voz e o olho mágico (indicador de sinal).
// Liga e desliga sozinho conforme <html data-theme>. As cores ficam em themes.js e o
// layout em radio.css. As funções puras também são módulo Node (testes).
(function () {
  const THEME_ID = 'radio';
  const DRAG_START_PX = 6;
  const STATION_X = 20; // risco da estação, a partir da borda dela (radio.css)

  // Estação mais perto de x. centers: posições dos centros, em ordem.
  function nearest(centers, x) {
    let best = -1;
    for (let i = 0; i < centers.length; i++) {
      if (best < 0 || Math.abs(centers[i] - x) < Math.abs(centers[best] - x)) best = i;
    }
    return best;
  }

  // Abertura da sombra do olho mágico em graus: muita no silêncio, quase nada com voz alta.
  function eyeShadow(level) {
    const v = Math.max(0, Math.min(1, Number(level) || 0));
    return 100 - 94 * Math.sqrt(v);
  }

  // Sobe rápido e desce devagar, como a fluorescência da válvula.
  function follow(current, target) {
    const next = current + (target - current) * (target > current ? 0.65 : 0.18);
    return Math.abs(next - target) < 0.004 ? target : next;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { nearest, eyeShadow, follow };
    return;
  }

  const root = document.documentElement;
  const reduced = () => root.dataset.reduceMotion === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  /* ---------- Olho mágico ---------- */
  class MagicEye {
    constructor(canvas) {
      this.canvas = canvas; this.level = 0; this.shown = -1;
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.size = 64;
      canvas.width = canvas.height = this.size * dpr;
      this.ctx = canvas.getContext('2d');
      this.ctx.scale(dpr, dpr);
      this.draw();
    }
    set(target) {
      this.level = follow(this.level, target);
      if (Math.abs(this.level - this.shown) > 0.003) this.draw();
    }
    draw() {
      this.shown = this.level;
      const g = this.ctx; const s = this.size; const c = s / 2;
      g.clearRect(0, 0, s, s);
      g.fillStyle = '#0d0704'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
      g.fillStyle = '#4fce6a'; g.beginPath(); g.arc(c, c, c - 5, 0, 7); g.fill();
      const half = (eyeShadow(this.level) / 2) * Math.PI / 180;
      g.fillStyle = '#12351c'; g.beginPath(); g.moveTo(c, c); g.arc(c, c, c - 5, Math.PI / 2 - half, Math.PI / 2 + half); g.closePath(); g.fill();
      g.fillStyle = '#0d0704'; g.beginPath(); g.arc(c, c, 10, 0, 7); g.fill();
    }
  }

  /* ---------- Visor ---------- */
  class Dial {
    constructor(app) {
      this.stations = [];
      this.node = el('div'); this.node.id = 'rd-dial';
      this.glass = el('div', 'rd-glass');
      this.track = el('div', 'rd-track');
      this.track.setAttribute('role', 'group');
      this.track.setAttribute('aria-label', 'Salas de voz');
      this.needle = el('div', 'rd-needle');
      this.needle.setAttribute('aria-hidden', 'true');
      this.note = el('div', 'rd-note');
      this.eye = el('canvas', 'rd-eye');
      this.eye.setAttribute('aria-hidden', 'true');
      this.eye.title = 'Olho mágico: fecha conforme a voz';
      this.glass.append(this.track, this.note);
      this.node.append(this.glass, this.eye);
      app.appendChild(this.node);
      this.magic = new MagicEye(this.eye);
      this.drag = null;
      this.track.addEventListener('pointerdown', (e) => this.down(e));
      this.track.addEventListener('pointermove', (e) => this.move(e));
      this.track.addEventListener('pointerup', (e) => this.up(e));
      this.track.addEventListener('pointercancel', () => this.cancel());
      this.track.addEventListener('keydown', (e) => this.key(e));
      this.ro = new ResizeObserver(() => this.point());
      this.ro.observe(this.track);
    }

    // Estações do servidor aberto, na ordem dos canais. A primeira é "Desligado".
    data() {
      let server = null; let room = ''; let rooms = {}; let name = '';
      try {
        server = serverById(currentServerId); room = currentVoiceRoom; rooms = voiceRooms;
        name = room ? roomDisplayName(room) : '';
      } catch (e) { return null; }
      const list = [{ room: '', name: 'Desligado', people: 0 }];
      if (server) {
        server.channels.filter((c) => c.type === 'voice')
          .forEach((c) => list.push({ room: c.id, name: c.name, people: (rooms[c.id] || []).length }));
      }
      const here = list.some((s) => s.room === room);
      if (room && !here) list.push({ room, name, people: (rooms[room] || []).length });
      return { list, room, empty: list.length === 1 };
    }

    render() {
      const d = this.data();
      if (!d || this.drag) return;
      this.node.classList.toggle('on', !!d.room);
      this.note.textContent = d.empty ? 'Abra um servidor para ver as salas de voz' : '';
      const sign = JSON.stringify(d);
      if (sign === this.sign) return;
      this.sign = sign;
      const moved = d.room !== this.room;
      const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.rdRoom : undefined;
      this.stations = d.list;
      this.room = d.room;
      this.track.textContent = '';
      for (const s of d.empty ? [] : d.list) {
        const b = el('button', 'rd-station');
        b.type = 'button';
        b.dataset.rdRoom = s.room;
        b.classList.toggle('active', s.room === d.room);
        b.setAttribute('aria-pressed', String(s.room === d.room));
        b.append(el('span', 'rd-name', s.name));
        const lamps = el('span', 'rd-lamps');
        for (let i = 0; i < Math.min(s.people, 8); i++) lamps.append(el('i'));
        b.append(lamps);
        b.title = !s.room ? 'Sair da voz' : s.people === 1 ? '1 pessoa na sala' : `${s.people} pessoas na sala`;
        b.addEventListener('click', () => { if (!this.suppressClick) this.tune(s.room); });
        this.track.append(b);
        if (focused === s.room) b.focus();
      }
      this.track.append(this.needle);
      this.needle.hidden = d.empty;
      this.point();
      // Com muitas salas o visor rola por dentro: traz a estação atual para a vista
      const now = this.track.querySelector('.rd-station.active');
      if (moved && now) this.track.scrollLeft = now.offsetLeft - this.track.clientWidth / 3;
    }

    buttons() { return [...this.track.querySelectorAll('.rd-station')]; }
    centers() { return this.buttons().map((b) => b.offsetLeft + STATION_X); }
    point() {
      const i = this.stations.findIndex((s) => s.room === this.room);
      const c = this.centers()[i];
      if (c !== undefined) this.needle.style.transform = `translateX(${c}px)`;
    }

    tune(room) {
      try {
        if (room === currentVoiceRoom) { this.point(); return; }
        if (room) joinVoice(room); else leaveVoice();
      } catch (e) {
        console.error('Erro ao sintonizar a sala:', e);
      }
      this.render();
    }

    /* Arrastar o ponteiro: só troca de sala ao soltar. */
    down(e) {
      if (e.button !== 0 || !this.stations.length) return;
      this.suppressClick = false;
      this.drag = { id: e.pointerId, x: e.clientX, live: false };
    }
    move(e) {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.live) {
        if (Math.abs(e.clientX - d.x) < DRAG_START_PX) return;
        d.live = true;
        this.track.setPointerCapture(d.id);
        this.node.classList.add('tuning');
      }
      const r = this.track.getBoundingClientRect();
      const cs = this.centers();
      const x = Math.max(cs[0], Math.min(cs[cs.length - 1], e.clientX - r.left + this.track.scrollLeft));
      this.needle.style.transform = `translateX(${x}px)`;
      d.to = nearest(cs, x);
      this.buttons().forEach((b, i) => b.classList.toggle('near', i === d.to));
    }
    up(e) {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      if (!d.live) return;
      this.suppressClick = true;
      setTimeout(() => { this.suppressClick = false; }, 0);
      this.endDrag();
      if (this.stations[d.to]) this.tune(this.stations[d.to].room);
    }
    cancel() { this.drag = null; this.endDrag(); this.point(); }
    endDrag() {
      this.node.classList.remove('tuning');
      this.buttons().forEach((b) => b.classList.remove('near'));
    }
    // Setas andam entre as estações; Enter ou espaço sintoniza (botão).
    key(e) {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const b = this.buttons();
      const next = b[b.indexOf(document.activeElement) + step];
      if (next) { e.preventDefault(); next.focus(); }
    }
    destroy() { this.ro.disconnect(); this.node.remove(); }
  }

  /* ---------- Login: o rádio esquenta conforme os campos são preenchidos ---------- */
  let front = null;
  function warm() {
    if (!front) return;
    const pane = document.querySelector('.tab-pane.active');
    const inputs = pane ? [...pane.querySelectorAll('input')] : [];
    const filled = inputs.filter((i) => i.value).length;
    const level = inputs.length ? filled / inputs.length : 0;
    front.node.style.setProperty('--rd-calor', String(level));
    clearInterval(front.timer);
    front.timer = setInterval(() => {
      front.magic.set(level);
      if (front.magic.level === level) clearInterval(front.timer);
    }, 60);
  }
  function buildFront(auth) {
    const node = el('div', 'rd-front');
    node.setAttribute('aria-hidden', 'true');
    const glass = el('div', 'rd-front-glass');
    glass.append(el('i', 'rd-front-needle'));
    const eye = el('canvas', 'rd-eye');
    glass.append(eye);
    const cones = el('div', 'rd-front-cones');
    cones.append(el('i'));
    node.append(cones, glass);
    auth.prepend(node);
    front = { node, magic: new MagicEye(eye), timer: 0 };
    auth.addEventListener('input', warm);
    auth.addEventListener('click', warm);
    warm();
  }

  /* ---------- Voz ---------- */
  let dial = null; let timer = 0; let observer = null; let queued = false;
  function listen() {
    if (!dial) return;
    dial.render(); // estado das salas muda sem mexer no DOM que observamos
    if (document.hidden) return;
    const levels = VoxVoiceLevels.read() || [];
    let top = 0;
    for (const { name, level } of levels) {
      top = Math.max(top, level);
      const tile = VoxVoiceLevels.tileOf(name);
      if (!tile) continue;
      const speaking = VoxVoiceLevels.markSpeaking(tile, level, 'rd-falando');
      tile._rdNivel = reduced() ? 0 : follow(tile._rdNivel || 0, speaking ? level : 0);
      tile.style.setProperty('--rd-nivel', tile._rdNivel.toFixed(3));
    }
    dial.magic.set(top);
  }

  /* ---------- Ligar e desligar ---------- */
  function turnOn() {
    dial = new Dial(document.getElementById('app'));
    buildFront(document.getElementById('auth-screen'));
    dial.render();
    observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; if (dial) dial.render(); });
    });
    observer.observe(document.getElementById('channel-scroll'), { childList: true, subtree: true });
    observer.observe(document.getElementById('voice-connection'), { attributes: true, attributeFilter: ['class'] });
    timer = setInterval(listen, 60);
  }
  function turnOff() {
    clearInterval(timer);
    observer.disconnect();
    dial.destroy(); dial = null;
    const auth = document.getElementById('auth-screen');
    auth.removeEventListener('input', warm);
    auth.removeEventListener('click', warm);
    clearInterval(front.timer);
    front.node.remove(); front = null;
    document.querySelectorAll('#video-grid .tile').forEach((t) => {
      t.classList.remove('rd-falando');
      t.style.removeProperty('--rd-nivel');
    });
  }
  function sync() {
    const on = root.dataset.theme === THEME_ID;
    if (on && !dial) turnOn();
    else if (!on && dial) turnOff();
  }
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  sync();
})();
