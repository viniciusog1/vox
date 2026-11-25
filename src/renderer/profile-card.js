// Cartão de perfil: clique num integrante (lista da voz, Membros, chamada, chat ou amigos) e veja
// foto, status, cargo e servidores em comum, com amizade, mensagem, ligação e volumes.
// Carregado depois de renderer.js, de quem usa o estado e as ações. As funções puras
// (profileOf, placeCard) também são módulo Node (testes).
(function () {
  const MARGIN = 8;

  // O que o cartão mostra. `call` = pessoas da minha chamada, ou null fora da voz.
  function profileOf({ user, me, friends, members, servers, serverId, call }) {
    const member = members.find((m) => m.username === user) || null;
    const server = servers.find((s) => s.id === serverId && s.members.includes(user)) || null;
    const inCall = (call || []).find((u) => u.username === user) || null;
    const has = (list) => list.some((r) => r.user === user);
    const relation = user === me ? 'me'
      : friends.friends.includes(user) ? 'friend'
      : has(friends.incoming) ? 'incoming'
      : has(friends.outgoing) ? 'outgoing' : 'none';
    const online = !!(member && member.online);

    let actions = [];
    if (relation === 'me') actions = [{ id: 'settings', icon: 'settings', label: 'Editar perfil', kind: 'primary' }];
    else if (!member) actions = [];
    else if (relation === 'none') actions = [{ id: 'request', icon: 'user-plus', label: 'Adicionar amigo', kind: 'primary' }];
    else if (relation === 'outgoing') actions = [{ id: 'cancel', icon: 'x', label: 'Cancelar pedido enviado' }];
    else if (relation === 'incoming') {
      actions = [
        { id: 'accept', icon: 'check', label: 'Aceitar amizade', kind: 'primary' },
        { id: 'refuse', icon: 'x', label: 'Recusar' }
      ];
    } else {
      actions = [{ id: 'message', icon: 'message-circle', label: 'Mensagem', kind: 'primary' }];
      if (online && !inCall) actions.push({ id: 'call', icon: 'phone', label: 'Ligar' });
      actions.push({ id: 'unfriend', icon: 'user-x', label: 'Desfazer amizade', kind: 'danger' });
    }

    return {
      user,
      relation,
      exists: !!member,
      status: online ? member.status || 'online' : 'offline',
      role: !server ? null : server.owner === user ? 'owner' : server.admins.includes(user) ? 'admin' : null,
      mutual: relation === 'me' ? [] : servers.filter((s) => s.members.includes(user)).map((s) => s.name),
      actions,
      volumes: !inCall || relation === 'me' ? [] : inCall.sharing ? ['voice', 'screen'] : ['voice']
    };
  }

  // Ao lado do que foi clicado (à direita; sem espaço, à esquerda), sempre dentro da janela.
  function placeCard(anchor, card, win) {
    const clamp = (v, max) => Math.max(MARGIN, Math.min(v, max - MARGIN));
    let left = anchor.right + MARGIN;
    if (left + card.width > win.width - MARGIN) left = anchor.left - MARGIN - card.width;
    return { left: clamp(left, win.width - card.width), top: clamp(anchor.top, win.height - card.height) };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { profileOf, placeCard }; return; }

  const ROLES = { owner: ['crown', 'Dono do servidor'], admin: ['shield', 'Administrador'] };
  // Linhas inteiras abrem o cartão; nos outros lugares, só o avatar (e o nome).
  const TRIGGERS = '.member, .voice-user, .tile > .avatar, .tile-name, .msg-row > .avatar, .msg-user, ' +
    '.friend-row .avatar, .server-member .avatar';

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  };

  const card = el('div', 'profile-card hidden');
  card.setAttribute('role', 'dialog');
  card.tabIndex = -1;
  const head = el('div', 'profile-head');
  const volumesBox = el('div', 'profile-volumes');
  const actionsBox = el('div', 'profile-actions');
  card.append(head, volumesBox, actionsBox);
  document.body.appendChild(card);

  let openUser = null;
  let anchorRect = null;

  // Nome de quem foi clicado: o próprio elemento, o avatar dentro dele ou o da mensagem.
  function userOf(trigger) {
    if (trigger.dataset.user) return trigger.dataset.user;
    const row = trigger.closest('.msg-row') || trigger;
    const avatar = row.querySelector('.avatar');
    return (avatar && avatar.dataset.user) || '';
  }

  const current = () => profileOf({
    user: openUser, me: currentUser, friends: friendsState, members: serverMembers, servers,
    serverId: currentServerId, call: currentVoiceRoom ? voiceRooms[currentVoiceRoom] || [] : null
  });

  function voiceRoomOf(user) {
    const entry = Object.entries(voiceRooms).find(([, list]) => list.some((u) => u.username === user));
    return entry ? entry[0] : null;
  }

  function renderHead(p) {
    const photoBtn = el('button', 'profile-photo');
    photoBtn.type = 'button';
    photoBtn.appendChild(makeAvatar(p.user));
    const photo = photoBtn.querySelector('img');
    photoBtn.disabled = !photo;
    if (photo) {
      photoBtn.title = 'Ver a foto';
      photoBtn.setAttribute('aria-label', `Ver a foto de ${p.user}`);
      photoBtn.addEventListener('click', () => openImageViewer(photo.src, `Foto de ${p.user}`));
    }
    if (p.status !== 'offline') photoBtn.appendChild(el('span', 'status-dot ' + p.status));

    const info = el('div', 'profile-info');
    const line = (icon, text) => {
      const row = el('div', 'profile-line');
      if (icon) row.appendChild(VoxIcons.icon(icon, 14));
      row.appendChild(el('span', '', text));
      info.appendChild(row);
    };
    line(null, p.exists ? STATUS_LABELS[p.status] || 'Offline' : 'Esta conta não existe mais');
    if (p.role) line(...ROLES[p.role]);
    const room = p.exists && voiceRoomOf(p.user);
    if (room) line('volume-2', 'Em voz: ' + roomDisplayName(room));
    if (p.mutual.length) line('users', `${p.mutual.length === 1 ? 'Servidor' : 'Servidores'} em comum: ${p.mutual.join(', ')}`);
    head.replaceChildren(el('div', 'profile-banner'), photoBtn, el('div', 'profile-name', p.user), info);
  }

  // Só remonta se os controles mudarem, para não interromper quem está arrastando a barra.
  function renderVolumes(p) {
    const key = p.user + ':' + p.volumes.join();
    if (volumesBox.dataset.key === key) return;
    volumesBox.dataset.key = key;
    volumesBox.replaceChildren();
    for (const kind of p.volumes) {
      volumesBox.appendChild(el('div', 'profile-label', kind === 'voice' ? 'Volume da voz' : 'Volume da transmissão'));
      volumesBox.appendChild(makeUserVolume(kind, p.user));
    }
  }

  function leaveTo(action) {
    close();
    serverModal.classList.add('hidden');
    return action();
  }

  const ACTIONS = {
    request: (u) => friendAction('friend-request', u),
    cancel: (u) => friendAction('friend-drop', u),
    refuse: (u) => friendAction('friend-drop', u),
    accept: (u) => friendAction('friend-accept', u),
    unfriend: (u) => unfriend(u),
    message: (u) => leaveTo(() => openDm(u)),
    call: (u) => leaveTo(() => startCall(u)),
    settings: () => leaveTo(() => { btnSettings.click(); showSettingsTab('conta'); })
  };

  function renderActions(p) {
    const key = p.user + ':' + p.actions.map((a) => a.id).join();
    if (actionsBox.dataset.key === key) return;
    const hadFocus = actionsBox.contains(document.activeElement);
    actionsBox.dataset.key = key;
    actionsBox.replaceChildren(...p.actions.map((a) => {
      const b = el('button', { primary: 'btn-primary', danger: 'btn-danger-outline' }[a.kind] || 'btn-secondary');
      b.type = 'button';
      b.dataset.action = a.id;
      b.append(VoxIcons.icon(a.icon, 16), el('span', '', a.label));
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await ACTIONS[a.id](p.user); } finally { b.disabled = false; }
      });
      return b;
    }));
    if (hadFocus) card.focus({ preventScroll: true });
  }

  function render() {
    const p = current();
    card.setAttribute('aria-label', `Perfil de ${p.user}`);
    renderHead(p);
    renderVolumes(p);
    renderActions(p);
    const pos = placeCard(anchorRect, { width: card.offsetWidth, height: card.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight });
    card.style.left = pos.left + 'px';
    card.style.top = pos.top + 'px';
  }

  function open(user, anchor) {
    if (!user || !currentUser) return;
    openUser = user;
    anchorRect = anchor.getBoundingClientRect();
    card.classList.remove('hidden');
    // O volume pode ter mudado pela barra do tile com o cartão fechado
    delete volumesBox.dataset.key;
    render();
    card.focus({ preventScroll: true });
  }

  function close() {
    if (!openUser) return;
    openUser = null;
    card.classList.add('hidden');
  }

  function refresh() {
    if (!openUser) return;
    if (currentUser) render();
    else close();
  }

  document.addEventListener('click', (e) => {
    // composedPath: um botão do cartão pode ter saído da tela durante o próprio clique
    if (e.composedPath().includes(card) || e.target.closest('#image-viewer')) return;
    const trigger = e.target.closest(TRIGGERS);
    const user = trigger && userOf(trigger);
    if (!user || user === openUser) { close(); return; }
    open(user, trigger);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openUser && imageViewer.classList.contains('hidden')) {
      const user = openUser;
      close();
      const row = [...document.querySelectorAll('.member, .voice-user')].find((r) => userOf(r) === user);
      if (row) row.focus({ preventScroll: true });
    } else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.member, .voice-user')) {
      e.preventDefault();
      open(userOf(e.target), e.target);
    }
  });

  // Clicar no player do YouTube (iframe) não gera clique aqui, só tira o foco da janela.
  window.addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') close();
  }, 0));
  window.addEventListener('resize', close);

  // Depois dos tratadores de renderer.js, que atualizam o estado.
  ['friends', 'servers', 'server-members', 'voice-rooms', 'room-users'].forEach((event) => socket.on(event, refresh));

  window.VoxProfile = { open, close };
})();
