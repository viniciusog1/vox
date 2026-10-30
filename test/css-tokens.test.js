const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function styleBlocks() {
  return [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
}

test('CSS usa só tokens de tema (sem cores fixas)', () => {
  const literals = styleBlocks().match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [];
  const allowed = (lit) => ['#fff', '#ffffff', '#000'].includes(lit.toLowerCase()) ||
    /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/.test(lit);
  const offending = literals.filter((lit) => !allowed(lit));
  assert.deepEqual(offending, [], `cores fixas no CSS: ${[...new Set(offending)].join(', ')}`);
});

test('themes.js carrega no <head> antes do <style>', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  const script = head.indexOf('<script src="themes.js"></script>');
  assert.ok(script !== -1, 'themes.js não está no <head>');
  assert.ok(script < head.indexOf('<style>'), 'themes.js precisa vir antes do <style>');
});

const renderer = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');

test('texto de status usa os tokens de texto legível', () => {
  const css = styleBlocks();
  assert.match(css, /#voice-connection \.vc-info \{[^}]*color: var\(--ok-text\)/);
  assert.match(css, /\.btn-danger-outline \{[^}]*color: var\(--danger-text\)/);
  assert.doesNotMatch(renderer, /'var\(--(green|yellow|red)\)'/, 'renderer.js pinta texto com var(--green/--yellow/--red)');
});

test('instalador não leva mockups do brainstorming', () => {
  const pkg = require('../package.json');
  assert.ok(pkg.build.files.includes('!.superpowers/**'));
});
