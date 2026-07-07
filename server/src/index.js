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

app.get('/api/rooms', (req, res) => {
  res.json(manager.getRooms());
});

app.get('/api/online-users', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const user = token ? verifyToken(token) : null;
  const users = manager.getOnlineUsers(user?.id);
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
    socket.emit('room_created', { room });
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
    socket.emit('room_joined', { room: result.room });
    socket.to(`room:${roomId}`).emit('player_joined', {
      player: { id: currentUser.id, username: displayName(currentUser) },
      room: result.room,
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
    socket.emit('spectator_joined', { room: result.room });
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
        room: result.room,
      });
      if (result.room.state === 'playing') {
        broadcastGameState(result.room);
      }
    }
    updateRooms();
  });

  socket.on('start_game', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room) { socket.emit('error', { message: '不在房间中' }); return; }
    const result = manager.startGame(room.id, currentUser.id);
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
  });

  socket.on('decline_play', () => {
    if (!currentUser) return;
    const room = manager.getRoomByPlayer(currentUser.id);
    if (!room || !room.engine) return;
    const result = room.engine.declinePlay(currentUser.id);
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
      socket.emit('room_info', { room });
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
          room: result.room,
        });
        if (result.room.state === 'playing') {
          broadcastGameState(result.room);
        }
      }
      updateOnlineUsers();
      updateRooms();
    }
  });

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
    const users = [];
    for (const [uid, sid] of userSocketMap) {
      users.push({ id: uid });
    }
    io.emit('online_users', users);
  }

  function updateRooms() {
    io.emit('rooms_update', manager.getRooms());
  }
});

server.listen(PORT, () => {
  console.log(`UNO Online 服务器运行在 http://localhost:${PORT}`);
});
