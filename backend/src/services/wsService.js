const { WebSocketServer, WebSocket } = require('ws');
const { verifyAccess } = require('../utils/jwt');
const logger = require('../config/logger');

// Map: projectId -> Set<WebSocket>
const projectRooms = new Map();
// Map: userId -> Set<WebSocket>
const userSockets = new Map();

function register(wss) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'ws://localhost');
    const token = url.searchParams.get('token');

    let user;
    try {
      user = verifyAccess(token);
    } catch {
      logger.warn({ ip: req.socket?.remoteAddress }, 'ws.auth_failed');
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws._userId = user.id;
    ws._projects = new Set();

    if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
    userSockets.get(user.id).add(ws);

    logger.debug({ userId: user.id, ip: req.socket?.remoteAddress }, 'ws.connected');

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'subscribe' && msg.projectId) {
        ws._projects.add(msg.projectId);
        if (!projectRooms.has(msg.projectId)) projectRooms.set(msg.projectId, new Set());
        projectRooms.get(msg.projectId).add(ws);
        logger.debug({ userId: user.id, projectId: msg.projectId }, 'ws.subscribed');
      }

      if (msg.type === 'unsubscribe' && msg.projectId) {
        ws._projects.delete(msg.projectId);
        projectRooms.get(msg.projectId)?.delete(ws);
        logger.debug({ userId: user.id, projectId: msg.projectId }, 'ws.unsubscribed');
      }
    });

    ws.on('close', () => {
      userSockets.get(user.id)?.delete(ws);
      for (const pid of ws._projects || []) {
        projectRooms.get(pid)?.delete(ws);
      }
      logger.debug({ userId: user.id }, 'ws.disconnected');
    });

    ws.on('error', (err) => {
      logger.error({ userId: user.id, err: err.message }, 'ws.error');
      ws.terminate();
    });

    // Heartbeat ping
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Heartbeat every 30s — terminate dead connections silently
  const hb = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(hb));
}

function broadcast(projectId, event) {
  const room = projectRooms.get(projectId);
  if (!room) return;
  const payload = JSON.stringify(event);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

function broadcastToUser(userId, event) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

module.exports = { register, broadcast, broadcastToUser };
