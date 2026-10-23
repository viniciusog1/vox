# Concord

App desktop para Windows 11 inspirado no Discord, feito com Electron, WebRTC e Socket.io.

## Recursos

- Login e cadastro com senha (hash PBKDF2)
- Chat de texto com histórico por canal
- Chamada de voz e vídeo P2P (WebRTC)
- Compartilhamento de tela com seletor de janela/tela
- Qualidade do compartilhamento: 480p, 720p ou 1080p e 30 ou 60 FPS (padrão 1080p 30 FPS)
- Visualização do compartilhamento em tela cheia (botão ⛶ ou duplo clique)
- Redução de ruído do microfone (gate + filtro + compressor), com níveis de intensidade
- Painel de participantes com indicação de microfone mudo
- Canal de voz mostrando quem está conectado
- Indicador visual de áudio (quem está falando)
- Layout estilo Discord com rail de servidores, canais, chat e participantes
- Status Online, Ocupado e Invisível, com Ausente automático após 5 minutos sem atividade
- Configuração do microfone e do dispositivo de saída de áudio
- Opção de ouvir o próprio microfone para testar (use fones)
- Histórico mantido por 7 dias e apagado automaticamente depois
- Botão para apagar as próprias mensagens do canal atual

## Pré-requisitos

Para usar o instalador, não é necessário instalar nada além do próprio Concord. Para desenvolver ou gerar o instalador, instale o [Node.js](https://nodejs.org/) (versão LTS).

## Rodar

Abra o PowerShell na pasta do projeto:

```powershell
cd C:\Users\Usuario\discord-clone-windows
npm install
npm start
```

A primeira tela é o login. Crie uma conta ou entre com uma existente.

## Gerar instalador .exe

```powershell
npm run dist
```

O instalador fica em `dist/Concord Setup 1.0.0.exe`.

- O instalador é **sem assinatura digital** (para não exigir certificado pago). O Windows pode mostrar o aviso do SmartScreen: clique em **Mais informações → Executar assim mesmo**.
- O app instalado grava usuários e mensagens em `%APPDATA%\Concord`.
- A versão de desenvolvimento (`npm start`) continua usando os arquivos da pasta do projeto.
- O instalador usa o ícone padrão do Electron. Para trocar, adicione um `icon.ico` e ajuste a configuração em `package.json`.

## Testar com um amigo

O servidor já escuta na rede local (`0.0.0.0:3000`). Não é mais preciso editar o código.

### Mesma rede (Wi-Fi/cabo)

1. **Você (host)**: abra o Concord, deixe o servidor em `http://127.0.0.1:3000` e entre/crie sua conta.
2. Descubra seu IPv4 com `ipconfig` (ex.: `192.168.1.15`).
3. **Seu amigo**: instale o Concord, abra e, no campo **Servidor** da tela de login, digite `http://192.168.1.15:3000` e clique em **Aplicar**.
4. Seu amigo cria a conta dele (a conta fica no seu servidor) e vocês entram no mesmo canal.
5. Se o Windows perguntar, permita o Concord em **Redes privadas**. Se a rede estiver marcada como **Pública** ou a conexão não funcionar, libere a porta 3000 no PowerShell como administrador:
   ```powershell
   New-NetFirewallRule -DisplayName "Concord 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public
   ```
   Use o perfil `Public` apenas durante o teste e em uma rede confiável.

### Casas diferentes (internet)

1. No seu PC, com o Concord aberto, crie um túnel gratuito para `http://localhost:3000`:
   - mais fácil: execute `IniciarTunelConcord.bat` na pasta do projeto e mantenha a janela aberta;
   - ou Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3000`;
   - ou ngrok: `ngrok http 3000`.
2. Copie a URL pública gerada (ex.: `https://algo.trycloudflare.com`).
3. Seu amigo cola essa URL no campo **Servidor** e clica em **Aplicar**.
4. Você continua usando `http://127.0.0.1:3000`.

O Cloudflare Tunnel já está baixado em `tools/cloudflared.exe`. A URL do túnel gratuito muda quando ele é reiniciado; se isso acontecer, envie a nova URL para seu amigo.

> Chamadas de voz/vídeo entre redes diferentes podem precisar de um servidor TURN (ex.: Coturn). Sem TURN, algumas conexões podem falhar. Na mesma rede, não é necessário.

## Observações

- Desenvolvimento: `users.json` e `messages.json` ficam na pasta do projeto.
- Instalado: ficam em `%APPDATA%\Concord`.
- O campo **Servidor** fica na tela de login e é salvo no computador.
- Na mesma rede, a conexão usa HTTP (sem TLS). Use em uma rede confiável; para internet, prefira o túnel HTTPS.
- O compartilhamento de tela usa o seletor nativo do Electron (janela ou tela inteira).
- A qualidade real do vídeo depende da internet de quem envia e de quem recebe.
