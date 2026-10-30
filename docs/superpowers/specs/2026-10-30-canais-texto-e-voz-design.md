# Canais de texto e de voz independentes, status Ausente e aviso de versão — design

Data: 2026-10-30 · Projeto: Vox (código e produto ainda chamados "Concord")

## Intenção

Hoje o app só conhece **uma "sala" por vez** (`currentRoom` no cliente, `socket.data.room` no servidor). Clicar num canal de texto entra nessa sala **com mídia**: liga o microfone e conecta por WebRTC com quem estiver no canal. Por isso, trocar de canal de texto derruba a chamada de voz, e o chat dos canais de voz é outro chat.

O usuário quer o modelo do Discord: a pessoa está sempre num canal de texto e, ao mesmo tempo e de forma independente, opcionalmente num canal de voz.

## Regras (decididas pelo usuário)

1. **Texto:** a pessoa está sempre em **exatamente 1** canal de texto. Não dá para sair; só trocar para outro.
2. **Voz:** no **máximo 1** canal de voz por vez. Dá para sair ("Desconectar").
3. Texto e voz ao mesmo tempo são permitidos e independentes: trocar de texto não mexe na chamada; trocar/sair da voz não mexe no chat.
4. **Câmera e compartilhamento de tela só com voz conectada.**
5. **Ao logar:** entra automaticamente em **`#geral`** e na **"Sala Principal"** (`voz-sala`), **com o microfone aberto** (não mutado). Sempre esses dois, não os últimos usados.
   - Claude avisou que abrir o microfone sem clique expõe áudio sem intenção; o usuário decidiu manter o microfone aberto.
6. **Sem tela de "Entrar em um canal"** depois do login (`#room-screen`): removida. Todos os usuários ficam num mesmo servidor global ("Casa dos Amigos"); criar e entrar em outros servidores fica para uma feature futura.
7. **Aviso de versão:** quando o app e o servidor estão em versões incompatíveis, o login mostra um aviso para atualizar o Vox em vez de falhar em silêncio.
8. **Status "Ausente" manual:** além de automático (5 min sem atividade, só a partir de Online), a pessoa pode escolher "Ausente" no menu de status.
9. **Bolinha de status no avatar da lista do canal de voz** (online/ausente/ocupado), junto com o anel de fala. Isso **substitui** a decisão anterior da opção C ("sem bolinha de status na lista do canal"), registrada em `2026-10-30-temas-e-avatares-voz-design.md`.

## Objetivos

- Separar estado de texto e de voz no cliente e no servidor.
- Canais de texto nunca abrem microfone nem WebRTC.
- Regras 1–5 garantidas na interface **e** no servidor (o servidor não aceita uma segunda sala de voz para o mesmo socket, nem "sair do texto").

## Não-objetivos

- Lembrar últimos canais usados.
- Canais criados pelo usuário / salas por nome digitado.
- Chat de texto dentro dos canais de voz.
- Migrar mensagens antigas gravadas sob chaves `voz-*` em `messages.json` (ficam como estão, sem acesso pela interface).

## Anti-objetivos

- Ficar em estado "sem canal de texto" em qualquer momento após o login (inclusive durante a troca).
- Ouvir/enviar áudio de um canal de texto.
- Câmera ou tela ficarem ativas (ou o selo AO VIVO) depois de sair da voz.
- Trocar de canal de texto e a chamada cair, piscar ou reconectar.

## Como funciona

### Aviso de versão

- Constante `PROTOCOL_VERSION = 2` compartilhada (cliente e servidor; a versão 1 é o protocolo atual com `join-room`).
- O cliente envia `protocol` no `login` e no `register`. O servidor responde `{ success: false, message: 'Seu Vox está em uma versão diferente da do servidor. Atualize para entrar.' }` quando `protocol !== PROTOCOL_VERSION` (inclui cliente antigo, que não envia o campo).
- O servidor inclui `protocol` na resposta de sucesso. Cliente novo num servidor antigo (resposta sem `protocol` ou diferente) mostra a mesma mensagem na tela de login e não segue para o app.

### Status Ausente

- Menu de status ganha "Ausente" (bolinha amarela), entre Online e Ocupado.
- Ausente manual não volta para Online com atividade; só o automático volta.
- O automático continua: 5 minutos sem atividade, só quando o modo é Online.
- O servidor já aceita `away` em `update-state`; nada muda lá.

### Bolinha de status na lista do canal de voz

- Avatar de 24px com a bolinha de status no canto inferior direito (mesmas cores e classes `.status-dot` do painel do usuário, com borda na cor do fundo da coluna), usando o `status` que `voice-rooms` já envia.
- O anel de fala continua em volta do avatar; a bolinha fica por cima do anel.
- Invisível: os outros não veem a pessoa na lista (como hoje); para ela mesma aparece a bolinha cinza.


### Servidor (`main.js`)

