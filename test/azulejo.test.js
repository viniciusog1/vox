const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hash, rng, pieceSvg, mix } = require('../src/renderer/azulejo.js');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', ...p), 'utf8');

test('azulejo da pessoa: sempre igual para o mesmo nome e diferente entre nomes', () => {
  const names = ['ana', 'bia', 'caio', 'davi', 'marina', 'rafael', 'vinicius', 'teste.a', 'teste.b', 'x_y-z'];
  for (const n of names) assert.equal(pieceSvg(n), pieceSvg(n));
  assert.equal(new Set(names.map(pieceSvg)).size, names.length);
});

test('o nome nunca entra no SVG do azulejo', () => {
  const svg = pieceSvg('"><script>alert(1)</script>');
  assert.doesNotMatch(svg, /script|alert/);
  assert.match(svg, /^<svg [^>]*>.*<\/svg>$/);
});

test('sorteio com semente fixa fica entre 0 e 1', () => {
  const a = rng(hash('vox')); const b = rng(hash('vox'));
  for (let i = 0; i < 200; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('mistura de cores', () => {
  assert.equal(mix('#000000', '#ffffff', 0), 'rgb(0,0,0)');
  assert.equal(mix('#000000', '#ffffff', 1), 'rgb(255,255,255)');
  assert.equal(mix('#000000', '#ffffff', 0.5), 'rgb(128,128,128)');
});

test('azulejo.css não mexe nos outros temas', () => {
  // Só o primeiro nível importa: o resto está aninhado nele.
  const css = read('azulejo.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const top = [];
  let depth = 0; let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') { if (depth++ === 0) top.push(css.slice(start, i).trim()); }
    if (css[i] === '}' && --depth === 0) start = i + 1;
  }
  assert.equal(depth, 0);
  const inner = css.match(/@media[^{]*\{\s*([^{]*)\{/g) || [];
  for (const m of inner) assert.match(m, /:root\[data-theme="azulejo"\]/);
  for (const sel of top.filter((s) => !s.startsWith('@media'))) {
    assert.match(sel, /^(:root\[data-theme="azulejo"\]|\.theme-thumb\[data-preview="azulejo"\]|#az-troca)/, sel);
  }
});

test('azulejo.js carrega depois do renderer.js', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('<script src="azulejo.js">') > html.indexOf('<script src="renderer.js">'));
  assert.ok(html.indexOf('href="azulejo.css"') > html.indexOf('</style>'));
});
