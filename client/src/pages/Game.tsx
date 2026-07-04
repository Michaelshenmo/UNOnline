import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GameState, Card, Room } from '../types';
import CardComponent from '../components/Card';
import PlayerHand from '../components/PlayerHand';
import { getSocket } from '../socket';

const CARD_WIDTH = 90;

export default function Game() {
  const { roomId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomInfo, setRoomInfo] = useState<Room | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCardIndex, setPendingCardIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [rankings, setRankings] = useState<any[]>([]);
  const [kicked, setKicked] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showUnoButton, setShowUnoButton] = useState(false);
  const hasJoined = useRef(false);

  const isMyTurn = gameState ? gameState.players[gameState.currentPlayerIndex]?.id === user?.id : false;
  const me = gameState?.players.find(p => p.id === user?.id);
  const isHost = roomInfo ? roomInfo.hostId === user?.id : false;
  const players = roomInfo?.players || [];
  const pendingDraw = gameState?.pendingDraw ?? 0;
  const isStacking = pendingDraw > 0;
  const canDraw = isMyTurn && !isStacking;

  useEffect(() => {
    const s = getSocket();
    if (!token) return;

    if (!hasJoined.current) {
      hasJoined.current = true;
      s.emit('authenticate', token);
      s.once('authenticated', () => {
        s.emit('get_room_state');
      });
    } else {
      s.emit('get_room_state');
    }

    s.on('game_state', (state: GameState) => {
      setGameState(state);
      setDirection(state.direction);
      const me = state.players.find(p => p.id === user?.id);
      if (me?.hand) setMyHand(me.hand);
      setError('');

      if (me && me.cardCount === 1 && !me.calledUno) {
        setShowUnoButton(true);
      } else {
        setShowUnoButton(false);
      }
    });

    s.on('room_info', ({ room }: { room: Room }) => {
      setRoomInfo(room);
    });

    s.on('game_started', (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setDirection(data.gameState.direction);
      const me = data.gameState.players.find((p: any) => p.id === user?.id);
      if (me?.hand) setMyHand(me.hand);
    });

    s.on('player_joined', ({ room }: { room: any }) => {
      setRoomInfo(room);
    });

    s.on('player_left', ({ room }: { room: any }) => {
      if (room) setRoomInfo(room);
    });

    s.on('game_over', (data: { rankings: any[] }) => {
      setGameOver(true);
      setRankings(data.rankings);
    });

    s.on('room_disbanded', () => {
      setKicked(true);
    });

    s.on('error', ({ message }: { message: string }) => setError(message));

    return () => {
      s.off('game_state');
      s.off('room_info');
      s.off('game_started');
      s.off('player_joined');
      s.off('player_left');
      s.off('game_over');
      s.off('room_disbanded');
      s.off('error');
    };
  }, [token, user?.id]);

  function startGame() {
    getSocket().emit('start_game');
  }

  function getDrawValue(card: Card): number {
    if (card.type === 'draw2') return 2;
    if (card.type === 'wild4') return 4;
    return 0;
  }

  function isStackable(card: Card): boolean {
    const lastVal = gameState?.lastDrawValue ?? 0;
    if (card.type === 'draw2') return 2 >= lastVal;
    if (card.type === 'wild4') return 4 >= lastVal;
    return false;
  }

  function handlePlayCard(index: number) {
    if (!isMyTurn) return;
    const card = myHand[index];
    if (!card) return;

    if (isStacking && !isStackable(card)) return;

    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingCardIndex(index);
      setShowColorPicker(true);
      return;
    }

    getSocket().emit('play_card', { cardIndex: index });
  }

  function acceptDraw() {
    getSocket().emit('accept_draw');
  }

  function handleColorPick(color: string) {
    setShowColorPicker(false);
    if (pendingCardIndex !== null) {
      getSocket().emit('play_card', { cardIndex: pendingCardIndex, color });
      setPendingCardIndex(null);
    }
  }

  function drawCard() {
    if (!isMyTurn) return;
    getSocket().emit('draw_card');
  }

  function callUno() {
    getSocket().emit('call_uno');
    setShowUnoButton(false);
  }

  function leaveGame() {
    getSocket().emit('leave_room');
    navigate('/lobby');
  }

  function getCardLabel(card: Card): string {
    switch (card.type) {
      case 'number': return card.value || '';
      case 'skip': return '⊘';
      case 'reverse': return '⟳';
      case 'draw2': return '+2';
      case 'wild': return '★';
      case 'wild4': return '+4';
    }
  }

  if (kicked) {
    return (
      <div className="kicked-overlay">
        <div className="kicked-box">
          <h2>房间已解散</h2>
          <p>房主已离开或房间已被关闭</p>
          <button className="btn-primary" onClick={() => navigate('/lobby')}>返回大厅</button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="kicked-overlay">
        <div className="kicked-box">
          <h2>🎉 游戏结束！</h2>
          <div style={{ textAlign: 'left', margin: '16px 0' }}>
            {rankings.map((r, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #333', fontSize: 15 }}>
                <strong>第{r.rank}名</strong> - {r.username}
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => navigate('/lobby')}>返回大厅</button>
        </div>
      </div>
    );
  }

  if (!gameState && !roomInfo) {
    return (
      <div className="lobby-page" style={{ textAlign: 'center', paddingTop: 100 }}>
        <h2>加载中...</h2>
      </div>
    );
  }

  const topCard = gameState?.topCard;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-secondary btn-small" onClick={leaveGame}>退出游戏</button>
          <span style={{ fontSize: 13, color: '#aaa' }}>房间 #{roomId}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {gameState && (
            <>
              <span style={{ fontSize: 13, color: '#aaa' }}>方向: {direction === 1 ? '顺时针 →' : '逆时针 ←'}</span>
              {gameState.currentColor && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 13, color: '#aaa' }}>当前颜色:</span>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: gameState.currentColor === 'red' ? '#e53935' :
                                gameState.currentColor === 'yellow' ? '#fdd835' :
                                gameState.currentColor === 'green' ? '#43a047' :
                                gameState.currentColor === 'blue' ? '#1e88e5' : '#333',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }} />
                </div>
              )}
              <span style={{ fontSize: 13, color: '#aaa' }}>牌堆: {gameState.drawPileCount}张</span>
            </>
          )}
        </div>
      </div>

      {/* Players */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 12,
      }}>
        {(gameState?.players || players).map((p, i) => (
          <div key={p.id} style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: gameState && i === gameState.currentPlayerIndex ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
            border: gameState && i === gameState.currentPlayerIndex ? '2px solid #ffd54f' : '2px solid transparent',
            fontSize: 13,
            textAlign: 'center',
            opacity: (p as any).isOut ? 0.4 : 1,
          }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {p.username} {p.id === user?.id ? '(你)' : ''}
              {(p as any).calledUno && (p as any).cardCount === 1 ? <span style={{ color: '#ffd54f', marginLeft: 4 }}>UNO!</span> : ''}
            </div>
            <div style={{ color: '#aaa', fontSize: 12 }}>
              {gameState ? (
                (p as any).isOut ? '已出局' : `${(p as any).cardCount} 张牌`
              ) : (
                '等待中'
              )}
              {gameState && p.id === gameState.players[gameState.currentPlayerIndex]?.id && !(p as any).isOut ? ' ⬅' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Center area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {gameState ? (
          <>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <div
                onClick={canDraw ? drawCard : undefined}
                style={{
                  width: CARD_WIDTH,
                  height: CARD_WIDTH * 1.4,
                  background: 'linear-gradient(135deg, #333, #555)',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: canDraw ? 'pointer' : 'default',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  fontSize: 36, fontWeight: 'bold', color: '#888',
                  transition: 'transform 0.2s',
                }}
                title={canDraw ? '点击抽牌' : ''}
              >UNO</div>
              {topCard && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>弃牌堆</span>
                  <CardComponent card={topCard} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              {isStacking && isMyTurn && (
                <button className="btn-danger" onClick={acceptDraw} style={{ fontSize: 16, padding: '10px 20px' }}>
                  接受加牌 ({pendingDraw}张)
                </button>
              )}
              {showUnoButton && (
                <button className="btn-primary" onClick={callUno} style={{ fontSize: 20, padding: '12px 24px' }}>
                  🗣️ UNO!
                </button>
              )}
              {error && <div style={{ color: '#ef5350', fontSize: 13 }}>{error}</div>}
            </div>
            {isStacking && (
              <div style={{ color: '#ffd54f', fontSize: 13, textAlign: 'center' }}>
                加牌堆叠中: 累计 {pendingDraw} 张 | 当前值: +{gameState?.lastDrawValue}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {isHost ? (
              <button className="btn-success" onClick={startGame} style={{ fontSize: 18, padding: '14px 32px' }}>
                开始游戏 ({players.length} 人)
              </button>
            ) : (
              <div>
                <h3 style={{ marginBottom: 8 }}>等待房主开始游戏...</h3>
                <p style={{ color: '#aaa', fontSize: 13 }}>当前 {players.length} 人已加入</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* My hand */}
      {gameState && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
          <div style={{ textAlign: 'center', fontSize: 13, color: '#aaa', marginBottom: 4 }}>
            你的手牌 ({myHand.length}张)
            {isMyTurn && isStacking ? '- 出加牌(+2/+4)堆叠 或 点击"接受加牌"'
              : isMyTurn ? '- 点击出牌'
              : '- 等待你的回合'}
          </div>
          <PlayerHand cards={myHand} onPlayCard={handlePlayCard} disabled={!isMyTurn} />
        </div>
      )}

      {showColorPicker && (
        <div className="color-picker-overlay" onClick={() => setShowColorPicker(false)}>
          <div className="color-picker" onClick={(e) => e.stopPropagation()}>
            <h3>选择颜色</h3>
            <div className="color-options">
              <div className="color-option red" onClick={() => handleColorPick('red')} />
              <div className="color-option yellow" onClick={() => handleColorPick('yellow')} />
              <div className="color-option green" onClick={() => handleColorPick('green')} />
              <div className="color-option blue" onClick={() => handleColorPick('blue')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
