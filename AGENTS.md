# AGENTS.md — Concord

Guia para agentes de IA que forem alterar este projeto. Leia antes de editar.

## 1. Contexto

- Aplicativo desktop para Windows 11 inspirado no Discord.
- Nome do produto: **Concord**. Não usar “MeuDiscord”.
- Stack: **Electron 28 + Node.js + Socket.io 4 + WebRTC**.
- Interface em português.
- Não há banco de dados: usuários e mensagens ficam em arquivos JSON.
- O servidor Socket.io é embutido no processo principal do Electron e escuta em `0.0.0.0:3000`.
- Não há nuvem central: o PC do host é o servidor.
- Não há repositório git configurado neste workspace; não assuma comandos git.

Caminhos principais:

```text
Projeto:              C:\Users\Usuario\discord-clone-windows
App instalado:        C:\Users\Usuario\AppData\Local\Programs\Concord\Concord.exe
Dados do instalado:   C:\Users\Usuario\AppData\Roaming\Concord
Instalador gerado:    C:\Users\Usuario\discord-clone-windows\dist\Concord Setup 1.0.0.exe
Ferramenta de túnel:  C:\Users\Usuario\discord-clone-windows\tools\cloudflared.exe
Atalho do túnel:      C:\Users\Usuario\discord-clone-windows\IniciarTunelConcord.bat
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

Saída: `dist\Concord Setup 1.0.0.exe`.

### Instalar/testar o pacote

- Feche o app de desenvolvimento antes de abrir o instalado: ambos usam a porta 3000.
- Para testar sem instalar: `dist\win-unpacked\Concord.exe`.
- O app instalado é um snapshot; alterações no código só aparecem depois de rodar `npm run dist` e reinstalar.

## 3. Mapa de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `main.js` | Processo principal: janela, permissões, servidor Socket.io, autenticação, presença, salas, mensagens, retenção, `desktopCapturer` e seletor de tela, fila de música por sala de voz (`musicByRoom`) e o `Referer` injetado nas requisições do YouTube. |
| `renderer.js` | Interface e lógica do cliente: login, canais, chat, WebRTC, câmera/microfone, compartilhamento de tela, status, configurações de áudio. |
| `themes.js` | Os 13 temas (paletas, id padrão `escuro`), leitura/gravação em `localStorage['concord-theme']` e `applyTheme`. Carregado no `<head>` antes do CSS para aplicar o tema antes da primeira pintura. Também é módulo Node (testes). |
| `speaking.js` | Detecção de "falando" com histerese (liga ≥ 0.12, desliga após 250 ms abaixo) para o anel do avatar. |
| `channels.js` | Lista fixa de canais: `TEXT_CHANNELS` (`geral`, `jogos`, `musica`) e `VOICE_CHANNELS` (`voz-sala`, `voz-jogos`, `voz-musica`); padrões `geral` e `voz-sala`. Usado por `main.js` e `renderer.js`. Também é módulo Node (testes). |
| `protocol.js` | `PROTOCOL_VERSION` (hoje `3`), mensagem de versão incompatível e `isCompatible`. Usado por `main.js` e `renderer.js`. Também é módulo Node (testes). |
| `youtube.js` | `parseYouTubeId` (aceita links `youtu.be`, `watch?v=`, `shorts`, `embed`), `thumbnailUrl` e `lookupVideo` (oEmbed público, sem chave, timeout de 4 s). Usado por `main.js`. Também é módulo Node (testes). |
| `music-state.js` | Regras puras da fila de música: `MAX_QUEUE` (50), `SYNC_TOLERANCE_MS` (2000), `RESYNC_INTERVAL_MS` (15000), `SEEK_COOLDOWN_MS` (5000), `shouldCorrectSeek`, adicionar/remover, pular ou terminar só se o item ainda é o atual, alternar pausa e posição atual. Usado por `main.js` e `renderer.js`. Também é módulo Node (testes). |
| `presence.js` | Regras de status: modo escolhido (`online`, `away`, `busy`, `invisible`), ausente automático só a partir de Online e atividade que desfaz só o automático. Também é módulo Node (testes). |
| `room-state.js` | Estado público do usuário na sala de voz (`publicUser`, `applyStatePatch`: `muted`, `status`, `sharing`) e troca de canais (`joinVoiceRoom`, `leaveVoiceRoom`, `canUseTextRoom`, `socketRoomsToLeave`). Usado por `main.js`. |
| `test/` | Testes `node:test` (`npm test`): paletas e contraste, CSS sem cores fixas, estado da sala, detecção de fala, YouTube e fila de música. Fora do instalador. |
| `preload.js` | Ponte segura `contextBridge` para controles da janela e IPC do seletor de tela. |
| `index.html` | Layout e CSS de toda a interface; também contém os modais e a tela de login. |
| `package.json` | Scripts, dependências e configuração do electron-builder. |
| `socket.io.min.js` | Bundle do cliente Socket.io copiado pelo `postinstall`; **não editar à mão**. |
| `users.json` | Dados de desenvolvimento das contas. Não faz parte do instalador. |
| `messages.json` | Dados de desenvolvimento das mensagens. Não faz parte do instalador. |
| `README.md` | Documentação para o usuário final. |
| `AGENTS.md` | Este guia. |
| `tools/cloudflared.exe` | Cloudflare Tunnel para o host. Não faz parte do instalador. |
| `IniciarTunelConcord.bat` | Inicia o túnel no host. Não faz parte do instalador. |

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
  const SERVER_URL = localStorage.getItem('concord-server-url') || 'http://127.0.0.1:3000';
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
  - `getDisplayMedia({ video: currentShareVideoConstraints(), audio: false })`.
  - Qualidade escolhida no seletor: `#share-resolution` (480/720/1080) e `#share-fps` (30/60), padrão 1080p30.
  - Persistência em `concord-share-resolution` e `concord-share-fps`.
  - O track da tela substitui o da câmera em todos os peers via `replaceVideoTrackEverywhere`.
  - Encoder: H.264 preferido (`preferVideoCodecs`, cai para VP8 se não houver). VP8 em modo tela a 1080p cai para 1–4 fps (medido).
  - `contentHint`: `motion` em 60 fps (prioriza fluidez), `detail` em 30 fps (prioriza nitidez). `applyVideoSenderParams` aplica `maxBitrate` (`SHARE_BITRATES`), `maxFramerate` e `degradationPreference` em cada peer.
  - `withVideoBitrateHints` adiciona `x-google-start-bitrate`/`x-google-min-bitrate` na descrição remota; sem isso a banda começa em ~300 kbps.
  - `adoptOfferTransceivers`: no lado que responde à oferta, move as faixas locais para os transceivers negociados. Sem isso, quem entra depois na sala não envia vídeo.
  - O `<video>` de cada stream é reaproveitado entre `renderTiles` (`videoElements`); `mute` remoto só troca para o avatar após 1,5 s.
  - Diagnóstico: **Ctrl+Shift+D** mostra fps/resolução/banda/codec/limitação por participante.
  - Ao parar, volta para a câmera (se ligada) ou remove o vídeo.
  - Visualização em tela cheia: cada tile com vídeo tem botão ⛶ e duplo clique; usa `#fullscreen-view` + `requestFullscreen`.
