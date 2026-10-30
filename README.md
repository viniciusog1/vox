# Vox

App desktop para Windows 11 de chat, voz, vídeo e compartilhamento de tela, feito com Electron, WebRTC e Socket.io.

## Recursos

- Login e cadastro com senha (hash PBKDF2)
- Chat de texto com histórico por canal (`#geral`, `#jogos`, `#musica`)
- Canais de voz (Sala Principal, jogos e música) independentes do chat: você fica sempre em um canal de texto e, ao mesmo tempo, em no máximo um canal de voz. Trocar de canal de texto não derruba a chamada
- Ao entrar, você cai automaticamente em `#geral` e na Sala Principal, com o microfone aberto
- Chamada de voz e vídeo P2P (WebRTC); câmera e compartilhamento de tela só com a voz conectada
- Compartilhamento de tela com seletor de janela/tela
- Qualidade do compartilhamento: 480p, 720p ou 1080p e 30 ou 60 FPS (padrão 1080p 30 FPS)
- Visualização do compartilhamento em tela cheia (botão de tela cheia no bloco ou duplo clique)
- Redução de ruído do microfone (gate + filtro + compressor), com níveis de intensidade
- Coluna **Membros** com todas as contas do servidor, separadas em Online e Offline, com bolinha de status sobre o avatar e, para quem está na sua chamada, o estado da conexão e o ping ("Conectando…", "Conectado · 32 ms", "Reconectando…", "Falhou")
- Canal de voz mostrando quem está conectado, com avatar, bolinha de status, anel de quem está falando, ícone de microfone desligado e selo "AO VIVO" para quem compartilha a tela
- Painel compacto da voz conectada (nome do canal + botão de desligar) logo acima do seu perfil
- A grade da chamada ajusta o tamanho dos blocos ao espaço disponível, inclusive em monitores grandes
- Música do YouTube na chamada: cole um link do YouTube no painel de música (botão do YouTube na barra superior) e ele entra na fila do canal de voz. Todos na chamada ouvem a mesma música, sincronizada, e qualquer pessoa da chamada pode pausar, pular ou remover músicas da fila. A fila aparece como o primeiro bloco da grade de participantes; clique nele ou no botão do YouTube da barra superior para abrir o painel, onde também ficam o volume (só no seu computador) e a capa e o título de cada música
- O vídeo do YouTube aparece no próprio Vox; nada é baixado. Cada pessoa usa o player oficial do YouTube. Ao sair da voz, a música para para você. Em tela cheia, o player vai para um canto da própria visualização, e o vídeo da música também pode ser aberto sozinho em tela cheia. O canal de voz com música mostra o ícone do YouTube ao lado do nome
- 18 temas (Configurações → aba Aparência), salvos no próprio computador e organizados em quatro grupos — Escuros: Escuro, Grafite, Drácula, Nord, Aquático, Natureza, Pôr do sol; Neon: Cyberpunk, Neon Verde, Neon Vermelho, Neon Azul; Anime: Bizarro, Mangá, Ninja; Claros: Claro, Sépia, Lavanda / Sakura, Algodão-doce
- Os temas Anime têm efeitos além das cores (fundos com degradês e padrões, animações e efeitos em quem está falando), sempre atrás dos vídeos. A opção "Reduzir animações dos temas" desliga as animações; a preferência do sistema por menos movimento também é respeitada
- Configurações em abas: Áudio, Conta (nome da conta e botão Sair da conta) e Aparência
- Ícones SVG próprios, iguais em qualquer sistema (sem depender de emojis)
- Layout com rail de servidores, canais, chat e membros; a janela usa os botões nativos do sistema
- Status Online, Ausente, Ocupado e Invisível. Ausente pode ser escolhido no menu e também é automático após 5 minutos sem atividade (a partir de Online)
- Configuração do microfone e do dispositivo de saída de áudio
- Opção de ouvir o próprio microfone para testar (use fones)
- Histórico mantido por 7 dias e apagado automaticamente depois
- Botão para apagar as próprias mensagens do canal atual (Configurações → aba Áudio, no fim)

