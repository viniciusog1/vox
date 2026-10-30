# Temas de cor e avatares no canal de voz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 13 temas de cor escolhidos por usuário (salvos no computador) e lista de usuários do canal de voz com avatar, anel de fala, 🔇 e selo "AO VIVO".

**Architecture:** Paletas ficam num módulo puro `themes.js` (carregado no `<head>` antes da primeira pintura, aplica variáveis CSS em `:root`). Todo o CSS de `index.html` passa a usar só tokens; tons derivados usam `color-mix()`. Detecção de fala com histerese em `speaking.js`; estado público do usuário (incl. `sharing`) em `room-state.js`, usado por `main.js`. Os três módulos são puros e testados com `node --test`.

**Tech Stack:** Electron 28 (Chromium 120: suporta `color-mix`), JS puro sem bundler, Socket.io 4, `node:test` (Node ≥ 18, sem dependências novas).

**Spec:** `docs/superpowers/specs/2026-10-30-temas-e-avatares-voz-design.md`

## Global Constraints

- Interface em português; nomes de tema exatamente: Escuro, Grafite, Cyberpunk, Neon Verde, Drácula, Nord, Aquático, Natureza, Pôr do sol, Claro, Sépia, Lavanda / Sakura, Algodão-doce.
- Ids: `escuro, grafite, cyberpunk, neon-verde, dracula, nord, aquatico, natureza, por-do-sol, claro, sepia, lavanda, algodao-doce`.
- Paletas = tabela "Paletas" da spec, valores exatos (já ajustados para contraste). Glow só em cyberpunk, neon-verde e aquatico, valores da spec.
- Padrão `escuro`; persistência só em `localStorage['concord-theme']`.
- Contraste: `muted` ≥ 4.5 sobre `bg/bg2/bg3`; `text`, `text2` ≥ 4.5 sobre `bg/bg2/bg3`; `link`, `red` ≥ 4.5 sobre `bg/bg2`; `onAccent` ≥ 4.5 sobre `accent`; `#ffffff` ≥ 4.5 sobre `dangerBg`. `accent` nunca como cor de texto corrido (usar `link`).
- `AVATAR_COLORS` em `renderer.js` não muda por tema.
- Não tocar em código de WebRTC (`createPeer`, sinalização, `renderTiles`/`buildTile`) além do necessário: o PR #1 (`feat/screen-share-smooth`) reescreve essas partes.
- JS puro, sem framework, sem dependências novas; manter estilo do código (comentários em português, `function` nomeadas, 2 espaços).
- Não usar serviços pagos.

## Review Focus

1. `localStorage['concord-theme']` com id desconhecido (tema removido, valor corrompido) → abre no Escuro, sem erro. *(teste na Task 1)*
2. `localStorage` lançando exceção (perfil bloqueado) → abre no Escuro e o seletor ainda troca o tema na sessão. *(teste na Task 1)*
3. Ruído curto ou pausas entre palavras → anel não pisca; liga acima do limiar e só apaga após 250 ms abaixo. *(testes na Task 4)*
4. Você mutado com microfone captando som → sem anel no seu avatar. *(verificação e2e na Task 6)*
5. Parar o compartilhamento, sair do canal ou desconectar → "AO VIVO" some para todos; reentrar não traz o selo de volta. *(teste na Task 3 + e2e na Task 6)*

---

### Task 1: Módulo de temas + infraestrutura de testes

**Files:**
- Create: `themes.js`
- Create: `test/themes.test.js`
- Modify: `package.json` (script `test`; `build.files` exclui `!test/**`, `!docs/**`)

