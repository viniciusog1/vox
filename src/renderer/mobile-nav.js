// Gavetas do layout de celular (mobile.css, até 760 px): ☰ abre servidores e canais,
// o ícone de pessoas abre Membros. Escolher um canal ou conversa fecha a gaveta.
// Em telas largas os botões ficam escondidos e nada disto tem efeito.
(function () {
  const app = document.getElementById('app');
  const btnNav = document.getElementById('btn-nav');
  const btnMembers = document.getElementById('btn-members-toggle');
  const backdrop = document.getElementById('nav-backdrop');
  if (!app || !btnNav || !btnMembers || !backdrop) return;
  const narrow = window.matchMedia('(max-width: 760px)');

  function set(which) {
    app.classList.toggle('nav-open', which === 'nav');
    app.classList.toggle('members-open', which === 'members');
    btnNav.setAttribute('aria-expanded', String(which === 'nav'));
    btnMembers.setAttribute('aria-expanded', String(which === 'members'));
  }
  const close = () => set(null);

  btnNav.addEventListener('click', () => set(app.classList.contains('nav-open') ? null : 'nav'));
  btnMembers.addEventListener('click', () => set(app.classList.contains('members-open') ? null : 'members'));
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  narrow.addEventListener('change', close);

  // Canal de texto, de voz ou conversa direta escolhido: volta para a conversa.
  // Botões de engrenagem/menu (abrem janelas) e a troca de servidor no rail mantêm a gaveta.
  document.getElementById('channel-scroll').addEventListener('click', (e) => {
    if (!narrow.matches) return;
    if (!e.target.closest('.channel') || e.target.closest('.channel-edit, .voice-user')) return;
    setTimeout(close, 0);
  });

  // Abriu um cartão de perfil ou janela por cima: fecha a gaveta de membros.
  document.getElementById('members').addEventListener('click', (e) => {
    if (narrow.matches && e.target.closest('.member')) setTimeout(close, 0);
  });

  // Página servida por http fora do próprio PC: o navegador bloqueia microfone e câmera.
  const insecure = document.getElementById('web-insecure');
  if (insecure && window.VOX_WEB && !window.isSecureContext) insecure.classList.remove('hidden');
})();
