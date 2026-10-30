# Canais de texto e voz independentes, Ausente e aviso de versão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar canal de texto (sempre 1) de canal de voz (0 ou 1), entrar em `#geral` + "Sala Principal" ao logar, recusar versões incompatíveis com aviso, adicionar "Ausente" manual e a bolinha de status na lista do canal de voz.

**Architecture:** Regras puras em módulos testáveis com `node:test` (`channels.js`, `protocol.js`, `presence.js`, funções novas em `room-state.js`), usados pelo servidor (`main.js`) e pelo cliente (`renderer.js`, carregados no `index.html` antes dele). O servidor troca `join-room`/`leave-room` por `join-text`/`join-voice`/`leave-voice`; o cliente troca `currentRoom` por `currentTextRoom` + `currentVoiceRoom`.

**Tech Stack:** Electron 28, JS puro sem bundler, Socket.io 4, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-30-canais-texto-e-voz-design.md`

## Global Constraints

- Canais de texto: `geral`, `jogos`, `musica`. Canais de voz: `voz-sala`, `voz-jogos`, `voz-musica`. Padrão ao logar: `geral` + `voz-sala`, microfone **aberto**.
- `PROTOCOL_VERSION = 2`. Mensagem exata: `Seu Vox está em uma versão diferente da do servidor. Atualize para entrar.`
- Status: `online`, `away`, `busy`, `invisible`. Auto-ausente após 5 min (`IDLE_MS` existente) só a partir de `online`; ausente manual não volta com atividade.
- Texto da área de chamada sem voz: `Você não está em um canal de voz` (também no painel Participantes). `title` dos botões desativados: `Entre em um canal de voz`.
- Não mexer na criação de peers / sinalização / `renderTiles` / `buildTile` além de renomear a variável de sala (PR #1 reescreve essas partes).
- Branch `feat/canais-texto-voz`, a partir de `feat/temas-avatares`; PR aponta para `feat/temas-avatares`.
- Interface em português; CSS só com tokens de tema (teste `test/css-tokens.test.js` continua valendo).
- Testes e2e: sempre `--mute-audio`, perfis `--user-data-dir=/tmp/vox-*`, encerrar só esses processos (nunca `pkill` amplo: o usuário usa o app ao mesmo tempo), remover só contas de teste do `users.json`.

## Review Focus

1. Clique rápido em dois canais de voz seguidos → termina em **um** só canal de voz (o último), sem peers duplicados nem entrada fantasma em `roomUsers`. *(teste em Task 2: `switchVoice` repetido; e2e em Task 3)*
2. Trocar de canal de texto durante uma chamada com tela compartilhada → chamada, tela e selo AO VIVO continuam; chat troca. *(e2e Task 3)*
3. Cliente antigo (sem `protocol`) num servidor novo e cliente novo num servidor antigo → aviso na tela de login, nada de app "vazio". *(testes Task 1/2; e2e Task 3 simulando servidor antigo)*
4. Sair da voz com câmera/tela ligadas → câmera e tela param, botões ficam desativados, selo some para os outros. *(e2e Task 3)*
5. Ausente manual + atividade (mouse/teclado) → continua Ausente; Online + 5 min parado → Ausente; mexer → Online. *(testes Task 4)*

---

### Task 1: Módulos compartilhados — canais e protocolo

**Files:**
- Create: `channels.js`, `protocol.js`
- Create: `test/channels.test.js`, `test/protocol.test.js`

**Interfaces:**
- Produces (Node `module.exports`; navegador `window.ConcordChannels` / `window.ConcordProtocol`, mesmo padrão de export de `speaking.js`):
  - `channels.js`: `TEXT_CHANNELS: string[]`, `VOICE_CHANNELS: string[]`, `DEFAULT_TEXT_CHANNEL = 'geral'`, `DEFAULT_VOICE_CHANNEL = 'voz-sala'`, `isTextChannel(id): boolean`, `isVoiceChannel(id): boolean`.
  - `protocol.js`: `PROTOCOL_VERSION = 2`, `VERSION_MISMATCH_MESSAGE` (texto exato das Global Constraints), `isCompatible(version): boolean` (`version === PROTOCOL_VERSION`).

- [ ] **Step 1: Testes que falham**
  - `channels`: listas exatas; padrões; `isTextChannel('geral') === true`, `isTextChannel('voz-sala') === false`, `isVoiceChannel('voz-musica') === true`, `isVoiceChannel('geral') === false`, `isTextChannel('qualquer')`, `undefined`, `42` → `false`.
  - `protocol`: `PROTOCOL_VERSION === 2`; mensagem exata; `isCompatible(2) === true`; `isCompatible(undefined)`, `1`, `'2'` → `false`.
- [ ] **Step 2: Rodar** — `npm test` → FAIL (`Cannot find module '../channels.js'`).
- [ ] **Step 3: Implementar** os dois módulos.
- [ ] **Step 4: Rodar** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Canais e protocolo: módulos compartilhados"`.

