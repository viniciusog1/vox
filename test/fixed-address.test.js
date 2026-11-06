const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const addr = require('../fixed-address.js');
const { createAddressPublisher } = require('../address-publisher.js');

const ID = 'aa11bb22cc33dd44ee55ff6677889900';

test('reconhece o link do Gist em vários formatos', () => {
  assert.deepEqual(addr.parseGistRef(`https://gist.github.com/vinicius/${ID}`), { owner: 'vinicius', id: ID });
  assert.deepEqual(addr.parseGistRef(`gist.github.com/vinicius/${ID}/`), { owner: 'vinicius', id: ID });
  assert.deepEqual(addr.parseGistRef(`https://gist.github.com/vinicius/${ID.toUpperCase()}#file`), { owner: 'vinicius', id: ID });
  assert.deepEqual(addr.parseGistRef(`https://gist.githubusercontent.com/vinicius/${ID}/raw/vox-endereco.json`), { owner: 'vinicius', id: ID });
  assert.deepEqual(addr.parseGistRef(`https://gist.github.com/${ID}`), { owner: null, id: ID });
  assert.deepEqual(addr.parseGistRef(ID), { owner: null, id: ID });
});

test('endereço comum de servidor não é Gist', () => {
  assert.equal(addr.parseGistRef('http://127.0.0.1:3000'), null);
  assert.equal(addr.parseGistRef('https://abc-def.trycloudflare.com'), null);
  assert.equal(addr.parseGistRef(`https://github.com/vinicius/${ID}`), null);
  assert.equal(addr.parseGistRef('https://gist.github.com/vinicius/nao-e-id'), null);
  assert.equal(addr.parseGistRef(''), null);
  assert.equal(addr.parseGistRef(undefined), null);
});

test('link e endereços de leitura', () => {
  assert.equal(addr.gistLink('vinicius', ID), `https://gist.github.com/vinicius/${ID}`);
  assert.equal(addr.gistLink(null, ID), `https://gist.github.com/${ID}`);
  assert.equal(addr.apiUrl(ID), `https://api.github.com/gists/${ID}`);
  assert.equal(addr.rawUrl('vinicius', ID, 5), `https://gist.githubusercontent.com/vinicius/${ID}/raw/vox-endereco.json?t=5`);
  assert.equal(addr.rawUrl(null, ID, 5), null);
});

test('conteúdo do Gist: só aceita endereço http(s) sem caminho', () => {
  const text = addr.buildPayload('https://Abc-Def.trycloudflare.com/', 0);
  assert.equal(JSON.parse(text).url, 'https://abc-def.trycloudflare.com');
  assert.equal(addr.readPayloadText(text), 'https://abc-def.trycloudflare.com');
  assert.equal(addr.readPayloadText('{"app":"vox","url":"http://1.2.3.4:3000"}'), 'http://1.2.3.4:3000');
  assert.equal(addr.readPayloadText('{"app":"vox","url":"javascript:alert(1)"}'), null);
  assert.equal(addr.readPayloadText('{"app":"vox","url":"https://x.com/caminho"}'), null);
  assert.equal(addr.readPayloadText('{"app":"outro","url":"https://x.com"}'), null);
  assert.equal(addr.readPayloadText('{"app":"vox","url":null}'), null);
  assert.equal(addr.readPayloadText('não é json'), null);
  const gist = { owner: { login: 'vinicius' }, files: { 'vox-endereco.json': { content: text } } };
  assert.equal(addr.readGistResponse(gist), 'https://abc-def.trycloudflare.com');
  assert.equal(addr.ownerOf(gist), 'vinicius');
  assert.equal(addr.readGistResponse({ files: {} }), null);
});

test('formato do token e Gist do Vox na lista', () => {
  assert.ok(addr.looksLikeToken('ghp_' + 'a'.repeat(36)));
  assert.ok(addr.looksLikeToken('github_pat_' + 'A1_'.repeat(20)));
  assert.ok(!addr.looksLikeToken('senha123'));
  assert.ok(!addr.looksLikeToken(''));
  const list = [{ id: 'bb', files: {} }, { id: ID, files: { 'vox-endereco.json': {} } }];
  assert.equal(addr.findVoxGist(list).id, ID);
  assert.equal(addr.findVoxGist([]), null);
  assert.equal(addr.findVoxGist(null), null);
});

// GitHub falso: guarda as chamadas e responde como a API.
function fakeGitHub({ existing = null, userStatus = 200, scopes = 'gist, repo', patchStatus = 200 } = {}) {
  const calls = [];
  let content = null;
  const fetchImpl = async (url, opts) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ method: opts.method, url, auth: opts.headers.Authorization, body });
    const reply = (status, data, headers = {}) => ({
      status, ok: status >= 200 && status < 300,
      json: async () => data,
      headers: { get: (k) => headers[k.toLowerCase()] ?? null }
    });
    if (url.endsWith('/user')) return reply(userStatus, { login: 'vinicius' }, { 'x-oauth-scopes': scopes });
    if (url.includes('/gists?')) return reply(200, existing ? [existing] : []);
    if (opts.method === 'POST') { content = body.files['vox-endereco.json'].content; return reply(201, { id: ID, owner: { login: 'vinicius' } }); }
    if (opts.method === 'PATCH') {
      if (patchStatus === 200) content = body.files['vox-endereco.json'].content;
      return reply(patchStatus, { id: ID, owner: { login: 'vinicius' } });
    }
    return reply(404, {});
  };
  return { fetchImpl, calls, content: () => content };
}

