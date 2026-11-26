const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const arena = require('../src/shared/lol-arena.js');
const { createArenaWatcher } = require('../src/main/lol-arena-watcher.js');

// ---------- Canal temporário ----------
const casa = () => ({ servers: { casa: { id: 'casa', name: 'Casa', owner: 'ana', admins: [], members: ['ana', 'bia'], channels: [{ id: 'geral', name: 'geral', type: 'text' }] } } });

test('o canal Dano Arena LoL nasce na Casa dos Amigos uma vez só, com mensagens de 30 min', () => {
  const db = casa();
  const r = arena.ensureArenaChannel(db, 'bia');
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
  assert.deepEqual(r.channel, { id: 'dano-arena-lol', name: 'dano-arena-lol', type: 'text', ttlMinutes: 30 });
  const again = arena.ensureArenaChannel(db, 'ana');
  assert.equal(again.created, false);
  assert.equal(db.servers.casa.channels.filter((c) => c.id === 'dano-arena-lol').length, 1);
  assert.equal(arena.ensureArenaChannel(db, 'intruso').ok, false, 'só quem é da casa');
  assert.equal(arena.ensureArenaChannel({ servers: {} }, 'ana').ok, false);
});

test('validade: 30 min no canal temporário, 7 dias nos outros', () => {
  assert.equal(arena.retentionMs({ ttlMinutes: 30 }), 30 * 60 * 1000);
  assert.equal(arena.retentionMs({ id: 'geral' }), 7 * 24 * 60 * 60 * 1000);
  assert.equal(arena.retentionMs(null), 7 * 24 * 60 * 60 * 1000);
  assert.equal(arena.retentionMs({ ttlMinutes: -5 }), 7 * 24 * 60 * 60 * 1000);
});

// ---------- API da Riot ----------
test('reconhece o nome do jogador com ou sem a tag', () => {
  assert.equal(arena.sameRiotName('Vini#BR1', 'vini'), true);
  assert.equal(arena.sameRiotName('Vini', 'Vini#BR1'), true);
  assert.equal(arena.sameRiotName('Vini#BR1', 'Vinicius#BR1'), false);
  assert.equal(arena.sameRiotName('', ''), false);
});

test('acha só as minhas mortes novas', () => {
  const events = [
    { EventID: 0, EventName: 'GameStart', EventTime: 0.1 },
    { EventID: 1, EventName: 'ChampionKill', EventTime: 90, VictimName: 'Outro', KillerName: 'Vini' },
    { EventID: 2, EventName: 'ChampionKill', EventTime: 125.4, VictimName: 'Vini', KillerName: 'Outro' },
    { EventID: 3, EventName: 'ChampionKill', EventTime: 300, VictimName: 'vini#br1', KillerName: 'X' }
  ];
  assert.deepEqual(arena.newDeaths(events, 'Vini#BR1', -1).deaths.map((d) => d.time), [125.4, 300]);
  assert.deepEqual(arena.newDeaths(events, 'Vini#BR1', 2), { deaths: [{ id: 3, time: 300 }], lastId: 3 });
  assert.deepEqual(arena.newDeaths(events, 'Vini#BR1', 3), { deaths: [], lastId: 3 });
  assert.deepEqual(arena.newDeaths('lixo', 'Vini', 1), { deaths: [], lastId: 1 });
});

test('tempo de jogo para a legenda', () => {
  assert.equal(arena.gameClock(125.4), '2:05');
  assert.equal(arena.gameClock(3725), '62:05');
  assert.equal(arena.gameClock(NaN), null);
});

// ---------- Recorte ----------
test('recorte em frações da tela, sempre dentro da imagem', () => {
  assert.deepEqual(arena.cropRect({ width: 1920, height: 1080 }, { x: 0, y: 0, w: 0.15, h: 0.5 }), { x: 0, y: 0, width: 288, height: 540 });
  assert.deepEqual(arena.cropRect({ width: 1000, height: 500 }, { x: 0.9, y: 0.9, w: 0.5, h: 0.5 }), { x: 900, y: 450, width: 100, height: 50 });
  assert.deepEqual(arena.cleanCrop({ x: -1, y: 'a', w: 0, h: 2 }), { x: 0, y: arena.DEFAULT_CROP.y, w: 0.05, h: 1 });
  const r = arena.cropRect({ width: 1920, height: 1080 }, arena.DEFAULT_CROP);
  assert.ok(r.width > 200 && r.height > 300 && r.x === 0, JSON.stringify(r));
});

// ---------- Vigia (processo principal) ----------
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vox-arena-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'lol-arena.json');
}

function setup(t, { game = null, events = [], name = 'Vini#BR1', capture } = {}) {
  const state = { game, events, name };
  const shots = [];
  const statuses = [];
  const timers = [];
  const w = createArenaWatcher({
    file: temp(t),
    fetchJson: async (p) => {
      if (!state.game) throw new Error('ECONNREFUSED');
      if (p === '/liveclientdata/activeplayername') return state.name;
      if (p === '/liveclientdata/eventdata') return { Events: state.events };
      if (p === '/liveclientdata/gamestats') return state.game;
      throw new Error('?');
    },
    capture: capture || (async (crop) => ({ data: Buffer.from('png'), width: 300, height: 500, crop })),
    onShot: (s) => shots.push(s),
    onStatus: (s) => statuses.push(s),
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    cancel: () => {}
  });
  return { w, state, shots, statuses, timers, runTimers: async () => { while (timers.length) await timers.shift().fn(); } };
}

