// Amizades, pedidos de amizade e conversas diretas (DM). Funções puras sobre
// o objeto gravado em friends.json; main.js grava e difunde. Também roda no Node (testes).
(function () {
  const DM_PREFIX = 'dm:';
  const CALL_PREFIX = 'call:';

  function emptyDb() {
    return { friends: {}, requests: [] };
  }

  const fail = (error) => ({ ok: false, error });

  function friendsOf(db, user) {
    return (db.friends[user] || []).slice();
  }

  function areFriends(db, a, b) {
    return !!(db.friends[a] && db.friends[a].includes(b));
  }

  function link(db, a, b) {
    db.friends[a] = [...new Set([...(db.friends[a] || []), b])];
    db.friends[b] = [...new Set([...(db.friends[b] || []), a])];
  }

  const dropRequests = (db, a, b) => {
    db.requests = db.requests.filter((r) => !((r.from === a && r.to === b) || (r.from === b && r.to === a)));
  };

  // Pedido de `from` para `to`. Se `to` já tinha pedido para `from`, vira amizade.
  function sendRequest(db, from, to, { exists, now }) {
    if (!to || from === to) return fail('Escolha outra pessoa.');
    if (!exists(to)) return fail('Não existe conta com esse nome neste servidor do Vox.');
    if (areFriends(db, from, to)) return fail('Vocês já são amigos.');
    if (db.requests.some((r) => r.from === from && r.to === to)) return fail('Pedido já enviado.');
    if (db.requests.some((r) => r.from === to && r.to === from)) {
      dropRequests(db, from, to);
      link(db, from, to);
      return { ok: true, accepted: true };
    }
    db.requests.push({ from, to, at: now });
    return { ok: true, accepted: false };
  }

  function acceptRequest(db, user, from) {
    if (!db.requests.some((r) => r.from === from && r.to === user)) return fail('Pedido não encontrado.');
    dropRequests(db, user, from);
    link(db, user, from);
    return { ok: true };
  }

  // Recusar (quem recebeu) ou cancelar (quem enviou): some o pedido entre os dois.
  function dropRequest(db, user, other) {
    const had = db.requests.some((r) => (r.from === user && r.to === other) || (r.from === other && r.to === user));
    if (!had) return fail('Pedido não encontrado.');
    dropRequests(db, user, other);
    return { ok: true };
  }

  function removeFriend(db, a, b) {
    if (!areFriends(db, a, b)) return fail('Vocês não são amigos.');
    db.friends[a] = db.friends[a].filter((x) => x !== b);
    db.friends[b] = (db.friends[b] || []).filter((x) => x !== a);
    return { ok: true };
  }

  function requestsFor(db, user) {
    return {
      incoming: db.requests.filter((r) => r.to === user).map((r) => ({ user: r.from, at: r.at })),
      outgoing: db.requests.filter((r) => r.from === user).map((r) => ({ user: r.to, at: r.at }))
    };
  }

  // Chave única da conversa direta e da chamada entre duas pessoas (ordem alfabética).
  const pairKey = (prefix, a, b) => prefix + [a, b].sort().join('|');
  const dmKey = (a, b) => pairKey(DM_PREFIX, a, b);
  const callKey = (a, b) => pairKey(CALL_PREFIX, a, b);

  // As duas pessoas de uma chave dm:/call:, ou null.
  function pairOf(key, prefix) {
    if (typeof key !== 'string' || !key.startsWith(prefix)) return null;
    const pair = key.slice(prefix.length).split('|');
    return pair.length === 2 && pair[0] && pair[1] && pair[0] !== pair[1] ? pair : null;
  }

  const isDmKey = (key) => !!pairOf(key, DM_PREFIX);
  const isCallKey = (key) => !!pairOf(key, CALL_PREFIX);

  // O outro participante da conversa/chamada, ou null se `user` não faz parte.
  function otherOf(key, user) {
    const pair = pairOf(key, DM_PREFIX) || pairOf(key, CALL_PREFIX);
    if (!pair || !pair.includes(user)) return null;
    return pair[0] === user ? pair[1] : pair[0];
  }

  // Ler a conversa: só os dois. Escrever e ligar: só se ainda forem amigos.
  function canReadDm(key, user) {
    return isDmKey(key) && !!otherOf(key, user);
  }

  function canWriteDm(db, key, user) {
    const other = isDmKey(key) ? otherOf(key, user) : null;
    return !!other && areFriends(db, user, other);
  }

  const api = {
    DM_PREFIX, CALL_PREFIX,
    emptyDb, friendsOf, areFriends, sendRequest, acceptRequest, dropRequest, removeFriend, requestsFor,
    dmKey, callKey, pairOf, isDmKey, isCallKey, otherOf, canReadDm, canWriteDm
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.VoxFriends = api;
})();
