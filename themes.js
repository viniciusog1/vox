// Temas de cor do Concord. Carregado no <head>, antes do CSS, para aplicar o
// tema salvo antes da primeira pintura. Também roda no Node (testes).
(function () {
  const STORAGE_KEY = 'concord-theme';
  const MOTION_KEY = 'concord-reduce-motion';
  const DEFAULT_THEME_ID = 'escuro';
  const TOKEN_ORDER = ['bg', 'bg2', 'bg3', 'rail', 'border', 'text', 'text2', 'muted',
    'accent', 'onAccent', 'link', 'speak', 'red', 'dangerBg'];

  // Valores da spec (docs/superpowers/specs/2026-10-30-temas-e-avatares-voz-design.md),
  // já ajustados para contraste ≥ 4.5:1. Ordem dos valores = TOKEN_ORDER.
  const PALETTES = [
    ['escuro', 'Escuro', 'dark', 'escuros', '#0d0f13 #141821 #1b202b #0a0c10 #2a3140 #e9ecf1 #c3cad6 #8b95a7 #5865f2 #ffffff #7b8cff #3ba55d #ed4245 #d53b3e'],
    ['grafite', 'Grafite', 'dark', 'escuros', '#202124 #28292d #323338 #1a1b1e #3c3e44 #e8e9ec #c6c8cd #9b9da4 #8ab4f8 #10223f #a8c7fa #81c995 #f28b82 #c5221f'],
    ['dracula', 'Drácula', 'dark', 'escuros', '#282a36 #21222c #343746 #191a21 #44475a #f8f8f2 #e2e2dc #99a1c5 #bd93f9 #1d1530 #8be9fd #50fa7b #ff5858 #cd4444'],
    ['nord', 'Nord', 'dark', 'escuros', '#2e3440 #3b4252 #434c5e #272c36 #4c566a #eceff4 #d8dee9 #b7becb #88c0d0 #1b2530 #99b3cd #a3be8c #d9a1a7 #b25a63'],
    ['aquatico', 'Aquático', 'dark', 'escuros', '#04141f #071e2d #0c2b3f #031019 #15405a #e4f6ff #bfe1ef #7fa9bd #1fd1c1 #002624 #5cc8ff #5cc8ff #ff5a6a #c94754',
      '0 0 8px rgba(31,209,193,.35)', 'none'],
    ['natureza', 'Natureza', 'dark', 'escuros', '#0c140e #121d15 #1a2a1e #08100a #2a3d2e #eef3e6 #cfd9c4 #93a68a #e2a33c #231500 #9ad16b #9ad16b #e0573f #c74d38'],
    ['por-do-sol', 'Pôr do sol', 'dark', 'escuros', '#160d14 #1f121c #2b1a27 #10090e #43293d #fff0ea #f0d3c9 #b48f99 #ff7a59 #2a0b00 #ffb86b #ffc857 #ff4d6d #d03f59'],
    ['cyberpunk', 'Cyberpunk', 'dark', 'neon', '#0b0614 #120a22 #1d1233 #07040d #33205a #f3eaff #d6c8f0 #9a86c4 #ff2bd6 #16001a #22e6ff #22e6ff #ff3b5c #da324f',
      '0 0 10px rgba(255,43,214,.65)', 'inset 2px 0 0 #ff2bd6, 0 0 8px rgba(255,43,214,.25)'],
    ['neon-verde', 'Neon Verde', 'dark', 'neon', '#050a06 #08120a #0e1d11 #030604 #163d1d #e6ffe9 #b9e8c0 #6fa67a #39ff14 #031a00 #7dffc4 #39ff14 #ff4d5e #d13f4d',
      '0 0 10px rgba(57,255,20,.6)', 'inset 2px 0 0 #39ff14, 0 0 8px rgba(57,255,20,.25)'],
    ['neon-vermelho', 'Neon Vermelho', 'dark', 'neon', '#0d0507 #160809 #220d10 #080304 #4a1218 #ffecee #f2c9cd #c88d94 #ff2a3d #1a0003 #ff8a6b #ff2a3d #ff6b57 #c4121f',
      '0 0 10px rgba(255,42,61,.65)', 'inset 2px 0 0 #ff2a3d, 0 0 8px rgba(255,42,61,.25)'],
    ['neon-azul', 'Neon Azul', 'dark', 'neon', '#03070f #060d1c #0b1730 #02050b #14305e #e8f3ff #c3daf5 #86a3cc #1f8bff #00142b #6fe3ff #00e5ff #ff5a7a #c42b4a',
      '0 0 10px rgba(31,139,255,.65)', 'inset 2px 0 0 #1f8bff, 0 0 8px rgba(31,139,255,.25)'],
    // Anime: efeitos extras (fundos, animações) no CSS por [data-theme]
    ['bizarro', 'Bizarro', 'dark', 'anime', '#1a0b2e #220f3d #2d1550 #12071f #4b2a7a #fff4d6 #f0dcae #b9a0d8 #ffd23f #2a1400 #b8ff3c #b8ff3c #ff6b95 #c2185b',
      '0 0 10px rgba(255,210,63,.55)', 'inset 2px 0 0 #ffd23f, 0 0 8px rgba(184,255,60,.2)'],
    ['manga', 'Mangá', 'light', 'anime', '#ffffff #f4f4f4 #e6e6e6 #ececec #1a1a1a #111111 #2b2b2b #555555 #111111 #ffffff #c4122f #111111 #c4122f #c4122f'],
    ['ninja', 'Ninja', 'dark', 'anime', '#0f1626 #141d31 #1c2841 #0a0f1b #2c3b5c #fff3e6 #f2d9c2 #a5acc4 #ff7a1a #1f0d00 #ffb04d #ff9a2e #ff6a5f #c73a2f',
      '0 0 10px rgba(255,122,26,.55)', 'inset 2px 0 0 #ff7a1a, 0 0 8px rgba(255,122,26,.2)'],
    ['claro', 'Claro', 'light', 'claros', '#ffffff #f3f4f7 #e6e8ee #e3e5eb #d7dae2 #1d2129 #3a404c #616774 #4f5bd5 #ffffff #3b47c4 #23934a #d3292c #d7393c'],
    ['sepia', 'Sépia', 'light', 'claros', '#f6efdf #ede3cb #e2d5b7 #e0d2b0 #d3c39f #3b2f22 #544433 #695945 #8f4e22 #fff7ec #7a4a1f #5f8a3a #af3f2c #b3402d'],
    ['lavanda', 'Lavanda / Sakura', 'light', 'claros', '#fcf8fd #f3ebf7 #e9dcf0 #eadcf2 #dccbe6 #2e2236 #4a3b54 #6e5c78 #8e56b5 #ffffff #b73c73 #d9578f #c3324d #cc3a55'],
    ['algodao-doce', 'Algodão-doce', 'light', 'claros', '#fefafc #edf3fd #fbe4ef #fbdcea #dfe5f3 #28263d #45425c #6a657f #3a70dc #ffffff #c82d76 #e0609a #cd2d4c #d23c59']
  ];

  // Grupos do seletor de tema, na ordem em que aparecem
  const THEME_GROUPS = [['escuros', 'Escuros'], ['neon', 'Neon'], ['anime', 'Anime'], ['claros', 'Claros']];

  const THEMES = PALETTES.map(([id, name, kind, group, values, glow = 'none', glowSoft = 'none']) => {
    const list = values.split(' ');
    const tokens = {};
    TOKEN_ORDER.forEach((k, i) => { tokens[k] = list[i]; });
    return { id, name, kind, group, tokens, glow, glowSoft };
  });

  // Iguais em todos os temas: cores de status
  const FIXED_VARS = { '--green': '#3ba55d', '--yellow': '#faa61a', '--gray': '#747f8d' };

  const CSS_NAMES = {
    bg: '--bg', bg2: '--bg-2', bg3: '--bg-3', rail: '--rail', border: '--border', text: '--text',
    text2: '--text-2', muted: '--muted', accent: '--accent', onAccent: '--on-accent', link: '--link',
    speak: '--speak', red: '--red', dangerBg: '--danger-bg'
  };

  // Contraste WCAG entre duas cores #rrggbb
  function luminance(hex) {
    const lin = (i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  }
  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Mistura sRGB: pct da cor a + (1 - pct) da cor b
  function mix(a, b, pct) {
    const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
    return '#' + [1, 3, 5].map((i) => Math.round(ch(a, i) * pct + ch(b, i) * (1 - pct))
      .toString(16).padStart(2, '0')).join('');
  }
  // Cor de status usada como texto: puxa em direção ao texto do tema até
  // ficar legível (≥ 4.5:1) sobre todos os fundos onde aparece.
  function readableOn(color, backgrounds, text) {
    for (let step = 0; step <= 20; step++) {
      const c = mix(text, color, step / 20);
      if (backgrounds.every((bg) => contrast(c, bg) >= 4.6)) return c;
    }
    return text;
  }

  function resolveThemeId(id) {
    return THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME_ID;
  }

  function getTheme(id) {
    const resolved = resolveThemeId(id);
    return THEMES.find((t) => t.id === resolved);
  }

  function themeCssVars(theme) {
    const vars = {};
    TOKEN_ORDER.forEach((k) => { vars[CSS_NAMES[k]] = theme.tokens[k]; });
    vars['--glow'] = theme.glow;
    vars['--glow-soft'] = theme.glowSoft;
    Object.assign(vars, FIXED_VARS);
    // Texto de status (Online/Ausente/Ocupado, "Conectado a…", erros, botão de
    // perigo contornado). Fundos: painel do usuário, colunas e as faixas tingidas.
    const k = theme.tokens;
    vars['--ok-text'] = readableOn(FIXED_VARS['--green'], [k.rail, k.bg2, mix(FIXED_VARS['--green'], k.bg2, 0.10)], k.text);
    vars['--warn-text'] = readableOn(FIXED_VARS['--yellow'], [k.rail, k.bg2], k.text);
    vars['--danger-text'] = readableOn(k.red, [k.rail, k.bg2, mix(k.red, k.bg2, 0.12)], k.text);
    return vars;
  }

  function loadThemeId(storage) {
    try {
      return resolveThemeId(storage.getItem(STORAGE_KEY));
    } catch (e) {
      return DEFAULT_THEME_ID;
    }
  }

  function saveThemeId(storage, id) {
    try { storage.setItem(STORAGE_KEY, resolveThemeId(id)); } catch (e) {}
  }

  function applyTheme(id, root) {
    const target = root || document.documentElement;
    const theme = getTheme(id);
    const vars = themeCssVars(theme);
    Object.keys(vars).forEach((k) => target.style.setProperty(k, vars[k]));
    target.dataset.theme = theme.id;
    target.dataset.themeKind = theme.kind;
    return theme.id;
  }

  // "Reduzir animações": desliga as animações dos temas (CSS por [data-reduce-motion])
  function loadReduceMotion(storage) {
    try { return storage.getItem(MOTION_KEY) === '1'; } catch (e) { return false; }
  }
  function saveReduceMotion(storage, on) {
    try { storage.setItem(MOTION_KEY, on ? '1' : '0'); } catch (e) {}
  }
  function applyReduceMotion(on, root) {
    const target = root || document.documentElement;
    if (on) target.dataset.reduceMotion = '1';
    else delete target.dataset.reduceMotion;
  }

  const api = { MOTION_KEY, loadReduceMotion, saveReduceMotion, applyReduceMotion, THEMES, THEME_GROUPS, DEFAULT_THEME_ID, STORAGE_KEY, resolveThemeId, getTheme, themeCssVars, loadThemeId, saveThemeId, applyTheme };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.ConcordThemes = api;
    let storage = null;
    try { storage = window.localStorage; } catch (e) {}
    applyTheme(loadThemeId(storage));
    applyReduceMotion(loadReduceMotion(storage));
  }
})();
