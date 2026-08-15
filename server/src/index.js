import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { verifyToken } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import manager from './game/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

function enrichRoom(room) {
  if (!room) return room;
  const result = { ...room, players: room.players.map(p => ({ ...p })) };
  for (const p of result.players) {
    const row = db.prepare('SELECT title, title_enabled FROM users WHERE id = ?').get(p.id);
    if (row) { p.title = row.title; p.title_enabled = row.title_enabled; }
  }
  return result;
}

app.get('/api/rooms', (req, res) => {
  res.json(manager.getRooms().map(r => enrichRoom(r)));
});

app.get('/api/public-config', (req, res) => {
  const ev = db.prepare("SELECT value FROM system_settings WHERE key = 'email_verification'").get();
  const ar = db.prepare("SELECT value FROM system_settings WHERE key = 'allow_registration'").get();
  res.json({ email_verification: ev?.value === 'true', allow_registration: ar?.value !== 'false' });
});

app.get('/api/announcement', (req, res) => {
  const announcement = db.prepare("SELECT value FROM system_settings WHERE key = 'announcement'").get();
  const version = db.prepare("SELECT value FROM system_settings WHERE key = 'announcement_version'").get();
  res.json({ announcement: announcement?.value || '', version: parseInt(version?.value) || 0 });
});

app.get('/api/online-users', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const user = token ? verifyToken(token) : null;
  const onlineIds = manager.getOnlineUsers(user?.id).map(u => u.id);
  const users = onlineIds.length > 0
    ? db.prepare(`SELECT id, username, nickname, title, title_enabled FROM users WHERE id IN (${onlineIds.join(',')})`).all()
    : [];
  users.sort((a, b) => ((b.title_enabled && b.title) ? 1 : 0) - ((a.title_enabled && a.title) ? 1 : 0));
  res.json(users);
});

app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
});

