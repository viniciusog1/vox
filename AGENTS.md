# AGENTS.md — Vox

Guia para agentes de IA que forem alterar este projeto. Leia antes de editar.

## 1. Contexto

- Aplicativo desktop para Windows 11 de chat, voz, vídeo e compartilhamento de tela.
- Nome do produto: **Vox**. Antes se chamava Concord.
- Stack: **Electron 45 + Node.js + Socket.io 4 + WebRTC**.
- Interface em português.
- Não há banco de dados: usuários e mensagens ficam em arquivos JSON.
- O servidor Socket.io é embutido no processo principal do Electron e escuta em `0.0.0.0:3000`.
- Não há nuvem central: o PC do host é o servidor.
- Repositório: https://github.com/viniciusog1/vox (público). Trabalho em branch própria a partir da `main` atualizada e entra por PR; antes de cada push, confira se o PR da branch ainda está aberto (PRs já foram juntados antes de commits chegarem).
- Desenvolvimento acontece também no macOS (`~/Documents/vox`); o Windows é o alvo do instalador.

Caminhos no PC com Windows (a pasta do projeto lá ainda se chama `discord-clone-windows`):

```text
Projeto:              C:\Users\Usuario\discord-clone-windows
App instalado:        C:\Users\Usuario\AppData\Local\Programs\Vox\Vox.exe  (versões antigas: ...\Programs\Concord\Concord.exe)
Dados do instalado:   C:\Users\Usuario\AppData\Roaming\Vox  (copiados de ...\Roaming\Concord na primeira execução)
Instalador gerado:    C:\Users\Usuario\discord-clone-windows\dist\Vox-Setup-<versão>.exe
Ferramenta de túnel:  C:\Users\Usuario\discord-clone-windows\tools\cloudflared.exe
Atalho do túnel:      C:\Users\Usuario\discord-clone-windows\IniciarTunelVox.bat
```

## 2. Comandos rápidos

O Node.js **não está no PATH** deste ambiente. Use o caminho completo ou ajuste o PATH:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
```

### Rodar em desenvolvimento

```powershell
cd C:\Users\Usuario\discord-clone-windows
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm start
```

Alternativa sem `npm`:

```powershell
Start-Process -FilePath 'C:\Users\Usuario\discord-clone-windows\node_modules\electron\dist\electron.exe' `
  -ArgumentList '.' -WorkingDirectory 'C:\Users\Usuario\discord-clone-windows'
```

### Testes

```powershell
npm test
```

### Verificar sintaxe

```powershell
& 'C:\Program Files\nodejs\node.exe' --check main.js
& 'C:\Program Files\nodejs\node.exe' --check renderer.js
```

### Gerar instalador

```powershell
cd C:\Users\Usuario\discord-clone-windows
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm run dist
```

Saída: `dist\Vox-Setup-<versão>.exe`, `.blockmap` e `latest.yml` (versão de `package.json`). Para a atualização automática, os três vão numa release publicada do GitHub com a tag `v<versão>` (passo a passo no README). O nome com hífens é de propósito: o GitHub troca espaços por pontos ao subir o arquivo e o `latest.yml` deixaria de achar o instalador.

### Instalar/testar o pacote

- Feche o app de desenvolvimento antes de abrir o instalado: ambos usam a porta 3000.
- Para testar sem instalar: `dist\win-unpacked\Vox.exe`.
- O app instalado é um snapshot; alterações no código só aparecem depois de rodar `npm run dist` e reinstalar.