- Música (YouTube):
  - A fila aparece como primeiro tile da grade de chamada enquanto houver música; o botão 🎵 da barra superior (desabilitado sem voz) e o tile abrem o painel `#btn-music` / modal de música.
  - Quem está na voz controla a fila. Sair da voz interrompe a música só para quem saiu.
  - Nada é baixado: o player oficial do YouTube (IFrame API) toca em cada computador. Em tela cheia, o player vai para um canto dentro de `#fullscreen-view`.
  - Volume local em `localStorage['concord-music-volume']` (não é sincronizado).
  - Sincronização: o cliente estima a posição a partir de `positionMs`/`serverNow` e faz `seekTo` só se a diferença passar de `SYNC_TOLERANCE_MS`, respeitando `SEEK_COOLDOWN_MS`.
- Áudio do microfone:
  - Pipeline de redução de ruído: high-pass (85 Hz) → gate (AudioWorklet `concord-noise-gate` via Blob) → compressor → gain → `MediaStreamAudioDestination`.
  - `micProcessedTrack` é a faixa enviada aos peers; `getOutboundAudioTracks()` decide entre processada e bruta.
  - Modos em `concord-noise-suppression`: `off`, `browser`, `strong`. Intensidade em `concord-noise-gate-level`.
  - O monitor do próprio microfone toca a faixa processada.
