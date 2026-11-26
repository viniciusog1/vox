const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ice = require('../src/shared/ice-servers.js');
const { createRelay } = require('../src/main/relay.js');

test('limpa a lista de servidores: só stun/turn/turns, sem a porta 53 (o navegador bloqueia)', () => {
  const cf = {
    iceServers: {
      urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp',
        'turns:turn.cloudflare.com:443?transport=tcp', 'http://ruim', 5],
      username: 'u', credential: 'c'
    }
  };
  assert.deepEqual(ice.cleanIceServers(cf.iceServers), [{
    urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
    username: 'u', credential: 'c'
  }]);
  assert.deepEqual(ice.cleanIceServers([{ urls: 'turn:a:3478', username: 'x', credential: 'y' }, { urls: [] }, null, 'x']),
    [{ urls: ['turn:a:3478'], username: 'x', credential: 'y' }]);
  assert.deepEqual(ice.cleanIceServers({ urls: ['turn:a'] }), [], 'turn sem usuário e senha não serve');
  assert.deepEqual(ice.cleanIceServers('lixo'), []);
});

test('com retransmissão, a lista final mantém o STUN de sempre e acrescenta o resto', () => {
  assert.deepEqual(ice.withDefaults([]), [ice.DEFAULT_STUN]);
  const turn = [{ urls: ['turn:a:3478'], username: 'x', credential: 'y' }];
  assert.deepEqual(ice.withDefaults(turn), [ice.DEFAULT_STUN, ...turn]);
  assert.equal(ice.hasRelay(turn), true);
  assert.equal(ice.hasRelay([ice.DEFAULT_STUN]), false);
});

test('servidor próprio digitado à mão', () => {
  assert.deepEqual(ice.parseManual({ urls: ' turn:meu.host:3478 , turns:meu.host:5349 ', username: 'vox', credential: 'segredo' }),
    { ok: true, servers: [{ urls: ['turn:meu.host:3478', 'turns:meu.host:5349'], username: 'vox', credential: 'segredo' }] });
  assert.equal(ice.parseManual({ urls: 'meu.host:3478', username: 'a', credential: 'b' }).ok, false);
  assert.equal(ice.parseManual({ urls: 'turn:x', username: '', credential: 'b' }).ok, false);
});

test('rota pela retransmissão: o candidato local do par escolhido é do tipo relay', () => {
  const stats = new Map([
    ['p', { type: 'candidate-pair', nominated: true, state: 'succeeded', localCandidateId: 'l1' }],
    ['l1', { type: 'local-candidate', candidateType: 'relay' }],
    ['l2', { type: 'local-candidate', candidateType: 'host' }]
  ]);
  assert.equal(ice.usesRelay(stats), true);
  stats.get('p').localCandidateId = 'l2';
  assert.equal(ice.usesRelay(stats), false);
  assert.equal(ice.usesRelay(new Map()), false);
});

// ---------- Lado do host ----------
const encrypt = (t) => Buffer.from('c:' + t).toString('base64');
const decrypt = (b) => { const s = Buffer.from(b, 'base64').toString(); if (!s.startsWith('c:')) throw new Error('x'); return s.slice(2); };
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vox-relay-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'retransmissao.json');
}
const CF_OK = { iceServers: { urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'gerado', credential: 'temporaria' } };
function fakeFetch(responses) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body || '{}') });
    const r = responses.shift() || { status: 200, body: CF_OK };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  f.calls = calls;
  return f;
}

test('desligada: nada além do STUN', async (t) => {
  const relay = createRelay({ file: temp(t), fetchImpl: fakeFetch([]), encrypt, decrypt });
  assert.equal(relay.status().mode, 'off');
  assert.deepEqual(await relay.iceServers(), []);
});