Estado por socket passa a ter dois campos: `socket.data.textRoom` e `socket.data.voiceRoom`.

Eventos novos (substituem `join-room`/`leave-room`):

| Evento | Efeito |
|---|---|
| `join-text` (room) | Sai da sala Socket.io do texto anterior e entra na nova; atualiza `textRoom`. Só aceita ids de canais de texto conhecidos (`geral`, `jogos`, `musica`). |
| `join-voice` (room) | Se já estiver em outra voz, sai dela primeiro (mesma lógica de `leave-voice`). Entra na sala Socket.io da voz, cria a entrada em `roomUsers` (`sharing: false`), avisa `user-joined`, transmite `room-users` e `voice-rooms`. Só aceita `voz-sala`, `voz-jogos`, `voz-musica`. |
| `leave-voice` | Remove de `roomUsers` e da sala Socket.io da voz; transmite `room-users` e `voice-rooms`. |

- `roomUsers` passa a conter **só** canais de voz.
- `update-state` (mudo/status/sharing) usa `socket.data.voiceRoom`. Status (online/ocupado/invisível) continua valendo sem voz: guardado em `socket.data` como hoje.
- `save-message`, `get-messages`, `delete-my-messages` aceitam só o canal de texto atual do socket (`room === socket.data.textRoom`). Isso também fecha a brecha de gravar em qualquer sala.
- Desconexão e logout limpam texto e voz.

### Cliente (`renderer.js`)

- `currentRoom` é substituído por `currentTextRoom` (string, nunca vazia após o login) e `currentVoiceRoom` (string ou `''`).
- `joinText(room)`: chat, título do topo, placeholder, histórico, canal ativo na lista. Não toca em mídia.
- `joinVoice(room)`: `ensureLocalMedia()`, peers, tiles, anel de fala, "Conectado a …". Se já estiver em outra voz, sai dela antes (fecha peers) sem derrubar o texto.
- `leaveVoice()`: o que hoje é `leaveCall` menos a parte de texto. Para câmera e compartilhamento de tela, fecha peers, esconde "Conectado", volta `sharingScreen = false` e o botão Tela ao estado inicial.
- Login bem-sucedido: `joinText('geral')` e `joinVoice('voz-sala')` com microfone ligado. A tela intermediária de "entrar em sala" (`#room-screen`, `btnJoin`, `inputRoom`) é removida.
- Clique num canal de texto → `joinText`; num canal de voz → `joinVoice`; em "Desconectar" e no ✕ da barra de topo → `leaveVoice`.
- Botões **Cam** e **Tela** desabilitados (`disabled` + visual apagado, com `title` "Entre em um canal de voz") quando `currentVoiceRoom === ''`. O botão de microfone continua habilitado (mudo é um estado pessoal).
- Área de chamada (tiles, indicador "Ninguém falando") sem voz: mostra estado vazio "Você não está em um canal de voz".
- Lista de canais: o canal de texto atual e o de voz atual ficam marcados ao mesmo tempo.

### Compatibilidade com o PR #1 (compartilhamento de tela)

O PR #1 reescreve `createPeer`, sinalização, `btnScreen` e `renderTiles`. Esta mudança mexe nas funções que **chamam** isso (entrar/sair de voz). Manter a criação de peers e a sinalização intactas; renomear `currentRoom` → `currentVoiceRoom` nos pontos de mídia é conflito textual esperado.

## Decisões tomadas por mim (Claude), não pelo usuário

- **Base:** branch a partir de `feat/temas-avatares` (PR #2), porque usa a lista do canal de voz, `voice-rooms` e o layout novo do "Conectado". O PR desta mudança aponta para `feat/temas-avatares` até o PR #2 entrar.
- **Painel "Participantes":** mostra quem está na sua chamada de voz (como hoje mostra os da sala). Sem voz: "Você não está em um canal de voz".
- **Botão ✕ da barra de topo** passa a significar "sair da voz" (mesmo efeito de "Desconectar").
- **Canais de voz não têm chat.** O título do topo e o chat sempre mostram o canal de texto.
- **Validação no servidor** dos ids de canais (lista fixa), já que deixam de existir salas por nome digitado.

- **Entrada automática** acontece sempre que o login conclui (inclusive logo após cadastrar, se o fluxo atual já loga em seguida).
- **Microfone entre sessões de voz:** o estado mudo/aberto da pessoa é preservado ao trocar ou sair/voltar da voz; só o login força microfone aberto.
- **✕ da barra de topo sem voz:** fica desabilitado, como Cam e Tela.
- **Status (online/ocupado/invisível) sem voz:** continua guardado em `socket.data` e é aplicado na entrada de voz seguinte.

## Deixado para o builder

- Nomes internos de funções auxiliares e organização do código.
- Texto exato e visual do estado vazio da área de chamada.
- Como reconectar à voz após queda do socket (hoje o app não reconecta; manter o comportamento atual é aceitável).