## 3. Mapa de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `main.js` | Processo principal: cópia única dos dados do antigo Concord (`migrateLegacyUserData`), janela, permissões, servidor Socket.io, autenticação, presença, membros do servidor (`buildServerMembers`), salas, mensagens, retenção, `desktopCapturer` e seletor de tela, fila de música por sala de voz (`musicByRoom`) e o `Referer` injetado nas requisições do YouTube. |
| `renderer.js` | Interface e lógica do cliente: login, canais, chat, WebRTC, estado da conexão e ping por pessoa, grade de tiles (`layoutTiles`), câmera/microfone, compartilhamento de tela, música, status, membros, configurações em abas. |
| `themes.js` | Os 18 temas (paletas, id padrão `escuro`) e os grupos do seletor (`THEME_GROUPS`: Escuros, Neon, Anime, Claros; cada tema tem `group`), leitura/gravação em `localStorage['vox-theme']`, `applyTheme`, opção "Reduzir animações" (`vox-reduce-motion`, `data-reduce-motion` no `<html>`) e `migrateLegacyStorage` (copia `concord-*` → `vox-*`). Carregado no `<head>` antes do CSS para aplicar o tema antes da primeira pintura. Também é módulo Node (testes). |
| `icons.js` | Ícones SVG do Lucide (lucide-static 0.460.0, licença ISC) usados na interface: `icon(name, size)`, `setIcon(el, name, text, size)` e `hydrate(root)`, que troca `<i data-icon="…">` pelo SVG. Só os ícones usados estão no arquivo; para um novo, copie de `lucide-static/icons/*.svg`. Também é módulo Node (testes). |
| `speaking.js` | Detecção de "falando" com histerese (liga ≥ 0.12, desliga após 250 ms abaixo) para o anel do avatar. |
| `sounds.js` | Efeitos sonoros gerados com Web Audio (sem arquivos): `SOUNDS` (`join`, `leave`, `mute`, `unmute`), `playSound`, `rosterSound` (decide o som pela diferença entre a lista anterior e a nova da voz) e `isEnabled` (`vox-sound-effects`). Usado por `renderer.js`. Também é módulo Node (testes). |
| `channels.js` | Lista fixa de canais: `TEXT_CHANNELS` (`geral`, `jogos`, `musica`) e `VOICE_CHANNELS` (`voz-sala`, `voz-jogos`, `voz-musica`); padrões `geral` e `voz-sala`. Usado por `main.js` e `renderer.js`. Também é módulo Node (testes). |
| `chat-state.js` | Regras puras do chat: `cleanText` (até 2000), imagens (`MAX_IMAGE_BYTES` 2 MB, `imageExtension`, `isUploadName`), `ensureIds`, `editMessage`/`deleteMessage` (só o autor), menções (`splitMentions`, `mentionsOf`), não lidas (`addUnread`, `clearUnread`) e `shouldNotify`. Usado por `main.js` e `renderer.js` (`VoxChat`). Também é módulo Node (testes). |
| `sessions.js` | Tokens de reconexão: `createSessionStore` (`issue`, `resolve`, `revoke`, `prune`), grava só o hash em `sessions.json`, validade 7 dias. Usado por `main.js`. |
| `tunnel.js` | Túnel do Cloudflare aberto pelo Vox: `createTunnel` (baixa o `cloudflared` se faltar, inicia, reabre se cair, para) e `parseTunnelUrl`. Usado por `main.js`. |
| `protocol.js` | `PROTOCOL_VERSION` (hoje `5`), mensagem de versão incompatível e `isCompatible`. Usado por `main.js` e `renderer.js`. Também é módulo Node (testes). |
| `youtube.js` | `parseYouTubeId` (aceita links `youtu.be`, `watch?v=`, `shorts`, `embed`), `thumbnailUrl` e `lookupVideo` (oEmbed público, sem chave, timeout de 4 s). Usado por `main.js`. Também é módulo Node (testes). |
| `music-state.js` | Regras puras da fila de música: `MAX_QUEUE` (50), `SYNC_TOLERANCE_MS` (2000), `RESYNC_INTERVAL_MS` (15000), `SEEK_COOLDOWN_MS` (5000), `shouldCorrectSeek`, adicionar/remover, pular ou terminar só se o item ainda é o atual, alternar pausa e posição atual. Usado por `main.js` e `renderer.js`. Também é módulo Node (testes). |
| `presence.js` | Regras de status: modo escolhido (`online`, `away`, `busy`, `invisible`), ausente automático só a partir de Online e atividade que desfaz só o automático. Também é módulo Node (testes). |
| `room-state.js` | Estado público do usuário na sala de voz (`publicUser`, `applyStatePatch`: `muted`, `status`, `sharing`) e troca de canais (`joinVoiceRoom`, `leaveVoiceRoom`, `canUseTextRoom`, `socketRoomsToLeave`). Usado por `main.js`. |
| `test/` | Testes `node:test` (`npm test`): paletas e contraste, CSS sem cores fixas, estrutura das configurações, estado da sala, canais, presença, protocolo, detecção de fala, YouTube, fila de música, efeitos sonoros, chat (menções, editar/apagar, não lidas, notificações), sessões e endereço do túnel. Fora do instalador. |
| `preload.js` | Ponte segura `contextBridge` para o IPC do seletor de tela, do túnel (`tunnelStart`/`tunnelStop`/`tunnelStatus`/`onTunnelStatus`), da atualização (`updateStatus`/`onUpdateStatus`/`installUpdate`) e das notificações (`focusWindow`, `flashFrame`). Ainda expõe `minimize`/`maximize`/`close`, sem uso desde que a janela passou a usar os botões nativos. |
| `assets/icon.svg`, `assets/icon-small.svg`, `assets/icon.png` | Ícone do Vox: barras de equalizador roxas cujas pontas (rosa nas bordas, ciano no meio) formam um V. `icon-small.svg` é a versão de 3 barras usada até 24 px. `icon.png` (256 px, gerado) é o ícone da janela; `icon.svg` aparece na tela de login. |
| `build/icon.ico` | Ícone do instalador e do `Vox.exe` (16 a 256 px, entradas BMP 32 bits), gerado por `scripts/gerar-icone.js`. Não editar à mão. |
| `scripts/gerar-icone.js` | `npx electron scripts/gerar-icone.js`: desenha os SVGs num canvas escondido e grava `build/icon.ico` e `assets/icon.png`. Fora do instalador. |
| `scripts/after-pack.js` | Hook `afterPack` do electron-builder: grava ícone e versão no `Vox.exe` com `rcedit` (necessário porque `signAndEditExecutable` está desligado). Fora do instalador. |
| `index.html` | Layout e CSS de toda a interface; também contém os modais e a tela de login. |
| `package.json` | Scripts, dependências e configuração do electron-builder. |
| `socket.io.min.js` | Bundle do cliente Socket.io copiado pelo `postinstall`; **não editar à mão**. |
| `users.json` | Dados de desenvolvimento das contas. Não faz parte do instalador. |
| `messages.json` | Dados de desenvolvimento das mensagens. Não faz parte do instalador. |
| `README.md` | Documentação para o usuário final. |
| `AGENTS.md` | Este guia. |
| `tools/cloudflared.exe` | Cloudflare Tunnel para o host. Não faz parte do instalador. |
| `IniciarTunelVox.bat` | Inicia o túnel no host. Não faz parte do instalador. |

