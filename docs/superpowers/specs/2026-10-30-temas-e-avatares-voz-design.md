# Temas de cor e avatares no canal de voz — design

Data: 2026-10-30 · Projeto: Vox (código e produto ainda chamados "Concord")

## Intenção

Duas melhorias de UI/UX para deixar o app com cara de substituto moderno do Discord:

1. **Temas de cor escolhidos por cada usuário.** Hoje há um único visual escuro. A pessoa quer escolher o visual que combina com ela, sem mexer em layout.
2. **Avatar de cada usuário embaixo do canal de voz**, como no Discord. Hoje só aparece a bolinha de status e o nome, então não dá para ver quem está falando nem quem está transmitindo a tela.

## Objetivos

- 13 temas só de cor, trocados na hora, sem reiniciar.
- Lista de usuários em cada canal de voz com avatar, indicação de quem fala, ícone de mudo e selo "AO VIVO" para quem compartilha tela.
- Estrutura de temas preparada para, no futuro, temas com imagem e mudança de layout.

## Não-objetivos (agora)

- Temas com imagens, fontes próprias ou mudança de layout (planejado para depois).
- Upload de foto de perfil. O avatar continua sendo a bolinha com iniciais; o código deve deixar um ponto único onde a foto entrará depois.
- Sincronizar o tema com a conta.
- Editor de tema personalizado.

## Anti-objetivos (seria falha mesmo funcionando)

- Texto ilegível em algum tema (contraste ruim em chat, botões, nomes, placeholders).
- Partes da interface que ignoram o tema (cores fixas sobrando: modais, login, scrollbar, tiles de vídeo, popovers).
- Temas parecidos demais entre si. Por isso Oceânico, Floresta, Terracota e Synthwave **não** entram: repetem Aquático, Natureza, Pôr do sol e Cyberpunk.
- Anel de "falando" piscando a cada ruído.

## Decisões do usuário

- **Opção C** para os usuários no canal de voz: avatar com anel verde ao falar, 🔇 à direita, selo "AO VIVO" para quem compartilha tela, **sem** bolinha de status na lista do canal.
- **13 temas**, com as paletas aprovadas nos mockups, sem alterações:
  - Escuros: Escuro, Grafite, Cyberpunk, Neon Verde, Drácula, Nord, Aquático, Natureza, Pôr do sol.
  - Claros: Claro, Sépia, Lavanda/Sakura, Algodão-doce.
- **Só cores** agora; Cyberpunk e Neon Verde têm brilho neon leve (no destaque e no canal ativo); Aquático tem um brilho bem sutil no destaque. Nenhum outro tem brilho.
- Tema salvo **só no computador** (localStorage). Em outro PC volta ao padrão.
- **Tema padrão: Escuro** (o visual atual).

## Paletas

Tokens por tema. `glow`/`glowSoft` = sombra do destaque (Cyberpunk, Neon Verde e, de leve, Aquático).

