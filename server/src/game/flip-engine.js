const LIGHT_COLORS = ['red', 'yellow', 'green', 'blue'];
const DARK_COLORS = ['orange', 'purple', 'pink', 'teal'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DEFAULT_UNO_PENALTY = 2;

function createHalf(suit, colors) {
  const cards = [];
  for (const color of colors) {
    cards.push({ suit, type: 'number', color, value: '0' });
    for (let i = 0; i < 2; i++) {
      for (const v of NUMBERS.slice(1)) {
        cards.push({ suit, type: 'number', color, value: v });
      }
      cards.push({ suit, type: 'skip', color, value: null });
      cards.push({ suit, type: 'reverse', color, value: null });
      cards.push({ suit, type: suit === 'light' ? 'draw1' : 'draw5', color, value: null });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ suit, type: 'wild', color: null, value: null });
    cards.push({ suit, type: 'wild2', color: null, value: null });
    cards.push({ suit, type: 'flip', color: null, value: null });
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

function createFlipDeck() {
  const light = shuffle(createHalf('light', LIGHT_COLORS));
  const dark = shuffle(createHalf('dark', DARK_COLORS));
  const deck = [];
  for (let i = 0; i < light.length; i++) {
    deck.push({ light: light[i], dark: dark[i] });
  }
  return shuffle(deck);
}

export class FlipUnoEngine {
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
    this.currentSuit = 'light';
    this.state = 'waiting';
    this.winner = null;
    this.rankings = [];
    this.lastAction = null;
    this.pendingDraw = 0;
    this.lastDrawValue = 0;
  }

  face(card) {
    return this.currentSuit === 'light' ? card.light : card.dark;
  }

  initialize(playerInfos) {
    this.reset();
    this.players = playerInfos.map(p => ({
      id: p.id,
      username: p.username,
      hand: [],
      calledUno: false,
      isOut: false,
    }));
    const deck = createFlipDeck();
    for (const p of this.players) {
      p.hand = deck.splice(0, 7);
    }
    this.drawPile = deck;
    this.startDiscard();
    this.state = 'playing';
    return this.getPublicState();
  }

  startDiscard() {
    let card = this.drawPile.pop();
    while (this.face(card).type === 'wild' || this.face(card).type === 'wild2' || this.face(card).type === 'flip') {
      this.drawPile.unshift(card);
      shuffle(this.drawPile);
      card = this.drawPile.pop();
    }
    this.discardPile.push(card);
    this.currentColor = this.face(card).color;
  }

  nextPlayerIndex(fromIndex) {
    const active = this.players.filter(p => !p.isOut);
    if (active.length <= 1) return -1;
    const idx = fromIndex ?? this.currentPlayerIndex;
    let next = (idx + this.direction + this.players.length) % this.players.length;
    let attempts = 0;
    while (this.players[next].isOut && attempts < this.players.length) {
      next = (next + this.direction + this.players.length) % this.players.length;
      attempts++;
    }
    return next;
  }

  replenishDrawPile() {
    if (this.drawPile.length > 0) return;
    const top = this.discardPile.pop();
    this.drawPile = shuffle(this.discardPile);
    this.discardPile = [top];
  }

  canPlay(card) {
    const topFace = this.face(this.discardPile[this.discardPile.length - 1]);
    const cardFace = this.face(card);
    if (this.pendingDraw > 0) {
      if (cardFace.type === 'draw1' || cardFace.type === 'draw5') return true;
      if (cardFace.type === 'wild2') return 2 >= this.lastDrawValue;
      return false;
    }
    if (cardFace.type === 'wild' || cardFace.type === 'wild2' || cardFace.type === 'flip') return true;
    if (cardFace.color === this.currentColor) return true;
    if (cardFace.type === 'number' && cardFace.value === topFace.value && topFace.type === 'number') return true;
    if (cardFace.type === topFace.type && cardFace.type !== 'number') return true;
    return false;
  }

  playCard(playerId, cardIndex, chosenColor) {
    if (this.state !== 'playing') return { error: '游戏未进行中' };
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isOut) return { error: '无效的玩家' };
    if (this.players.indexOf(player) !== this.currentPlayerIndex) return { error: '不是你的回合' };
    if (cardIndex < 0 || cardIndex >= player.hand.length) return { error: '无效的牌' };
    const card = player.hand[cardIndex];
    const cardFace = this.face(card);
    if (!this.canPlay(card)) return { error: '这张牌不能出' };

    player.hand.splice(cardIndex, 1);

    if (cardFace.type === 'wild' || cardFace.type === 'wild2' || cardFace.type === 'flip') {
      if (!chosenColor || ![...LIGHT_COLORS, ...DARK_COLORS].includes(chosenColor)) {
        player.hand.push(card);
        return { error: '请选择一种颜色' };
      }
      this.currentColor = chosenColor;
    } else {
      this.currentColor = cardFace.color;
    }

    this.discardPile.push(card);
    this.lastAction = { type: 'play', playerId, card: cardFace };

    this.players.forEach(p => { if (!p.isOut) p.calledUno = false; });

    const handEmpty = player.hand.length === 0;

    if (cardFace.type === 'flip') {
      this.currentSuit = this.currentSuit === 'light' ? 'dark' : 'light';
      this.currentColor = this.face(card).color;
      this.currentPlayerIndex = this.nextPlayerIndex();
      if (handEmpty) { this.eliminatePlayer(player); return { success: true, eliminated: true, flipped: true }; }
      return { success: true, flipped: true };
    }

    const isDrawCard = cardFace.type === 'draw1' || cardFace.type === 'draw5' || cardFace.type === 'wild2';

    if (isDrawCard) {
      const drawValue = cardFace.type === 'draw5' ? 5 : (cardFace.type === 'wild2' ? 2 : 1);
      this.pendingDraw += drawValue;
      this.lastDrawValue = drawValue;
      this.currentPlayerIndex = this.nextPlayerIndex();
    } else if (cardFace.type === 'skip') {
      this.currentPlayerIndex = this.nextPlayerIndex();
      this.currentPlayerIndex = this.nextPlayerIndex();
    } else if (cardFace.type === 'reverse') {
      const active = this.players.filter(p => !p.isOut);
      if (active.length === 2) {
        this.currentPlayerIndex = this.nextPlayerIndex();
        this.currentPlayerIndex = this.nextPlayerIndex();
      } else {
        this.direction *= -1;
        this.currentPlayerIndex = this.nextPlayerIndex();
      }
    } else {
      this.currentPlayerIndex = this.nextPlayerIndex();
    }

    if (handEmpty) {
      this.eliminatePlayer(player);
      return { success: true, eliminated: true };
    }

    const nextP = this.players[this.currentPlayerIndex];
    if (nextP && nextP.isOut) this.currentPlayerIndex = this.nextPlayerIndex();
    return { success: true };
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
    this.currentPlayerIndex = this.nextPlayerIndex();
    this.lastAction = { type: 'accept_draw', playerId, drawn: count };
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
    if (this.canPlay(drawn)) return { success: true, card: this.face(drawn), canPlayNow: true };
    this.currentPlayerIndex = this.nextPlayerIndex();
    this.players.forEach(p => { if (!p.isOut) p.calledUno = false; });
    return { success: true, card: this.face(drawn) };
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
    this.rankings.push({ playerId: player.id, username: player.username, rank: this.rankings.length + 1 });
    const remaining = this.players.filter(p => !p.isOut);
    if (remaining.length === 1) {
      this.rankings.push({ playerId: remaining[0].id, username: remaining[0].username, rank: this.rankings.length + 1 });
      this.state = 'finished'; this.winner = remaining[0];
      return;
    }
    if (playerIndex === this.currentPlayerIndex) this.currentPlayerIndex = this.nextPlayerIndex();
  }

  getPublicState(playerId) {
    return {
      mode: 'flip',
      state: this.state,
      currentSuit: this.currentSuit,
      players: this.players.map(p => ({
        id: p.id, username: p.username, cardCount: p.hand.length,
        calledUno: p.calledUno, isOut: p.isOut,
        hand: p.id === playerId ? p.hand : undefined,
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      direction: this.direction,
      currentColor: this.currentColor,
      topCard: this.discardPile.length > 0 ? this.face(this.discardPile[this.discardPile.length - 1]) : null,
      topFlipCard: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      discardCount: this.discardPile.length,
      drawPileCount: this.drawPile.length,
      pendingDraw: this.pendingDraw,
      lastDrawValue: this.lastDrawValue,
      rankings: this.rankings,
      activeCount: this.players.filter(p => !p.isOut).length,
      lastAction: this.lastAction,
    };
  }
}
