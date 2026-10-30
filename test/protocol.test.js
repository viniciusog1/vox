const test = require('node:test');
const assert = require('node:assert/strict');
const pr = require('../protocol.js');

test('versão e mensagem', () => {
  assert.equal(pr.PROTOCOL_VERSION, 2);
  assert.equal(pr.VERSION_MISMATCH_MESSAGE, 'Seu Vox está em uma versão diferente da do servidor. Atualize para entrar.');
});

test('isCompatible só aceita a versão exata', () => {
  assert.equal(pr.isCompatible(2), true);
  for (const bad of [undefined, 1, '2', null, 3]) assert.equal(pr.isCompatible(bad), false);
});
