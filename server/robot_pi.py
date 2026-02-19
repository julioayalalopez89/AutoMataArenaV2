#!/usr/bin/env python3
"""
RoboWar — Robot Controller (Raspberry Pi)
==========================================
Corre este script en cada Raspberry Pi.
Expone un servidor HTTP que el servidor Node.js llama para:
  POST /cmd   → ejecutar un comando de movimiento/ataque
  POST /stop  → parada de emergencia
  GET  /status → telemetría (batería, señal, temperatura)

Dependencias:
  pip install flask gpiozero

Conexión de motores (L298N driver):
  Motor Izquierdo:  IN1=GPIO17, IN2=GPIO18, ENA=GPIO12 (PWM)
  Motor Derecho:    IN3=GPIO22, IN4=GPIO23, ENB=GPIO13 (PWM)
  Brazo Izquierdo:  SERVO_L=GPIO24
  Brazo Derecho:    SERVO_R=GPIO25
"""

import os
import time
import threading
import subprocess
from flask import Flask, request, jsonify

# ── Intenta importar GPIO; si no hay Raspberry Pi, usa modo simulado ──────────
try:
    from gpiozero import Motor, Servo, OutputDevice, PWMOutputDevice
    import board, busio
    GPIO_AVAILABLE = True
    print("[ROBOT] GPIO disponible — modo hardware")
except ImportError:
    GPIO_AVAILABLE = False
    print("[ROBOT] GPIO no disponible — modo simulado (útil para desarrollo)")

# ── Config desde variables de entorno ─────────────────────────────────────────
PORT      = int(os.getenv("ROBOT_PORT", 8080))
PLAYER_ID = int(os.getenv("PLAYER_ID", 1))
SPEED     = float(os.getenv("MOTOR_SPEED", 0.8))   # 0.0 - 1.0

app = Flask(__name__)

# ════════════════════════════════════════════════════════════════════════════════
# HARDWARE ABSTRACTION
# ════════════════════════════════════════════════════════════════════════════════