test('desligado não procura partida nem tira print', async (t) => {
  const s = setup(t, { game: { gameMode: 'CHERRY', gameTime: 10 } });
  assert.equal(s.w.status().enabled, false);
  await s.w.tick();
  assert.equal(s.shots.length, 0);
});

test('morte minha numa partida: print depois de um instante, uma vez por morte', async (t) => {
  const s = setup(t, { game: { gameMode: 'CHERRY', gameTime: 10 }, events: [{ EventID: 0, EventName: 'GameStart', EventTime: 0 }] });
  s.w.setEnabled(true);
  await s.w.tick();
  assert.equal(s.w.status().state, 'ingame');
  s.state.events.push({ EventID: 1, EventName: 'ChampionKill', EventTime: 125, VictimName: 'Vini' });
  await s.w.tick();
  await s.w.tick();
  assert.equal(s.timers.length, 1, 'um print agendado');
  assert.ok(s.timers[0].ms >= 1000 && s.timers[0].ms <= 3000);
  await s.runTimers();
  assert.equal(s.shots.length, 1);
  assert.equal(s.shots[0].caption, 'Morreu aos 2:05');
  assert.equal(s.w.status().state, 'sent');
});

test('mortes que já tinham acontecido antes de ligar não viram print', async (t) => {
  const s = setup(t, { game: { gameMode: 'CHERRY', gameTime: 400 }, events: [{ EventID: 5, EventName: 'ChampionKill', EventTime: 300, VictimName: 'Vini' }] });
  s.w.setEnabled(true);
  await s.w.tick();
  await s.runTimers();
  assert.equal(s.shots.length, 0);
});

test('partida nova recomeça a contagem dos eventos', async (t) => {
  const s = setup(t, { game: { gameMode: 'CHERRY', gameTime: 400 }, events: [{ EventID: 9, EventName: 'ChampionKill', EventTime: 300, VictimName: 'Vini' }] });
  s.w.setEnabled(true);
  await s.w.tick();
  s.state.game = null; // acabou
  await s.w.tick();
  assert.equal(s.w.status().state, 'waiting');
  s.state.game = { gameMode: 'CHERRY', gameTime: 5 };
  s.state.events = [{ EventID: 0, EventName: 'GameStart', EventTime: 0 }];
  await s.w.tick();
  s.state.events.push({ EventID: 1, EventName: 'ChampionKill', EventTime: 60, VictimName: 'Vini' });
  await s.w.tick();
  await s.runTimers();
  assert.equal(s.shots.length, 1);
});

test('atalho tira o print na hora, mesmo sem partida', async (t) => {
  const s = setup(t);
  s.w.setEnabled(true);
  await s.w.shoot('atalho');
  assert.equal(s.shots.length, 1);
  assert.equal(s.shots[0].caption, 'Print pelo atalho');
});

test('print que falhou vira aviso, sem derrubar o vigia', async (t) => {
  const s = setup(t, { capture: async () => { throw new Error('O LoL não está aberto.'); } });
  s.w.setEnabled(true);
  await s.w.shoot('atalho');
  assert.equal(s.shots.length, 0);
  assert.equal(s.w.status().state, 'error');
  assert.match(s.w.status().message, /LoL/);
});

test('ligado e recorte ficam guardados', async (t) => {
  const file = temp(t);
  const mk = () => createArenaWatcher({ file, fetchJson: async () => { throw new Error('x'); }, capture: async () => null, onShot() {}, onStatus() {}, schedule: () => 0, cancel() {} });
  const a = mk();
  a.setEnabled(true);
  a.setCrop({ x: 0, y: 0.1, w: 0.2, h: 0.4 });
  const b = mk();
  assert.equal(b.status().enabled, true);
  assert.deepEqual(b.status().crop, { x: 0, y: 0.1, w: 0.2, h: 0.4 });
});

test('encaixe: host guarda no canal temporário e apaga avisando; cliente manda o print', () => {
  const src = (...p) => fs.readFileSync(path.join(__dirname, '..', 'src', ...p), 'utf8').replace(/\r\n/g, '\n');
  const main = src('main', 'main.js');
  assert.match(main, /socket\.on\('arena-shot'/);
  assert.match(main, /socket\.on\('arena-channel'/);
  // print mandado nunca sai da área de trabalho: só o Testar recorte aceita a tela
  assert.match(main, /if \(!game && !allowScreen\) throw/);
  assert.match(main, /arenaCapture\(arenaWatcher\.status\(\)\.crop, \{ allowScreen: true \}\)/);
  assert.match(main, /capture: arenaCapture,/);
  assert.match(main, /arena\.retentionMs\(/);
  assert.match(main, /'message-deleted'/);
  assert.match(main, /globalShortcut\.register\(/);
  const js = src('renderer', 'renderer.js');
  assert.match(js, /onArenaShot\(/);
  assert.match(js, /request\('arena-shot'/);
  assert.match(js, /request\('arena-channel'\)/);
});
