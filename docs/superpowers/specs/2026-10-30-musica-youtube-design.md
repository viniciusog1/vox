# Música do YouTube na chamada ("ouvir juntos") — design

Data: 2026-10-30 · Projeto: Vox (código e produto ainda chamados "Concord")

## Intenção

Ouvir música do YouTube junto com quem está no mesmo canal de voz, como os bots de música do Discord, mas sem bot: cada pessoa toca o **player oficial do YouTube** no próprio Vox e o Vox só sincroniza o que toca, play/pause e o minuto. O áudio não passa pela chamada.

Por que não um bot que baixa e retransmite o áudio: viola os termos do YouTube (foi o motivo de o Google encerrar os bots Rythm e Groovy em 2021) e, na topologia P2P do Vox, exigiria um participante extra pesado no PC do host.

## Decisões do usuário

1. **Abordagem:** player oficial do YouTube sincronizado entre as pessoas da chamada ("ouvir juntos"), não bot.
2. **Fila compartilhada:** todo mundo adiciona músicas na fila.
3. **Controle:** qualquer pessoa da chamada pode pausar, continuar, pular e remover músicas da fila.
4. **Adicionar música:** colando o link do YouTube. Pesquisa por nome fica para depois.
5. **Na tela (opção C):** enquanto houver música, ela aparece como **mais um tile na grade da chamada**, ao lado dos vídeos das pessoas, com o player do YouTube dentro. Clicar no tile abre a fila e os controles.
6. **Windows:** desenvolver e testar no Mac agora; verificar no Windows quando houver acesso (primeiro item a testar lá, junto com o compartilhamento de tela). Plano B se o `Referer` falhar no Windows: servir a página por `http://127.0.0.1` local.
7. Escopo, volume e regras abaixo foram apresentados ao usuário e confirmados ("está correto").

## Objetivos

- Fila por canal de voz, sincronizada entre todos os membros do canal.
- Quem entra no canal no meio da música começa no mesmo minuto dos outros.
- Volume da música individual (cada um o seu), separado do volume das pessoas.
- Player sempre visível enquanto toca (exigência dos termos da API do YouTube; mínimo 200×200).

## Não-objetivos (agora)

- Pesquisa por nome, playlists, Spotify ou outras fontes.
- Votação para pular; permissões por pessoa.
- Persistir a fila após todos saírem do canal.
- Sincronização perfeita (diferença de até ~2 s entre pessoas é aceitável).

## Anti-objetivos

- Baixar, extrair ou retransmitir o áudio do YouTube (bot, `yt-dlp`, gravação de aba).
- Esconder o player ou tocar "só o áudio".
- Música tocando para quem não está no canal de voz, ou continuando depois de sair da voz.
- Uma pessoa pular e cada cliente avançar a fila por conta própria (pular duas músicas, filas divergentes).

## Como funciona

### Restrição medida: o YouTube não toca em página `file://`

Medido no Electron 28 do projeto (macOS), spike descartável:
- Página carregada com `loadFile` (`file://`): player fica pronto e dá **erro 153** (configuração do player); não toca.
- Página servida por `http://`: toca (estado 1).
- **`file://` + `Referer` injetado** nas requisições para `*.youtube.com` / `*.googlevideo.com` via `session.defaultSession.webRequest.onBeforeSendHeaders`: **toca**.

Decisão: manter `loadFile` e injetar `Referer: https://github.com/viniciusog1/vox` (endereço real do projeto, não um domínio inventado) só nessas URLs, em `main.js`. Não verificado no Windows (inferência: mesmo Chromium) — o plano deve verificar cedo.

### Estado no servidor (`main.js`, por canal de voz)

```
musicByRoom: Map<voiceRoom, {
  queue: [{ id, videoId, title, thumbnail, addedBy }],  // queue[0] é a música atual
  playing: boolean,
  positionMs: number,      // posição quando pausou / no último ajuste
  startedAt: number|null   // Date.now() do servidor quando voltou a tocar
}>
```

- Posição atual = `playing ? positionMs + (Date.now() - startedAt) : positionMs`.
- Cliente → servidor (só aceitos de quem está no canal de voz; usa `socket.data.voiceRoom`):
  - `music-add` (url): extrai o id do vídeo; inválido → callback com erro "Link do YouTube inválido". Busca título e capa no oEmbed público (`https://www.youtube.com/oembed?url=…&format=json`, sem chave); falhou → título = id, capa = `https://i.ytimg.com/vi/<id>/mqdefault.jpg`. Entra no fim da fila; se a fila estava vazia, começa a tocar do zero.
  - `music-remove` (itemId): remove da fila; se era a atual, passa para a próxima.
  - `music-skip` (itemId atual): avança se `itemId` ainda é o atual (evita pulos duplos).
  - `music-toggle`: pausa/continua, ajustando `positionMs`/`startedAt`.
  - `music-ended` (itemId) e `music-error` (itemId, código): avança só se `itemId` ainda é o atual (vários clientes avisam; só o primeiro conta).
