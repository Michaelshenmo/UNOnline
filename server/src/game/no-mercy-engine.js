const COLORS = ['red', 'yellow', 'green', 'blue'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DEFAULT_UNO_PENALTY = 2;
const MAX_HAND = 40;

function createDeck() {
  const cards = [];
  for (const color of COLORS) {
    cards.push({ type: 'number', color, value: '0' });
    for (let i = 0; i < 2; i++) {
      for (const v of NUMBERS.slice(1)) {
        cards.push({ type: 'number', color, value: v });
      }
      cards.push({ type: 'skip', color, value: null });
      cards.push({ type: 'reverse', color, value: null });
      cards.push({ type: 'draw2', color, value: null });
      cards.push({ type: 'draw4', color, value: null });
      cards.push({ type: 'discard_all', color, value: null });
    }
  }
  for (let i = 0; i < 8; i++) {
    cards.push({ type: 'wild', color: null, value: null });
    cards.push({ type: 'wild_rev4', color: null, value: null });
    cards.push({ type: 'wild6', color: null, value: null });
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ type: 'wild10', color: null, value: null });
    cards.push({ type: 'wild_wheel', color: null, value: null });
  }
  return cards;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DRAW_VALUES = { draw2: 2, draw4: 4, wild_rev4: 4, wild6: 6, wild10: 10 };