| Tema | bg | bg2 | bg3 | rail | border | text | text2 | muted | accent | onAccent | link | speak | red | dangerBg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| escuro | #0d0f13 | #141821 | #1b202b | #0a0c10 | #2a3140 | #e9ecf1 | #c3cad6 | #8b95a7 | #5865f2 | #ffffff | #7b8cff | #3ba55d | #ed4245 | #d53b3e |
| grafite | #202124 | #28292d | #323338 | #1a1b1e | #3c3e44 | #e8e9ec | #c6c8cd | #9b9da4 | #8ab4f8 | #10223f | #a8c7fa | #81c995 | #f28b82 | #c5221f |
| cyberpunk | #0b0614 | #120a22 | #1d1233 | #07040d | #33205a | #f3eaff | #d6c8f0 | #9a86c4 | #ff2bd6 | #16001a | #22e6ff | #22e6ff | #ff3b5c | #da324f |
| neon-verde | #050a06 | #08120a | #0e1d11 | #030604 | #163d1d | #e6ffe9 | #b9e8c0 | #6fa67a | #39ff14 | #031a00 | #7dffc4 | #39ff14 | #ff4d5e | #d13f4d |
| dracula | #282a36 | #21222c | #343746 | #191a21 | #44475a | #f8f8f2 | #e2e2dc | #99a1c5 | #bd93f9 | #1d1530 | #8be9fd | #50fa7b | #ff5858 | #cd4444 |
| nord | #2e3440 | #3b4252 | #434c5e | #272c36 | #4c566a | #eceff4 | #d8dee9 | #b7becb | #88c0d0 | #1b2530 | #99b3cd | #a3be8c | #d9a1a7 | #b25a63 |
| aquatico | #04141f | #071e2d | #0c2b3f | #031019 | #15405a | #e4f6ff | #bfe1ef | #7fa9bd | #1fd1c1 | #002624 | #5cc8ff | #5cc8ff | #ff5a6a | #c94754 |
| natureza | #0c140e | #121d15 | #1a2a1e | #08100a | #2a3d2e | #eef3e6 | #cfd9c4 | #93a68a | #e2a33c | #231500 | #9ad16b | #9ad16b | #e0573f | #c74d38 |
| por-do-sol | #160d14 | #1f121c | #2b1a27 | #10090e | #43293d | #fff0ea | #f0d3c9 | #b48f99 | #ff7a59 | #2a0b00 | #ffb86b | #ffc857 | #ff4d6d | #d03f59 |
| claro | #ffffff | #f3f4f7 | #e6e8ee | #e3e5eb | #d7dae2 | #1d2129 | #3a404c | #616774 | #4f5bd5 | #ffffff | #3b47c4 | #23934a | #d3292c | #d7393c |
| sepia | #f6efdf | #ede3cb | #e2d5b7 | #e0d2b0 | #d3c39f | #3b2f22 | #544433 | #695945 | #8f4e22 | #fff7ec | #7a4a1f | #5f8a3a | #af3f2c | #b3402d |
| lavanda | #fcf8fd | #f3ebf7 | #e9dcf0 | #eadcf2 | #dccbe6 | #2e2236 | #4a3b54 | #6e5c78 | #8e56b5 | #ffffff | #b73c73 | #d9578f | #c3324d | #cc3a55 |
| algodao-doce | #fefafc | #edf3fd | #fbe4ef | #fbdcea | #dfe5f3 | #28263d | #45425c | #6a657f | #3a70dc | #ffffff | #c82d76 | #e0609a | #cd2d4c | #d23c59 |

**Contraste (aprovado pelo usuário):** as paletas acima já estão ajustadas para texto normal ≥ 4.5:1 (WCAG AA) — cores mudadas o mínimo necessário (`muted`, `link`, `red` e o `accent` do Algodão-doce em alguns temas). Regras de uso dos tokens:
- `muted` é legível sobre `bg`, `bg2` e `bg3`; `link` e `red` sobre `bg` e `bg2`.
- `red` = texto/ícone de erro ou mudo. **`dangerBg`** = fundo de botão de perigo e do selo "AO VIVO", sempre com texto branco (≥ 4.5:1).
- `accent` é cor de fundo (botões, canal ativo) com texto `onAccent`; **não** usar `accent` como cor de texto corrido — para texto destacado use `link`.
- Comparação antes/depois em `.superpowers/brainstorm/*/content/contrast.html`.

`accentSoft` = `accent` com ~15% de opacidade (fundo do canal ativo). Glow:
- cyberpunk: `glow: 0 0 10px rgba(255,43,214,.65)`, `glowSoft: inset 2px 0 0 #ff2bd6, 0 0 8px rgba(255,43,214,.25)`
- neon-verde: `glow: 0 0 10px rgba(57,255,20,.6)`, `glowSoft: inset 2px 0 0 #39ff14, 0 0 8px rgba(57,255,20,.25)`
- aquatico: `glow: 0 0 8px rgba(31,209,193,.35)`
- demais: `none`

Drácula e Nord usam as paletas públicas desses projetos (licença MIT); creditar no README.

Mockups de referência (locais, fora do git): `.superpowers/brainstorm/*/content/themes.html`, `themes-v2.html`, `neon-verde.html`, `voice-users.html`.

## Como funciona

### Temas