**Interfaces:**
- Produces (Node: `module.exports`; navegador: `window.ConcordThemes`):
  - `THEMES: Array<{ id: string, name: string, kind: 'dark'|'light', tokens: Record<TokenName,string>, glow: string, glowSoft: string }>` na ordem: escuros (escuro, grafite, cyberpunk, neon-verde, dracula, nord, aquatico, natureza, por-do-sol), depois claros (claro, sepia, lavanda, algodao-doce).
  - `TokenName` = `bg, bg2, bg3, rail, border, text, text2, muted, accent, onAccent, link, speak, red, dangerBg`.
  - `DEFAULT_THEME_ID = 'escuro'`, `STORAGE_KEY = 'concord-theme'`.
  - `resolveThemeId(id: unknown): string` → id válido ou `'escuro'`.
  - `getTheme(id: unknown): Theme` (via `resolveThemeId`).
  - `themeCssVars(theme): Record<string,string>` → `--bg, --bg-2, --bg-3, --rail, --border, --text, --text-2, --muted, --accent, --on-accent, --link, --speak, --red, --danger-bg, --glow, --glow-soft`, mais constantes iguais em todos os temas: `--green: #3ba55d`, `--yellow: #faa61a`, `--gray: #747f8d`.
  - `loadThemeId(storage): string` e `saveThemeId(storage, id): void` — ambos engolem exceções do storage (`loadThemeId` → `'escuro'`).
  - `applyTheme(id, root = document.documentElement): string` — escreve as vars com `root.style.setProperty`, seta `root.dataset.theme` e `root.dataset.themeKind`, retorna o id aplicado.
  - No navegador, ao carregar: `applyTheme(loadThemeId(window.localStorage))` imediatamente (acesso a `window.localStorage` dentro de try).