---

### Task 2: Servidor — texto e voz separados, versão no login

**Files:**
- Modify: `room-state.js` (funções novas), `test/room-state.test.js`
- Modify: `main.js` (handlers `register`, `login`, `logout`, `join-room`→`join-text`/`join-voice`, `leave-room`→`leave-voice`, `update-state`, `save-message`, `get-messages`, `delete-my-messages`, `disconnect`, `removeSocketFromRooms`)

**Interfaces:**
- Consumes: Task 1 (`isTextChannel`, `isVoiceChannel`, `isCompatible`, `PROTOCOL_VERSION`, `VERSION_MISMATCH_MESSAGE`).
- Produces:
  - `room-state.js`:
    - `leaveVoiceRoom(roomUsers: Map, socketId): string|null` — remove o socket de qualquer sala de `roomUsers` em que esteja; apaga a sala se ficar vazia; retorna a sala de onde saiu (ou `null`).
    - `joinVoiceRoom(roomUsers: Map, socketId, room, entry): string|null` — chama `leaveVoiceRoom` antes, depois `roomUsers.get(room).set(socketId, { ...entry, sharing: false })`; retorna a sala anterior (ou `null`).
    - `canUseTextRoom(textRoom, room): boolean` — `room` é canal de texto **e** igual ao `textRoom` do socket.
  - Protocolo de eventos (cliente ↔ servidor):
    - `register`/`login` recebem `{ username, password, protocol }`; incompatível → `callback({ success: false, message: VERSION_MISMATCH_MESSAGE })` **antes** de qualquer outra checagem; sucesso → `{ success: true, username, protocol: PROTOCOL_VERSION }`.
    - `join-text` (room): exige auth e `isTextChannel`; `socket.leave(textRoom anterior)`, `socket.join(room)`, `socket.data.textRoom = room`.
    - `join-voice` (room): exige auth e `isVoiceChannel`; usa `joinVoiceRoom` (entrada com `username`, `muted`, `status` de `socket.data`); se havia sala anterior: `socket.leave(anterior)` e `broadcastRoomUsers(anterior)`; `socket.join(room)`, `socket.data.voiceRoom = room`; `user-joined` (se não invisível); `broadcastRoomUsers(room)`; `broadcastVoiceRooms()`.
    - `leave-voice`: usa `leaveVoiceRoom`; `socket.leave`, `socket.data.voiceRoom = null`, broadcasts.
    - `update-state`: atualiza `socket.data` sempre (mesmo sem voz); entrada de `roomUsers` só se `socket.data.voiceRoom`.
    - `save-message`/`get-messages`/`delete-my-messages`: recusam se `!canUseTextRoom(socket.data.textRoom, room)` (`get-messages` responde `[]`; `delete-my-messages` responde `{ success: false }`).
    - `logout`/`disconnect`: limpam voz (`leaveVoiceRoom` + broadcasts) e `textRoom`.

- [ ] **Step 1: Testes que falham** (`test/room-state.test.js`)
  - `joinVoiceRoom entra e devolve null` — map vazio → `null`; `roomUsers.get('voz-sala').get('a')` tem `username` e `sharing: false`.
  - `joinVoiceRoom troca de sala` — já em `voz-sala`, entra em `voz-jogos` → retorna `'voz-sala'`; `voz-sala` removida (estava só ele); `a` só em `voz-jogos`.
  - `joinVoiceRoom repetido na mesma sala não duplica` — duas vezes `voz-sala` → 1 entrada; `sharing` volta a `false`.
  - `leaveVoiceRoom devolve sala e limpa` — retorna `'voz-sala'`; segunda chamada → `null`.
  - `leaveVoiceRoom mantém sala com outros` — `a` e `b` em `voz-sala`; sai `a` → sala continua com `b`.
  - `canUseTextRoom` — (`'geral'`,`'geral'`) true; (`'geral'`,`'jogos'`) false; (`'geral'`,`'voz-sala'`) false; (`undefined`,`'geral'`) false.