const userSocketMap = new Map();

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('authenticate', (token) => {
    const user = verifyToken(token);
    if (!user) {
      socket.emit('error', { message: '认证失败' });
      return;
    }
    currentUser = user;
    userSocketMap.set(user.id, socket.id);
    manager.registerSocket(user.id, socket.id);
    socket.join(`user:${user.id}`);
    socket.emit('authenticated', { user });
    updateOnlineUsers();
  });

  const displayName = (u) => u.nickname || u.username;
  const getUserStatus = (u) => {
    if (!u) return 'normal';
    const row = db.prepare('SELECT status FROM users WHERE id = ?').get(u.id);
    return row ? row.status : 'normal';
  };
  const isBanned = (u) => getUserStatus(u) === 'banned';

  socket.on('create_room', () => {
    if (!currentUser) return;
    if (isBanned(currentUser)) { socket.emit('error', { message: '账号已被封禁' }); return; }
    const existing = manager.getRoomByPlayer(currentUser.id);
    if (existing) {
      socket.emit('error', { message: '你已在房间中' });
      return;
    }
    const room = manager.createRoom(currentUser.id, displayName(currentUser));
    socket.join(`room:${room.id}`);
    socket.emit('room_created', { room: enrichRoom(room) });
    updateRooms();
  });

  socket.on('join_room', ({ roomId }) => {
    if (!currentUser) return;
    if (isBanned(currentUser)) { socket.emit('error', { message: '账号已被封禁' }); return; }
    const existing = manager.getRoomByPlayer(currentUser.id);
    if (existing) {
      socket.emit('error', { message: '你已在房间中' });
      return;
    }
    const result = manager.joinRoom(roomId, currentUser.id, displayName(currentUser));
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(`room:${roomId}`);
    socket.emit('room_joined', { room: enrichRoom(result.room) });
    socket.to(`room:${roomId}`).emit('player_joined', {
      player: { id: currentUser.id, username: displayName(currentUser) },
      room: enrichRoom(result.room),
    });
    updateRooms();
  });

  socket.on('join_spectator', ({ roomId }) => {
    if (!currentUser) return;
    if (isBanned(currentUser)) { socket.emit('error', { message: '账号已被封禁' }); return; }
    const existing = manager.getRoomByPlayer(currentUser.id);
    if (existing) {
      socket.emit('error', { message: '你已在房间中' });
      return;
    }
    const room = manager.getRoom(roomId);
    if (!room) { socket.emit('error', { message: '房间不存在' }); return; }
    const result = manager.joinSpectator(roomId, currentUser.id, displayName(currentUser));
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    socket.join(`room:${roomId}`);
    socket.emit('spectator_joined', { room: enrichRoom(result.room) });
    broadcastRoomState(room);
    updateRooms();
  });

  socket.on('leave_room', () => {
    if (!currentUser) return;
    const result = manager.leaveRoom(currentUser.id);
    if (!result) return;
    socket.leave(`room:${result.roomId}`);
    if (result.disbanded) {
      io.to(`room:${result.roomId}`).emit('room_disbanded');
    } else {
      socket.to(`room:${result.roomId}`).emit('player_left', {
        playerId: currentUser.id,
        room: enrichRoom(result.room),
      });
      if (result.room.state === 'playing') {
        broadcastGameState(result.room);
      }
    }
    updateRooms();
  });

  socket.on('set_game_mode', ({ mode }) => {
    if (!currentUser) return;
    if (!['standard', 'flip', 'no-mercy'].includes(mode)) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || room.hostId !== currentUser.id || room.state !== 'waiting') return;
    room.gameMode = mode;
    io.to(`room:${room.id}`).emit('game_mode_changed', { mode });
    updateRooms();
  });

  socket.on('kick_player', ({ targetId }) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (currentUser.id === targetId) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room) return;
    const isPlaying = room.engine && room.players.some(p => p.id === targetId);
    const result = manager.leaveRoom(targetId);
    if (result && !result.disbanded) {
      io.to(`user:${targetId}`).emit('kicked', { reason: 'kicked' });
      io.to(`room:${result.roomId}`).emit('player_left', { playerId: targetId, room: enrichRoom(result.room) });
      if (result.room.state === 'playing') broadcastGameState(result.room);
    }
    updateRooms();
  });

  socket.on('ban_player', ({ targetId }) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (currentUser.id === targetId) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room) return;
    db.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(targetId);
    const result = manager.leaveRoom(targetId);
    if (result && !result.disbanded) {
      io.to(`user:${targetId}`).emit('banned', { reason: 'banned' });
      io.to(`room:${result.roomId}`).emit('player_left', { playerId: targetId, room: enrichRoom(result.room) });
      if (result.room.state === 'playing') broadcastGameState(result.room);
    }
    updateRooms();
  });

  socket.on('convert_to_spectator', ({ targetId }) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (currentUser.id === targetId) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    const player = room.engine.players.find(p => p.id === targetId);
    if (!player || player.isOut) return;
    player.isOut = true;
    player.hand = [];
    room.players = room.players.filter(p => p.id !== targetId);
    room.spectators.push({ id: targetId, username: player.username });
    manager.playerRooms.set(targetId, room.id);
    if (room.engine.currentPlayerIndex === room.engine.players.indexOf(player)) {
      room.engine.currentPlayerIndex = room.engine.nextPlayerIndex();
    }
    io.to(`user:${targetId}`).emit('converted_to_spectator', { reason: '已被管理员转为观战者' });
    broadcastGameState(room);
    broadcastRoomState(room);
    updateRooms();
  });

  socket.on('start_game', ({ mode } = {}) => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room) { socket.emit('error', { message: '不在房间中' }); return; }
    if (mode && ['standard', 'flip', 'no-mercy'].includes(mode) && room.state === 'waiting') {
      room.gameMode = mode;
    }
    const thresholdRow = db.prepare("SELECT value FROM system_settings WHERE key = 'no_mercy_threshold'").get();
    const noMercyThreshold = parseInt(thresholdRow?.value) || 40;
    const titleRows = db.prepare('SELECT id, title, title_enabled FROM users').all();
    const titleMap = {};
    titleRows.forEach(t => { titleMap[t.id] = { title: t.title, title_enabled: t.title_enabled }; });
    const result = manager.startGame(room.id, currentUser.id, { noMercyThreshold, titleMap });
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    for (const player of room.engine.players) {
      const state = room.engine.getPublicState(player.id);
      io.to(`user:${player.id}`).emit('game_started', { gameState: state });
    }
  });

  socket.on('play_card', ({ cardIndex, color }) => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    const result = room.engine.playCard(currentUser.id, cardIndex, color);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
    if (result.needsColor) {
      socket.emit('flip_color_needed');
    }
    if (room.engine.state === 'finished') {
      io.to(`room:${room.id}`).emit('game_over', {
        rankings: room.engine.rankings,
      });
    }
  });

  socket.on('draw_card', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    const result = room.engine.drawCard(currentUser.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    if (result.canPlayNow) {
      socket.emit('draw_playable', { card: result.card });
    }
    broadcastGameState(room);
    emitGameOverIfFinished(room);
  });

  socket.on('decline_play', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    const result = room.engine.declinePlay(currentUser.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
  });

  socket.on('choose_swap_target', ({ targetId }) => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine || !room.engine.chooseSwapTarget) return;
    const result = room.engine.chooseSwapTarget(currentUser.id, targetId);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
    if (room.engine.state === 'finished') {
      io.to(`room:${room.id}`).emit('game_over', { rankings: room.engine.rankings });
    }
  });

  socket.on('cancel_pending_action', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine || !room.engine.cancelPendingAction) return;
    const result = room.engine.cancelPendingAction(currentUser.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
    emitGameOverIfFinished(room);
  });

  socket.on('confirm_zero', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine || !room.engine.confirmZero) return;
    const result = room.engine.confirmZero(currentUser.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
    emitGameOverIfFinished(room);
  });

  socket.on('draw_wheel_card', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine || !room.engine.drawWheelCard) return;
    const result = room.engine.drawWheelCard(currentUser.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
    emitGameOverIfFinished(room);
  });

  socket.on('choose_flip_color', ({ color }) => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine || room.engine.chooseFlipColor === undefined) return;
    const result = room.engine.chooseFlipColor(currentUser.id, color);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
  });

  socket.on('accept_draw', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    const result = room.engine.acceptPendingDraw(currentUser.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    broadcastGameState(room);
    emitGameOverIfFinished(room);
  });

  socket.on('call_uno', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    const result = room.engine.callUno(currentUser.id);
    if (result.error) { socket.emit('error', { message: result.error }); return; }
    io.to(`room:${room.id}`).emit('uno_called', { playerId: currentUser.id });
    broadcastGameState(room);
  });

  socket.on('penalize_no_uno', ({ targetId }) => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    room.engine.penalizeNoUno(targetId);
    broadcastGameState(room);
    emitGameOverIfFinished(room);
  });

  socket.on('get_room_state', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room) { socket.emit('error', { message: '不在房间中' }); return; }
    socket.join(`room:${room.id}`);
    socket.emit('spectator_info', { spectators: manager.getSpectators(room.id) });
    if (room.engine) {
      const isSpec = manager.isSpectator(currentUser.id);
      const state = room.engine.getPublicState(isSpec ? null : currentUser.id);
      socket.emit('game_state', state);
    } else {
      socket.emit('room_info', { room: enrichRoom(room) });
    }
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      userSocketMap.delete(currentUser.id);
      manager.unregisterSocket(currentUser.id);
      const result = manager.leaveRoom(currentUser.id);
      if (result && !result.disbanded) {
        io.to(`room:${result.roomId}`).emit('player_left', {
          playerId: currentUser.id,
          room: enrichRoom(result.room),
        });
        if (result.room.state === 'playing') {
          broadcastGameState(result.room);
        }
      }
      updateOnlineUsers();
      updateRooms();
    }
  });

  function emitGameOverIfFinished(room) {
    if (room.engine && room.engine.state === 'finished') {
      io.to(`room:${room.id}`).emit('game_over', { rankings: room.engine.rankings });
    }
  }

  function broadcastGameState(room) {
    if (!room.engine) return;
    for (const player of room.engine.players) {
      const state = room.engine.getPublicState(player.id);
      io.to(`user:${player.id}`).emit('game_state', state);
    }
    broadcastRoomState(room);
  }

  function broadcastRoomState(room) {
    const specInfo = { spectators: manager.getSpectators(room.id) };
    const all = [...room.players, ...room.spectators];
    for (const p of all) {
      io.to(`user:${p.id}`).emit('spectator_info', specInfo);
    }
    if (room.engine) {
      const state = room.engine.getPublicState(null);
      for (const s of room.spectators) {
        io.to(`user:${s.id}`).emit('game_state', state);
      }
    }
  }

  function updateOnlineUsers() {
    const ids = [];
    for (const [uid, sid] of userSocketMap) {
      ids.push(uid);
    }
    const users = ids.length > 0
      ? db.prepare(`SELECT id, username, nickname, title, title_enabled FROM users WHERE id IN (${ids.join(',')})`).all()
      : [];
    users.sort((a, b) => ((b.title_enabled && b.title) ? 1 : 0) - ((a.title_enabled && a.title) ? 1 : 0));
    io.emit('online_users', users);
  }

  function updateRooms() {
    io.emit('rooms_update', manager.getRooms().map(r => enrichRoom(r)));
  }
});

server.listen(PORT, () => {
  console.log(`UNO Online 服务器运行在 http://localhost:${PORT}`);
});