- [ ] **Step 1: Escrever os testes que falham** (`test/themes.test.js`, `node:test` + `node:assert/strict`, `require('../themes.js')`)
  - `exporta 13 temas com ids e nomes da spec` — `THEMES.map(t => t.id)` igual à lista de ids das Global Constraints; nomes idem; 9 `dark` + 4 `light`.
  - `cada tema tem os 14 tokens em hex #rrggbb` — regex `/^#[0-9a-f]{6}$/`.
  - `paleta igual à spec` — conferir pelo menos `escuro` inteiro (`bg #0d0f13 … red #ed4245 dangerBg #d53b3e`) e `algodao-doce` inteiro (`muted #6a657f`, `accent #3a70dc`, `link #c82d76`, `red #cd2d4c`, `dangerBg #d23c59`, demais da tabela).
  - `contraste mínimo em todos os temas` — implementar `contrast(a, b)` WCAG no teste e checar todas as regras de contraste das Global Constraints (≥ 4.5).
  - `glow só em cyberpunk, neon-verde e aquatico` — demais `glow === 'none'` e `glowSoft === 'none'`; aquatico `glowSoft === 'none'`.
  - `resolveThemeId cai no escuro` — `undefined`, `''`, `'tema-que-nao-existe'`, `42` → `'escuro'`; `'nord'` → `'nord'`.
  - `loadThemeId tolera storage quebrado` — storage cujo `getItem` lança → `'escuro'`; storage com `'xyz'` → `'escuro'`; com `'sepia'` → `'sepia'`.
  - `saveThemeId não lança se o storage lança`.
  - `themeCssVars mapeia nomes` — `themeCssVars(getTheme('nord'))['--bg-2'] === '#3b4252'`, `['--danger-bg']` presente, `['--green'] === '#3ba55d'`.
  - `applyTheme escreve no root` — root falso `{ style: { setProperty(k,v){…} }, dataset: {} }`; após `applyTheme('claro', root)`: `--bg` = `#ffffff`, `dataset.theme === 'claro'`, `dataset.themeKind === 'light'`; `applyTheme('??', root)` retorna `'escuro'`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npm test` → FAIL (`Cannot find module '../themes.js'`).

- [ ] **Step 3: Implementar `themes.js`** com os valores da tabela "Paletas" da spec. Envolver em IIFE; exportar com `if (typeof module !== 'undefined') module.exports = api; else window.ConcordThemes = api;` e só chamar `applyTheme` automático quando `typeof document !== 'undefined'`. `package.json`: `"test": "node --test test/"`.

- [ ] **Step 4: Rodar e ver passar** — `npm test` → todos PASS.

- [ ] **Step 5: Commit** — `git add themes.js test/themes.test.js package.json && git commit -m "Temas: módulo de paletas com testes de contraste"`

---

### Task 2: CSS só com tokens + tema aplicado antes da pintura

**Files:**
- Modify: `index.html` (todo o `<style>`; `<head>` ganha `<script src="themes.js"></script>` **antes** do `<style>`)
- Modify: `renderer.js` (só o fundo inline do tile vazio, hoje `rgba(255,255,255,.02)`)
- Create: `test/css-tokens.test.js`

**Interfaces:**
- Consumes: variáveis de `themeCssVars` (Task 1).
- Produces: CSS em que toda cor vem de `var(--…)`. Mapeamento (decidido aqui): `--panel` e `--bg-3` antigos → `var(--bg-3)`; `--accent-2` (hover) → `color-mix(in srgb, var(--accent) 85%, #000)`; fundo do canal ativo → `color-mix(in srgb, var(--accent) 16%, transparent)` + `box-shadow: var(--glow-soft)`; hovers `rgba(255,255,255,.0x)` → `color-mix(in srgb, var(--text) X%, transparent)` com o mesmo X; scrollbar → `var(--border)` / hover `var(--muted)`; rail e painel do usuário (`#0a0c10`, `#0f131a`) → `var(--rail)`; tons de verde/vermelho → `color-mix` sobre `var(--green)`/`var(--red)`; botões de perigo e `#c13335` → `var(--danger-bg)` / hover `color-mix(in srgb, var(--danger-bg) 85%, #000)`; botão primário → fundo `var(--accent)`, texto `var(--on-accent)`, `box-shadow: var(--glow)`; links e texto destacado que hoje usam a cor de destaque → `var(--link)`; `#c9b6ff` → `var(--link)`. O bloco `:root` fica só com `--radius`.

- [ ] **Step 1: Teste que falha** (`test/css-tokens.test.js`): lê `index.html`, extrai o conteúdo de `<style>…</style>`, remove comentários, e espera que a lista de literais de cor `/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g` contenha só itens de `['#fff', '#ffffff', '#000', 'transparent']` ou `rgba(0,0,0,…)` (sombras/overlays). Segundo teste: o `<script src="themes.js">` aparece antes de `<style>` no `<head>`.
- [ ] **Step 2: Rodar** — `npm test` → FAIL listando os ~70 literais atuais.
- [ ] **Step 3: Substituir os literais** conforme o mapeamento acima; trocar o inline do tile vazio por `color-mix(in srgb, var(--text) 2%, transparent)`.
- [ ] **Step 4: Rodar** — `npm test` → PASS. `node --check renderer.js`.
- [ ] **Step 5: Conferência visual do Escuro** — `npm start`; o app deve ficar visualmente igual ao de antes no tema Escuro (login, canais, chat, modal de configurações, popover de status, seletor de tela). Diferença aceitável: o vermelho do botão "Sair"/perigo agora é `#d53b3e`.
- [ ] **Step 6: Commit** — `git commit -am "Temas: CSS passa a usar só tokens"` (incluir `test/css-tokens.test.js`).

---

### Task 3: Estado público do usuário com `sharing` (servidor)

**Files:**
- Create: `room-state.js`
- Create: `test/room-state.test.js`
- Modify: `main.js:70-116` (as duas montagens de lista), `main.js:278-282` (entrada nova no `join-room`), `main.js:303-321` (`update-state`)

**Interfaces:**
- Produces (`module.exports`):
  - `publicUser(id: string, entry: {username, muted?, status?, sharing?}) → { id, username, muted: boolean, status: string, sharing: boolean }` (`status` padrão `'online'`, `sharing` padrão `false`).
  - `applyStatePatch(entry, patch) → void` — aplica `muted` e `sharing` só se `typeof === 'boolean'`; `status` só se em `['online','busy','away','invisible']`. Não toca em outros campos.
- `main.js`: `buildRoomUserList` e `buildVoiceRooms` usam `publicUser`; `update-state` usa `applyStatePatch` (mantendo a lógica de `before/after` de invisível e o espelho em `socket.data.muted/status`); entrada nova do `join-room` começa com `sharing: false` (o cliente reenvia o estado ao entrar).

- [ ] **Step 1: Testes que falham**
  - `publicUser preenche padrões` — `publicUser('a', { username: 'ana' })` deepEqual `{ id: 'a', username: 'ana', muted: false, status: 'online', sharing: false }`.
  - `applyStatePatch aceita sharing booleano` — `true` → `entry.sharing === true`; depois `false` → `false`.
  - `applyStatePatch ignora tipos errados` — `{ sharing: 'sim', muted: 1, status: 'hacker' }` não altera nada.
  - `applyStatePatch não apaga campos ausentes` — `{ status: 'busy' }` mantém `sharing: true` anterior.
- [ ] **Step 2: Rodar** — `npm test` → FAIL (módulo ausente).
- [ ] **Step 3: Implementar `room-state.js`** e trocar os pontos de `main.js` listados.
- [ ] **Step 4: Rodar** — `npm test` → PASS; `node --check main.js`.
- [ ] **Step 5: Commit** — `git commit -m "Servidor: estado público do usuário inclui sharing"`.

---

### Task 4: Detecção de fala com histerese

**Files:**
- Create: `speaking.js`
- Create: `test/speaking.test.js`

**Interfaces:**
- Produces (Node: `module.exports`; navegador: `window.ConcordSpeaking`):
  - `SPEAK_ON_LEVEL = 0.12`, `SPEAK_HOLD_MS = 250`.
  - `levelFromAnalyser(analyser) → number` em 0..1 — mesma métrica do loop atual (`renderer.js` `startAudioLoop`): média dos 24 primeiros bins de `getByteFrequencyData` / 255 × 1.6, limitado a 1.
  - `createSpeakingState() → { speaking: false, lastLoudAt: -Infinity }`.
  - `updateSpeaking(state, level, nowMs) → boolean` — `level ≥ SPEAK_ON_LEVEL` liga e marca `lastLoudAt`; abaixo, só desliga quando `nowMs - lastLoudAt > SPEAK_HOLD_MS`. Retorna `state.speaking`.

- [ ] **Step 1: Testes que falham**
  - `liga acima do limiar` — `updateSpeaking(s, 0.2, 0) === true`.
  - `não liga abaixo do limiar` — `0.1` em t=0 → `false`.
  - `segura durante pausa curta` — 0.2 em t=0; 0.0 em t=200 → `true`.
  - `apaga após 250 ms em silêncio` — 0.2 em t=0; 0.0 em t=251 → `false`.
  - `pico isolado não fica preso` — 0.5 em t=0, 0.0 em t=100, 300, 600 → último `false`.
  - `levelFromAnalyser` — analyser falso com `frequencyBinCount = 32` e `getByteFrequencyData` preenchendo 255 → `1`; preenchendo 0 → `0`.
- [ ] **Step 2: Rodar** — FAIL.
- [ ] **Step 3: Implementar `speaking.js`** (mesmo padrão de export da Task 1).
- [ ] **Step 4: Rodar** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "Voz: detecção de fala com histerese"`.

---

### Task 5: Seletor de tema em "Aparência"

**Files:**
- Modify: `index.html` (modal `#settings-modal`: título vira "Configurações"; nova seção "Aparência" no topo com `<div id="theme-grid"></div>`, subtítulos "Escuros" e "Claros"; seção "Áudio" com os campos atuais; CSS da grade usando só tokens — o teste da Task 2 continua valendo)
- Modify: `renderer.js` (novo bloco `/* ================= TEMAS ================= */`)

**Interfaces:**
- Consumes: `window.ConcordThemes.{THEMES, applyTheme, saveThemeId, loadThemeId, themeCssVars}`.
- Produces: `renderThemePicker(): void` — monta, em `#theme-grid`, um botão por tema (`.theme-option`, `data-theme-id`, `aria-pressed`), com miniatura (rail, coluna de canais, área de chat, botão) pintada pelas vars do próprio tema via `style` inline gerado de `themeCssVars`, e o nome. Clique → `applyTheme(id)`, `saveThemeId(localStorage, id)`, atualiza `aria-pressed`/classe `.selected`. Chamado ao abrir as configurações.

- [ ] **Step 1: Implementar** markup, CSS e `renderThemePicker`.
- [ ] **Step 2: `npm test`** → PASS (inclui o teste de literais de cor).
- [ ] **Step 3: Verificação e2e** (driver CDP de duas instâncias usado no PR #1, em `scratchpad/e2e/drive.mjs`, adaptado; usuários de teste únicos; apagar `users.json` criado ao final): abrir configurações; esperar 13 `.theme-option`, 9 sob "Escuros" e 4 sob "Claros"; clicar em "Nord" → `getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#2e3440'` e `localStorage['concord-theme'] === 'nord'`; recarregar a janela → continua Nord **e** a tela de login já abre com `--bg` do Nord (aplicado antes do renderer); `localStorage.setItem('concord-theme','xyz')` + recarregar → Escuro. Console sem erros.
- [ ] **Step 4: Screenshot de cada tema** (CDP `Page.captureScreenshot`, tela principal com chat e canal de voz) em `scratchpad/temas/<id>.png`; conferir a olho que nenhum pedaço ficou com cor do Escuro.
- [ ] **Step 5: Commit** — `git commit -am "Temas: seletor em Aparência"`.

---

### Task 6: Usuários no canal de voz (opção C)

**Files:**
- Modify: `index.html` (carregar `speaking.js` antes de `renderer.js`; CSS `.voice-user`, `.voice-user .avatar` 24px, `.voice-user.speaking .avatar { box-shadow: 0 0 0 2px var(--bg-2), 0 0 0 4px var(--speak) }`, `.voice-user .vu-icons` à direita, `.live-badge` fundo `var(--danger-bg)` texto `#fff`)
- Modify: `renderer.js` — `renderMembers` (bloco "Mostra os usuários embaixo do canal de voz", hoje ~linhas 707-745), `sendStatus` (linha 216), `startAudioLoop` (~linha 1128), handler de `btnScreen` e `stopScreenShare` (uma chamada `sendStatus()` em cada, nada mais)

**Interfaces:**
- Consumes: `publicUser` com `sharing` (Task 3, via evento `voice-rooms`); `ConcordSpeaking.{levelFromAnalyser, createSpeakingState, updateSpeaking}` (Task 4); `makeAvatar(name, extraClass)` existente — continua sendo o único ponto que desenha avatar.
- Produces:
  - `sendStatus()` passa a emitir `{ muted: !micEnabled, status: effectiveStatus(), sharing: sharingScreen }`; chamado também logo após `sharingScreen = true` no clique de `btnScreen` e no fim de `stopScreenShare`.
  - Linha do canal: `<div class="voice-user" data-id="<socket id>">` com `makeAvatar(username, 'vu-avatar')`, nome, e à direita 🔇 se `muted` e `<span class="live-badge">AO VIVO</span>` se `sharing`. Sem bolinha de status. Ordem: você primeiro, demais alfabética (como hoje).
  - Fala local: `localAnalyser` (AnalyserNode sobre a faixa enviada — `getOutboundAudioTracks()[0]`), criado/recriado quando a mídia local é (re)montada; nível forçado a 0 quando `!micEnabled`.
  - `startAudioLoop`: além do medidor atual, para cada id em `analysers` e para `socket.id` (local) calcula `levelFromAnalyser`, passa por um `speakingStates: Map<id, state>` e alterna `.speaking` em `.voice-user[data-id="…"]` só quando o valor muda (sem re-render).

- [ ] **Step 1: Implementar** CSS, `renderMembers`, `sendStatus`, analyser local e loop.
- [ ] **Step 2: `npm test`** → PASS; `node --check renderer.js`.
- [ ] **Step 3: Verificação e2e com duas instâncias** (flags `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`; o microfone falso emite bipes, bom para o anel):
  - A e B em "Sala Principal": cada lado mostra 2 `.voice-user` com `.avatar`, nenhum `.status-dot` dentro de `.voice-users`.
  - Durante ~5 s, amostrar a cada 100 ms: o `.voice-user` de B (visto por A) ganha `.speaking` em algum momento, e o número de trocas de classe por segundo é ≤ 4 (sem piscar).
  - A muta → em B aparece 🔇 na linha de A; em A, a linha de A não fica `.speaking` durante 3 s.
  - A compartilha (fake `getDisplayMedia` por canvas, como no PR #1) → em B, `.live-badge` na linha de A. C (terceira instância) fora do canal, em `#geral`, também vê o selo sob "Sala Principal".
  - A para → selo some em B e C em até 1 s. A compartilha de novo e sai do canal → selo some; A volta ao canal sem compartilhar → sem selo.
  - Console sem erros nas instâncias.
- [ ] **Step 4: Screenshot** da lista do canal em Escuro, Claro e Cyberpunk.
- [ ] **Step 5: Commit** — `git commit -am "Voz: avatar, anel de fala, mudo e AO VIVO no canal"`.

---

### Task 7: Documentação

**Files:**
- Modify: `README.md` (recursos: temas e lista do canal; crédito "Paletas Drácula (draculatheme.com) e Nord (nordtheme.com), licença MIT")
- Modify: `AGENTS.md` (mapa de arquivos: `themes.js`, `speaking.js`, `room-state.js`, `test/`; comandos: `npm test`; preferência `concord-theme` no localStorage; regra "CSS só com tokens, testado por `test/css-tokens.test.js`"; evento `update-state` aceita `sharing`)

- [ ] **Step 1: Atualizar os dois arquivos.**
- [ ] **Step 2: `npm test`** → PASS.
- [ ] **Step 3: Commit** — `git commit -am "Docs: temas, lista do canal de voz e testes"`.
