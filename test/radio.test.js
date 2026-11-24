const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { nearest, eyeShadow, follow } = require('../src/renderer/radio.js');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', ...p), 'utf8');

test('estação mais perto do ponteiro', () => {
  const c = [20, 120, 220];
  assert.equal(nearest(c, -50), 0);
  assert.equal(nearest(c, 69), 0);
  assert.equal(nearest(c, 71), 1);
  assert.equal(nearest(c, 900), 2);
  assert.equal(nearest([], 10), -1);
});

test('olho mágico: fecha conforme a voz, sempre entre 6° e 100°', () => {
  assert.equal(eyeShadow(0), 100);
  assert.equal(eyeShadow(1), 6);
  let last = 101;
  for (let v = 0; v <= 1.001; v += 0.1) {
    const s = eyeShadow(v);
    assert.ok(s < last && s >= 6 - 1e-9 && s <= 100);
    last = s;
  }
  for (const bad of [-1, undefined, NaN]) assert.equal(eyeShadow(bad), 100);
  assert.equal(eyeShadow(9), 6);
});

test('nível sobe rápido, desce devagar e chega ao alvo', () => {
  assert.ok(follow(0, 1) > 0.5);
  assert.ok(follow(1, 0) > 0.7);
  let v = 1;
  for (let i = 0; i < 60; i++) v = follow(v, 0);
  assert.equal(v, 0);
});

test('radio.css não mexe nos outros temas', () => {
  const css = read('radio.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const top = [];
  let depth = 0; let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') { if (depth++ === 0) top.push(css.slice(start, i).trim()); }
    if (css[i] === '}' && --depth === 0) start = i + 1;
  }
  assert.equal(depth, 0);
  for (const m of css.match(/@media[^{]*\{\s*([^{]*)\{/g) || []) assert.match(m, /:root\[data-theme="radio"\]/);
  for (const sel of top.filter((s) => !s.startsWith('@media'))) {
    assert.match(sel, /^(:root\[data-theme="radio"\]|\.theme-thumb\[data-preview="radio"\])/, sel);
  }
});

test('voice-levels.js carrega antes dos temas que o usam', () => {
  const html = read('index.html');
  const at = (f) => html.indexOf(`<script src="${f}">`);
  assert.ok(at('renderer.js') < at('voice-levels.js'));
  assert.ok(at('voice-levels.js') < at('azulejo.js') && at('voice-levels.js') < at('radio.js'));
});

test('o bloco de música escondido não conta como música na tela', () => {
  // renderer.js guarda o tile da música na grade com a classe hidden depois que ela acaba
  for (const f of ['azulejo.js', 'azulejo.css', 'radio.js', 'radio.css']) {
    for (const m of read(f).match(/\.music-tile(?![-\w]).{0,14}/g) || []) {
      if (m.startsWith('.music-tile)')) continue; // :not(.music-tile)
      assert.match(m, /^\.music-tile:not\(\.hidden\)/, `${f}: ${m}`);
    }
  }
});
