export interface User {
  id: number;
  username: string;
  nickname: string;
  email?: string | null;
  title?: string | null;
  title_enabled?: number | boolean;
  title_color?: string;
  role: 'player' | 'admin';
  status?: 'normal' | 'banned';
}

export interface Card {
  type: 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';
  color: string | null;
  value: string | null;
}

export interface PlayerState {
  id: number;
  username: string;
  nickname?: string;
  title?: string | null;
  title_enabled?: number | boolean;
  title_color?: string;
  status?: string;
  cardCount: number;
  calledUno: boolean;
  isOut: boolean;
  hand?: Card[];
}

export interface FlipCardPair {
  light: Card;
  dark: Card;
}

export interface GameState {
  mode?: 'standard' | 'flip' | 'no-mercy';
  maxHand?: number;
  pendingAction?: any;
  state: 'waiting' | 'playing' | 'finished';
  currentSuit?: 'light' | 'dark';
  players: PlayerState[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  currentColor: string | null;
  topCard: Card | null;
  topFlipCard?: FlipCardPair | null;
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
  gameMode?: string;
  playerCount: number;
  spectatorCount?: number;
  players: { id: number; username: string }[];
  state: string;
}

export interface SystemSettings {
  max_players: string;
  turn_timeout: string;
  uno_penalty: string;
  no_mercy_threshold?: string;
  allow_registration: string;
  announcement?: string;
  announcement_version?: string;
  email_verification?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from?: string;
}
