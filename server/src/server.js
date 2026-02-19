const http        = require('http');
const express     = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const MatchManager  = require('./matchManager');
const RobotProxy    = require('./robotProxy');
const logger        = require('./logger');

// ── Valid commands whitelist ───────────────────────────────────────────────────
const VALID_CMDS = new Set([
  'UP', 'DOWN', 'LEFT', 'RIGHT',
  'STOP_UP', 'STOP_DOWN', 'STOP_LEFT', 'STOP_RIGHT',
  'PUNCH_L', 'PUNCH_R', 'KICK', 'SPECIAL',
]);

function createServer(wsPort) {
  const app    = express();
  const server = http.createServer(app);
  const wss    = new WebSocketServer({ server });

  app.use(express.json());

  // ── Connected browser clients ──────────────────────────────────────────────
  const clients = new Set();

  // ── Robot proxies ──────────────────────────────────────────────────────────
  const robots = {
    1: new RobotProxy(1, process.env.ROBOT1_IP || '192.168.1.100', parseInt(process.env.ROBOT1_PORT) || 8080),
    2: new RobotProxy(2, process.env.ROBOT2_IP || '192.168.1.101', parseInt(process.env.ROBOT2_PORT) || 8080),
  };

  // Start pinging robots immediately
  robots[1].startPing();
  robots[2].startPing();

  // ── Match manager ──────────────────────────────────────────────────────────
  const match = new MatchManager((stateMsg) => {
    // Broadcast match state to all browser clients
    broadcast(stateMsg);

    // If match ended, stop all robots
    if (stateMsg.type === 'MATCH_END') {
      robots[1].emergencyStop();
      robots[2].emergencyStop();
    }
  });

  // ── Broadcast to all connected browsers ───────────────────────────────────
  function broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  // ── Telemetry broadcast every 3s ──────────────────────────────────────────
  setInterval(() => {
    broadcast({
      type:    'TELEMETRY',
      robot1:  robots[1].getStatus(),
      robot2:  robots[2].getStatus(),
      match:   match.getStatus(),
    });
  }, 3000);

  // ════════════════════════════════════════════════════════════════════════════
  // WebSocket handler
  // ════════════════════════════════════════════════════════════════════════════
  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    clients.add(ws);
    logger.ok(`Browser connected: ${ip} (total: ${clients.size})`);

    // Send current state immediately on connect
    ws.send(JSON.stringify({
      type:   'INIT',
      match:  match.getStatus(),
      robot1: robots[1].getStatus(),
      robot2: robots[2].getStatus(),
    }));

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        logger.warn(`Invalid JSON from ${ip}`);
        return;
      }

      await handleMessage(msg, ws);
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.warn(`Browser disconnected: ${ip} (total: ${clients.size})`);
    });

    ws.on('error', (err) => logger.error(`WS error from ${ip}: ${err.message}`));
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Message router
  // ════════════════════════════════════════════════════════════════════════════
  async function handleMessage(msg, ws) {
    switch (msg.type) {

      // ── Robot command ──────────────────────────────────────────────────────
      case 'CMD': {
        const { player, cmd, ts } = msg;

        // Validate
        if (![1, 2].includes(player)) return;
        if (!VALID_CMDS.has(cmd)) {
          logger.warn(`Invalid cmd from client: "${cmd}"`);
          return;
        }

        logger.cmd(player, cmd);

        // Forward to robot (non-blocking)
        robots[player].sendCommand(cmd, ts).catch(() => {});

        // Apply damage logic if attack
        match.applyAttack(player, cmd);

        // Echo to all other connected browsers (spectators see it too)
        broadcast({ type: 'CMD_ECHO', player, cmd, ts });
        break;
      }

      // ── Match control ──────────────────────────────────────────────────────
      case 'MATCH_START': {
        const result = match.start();
        if (result.ok) {
          broadcast({ type: 'MATCH_STARTED', ts: Date.now() });
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', reason: result.reason }));
        }
        break;
      }

      case 'MATCH_STOP': {
        match.stop();
        broadcast({ type: 'MATCH_STOPPED', ts: Date.now() });
        break;
      }

      // ── Emergency stop ─────────────────────────────────────────────────────
      case 'EMERGENCY_STOP': {
        logger.warn('⚠ EMERGENCY STOP received');
        match.stop();
        await Promise.all([
          robots[1].emergencyStop(),
          robots[2].emergencyStop(),
        ]);
        broadcast({ type: 'EMERGENCY_STOP', ts: Date.now() });
        break;
      }

      // ── Update robot address from UI ────────────────────────────────────────
      case 'SET_ROBOT_ADDR': {
        const { player, ip, port } = msg;
        if (![1, 2].includes(player)) return;
        robots[player].updateAddress(ip, parseInt(port));
        ws.send(JSON.stringify({ type: 'ROBOT_ADDR_UPDATED', player, ip, port }));
        break;
      }

      default:
        logger.warn(`Unknown message type: ${msg.type}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REST API (useful for testing / integrations)
  // ════════════════════════════════════════════════════════════════════════════

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status:  'ok',
      clients: clients.size,
      match:   match.getStatus(),
      robots: {
        1: robots[1].getStatus(),
        2: robots[2].getStatus(),
      },
    });
  });

  // Manual command (for testing without a browser)
  app.post('/cmd', async (req, res) => {
    const { player, cmd } = req.body;
    if (![1, 2].includes(player) || !VALID_CMDS.has(cmd)) {
      return res.status(400).json({ error: 'Invalid player or cmd' });
    }
    await robots[player].sendCommand(cmd, Date.now());
    match.applyAttack(player, cmd);
    broadcast({ type: 'CMD_ECHO', player, cmd, ts: Date.now() });
    res.json({ ok: true });
  });

  // Match control via REST
  app.post('/match/start', (req, res) => {
    const result = match.start();
    if (result.ok) broadcast({ type: 'MATCH_STARTED', ts: Date.now() });
    res.json(result);
  });

  app.post('/match/stop', (req, res) => {
    match.stop();
    broadcast({ type: 'MATCH_STOPPED', ts: Date.now() });
    res.json({ ok: true });
  });

  // Override HP (for testing / hardware sensors)
  app.post('/hp', (req, res) => {
    const { player, hp } = req.body;
    if (![1, 2].includes(player) || typeof hp !== 'number') {
      return res.status(400).json({ error: 'Invalid params' });
    }
    match.hp[player] = Math.max(0, Math.min(100, hp));
    match._broadcastHP();
    res.json({ ok: true, hp: match.hp });
  });

  // ── Start listening ────────────────────────────────────────────────────────
  server.listen(wsPort, () => {
    logger.ok(`Server listening on port ${wsPort}`);
  });

  return { server, wss, match, robots };
}

module.exports = { createServer };