- [ ] **Step 2: Rodar** — FAIL (funções inexistentes).
- [ ] **Step 3: Implementar** as funções e os handlers de `main.js` conforme Produces. Remover `socket.data.room`.
- [ ] **Step 4: Rodar** — `npm test` PASS; `node --check main.js room-state.js`.
- [ ] **Step 5: Commit** — `git commit -m "Servidor: canais de texto e voz separados e versão no login"`.

---

### Task 3: Cliente — modelo texto + voz, entrada automática, aviso de versão

**Files:**
- Modify: `index.html` (remover `#room-screen` e seu CSS; carregar `channels.js`, `protocol.js` antes de `renderer.js`; CSS de botão desativado `.ctrl:disabled` só com tokens; estado vazio da área de chamada)
- Modify: `renderer.js`

**Interfaces:**
- Consumes: Task 1 (`ConcordChannels`, `ConcordProtocol`); Task 2 (eventos).
- Produces (em `renderer.js`):
  - Estado: `currentTextRoom` (string; `''` só antes do login) e `currentVoiceRoom` (string ou `''`), substituindo `currentRoom` em todos os usos (chat e histórico usam texto; mídia, anel de fala, `delete-my-messages`→texto).
  - `joinText(room): void` — emite `join-text`; atualiza título do topo, ícone `#`, placeholder, recarrega histórico (`reloadMessages`), marca canal ativo. Não toca em mídia.
  - `async joinVoice(room): Promise<void>` — se `room === currentVoiceRoom` não faz nada; se havia outra voz, fecha peers (`closeAllPeers`) e limpa `userMap` (sem parar a mídia local); `ensureLocalMedia()`; emite `join-voice`; `sendStatus()`; mostra "Conectado a …"; `startAudioLoop()`; atualiza botões. Guarda de reentrância com token (como o `joinToken` atual) para cliques rápidos.
  - `leaveVoice(): void` — o atual `leaveCall` sem a parte de texto: emite `leave-voice`, para câmera e tela, fecha peers, para mídia local, fecha AudioContext, `sharingScreen = false`, botão Tela volta a `🖥️ Tela`/`warn`, esconde "Conectado", `currentVoiceRoom = ''`, atualiza botões e tiles.
  - `updateVoiceDependentControls(): void` — `btnCam`, `btnScreen`, `btnHangup` com `disabled` e `title = 'Entre em um canal de voz'` quando `!currentVoiceRoom`.
  - `enterApp(username): void` — após login/cadastro OK: `setMyIdentity`, `micEnabled = true`, mostra o app, `joinText(DEFAULT_TEXT_CHANNEL)`, `joinVoice(DEFAULT_VOICE_CHANNEL)`.
  - `login`/`register` enviam `protocol: PROTOCOL_VERSION`; resposta de sucesso sem `isCompatible(res.protocol)` → mostra `VERSION_MISMATCH_MESSAGE` no erro da aba e não entra.
  - Clique em canal: texto → `joinText`; voz → `joinVoice`. "Desconectar" e ✕ → `leaveVoice`.
  - Sem voz: área de chamada e painel Participantes mostram `Você não está em um canal de voz`.
  - Logout: `leaveVoice()` e `currentTextRoom = ''`.

- [ ] **Step 1: `npm test`** (sem testes novos de unidade nesta tarefa: a lógica pura já está nas Tasks 1–2; esta tarefa é ligação de interface verificada por e2e) e implementar conforme Produces.
- [ ] **Step 2: `npm test`** → PASS; `node --check renderer.js`.
- [ ] **Step 3: e2e com 3 instâncias** (driver CDP do scratchpad, `--mute-audio`, perfis `/tmp/vox-*`):
  - Login de A: `currentTextRoom === 'geral'`, `currentVoiceRoom === 'voz-sala'`, `micEnabled === true`, `#room-screen` não existe; A aparece na lista de "Sala Principal" em B/C.
  - A troca para `#jogos`: `currentVoiceRoom` continua `voz-sala`, `peers.size` igual a antes, título `jogos`; mensagem enviada por A em `#jogos` chega em B só depois de B entrar em `#jogos`.
  - A clica `voz-jogos` e logo `voz-musica` (sem esperar): no fim A está só em `voz-musica` (em `voice-rooms` de B) e `peers.size` corresponde aos ocupantes de `voz-musica`.
  - A compartilha (canvas falso) e troca de canal de texto: selo AO VIVO continua em B.
  - A clica "Desconectar": `btnCam.disabled && btnScreen.disabled && btnHangup.disabled`; selo some em B; área de chamada mostra o texto exato; A continua em `#jogos`.
  - Versões (o servidor é sempre a primeira instância aberta, que ocupa a porta 3000; antes, confirmar que a porta 3000 está livre — se o app do usuário estiver aberto, pedir para ele fechar):
    - Servidor antigo: abrir primeiro uma instância de um worktree da `main`, depois uma desta branch → login da branch mostra a mensagem exata e não entra no app.
    - Cliente antigo: abrir primeiro uma instância desta branch, depois uma da `main` → login da `main` mostra a mensagem exata (vinda do servidor).
  - Console sem erros nas 3 instâncias.