- Cada tema é um objeto `{ id, name, kind: 'dark' | 'light', tokens }`. Aplicar = escrever os tokens como variáveis CSS em `:root` (ou trocar `data-theme` no `<html>` com um bloco CSS por tema — escolha do builder).
- **Todas** as cores fixas de `index.html` (hoje ~48 literais, ex.: `#0a0c10` no rail, `#0f131a` no painel do usuário, `rgba(88,101,242,.18)` no canal ativo, scrollbar, modais, popovers, login) passam a usar tokens. Cores semânticas que não mudam por tema (ex.: verde/vermelho de status, cores das bolinhas de avatar) podem continuar fixas, desde que legíveis nos claros.
- As cores das bolinhas de avatar (`AVATAR_COLORS`) **não** mudam por tema, para cada pessoa continuar reconhecível.
- Persistência: `localStorage['concord-theme']`; id inválido/ausente → `escuro`.
- Aplicar o tema **antes** da primeira pintura (inclusive na tela de login), para não piscar o Escuro ao abrir com outro tema.
- Estrutura pensada para crescer: o objeto do tema pode ganhar campos opcionais no futuro (imagem de fundo, ajustes de layout) sem mudar a forma de escolher/salvar.

### Seletor de tema

- Seção **"Aparência"** no modal de configurações (hoje "Configurações de áudio"), com grade de miniaturas no estilo dos mockups (rail, canais, chat em miniatura) e o nome do tema; escuros e claros agrupados.
- Clique aplica na hora e salva; tema atual marcado. Sem botão "salvar".

### Usuários no canal de voz (opção C)

Substitui a linha atual (bolinha de status + nome) em `renderMembers`:

- Avatar de iniciais ~24px (mesma cor/iniciais de `makeAvatar`), nome ao lado; você primeiro, demais em ordem alfabética (como hoje).
- **Anel ao falar**: anel na cor `speak` do tema em volta do avatar enquanto a pessoa fala.
  - Só para quem está no **seu** canal atual (nos outros canais não há áudio recebido).
  - Remotos: usar os `analysers` já existentes (por socket id).
  - Você: adicionar análise do próprio microfone (hoje o app só analisa remotos). Mudo → sem anel.
  - Precisa de suavização/limiar para não piscar com ruído (ex.: ligar acima de um limiar, desligar só após ~250 ms abaixo).
- **🔇** alinhado à direita quando mutado.
- **"AO VIVO"**: selo vermelho para quem está compartilhando tela, visível em **todos** os canais. Requer servidor: incluir `sharing` no estado do usuário (`update-state` em `main.js` aceita e repassa `sharing: boolean`; o cliente envia ao iniciar/parar o compartilhamento e ao entrar no canal).
- Bolinha de status **não** aparece nessa lista (continua no painel de membros e no painel do próprio usuário).
- Ponto único de renderização do avatar (ex.: `makeAvatar`), para a foto de perfil entrar depois sem mexer na lista.

## Restrições

- Electron 28, JS puro, sem framework nem bundler; CSS em `index.html`. Manter o estilo do código existente.
- Interface em português.
- Não usar serviços pagos (AGENTS.md).
- A branch `feat/screen-share-smooth` (PR #1) também altera `renderer.js` (tiles de vídeo/WebRTC). Esta feature mexe sobretudo em `index.html` (CSS) e `renderMembers`; evitar tocar no código de WebRTC para reduzir conflito.

## Decisões tomadas por mim (Claude), não pelo usuário

- **Brilho do Aquático:** fica o brilho sutil no destaque, como estava nos mockups aprovados. É um token geral (`glow`/`glowSoft`) que qualquer tema pode usar; hoje só Cyberpunk, Neon Verde e Aquático usam.
- **Branch base:** construir a partir de `main`. O aviso de compartilhamento ao servidor fica num helper único (ex.: `setSharingState(bool)`) chamado em uma linha no início e no fim do compartilhamento, para facilitar o rebase sobre o PR #1 (`feat/screen-share-smooth`), que reescreve esse trecho. O "AO VIVO" pode ser testado nesta branch sem o PR #1.

## Deixado para o builder

- Mecanismo exato de aplicar tokens (variáveis em `:root` via JS vs. blocos `[data-theme]` no CSS).
- Nomes finais dos tokens CSS e como mapear os literais atuais.
- Layout fino da grade de miniaturas e do modal.
- Limiar/suavização do anel de fala.
