const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../chat-state.js');

test('cleanText apara, aceita vazio e recusa longo ou não-texto', () => {
  assert.equal(chat.cleanText('  oi  '), 'oi');
  assert.equal(chat.cleanText(undefined), '');
  assert.equal(chat.cleanText('a'.repeat(chat.MAX_TEXT)), 'a'.repeat(chat.MAX_TEXT));
  assert.equal(chat.cleanText('a'.repeat(chat.MAX_TEXT + 1)), null);
  assert.equal(chat.cleanText({ text: 'x' }), null);
});

test('tipos de imagem e nomes de upload', () => {
  assert.equal(chat.imageExtension('image/webp'), 'webp');
  assert.equal(chat.imageExtension('image/svg+xml'), null);
  assert.equal(chat.isUploadName('0b6c3f7e-1f2a-4b5c-8d9e-0123456789ab.webp'), true);
  for (const bad of ['../users.json', 'x.webp', '0b6c3f7e-1f2a-4b5c-8d9e-0123456789ab.svg', null]) {
    assert.equal(chat.isUploadName(bad), false, String(bad));
  }
});

test('ensureIds dá id só a quem não tem', () => {
  const data = { geral: [{ user: 'a', text: '1' }, { id: 'x', user: 'b', text: '2' }] };
  let n = 0;
  assert.equal(chat.ensureIds(data, () => 'id' + (++n)), true);
  assert.deepEqual(data.geral.map((m) => m.id), ['id1', 'x']);
  assert.equal(chat.ensureIds(data, () => 'novo'), false);
});

test('editar: só o autor, texto válido, marca edited_at', () => {
  const list = [{ id: '1', user: 'ana', text: 'oi' }];
  assert.equal(chat.editMessage(list, '1', 'bia', 'hack', 't'), null);
  assert.equal(chat.editMessage(list, '1', 'ana', '   ', 't'), null); // sem imagem, vazio não vale
  assert.equal(chat.editMessage(list, '2', 'ana', 'x', 't'), null);
  const m = chat.editMessage(list, '1', 'ana', ' olá ', 't1');
  assert.equal(m.text, 'olá');
  assert.equal(m.edited_at, 't1');
  // Com imagem, a legenda pode ficar vazia
  const withImg = [{ id: '3', user: 'ana', text: 'legenda', image: { file: 'f' } }];
  assert.equal(chat.editMessage(withImg, '3', 'ana', '', 't').text, '');
});

test('apagar: só o autor; devolve a removida', () => {
  const list = [{ id: '1', user: 'ana' }, { id: '2', user: 'bia' }];
  assert.equal(chat.deleteMessage(list, '2', 'ana'), null);
  assert.equal(chat.deleteMessage(list, '1', 'ana').id, '1');
  assert.deepEqual(list.map((m) => m.id), ['2']);
  assert.equal(chat.deleteMessage(undefined, '1', 'ana'), null);
});

test('menções: nome inteiro, sem diferenciar maiúsculas, nome mais longo primeiro', () => {
  const users = ['ana', 'anabela', 'joão'];
  assert.deepEqual(chat.mentionsOf('oi @Ana e @anabela', users), ['ana', 'anabela']);
  assert.deepEqual(chat.mentionsOf('email ana@ana.com', users), []);
  assert.deepEqual(chat.mentionsOf('@anax não existe', users), []);
  assert.deepEqual(chat.mentionsOf('valeu @joão!', users), ['joão']);
  const parts = chat.splitMentions('oi @ana, tudo?', users);
  assert.deepEqual(parts, [{ text: 'oi ' }, { text: '@ana', mention: 'ana' }, { text: ', tudo?' }]);
  assert.deepEqual(chat.splitMentions('', users), []);
  assert.deepEqual(chat.splitMentions('sem lista', []), [{ text: 'sem lista' }]);
});

test('não lidas somam e guardam se houve menção', () => {
  let u = {};
  u = chat.addUnread(u, 'jogos', false);
  u = chat.addUnread(u, 'jogos', true);
  u = chat.addUnread(u, 'jogos', false);
  assert.deepEqual(u.jogos, { count: 3, mention: true });
  u = chat.clearUnread(u, 'jogos');
  assert.equal(u.jogos, undefined);
});

test('shouldNotify respeita modo, ocupado e foco', () => {
  const base = { mode: 'all', status: 'online', mention: false, focused: false, sameRoom: true };
  assert.equal(chat.shouldNotify(base), true);
  assert.equal(chat.shouldNotify({ ...base, focused: true }), false);
  assert.equal(chat.shouldNotify({ ...base, focused: true, sameRoom: false }), true);
  assert.equal(chat.shouldNotify({ ...base, mode: 'mentions' }), false);
  assert.equal(chat.shouldNotify({ ...base, mode: 'mentions', mention: true }), true);
  assert.equal(chat.shouldNotify({ ...base, mode: 'off', mention: true }), false);
  assert.equal(chat.shouldNotify({ ...base, status: 'busy', mention: true }), false);
});