- Servidor → canal de voz: `music-state` `{ queue, playing, positionMs, serverNow }` a cada mudança e para quem entra no canal (`join-voice`).
- Fila vazia → estado removido; todos saem do canal → estado removido.
- Limite: 50 músicas na fila.

### Cliente (`renderer.js`)

- Carrega a IFrame API do YouTube (`https://www.youtube.com/iframe_api`) uma vez, sob demanda.
- Ao receber `music-state`: estima `posição = positionMs + (agora − serverNow ajustado)` se tocando; carrega o vídeo se mudou; `seekTo` se a diferença for > 2 s; aplica play/pause.
- **Tile da música** na grade (`renderTiles`): aparece se `queue.length > 0`; contém o player e a faixa "🎵 título · N na fila"; nunca menor que 200×200. Clique abre o **painel de música**.
- **Painel de música:** campo "Cole um link do YouTube…", fila com capa/título/quem adicionou e ✕ por item, ⏯ e ⏭ (para todos) e controle de volume (só local, salvo em `localStorage`).
- **Botão 🎵 na barra do topo:** abre o mesmo painel; habilitado só com voz (como Cam/Tela).
- **Tela cheia:** com a visualização em tela cheia aberta, o player continua visível num canto.
- **Sair da voz:** destrói o player e fecha o painel; a música para para essa pessoa.
- Vídeo que não permite incorporação (erros 101/150) ou indisponível (100) → cliente envia `music-error`; servidor pula e todos veem um aviso curto "Não foi possível tocar «título»".

### Versão

Novos eventos → `PROTOCOL_VERSION = 3` (cliente e servidor precisam ter música dos dois lados; o aviso de versão já cobre a incompatibilidade).

## Decisões tomadas por mim (Claude), não pelo usuário

- **Fila por canal de voz**; só membros do canal ouvem e controlam (apresentado como palpite; usuário confirmou).
- **Tile some quando a fila acaba**; **botão 🎵 no topo** para começar quando não há tile.
- **Player num canto em tela cheia** (para continuar visível).
- **Referer injetado** em vez de servir a página por HTTP (medido; menor mudança).
- **Sincronização pelo relógio do servidor** com tolerância de 2 s; anúncios do YouTube podem dessincronizar alguém temporariamente — o ajuste acontece na próxima atualização.
- **Limite de 50 músicas** e **sem persistência** da fila.
- **Branch:** a partir de `main` (já com temas, canais e compartilhamento de tela).

## Decisões da revisão do builder (Claude)

- **Controles do próprio player:** `controls=0` e `disablekb=1`, **sem** sobreposição por cima do player (os termos do YouTube não permitem cobrir o player). Se o estado local divergir do compartilhado (ex.: clique no vídeo pausou só para a pessoa), o cliente reaplica o estado do servidor. Toda mudança passa pelos botões do painel.
- **Player nunca é recriado por mudanças da grade:** o elemento do player é persistente; `renderTiles` não pode removê-lo nem movê-lo no DOM (mover um iframe recarrega o vídeo). Ao entrar/sair da tela cheia, uma recarga curta do player é aceitável (o iframe precisa estar dentro do elemento em tela cheia).
- **Invisível:** continua ouvindo e controlando; músicas que adicionar aparecem sem nome ("adicionada por alguém"), para não revelar que está no canal.
- **oEmbed:** 401/404 → `music-add` recusa com "Esse vídeo não pode ser tocado aqui (privado, removido ou com incorporação desativada)."; timeout de 4 s ou erro de rede → aceita com título = id e capa padrão.
- **Sincronização:** offset de relógio estimado a cada `music-state` (`Date.now() − serverNow`, sem compensar latência); servidor reenvia `music-state` a cada 15 s enquanto toca; cliente faz `seekTo` se a diferença passar de 2 s.
- **Limite:** 50 músicas por canal; acima disso `music-add` recusa com "A fila está cheia (50 músicas)."; sem limite por pessoa.
- **Regras de fila em módulo puro testado** (`music-state.js`, mesmo padrão de `room-state.js`): adicionar, remover, pular/terminar só se o item ainda é o atual, alternar pausa, posição atual, limite. `music-ended` com a música pausada é ignorado. Reconexão do socket mantém o comportamento atual (sem reentrada automática).
- **Grade:** o tile da música vem primeiro; a área da chamada rola por dentro se não couber (o layout não cresce); o tile "Aguardando alguém entrar…" continua aparecendo quando você está sozinho.
- **Vale em todos os canais de voz** (inclusive "Música").
- **Docs:** README e AGENTS.md (eventos, `PROTOCOL_VERSION = 3`, chave de volume no `localStorage`) entram no plano; textos em português escritos por mim.

## Deixado para o builder

- Formato exato dos ids de item da fila e layout fino do painel e do tile.
- Quais formatos de link aceitar além de `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/` e `music.youtube.com/watch?v=` (ignorar parâmetros extras como `t=` e `list=`).
- Intervalo de ressincronização periódica, se houver.