## 4. Arquitetura

### Processo principal (`main.js`)

- Cria a `BrowserWindow` e carrega `index.html`.
- Configura permissões de câmera, microfone, tela e clipboard.
- Inicia `http.createServer()` + `new Server(server, { cors: { origin: '*' } })`.
- Escuta em `0.0.0.0:3000` para permitir acesso pela rede local.
- Mantém em memória:
  - `authenticated`: `socket.id -> username`;
  - `roomUsers`: `voiceRoom -> Map(socket.id -> { username, muted, status, sharing })`, só para canais de voz;
  - `socket.data.textRoom` e `socket.data.voiceRoom`: canal de texto e de voz atuais do socket (`null` quando não há);
  - `users`: objeto carregado de `users.json`;
  - `messages`: objeto carregado de `messages.json`.
- Usa `desktopCapturer` + `session.setDisplayMediaRequestHandler` para o seletor de tela personalizado.

### Renderer (`renderer.js`)

- Conexão Socket.io no topo:
  ```js
  const SERVER_URL = localStorage.getItem('vox-server-url') || 'http://127.0.0.1:3000';
  const socket = io(SERVER_URL);
  ```
- Campos da tela de login: `#server-url`, `#server-apply`, `#server-status`.
- WebRTC:
  - Topologia **P2P mesh**: um `RTCPeerConnection` por participante.
  - STUN do Google em `ICE_CONFIG`.
  - **Não há TURN configurado.**
  - Um transceiver de vídeo é criado mesmo com a câmera desligada, para permitir `replaceTrack` depois sem renegociação.
  - Streams remotos sem vídeo ativo mostram avatar e um `<audio class="remote-audio">` escondido.
- Compartilhamento de tela:
  - `getDisplayMedia({ video: currentShareVideoConstraints(), audio: { restrictOwnAudio: true } })` (áudio só no Windows).
  - Áudio do PC: caixa `#share-audio` no seletor, sempre desmarcada ao abrir. Marcada, `main.js` responde `audio: 'loopback'`, que pega o som do PC. O renderer pede `audio: { restrictOwnAudio: true }`, e o Electron 45 respeita isso com o handler próprio: sai da captura **tudo** que o Vox toca (vozes da chamada, música do YouTube, efeitos sonoros). **Medido** no Windows com duas instâncias: tom do próprio Vox no nível do ruído (−80 a −100 dB), tom de outro programa a −43 dB. No Electron 28 a restrição era ignorada e quem falava se ouvia com atraso.
  - Transporte do áudio da tela: cada peer tem um segundo transceiver de áudio desde `createPeer` (`getScreenAudioTransceiver`: o 2º áudio com mid); `applyScreenAudio` faz `replaceTrack` sem renegociar. Quem recebe toca essa faixa num `<audio>` próprio (`screenAudioEls`): o `<audio>`/`<video>` do tile só toca a primeira faixa de áudio do stream.
  - Qualidade escolhida no seletor: `#share-resolution` (480/720/1080) e `#share-fps` (30/60), padrão 1080p30.
  - Persistência em `vox-share-resolution` e `vox-share-fps`.
  - O track da tela substitui o da câmera em todos os peers via `replaceVideoTrackEverywhere`.
  - Encoder: H.264 preferido (`preferVideoCodecs`, cai para VP8 se não houver). VP8 em modo tela a 1080p cai para 1–4 fps (medido).
  - `contentHint`: `motion` em 60 fps (prioriza fluidez), `detail` em 30 fps (prioriza nitidez). `applyVideoSenderParams` aplica `maxBitrate` (`SHARE_BITRATES`), `maxFramerate` e `degradationPreference` em cada peer.
  - `withVideoBitrateHints` adiciona `x-google-start-bitrate`/`x-google-min-bitrate` na descrição remota; sem isso a banda começa em ~300 kbps.
  - `adoptOfferTransceivers`: no lado que responde à oferta, move as faixas locais para os transceivers negociados. Sem isso, quem entra depois na sala não envia vídeo.
  - O `<video>` de cada stream é reaproveitado entre `renderTiles` (`videoElements`); `mute` remoto só troca para o avatar após 1,5 s.
  - Diagnóstico: **Ctrl+Shift+D** mostra fps/resolução/banda/codec/limitação por participante.
  - Ao parar, volta para a câmera (se ligada) ou remove o vídeo.
  - Visualização em tela cheia: cada tile com vídeo tem botão de tela cheia e duplo clique; usa `#fullscreen-view` + `requestFullscreen`.
