# Remote Mouse

Controle o mouse e teclado do seu PC Windows pelo celular via rede local.

Funciona como um touchpad virtual no navegador do celular, comunicando em tempo real via WebSocket com o servidor que acessa a API nativa do Windows (`user32.dll`) através de FFI.

## Funcionalidades

**Touchpad**
- Movimento do cursor com sensibilidade ajustável
- Tap = clique esquerdo, dois dedos = clique direito
- Arrastar (segurar 400ms + mover)
- Scroll com dois dedos
- Pinch-to-zoom
- Modo precisão (segurar 500ms)
- Double-tap = duplo clique

**Gestos com 3 dedos**
- Deslizar para cima → Alt+Tab
- Deslizar para baixo → Mostrar desktop
- Deslizar lateralmente → Trocar desktop virtual

**Painel de Macros** (`/macros.html`)
- Controle de mídia (play/pause, volume, faixas)
- Atalhos de edição (copiar, colar, desfazer, salvar)
- Screenshot, selecionar tudo, buscar

## Requisitos

- Windows (usa `user32.dll`)
- [Node.js](https://nodejs.org/) 18+

## Instalação

```bash
git clone <repo-url>
cd remote-mouse
npm install
```

## Uso

```bash
npm start
```

O servidor exibe o IP local na inicialização:

```
========================================
  Remote Mouse Control Server
========================================
  Local:   http://localhost:3000
  Network: http://192.168.x.x:3000
========================================
```

No celular, acesse o endereço `Network` — ou abra `/qr.html` no PC para escanear o QR code.

Também disponível via batch:
- `start.bat` — inicialização simples
- `start-loop.bat` — reinicia automaticamente em caso de crash

## Páginas

| Rota | Descrição |
|------|-----------|
| `/` | Touchpad principal |
| `/qr.html` | QR code para conexão rápida |
| `/macros.html` | Botões de atalho rápido |

## Arquitetura

```
Celular (navegador)
    ↓ WebSocket
Express + WS (Node.js)
    ↓ FFI (koffi)
user32.dll (Windows API)
    ↓
Mouse / Teclado do sistema
```

O frontend detecta gestos de toque e envia deltas de movimento via WebSocket. O servidor traduz em chamadas nativas (`SetCursorPos`, `mouse_event`, `keybd_event`) com acumulador sub-pixel para movimentos suaves.

Um watchdog de 3 segundos previne cliques travados caso a conexão caia.

## Configuração

Variáveis editáveis em `server.js`:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta do servidor (ou `process.env.PORT`) |
| `SENSITIVITY` | `2.0` | Multiplicador de sensibilidade |
| `PRECISION_MULT` | `0.3` | Sensibilidade no modo precisão |

## Stack

- **Express** — servidor HTTP e arquivos estáticos
- **ws** — comunicação WebSocket em tempo real
- **koffi** — FFI para chamadas à API do Windows

## Segurança

Este projeto foi feito para uso em **rede local confiável**. Não possui autenticação — qualquer dispositivo na mesma rede pode se conectar e controlar o mouse/teclado. Não exponha na internet.

## Licença

MIT
