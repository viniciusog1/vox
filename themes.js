// Temas de cor do Concord. Carregado no <head>, antes do CSS, para aplicar o
// tema salvo antes da primeira pintura. Também roda no Node (testes).
(function () {
  const STORAGE_KEY = 'concord-theme';
  const DEFAULT_THEME_ID = 'escuro';
  const TOKEN_ORDER = ['bg', 'bg2', 'bg3', 'rail', 'border', 'text', 'text2', 'muted',
    'accent', 'onAccent', 'link', 'speak', 'red', 'dangerBg'];

  // Valores da spec (docs/superpowers/specs/2026-10-30-temas-e-avatares-voz-design.md),
  // já ajustados para contraste ≥ 4.5:1. Ordem dos valores = TOKEN_ORDER.
  const PALETTES = [
    ['escuro', 'Escuro', 'dark', '#0d0f13 #141821 #1b202b #0a0c10 #2a3140 #e9ecf1 #c3cad6 #8b95a7 #5865f2 #ffffff #7b8cff #3ba55d #ed4245 #d53b3e'],
    ['grafite', 'Grafite', 'dark', '#202124 #28292d #323338 #1a1b1e #3c3e44 #e8e9ec #c6c8cd #9b9da4 #8ab4f8 #10223f #a8c7fa #81c995 #f28b82 #c5221f'],
    ['cyberpunk', 'Cyberpunk', 'dark', '#0b0614 #120a22 #1d1233 #07040d #33205a #f3eaff #d6c8f0 #9a86c4 #ff2bd6 #16001a #22e6ff #22e6ff #ff3b5c #da324f',
      '0 0 10px rgba(255,43,214,.65)', 'inset 2px 0 0 #ff2bd6, 0 0 8px rgba(255,43,214,.25)'],
    ['neon-verde', 'Neon Verde', 'dark', '#050a06 #08120a #0e1d11 #030604 #163d1d #e6ffe9 #b9e8c0 #6fa67a #39ff14 #031a00 #7dffc4 #39ff14 #ff4d5e #d13f4d',
      '0 0 10px rgba(57,255,20,.6)', 'inset 2px 0 0 #39ff14, 0 0 8px rgba(57,255,20,.25)'],
    ['dracula', 'Drácula', 'dark', '#282a36 #21222c #343746 #191a21 #44475a #f8f8f2 #e2e2dc #99a1c5 #bd93f9 #1d1530 #8be9fd #50fa7b #ff5858 #cd4444'],
    ['nord', 'Nord', 'dark', '#2e3440 #3b4252 #434c5e #272c36 #4c566a #eceff4 #d8dee9 #b7becb #88c0d0 #1b2530 #99b3cd #a3be8c #d9a1a7 #b25a63'],
    ['aquatico', 'Aquático', 'dark', '#04141f #071e2d #0c2b3f #031019 #15405a #e4f6ff #bfe1ef #7fa9bd #1fd1c1 #002624 #5cc8ff #5cc8ff #ff5a6a #c94754',
      '0 0 8px rgba(31,209,193,.35)', 'none'],
    ['natureza', 'Natureza', 'dark', '#0c140e #121d15 #1a2a1e #08100a #2a3d2e #eef3e6 #cfd9c4 #93a68a #e2a33c #231500 #9ad16b #9ad16b #e0573f #c74d38'],
    ['por-do-sol', 'Pôr do sol', 'dark', '#160d14 #1f121c #2b1a27 #10090e #43293d #fff0ea #f0d3c9 #b48f99 #ff7a59 #2a0b00 #ffb86b #ffc857 #ff4d6d #d03f59'],
    ['claro', 'Claro', 'light', '#ffffff #f3f4f7 #e6e8ee #e3e5eb #d7dae2 #1d2129 #3a404c #616774 #4f5bd5 #ffffff #3b47c4 #23934a #d3292c #d7393c'],
    ['sepia', 'Sépia', 'light', '#f6efdf #ede3cb #e2d5b7 #e0d2b0 #d3c39f #3b2f22 #544433 #695945 #8f4e22 #fff7ec #7a4a1f #5f8a3a #af3f2c #b3402d'],
    ['lavanda', 'Lavanda / Sakura', 'light', '#fcf8fd #f3ebf7 #e9dcf0 #eadcf2 #dccbe6 #2e2236 #4a3b54 #6e5c78 #8e56b5 #ffffff #b73c73 #d9578f #c3324d #cc3a55'],
    ['algodao-doce', 'Algodão-doce', 'light', '#fefafc #edf3fd #fbe4ef #fbdcea #dfe5f3 #28263d #45425c #6a657f #3a70dc #ffffff #c82d76 #e0609a #cd2d4c #d23c59']
  ];

  const THEMES = PALETTES.map(([id, name, kind, values, glow = 'none', glowSoft = 'none']) => {
    const list = values.split(' ');
    const tokens = {};
    TOKEN_ORDER.forEach((k, i) => { tokens[k] = list[i]; });
    return { id, name, kind, tokens, glow, glowSoft };
  });

  // Iguais em todos os temas: cores de status
  const FIXED_VARS = { '--green': '#3ba55d', '--yellow': '#faa61a', '--gray': '#747f8d' };

  const CSS_NAMES = {
    bg: '--bg', bg2: '--bg-2', bg3: '--bg-3', rail: '--rail', border: '--border', text: '--text',
    text2: '--text-2', muted: '--muted', accent: '--accent', onAccent: '--on-accent', link: '--link',
    speak: '--speak', red: '--red', dangerBg: '--danger-bg'
  };

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
    return Object.assign(vars, FIXED_VARS);
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

  const api = { THEMES, DEFAULT_THEME_ID, STORAGE_KEY, resolveThemeId, getTheme, themeCssVars, loadThemeId, saveThemeId, applyTheme };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.ConcordThemes = api;
    let storage = null;
    try { storage = window.localStorage; } catch (e) {}
    applyTheme(loadThemeId(storage));
  }
})();
