# Música do YouTube na chamada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fila de músicas do YouTube por canal de voz, tocada em sincronia no player oficial de cada pessoa, exibida como um tile na grade da chamada.

**Architecture:** Regras puras e testadas em `youtube.js` (links e oEmbed) e `music-state.js` (fila, pausa, posição, ressincronização), usadas pelo servidor (`main.js`) e pelo cliente (`renderer.js`). O servidor guarda o estado por canal de voz e difunde `music-state`; cada cliente controla um player IFrame do YouTube persistente e só o ajusta para seguir o estado.

**Tech Stack:** Electron 28, JS puro, Socket.io 4, YouTube IFrame Player API, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-30-musica-youtube-design.md`

## Global Constraints

- Nunca baixar/extrair áudio do YouTube; player oficial sempre visível (mín. 200×200), nada sobreposto a ele; `playerVars`: `controls: 0`, `disablekb: 1`, `playsinline: 1`, `rel: 0`.
- `Referer: https://github.com/viniciusog1/vox` injetado só em requisições `https://www.youtube.com/*`, `https://*.youtube.com/*`, `https://*.googlevideo.com/*` (`session.defaultSession.webRequest.onBeforeSendHeaders`); a página continua em `loadFile`.
- `PROTOCOL_VERSION = 3`.
- Limite: 50 músicas por canal. Tolerância de sincronização: 2 s. Reenvio periódico de `music-state`: 15 s enquanto toca. Timeout do oEmbed: 4 s.
- Textos exatos: `Link do YouTube inválido` · `Esse vídeo não pode ser tocado aqui (privado, removido ou com incorporação desativada).` · `A fila está cheia (50 músicas).` · `Não foi possível tocar «<título>»` · `Cole um link do YouTube…` · `adicionada por alguém` (quem adicionou estava invisível).
- Música só para quem está no canal de voz; qualquer membro pode adicionar, remover, pausar/continuar e pular. Volume só local, `localStorage['concord-music-volume']` (0–100, padrão 50).
- CSS só com tokens de tema (`test/css-tokens.test.js`); interface em português; sem dependências novas.
- Branch `feat/musica` (a partir de `main`).
- e2e: o controlador confere `lsof -nP -iTCP:3000 -sTCP:LISTEN` antes de despachar e informa no prompt; implementador confere de novo **em passo separado** e não roda e2e se a porta for de um processo que não seja `--user-data-dir=/tmp/vox-*`. Sempre `--mute-audio`; encerrar só os próprios processos; contas de teste `e2e_*` removidas depois (nunca `vinicius`). Vídeos de teste: `M7lc1UVf-VE` e `aqz-KE-bpKQ`.

## Review Focus

1. Duas pessoas clicam ⏭ ao mesmo tempo (ou o vídeo termina em vários clientes) → pula exatamente uma música. *(testes Task 2)*
2. Pessoa entra no canal no meio da música → começa no mesmo minuto (±2 s); sai da voz → música para só para ela. *(e2e Task 4)*
3. Mudança na grade (alguém entra/sai, câmera liga) durante a música → o player não recarrega nem reinicia. *(e2e Task 4)*
4. Link com parâmetros extras (`&t=42s`, `&list=…`, `youtu.be/ID?si=…`) → aceito; link de outro site, texto ou id inválido → `Link do YouTube inválido`. *(testes Task 1)*
5. Vídeo privado/removido/sem incorporação → recusado ao colar (oEmbed 401/404); oEmbed fora do ar → aceito com título = id. *(testes Task 1)*

---

### Task 1: Links do YouTube e consulta oEmbed

**Files:**
- Create: `youtube.js`, `test/youtube.test.js`

**Interfaces:**
- Produces (dual export: `module.exports` / `window.ConcordYouTube`, padrão de `speaking.js`):
  - `parseYouTubeId(input: unknown): string|null` — aceita `youtube.com/watch?v=ID`, `m.youtube.com/watch?v=ID`, `music.youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID`, `youtube.com/embed/ID`, com ou sem `https://`/`www.`, ignorando outros parâmetros; ID = `/^[A-Za-z0-9_-]{11}$/`.
  - `thumbnailUrl(id): string` → `https://i.ytimg.com/vi/<id>/mqdefault.jpg`.
  - `async lookupVideo(id, fetchImpl = fetch, timeoutMs = 4000): Promise<{ ok: true, title, thumbnail } | { ok: false }>` — GET `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`; 200 → `{ ok: true, title: json.title, thumbnail: json.thumbnail_url || thumbnailUrl(id) }`; 401/404 → `{ ok: false }`; outro status, erro de rede ou timeout (`AbortController`) → `{ ok: true, title: id, thumbnail: thumbnailUrl(id) }`.