- Estado da conexão: `peerConn` guarda o estado de cada peer; a cada 2 s o RTT vem do par de candidatos ICE nomeado. A coluna Membros mostra "Conectando…", "Conectado · N ms", "Reconectando…" ou "Falhou" para quem está na mesma voz.
- Grade da chamada: `layoutTiles()` calcula colunas e tamanho dos tiles (16:9, gap 12, largura mínima 260; tile da música com altura mínima 240) e grava `--grid-cols`, `--tile-w`, `--tile-h`. Roda num `ResizeObserver` e ao fim de `renderTiles`/`syncMusicTile`.
- Membros: `server-members` traz todas as contas do servidor; `renderMembers` separa Online/Offline. Invisíveis aparecem como offline para os outros.
- Ícones: `VoxIcons.hydrate()` roda no início de `renderer.js`; ícones trocados em tempo de execução usam `VoxIcons.setIcon`.
- Música (YouTube):
  - A fila aparece como primeiro tile da grade de chamada enquanto houver música; o botão do YouTube da barra superior (`#btn-music`, desabilitado sem voz) e o tile abrem o painel de música. O tile tem botão para abrir só o vídeo em tela cheia.
  - `music-rooms` diz quais canais de voz têm música; a lista de canais mostra o ícone do YouTube ao lado deles.
  - Quem está na voz controla a fila. Sair da voz interrompe a música só para quem saiu.
  - Nada é baixado: o player oficial do YouTube (IFrame API) toca em cada computador. Em tela cheia, o player vai para um canto dentro de `#fullscreen-view`.
  - Volume local em `localStorage['vox-music-volume']` (não é sincronizado).
  - Sincronização: o cliente estima a posição a partir de `positionMs`/`serverNow` e faz `seekTo` só se a diferença passar de `SYNC_TOLERANCE_MS`, respeitando `SEEK_COOLDOWN_MS`.
- Áudio do microfone:
  - Pipeline de redução de ruído: high-pass (85 Hz) → gate (AudioWorklet `vox-noise-gate` via Blob) → compressor → gain → `MediaStreamAudioDestination`.
  - `micProcessedTrack` é a faixa enviada aos peers; `getOutboundAudioTracks()` decide entre processada e bruta.
  - Modos em `vox-noise-suppression`: `off`, `browser`, `strong`. Intensidade em `vox-noise-gate-level`.
  - O monitor do próprio microfone toca a faixa processada.
- Quem está falando aparece pelo anel no avatar da lista da voz (`speaking.js`), inclusive você. A antiga barra "Ninguém falando" foi removida.
- Efeitos sonoros (`sounds.js` + `playSoundEffect`):
  - Tocam ao entrar/sair alguém da sua voz (inclusive você) e ao mutar/desmutar. Sem evento novo: a entrada e a saída saem da diferença entre listas de `room-users` (`soundRoster`). A primeira lista depois de `join-voice` toca só a sua entrada, não a de quem já estava; a sua saída toca em `leaveVoice`.
  - Invisíveis não vêm na lista, então não tocam ao entrar; quem fica invisível some da lista e soa como saída para os outros (igual a sair de verdade, sem denunciar a invisibilidade).
  - Contexto de áudio próprio (`soundContext`, nunca fechado; o da chamada fecha ao sair da voz) → `MediaStreamDestination` → `<audio id="sound-effects-audio">`, que entra em `applyOutputDevice` para seguir `audioOutputId`.
  - Opção "Efeitos sonoros" na aba Áudio, em `vox-sound-effects` (padrão ligado; `0` desliga).

### Eventos Socket.io principais

- `register`, `login` (recebem `protocol`; ver “Versão do protocolo”)
- `join-text` (room), `join-voice` (room), `leave-voice`
- `room-users`, `voice-rooms`
- `server-members` (servidor → cada cliente autenticado: todas as contas, com `online`, `status`, `voiceRoom`, `muted`; reenviado após login, logout, desconexão, mudanças de voz e de status)
- `music-rooms` (servidor → clientes autenticados: lista de canais de voz com música)
- `user-joined`, `user-left`
- `update-state` (mudo/status/`sharing` — compartilhando tela)
- `resume` ({ token, protocol }, callback): reconexão sem senha. `register`/`login`/`resume` respondem `{ success, username, token, protocol }`; o token vem de `sessions.js`
- `signal` (offer, answer, candidate); só é repassado para sockets autenticados
- `save-message` ({ room, text, image? }, callback → `{ success, id }`): o autor é **sempre** o usuário autenticado do socket (o campo `user` do cliente é ignorado). `image` = `{ data: ArrayBuffer, type, width, height }`, até 2 MB (`maxHttpBufferSize` 3 MB); o arquivo vai para `uploads/<uuid>.<ext>` e é servido em `GET /uploads/<nome>` pelo mesmo servidor HTTP
- `new-message` (servidor → **todas** as pessoas logadas: `{ room, id, user, text, created_at, image?, mentions }`); o cliente mostra se `room` é o canal aberto e conta como não lida nos outros
- `edit-message` / `delete-message` ({ room, id[, text] }, callback): só o autor; difundem `message-updated` ({ room, id, text, edited_at }) e `message-deleted` ({ room, id }) para todos os logados
- `get-messages`, `messages-cleared`, `delete-my-messages`
- `disconnect`
- Música (`main.js`): cliente → servidor `music-add` (url, callback), `music-remove` (itemId), `music-skip` (itemId atual), `music-toggle`, `music-ended` (itemId), `music-error` ({ itemId, code }). Servidor → sala de voz: `music-state` (`queue`, `playing`, `positionMs`, `serverNow`) e `music-notice` (texto curto, ex.: "Não foi possível tocar"). `music-state` também vai para quem entra na voz.
- Estado da música fica em `musicByRoom` (por sala de voz): é apagado quando a fila esvazia ou a sala fica vazia. Com música tocando, o servidor reenvia `music-state` a cada `RESYNC_INTERVAL_MS` (15 s).