function makePublisher(gh) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vox-link-'));
  const file = path.join(dir, 'link-fixo.json');
  const statuses = [];
  const pub = createAddressPublisher({
    file,
    fetchImpl: gh.fetchImpl,
    encrypt: (t) => 'cifrado:' + Buffer.from(t).toString('base64'),
    decrypt: (s) => Buffer.from(s.replace('cifrado:', ''), 'base64').toString(),
    onStatus: (s) => statuses.push(s),
    now: () => 1000
  });
  return { pub, file, statuses };
}

const TOKEN = 'ghp_' + 'x'.repeat(36);

test('conectar cria um Gist secreto, liga o túnel automático e não grava o token em texto', async () => {
  const gh = fakeGitHub();
  const { pub, file } = makePublisher(gh);
  const s = await pub.connect(TOKEN, 'https://um.trycloudflare.com');
  assert.equal(s.connected, true);
  assert.equal(s.link, `https://gist.github.com/vinicius/${ID}`);
  assert.equal(s.autoTunnel, true);
  const post = gh.calls.find((c) => c.method === 'POST');
  assert.equal(post.body.public, false);
  assert.equal(addr.readPayloadText(gh.content()), 'https://um.trycloudflare.com');
  assert.equal(post.auth, 'Bearer ' + TOKEN);
  const saved = fs.readFileSync(file, 'utf8');
  assert.ok(!saved.includes(TOKEN));
  pub.stop();
});

test('conectar de novo reaproveita o Gist do Vox (o link não muda)', async () => {
  const gh = fakeGitHub({ existing: { id: ID, files: { 'vox-endereco.json': {} } } });
  const { pub } = makePublisher(gh);
  await pub.connect(TOKEN, null);
  assert.ok(!gh.calls.some((c) => c.method === 'POST'));
  assert.ok(gh.calls.some((c) => c.method === 'PATCH' && c.url.endsWith(`/gists/${ID}`)));
  pub.stop();
});

test('token inválido, sem permissão gist ou com formato errado é recusado', async () => {
  await assert.rejects(makePublisher(fakeGitHub()).pub.connect('senha', null), /token do GitHub/);
  await assert.rejects(makePublisher(fakeGitHub({ userStatus: 401 })).pub.connect(TOKEN, null), /venceu/);
  await assert.rejects(makePublisher(fakeGitHub({ scopes: 'repo' })).pub.connect(TOKEN, null), /permissão "gist"/);
});

test('cada endereço novo do túnel vai para o Gist; o mesmo endereço não regrava', async () => {
  const gh = fakeGitHub();
  const { pub } = makePublisher(gh);
  await pub.connect(TOKEN, null);
  const patches = () => gh.calls.filter((c) => c.method === 'PATCH').length;
  await pub.publish('https://dois.trycloudflare.com');
  assert.equal(addr.readPayloadText(gh.content()), 'https://dois.trycloudflare.com');
  assert.equal(pub.status().publish.state, 'ok');
  const before = patches();
  await pub.publish('https://dois.trycloudflare.com');
  assert.equal(patches(), before);
  await pub.publish('https://tres.trycloudflare.com');
  assert.equal(addr.readPayloadText(gh.content()), 'https://tres.trycloudflare.com');
  pub.stop();
});

test('token vencido ao gravar vira erro com aviso; desconectar apaga o token', async () => {
  const gh = fakeGitHub();
  const { pub, file } = makePublisher(gh);
  await pub.connect(TOKEN, null);
  const failing = fakeGitHub({ patchStatus: 401 });
  // Troca só a resposta do PATCH: recria com o mesmo arquivo de configuração.
  const pub2 = createAddressPublisher({
    file, fetchImpl: failing.fetchImpl,
    encrypt: (t) => t, decrypt: (s) => Buffer.from(s.replace('cifrado:', ''), 'base64').toString()
  });
  await pub2.publish('https://quatro.trycloudflare.com');
  assert.equal(pub2.status().publish.state, 'error');
  assert.match(pub2.status().publish.message, /venceu/);
  const s = pub2.disconnect();
  assert.equal(s.connected, false);
  assert.ok(!JSON.parse(fs.readFileSync(file, 'utf8')).token);
  pub.stop(); pub2.stop();
});

test('sem link conectado, publicar não chama o GitHub', async () => {
  const gh = fakeGitHub();
  const { pub } = makePublisher(gh);
  await pub.publish('https://cinco.trycloudflare.com');
  assert.equal(gh.calls.length, 0);
  assert.equal(pub.status().connected, false);
  assert.equal(pub.setAutoTunnel(true).autoTunnel, true);
});