- [ ] **Step 1: Testes que falham**
  - `parseYouTubeId aceita formatos` — para cada um dos formatos acima com id `dQw4w9WgXcQ`, mais `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123`, `https://youtu.be/dQw4w9WgXcQ?si=abc` → `'dQw4w9WgXcQ'`.
  - `parseYouTubeId recusa` — `''`, `'abc'`, `'https://vimeo.com/123'`, `'https://www.youtube.com/watch?v=curto'`, `'https://youtube.com/watch'`, `null`, `42` → `null`.
  - `lookupVideo 200` — fetch falso `{ status: 200, ok: true, json: async () => ({ title: 'X', thumbnail_url: 'T' }) }` → `{ ok: true, title: 'X', thumbnail: 'T' }`; e a URL chamada contém `oembed?url=https://www.youtube.com/watch?v=<id>&format=json`.
  - `lookupVideo 401 e 404 recusam` → `{ ok: false }`.
  - `lookupVideo erro de rede aceita com fallback` — fetch que rejeita → `{ ok: true, title: id, thumbnail: thumbnailUrl(id) }`.
  - `lookupVideo timeout` — fetch que nunca resolve (mas respeita `signal`), `timeoutMs = 50` → fallback em < 500 ms.
- [ ] **Step 2: Rodar** — `npm test` → FAIL (`Cannot find module '../youtube.js'`).
- [ ] **Step 3: Implementar** `youtube.js`.
- [ ] **Step 4: Rodar** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "Música: links do YouTube e consulta oEmbed"`.

---

### Task 2: Regras da fila (módulo puro)

**Files:**
- Create: `music-state.js`, `test/music-state.test.js`

**Interfaces:**
- Produces (dual export: `module.exports` / `window.ConcordMusic`):
  - `MAX_QUEUE = 50`, `SYNC_TOLERANCE_MS = 2000`, `RESYNC_INTERVAL_MS = 15000`.
  - `createMusicState(): { queue: [], playing: false, positionMs: 0, startedAt: null }`.
  - `addTrack(state, item: { id, videoId, title, thumbnail, addedBy|null }, now): { ok: true } | { ok: false, error: 'full' }` — fila vazia → item vira atual tocando do zero (`playing = true`, `positionMs = 0`, `startedAt = now`).
  - `removeTrack(state, itemId, now): boolean` — remove; se era o atual (índice 0), a próxima começa do zero tocando.
  - `advanceIfCurrent(state, itemId, now): boolean` — só se `state.queue[0]?.id === itemId`: remove a atual, próxima do zero tocando; fila vazia → `playing = false`. Usado por `music-skip`, `music-ended`, `music-error`.
  - `endedIfCurrent(state, itemId, now): boolean` — igual a `advanceIfCurrent`, mas ignora (retorna false) se `!state.playing`.
  - `togglePause(state, now): void` — pausando: `positionMs = positionAt(state, now)`, `startedAt = null`; continuando: `startedAt = now`. Sem atual → nada.
  - `positionAt(state, now): number` — `playing ? positionMs + (now - startedAt) : positionMs`.
  - `toPublic(state, now): { queue, playing, positionMs: positionAt(state, now), serverNow: now }`.
  - `targetPositionMs(pub, clientNow, receivedAtClient): number` — `pub.playing ? pub.positionMs + (clientNow - receivedAtClient) : pub.positionMs` (offset estimado no recebimento, sem compensar latência).
  - `needsSeek(currentMs, targetMs): boolean` — `Math.abs(currentMs - targetMs) > SYNC_TOLERANCE_MS`.

- [ ] **Step 1: Testes que falham**
  - `primeira música começa tocando do zero` (now=1000) → `playing true`, `positionAt(s, 4000) === 3000`.
  - `fila cheia` — 50 itens ok, 51º → `{ ok: false, error: 'full' }`, fila com 50.
  - `pular duas vezes o mesmo item pula uma música só` — A,B,C; `advanceIfCurrent(s,'A')` true, de novo `'A'` false; atual B.
  - `terminar com a música pausada é ignorado` — pausa; `endedIfCurrent(s,'A')` false.
  - `pausar e continuar mantém a posição` — toca em 0, pausa em 5000 → `positionAt(s, 99999) === 5000`; continua em 100000 → `positionAt(s, 101000) === 6000`.
  - `remover a atual começa a próxima do zero`; `remover outra não mexe na atual`.
  - `fim da fila para` — último `advanceIfCurrent` → fila vazia, `playing false`.
  - `toPublic e targetPositionMs` — estado tocando com `positionMs` 10000 publicado; cliente recebe em 500 e consulta em 2500 → 12000; pausado → valor fixo.
  - `needsSeek` — (10000, 11900) false; (10000, 12100) true.
- [ ] **Step 2: Rodar** — FAIL.
- [ ] **Step 3: Implementar** `music-state.js`.
- [ ] **Step 4: Rodar** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "Música: regras da fila e sincronização"`.

