const test = require('node:test');
const assert = require('node:assert/strict');
const themes = require('../themes.js');

const IDS = ['escuro', 'grafite', 'dracula', 'nord', 'aquatico', 'natureza', 'por-do-sol',
  'cyberpunk', 'neon-verde', 'neon-vermelho', 'neon-azul',
  'bizarro', 'manga', 'ninja',
  'claro', 'sepia', 'lavanda', 'algodao-doce'];
const NAMES = ['Escuro', 'Grafite', 'Drácula', 'Nord', 'Aquático', 'Natureza', 'Pôr do sol',
  'Cyberpunk', 'Neon Verde', 'Neon Vermelho', 'Neon Azul',
  'Bizarro', 'Mangá', 'Ninja',
  'Claro', 'Sépia', 'Lavanda / Sakura', 'Algodão-doce'];
const TOKENS = ['bg', 'bg2', 'bg3', 'rail', 'border', 'text', 'text2', 'muted', 'accent', 'onAccent', 'link', 'speak', 'red', 'dangerBg'];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('exporta 18 temas com ids, nomes e grupos', () => {
  assert.deepEqual(themes.THEMES.map((t) => t.id), IDS);
  assert.deepEqual(themes.THEMES.map((t) => t.name), NAMES);
  assert.equal(themes.THEMES.filter((t) => t.kind === 'dark').length, 13);
  assert.equal(themes.THEMES.filter((t) => t.kind === 'light').length, 5);
  assert.deepEqual(themes.THEME_GROUPS, [['escuros', 'Escuros'], ['neon', 'Neon'], ['anime', 'Anime'], ['claros', 'Claros']]);
  const ids = (g) => themes.THEMES.filter((t) => t.group === g).map((t) => t.id);
  assert.deepEqual(ids('escuros'), ['escuro', 'grafite', 'dracula', 'nord', 'aquatico', 'natureza', 'por-do-sol']);
  assert.deepEqual(ids('neon'), ['cyberpunk', 'neon-verde', 'neon-vermelho', 'neon-azul']);
  assert.deepEqual(ids('anime'), ['bizarro', 'manga', 'ninja']);
  assert.deepEqual(ids('claros'), ['claro', 'sepia', 'lavanda', 'algodao-doce']);
});

