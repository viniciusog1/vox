const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTunnelUrl } = require('../tunnel.js');

test('acha o endereço do trycloudflare no log', () => {
  const line = '2026-11-02T22:10:58Z INF |  https://coupons-sake-lawn-clinical.trycloudflare.com                                |';
  assert.equal(parseTunnelUrl(line), 'https://coupons-sake-lawn-clinical.trycloudflare.com');
  assert.equal(parseTunnelUrl('INF Requesting new quick Tunnel on trycloudflare.com...'), null);
  assert.equal(parseTunnelUrl('https://api.trycloudflare.com/tunnel'), null);
  assert.equal(parseTunnelUrl(undefined), null);
});