---

### Task 3: Servidor — eventos de música, Referer e versão 3

**Files:**
- Modify: `main.js`, `protocol.js` (`PROTOCOL_VERSION = 3`), `test/protocol.test.js` (valor 3)

**Interfaces:**
- Consumes: Task 1 (`parseYouTubeId`, `lookupVideo`), Task 2 (todas as funções de fila, `toPublic`, `RESYNC_INTERVAL_MS`).
- Produces (eventos; todos exigem auth e `socket.data.voiceRoom`, senão callback `{ ok: false }` e nada muda):
  - `music-add` (url, cb) → `parseYouTubeId` null → `cb({ ok: false, message: 'Link do YouTube inválido' })`; `lookupVideo` `{ ok: false }` → mensagem de vídeo indisponível exata; `addTrack` cheio → mensagem de fila cheia exata; sucesso → `cb({ ok: true })` e difunde. `addedBy` = username, ou `null` se o status do socket for `invisible`. `id` do item = string única (ex.: `crypto.randomUUID()`).
  - `music-remove` (itemId), `music-skip` (itemId), `music-toggle`, `music-ended` (itemId), `music-error` ({ itemId, code }) → funções da Task 2; difunde se mudou. `music-error` que pulou a atual também emite para o canal `music-notice` com `{ text: 'Não foi possível tocar «<título>»' }`.
  - Difusão: `io.to(voiceRoom).emit('music-state', toPublic(state, Date.now()))`; fila vazia após a mudança → apagar `musicByRoom.get(room)` e difundir `{ queue: [], playing: false, positionMs: 0, serverNow }`.
  - `join-voice`: após entrar, `socket.emit('music-state', …)` com o estado da sala nova (ou vazio). Saída de voz/troca/logout/disconnect: se a sala de voz ficou sem ninguém em `roomUsers`, apagar o estado de música dela.
  - Timer único (`setInterval`, 15 s) difunde o estado de toda sala com música tocando.
  - Referer conforme Global Constraints, registrado em `app.whenReady` antes de `createWindow`.

- [ ] **Step 1:** Atualizar `test/protocol.test.js` para 3; `npm test` → FAIL; mudar `protocol.js`; PASS.
- [ ] **Step 2: Implementar** os eventos, a difusão, o timer, a limpeza e o Referer em `main.js` (lógica de fila só via `music-state.js`).
- [ ] **Step 3:** `npm test` PASS; `node --check main.js`.
- [ ] **Step 4: Verificação via DevTools** (sem dependência nova: usar o `socket` global de duas instâncias do app em perfis `/tmp/vox-*`, dirigidas por CDP como os e2e existentes; porta conferida; o cliente ainda não tem UI de música nesta tarefa): logar (entrada automática em texto e voz); `music-add` com `https://youtu.be/M7lc1UVf-VE` → `{ ok: true }` e `music-state` com 1 item e título real; texto inválido → mensagem exata; segundo socket entra na mesma voz e recebe o estado; `music-skip` duplo do mesmo item → uma música só; todos saem → estado apagado (novo `join-voice` recebe fila vazia).
- [ ] **Step 5: Commit** — `git commit -m "Servidor: fila de música por canal de voz e versão 3"`.

---

### Task 4: Cliente — player sincronizado e tile da música

**Files:**
- Modify: `index.html` (carregar `youtube.js` e `music-state.js` antes de `renderer.js`; CSS do tile, só tokens)
- Modify: `renderer.js`

**Interfaces:**
- Consumes: Task 2 (`targetPositionMs`, `needsSeek`), Task 3 (`music-state`, `music-ended`, `music-error`, `music-notice`).
- Produces (em `renderer.js`):
  - Estado: `musicState` (último `music-state` recebido + `receivedAt = Date.now()`), `musicPlayer` (instância `YT.Player` ou null), `musicTileEl` (elemento persistente que contém o player; **nunca** removido nem movido por `renderTiles`).
  - `ensureYouTubeApi(): Promise<void>` — injeta `https://www.youtube.com/iframe_api` uma vez.
  - `applyMusicState(pub): void` — guarda o estado; fila vazia → destrói o player e esconde o tile; senão garante o player (`playerVars` das Global Constraints, volume de `concord-music-volume`), carrega `queue[0].videoId` se mudou (no tempo `targetPositionMs/1000`), aplica play/pause, `seekTo` se `needsSeek`.
  - Reforço: `onStateChange` que contrarie `musicState.playing` (pausa por clique no vídeo, etc.) → reaplica o estado compartilhado. `ENDED` → `socket.emit('music-ended', queue[0].id)`; `onError` 100/101/150 → `socket.emit('music-error', { itemId, code })`.
  - `music-notice` → aviso curto (toast) com o texto recebido.
  - `renderTiles`: com `musicState.queue.length > 0`, o tile da música é o **primeiro** da grade (mantido entre renders: limpar só os outros tiles), mín. 200×200, faixa inferior `🎵 <título> · <N> na fila`; a área da chamada rola por dentro se não couber.
  - `leaveVoice`: destrói o player, esconde o tile, zera `musicState`.