- [ ] **Step 4: Commit** — `git commit -m "Cliente: canais de texto e voz separados, entrada automática e aviso de versão"`.

---

### Task 4: Status Ausente manual e bolinha na lista do canal de voz

**Files:**
- Create: `presence.js`, `test/presence.test.js`
- Modify: `index.html` (botão `data-status="away"` entre Online e Ocupado; carregar `presence.js`; CSS da bolinha sobre o avatar da lista, borda `var(--bg-2)`)
- Modify: `renderer.js` (`effectiveStatus`, timer de inatividade, menu de status, `renderMembers` da lista de voz)
- Modify: `test/css-tokens.test.js` se o seletor da bolinha precisar de verificação estrutural (opcional)

**Interfaces:**
- Produces (`window.ConcordPresence` / `module.exports`):
  - `STATUS_MODES = ['online', 'away', 'busy', 'invisible']`.
  - `effectiveStatus(mode, autoAway): string` — `mode === 'online' && autoAway ? 'away' : mode`.
  - `onIdle(mode): boolean` — novo `autoAway` após 5 min parado: `mode === 'online'`.
  - `onActivity(autoAway): boolean` — sempre `false` (só desfaz o automático; o manual é `mode`).
- `renderer.js` usa essas funções; escolher "Ausente" no menu → `statusMode = 'away'`, `autoAway = false`.
- Lista do canal de voz: cada `.voice-user` ganha `<span class="status-dot <status>">` dentro de um wrapper do avatar (mesmo padrão de `.avatar-wrap` + `#my-status-dot`), com o `status` vindo de `voice-rooms`.

- [ ] **Step 1: Testes que falham** (`test/presence.test.js`)
  - `ausente manual não volta com atividade` — `effectiveStatus('away', onActivity(false)) === 'away'`.
  - `online parado vira ausente` — `effectiveStatus('online', onIdle('online')) === 'away'`.
  - `online volta com atividade` — `effectiveStatus('online', onActivity(true)) === 'online'`.
  - `ocupado e invisível não viram ausente` — `onIdle('busy') === false`, `onIdle('invisible') === false`.
  - `STATUS_MODES` exato.
- [ ] **Step 2: Rodar** — FAIL.
- [ ] **Step 3: Implementar** `presence.js` e as mudanças de `renderer.js`/`index.html`.
- [ ] **Step 4: Rodar** — `npm test` PASS; `node --check renderer.js`.
- [ ] **Step 5: e2e** (2 instâncias): A escolhe Ausente → em B, bolinha `.status-dot.away` no avatar de A na lista de voz e no painel de membros; disparar atividade em A (`document.dispatchEvent(new MouseEvent('mousemove'))`) → `effectiveStatus()` continua `'away'` e B continua vendo amarelo; A escolhe Online → B vê verde. (O caminho automático de 5 min fica coberto pelos testes de unidade do Step 1.) Captura da lista com anel + bolinha em Escuro e Claro.
- [ ] **Step 6: Commit** — `git commit -m "Status Ausente manual e bolinha de status na lista de voz"`.

---

### Task 5: Documentação

**Files:**
- Modify: `AGENTS.md` (eventos `join-text`/`join-voice`/`leave-voice`, `PROTOCOL_VERSION` e quando subir, `channels.js`/`protocol.js`/`presence.js` no mapa de arquivos, invariantes novos: sempre 1 texto, no máx. 1 voz, entrada automática, Cam/Tela só com voz, status Ausente manual, sem tela de sala)
- Modify: `README.md` (recursos: canais de texto e voz simultâneos; Ausente manual; aviso de versão)

- [ ] **Step 1: Atualizar.**
- [ ] **Step 2: `npm test`** → PASS.
- [ ] **Step 3: Commit** — `git commit -m "Docs: canais de texto e voz, Ausente e versão"`.