- `join-text` troca o canal de texto (sem mídia). `join-voice` entra numa voz (sai antes da anterior). `leave-voice` sai da voz. Só aceitam ids da lista em `channels.js`.
- `save-message`, `edit-message`, `delete-message`, `get-messages` e `delete-my-messages` só funcionam para o canal de texto atual do socket (`canUseTextRoom`).
- Cadastro: usuário com 2 a 24 letras, números, `.`, `-` ou `_`, sem repetir ignorando maiúsculas.

### Reconexão

- O Socket.io reconecta sozinho. O cliente guarda o token **só na memória** (`sessionToken`): fechar o app volta para o login (invariante "a primeira tela é o login").
- No `connect` com usuário logado, o cliente manda `resume`, depois `update-state` (antes do `join-voice`, para invisível continuar invisível), `join-text` + `get-messages` e, se estava na voz, fecha os peers e manda `join-voice` de novo. A faixa `#conn-banner` fica visível enquanto estiver desconectado.
- O servidor guarda só o hash SHA-256 dos tokens em `sessions.json` (validade 7 dias), então reiniciar o Vox do host não derruba quem está conectado. `logout` revoga o token.
- `resume` recusado (token vencido, conta apagada) → `endSession` volta para o login com a mensagem.
- A primeira `room-users` depois de reconectar não toca som (`soundRoster = undefined`).

### Canais de texto e de voz

- Texto e voz são independentes: a pessoa está sempre em **exatamente 1** canal de texto e em **no máximo 1** canal de voz.
- Trocar de canal de texto nunca mexe em mídia nem na chamada; trocar ou sair da voz não mexe no chat.
- Canais de texto não abrem microfone nem WebRTC. Canais de voz não têm chat.
- Login: entra sempre em `#geral` e na `voz-sala`, com o microfone aberto.
- Não existe mais tela “Entrar em um canal”.
- Câmera e compartilhamento de tela só funcionam com voz conectada; os botões Cam, Tela e ✕ ficam desabilitados sem voz.

### Versão do protocolo

- `PROTOCOL_VERSION` em `protocol.js` é compartilhado por cliente e servidor. Hoje é `5` (a versão 1 usava `join-room`/`leave-room`; a 3 adicionou os eventos `music-*`; a 4 adicionou `server-members` e `music-rooms`; a 5 adicionou `resume`, ids nas mensagens, editar/apagar, imagens e `new-message` para todos os logados).
- O cliente envia `protocol` em `register` e `login`; o servidor recusa versão diferente (inclusive cliente antigo, sem o campo) com a mensagem “Seu Vox está em uma versão diferente da do servidor. Atualize para entrar.”
- **Suba `PROTOCOL_VERSION` sempre que um evento ou payload mudar de forma incompatível** (nome, campos obrigatórios, significado). Mudança compatível não exige.

### Presença e status

- Modos: `online`, `away` (Ausente), `busy`, `invisible`. O menu de status tem Online, Ausente, Ocupado e Invisível.
- Ausente manual fica até a pessoa trocar de modo; atividade não o desfaz.
- `away` automático após 5 minutos de inatividade, apenas no modo `online`; atividade desfaz só o automático.
- O status vale também sem voz: fica em `socket.data.status` e é aplicado na próxima entrada na voz.
- Usuários invisíveis não aparecem para os outros; o servidor filtra a lista por socket.
- Ao ficar invisível, o cliente fecha os peers de mídia; ao voltar, recria.
- A lista da voz e a coluna Membros mostram a bolinha de status sobre o avatar, com brilho.
- Não reintroduzir participantes fantasma/de teste: foram removidos.

### Chat e retenção