- [ ] **Step 1: Implementar** conforme Produces.
- [ ] **Step 2:** `npm test` PASS (inclui teste de CSS); `node --check renderer.js`.
- [ ] **Step 3: e2e com 3 instâncias** (porta conferida; `--mute-audio`): A e B na Sala Principal; A adiciona `M7lc1UVf-VE` e `aqz-KE-bpKQ` via `socket.emit('music-add', …)` → em A e B, `musicPlayer.getVideoData().video_id === 'M7lc1UVf-VE'`, estado PLAYING e diferença de `getCurrentTime()` entre A e B ≤ 2 s; C entra 10 s depois → mesma música, diferença ≤ 2 s; B liga a câmera (fake) e C entra/sai da voz → o `iframe` de A é o mesmo objeto antes e depois (sem recarga) e `getCurrentTime()` não voltou; `music-skip` → todos em `aqz-KE-bpKQ`; `music-toggle` → todos pausados; A pausa pelo player (`musicPlayer.pauseVideo()`) com o estado tocando → volta a tocar em ≤ 2 s; B sai da voz → player de B destruído, A e C continuam; tile é o primeiro filho da grade; console sem erros.
- [ ] **Step 4: Commit** — `git commit -m "Cliente: player do YouTube sincronizado no tile da chamada"`.

---

### Task 5: Cliente — painel da música, botão 🎵, volume e tela cheia

**Files:**
- Modify: `index.html` (botão `🎵` na barra do topo junto de Cam/Tela; markup e CSS do painel, só tokens)
- Modify: `renderer.js`

**Interfaces:**
- Consumes: Task 4 (`musicState`, `musicPlayer`, `musicTileEl`, `applyMusicState`), Task 3 (eventos).
- Produces:
  - `openMusicPanel()` / `closeMusicPanel()` — abre por clique no tile ou no botão 🎵. Conteúdo: input com placeholder exato `Cole um link do YouTube…` (Enter envia `music-add`; erro do callback aparece abaixo do campo); lista da fila com capa, título, "adicionada por <nome>" (ou `adicionada por alguém`), ✕ (`music-remove`); ⏯ (`music-toggle`) e ⏭ (`music-skip` da atual); slider de volume 0–100 (salva em `concord-music-volume`, aplica `setVolume` só localmente). O painel se atualiza a cada `music-state` e fecha em `leaveVoice`.
  - Botão 🎵: entra em `updateVoiceDependentControls` (desativado sem voz, `title` `Entre em um canal de voz`).
  - Tela cheia: ao abrir `#fullscreen-view` com música tocando, o player passa para um canto dentro de `#fullscreen-view` (recarga curta aceitável) e volta para o tile ao fechar.

- [ ] **Step 1: Implementar.**
- [ ] **Step 2:** `npm test` PASS; `node --check renderer.js`.
- [ ] **Step 3: e2e (2 instâncias, porta conferida):** botão 🎵 desativado fora da voz e ativo dentro; colar `https://www.youtube.com/watch?v=M7lc1UVf-VE&t=10s` no painel → música toca em A e B; colar `não é link` → `Link do YouTube inválido` sob o campo; ✕ remove em ambos; ⏯/⏭ afetam ambos; volume em A muda `getVolume()` só em A e persiste após recarregar a janela; abrir tela cheia de um tile com música → player visível dentro de `#fullscreen-view`; fechar → player de volta ao tile; capturas do tile e do painel em Escuro e Claro; console sem erros.
- [ ] **Step 4: Commit** — `git commit -m "Cliente: painel de música, botão 🎵, volume e tela cheia"`.

---

### Task 6: Documentação

**Files:** Modify `README.md`, `AGENTS.md`.

- [ ] **Step 1:** README: recurso "Música do YouTube na chamada" (como adicionar, quem controla, player visível, sem download). AGENTS.md: `youtube.js` e `music-state.js` no mapa; eventos `music-*`; `PROTOCOL_VERSION = 3`; chave `concord-music-volume`; Referer em `main.js` e por quê (erro 153 em `file://`, medido); pendência: verificar no Windows (plano B: servir a página por `http://127.0.0.1`).
- [ ] **Step 2:** `npm test` PASS.
- [ ] **Step 3: Commit** — `git commit -m "Docs: música do YouTube"`.
