# 🤖 RoboWar Server

Servidor WebSocket + HTTP que conecta la interfaz web con los robots físicos (Raspberry Pi).

```
[ Browser UI ] ←── WebSocket ──→ [ Node.js Server ] ──→ [ Raspberry Pi 1 ]
                                                      ──→ [ Raspberry Pi 2 ]
```

---

## Arquitectura

```
robowar-server/
├── src/
│   ├── index.js         ← Punto de entrada
│   ├── server.js        ← WebSocket + REST API
│   ├── matchManager.js  ← HP, timer, daño, KO
│   ├── robotProxy.js    ← Envía comandos HTTP a las Pi
│   └── logger.js        ← Logs en color
├── robot_pi.py          ← Corre en CADA Raspberry Pi
├── .env.example         ← Plantilla de configuración (copiar a .env)
└── package.json
```

---

## 1. Instalar y arrancar el servidor Node.js

Requiere Node.js 18.11 o superior.

```bash
cd server
cp .env.example .env   # y ajusta las IPs de los robots
npm ci
npm start          # producción
npm run dev        # desarrollo con recarga automática (node --watch)
```

El servidor escucha en:
- **WebSocket**: `ws://TU_IP:9000`
- **REST API**: `http://TU_IP:9000`

---

## 2. Configurar la Raspberry Pi

Copia `robot_pi.py` a cada Raspberry Pi:

```bash
scp robot_pi.py pi@192.168.1.100:~/robowar/
```

Instala dependencias en la Pi:

```bash
pip install flask gpiozero
# Opcional (para telemetría de batería con INA219):
pip install adafruit-circuitpython-ina219
```

Arranca el robot controller:

```bash
# En Robot 1:
PLAYER_ID=1 ROBOT_PORT=8080 python3 robot_pi.py

# En Robot 2:
PLAYER_ID=2 ROBOT_PORT=8080 python3 robot_pi.py
```

Para que arranque automáticamente al encender:

```bash
# Crear servicio systemd en la Pi:
sudo nano /etc/systemd/system/robowar.service
```

```ini
[Unit]
Description=RoboWar Robot Controller
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/robowar/robot_pi.py
Environment=PLAYER_ID=1
Environment=ROBOT_PORT=8080
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable robowar
sudo systemctl start robowar
```

---

## 3. Conectar el hardware (pines GPIO)

### Driver de motores L298N

| Función          | GPIO (BCM) |
|-----------------|------------|
| Motor Izq IN1   | GPIO 17    |
| Motor Izq IN2   | GPIO 18    |
| Motor Izq ENA   | GPIO 12    |
| Motor Der IN3   | GPIO 22    |
| Motor Der IN4   | GPIO 23    |
| Motor Der ENB   | GPIO 13    |

### Servos (brazos)

| Función        | GPIO (BCM) |
|---------------|------------|
| Servo Brazo L | GPIO 24    |
| Servo Brazo R | GPIO 25    |

---

## 4. Flujo de un comando

```
1. Usuario presiona tecla en el browser
2. Browser envía WS message: { type: "CMD", player: 1, cmd: "PUNCH_L" }
3. server.js → matchManager.applyAttack(1, "PUNCH_L") → descuenta HP al Robot 2
4. server.js → robotProxy.sendCommand("PUNCH_L") → POST http://192.168.1.100:8080/cmd
5. robot_pi.py recibe el POST → activa servos/motores
6. HP actualizado se broadcast a TODOS los browsers conectados
```

---

## 5. REST API de prueba

```bash
# Ver estado del servidor
curl http://localhost:9000/health

# Enviar comando manual (sin browser)
curl -X POST http://localhost:9000/cmd \
  -H "Content-Type: application/json" \
  -d '{"player":1,"cmd":"PUNCH_L"}'

# Iniciar / parar match
curl -X POST http://localhost:9000/match/start
curl -X POST http://localhost:9000/match/stop

# Sobreescribir HP (útil con sensores físicos de impacto)
curl -X POST http://localhost:9000/hp \
  -H "Content-Type: application/json" \
  -d '{"player":2,"hp":60}'
```

---

## 6. Variables de entorno (.env)

| Variable         | Default         | Descripción                    |
|-----------------|-----------------|-------------------------------|
| `PORT`          | 9000            | Puerto WebSocket               |
| `ROBOT1_IP`     | 192.168.1.100   | IP de la Raspberry Pi 1        |
| `ROBOT1_PORT`   | 8080            | Puerto HTTP del robot 1        |
| `ROBOT2_IP`     | 192.168.1.101   | IP de la Raspberry Pi 2        |
| `ROBOT2_PORT`   | 8080            | Puerto HTTP del robot 2        |
| `MATCH_DURATION`| 180             | Duración del combate (segundos)|
| `INITIAL_HP`    | 100             | HP inicial                     |
| `DMG_PUNCH_L`   | 8               | Daño golpe izquierdo           |
| `DMG_PUNCH_R`   | 10              | Daño golpe derecho             |
| `DMG_KICK`      | 15              | Daño patada                    |
| `DMG_SPECIAL`   | 25              | Daño ataque especial           |

---

## Próximos pasos sugeridos

- [ ] **Streaming WebRTC** desde cámara en la Pi con `mediamtx`
- [ ] **Sensores de impacto** (MPU6050 acelerómetro) → POST automático a `/hp`
- [ ] **Múltiples espectadores** (ya soportado, se conectan por WS sin controlar)
- [ ] **Autenticación por token** para evitar control no autorizado