Os temas Drácula e Nord usam as paletas dos projetos [Dracula](https://draculatheme.com) e [Nord](https://www.nordtheme.com), ambos com licença MIT. Os ícones são do [Lucide](https://lucide.dev) (licença ISC). Os temas Anime são apenas inspirados em estilos de anime: não usam imagens, logos nem nomes oficiais das obras.

## Pré-requisitos

Para usar o instalador, não é necessário instalar nada além do próprio Vox. Para desenvolver ou gerar o instalador, instale o [Node.js](https://nodejs.org/) (versão LTS).

## Rodar

Clone o repositório e rode na pasta do projeto (PowerShell no Windows ou terminal no macOS):

```powershell
git clone https://github.com/viniciusog1/vox
cd vox
npm install
npm start
```

Testes: `npm test`.

A primeira tela é o login. Crie uma conta ou entre com uma existente.

## Gerar instalador .exe

```powershell
npm run dist
```

O instalador fica em `dist/Vox Setup <versão>.exe` (a versão vem de `package.json`, hoje `1.1.0`).

- O instalador é **sem assinatura digital** (para não exigir certificado pago). O Windows pode mostrar o aviso do SmartScreen: clique em **Mais informações → Executar assim mesmo**.
- O app instalado grava usuários e mensagens em `%APPDATA%\Vox`.
- O app se chamava **Concord**. Na primeira vez que o Vox abre, ele copia os dados da pasta antiga (`%APPDATA%\Concord`: contas, mensagens, tema e preferências) para a nova. A pasta antiga não é apagada.
- A versão de desenvolvimento (`npm start`) continua usando os arquivos da pasta do projeto.
- O instalador usa o ícone padrão do Electron. Para trocar, adicione um `icon.ico` e ajuste a configuração em `package.json`.

## Testar com um amigo

O servidor já escuta na rede local (`0.0.0.0:3000`). Não é mais preciso editar o código.

### Mesma rede (Wi-Fi/cabo)

1. **Você (host)**: abra o Vox, deixe o servidor em `http://127.0.0.1:3000` e entre/crie sua conta.
2. Descubra seu IPv4 com `ipconfig` (ex.: `192.168.1.15`).
3. **Seu amigo**: instale o Vox, abra e, no campo **Servidor** da tela de login, digite `http://192.168.1.15:3000` e clique em **Aplicar**.
4. Seu amigo cria a conta dele (a conta fica no seu servidor) e, ao entrar, cai em `#geral` e na Sala Principal, como você.
5. Se o Windows perguntar, permita o Vox em **Redes privadas**. Se a rede estiver marcada como **Pública** ou a conexão não funcionar, libere a porta 3000 no PowerShell como administrador:
   ```powershell
   New-NetFirewallRule -DisplayName "Vox 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public
   ```
   Use o perfil `Public` apenas durante o teste e em uma rede confiável.

### Casas diferentes (internet)

1. No seu PC, com o Vox aberto, crie um túnel gratuito para `http://localhost:3000`:
   - mais fácil: execute `IniciarTunelVox.bat` na pasta do projeto e mantenha a janela aberta;
   - ou Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3000`;
   - ou ngrok: `ngrok http 3000`.
2. Copie a URL pública gerada (ex.: `https://algo.trycloudflare.com`).
3. Seu amigo cola essa URL no campo **Servidor** e clica em **Aplicar**.
4. Você continua usando `http://127.0.0.1:3000`.

O Cloudflare Tunnel já está baixado em `tools/cloudflared.exe`. A URL do túnel gratuito muda quando ele é reiniciado; se isso acontecer, envie a nova URL para seu amigo.

> Chamadas de voz/vídeo entre redes diferentes podem precisar de um servidor TURN (ex.: Coturn). Sem TURN, algumas conexões podem falhar (a coluna Membros mostra "Falhou" para essa pessoa). Na mesma rede, não é necessário.

## Observações

- Desenvolvimento: `users.json` e `messages.json` ficam na pasta do projeto.
- Instalado: ficam em `%APPDATA%\Vox`.
- O campo **Servidor** fica na tela de login e é salvo no computador.
- Versão: o app e o servidor precisam ser da mesma versão. Se forem diferentes, o login mostra um aviso para atualizar o Vox, e o amigo precisa instalar a versão nova.
- Na mesma rede, a conexão usa HTTP (sem TLS). Use em uma rede confiável; para internet, prefira o túnel HTTPS.
- O compartilhamento de tela usa o seletor nativo do Electron (janela ou tela inteira).
- A qualidade real do vídeo depende da internet de quem envia e de quem recebe.
