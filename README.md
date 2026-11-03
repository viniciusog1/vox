# Vox

App desktop para Windows 11 de chat, voz, vídeo e compartilhamento de tela, feito com Electron, WebRTC e Socket.io.

## Recursos

- Login e cadastro com senha (hash PBKDF2)
- Servidores: crie o seu (você vira o dono) e convide pessoas com um código (`VOX-XXXXXXXX`, gerado no menu do servidor → Convidar pessoas). Cada servidor tem seus canais de texto e de voz, que dono e administradores criam, renomeiam e apagam. Cargos: dono (pode tudo, inclusive apagar o servidor, promover administradores e passar a posse) e administrador (canais, convites e expulsar membros comuns). Quem sai ou é expulso perde o acesso aos canais
- Amigos: envie e aceite pedidos pelo Início (abas Online, Todos, Pendentes e Adicionar), converse por mensagens diretas e ligue para um amigo (a outra pessoa recebe um aviso de chamada para atender ou recusar; se um lado desliga, a chamada acaba para os dois). Escrever e ligar exigem amizade
- Chat de texto com histórico por canal e por conversa direta
- Editar e apagar as próprias mensagens (passe o mouse sobre a mensagem); mensagem editada mostra "(editada)"
- Imagens no chat: botão de imagem, colar com Ctrl+V ou arrastar para o chat. O Vox reduz a imagem (até 1920 px, máximo 2 MB) antes de enviar; GIF vai como está
- Menções com `@nome` (com sugestões ao digitar), destacadas na mensagem
- Contador de não lidas em cada canal de texto (`@` vermelho quando mencionaram você) e no título da janela
- Notificações do Windows para mensagens novas, com som nas menções. Configurações → aba Notificações: todas, só menções ou nunca. No status Ocupado nada avisa
- Reconexão automática: se a conexão com o servidor cair, o Vox avisa no topo, volta sozinho para o mesmo canal de texto e para a mesma voz, sem pedir a senha de novo
- Atualização automática pelas releases do GitHub (no app instalado): baixa sozinho e avisa no topo para reiniciar
- Botão "Abrir para amigos" (Configurações → aba Servidor): abre um túnel gratuito da Cloudflare e mostra o endereço para copiar
- Canais de voz independentes do chat: você fica sempre em um canal de texto e, ao mesmo tempo, em no máximo um canal de voz. Trocar de canal de texto não derruba a chamada
- Ao entrar, o Vox abre o último servidor que você usou e conecta no primeiro canal de voz dele, com o microfone aberto. Sem servidores, abre o Início
- Chamada de voz e vídeo P2P (WebRTC); câmera e compartilhamento de tela só com a voz conectada
- Compartilhamento de tela com seletor de janela/tela
- Qualidade do compartilhamento: 480p, 720p ou 1080p e 30 ou 60 FPS (padrão 1080p 30 FPS)
- Áudio do PC no compartilhamento (Windows, opcional): vai o som do computador, sem o que o próprio Vox toca (vozes da chamada, música e efeitos sonoros)
- Visualização do compartilhamento em tela cheia (botão de tela cheia no bloco ou duplo clique)
- Redução de ruído do microfone (Desligada, Padrão ou Forte), volume do microfone (0–200%) e sensibilidade do microfone com medidor ao vivo: automática (acompanha o ruído do ambiente) ou manual. Configurações → aba Áudio
- Efeitos sonoros curtos quando alguém entra ou sai da sua voz (inclusive você) e quando você muta ou desmuta o microfone, gerados no próprio app e tocados no dispositivo de saída escolhido. Podem ser desligados em Configurações → aba Áudio
- Coluna **Membros** com todas as contas do servidor, separadas em Online e Offline, com bolinha de status sobre o avatar e, para quem está na sua chamada, o estado da conexão e o ping ("Conectando…", "Conectado · 32 ms", "Reconectando…", "Falhou")
- Canal de voz mostrando quem está conectado, com avatar, bolinha de status, anel de quem está falando, ícone de microfone desligado e selo "AO VIVO" para quem compartilha a tela
- Painel compacto da voz conectada (nome do canal + botão de desligar) logo acima do seu perfil
- A grade da chamada ajusta o tamanho dos blocos ao espaço disponível, inclusive em monitores grandes
- Música do YouTube na chamada: cole um link do YouTube no painel de música (botão do YouTube na barra superior) e ele entra na fila do canal de voz. Todos na chamada ouvem a mesma música, sincronizada, e qualquer pessoa da chamada pode pausar, pular ou remover músicas da fila. A fila aparece como o primeiro bloco da grade de participantes; clique nele ou no botão do YouTube da barra superior para abrir o painel, onde também ficam o volume (só no seu computador) e a capa e o título de cada música
- O vídeo do YouTube aparece no próprio Vox; nada é baixado. Cada pessoa usa o player oficial do YouTube. Ao sair da voz, a música para para você. Em tela cheia, o player vai para um canto da própria visualização, e o vídeo da música também pode ser aberto sozinho em tela cheia. O canal de voz com música mostra o ícone do YouTube ao lado do nome
- 18 temas (Configurações → aba Aparência), salvos no próprio computador e organizados em quatro grupos — Escuros: Escuro, Grafite, Drácula, Nord, Aquático, Natureza, Pôr do sol; Neon: Cyberpunk, Neon Verde, Neon Vermelho, Neon Azul; Anime: Bizarro, Mangá, Ninja; Claros: Claro, Sépia, Lavanda / Sakura, Algodão-doce
- Os temas Anime têm efeitos além das cores (fundos com degradês e padrões, animações e efeitos em quem está falando), sempre atrás dos vídeos. A opção "Reduzir animações dos temas" desliga as animações; a preferência do sistema por menos movimento também é respeitada
- Foto de perfil: Configurações → aba Conta → Trocar foto (o Vox recorta o centro e reduz para 256 px). Aparece para todos no chat, na lista de membros, na voz e na chamada
- Configurações em abas: Áudio, Conta (nome da conta e botão Sair da conta), Aparência, Notificações e Servidor
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

