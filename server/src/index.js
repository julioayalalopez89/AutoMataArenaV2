require('dotenv').config();
const { createServer } = require('./server');
const logger = require('./logger');

const PORT = parseInt(process.env.PORT) || 9000;

createServer(PORT);

logger.info(`
╔══════════════════════════════════════════╗
║          ROBOWAR SERVER v1.0             ║
║    WebSocket: ws://localhost:${PORT}        ║
║    HTTP API:  http://localhost:${parseInt(process.env.HTTP_PORT)||9001}       ║
╚══════════════════════════════════════════╝
`);
