const axios = require('axios');
const logger = require('./logger');

class RobotProxy {
  constructor(playerId, ip, port) {
    this.playerId = playerId;
    this.ip       = ip;
    this.port     = port;
    this.baseUrl  = `http://${ip}:${port}`;
    this.online   = false;
    this._pingInterval = null;
  }

  updateAddress(ip, port) {
    this.ip      = ip;
    this.port    = port;
    this.baseUrl = `http://${ip}:${port}`;
    logger.info(`Robot ${this.playerId} address updated → ${this.baseUrl}`);
    this.startPing();
  }

  // ── Send movement / attack command ──────────────────────────────
  async sendCommand(cmd, ts) {
    try {
      await axios.post(
        `${this.baseUrl}/cmd`,
        { player: this.playerId, cmd, ts },
        { timeout: 300 }  // 300ms timeout — fast robots need fast comms
      );
      this.online = true;
    } catch (err) {
      this.online = false;
      logger.warn(`Robot ${this.playerId} unreachable (${cmd}): ${err.message}`);
    }
  }

  // ── Emergency stop ───────────────────────────────────────────────
  async emergencyStop() {
    try {
      await axios.post(`${this.baseUrl}/stop`, {}, { timeout: 500 });
      logger.warn(`Robot ${this.playerId} EMERGENCY STOP sent`);
    } catch (err) {
      logger.error(`Robot ${this.playerId} STOP failed: ${err.message}`);
    }
  }

  // ── Periodic health ping ─────────────────────────────────────────
  startPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = setInterval(async () => {
      try {
        const res = await axios.get(`${this.baseUrl}/status`, { timeout: 800 });
        this.online = true;
        this.telemetry = res.data; // { battery, signal, temp }
      } catch {
        this.online = false;
        this.telemetry = null;
      }
    }, 3000);
  }

  stopPing() {
    clearInterval(this._pingInterval);
  }

  getStatus() {
    return {
      player:    this.playerId,
      online:    this.online,
      ip:        this.ip,
      port:      this.port,
      telemetry: this.telemetry || null,
    };
  }
}

module.exports = RobotProxy;
