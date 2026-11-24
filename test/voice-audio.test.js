const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// A voz já tocou dentro do <video> do tile: sem quadro de vídeo o elemento nunca começa
// (pausado em 0 s) e a pessoa fica muda, com o anel de fala aceso (1.5.4 e, com a tela
// compartilhada, 1.5.5). Estes testes impedem que a voz volte a depender do tile.
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'renderer.js'), 'utf8').replace(/\r\n/g, '\n');
function fn(name) {
  const m = src.match(new RegExp(`\\n(?:async )?function ${name}\\([\\s\\S]*?\\n}\\n`));
  assert.ok(m, 'não achei a função ' + name);
  return m[0];
}

test('o tile não toca a voz: nenhum <audio> e o <video> sempre mudo', () => {
  const tile = fn('buildTile');
  assert.doesNotMatch(tile, /createElement\('audio'\)/);
  assert.match(tile, /video\.muted = true;/);
  assert.doesNotMatch(tile, /video\.muted = !!opts\.muted/);
});

test('a voz tem elemento próprio por pessoa, fora da grade e só com a faixa do microfone', () => {
  const attach = fn('attachVoiceAudio');
  assert.match(attach, /new MediaStream\(\[track\]\)/);
  assert.match(attach, /document\.body\.appendChild\(audio\)/);
  assert.match(attach, /setSinkId/);
  assert.match(attach, /getPeerVolume/);
  assert.match(fn('createPeer'), /attachVoiceAudio\(id, e\.track\)/);
});

test('o elemento da voz some junto com a conexão', () => {
  assert.match(fn('dropPeer'), /removeVoiceAudio\(id\)/);
  assert.match(fn('closeAllPeers'), /voiceAudioEls\.keys\(\)\]\.forEach\(removeVoiceAudio\)/);
});

test('o volume por pessoa vale para o elemento da voz', () => {
  assert.match(fn('applyPeerVolumes'), /voiceAudioEls/);
  assert.match(fn('setPeerVolume'), /applyPeerVolumes\(\)/);
  // a faixa pode chegar antes do nome: a lista da voz reaplica
  const list = src.slice(src.indexOf("socket.on('room-users'"));
  assert.match(list.slice(0, 400), /applyPeerVolumes\(\)/);
});
