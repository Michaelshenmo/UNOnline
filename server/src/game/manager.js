import { v4 as uuidv4 } from 'uuid';
import { UnoEngine } from './engine.js';
import { FlipUnoEngine } from './flip-engine.js';

class GameManager {
  constructor() {
    this.rooms = new Map();
    this.playerRooms = new Map();
    this.playerSockets = new Map();
  }

  registerSocket(userId, socketId) {
    this.playerSockets.set(userId, socketId);
  }

  unregisterSocket(userId) {
    this.playerSockets.delete(userId);
  }

  getSocketId(userId) {
    return this.playerSockets.get(userId);
  }

  createRoom(hostId, hostUsername) {
    const roomId = uuidv4().slice(0, 8);
    const room = {
      id: roomId,
      hostId,
      gameMode: 'standard',
      players: [{ id: hostId, username: hostUsername, ready: false }],
      spectators: [],
      engine: null,
      state: 'waiting',
    };
    this.rooms.set(roomId, room);
    this.playerRooms.set(hostId, roomId);
    return room;
  }

  joinRoom(roomId, userId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: '房间不存在' };
    if (room.state !== 'waiting') return { error: '游戏已经开始' };
    if (room.players.some(p => p.id === userId)) return { error: '已在房间中' };
    if (room.players.length >= 10) return { error: '房间已满' };

    room.players.push({ id: userId, username, ready: false });
    this.playerRooms.set(userId, roomId);
    return { success: true, room };
  }

  joinSpectator(roomId, userId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: '房间不存在' };
    if (room.players.some(p => p.id === userId) || room.spectators.some(s => s.id === userId)) return { error: '已在房间中' };

    room.spectators.push({ id: userId, username });
    this.playerRooms.set(userId, roomId);
    return { success: true, room };
  }

  leaveRoom(userId) {
    const roomId = this.playerRooms.get(userId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) {
      this.playerRooms.delete(userId);
      return null;
    }

    const wasPlayer = room.players.some(p => p.id === userId);
    room.players = room.players.filter(p => p.id !== userId);
    room.spectators = room.spectators.filter(s => s.id !== userId);
    this.playerRooms.delete(userId);

    const total = room.players.length + room.spectators.length;
    if (total === 0) {
      this.rooms.delete(roomId);
      return { roomId, disbanded: true };
    }

    if (wasPlayer) {
      if (room.hostId === userId) {
        room.hostId = room.players.length > 0 ? room.players[0].id : (room.spectators.length > 0 ? room.spectators[0].id : null);
      }
      if (room.state === 'playing' && room.engine) {
        const player = room.engine.players.find(p => p.id === userId);
        if (player) {
          player.isOut = true;
          player.hand = [];
          this.checkGameEnd(room);
        }
      }
    }

    return { roomId, room, disbanded: false };
  }

  getRoomByPlayer(userId) {
    const roomId = this.playerRooms.get(userId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  getRooms() {
    const result = [];
    for (const [id, room] of this.rooms) {
      result.push({
        id,
        hostId: room.hostId,
        gameMode: room.gameMode || 'standard',
        playerCount: room.players.length,
        spectatorCount: room.spectators.length,
        players: room.players.map(p => ({ id: p.id, username: p.username })),
        state: room.state,
      });
    }
    return result;
  }

  startGame(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: '房间不存在' };
    if (room.hostId !== userId) return { error: '只有房主可以开始游戏' };
    if (room.players.length < 2) return { error: '至少需要2名玩家' };
    if (room.state !== 'waiting') return { error: '游戏已经开始' };

    const Engine = room.gameMode === 'flip' ? FlipUnoEngine : UnoEngine;
    const engine = new Engine();
    const playerInfos = room.players.map(p => ({ id: p.id, username: p.username, status: 'normal' }));
    engine.initialize(playerInfos);
    room.engine = engine;
    room.state = 'playing';
    return { success: true };
  }

  checkGameEnd(room) {
    if (!room.engine) return;
    if (room.engine.state === 'finished') {
      room.state = 'finished';
    }
  }

  isSpectator(userId) {
    const roomId = this.playerRooms.get(userId);
    if (!roomId) return false;
    const room = this.rooms.get(roomId);
    if (!room) return false;
    return room.spectators.some(s => s.id === userId);
  }

  getSpectators(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.spectators;
  }

  getOnlineUsers(excludeUserId) {
    const users = [];
    for (const [userId, socketId] of this.playerSockets) {
      if (userId !== excludeUserId) {
        users.push({ id: userId, online: true });
      }
    }
    return users;
  }

  cleanup() {
    this.rooms.clear();
    this.playerRooms.clear();
    this.playerSockets.clear();
  }
}

const manager = new GameManager();
export default manager;
