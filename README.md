<div align="center">

<img src="assets/icon.png" alt="Ícone do Vox" width="112">

# Vox

**Chat, voz, vídeo e tela compartilhada para jogar e conversar com os amigos — rodando no seu próprio PC.**

![Versão](https://img.shields.io/badge/vers%C3%A3o-1.5.0-7c4dff)
![Windows 11](https://img.shields.io/badge/Windows-11-0078D4?logo=windows11&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2022.12-339933?logo=nodedotjs&logoColor=white)
![Testes](https://img.shields.io/badge/testes-143%20passando-3ba55d)
![Sem nuvem](https://img.shields.io/badge/servidor-no%20seu%20PC-ff6bcb)

[✨ Recursos](#-recursos) · [📥 Instalar](#-instalar) · [🤝 Jogar com amigos](#-jogar-com-amigos) · [⚙️ Configurações](#️-configurações) · [🛠️ Desenvolvimento](#️-desenvolvimento) · [❓ Problemas comuns](#-problemas-comuns)

</div>

---

## 💡 Como funciona

| | |
| --- | --- |
| 🖥️ **Sem nuvem** | O PC de quem hospeda é o servidor. Contas, mensagens e servidores ficam nele. |
| 🔗 **Conexão direta** | Voz, vídeo e tela vão de um PC para o outro (WebRTC), sem passar por servidor. |
| 🌍 **Pela internet** | Um clique abre um túnel gratuito da Cloudflare para os amigos entrarem. |
| 💸 **Grátis** | Nenhum serviço pago, nenhuma assinatura. |

---

## ✨ Recursos

### 🏠 Servidores e canais
- ➕ Crie quantos servidores quiser — você vira o dono
- 🎟️ Convide com um código (`VOX-XXXXXXXX`)
- 🏡 **Casa dos Amigos**: o servidor de todo mundo — toda conta nova já entra nele
- `#` Canais de texto e 🔊 canais de voz: criar, renomear e apagar
- 👑 **Dono** pode tudo · 🛡️ **Administrador** cuida de canais, convites e expulsões
- 🔁 Passar a posse, promover, expulsar, sair e apagar o servidor

### 👥 Amigos e mensagens diretas
- 🙋 Pedidos de amizade: enviar, aceitar, recusar e cancelar
- ✉️ Mensagens diretas com tudo que o chat tem
- 📞 **Ligar** para um amigo: voz, câmera e tela, com aviso tocando para atender ou recusar
- 🔒 Mensagem e chamada só entre amigos

### 💬 Chat
- ✏️ Editar e 🗑️ apagar as próprias mensagens
- 🖼️ Imagens: botão, **Ctrl+V** ou arrastar (reduzidas sozinhas, até 2 MB)
- 📣 Menções com `@nome`, com sugestões ao digitar
- 🔴 Contador de não lidas por canal, por servidor e no título da janela
- 🧹 Mensagens apagadas depois de 7 dias (máx. 200 por canal)

### 🎙️ Voz, vídeo e tela
- 🎧 Canais de voz independentes do chat — trocar de canal de texto não derruba a chamada
- 📷 Câmera e 🖥️ tela compartilhada (480p a 1080p, 30 ou 60 fps)
- 🔈 Áudio do PC na transmissão — **sem** o som do próprio Vox (nada de eco)
- 🔇 Redução de ruído (Desligada, Padrão ou Forte)
- 🎚️ Volume e **sensibilidade do microfone**, com medidor ao vivo e ajuste automático
- 🟢 Anel em quem está falando, ping de cada pessoa e selo **AO VIVO**
- 🔔 Sons ao entrar, sair, mutar e desmutar

### 🎵 Música do YouTube
- 🔗 Cole um link e todos na chamada ouvem juntos, sincronizado
- ⏯️ Qualquer um pausa, pula ou tira da fila (até 50 músicas)
- 🔊 Volume da música só no seu PC
- ▶️ Player oficial do YouTube: nada é baixado

### 🔊 Soundboard
- 🎺 8 sons de fábrica: buzina, ba dum tss, tchan tchan, aplausos, vitória 8-bit e mais
- 📤 Qualquer membro envia sons para o servidor (MP3, OGG, WAV ou WebM, até 8 s)
- 👂 Todos na voz ouvem — mesmo com o microfone mutado
- 🎚️ Volume do soundboard só no seu PC, ou desligue se preferir

### 🎨 Aparência e perfil
- 🌈 **18 temas** em 4 grupos: Escuros, Neon, Anime e Claros
- ✨ Temas Anime com efeitos animados (dá para reduzir as animações)
- 🧑‍🎤 Foto de perfil, visível para todos
- 🟢 Status: Online, Ausente (automático após 5 min), Ocupado e Invisível

### 🔌 Conexão
- 🔄 **Reconecta sozinho** se a conexão cair — volta para o mesmo canal e a mesma voz
- ⬆️ **Atualização automática** pelas releases do GitHub
- 🌍 Botão **Abrir para amigos**: túnel da Cloudflare com o endereço para copiar
- 🔔 Notificações do Windows (todas, só menções ou nunca)
- 🕐 Fica **ao lado do relógio** do Windows: fechar a janela não derruba a voz nem o servidor (dá para desligar em Configurações → Conta)

---

## 📥 Instalar

1. ⬇️ Baixe o `Vox-Setup-<versão>.exe` na página de [Releases](https://github.com/viniciusog1/vox/releases).
2. 🛡️ O Windows pode mostrar o aviso do **SmartScreen** (o instalador não tem assinatura paga): clique em **Mais informações → Executar assim mesmo**.
3. 🚀 Abra o Vox, crie sua conta e pronto.

> [!TIP]
> Depois de instalado, o Vox se atualiza sozinho. Quando sair uma versão nova, aparece um aviso no topo para reiniciar.

> [!NOTE]
> Quem está na **1.3.0 ou anterior** precisa instalar a versão nova à mão uma vez — essas versões ainda não tinham o atualizador.

---

## 🤝 Jogar com amigos

Uma pessoa **hospeda** (deixa o Vox aberto no PC dela). Os outros se conectam a ela.

### 🏠 Mesma rede (Wi-Fi ou cabo)

1. 🖥️ **Host:** abra o Vox e entre normalmente.
2. 🔍 Descubra o IP do PC com `ipconfig` (ex.: `192.168.1.15`).
3. 🧑‍🤝‍🧑 **Amigo:** na tela de login, campo **Servidor**, digite `http://192.168.1.15:3000` e clique em **Aplicar**.
4. ✅ O amigo cria a conta e já cai na **Casa dos Amigos**.

<details>
<summary>🧱 A conexão não funciona? Libere a porta 3000 no firewall</summary>

Se o Windows perguntar, permita o Vox em **Redes privadas**. Se a rede estiver como **Pública**, rode no PowerShell como administrador:

```powershell
New-NetFirewallRule -DisplayName "Vox 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public
```

Use o perfil `Public` só durante o teste e numa rede confiável.

</details>

### 🌍 Casas diferentes (internet)

1. ⚙️ **Host:** Configurações → aba **Servidor** → **Abrir para amigos**.
2. 📋 Clique em **Copiar** e mande o endereço (`https://algo.trycloudflare.com`).
3. 🧑‍🤝‍🧑 **Amigo:** cola o endereço no campo **Servidor** e clica em **Aplicar**.

> [!NOTE]
> - ⏳ Um endereço novo leva cerca de **1 minuto** para começar a funcionar.
> - 🔁 O endereço muda toda vez que o túnel abre — mande o novo para os amigos.
> - 📦 Na primeira vez, o Vox baixa o `cloudflared` oficial (~60 MB).
> - 🖥️ O host continua usando `http://127.0.0.1:3000`.

### 🎟️ Convidar para outros servidores

1. 👑 Dono ou admin: clique no **nome do servidor** (topo da coluna de canais) → **Convidar pessoas**.
2. 📋 Mande o código `VOX-XXXXXXXX`.
3. ➕ O amigo clica em **+** na barra da esquerda e cola o código.

---

## ⚙️ Configurações

Engrenagem ao lado do seu nome, no canto inferior esquerdo.

| Aba | O que tem |
| --- | --- |
| 🎙️ **Áudio** | Microfone e saída, redução de ruído, volume e sensibilidade do microfone, ouvir o próprio microfone, sons |
| 👤 **Conta** | Foto de perfil, manter o Vox ao lado do relógio ao fechar e sair da conta |
| 🎨 **Aparência** | 18 temas e reduzir animações |
| 🔔 **Notificações** | Avisar de todas as mensagens, só de menções ou nunca |
| 🌍 **Servidor** | Abrir o túnel para os amigos e copiar o endereço |

🗑️ No rodapé: **Apagar minhas mensagens deste canal**.

---

## 🛠️ Desenvolvimento

### 📋 Requisitos
- 🟩 [Node.js](https://nodejs.org/) **22.12 ou mais novo** (o Electron 45 exige)
- 🪟 Windows 11 para gerar o instalador (desenvolver também funciona no macOS)

### ▶️ Rodar

```powershell
git clone https://github.com/viniciusog1/vox
cd vox
npm install
npm start
```

- 🧪 Testes: `npm test`
- ⬇️ Na primeira vez, o `npm start` baixa o Electron sozinho

### 📦 Gerar o instalador

```powershell
npm run dist
```

Sai em `dist/`: `Vox-Setup-<versão>.exe`, `.blockmap` e `latest.yml`.

### 🚀 Publicar uma versão

1. 🔢 Suba `version` em `package.json` e rode `npm run dist`.
2. 🏷️ Crie uma release no GitHub com a tag `v<versão>` (ex.: `v1.5.0`).
3. 📎 Anexe **os três arquivos** de `dist/`.
4. ✅ Publique (rascunho não vale) — os Vox instalados avisam para atualizar.

### 🎨 Trocar o ícone
- ✏️ Edite `assets/icon.svg` (e `assets/icon-small.svg`, usado até 24 px)
- ⚙️ Rode `npx electron scripts/gerar-icone.js` para gerar `build/icon.ico` e `assets/icon.png`

> [!IMPORTANT]
> Cliente e servidor precisam da **mesma versão do protocolo**. Quando mudar algum evento, todo mundo precisa atualizar — o login avisa quem estiver numa versão diferente.

---

## 📁 Onde ficam os dados

| | Desenvolvimento (`npm start`) | Instalado |
| --- | --- | --- |
| 📂 Pasta | pasta do projeto | `%APPDATA%\Vox` |

| Arquivo | Conteúdo |
| --- | --- |
| 👤 `users.json` | Contas (senha só como hash PBKDF2) e foto de perfil |
| 💬 `messages.json` | Mensagens dos canais e das conversas diretas |
| 🏠 `servers.json` | Servidores, canais, cargos e convites |
| 👥 `friends.json` | Amizades e pedidos |
| 🔑 `sessions.json` | Sessões para reconectar sem senha |
| 🖼️ `uploads/` · `avatars/` | Imagens do chat e fotos de perfil |
| 🔊 `soundboard.json` · `soundboard/` | Sons enviados ao soundboard de cada servidor |

- 🧹 Imagens somem junto com a mensagem (7 dias, limite de 200, ou quando o autor apaga)
- 🔐 Fechar o Vox pede login de novo na próxima abertura
- 📦 O app se chamava **Concord**: na primeira abertura, o Vox copia os dados de `%APPDATA%\Concord`

---

## ❓ Problemas comuns

<details>
<summary>⚠️ "Seu Vox está em uma versão diferente da do servidor"</summary>

O seu Vox e o do host estão em versões diferentes. Instale a versão mais nova das [Releases](https://github.com/viniciusog1/vox/releases) nos dois PCs.

</details>

<details>
<summary>🔌 O Vox não abre o servidor (porta 3000 em uso)</summary>

Só um Vox pode usar a porta 3000 por PC. Feche o outro (por exemplo, o de desenvolvimento) antes de abrir o instalado.

</details>

<details>
<summary>📵 O chat funciona, mas a voz do amigo não conecta ("Falhou")</summary>

Voz e vídeo vão direto entre os PCs. Algumas redes bloqueiam isso e precisariam de um servidor TURN, que o Vox ainda não tem. Na mesma rede, sempre funciona.

</details>

<details>
<summary>🎤 Minha voz corta ou o ruído vaza</summary>

Em Configurações → Áudio, olhe o medidor da **Sensibilidade do microfone**: a barra fica verde quando os outros te ouvem. Desmarque o automático e arraste para a esquerda (voz cortando) ou para a direita (ruído vazando).

</details>

<details>
<summary>🌍 O endereço do túnel não abre</summary>

Espere cerca de 1 minuto: o endereço novo leva esse tempo para funcionar. Se o túnel cair, o Vox abre outro com um endereço diferente — confira em Configurações → Servidor.

</details>

---

## 📜 Créditos

- 🎨 Ícones: [Lucide](https://lucide.dev) (licença ISC)
- 🧛 Temas Drácula e Nord: paletas de [Dracula](https://draculatheme.com) e [Nord](https://www.nordtheme.com) (licença MIT)
- 🍥 Temas Anime: só inspirados em estilos de anime — sem imagens, logos ou nomes oficiais
- ⚡ Feito com [Electron](https://www.electronjs.org), [Socket.io](https://socket.io) e WebRTC

<div align="center">

Feito para jogar com os amigos 💜

</div>
