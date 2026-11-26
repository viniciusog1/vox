// TESTE TEMPORÁRIO (prints do LoL Arena): ver src/shared/lol-arena.js.
// Vigia a partida pela API local da Riot e, quando este jogador morre, tira o print do canto
// com o dano da rodada. Também pelo atalho. Dependências de fora (rede, captura, relógio)
// vêm de main.js, falsas nos testes.
const fs = require('fs');
const arena = require('../shared/lol-arena');

const POLL_MS = 1000;
const SHOT_DELAY_MS = 1500; // a telinha aparece logo depois da morte

function createArenaWatcher({ file, fetchJson, capture, onShot, onStatus, schedule = setTimeout, cancel = clearTimeout }) {
  let config = load();
  let state = { state: config.enabled ? 'waiting' : 'off' };
  let game = null; // { me, lastId } da partida atual
  let poller = null;
  let busy = false;

  function load() {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { enabled: !!d.enabled, crop: arena.cleanCrop(d.crop) };
    } catch (e) {
      return { enabled: false, crop: { ...arena.DEFAULT_CROP } };
    }
  }
  function save() { try { fs.writeFileSync(file, JSON.stringify(config, null, 2)); } catch (e) {} }

  const status = () => ({ enabled: config.enabled, crop: { ...config.crop }, ...state });
  function set(next) { state = next; onStatus(status()); }

  async function shoot(reason, time) {
    try {
      const shot = await capture(config.crop);
      if (!shot) throw new Error('Não foi possível tirar o print.');
      const clock = arena.gameClock(time);
      const caption = reason === 'morte' && clock ? `Morreu aos ${clock}` : reason === 'morte' ? 'Morreu' : 'Print pelo atalho';
      onShot({ ...shot, caption });
      set({ state: 'sent', at: Date.now() });
    } catch (e) {
      set({ state: 'error', message: e.message || 'Não foi possível tirar o print.' });
    }
  }

  async function tick() {
    if (!config.enabled || busy) return;
    busy = true;
    try {
      let me;
      let events;
      try {
        me = await fetchJson('/liveclientdata/activeplayername');
        events = (await fetchJson('/liveclientdata/eventdata')).Events;
      } catch (e) {
        if (game || state.state === 'ingame') set({ state: 'waiting' });
        game = null;
        return;
      }
      if (!game) {
        // Partida já em andamento: o que aconteceu antes de olhar não vira print.
        game = { me, lastId: arena.newDeaths(events, me, -1).lastId };
        if (state.state !== 'sent') set({ state: 'ingame' });
        return;
      }
      const found = arena.newDeaths(events, game.me || me, game.lastId);
      game.lastId = found.lastId;
      for (const d of found.deaths) schedule(() => shoot('morte', d.time), SHOT_DELAY_MS);
    } finally {
      busy = false;
    }
  }

  function start() { if (!poller) poller = setInterval(tick, POLL_MS); }
  function stop() { if (poller) { clearInterval(poller); poller = null; } game = null; }

  function setEnabled(on) {
    config.enabled = !!on;
    save();
    if (config.enabled) { set({ state: 'waiting' }); } else { stop(); set({ state: 'off' }); }
    return status();
  }

  function setCrop(crop) {
    config.crop = arena.cleanCrop(crop);
    save();
    return status();
  }

  return { status, tick, shoot: (reason) => shoot(reason || 'atalho'), setEnabled, setCrop, start, stop, cancel };
}

module.exports = { createArenaWatcher, POLL_MS, SHOT_DELAY_MS };
