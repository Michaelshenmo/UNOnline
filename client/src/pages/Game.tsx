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
  const [showPlayPrompt, setShowPlayPrompt] = useState(false);
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectators, setSpectators] = useState<{ id: number; username: string }[]>([]);
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
      s.once('authenticated', () => { s.emit('get_room_state'); });
    } else {
      s.emit('get_room_state');
    }

    s.on('game_state', (state: GameState) => {
      setGameState(state); setDirection(state.direction);
      const m = state.players.find(p => p.id === user?.id);
      if (m?.hand) setMyHand(m.hand);
      setError('');
      setShowUnoButton(m ? m.cardCount === 1 && !m.calledUno : false);
      setIsSpectator(!m && state.state !== 'waiting');
    });

    s.on('room_info', ({ room }: { room: Room }) => setRoomInfo(room));
    s.on('game_started', (data: { gameState: GameState }) => {
      setGameState(data.gameState); setDirection(data.gameState.direction);
      const m = data.gameState.players.find((p: any) => p.id === user?.id);
      if (m?.hand) setMyHand(m.hand);
    });
    s.on('player_joined', ({ room }: { room: any }) => setRoomInfo(room));
    s.on('player_left', ({ room }: { room: any }) => { if (room) setRoomInfo(room); });
    s.on('game_over', (data: { rankings: any[] }) => { setGameOver(true); setRankings(data.rankings); });
    s.on('room_disbanded', () => setKicked(true));
    s.on('draw_playable', ({ card }: { card: Card }) => {
      setDrawnCard(card);
      setShowPlayPrompt(true);
    });

    s.on('spectator_info', ({ spectators: list }: { spectators: { id: number; username: string }[] }) => {
      setSpectators(list);
      if (list.some(s => s.id === user?.id)) setIsSpectator(true);
    });

    s.on('error', ({ message }: { message: string }) => setError(message));

    return () => {
      s.off('game_state'); s.off('room_info'); s.off('game_started');
      s.off('player_joined'); s.off('player_left');
      s.off('game_over'); s.off('room_disbanded'); s.off('draw_playable'); s.off('error');
    };
  }, [token, user?.id]);

  function startGame() { getSocket().emit('start_game'); }
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
    if (card.type === 'wild' || card.type === 'wild4') { setPendingCardIndex(index); setShowColorPicker(true); return; }
    getSocket().emit('play_card', { cardIndex: index });
  }
  function acceptDraw() { getSocket().emit('accept_draw'); }
  function handleColorPick(color: string) {
    setShowColorPicker(false);
    if (pendingCardIndex !== null) { getSocket().emit('play_card', { cardIndex: pendingCardIndex, color }); setPendingCardIndex(null); }
  }
  function drawCard() { if (isMyTurn) { setShowPlayPrompt(false); getSocket().emit('draw_card'); } }
  function declineDrawnCard() { setShowPlayPrompt(false); setDrawnCard(null); getSocket().emit('decline_play'); }
  function playDrawnCard() {
    if (!drawnCard) return;
    setShowPlayPrompt(false); setDrawnCard(null);
    const idx = myHand.length - 1;
    if (idx >= 0) handlePlayCard(idx);
  }
  function callUno() { getSocket().emit('call_uno'); setShowUnoButton(false); }
  function leaveGame() { getSocket().emit('leave_room'); navigate('/lobby'); }

  const colorDot = (c: string | null) => {
    if (!c) return null;
    const bg = c === 'red' ? '#e53935' : c === 'yellow' ? '#fdd835' : c === 'green' ? '#43a047' : '#1e88e5';
    return <div style={{ width: 16, height: 16, borderRadius: 4, background: bg, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block', verticalAlign: 'middle' }} />;
  };

  if (kicked) return (
    <div className="kicked-overlay">
      <div className="kicked-dialog">
        <h2>房间已解散</h2>
        <p>房主已离开或房间已被关闭</p>
        <md-filled-button style={{ minWidth: 140 }} onClick={() => navigate('/lobby')}>返回大厅</md-filled-button>
      </div>
    </div>
  );

  if (gameOver) return (
    <div className="kicked-overlay">
      <div className="kicked-dialog">
        <h2>🎉 游戏结束！</h2>
        <div style={{ textAlign: 'left', margin: '16px 0' }}>
          {rankings.map((r, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #333', fontSize: 15 }}>
              <strong>第{r.rank}名</strong> - {r.nickname || r.username}
            </div>
          ))}
        </div>
        <md-filled-button style={{ minWidth: 140 }} onClick={() => navigate('/lobby')}>返回大厅</md-filled-button>
      </div>
    </div>
  );

  if (!gameState && !roomInfo) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <md-circular-progress indeterminate></md-circular-progress>
      <span style={{ color: '#aaa' }}>加载中...</span>
    </div>
  );

  const topCard = gameState?.topCard;

  return (
    <div className="game-page">
      {/* Top bar */}
      <div className="game-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <md-outlined-button style={{ minWidth: 100 }} onClick={leaveGame}>
            <md-icon slot="icon">exit_to_app</md-icon>
            退出
          </md-outlined-button>
          <span style={{ fontSize: 13, color: '#aaa' }}>房间 #{roomId}</span>
        </div>
        {gameState && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#aaa' }}>
            <span>方向: {direction === 1 ? '顺时针 →' : '逆时针 ←'}</span>
            {gameState.currentColor && <span>{colorDot(gameState.currentColor)} 当前颜色</span>}
            <span>牌堆: {gameState.drawPileCount}张</span>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="game-players">
        {(gameState?.players || players).map((p, i) => (
          <div key={p.id} className={`player-badge ${gameState && i === gameState.currentPlayerIndex ? 'active' : 'inactive'} ${(p as any).isOut ? 'out' : ''}`}>
            <div className="name">
              {(p as any).nickname || p.username} {p.id === user?.id ? '(你)' : ''}
              {(p as any).calledUno && (p as any).cardCount === 1 ? <span className="uno-tag">UNO!</span> : ''}
              {(p as any).status === 'banned' ? <span style={{ background: '#d32f2f', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>封禁</span> : ''}
            </div>
            <div className="meta">
              {gameState ? ((p as any).isOut ? '已出局' : `${(p as any).cardCount} 张牌`) : '等待中'}
              {gameState && p.id === gameState.players[gameState.currentPlayerIndex]?.id && !(p as any).isOut ? ' ⬅' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Rank notification for eliminated player */}
      {gameState && me?.isOut && gameState.state !== 'finished' && (
        <div style={{ textAlign: 'center', padding: '6px 0', color: '#ffd54f', fontSize: 14, fontWeight: 500 }}>
          🏆 你获得了第 {gameState.rankings.find(r => r.playerId === user?.id)?.rank || '?'} 名！观战中...
        </div>
      )}

      {/* Spectator indicator */}
      {isSpectator && gameState && gameState.state !== 'finished' && (
        <div style={{ textAlign: 'center', padding: '4px 0', color: '#aaa', fontSize: 13, fontStyle: 'italic' }}>
          🎥 观战模式
        </div>
      )}

      {/* Spectator list on the left */}
      {spectators.length > 0 && (
        <div style={{ position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'var(--md-sys-color-surface)', borderRadius: 12, padding: 10, boxShadow: 'var(--md-elevation-level2)', zIndex: 50, minWidth: 100 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, textAlign: 'center' }}>观战 ({spectators.length})</div>
          {spectators.map(s => (
            <div key={s.id} style={{ fontSize: 12, color: '#ccc', padding: '2px 0', textAlign: 'center' }}>{s.nickname || s.username}</div>
          ))}
        </div>
      )}

      {/* Center */}
      <div className="game-center">
        {gameState ? (
          <>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <div onClick={canDraw ? drawCard : undefined}
                style={{
                  width: CARD_WIDTH, height: CARD_WIDTH * 1.4,
                  background: 'linear-gradient(135deg, #333, #555)',
                  borderRadius: 8, display: 'flex', justifyContent: 'center', alignItems: 'center',
                  cursor: canDraw ? 'pointer' : 'default',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.1)',
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              {isStacking && isMyTurn && (
                <md-filled-button onClick={acceptDraw} style={{ minWidth: 160, '--md-sys-color-primary': '#ef5350' } as any}>
                  <md-icon slot="icon">download</md-icon>
                  接受加牌 ({pendingDraw}张)
                </md-filled-button>
              )}
              {showUnoButton && (
                <md-filled-button onClick={callUno} style={{ minWidth: 120, fontSize: 18 }}>
                  🗣️ UNO!
                </md-filled-button>
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
              <md-filled-button onClick={startGame} style={{ minWidth: 200, fontSize: 16, height: 48 }}>
                开始游戏 ({players.length} 人)
              </md-filled-button>
            ) : (
              <div>
                <h3 style={{ marginBottom: 8, fontWeight: 500 }}>等待房主开始游戏...</h3>
                <p style={{ color: '#aaa', fontSize: 13 }}>当前 {players.length} 人已加入</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* My hand */}
      {gameState && !isSpectator && (
        <div className="game-hand">
          <div className="game-hand-label">
            你的手牌 ({myHand.length}张)
            {isMyTurn && isStacking ? '- 出加牌(+2/+4)堆叠 或 点击"接受加牌"'
              : isMyTurn ? '- 点击出牌'
              : '- 等待你的回合'}
          </div>
          <PlayerHand cards={myHand} onPlayCard={handlePlayCard} disabled={!isMyTurn} />
        </div>
      )}

      {/* Draw playable prompt */}
      {showPlayPrompt && drawnCard && (
        <div className="color-picker-overlay">
          <div className="color-picker-dialog" style={{ maxWidth: 360 }}>
            <h3 style={{ marginBottom: 12, fontWeight: 500, fontSize: 16 }}>抽到了可出的牌！</h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <CardComponent card={drawnCard} />
            </div>
            <p style={{ color: '#ccc', fontSize: 13, marginBottom: 16 }}>是否要打出这张牌？</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <md-filled-button style={{ minWidth: 100 }} onClick={playDrawnCard}>出牌</md-filled-button>
              <md-outlined-button style={{ minWidth: 100 }} onClick={declineDrawnCard}>不出</md-outlined-button>
            </div>
          </div>
        </div>
      )}

      {/* Color picker */}
      {showColorPicker && (
        <div className="color-picker-overlay" onClick={() => setShowColorPicker(false)}>
          <div className="color-picker-dialog" onClick={(e) => e.stopPropagation()}>
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
