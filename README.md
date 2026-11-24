# 🤖 RoboWar — Proyecto Completo

## Estructura
```
robowar/
├── game/                      ← Juego en Unity (ver game/README.md)
├── docs/                      ← Diseño del juego y formato del programa de IA
├── robot-fight-control.html   ← Interfaz web (abre en el browser)
├── server/                    ← Servidor Node.js
│   ├── src/
│   │   ├── index.js
│   │   ├── server.js
│   │   ├── matchManager.js
│   │   └── robotProxy.js
│   ├── robot_pi.py            ← Script para cada Raspberry Pi
│   ├── .env                   ← Configuración de IPs y daño
│   ├── package.json
│   └── README.md              ← Guía detallada de instalación
└── README.md                  ← Este archivo
```

## Inicio rápido

### 1. Interfaz Web
Abre `robot-fight-control.html` en el browser.
Configura la URL del WebSocket (botón "Conectar WS") apuntando a tu servidor.

### 2. Servidor Node.js
```bash
cd server
npm install
# Edita .env con las IPs de tus Raspberry Pi
npm start
```

### 3. Raspberry Pi (una por robot)
```bash
pip install flask gpiozero
PLAYER_ID=1 ROBOT_PORT=8080 python3 robot_pi.py
```

Para más detalles ver `server/README.md`.

### 4. El juego (Unity)
El juego de RoboWar vive en `game/`. Ver [`game/README.md`](game/README.md), el resumen de diseño en [`docs/game-design.md`](docs/game-design.md) y el formato del programa de IA compartido con la Raspberry Pi en [`docs/ai-program-format.md`](docs/ai-program-format.md).
