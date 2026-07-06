export interface User {
  id: number;
  username: string;
  nickname: string;
  role: 'player' | 'admin';
}

export interface Card {
  type: 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';
  color: string | null;
  value: string | null;
}

export interface PlayerState {
  id: number;
  username: string;
  cardCount: number;
  calledUno: boolean;
  isOut: boolean;
  hand?: Card[];
}

export interface GameState {
  state: 'waiting' | 'playing' | 'finished';
  players: PlayerState[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  currentColor: string | null;
  topCard: Card | null;
  discardCount: number;
  drawPileCount: number;
  pendingDraw: number;
  lastDrawValue: number;
  rankings: { playerId: number; username: string; rank: number }[];
  activeCount: number;
  lastAction: any;
}

export interface Room {
  id: string;
  hostId: number;
  playerCount: number;
  spectatorCount?: number;
  players: { id: number; username: string }[];
  state: string;
}

export interface SystemSettings {
  max_players: string;
  turn_timeout: string;
  uno_penalty: string;
  allow_registration: string;
}
