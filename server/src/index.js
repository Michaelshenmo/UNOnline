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

  socket.on('create_room', () => {
    if (!currentUser) return;
    const existing = manager.getRoomByPlayer(currentUser.id);
    if (existing) {
      socket.emit('error', { message: '你已在房间中' });
      return;
    }
    const room = manager.createRoom(currentUser.id, currentUser.username);
    socket.join(`room:${room.id}`);
    socket.emit('room_created', { room });
    updateRooms();
  });

  socket.on('join_room', ({ roomId }) => {
    if (!currentUser) return;
    const existing = manager.getRoomByPlayer(currentUser.id);
    if (existing) {
      socket.emit('error', { message: '你已在房间中' });
      return;
    }
    const result = manager.joinRoom(roomId, currentUser.id, currentUser.username);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(`room:${roomId}`);
    socket.emit('room_joined', { room: result.room });
    socket.to(`room:${roomId}`).emit('player_joined', {
      player: { id: currentUser.id, username: currentUser.username },
      room: result.room,
    });
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
    if (result.eliminated || room.engine.state === 'finished') {
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
    if (room.engine) {
      const state = room.engine.getPublicState(currentUser.id);
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
    for (const player of room.engine.players) {
      const state = room.engine.getPublicState(player.id);
      io.to(`user:${player.id}`).emit('game_state', state);
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