- O indicador de áudio analisa **somente streams remotos**. O microfone local não entra na barra; para testar o próprio microfone existe o toggle de monitoramento nas configurações.

### Eventos Socket.io principais

- `register`, `login` (recebem `protocol`; ver “Versão do protocolo”)
- `join-text` (room), `join-voice` (room), `leave-voice`
- `room-users`, `voice-rooms`
- `user-joined`, `user-left`
- `update-state` (mudo/status/`sharing` — compartilhando tela)
- `signal` (offer, answer, candidate)
- `save-message`, `get-messages`, `new-message`, `messages-cleared`
- `delete-my-messages`
- `disconnect`
- Música (`main.js`): cliente → servidor `music-add` (url, callback), `music-remove` (itemId), `music-skip` (itemId atual), `music-toggle`, `music-ended` (itemId), `music-error` ({ itemId, code }). Servidor → sala de voz: `music-state` (`queue`, `playing`, `positionMs`, `serverNow`) e `music-notice` (texto curto, ex.: "Não foi possível tocar"). `music-state` também vai para quem entra na voz.
- Estado da música fica em `musicByRoom` (por sala de voz): é apagado quando a fila esvazia ou a sala fica vazia. Com música tocando, o servidor reenvia `music-state` a cada `RESYNC_INTERVAL_MS` (15 s).

- `join-text` troca o canal de texto (sem mídia). `join-voice` entra numa voz (sai antes da anterior). `leave-voice` sai da voz. Só aceitam ids da lista em `channels.js`.
- `save-message`, `get-messages` e `delete-my-messages` só funcionam para o canal de texto atual do socket (`canUseTextRoom`).

O servidor atualmente confia no campo `user` enviado em `save-message`. Para endurecer a segurança, troque para o username autenticado do socket.

### Canais de texto e de voz

- Texto e voz são independentes: a pessoa está sempre em **exatamente 1** canal de texto e em **no máximo 1** canal de voz.
- Trocar de canal de texto nunca mexe em mídia nem na chamada; trocar ou sair da voz não mexe no chat.
- Canais de texto não abrem microfone nem WebRTC. Canais de voz não têm chat.
- Login: entra sempre em `#geral` e na `voz-sala`, com o microfone aberto.
- Não existe mais tela “Entrar em um canal”.
- Câmera e compartilhamento de tela só funcionam com voz conectada; os botões Cam, Tela e ✕ ficam desabilitados sem voz.

### Versão do protocolo

- `PROTOCOL_VERSION` em `protocol.js` é compartilhado por cliente e servidor. Hoje é `3` (a versão 1 usava `join-room`/`leave-room`; a 3 adicionou os eventos `music-*`).
- O cliente envia `protocol` em `register` e `login`; o servidor recusa versão diferente (inclusive cliente antigo, sem o campo) com a mensagem “Seu Vox está em uma versão diferente da do servidor. Atualize para entrar.”
- **Suba `PROTOCOL_VERSION` sempre que um evento ou payload mudar de forma incompatível** (nome, campos obrigatórios, significado). Mudança compatível não exige.

### Presença e status

- Modos: `online`, `away` (Ausente), `busy`, `invisible`. O menu de status tem Online, Ausente, Ocupado e Invisível.
- Ausente manual fica até a pessoa trocar de modo; atividade não o desfaz.
- `away` automático após 5 minutos de inatividade, apenas no modo `online`; atividade desfaz só o automático.
- O status vale também sem voz: fica em `socket.data.status` e é aplicado na próxima entrada na voz.
- Usuários invisíveis não aparecem para os outros; o servidor filtra a lista por socket.
- Ao ficar invisível, o cliente fecha os peers de mídia; ao voltar, recria.
- A lista da voz mostra a bolinha de status ao lado do avatar.
- Não reintroduzir participantes fantasma/de teste: foram removidos.

### Chat e retenção

- Cada canal guarda no máximo **200 mensagens**.
- Mensagens com mais de **7 dias** são removidas:
  - ao iniciar;
  - a cada hora;
  - antes de ler/gravar mensagens.
- O botão de configurações permite apagar todas as mensagens do próprio usuário no canal atual.

## 5. Dados e persistência

### Caminhos

Em desenvolvimento (`app.isPackaged === false`):

```text
C:\Users\Usuario\discord-clone-windows\users.json
C:\Users\Usuario\discord-clone-windows\messages.json
```

No app instalado:

```text
C:\Users\Usuario\AppData\Roaming\Concord\users.json
C:\Users\Usuario\AppData\Roaming\Concord\messages.json
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
    { "user": "usuario", "text": "mensagem", "created_at": "ISO-8601" }
  ]
}
```

### Preferências no localStorage

- `concord-server-url`
- `audioInputId`
- `audioOutputId`
- `monitorEnabled`
- `concord-theme` (id do tema; inválido ou ausente → `escuro`)
- `concord-music-volume` (volume local do player de música, 0–100, padrão 50; só neste computador)

Ficam no perfil do Electron em `%APPDATA%\Concord`.

### Regras

- Nunca apagar `users.json` ou `messages.json` sem autorização explícita.
- Ao testar cadastro, remover a conta de teste depois e restaurar o estado.
- Não usar PowerShell 5.1 `Set-Content -Encoding UTF8` para editar JSON: ele adiciona BOM. O leitor remove BOM, mas o ideal é gravar sem BOM com Node (`fs.writeFileSync`) ou com a ferramenta de edição.
- O instalador não deve incluir dados de usuário, `tools/`, `AGENTS.md` nem o `.bat` do túnel.

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
- ícone padrão do Electron;
- SmartScreen pode avisar.

### Porta 3000

- Só uma instância deve usar a porta.
- Feche o app instalado antes de rodar `npm start`.
- Feche o app de desenvolvimento antes de abrir o instalado.
- `main.js` tem `server.on('error')` para logar conflito de porta, mas não resolve dados divergentes entre dev e instalado.

### Dados separados

O app instalado e o de desenvolvimento usam pastas diferentes. Copiar código não copia dados. Se precisar migrar:

```powershell
Copy-Item users.json "$env:APPDATA\Concord\users.json" -Force
Copy-Item messages.json "$env:APPDATA\Concord\messages.json" -Force
```

Pare o app antes de copiar.

### Túnel

- O túnel gratuito do Cloudflare muda de URL quando reinicia.
- Não hardcodar a URL do túnel no código.
- O host continua usando `http://127.0.0.1:3000`; o amigo usa a URL pública.
- O túnel carrega Socket.io (login, chat, presença, sinalização), **não** carrega áudio/vídeo.
- Sem TURN, chamadas entre redes restritivas podem falhar.

### Áudio

- A barra “Ninguém falando” é normal quando se está sozinho: ela só analisa áudio remoto.
- Para testar o microfone, use “Ouvir meu microfone (teste)” com fones.
- Ao mexer no áudio local, cuidado para não criar loop/feedback.

### Temas e cores

- Todo o CSS de `index.html` usa só variáveis do tema (`var(--bg)`, `var(--accent)`…); tons derivados usam `color-mix()`. `test/css-tokens.test.js` falha se aparecer cor fixa (só `#fff`, `#000` e `rgba(0,0,0,…)` são aceitos).
- Contraste mínimo 4.5:1 testado em `test/themes.test.js`. `accent` é fundo (texto `on-accent`); para texto destacado use `--link`. Fundo de botão de perigo e selo AO VIVO: `--danger-bg`.
- Cores das bolinhas de avatar (`AVATAR_COLORS`) não mudam por tema.

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
   - título da janela **Concord**;
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
8. Gerar instalador e, se possível, testar `dist\win-unpacked\Concord.exe`.
9. Se testar conta temporária, removê-la e restaurar `users.json`/`messages.json`.
10. Deixar o app em estado limpo: sem instâncias duplicadas, sem contas de teste.

## 9. Estado atual conhecido

- Versão `1.0.2` (qualidade do compartilhamento: 480p/720p/1080p e 30/60 fps, padrão 1080p30).
- Instaladores preservados: `dist\Concord Setup 1.0.0.exe`, `1.0.1.exe` e `1.0.2.exe`.
- Instalador NSIS gerado, sem assinatura e com ícone padrão do Electron.
- App instalado nesta máquina em `%LOCALAPPDATA%\Programs\Concord`.
- Dados do instalado em `%APPDATA%\Concord`; a conta `vinicius` e o histórico do canal `geral` foram copiados para lá.
- O app instalado e o de desenvolvimento podem estar em estados diferentes; sempre confirme qual está rodando.
- O Cloudflare Tunnel pode estar ativo. A URL é temporária e não deve ser documentada como fixa.