O instalador fica em `dist/Vox-Setup-<versão>.exe` (a versão vem de `package.json`, hoje `1.5.0`).

### Publicar uma versão (atualização automática)

O Vox instalado procura versões novas na release mais recente de https://github.com/viniciusog1/vox/releases. Para publicar:

1. Suba `version` em `package.json` e rode `npm run dist`.
2. No GitHub, crie uma release com a tag `v<versão>` (ex.: `v1.4.0`) e anexe **os três arquivos** de `dist/`: `Vox-Setup-<versão>.exe`, `Vox-Setup-<versão>.exe.blockmap` e `latest.yml`.
3. Publique a release (rascunho não vale). Quem estiver com o Vox aberto recebe o aviso para reiniciar; quem abrir depois, também.

Versões até a 1.3.0 não têm atualização automática: quem estiver nelas precisa instalar a 1.4.0 uma vez à mão.

- O instalador é **sem assinatura digital** (para não exigir certificado pago). O Windows pode mostrar o aviso do SmartScreen: clique em **Mais informações → Executar assim mesmo**.
- O app instalado grava usuários e mensagens em `%APPDATA%\Vox`.
- O app se chamava **Concord**. Na primeira vez que o Vox abre, ele copia os dados da pasta antiga (`%APPDATA%\Concord`: contas, mensagens, tema e preferências) para a nova. A pasta antiga não é apagada.
- A versão de desenvolvimento (`npm start`) continua usando os arquivos da pasta do projeto.
- Ícone: o desenho fica em `assets/icon.svg` (e `assets/icon-small.svg` para 16–24 px). Depois de mudar, rode `npx electron scripts/gerar-icone.js` para gerar `build/icon.ico` e `assets/icon.png`.

## Testar com um amigo

O servidor já escuta na rede local (`0.0.0.0:3000`). Não é mais preciso editar o código.

### Mesma rede (Wi-Fi/cabo)

1. **Você (host)**: abra o Vox, deixe o servidor em `http://127.0.0.1:3000` e entre/crie sua conta.
2. Descubra seu IPv4 com `ipconfig` (ex.: `192.168.1.15`).
3. **Seu amigo**: instale o Vox, abra e, no campo **Servidor** da tela de login, digite `http://192.168.1.15:3000` e clique em **Aplicar**.
4. Seu amigo cria a conta dele (a conta fica no seu servidor) e já entra na **Casa dos Amigos**, o servidor de todo mundo. Para outros servidores ele precisa de um **código de convite**: quem é dono ou administrador gera em menu do servidor → **Convidar pessoas** e manda para ele; ele clica em `+` na barra da esquerda e cola o código.
5. Se o Windows perguntar, permita o Vox em **Redes privadas**. Se a rede estiver marcada como **Pública** ou a conexão não funcionar, libere a porta 3000 no PowerShell como administrador:
   ```powershell
   New-NetFirewallRule -DisplayName "Vox 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public
   ```
   Use o perfil `Public` apenas durante o teste e em uma rede confiável.

### Casas diferentes (internet)

1. No seu PC, com o Vox aberto, vá em **Configurações → aba Servidor** e clique em **Abrir para amigos**. Na primeira vez o Vox baixa o `cloudflared` (programa oficial da Cloudflare, cerca de 60 MB) para `%APPDATA%\Vox\tools`.
2. Clique em **Copiar** e mande o endereço (ex.: `https://algo.trycloudflare.com`) para seu amigo. Um endereço novo pode levar cerca de 1 minuto para começar a funcionar.
3. Seu amigo cola essa URL no campo **Servidor** e clica em **Aplicar**.
4. Você continua usando `http://127.0.0.1:3000`.

O túnel fecha junto com o Vox. Se ele cair sozinho, o Vox reabre com um endereço novo: mande o novo para o seu amigo. Alternativas manuais: `IniciarTunelVox.bat` na pasta do projeto, `cloudflared tunnel --url http://127.0.0.1:3000` ou `ngrok http 3000`.

> Chamadas de voz/vídeo entre redes diferentes podem precisar de um servidor TURN (ex.: Coturn). Sem TURN, algumas conexões podem falhar (a coluna Membros mostra "Falhou" para essa pessoa). Na mesma rede, não é necessário.

## Observações

- Desenvolvimento: `users.json`, `messages.json`, `servers.json`, `friends.json`, `sessions.json` e a pasta `uploads/` (imagens do chat) ficam na pasta do projeto.
- Instalado: ficam em `%APPDATA%\Vox`.
- As imagens do chat seguem as regras das mensagens: somem junto com elas (7 dias, limite de 200 por canal, ou quando o autor apaga). Quem tem o endereço do servidor e o nome aleatório do arquivo consegue abrir a imagem.
- Ao fechar o Vox, a próxima abertura pede login de novo: a sessão de reconexão fica só na memória.
- O campo **Servidor** fica na tela de login e é salvo no computador.
- Versão: o app e o servidor precisam ser da mesma versão. Se forem diferentes, o login mostra um aviso para atualizar o Vox, e o amigo precisa instalar a versão nova.
- Na mesma rede, a conexão usa HTTP (sem TLS). Use em uma rede confiável; para internet, prefira o túnel HTTPS.
- O compartilhamento de tela usa o seletor nativo do Electron (janela ou tela inteira).
- A qualidade real do vídeo depende da internet de quem envia e de quem recebe.