test('Cloudflare: valida a chave, guarda o token cifrado e gera credenciais temporárias', async (t) => {
  const file = temp(t);
  let clock = 1_000_000;
  const f = fakeFetch([]);
  const relay = createRelay({ file, fetchImpl: f, encrypt, decrypt, now: () => clock });
  const st = await relay.configure({ mode: 'cloudflare', keyId: 'abc123', apiToken: 'TOKEN-SECRETO' });
  assert.equal(st.mode, 'cloudflare');
  assert.equal(st.state, 'ok');
  assert.match(f.calls[0].url, /^https:\/\/rtc\.live\.cloudflare\.com\/v1\/turn\/keys\/abc123\/credentials\/generate-ice-servers$/);
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer TOKEN-SECRETO');
  assert.ok(f.calls[0].body.ttl >= 3600 && f.calls[0].body.ttl <= 172800);
  assert.ok(!fs.readFileSync(file, 'utf8').includes('TOKEN-SECRETO'), 'token cifrado no arquivo');
  assert.ok(!JSON.stringify(st).includes('TOKEN-SECRETO'), 'status não devolve o token');

  const list = await relay.iceServers();
  assert.equal(list[0].username, 'gerado');
  assert.ok(list[0].urls.every((u) => !/:53\b/.test(u)));
  await relay.iceServers();
  assert.equal(f.calls.length, 1, 'reaproveita enquanto vale');
  clock += 24 * 3600 * 1000;
  await relay.iceServers();
  assert.equal(f.calls.length, 2, 'renova antes de vencer');

  const reopened = createRelay({ file, fetchImpl: fakeFetch([]), encrypt, decrypt, now: () => clock });
  assert.equal(reopened.status().mode, 'cloudflare');
  assert.equal((await reopened.iceServers())[0].credential, 'temporaria');
});

test('Cloudflare recusou: mostra o motivo e não troca a configuração que funcionava', async (t) => {
  const file = temp(t);
  const relay = createRelay({ file, fetchImpl: fakeFetch([{ status: 200, body: CF_OK }, { status: 401, body: {} }]), encrypt, decrypt });
  await relay.configure({ mode: 'cloudflare', keyId: 'abc', apiToken: 'bom' });
  await assert.rejects(relay.configure({ mode: 'cloudflare', keyId: 'abc', apiToken: 'ruim' }), /token/i);
  assert.equal(relay.status().mode, 'cloudflare');
  await assert.rejects(relay.configure({ mode: 'cloudflare', keyId: '', apiToken: 'x' }), /chave/i);
});

test('falha temporária ao renovar: segue com as credenciais que ainda valem e avisa no status', async (t) => {
  let clock = 0;
  const relay = createRelay({ file: temp(t), fetchImpl: fakeFetch([{ status: 200, body: CF_OK }, { status: 500, body: {} }]), encrypt, decrypt, now: () => clock });
  await relay.configure({ mode: 'cloudflare', keyId: 'abc', apiToken: 'bom' });
  clock += 23 * 3600 * 1000; // perto de vencer, mas ainda válida
  assert.equal((await relay.iceServers())[0].username, 'gerado');
  assert.equal(relay.status().state, 'error');
});

test('servidor próprio e desligar', async (t) => {
  const file = temp(t);
  const relay = createRelay({ file, fetchImpl: fakeFetch([]), encrypt, decrypt });
  await relay.configure({ mode: 'manual', urls: 'turn:meu.host:3478', username: 'vox', credential: 'senha-turn' });
  assert.deepEqual(await relay.iceServers(), [{ urls: ['turn:meu.host:3478'], username: 'vox', credential: 'senha-turn' }]);
  assert.ok(!fs.readFileSync(file, 'utf8').includes('senha-turn'));
  assert.equal(relay.status().urls, 'turn:meu.host:3478');
  await assert.rejects(relay.configure({ mode: 'manual', urls: 'http://x', username: 'a', credential: 'b' }), /turn:/);
  await relay.configure({ mode: 'off' });
  assert.deepEqual(await relay.iceServers(), []);
});

test('renderer usa a lista do host, mostra a rota e o host só manda para quem entrou', () => {
  const src = (...p) => fs.readFileSync(path.join(__dirname, '..', 'src', ...p), 'utf8').replace(/\r\n/g, '\n');
  const js = src('renderer', 'renderer.js');
  assert.match(js, /new RTCPeerConnection\(peerConfig\(\)\)/);
  assert.match(js, /socket\.on\('ice-servers'/);
  assert.match(js, /setConfiguration/);
  assert.match(js, /retransmitido/);
  const main = src('main', 'main.js');
  assert.match(main.slice(main.indexOf('function signIn'), main.indexOf('function signIn') + 600), /sendIceServers\(socket\)/);
});
