const test = require('node:test');
const assert = require('node:assert/strict');
const { parseYouTubeId, thumbnailUrl, lookupVideo } = require('../youtube.js');

const ID = 'dQw4w9WgXcQ';

test('parseYouTubeId aceita formatos', () => {
  const entradas = [
    `https://www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `https://youtu.be/${ID}?si=abc`,
  ];
  for (const e of entradas) assert.equal(parseYouTubeId(e), ID, e);
});

test('parseYouTubeId recusa', () => {
  const entradas = ['', 'abc', 'https://vimeo.com/123', 'https://www.youtube.com/watch?v=curto', 'https://youtube.com/watch', null, 42];
  for (const e of entradas) assert.equal(parseYouTubeId(e), null, String(e));
});

test('lookupVideo 200', async () => {
  let chamada;
  const fakeFetch = async (url) => {
    chamada = url;
    return { status: 200, ok: true, json: async () => ({ title: 'X', thumbnail_url: 'T' }) };
  };
  assert.deepEqual(await lookupVideo(ID, fakeFetch), { ok: true, title: 'X', thumbnail: 'T' });
  assert.ok(chamada.includes(`oembed?url=https://www.youtube.com/watch?v=${ID}&format=json`));
});

test('lookupVideo 401 e 404 recusam', async () => {
  for (const status of [401, 404]) {
    const fakeFetch = async () => ({ status, ok: false, json: async () => ({}) });
    assert.deepEqual(await lookupVideo(ID, fakeFetch), { ok: false });
  }
});

test('lookupVideo erro de rede aceita com fallback', async () => {
  const fakeFetch = async () => { throw new Error('rede'); };
  assert.deepEqual(await lookupVideo(ID, fakeFetch), { ok: true, title: ID, thumbnail: thumbnailUrl(ID) });
});

test('lookupVideo timeout', async () => {
  const fakeFetch = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('abortado')));
  });
  const t0 = Date.now();
  const r = await lookupVideo(ID, fakeFetch, 50);
  assert.deepEqual(r, { ok: true, title: ID, thumbnail: thumbnailUrl(ID) });
  assert.ok(Date.now() - t0 < 500);
});
