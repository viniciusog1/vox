const test = require('node:test');
const assert = require('node:assert/strict');
const { STATUS_MODES, effectiveStatus, onIdle, onActivity } = require('../presence.js');

test('STATUS_MODES exato', () => {
  assert.deepEqual(STATUS_MODES, ['online', 'away', 'busy', 'invisible']);
});

test('ausente manual não volta com atividade', () => {
  assert.equal(effectiveStatus('away', onActivity(false)), 'away');
});

test('online parado vira ausente', () => {
  assert.equal(effectiveStatus('online', onIdle('online')), 'away');
});

test('online volta com atividade', () => {
  assert.equal(effectiveStatus('online', onActivity(true)), 'online');
});

test('ocupado e invisível não viram ausente', () => {
  assert.equal(onIdle('busy'), false);
  assert.equal(onIdle('invisible'), false);
  assert.equal(effectiveStatus('busy', onIdle('busy')), 'busy');
});