test('cada tema tem os 14 tokens em hex #rrggbb', () => {
  for (const t of themes.THEMES) {
    assert.deepEqual(Object.keys(t.tokens).sort(), [...TOKENS].sort(), t.id);
    for (const k of TOKENS) assert.match(t.tokens[k], /^#[0-9a-f]{6}$/, `${t.id}.${k}`);
  }
});

test('paleta igual à spec', () => {
  const values = (id) => TOKENS.map((k) => themes.getTheme(id).tokens[k]);
  assert.deepEqual(values('escuro'), ['#0d0f13', '#141821', '#1b202b', '#0a0c10', '#2a3140', '#e9ecf1', '#c3cad6',
    '#8b95a7', '#5865f2', '#ffffff', '#7b8cff', '#3ba55d', '#ed4245', '#d53b3e']);
  assert.deepEqual(values('algodao-doce'), ['#fefafc', '#edf3fd', '#fbe4ef', '#fbdcea', '#dfe5f3', '#28263d', '#45425c',
    '#6a657f', '#3a70dc', '#ffffff', '#c82d76', '#e0609a', '#cd2d4c', '#d23c59']);
});

test('contraste mínimo em todos os temas', () => {
  const rules = [
    ['text', ['bg', 'bg2', 'bg3']], ['text2', ['bg', 'bg2', 'bg3']], ['muted', ['bg', 'bg2', 'bg3']],
    ['link', ['bg', 'bg2']], ['red', ['bg', 'bg2']], ['onAccent', ['accent']]
  ];
  for (const t of themes.THEMES) {
    for (const [fg, bgs] of rules) {
      for (const bg of bgs) {
        const c = contrast(t.tokens[fg], t.tokens[bg]);
        assert.ok(c >= 4.5, `${t.id}: ${fg} sobre ${bg} = ${c.toFixed(2)}`);
      }
    }
    const w = contrast('#ffffff', t.tokens.dangerBg);
    assert.ok(w >= 4.5, `${t.id}: branco sobre dangerBg = ${w.toFixed(2)}`);
  }
});

test('glow só nos temas Neon, Anime escuros e no aquatico', () => {
  for (const t of themes.THEMES) {
    if (['cyberpunk', 'neon-verde', 'neon-vermelho', 'neon-azul', 'aquatico', 'bizarro', 'ninja'].includes(t.id)) assert.notEqual(t.glow, 'none', t.id);
    else {
      assert.equal(t.glow, 'none', t.id);
      assert.equal(t.glowSoft, 'none', t.id);
    }
  }
  assert.equal(themes.getTheme('aquatico').glowSoft, 'none');
  assert.equal(themes.getTheme('cyberpunk').glow, '0 0 10px rgba(255,43,214,.65)');
  assert.equal(themes.getTheme('neon-verde').glowSoft, 'inset 2px 0 0 #39ff14, 0 0 8px rgba(57,255,20,.25)');
  assert.equal(themes.getTheme('neon-vermelho').glow, '0 0 10px rgba(255,42,61,.65)');
  assert.equal(themes.getTheme('neon-azul').glowSoft, 'inset 2px 0 0 #1f8bff, 0 0 8px rgba(31,139,255,.25)');
});

test('resolveThemeId cai no escuro', () => {
  for (const bad of [undefined, '', 'tema-que-nao-existe', 42, null]) assert.equal(themes.resolveThemeId(bad), 'escuro');
  assert.equal(themes.resolveThemeId('nord'), 'nord');
  assert.equal(themes.DEFAULT_THEME_ID, 'escuro');
  assert.equal(themes.STORAGE_KEY, 'vox-theme');
});

test('loadThemeId tolera storage quebrado', () => {
  const throwing = { getItem() { throw new Error('bloqueado'); } };
  const holding = (v) => ({ getItem: (k) => (k === 'vox-theme' ? v : null) });
  assert.equal(themes.loadThemeId(throwing), 'escuro');
  assert.equal(themes.loadThemeId(holding('xyz')), 'escuro');
  assert.equal(themes.loadThemeId(holding('sepia')), 'sepia');
  assert.equal(themes.loadThemeId(undefined), 'escuro');
});

test('saveThemeId não lança se o storage lança', () => {
  assert.doesNotThrow(() => themes.saveThemeId({ setItem() { throw new Error('cheio'); } }, 'nord'));
  const saved = {};
  themes.saveThemeId({ setItem: (k, v) => { saved[k] = v; } }, 'nord');
  assert.deepEqual(saved, { 'vox-theme': 'nord' });
});

test('themeCssVars mapeia nomes', () => {
  const vars = themes.themeCssVars(themes.getTheme('nord'));
  assert.equal(vars['--bg-2'], '#3b4252');
  assert.equal(vars['--on-accent'], '#1b2530');
  assert.equal(vars['--danger-bg'], themes.getTheme('nord').tokens.dangerBg);
  assert.equal(vars['--glow'], 'none');
  assert.equal(vars['--green'], '#3ba55d');
  assert.equal(vars['--yellow'], '#faa61a');
  assert.equal(vars['--gray'], '#747f8d');
});

test('applyTheme escreve no root', () => {
  const props = {};
  const root = { style: { setProperty: (k, v) => { props[k] = v; } }, dataset: {} };
  assert.equal(themes.applyTheme('claro', root), 'claro');
  assert.equal(props['--bg'], '#ffffff');
  assert.equal(root.dataset.theme, 'claro');
  assert.equal(root.dataset.themeKind, 'light');
  assert.equal(themes.applyTheme('??', root), 'escuro');
  assert.equal(root.dataset.theme, 'escuro');
});

// Cor sólida resultante de `color-mix(in srgb, fg pct%, transparent)` desenhada sobre bg
function over(fg, pct, bg) {
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map((i) => Math.round(ch(fg, i) * pct + ch(bg, i) * (1 - pct)).toString(16).padStart(2, '0')).join('');
}

test('texto de status (verde/amarelo/vermelho) legível em todos os temas', () => {
  for (const t of themes.THEMES) {
    const v = themes.themeCssVars(t);
    const k = t.tokens;
    const checks = [
      ['--ok-text', k.rail], ['--ok-text', k.bg2], ['--ok-text', over(v['--green'], 0.10, k.bg2)],
      ['--warn-text', k.rail], ['--warn-text', k.bg2],
      ['--danger-text', k.rail], ['--danger-text', k.bg2], ['--danger-text', over(k.red, 0.12, k.bg2)]
    ];
    for (const [name, bg] of checks) {
      assert.match(v[name] || '', /^#[0-9a-f]{6}$/, `${t.id}: ${name}`);
      const c = contrast(v[name], bg);
      assert.ok(c >= 4.5, `${t.id}: ${name} sobre ${bg} = ${c.toFixed(2)}`);
    }
  }
});

test('paletas Neon Vermelho e Neon Azul aprovadas', () => {
  const values = (id) => TOKENS.map((k) => themes.getTheme(id).tokens[k]);
  assert.deepEqual(values('neon-vermelho'), ['#0d0507', '#160809', '#220d10', '#080304', '#4a1218', '#ffecee', '#f2c9cd',
    '#c88d94', '#ff2a3d', '#1a0003', '#ff8a6b', '#ff2a3d', '#ff6b57', '#c4121f']);
  assert.deepEqual(values('neon-azul'), ['#03070f', '#060d1c', '#0b1730', '#02050b', '#14305e', '#e8f3ff', '#c3daf5',
    '#86a3cc', '#1f8bff', '#00142b', '#6fe3ff', '#00e5ff', '#ff5a7a', '#c42b4a']);
});

test('reduzir animações: salva, carrega e marca o root', () => {
  const store = {};
  const storage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  assert.equal(themes.loadReduceMotion(storage), false);
  themes.saveReduceMotion(storage, true);
  assert.equal(store['vox-reduce-motion'], '1');
  assert.equal(themes.loadReduceMotion(storage), true);
  assert.equal(themes.loadReduceMotion({ getItem() { throw new Error('x'); } }), false);
  assert.doesNotThrow(() => themes.saveReduceMotion({ setItem() { throw new Error('x'); } }, true));
  const root = { dataset: {} };
  themes.applyReduceMotion(true, root);
  assert.equal(root.dataset.reduceMotion, '1');
  themes.applyReduceMotion(false, root);
  assert.equal(root.dataset.reduceMotion, undefined);
});

test('migrateLegacyStorage copia concord-* para vox-* sem sobrescrever', () => {
  const data = { 'concord-theme': 'nord', 'concord-server-url': 'http://x', 'vox-server-url': 'http://novo', outro: '1' };
  const storage = {
    get length() { return Object.keys(data).length; },
    key: (i) => Object.keys(data)[i] ?? null,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); }
  };
  themes.migrateLegacyStorage(storage);
  assert.equal(data['vox-theme'], 'nord');
  assert.equal(data['vox-server-url'], 'http://novo');
  assert.doesNotThrow(() => themes.migrateLegacyStorage(null));
});
