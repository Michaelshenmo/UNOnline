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
  const [closing, setClosing] = useState(false);
  const [closingPicker, setClosingPicker] = useState(false);
  const [closingPrompt, setClosingPrompt] = useState(false);
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [showWheelDraw, setShowWheelDraw] = useState(false);
  const [showZeroConfirm, setShowZeroConfirm] = useState(false);
  const [swapNotice, setSwapNotice] = useState<any>(null);
  const [spectators, setSpectators] = useState<{ id: number; username: string }[]>([]);
  const [adminTarget, setAdminTarget] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [kickedInfo, setKickedInfo] = useState<string | null>(null);
  const [currentSuit, setCurrentSuit] = useState<'light' | 'dark'>('light');
  const [previewFlip, setPreviewFlip] = useState(false);
  const [gameMode, setGameMode] = useState<string>('standard');
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
      setCurrentSuit(state.currentSuit || 'light');
      if (state.mode) setGameMode(state.mode);
      const m = state.players.find(p => p.id === user?.id);
      if (m?.hand) setMyHand(m.hand);
      setError('');
      setShowUnoButton(m ? m.cardCount === 1 && !m.calledUno : false);
      setIsSpectator(!m && state.state !== 'waiting');
      if (state.pendingAction?.type === 'swap' && state.pendingAction.playerId === user?.id) setShowSwapPicker(true);
      else setShowSwapPicker(false);
      if (state.pendingAction?.type === 'wheel' && state.pendingAction.playerId === user?.id) setShowWheelDraw(true);
      else setShowWheelDraw(false);
      if (state.pendingAction?.type === 'zero' && state.pendingAction.playerId === user?.id) setShowZeroConfirm(true);
      else setShowZeroConfirm(false);
      if (state.lastAction?.type === 'swap') setSwapNotice(state.lastAction);
      else if (state.lastAction?.type === 'pass') setSwapNotice(state.lastAction);
      else if (state.lastAction?.type === 'burst') setSwapNotice(state.lastAction);
      else setSwapNotice(null);
    });

    s.on('room_info', ({ room }: { room: Room }) => { setRoomInfo(room); if (room.gameMode) setGameMode(room.gameMode); });
    s.on('game_mode_changed', ({ mode }: { mode: string }) => { setGameMode(mode); });
    s.on('flip_color_needed', () => { setShowColorPicker(true); });
    s.on('game_started', (data: { gameState: GameState }) => {
      setGameState(data.gameState); setDirection(data.gameState.direction);
      setCurrentSuit(data.gameState.currentSuit || 'light');
      if (data.gameState.mode) setGameMode(data.gameState.mode);
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

    s.on('kicked', () => { setKickedInfo('kicked'); });
    s.on('banned', () => { setKickedInfo('banned'); });
    s.on('converted_to_spectator', () => { setKickedInfo('converted'); setIsSpectator(true); });

    s.on('spectator_info', ({ spectators: list }: { spectators: { id: number; username: string }[] }) => {
      setSpectators(list);
      if (list.some(s => s.id === user?.id)) setIsSpectator(true);
    });

    s.on('error', ({ message }: { message: string }) => setError(message));

    return () => {
      s.off('game_state'); s.off('room_info'); s.off('game_started');
      s.off('player_joined'); s.off('player_left');
      s.off('game_over'); s.off('room_disbanded'); s.off('draw_playable'); s.off('error'); s.off('game_mode_changed'); s.off('flip_color_needed');
    };
  }, [token, user?.id]);

  function setMode(mode: string) {
    setGameMode(mode);
    getSocket().emit('set_game_mode', { mode });
  }
  function startGame() { getSocket().emit('start_game', { mode: gameMode }); }
  function cardFace(card: any) {
    if (!card) return null;
    return card.light ? (currentSuit === 'light' ? card.light : card.dark) : card;
  }
  function isStackable(card: any): boolean {
    const face = cardFace(card);
    if (!face) return false;
    const lastVal = gameState?.lastDrawValue ?? 0;
    const drawVals: any = { draw2: 2, draw4: 4, draw1: 1, draw5: 5, wild4: 4, wild2: 2, wild_rev4: 4, wild6: 6, wild10: 10 };
    const val = drawVals[face.type];
    if (val) return val >= lastVal;
    return false;
  }
  function handlePlayCard(index: number) {
    if (!isMyTurn) return;
    const card = myHand[index];
    if (!card) return;
    const face = cardFace(card);
    if (!face) return;
    if (isStacking && !isStackable(card)) return;
    if (['wild', 'wild2', 'wild4', 'wild_rev4', 'wild6', 'wild10', 'wild_wheel'].includes(face.type)) { setPendingCardIndex(index); setShowColorPicker(true); return; }
    getSocket().emit('play_card', { cardIndex: index });
  }
  function acceptDraw() { getSocket().emit('accept_draw'); }
  function closeAnim(setClose: () => void) {
    setClosing(true); setTimeout(() => { setClosing(false); setClose(); }, 120);
  }
  function handleColorPick(color: string) {
    setClosingPicker(true);
    setTimeout(() => {
      setClosingPicker(false); setShowColorPicker(false);
      if (pendingCardIndex !== null) { getSocket().emit('play_card', { cardIndex: pendingCardIndex, color }); setPendingCardIndex(null); }
      else getSocket().emit('choose_flip_color', { color });
    }, 120);
  }
  function drawCard() { if (isMyTurn) { setShowPlayPrompt(false); getSocket().emit('draw_card'); } }
  function declineDrawnCard() { setClosingPrompt(true); setTimeout(() => { setClosingPrompt(false); setShowPlayPrompt(false); setDrawnCard(null); getSocket().emit('decline_play'); }, 120); }
  function playDrawnCard() {
    if (!drawnCard) return;
    setClosingPrompt(true);
    setTimeout(() => {
      setClosingPrompt(false); setShowPlayPrompt(false); setDrawnCard(null);
      const idx = myHand.length - 1;
      if (idx >= 0) handlePlayCard(idx);
    }, 120);
  }
  function callUno() { getSocket().emit('call_uno'); setShowUnoButton(false); }
  function leaveGame() { getSocket().emit('leave_room'); navigate('/lobby'); }

  const isAdmin = user?.role === 'admin';
  function openAdminDialog(target: any) { setAdminTarget(target); setConfirmAction(null); }
  function doKick() { if (!adminTarget) return; getSocket().emit('kick_player', { targetId: adminTarget.id }); setAdminTarget(null); setConfirmAction(null); }
  function doBan() { if (!adminTarget) return; getSocket().emit('ban_player', { targetId: adminTarget.id }); setAdminTarget(null); setConfirmAction(null); }
  function chooseSwapTarget(targetId: number) { getSocket().emit('choose_swap_target', { targetId }); setShowSwapPicker(false); }
  function drawWheelCard() { getSocket().emit('draw_wheel_card'); }
  function confirmZeroPlay() { getSocket().emit('confirm_zero'); setShowZeroConfirm(false); }
  function cancelZeroPlay() { setShowZeroConfirm(false); getSocket().emit('cancel_pending_action'); }

  const colorDot = (c: string | null) => {
    if (!c) return null;
    const bg = c === 'red' ? '#e53935' : c === 'yellow' ? '#fdd835' : c === 'green' ? '#43a047' : c === 'blue' ? '#1e88e5'
      : c === 'orange' ? '#ff6d00' : c === 'purple' ? '#aa00ff' : c === 'pink' ? '#e91e88' : c === 'teal' ? '#00bcd4' : '#888';
    return <div style={{ width: 16, height: 16, borderRadius: 4, background: bg, border: '1px solid rgba(255,255,255,0.3)', display: 'inline-block', verticalAlign: 'middle' }} />;
  };

  if (kickedInfo) return (
    <div className="kicked-overlay">
      <div className="kicked-dialog">
        <h2>连接已丢失</h2>
        <p>{kickedInfo === 'banned' ? '你已被管理员封禁' : '你已被管理员踢出游戏'}</p>
        <md-filled-button style={{ minWidth: 140 }} onClick={() => { setKickedInfo(null); navigate('/lobby'); }}>返回大厅</md-filled-button>
      </div>
    </div>
  );
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
        <h2><md-icon style={{ fontSize: 24, verticalAlign: 'middle', marginRight: 6 }}>celebration</md-icon> 游戏结束！</h2>
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
            {gameMode === 'flip' && <span><md-icon style={{ fontSize: 14, verticalAlign: 'middle', color: currentSuit === 'light' ? '#fff' : '#888' }}>{currentSuit === 'light' ? 'light_mode' : 'dark_mode'}</md-icon> {currentSuit === 'light' ? '浅色面' : '深色面'}</span>}
            <span>牌堆: {gameState.drawPileCount}张</span>
            {gameMode === 'flip' && (
              <md-outlined-button style={{ minWidth: 120, height: 28, fontSize: 11, padding: '0 8px' }}
                onMouseDown={() => setPreviewFlip(true)}
                onMouseUp={() => setPreviewFlip(false)}
                onMouseLeave={() => setPreviewFlip(false)}
              >预览{currentSuit === 'light' ? '深色' : '浅色'}面</md-outlined-button>
            )}
          </div>
        )}
      </div>

      {/* Players */}
      <div className="game-players">
        {(gameState?.players || players).map((p, i) => (
          <div key={p.id} className={`player-badge ${gameState && i === gameState.currentPlayerIndex ? 'active' : 'inactive'} ${(p as any).isOut ? 'out' : ''}`}
            onClick={isAdmin && p.id !== user?.id ? () => openAdminDialog(p) : undefined}
            style={{ cursor: isAdmin && p.id !== user?.id ? 'pointer' : 'default' }}>
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
          <md-icon style={{ fontSize: 16, verticalAlign: 'middle', color: '#ffd54f' }}>emoji_events</md-icon> 你获得了第 {gameState.rankings.find(r => r.playerId === user?.id)?.rank || '?'} 名！观战中...
        </div>
      )}

      {/* Spectator indicator */}
      {isSpectator && gameState && gameState.state !== 'finished' && (
        <div style={{ textAlign: 'center', padding: '4px 0', color: '#aaa', fontSize: 13, fontStyle: 'italic' }}>
          <md-icon style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>visibility</md-icon> 观战模式
        </div>
      )}

      {/* Spectator list on the left */}
      {spectators.length > 0 && (
        <div style={{ position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'var(--md-sys-color-surface)', borderRadius: 12, padding: 10, boxShadow: 'var(--md-elevation-level2)', zIndex: 50, minWidth: 100 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, textAlign: 'center' }}>观战 ({spectators.length})</div>
          {spectators.map(s => (
            <div key={s.id} style={{ fontSize: 12, color: '#ccc', padding: '2px 0', textAlign: 'center', cursor: isAdmin && s.id !== user?.id ? 'pointer' : 'default' }}
              onClick={isAdmin && s.id !== user?.id ? () => openAdminDialog(s) : undefined}>
              {s.nickname || s.username}
            </div>
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
                  <CardComponent card={topCard} suit={currentSuit} previewFlip={previewFlip} />
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
                <md-filled-button onClick={callUno} style={{ minWidth: 120, fontSize: 16 }}>
                  <md-icon slot="icon">voice_chat</md-icon> UNO!
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 260 }}>
                  {gameMode === 'standard'
                    ? <md-filled-button style={{ width: '100%' }} onClick={() => setMode('standard')}>UNO Standard</md-filled-button>
                    : <md-outlined-button style={{ width: '100%' }} onClick={() => setMode('standard')}>UNO Standard</md-outlined-button>
                  }
                  {gameMode === 'flip'
                    ? <md-filled-button style={{ width: '100%' }} onClick={() => setMode('flip')}>UNO Flip</md-filled-button>
                    : <md-outlined-button style={{ width: '100%' }} onClick={() => setMode('flip')}>UNO Flip</md-outlined-button>
                  }
                  {gameMode === 'no-mercy'
                    ? <md-filled-button style={{ width: '100%' }} onClick={() => setMode('no-mercy')}>UNO No Mercy</md-filled-button>
                    : <md-outlined-button style={{ width: '100%' }} onClick={() => setMode('no-mercy')}>UNO No Mercy</md-outlined-button>
                  }
                </div>
                <md-filled-button onClick={startGame} style={{ minWidth: 200, fontSize: 16, height: 48 }} disabled={players.length < 2 || undefined}>
                  {players.length < 2 ? '至少需要2名玩家' : `开始游戏 (${players.length} 人)`}
                </md-filled-button>
              </div>
            ) : (
              <div>
                <h3 style={{ marginBottom: 8, fontWeight: 500 }}>等待房主开始游戏...</h3>
                <p style={{ color: '#aaa', fontSize: 13 }}>当前 {players.length} 人已加入 | 模式: {gameMode === 'flip' ? 'UNO Flip' : 'UNO Standard'}</p>
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
          <PlayerHand cards={myHand} onPlayCard={handlePlayCard} disabled={!isMyTurn} suit={currentSuit} previewFlip={previewFlip} />
        </div>
      )}

      {/* Draw playable prompt */}
      {showPlayPrompt && drawnCard && (
        <div className={`color-picker-overlay ${closingPrompt ? 'overlay-hidden' : ''}`}>
          <div className="color-picker-dialog" style={{ maxWidth: 360 }}>
            <h3 style={{ marginBottom: 12, fontWeight: 500, fontSize: 16 }}>抽到了可出的牌！</h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <CardComponent card={drawnCard} suit={currentSuit} previewFlip={previewFlip} />
            </div>
            <p style={{ color: '#ccc', fontSize: 13, marginBottom: 16 }}>是否要打出这张牌？</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <md-filled-button style={{ minWidth: 100 }} onClick={playDrawnCard}>出牌</md-filled-button>
              <md-outlined-button style={{ minWidth: 100 }} onClick={declineDrawnCard}>不出</md-outlined-button>
            </div>
          </div>
        </div>
      )}

      {/* Admin player info dialog */}
      {adminTarget && !confirmAction && (
        <div className={`color-picker-overlay ${closing ? 'overlay-hidden' : ''}`} onClick={() => closeAnim(() => setAdminTarget(null))}>
          <div className="color-picker-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, width: '90%', textAlign: 'left' }}>
            <h3 style={{ marginBottom: 16, textAlign: 'center' }}>玩家信息</h3>
            <div style={{ fontSize: 14, lineHeight: 2 }}>
              <div>UID: {adminTarget.id}</div>
              <div>用户名: {adminTarget.username}</div>
              <div>昵称: {(adminTarget as any).nickname || adminTarget.username}</div>
              <div>角色: {(adminTarget as any).isOut !== undefined ? ((adminTarget as any).isOut ? '已出局' : '游戏中') : '观战中'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
              <md-outlined-button style={{ minWidth: 100 }} onClick={() => setConfirmAction('kick')}>踢出</md-outlined-button>
              <md-outlined-button style={{ minWidth: 100, '--md-sys-color-primary': '#d32f2f' } as any} onClick={() => setConfirmAction('ban')}>封禁</md-outlined-button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <md-outlined-button style={{ minWidth: 80 }} onClick={() => setAdminTarget(null)}>取消</md-outlined-button>
            </div>
          </div>
        </div>
      )}

      {/* Admin confirmation dialog */}
      {confirmAction && (
        <div className={`color-picker-overlay ${closing ? 'overlay-hidden' : ''}`}>
          <div className="color-picker-dialog" style={{ maxWidth: 340 }}>
            <h3 style={{ marginBottom: 12 }}>确认操作</h3>
            <p style={{ color: '#ccc', fontSize: 14, marginBottom: 16 }}>
              {confirmAction === 'kick' ? '确定要踢出该玩家吗？' : '确定要封禁该玩家吗？'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <md-filled-button style={{ minWidth: 100 }} onClick={() => {
                if (confirmAction === 'kick') doKick();
                else doBan();
              }}>确认</md-filled-button>
              <md-outlined-button style={{ minWidth: 100 }} onClick={() => setConfirmAction(null)}>取消</md-outlined-button>
            </div>
          </div>
        </div>
      )}

      {/* Swap / burst notice */}
      {swapNotice && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--md-sys-color-surface)', padding: '10px 20px', borderRadius: 10, boxShadow: 'var(--md-elevation-level3)', zIndex: 80, fontSize: 13, color: swapNotice.type === 'burst' ? '#ef5350' : '#ffd54f', display: 'flex', alignItems: 'center', gap: 8, maxWidth: '80%' }}>
          <md-icon style={{ fontSize: 16 }}>{swapNotice.type === 'swap' ? 'swap_horiz' : swapNotice.type === 'burst' ? 'warning' : 'style'}</md-icon>
          {swapNotice.type === 'swap'
            ? (() => {
                const playerName = gameState?.players.find(p => p.id === swapNotice.playerId)?.username || '某玩家';
                const targetName = gameState?.players.find(p => p.id === swapNotice.targetId)?.username || '某玩家';
                if (swapNotice.playerId === user?.id) return `你打出了7，与 ${targetName} 交换了手牌`;
                if (swapNotice.targetId === user?.id) return `${playerName} 打出了7，与你交换了手牌`;
                return `${playerName} 打出了7，与 ${targetName} 交换了手牌`;
              })()
            : swapNotice.type === 'burst'
              ? (swapNotice.playerId === user?.id
                  ? `你的手牌数量达到 ${swapNotice.handCount}，超过阈值 ${swapNotice.threshold} 被淘汰`
                  : `${gameState?.players.find(p => p.id === swapNotice.playerId)?.username || '某玩家'} 手牌数量达到 ${swapNotice.handCount}，超过阈值 ${swapNotice.threshold} 被淘汰`)
              : `${gameState?.players.find(p => p.id === swapNotice.playerId)?.username || '某玩家'} 打出了0，所有玩家将手牌交给了下家`}
        </div>
      )}

      {/* 7-swap player picker */}
      {showSwapPicker && (
        <div className="color-picker-overlay">
          <div className="color-picker-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '90%' }}>
            <h3 style={{ marginBottom: 16 }}>选择交换手牌的玩家</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {gameState?.players.filter(p => !p.isOut && p.id !== user?.id).map(p => (
                <div key={p.id} onClick={() => chooseSwapTarget(p.id)}
                  style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{p.username}</span>
                  <span style={{ fontSize: 13, color: '#aaa' }}>{p.cardCount} 张牌</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <md-outlined-button style={{ minWidth: 80 }} onClick={() => { setShowSwapPicker(false); getSocket().emit('cancel_pending_action'); }}>取消</md-outlined-button>
            </div>
          </div>
        </div>
      )}

      {/* 0-pass confirmation dialog */}
      {showZeroConfirm && (
        <div className="color-picker-overlay">
          <div className="color-picker-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
            <h3 style={{ marginBottom: 12 }}>确认出牌</h3>
            <p style={{ color: '#ccc', fontSize: 14, marginBottom: 16 }}>打出 0 牌会导致所有玩家将手牌交给下一位玩家，确定要出吗？</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <md-filled-button style={{ minWidth: 100 }} onClick={confirmZeroPlay}>确认出牌</md-filled-button>
              <md-outlined-button style={{ minWidth: 100 }} onClick={cancelZeroPlay}>取消</md-outlined-button>
            </div>
          </div>
        </div>
      )}

      {/* Color wheel draw UI */}
      {showWheelDraw && (
        <div className="color-picker-overlay">
          <div className="color-picker-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 style={{ marginBottom: 12 }}>颜色轮盘</h3>
            <p style={{ color: '#ccc', fontSize: 13, marginBottom: 16 }}>连续抽牌，直到抽到所选颜色的牌（万能牌无效）</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <md-filled-button style={{ minWidth: 140 }} onClick={drawWheelCard}>
                <md-icon slot="icon">style</md-icon>
                抽一张牌
              </md-filled-button>
            </div>
          </div>
        </div>
      )}

      {/* Color picker */}
      {showColorPicker && (
        <div className={`color-picker-overlay ${closingPicker ? 'overlay-hidden' : ''}`} onClick={() => { setClosingPicker(true); setTimeout(() => { setClosingPicker(false); setShowColorPicker(false); }, 120); }}>
          <div className="color-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>选择颜色</h3>
            <div className="color-options">
              {gameMode === 'flip' && currentSuit === 'dark' ? (
                <>
                  <div className="color-option" style={{ background: '#ff6d00' }} onClick={() => handleColorPick('orange')} />
                  <div className="color-option" style={{ background: '#aa00ff' }} onClick={() => handleColorPick('purple')} />
                  <div className="color-option" style={{ background: '#e91e88' }} onClick={() => handleColorPick('pink')} />
                  <div className="color-option" style={{ background: '#00bcd4' }} onClick={() => handleColorPick('teal')} />
                </>
              ) : (
                <>
                  <div className="color-option red" onClick={() => handleColorPick('red')} />
                  <div className="color-option yellow" onClick={() => handleColorPick('yellow')} />
                  <div className="color-option green" onClick={() => handleColorPick('green')} />
                  <div className="color-option blue" onClick={() => handleColorPick('blue')} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