- Regras puras em `chat-state.js` (`VoxChat` no renderer): texto até 2000 caracteres, menções (`splitMentions`/`mentionsOf`, nomes de contas do servidor, sem diferenciar maiúsculas), editar/apagar só do autor, contadores de não lidas e `shouldNotify`.
- Mensagens antigas sem `id` recebem um na carga (`ensureIds`).
- Não lidas: só no cliente (`unread`), zeram ao abrir o canal ou voltar o foco para a janela; badge `.unread-badge` (com `@` quando há menção) e contagem no título.
- Notificações: `Notification` do HTML5 + `app.setAppUserModelId` (sem ele o Windows não mostra). Modo em `vox-notify-mode` (`all`, `mentions`, `off`); Ocupado não avisa. Menção toca o som `mention` (`sounds.js`). Com a janela sem foco, a barra de tarefas pisca (`flash-frame`).
- Imagens: o cliente reduz para no máximo 1920 px e recomprime em WebP até caber em 2 MB (GIF vai sem mexer). Arquivos em `uploads/` somem com a mensagem (7 dias, limite de 200, apagar) e os órfãos são removidos ao iniciar.
- Cada canal guarda no máximo **200 mensagens**.
- Mensagens com mais de **7 dias** são removidas:
  - ao iniciar;
  - a cada hora;
  - antes de ler/gravar mensagens.
- Configurações → aba Áudio (no fim) tem o botão para apagar todas as mensagens do próprio usuário no canal atual.

## 5. Dados e persistência

### Caminhos

Em desenvolvimento (`app.isPackaged === false`):

```text
C:\Users\Usuario\discord-clone-windows\users.json
C:\Users\Usuario\discord-clone-windows\messages.json
```

No app instalado:

```text
C:\Users\Usuario\AppData\Roaming\Vox\users.json
C:\Users\Usuario\AppData\Roaming\Vox\messages.json
```

Código relevante:

```js
const DATA_DIR = app.isPackaged ? app.getPath('userData') : __dirname;
```

### Formato

`users.json`:

```json
{
  "usuario": {
    "salt": "16 bytes em hex",
    "hash": "PBKDF2-SHA512, 100000 iteracoes, 64 bytes em hex",
    "created_at": "ISO-8601"
  }
}
```

- Senhas nunca são gravadas em texto puro.
- Salt individual por usuário.

`messages.json`:

```json
{
  "canal": [
    { "id": "uuid", "user": "usuario", "text": "mensagem", "created_at": "ISO-8601",
      "edited_at": "ISO-8601 (opcional)", "image": { "file": "uuid.webp", "width": 1920, "height": 1080 } }
  ]
}
```

`sessions.json`: `{ "<sha256 do token>": { "username": "usuario", "expires": 1700000000000 } }`. `uploads/`: imagens do chat. Ambos ficam ao lado de `users.json` e fora do Git e do instalador.

### Preferências no localStorage

- `vox-server-url`
- `audioInputId`, `audioOutputId`, `monitorEnabled`
- `vox-noise-suppression`, `vox-noise-gate-level`
- `vox-share-resolution`, `vox-share-fps`
- `vox-peer-volumes` (volume de cada pessoa, só neste computador)
- `vox-theme` (id do tema; inválido ou ausente → `escuro`)
- `vox-reduce-motion` (`1` desliga as animações dos temas)
- `vox-music-volume` (volume local do player de música, 0–100, padrão 50; só neste computador)
- `vox-sound-effects` (`0` desliga os efeitos sonoros; ausente ou `1` = ligados)
- `vox-notify-mode` (`all` padrão, `mentions` ou `off`)

Ficam no perfil do Electron em `%APPDATA%\Vox` (no macOS em desenvolvimento: `~/Library/Application Support/vox`). Antes do Vox as chaves começavam com `concord-`; `migrateLegacyStorage` copia para `vox-*` sem sobrescrever.

### Migração do Concord

- `migrateLegacyUserData` (topo de `main.js`) copia a pasta `Concord`/`concord` para a `userData` do Vox uma única vez, sem `Cache`, `Code Cache`, `GPUCache`, `DawnCache`, `Crashpad` e arquivos `Singleton*`, e grava a marca `.migrado-do-concord`.
- **Medido:** o Electron cria a pasta `userData` (vazia) antes do código de `main.js` rodar. Por isso a checagem usa a marca e a presença de dados próprios (`Local Storage`, `users.json`, `messages.json`), não "a pasta existe".
- `appId` continua `com.seunome.concord` de propósito: trocar faria o Windows tratar o Vox como outro programa em vez de atualizar o instalado.

### Regras

- Nunca apagar `users.json` ou `messages.json` sem autorização explícita.
- Ao testar cadastro, remover a conta de teste depois e restaurar o estado.
- Não usar PowerShell 5.1 `Set-Content -Encoding UTF8` para editar JSON: ele adiciona BOM. O leitor remove BOM, mas o ideal é gravar sem BOM com Node (`fs.writeFileSync`) ou com a ferramenta de edição.
- O instalador não deve incluir dados de usuário (`users.json`, `messages.json`, `sessions.json`, `uploads/`), `tools/`, `AGENTS.md` nem o `.bat` do túnel.

## 6. Invariantes do produto

Manter estas decisões, salvo pedido explícito do usuário:

- A primeira tela é o login/cadastro.
- O layout do chat não pode crescer com o histórico; use grids/flex com altura fixa e scroll interno.
- Câmera começa **desligada**; o usuário liga manualmente.
- Microfone começa ligado.
- Status Online/Ausente/Ocupado/Invisível; Ausente automático após 5 minutos (só a partir de Online) e manual pelo menu.
- Sempre exatamente 1 canal de texto ativo; no máximo 1 canal de voz.
- Login entra em `#geral` e na `voz-sala` com microfone aberto. Sem tela de “Entrar em um canal”.
- Cam e Tela só com voz conectada.
- Configurações de entrada/saída de áudio e monitoramento do próprio microfone.
- Compartilhamento de tela com seletor de janela/tela.
- Sem participantes fantasma.
- Mensagens apagadas após 7 dias e limite de 200 por canal.
- Música: sem download; o player oficial do YouTube toca em cada pessoa; fila de até 50 músicas por sala de voz; sair da voz para a música de quem saiu.
- Ícones SVG (Lucide) em vez de emojis, para ficar igual em qualquer sistema.
- A janela usa os botões nativos do sistema (sem minimizar/maximizar/fechar próprios).
- Efeitos de tema nunca ficam por cima dos vídeos nem do player do YouTube (os termos do YouTube proíbem cobrir o player).
- Temas inspirados em obras (Anime) sem imagens, logos nem nomes oficiais: o repositório é público.
- Não usar serviços pagos.

## 7. Armadilhas conhecidas

### Node fora do PATH

`electron-builder` chama `node` internamente. Sem ajustar o PATH, o build falha com `'"node"' não é reconhecido`.

### electron-builder e symlinks

No Windows sem privilégio de symlink, a extração do `winCodeSign` falha. Por isso `package.json` usa:

```json
"win": {
  "target": "nsis",
  "signAndEditExecutable": false
}
```

Não remova isso sem testar. Consequências atuais:

- instalador **sem assinatura digital**;
- o electron-builder não grava ícone nem versão no `Vox.exe`: quem faz isso é `scripts/after-pack.js` (hook `afterPack`, com o pacote `rcedit`). **Medido:** `Vox.exe` e `Vox-Setup-*.exe` saem com o ícone do Vox e versão no arquivo;
- SmartScreen pode avisar.

### Porta 3000

- Só uma instância deve usar a porta.
- Feche o app instalado antes de rodar `npm start`.
- Feche o app de desenvolvimento antes de abrir o instalado.
- `main.js` tem `server.on('error')` para logar conflito de porta, mas não resolve dados divergentes entre dev e instalado.

### Dados separados

O app instalado e o de desenvolvimento usam pastas diferentes. Copiar código não copia dados. Se precisar migrar:

```powershell
Copy-Item users.json "$env:APPDATA\Vox\users.json" -Force
Copy-Item messages.json "$env:APPDATA\Vox\messages.json" -Force
```

Pare o app antes de copiar.

### Túnel

- O túnel gratuito do Cloudflare muda de URL quando reinicia.
- Não hardcodar a URL do túnel no código.
- Botão "Abrir para amigos" (Configurações → Servidor): `tunnel.js` no processo principal roda `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000`, lê o endereço do log (`parseTunnelUrl`, ignora `api.trycloudflare.com`), reabre sozinho se cair e fecha com o app. Procura o binário em `tools/` (desenvolvimento) e em `%APPDATA%\Vox\tools`; se não houver, baixa da release oficial da Cloudflare no GitHub. Só fica habilitado quando o servidor do cliente é `127.0.0.1`/`localhost`.
- **Medido:** o endereço novo leva ~60 s para resolver no DNS deste PC (o túnel já está pronto antes disso).
- O host continua usando `http://127.0.0.1:3000`; o amigo usa a URL pública.
- O túnel carrega Socket.io (login, chat, presença, sinalização), **não** carrega áudio/vídeo.
- Sem TURN, chamadas entre redes restritivas podem falhar.

### Áudio

- Para testar o microfone, use “Ouvir meu microfone (teste)” com fones.
- Ao mexer no áudio local, cuidado para não criar loop/feedback.

### Temas e cores

- Todo o CSS de `index.html` usa só variáveis do tema (`var(--bg)`, `var(--accent)`…); tons derivados usam `color-mix()`. `test/css-tokens.test.js` falha se aparecer cor fixa (só `#fff`, `#000` e `rgba(0,0,0,…)` são aceitos).
- Contraste mínimo 4.5:1 testado em `test/themes.test.js`. `accent` é fundo (texto `on-accent`); para texto destacado use `--link`. Fundo de botão de perigo e selo AO VIVO: `--danger-bg`.
- Cores das bolinhas de avatar (`AVATAR_COLORS`) não mudam por tema.
- Efeitos dos temas Anime ficam em `:root[data-theme="…"]` no fim do CSS. Camadas de fundo da chamada usam `#call-area::before/::after` com `z-index: 0`; `#video-grid` e `#call-empty` ficam em `z-index: 1`. Padrões em SVG entram como máscara (`-webkit-mask`, cor vinda de `background: var(--…)`), assim o teste de cores fixas continua valendo.
- Toda animação nova de tema precisa entrar na regra de "Reduzir animações" (`[data-reduce-motion="1"]` e `prefers-reduced-motion`).
- O kanji 忍 do tema Ninja usa fonte Mincho do sistema (Hiragino no macOS, Yu Mincho no Windows — não verificado no Windows).