export class NoMercyEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.drawPile = [];
    this.discardPile = [];
    this.players = [];
    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.currentColor = null;
    this.state = 'waiting';
    this.winner = null;
    this.rankings = [];
    this.lastAction = null;
    this.pendingDraw = 0;
    this.lastDrawValue = 0;
    this.pendingAction = null;
    this.eliminatedCards = [];
  }

  initialize(playerInfos) {
    this.reset();
    this.players = playerInfos.map(p => ({
      id: p.id, username: p.username, hand: [], calledUno: false, isOut: false,
    }));
    this.drawPile = shuffle(createDeck());
    for (const p of this.players) p.hand = this.drawPile.splice(0, 7);
    this.startDiscard();
    this.state = 'playing';
    return this.getPublicState();
  }

  startDiscard() {
    let card = this.drawPile.pop();
    while (['wild', 'wild_rev4', 'wild6', 'wild10', 'wild_wheel'].includes(card.type)) {
      this.drawPile.unshift(card); shuffle(this.drawPile); card = this.drawPile.pop();
    }
    this.discardPile.push(card);
    this.currentColor = card.color;
  }

  nextPlayerIndex(fromIndex, dir) {
    const active = this.players.filter(p => !p.isOut);
    if (active.length <= 1) return -1;
    const idx = fromIndex ?? this.currentPlayerIndex;
    const d = dir ?? this.direction;
    let next = (idx + d + this.players.length) % this.players.length;
    let attempts = 0;
    while (this.players[next].isOut && attempts < this.players.length) {
      next = (next + d + this.players.length) % this.players.length;
      attempts++;
    }
    return next;
  }

  replenishDrawPile() {
    if (this.drawPile.length > 0) return;
    const top = this.discardPile.pop();
    this.drawPile = shuffle([...this.discardPile, ...this.eliminatedCards]);
    this.eliminatedCards = [];
    this.discardPile = [top];
  }

  canPlay(card) {
    const top = this.discardPile[this.discardPile.length - 1];
    const face = card;
    if (this.pendingDraw > 0) {
      const val = DRAW_VALUES[face.type];
      return !!val && val >= this.lastDrawValue;
    }
    if (['wild', 'wild_rev4', 'wild6', 'wild10', 'wild_wheel'].includes(face.type)) return true;
    if (face.color === this.currentColor) return true;
    if (face.type === 'number' && face.value === top.value && top.type === 'number') return true;
    if (face.type === top.type && face.type !== 'number') return true;
    return false;
  }

  playCard(playerId, cardIndex, chosenColor) {
    if (this.state !== 'playing') return { error: '游戏未进行中' };
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (this.players.indexOf(player) !== this.currentPlayerIndex) return { error: '不是你的回合' };
    if (cardIndex < 0 || cardIndex >= player.hand.length) return { error: '无效的牌' };
    const card = player.hand[cardIndex];
    if (!this.canPlay(card)) return { error: '这张牌不能出' };

    const isWild = ['wild', 'wild_rev4', 'wild6', 'wild10', 'wild_wheel'].includes(card.type);

    // Wild cards need color choice
    if (isWild) {
      if (!chosenColor || !COLORS.includes(chosenColor)) {
        return { error: '请选择一种颜色', needsColor: true };
      }
      this.currentColor = chosenColor;
    } else {
      this.currentColor = card.color;
    }

    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.lastAction = { type: 'play', playerId, card };
    this.players.forEach(p => { if (!p.isOut) p.calledUno = false; });

    // 7-swap (number 7)
    if (card.type === 'number' && card.value === '7') {
      this.pendingAction = { type: 'swap', playerId };
      return { success: true, needsSwap: true };
    }

    // 0-pass (number 0)
    if (card.type === 'number' && card.value === '0') {
      this.doPassHands(playerId);
      this.checkEliminations();
      this.currentPlayerIndex = this.nextPlayerIndex();
      if (player.hand.length === 0) { this.eliminatePlayer(player); return { success: true, eliminated: true }; }
      return { success: true, passed: true };
    }

    // Discard all same color
    if (card.type === 'discard_all') {
      const removed = player.hand.filter(c => c.color === card.color);
      if (removed.length > 0) {
        this.discardPile.push(...removed);
      }
      this.lastAction.cardsDiscarded = removed.length;
    }

    // Draw cards (stackable)
    if (DRAW_VALUES[card.type]) {
      this.pendingDraw += DRAW_VALUES[card.type];
      this.lastDrawValue = DRAW_VALUES[card.type];
      if (card.type === 'wild_rev4') {
        const active = this.players.filter(p => !p.isOut);
        this.direction = active.length === 2 ? this.direction : -this.direction;
      }
      this.currentPlayerIndex = this.nextPlayerIndex();
      this.checkEliminations();
      if (player.hand.length === 0) { this.eliminatePlayer(player); return { success: true, eliminated: true }; }
      return { success: true, stacking: true };
    }

    if (card.type === 'skip') {
      this.currentPlayerIndex = this.nextPlayerIndex();
      this.currentPlayerIndex = this.nextPlayerIndex();
    } else if (card.type === 'reverse') {
      const active = this.players.filter(p => !p.isOut);
      if (active.length === 2) { this.currentPlayerIndex = this.nextPlayerIndex(); this.currentPlayerIndex = this.nextPlayerIndex(); }
      else { this.direction *= -1; this.currentPlayerIndex = this.nextPlayerIndex(); }
    } else {
      this.currentPlayerIndex = this.nextPlayerIndex();
    }

    this.checkEliminations();
    if (player.hand.length === 0) { this.eliminatePlayer(player); return { success: true, eliminated: true }; }

    // Color wheel
    if (card.type === 'wild_wheel') {
      this.pendingAction = { type: 'wheel', playerId, color: chosenColor };
      return { success: true, needsWheel: true };
    }

    return { success: true };
  }

  chooseSwapTarget(playerId, targetId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (!this.pendingAction || this.pendingAction.type !== 'swap' || this.pendingAction.playerId !== playerId) return { error: '没有待处理的换牌' };
    const target = this.players.find(p => p.id === targetId);
    if (!target || target.isOut || target.id === playerId) return { error: '无效的目标玩家' };

    const playerHand = player.hand;
    player.hand = target.hand;
    target.hand = playerHand;
    this.pendingAction = null;
    this.lastAction = { type: 'swap', playerId, targetId, card: this.discardPile[this.discardPile.length - 1] };
    this.currentPlayerIndex = this.nextPlayerIndex();
    return { success: true };
  }

  doPassHands(playerId) {
    const active = this.players.filter(p => !p.isOut);
    const hands = active.map(p => p.hand);
    active.forEach((p, i) => {
      p.hand = hands[(i + (this.direction > 0 ? 1 : hands.length - 1)) % hands.length];
    });
    this.lastAction = { type: 'pass', playerId, card: this.discardPile[this.discardPile.length - 1] };
  }

  drawWheelCard(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (!this.pendingAction || this.pendingAction.type !== 'wheel' || this.pendingAction.playerId !== playerId) return { error: '没有待处理的轮盘' };
    this.replenishDrawPile();
    if (this.drawPile.length === 0) { this.pendingAction = null; this.currentPlayerIndex = this.nextPlayerIndex(); return { error: '牌堆已空' }; }
    const drawn = this.drawPile.pop();
    player.hand.push(drawn);
    if (drawn.color === this.pendingAction.color && !['wild', 'wild_rev4', 'wild6', 'wild10', 'wild_wheel'].includes(drawn.type)) {
      this.pendingAction = null;
      this.lastAction = { type: 'wheel_end', playerId, color: this.currentColor };
      this.currentPlayerIndex = this.nextPlayerIndex();
      return { success: true, finished: true, card: drawn };
    }
    this.lastAction = { type: 'wheel_draw', playerId, card: drawn };
    return { success: true, finished: false, card: drawn };
  }

  checkEliminations() {
    const toEliminate = this.players.filter(p => !p.isOut && p.hand.length >= MAX_HAND);
    for (const p of toEliminate) {
      this.eliminatedCards.push(...p.hand);
      p.hand = [];
      this.eliminatePlayer(p);
    }
  }

  acceptPendingDraw(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (this.pendingDraw <= 0) return { error: '没有待兑现的加牌' };
    if (this.players.indexOf(player) !== this.currentPlayerIndex) return { error: '不是你的回合' };
    const count = this.pendingDraw;
    this.drawCardsForPlayer(this.currentPlayerIndex, count);
    this.pendingDraw = 0;
    this.lastDrawValue = 0;
    this.lastAction = { type: 'accept_draw', playerId, drawn: count };
    this.checkEliminations();
    this.currentPlayerIndex = this.nextPlayerIndex();
    return { success: true, drawn: count };
  }

  drawCardsForPlayer(playerIndex, count) {
    const player = this.players[playerIndex];
    for (let i = 0; i < count; i++) {
      this.replenishDrawPile();
      if (this.drawPile.length === 0) break;
      player.hand.push(this.drawPile.pop());
    }
  }

  drawCard(playerId) {
    if (this.state !== 'playing') return { error: '游戏未进行中' };
    if (this.pendingDraw > 0) return { error: '有待兑现的加牌，不能抽牌' };
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (this.players.indexOf(player) !== this.currentPlayerIndex) return { error: '不是你的回合' };
    this.replenishDrawPile();
    if (this.drawPile.length === 0) return { error: '牌堆已空' };
    const drawn = this.drawPile.pop();
    player.hand.push(drawn);
    this.lastAction = { type: 'draw', playerId };
    if (this.canPlay(drawn)) return { success: true, card: drawn, canPlayNow: true };
    this.currentPlayerIndex = this.nextPlayerIndex();
    this.players.forEach(p => { if (!p.isOut) p.calledUno = false; });
    return { success: true, card: drawn };
  }

  declinePlay(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (this.players.indexOf(player) !== this.currentPlayerIndex) return { error: '不是你的回合' };
    this.currentPlayerIndex = this.nextPlayerIndex();
    this.players.forEach(p => { if (!p.isOut) p.calledUno = false; });
    return { success: true };
  }

  callUno(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (player.hand.length > 1) return { error: '手牌数大于1，不能喊UNO' };
    player.calledUno = true;
    return { success: true };
  }

  penalizeNoUno(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    this.drawCardsForPlayer(this.players.indexOf(player), DEFAULT_UNO_PENALTY);
  }

  eliminatePlayer(player) {
    const playerIndex = this.players.indexOf(player);
    player.isOut = true;
    player.hand = [];
    this.rankings.push({ playerId: player.id, username: player.username, rank: this.rankings.length + 1 });
    const remaining = this.players.filter(p => !p.isOut);
    if (remaining.length <= 1) {
      if (remaining.length === 1) this.rankings.push({ playerId: remaining[0].id, username: remaining[0].username, rank: this.rankings.length + 1 });
      this.state = 'finished';
      this.winner = remaining[0] || null;
      return;
    }
    if (playerIndex === this.currentPlayerIndex) this.currentPlayerIndex = this.nextPlayerIndex();
  }

  getPublicState(playerId) {
    return {
      mode: 'no-mercy',
      state: this.state,
      players: this.players.map(p => ({
        id: p.id, username: p.username, cardCount: p.hand.length,
        calledUno: p.calledUno, isOut: p.isOut,
        hand: p.id === playerId ? p.hand : undefined,
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      direction: this.direction,
      currentColor: this.currentColor,
      topCard: this.discardPile[this.discardPile.length - 1] || null,
      discardCount: this.discardPile.length,
      drawPileCount: this.drawPile.length,
      pendingDraw: this.pendingDraw,
      lastDrawValue: this.lastDrawValue,
      pendingAction: this.pendingAction,
      rankings: this.rankings,
      activeCount: this.players.filter(p => !p.isOut).length,
      lastAction: this.lastAction,
    };
  }
}