class RobotHardware:
    """Abstrae los pines GPIO. En modo simulado solo imprime."""

    def __init__(self):
        self.moving = None   # 'UP','DOWN','LEFT','RIGHT' o None
        self.attacking = False

        if GPIO_AVAILABLE:
            # Motores de tracción (ajusta pines según tu cableado)
            self.motor_left  = Motor(forward=17, backward=18, enable=12)
            self.motor_right = Motor(forward=22, backward=23, enable=13)
            # Servos para brazos
            self.servo_left  = Servo(24)
            self.servo_right = Servo(25)
        else:
            self.motor_left = self.motor_right = None
            self.servo_left = self.servo_right = None

    # ── Movimiento ─────────────────────────────────────────────────────────────
    def move(self, direction):
        self.moving = direction
        self._log(f"MOVE {direction}")
        if not GPIO_AVAILABLE:
            return

        if direction == "UP":
            self.motor_left.forward(SPEED)
            self.motor_right.forward(SPEED)

        elif direction == "DOWN":
            self.motor_left.backward(SPEED)
            self.motor_right.backward(SPEED)

        elif direction == "LEFT":
            self.motor_left.backward(SPEED * 0.5)
            self.motor_right.forward(SPEED)

        elif direction == "RIGHT":
            self.motor_left.forward(SPEED)
            self.motor_right.backward(SPEED * 0.5)

    def stop_move(self, direction=None):
        """Detiene motores solo si coincide con el movimiento activo."""
        if direction and self.moving != direction:
            return
        self.moving = None
        self._log("STOP motors")
        if GPIO_AVAILABLE:
            self.motor_left.stop()
            self.motor_right.stop()

    # ── Ataques ────────────────────────────────────────────────────────────────
    def attack(self, attack_type):
        if self.attacking:
            return  # evita solapamiento
        self.attacking = True
        self._log(f"ATTACK {attack_type}")
        t = threading.Thread(target=self._do_attack, args=(attack_type,), daemon=True)
        t.start()

    def _do_attack(self, attack_type):
        try:
            if attack_type == "PUNCH_L":
                self._servo_punch(self.servo_left, duration=0.3)
            elif attack_type == "PUNCH_R":
                self._servo_punch(self.servo_right, duration=0.3)
            elif attack_type == "KICK":
                # Avanza rápido + frena (embestida)
                self._kick_move()
            elif attack_type == "SPECIAL":
                # Giro 360 + ambos brazos
                self._special()
        finally:
            self.attacking = False

    def _servo_punch(self, servo, duration=0.3):
        if not GPIO_AVAILABLE or servo is None:
            time.sleep(duration)
            return
        servo.value = 1      # extender
        time.sleep(duration)
        servo.value = -1     # retraer
        time.sleep(duration)
        servo.value = 0      # reposo

    def _kick_move(self):
        if GPIO_AVAILABLE:
            self.motor_left.forward(1.0)
            self.motor_right.forward(1.0)
            time.sleep(0.25)
            self.motor_left.stop()
            self.motor_right.stop()
        else:
            time.sleep(0.25)

    def _special(self):
        if GPIO_AVAILABLE:
            self.motor_left.forward(1.0)
            self.motor_right.backward(1.0)
            time.sleep(0.6)
            self.motor_left.stop()
            self.motor_right.stop()
            self._servo_punch(self.servo_left, 0.2)
            self._servo_punch(self.servo_right, 0.2)
        else:
            time.sleep(0.6)

    # ── Parada de emergencia ───────────────────────────────────────────────────
    def emergency_stop(self):
        self._log("!!! EMERGENCY STOP !!!")
        self.moving = None
        self.attacking = False
        if GPIO_AVAILABLE:
            self.motor_left.stop()
            self.motor_right.stop()
            if self.servo_left:  self.servo_left.value  = 0
            if self.servo_right: self.servo_right.value = 0

    # ── Telemetría ─────────────────────────────────────────────────────────────
    def get_telemetry(self):
        battery = self._read_battery()
        signal  = self._read_wifi_signal()
        temp    = self._read_cpu_temp()
        return {
            "player":   PLAYER_ID,
            "battery":  battery,
            "signal":   signal,
            "temp":     temp,
            "moving":   self.moving,
            "attacking": self.attacking,
        }

    def _read_battery(self):
        """
        Lectura real de batería via ADC (MCP3008 o INA219).
        Aquí devolvemos un valor fijo — implementa tu sensor real.
        """
        # Ejemplo con INA219:
        # ina = INA219(0.1, busio.I2C(board.SCL, board.SDA))
        # ina.set_calibration_32V_2A()
        # return round(ina.voltage / 12.6 * 100)  # % para LiPo 3S
        return 85  # simulado

    def _read_wifi_signal(self):
        """Lee la potencia de la señal Wi-Fi."""
        try:
            out = subprocess.check_output(
                ["iwconfig", "wlan0"], stderr=subprocess.DEVNULL
            ).decode()
            for part in out.split():
                if "Signal" in part:
                    dbm = int(part.split("=")[1])
                    # Convertir dBm a % aprox (-30 = 100%, -90 = 0%)
                    pct = max(0, min(100, int((dbm + 90) * 100 / 60)))
                    return pct
        except Exception:
            pass
        return 70  # simulado

    def _read_cpu_temp(self):
        """Lee temperatura del CPU de la Raspberry Pi."""
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                return round(int(f.read()) / 1000, 1)
        except Exception:
            return 45.0  # simulado

    def _log(self, msg):
        print(f"[Robot{PLAYER_ID}] {msg}")


# ── Instancia global del hardware ─────────────────────────────────────────────
robot = RobotHardware()

# ════════════════════════════════════════════════════════════════════════════════
# HTTP ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════════

MOVEMENT_CMDS = {"UP", "DOWN", "LEFT", "RIGHT"}
ATTACK_CMDS   = {"PUNCH_L", "PUNCH_R", "KICK", "SPECIAL"}
STOP_CMDS     = {"STOP_UP", "STOP_DOWN", "STOP_LEFT", "STOP_RIGHT"}

@app.route("/cmd", methods=["POST"])
def receive_command():
    data = request.get_json(force=True, silent=True) or {}
    cmd  = data.get("cmd", "").upper()
    ts   = data.get("ts", 0)

    if cmd in MOVEMENT_CMDS:
        robot.move(cmd)
    elif cmd in STOP_CMDS:
        robot.stop_move(cmd.replace("STOP_", ""))
    elif cmd in ATTACK_CMDS:
        robot.attack(cmd)
    else:
        return jsonify({"ok": False, "error": f"Unknown cmd: {cmd}"}), 400

    return jsonify({"ok": True, "cmd": cmd, "ts": ts})


@app.route("/stop", methods=["POST"])
def emergency_stop():
    robot.emergency_stop()
    return jsonify({"ok": True, "msg": "Emergency stop executed"})


@app.route("/status", methods=["GET"])
def status():
    return jsonify(robot.get_telemetry())


@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"ok": True, "player": PLAYER_ID})


# ════════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print(f"[Robot{PLAYER_ID}] Servidor iniciando en 0.0.0.0:{PORT}")
    print(f"[Robot{PLAYER_ID}] GPIO: {'ACTIVO' if GPIO_AVAILABLE else 'SIMULADO'}")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