### Versão incompatível

- Cliente e servidor com `PROTOCOL_VERSION` diferentes não entram: o login é recusado com a mensagem para atualizar. Quem usa o instalador antigo precisa instalar o novo.
- Ao mudar eventos (ver “Versão do protocolo” na seção 4), suba a versão nos dois lados e lembre de gerar o instalador novo.

### Música do YouTube e `Referer`

- O app carrega a página por `file://` (`loadFile`). Nesse caso o player do YouTube fica pronto e falha com **erro 153** (configuração do player); não toca. Medido no macOS.
- Solução atual: `main.js` injeta `Referer: https://github.com/viniciusog1/vox` via `session.defaultSession.webRequest.onBeforeSendHeaders`, só em `https://www.youtube.com/*`, `https://*.youtube.com/*` e `https://*.googlevideo.com/*`. Não remova nem restrinja esse filtro sem testar a música de novo.
- **Pendência:** não verificado no Windows (inferência: mesmo Chromium). Primeiro item a testar lá. Plano B, se falhar: servir a página por `http://127.0.0.1` local em vez de `file://`.
- Vídeo sem incorporação (erros 101/150) ou indisponível (100) não toca: o cliente envia `music-error` e o servidor pula com um aviso.
- Não baixamos nem reenviamos áudio/vídeo do YouTube; o player oficial roda em cada máquina.

### Bundle do Socket.io

`socket.io.min.js` é copiado de `node_modules/socket.io/client-dist/socket.io.min.js` pelo `postinstall`. Não editar manualmente; rode `npm install` se precisar regenerar.

## 8. Checklist de teste

Antes de considerar uma alteração concluída:

1. `node --check main.js` e `node --check renderer.js`.
2. Abrir em desenvolvimento e conferir:
   - título da janela **Vox**;
   - tela de login;
   - porta 3000 ativa;
   - console sem exceções.
3. Testar câmera:
   - entra sem track de vídeo;
   - botão “Cam Off”;
   - ligar mostra vídeo local;
   - desligar remove o vídeo.
4. Testar login/cadastro e chat em um canal.
5. Testar entrada/saída de canal de voz e botão de sair; trocar de canal de texto não deve derrubar a voz.
   - Música: colar um link do YouTube, pausar, pular, remover e conferir que o player toca (sem erro 153) e que sair da voz para a música de quem saiu.
6. Testar compartilhamento de tela: abrir seletor, escolher, parar.
7. Testar layout com muitas mensagens: a janela não deve crescer.
8. Gerar instalador e, se possível, testar `dist\win-unpacked\Vox.exe`.
9. Se testar conta temporária, removê-la e restaurar `users.json`/`messages.json`.
10. Deixar o app em estado limpo: sem instâncias duplicadas, sem contas de teste.

## 9. Estado atual conhecido

- Versão em `package.json`: `1.4.0` (Electron 45.2.1, electron-updater 6). `PROTOCOL_VERSION` `5`.
- Atualização automática (`setupAutoUpdate` em `main.js`, só no app instalado): procura na release mais recente do GitHub ao abrir e a cada 4 h, baixa sozinha e mostra `#update-banner`; instala em "Reiniciar e atualizar" ou ao fechar. **Medido:** sem `latest.yml` na release (caso da v1.2.0 publicada hoje) só registra erro 404 no log, sem afetar o app. Versões até 1.3.0 não têm o atualizador: instalar a 1.4.0 à mão uma vez.
- O pacote `electron` 45 não tem script de instalação: o `electron.exe` é baixado na primeira vez que `npm start` roda (ou com `node node_modules/electron/install.js`). Exige Node ≥ 22.12.
- Instaladores antigos (ainda com o nome Concord) no PC com Windows: `dist\Concord Setup 1.0.0.exe`, `1.0.1.exe` e `1.0.2.exe`. Nenhum instalador foi gerado desde a troca de nome e as mudanças de temas, música, membros e conexão.
- Instalador NSIS sem assinatura, com o ícone próprio do Vox.
- No Windows, o app antigo está instalado como Concord (`%LOCALAPPDATA%\Programs\Concord`), com dados em `%APPDATA%\Concord` (conta `vinicius` e histórico de `geral`).
- Pendências: compartilhamento 1080p60 (captura limitada a ~32 fps com o Vox em segundo plano); servidor TURN; testar a atualização automática com uma release real (1.4.0 → seguinte); conferir as notificações do Windows no app instalado.
- O app instalado e o de desenvolvimento podem estar em estados diferentes; sempre confirme qual está rodando.
- O Cloudflare Tunnel pode estar ativo. A URL é temporária e não deve ser documentada como fixa.
