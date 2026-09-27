// npm init -y && npm i ws
const { WebSocketServer } = require('ws');

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

// roomId -> Map<userId, ws>
const rooms = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const roomId = url.searchParams.get('roomId');
  const userId = url.searchParams.get('userId');

  if (!roomId || !userId) {
    ws.close(4000, 'roomId and userId required');
    return;
  }

  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  const room = rooms.get(roomId);

  // 1) Tell the newcomer about everyone already in the room.
  for (const existingId of room.keys()) {
    ws.send(JSON.stringify({ type: 'USER_JOIN', userId: existingId }));
  }

  // 2) Register newcomer.
  room.set(userId, ws);

  // 3) Tell everyone else the newcomer arrived.
  for (const [, peer] of room) {
    if (peer !== ws) {
      peer.send(JSON.stringify({ type: 'USER_JOIN', userId }));
    }
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'USER_LEAVE') {
      room.delete(userId);
      broadcast(room, { type: 'USER_LEAVE', userId });
      return;
    }

    // OFFER / ANSWER / ICE_CANDIDATE are addressed to a specific peer.
    if (msg.to && room.has(msg.to)) {
      room.get(msg.to).send(JSON.stringify({ ...msg, from: userId }));
      return;
    }

    // Room-level events (e.g. SCREEN_SHARE_*) go to everyone else.
    broadcast(room, { ...msg, from: userId }, ws);
  });

  ws.on('close', () => {
    room.delete(userId);
    if (room.size === 0) rooms.delete(roomId);
    broadcast(room, { type: 'USER_LEAVE', userId });
  });
});

function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const [, peer] of room) {
    if (peer !== except && peer.readyState === 1) peer.send(data);
  }
}

console.log(`Signaling server on ws://localhost:${PORT}`);
