import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Room, SystemSettings } from '../types';
import { getSocket } from '../socket';

export default function Lobby() {
  const { user, logout, isAdmin, token } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ id: number }[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [editSettings, setEditSettings] = useState<Record<string, string>>({ allow_registration: 'true' });
  const [error, setError] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showPwdDialog, setShowPwdDialog] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [adminPwdTarget, setAdminPwdTarget] = useState<{ id: number; username: string } | null>(null);
  const regSwitchRef = useRef<any>(null);

  const cuUsernameRef = useRef<any>(null);
  const cuPasswordRef = useRef<any>(null);
  const cuNicknameRef = useRef<any>(null);
  const cuRoleRef = useRef<any>(null);
  const maxPlayersRef = useRef<any>(null);
  const turnTimeoutRef = useRef<any>(null);
  const unoPenaltyRef = useRef<any>(null);
  const pwdOldRef = useRef<any>(null);
  const pwdNewRef = useRef<any>(null);
  const pwdConfirmRef = useRef<any>(null);
  const adminPwdNewRef = useRef<any>(null);
  const adminPwdConfirmRef = useRef<any>(null);
  const pwdDialogRef = useRef<any>(null);
  const adminPwdDialogRef = useRef<any>(null);

  useEffect(() => {
    const s = getSocket();
    if (token) {
      s.emit('authenticate', token);
    }

    s.on('rooms_update', (data: Room[]) => setRooms(data));
    s.on('online_users', (data: { id: number }[]) => setOnlineUsers(data));
    s.on('room_created', ({ room }: { room: Room & { id: string } }) => {
      navigate(`/game/${room.id}`);
    });
    s.on('room_joined', ({ room }: { room: Room & { id: string } }) => {
      navigate(`/game/${room.id}`);
    });
    s.on('error', ({ message }: { message: string }) => setError(message));

    fetchRooms();
    fetchOnlineUsers();

    return () => {
      s.off('rooms_update');
      s.off('online_users');
      s.off('room_created');
      s.off('room_joined');
      s.off('error');
    };
  }, [token, navigate]);

  function toggleReg() {
    setEditSettings(prev => ({ ...prev, allow_registration: prev.allow_registration === 'true' ? 'false' : 'true' }));
  }

  useEffect(() => {
    customElements.whenDefined('md-switch').then(() => {
      if (regSwitchRef.current) {
        regSwitchRef.current.selected = editSettings.allow_registration === 'true';
      }
    });
  }, [editSettings.allow_registration]);

  useEffect(() => {
    const el = pwdDialogRef.current;
    if (!el) return;
    if (showPwdDialog) el.showModal();
    else el.close();
  }, [showPwdDialog]);

  useEffect(() => {
    const el = adminPwdDialogRef.current;
    if (!el) return;
    if (adminPwdTarget) el.showModal();
    else el.close();
  }, [adminPwdTarget]);

  useEffect(() => {
    const el = pwdDialogRef.current;
    if (!el) return;
    const handler = () => setShowPwdDialog(false);
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  useEffect(() => {
    const el = adminPwdDialogRef.current;
    if (!el) return;
    const handler = () => setAdminPwdTarget(null);
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  async function fetchRooms() {
    try { setRooms(await api.getRooms()); } catch {}
  }

  async function fetchOnlineUsers() {
    try { setOnlineUsers(await api.getOnlineUsers()); } catch {}
  }

  function createRoom() {
    getSocket().emit('create_room');
  }

  function joinRoom(roomId: string) {
    getSocket().emit('join_room', { roomId });
  }

  async function loadAdminData() {
    try {
      setAdminUsers(await api.getUsers());
      const s = await api.getSettings();
      setSettings(s);
      setEditSettings(s);
    } catch (e: any) {
      setError(e.message || '加载管理数据失败');
    }
  }

  async function handleRoleChange(userId: number, role: string) {
    try {
      await api.updateUserRole(userId, role);
      loadAdminData();
    } catch {}
  }

  async function handleDeleteUser(userId: number) {
    if (!confirm('确定删除该用户？')) return;
    try {
      await api.deleteUser(userId);
      loadAdminData();
    } catch {}
  }

  async function handleSaveSettings() {
    const data: Record<string, string> = {};
    data.allow_registration = editSettings.allow_registration || 'true';
    if (maxPlayersRef.current?.value) data.max_players = maxPlayersRef.current.value;
    if (turnTimeoutRef.current?.value) data.turn_timeout = turnTimeoutRef.current.value;
    if (unoPenaltyRef.current?.value) data.uno_penalty = unoPenaltyRef.current.value;
    try {
      await api.updateSettings(data);
      const s = await api.getSettings();
      setSettings(s);
      setEditSettings(s);
    } catch (e: any) {
      setError(e.message || '保存设置失败');
    }
  }

  async function handleCreateUser() {
    setCreateError('');
    const username = cuUsernameRef.current?.value?.trim();
    const password = cuPasswordRef.current?.value;
    const nickname = cuNicknameRef.current?.value?.trim();
    const role = cuRoleRef.current?.value || 'player';
    if (!username || !password) { setCreateError('请填写用户名和密码'); return; }
    try {
      await api.createUser(username, password, nickname, role);
      setShowCreateUser(false);
      loadAdminData();
    } catch (err: any) {
      setCreateError(err.message);
    }
  }

  async function handleChangePassword() {
    setPwdError(''); setPwdSuccess('');
    const oldPwd = pwdOldRef.current?.value;
    const newPwd = pwdNewRef.current?.value;
    const confirmPwd = pwdConfirmRef.current?.value;
    if (!oldPwd || !newPwd) { setPwdError('请填写所有字段'); return; }
    if (newPwd.length < 6) { setPwdError('新密码至少6个字符'); return; }
    if (newPwd !== confirmPwd) { setPwdError('两次密码不一致'); return; }
    try {
      await api.changePassword(oldPwd, newPwd);
      setPwdSuccess('密码修改成功');
      setTimeout(() => { setShowPwdDialog(false); setPwdSuccess(''); }, 1500);
    } catch (err: any) { setPwdError(err.message); }
  }

  async function handleAdminResetPassword() {
    if (!adminPwdTarget) return;
    setPwdError(''); setPwdSuccess('');
    const newPwd = adminPwdNewRef.current?.value;
    const confirmPwd = adminPwdConfirmRef.current?.value;
    if (!newPwd) { setPwdError('请填写新密码'); return; }
    if (newPwd.length < 6) { setPwdError('新密码至少6个字符'); return; }
    if (newPwd !== confirmPwd) { setPwdError('两次密码不一致'); return; }
    try {
      await api.adminResetPassword(adminPwdTarget.id, newPwd);
      setPwdSuccess(`已重置用户 ${adminPwdTarget.username} 的密码`);
      setTimeout(() => { setAdminPwdTarget(null); setPwdSuccess(''); }, 1500);
    } catch (err: any) { setPwdError(err.message); }
  }

  const currentRoom = rooms.find(r => r.players.some(p => p.id === user?.id));

  return (
    <div className="lobby-page">
      <div className="lobby-topbar">
          <h1><md-icon style={{ fontSize: 24, color: '#e53935' }}>stadia_controller</md-icon> UNO Online</h1>
        <div className="topbar-actions">
          <span style={{ fontSize: 14, color: '#aaa' }}>{user?.nickname || user?.username}</span>
          {isAdmin && (
            <md-outlined-button style={{ minWidth: 100 }} onClick={() => { setShowAdmin(!showAdmin); if (!showAdmin) loadAdminData(); }}>
              {showAdmin ? '关闭管理' : '管理面板'}
            </md-outlined-button>
          )}
          <md-outlined-button style={{ minWidth: 100 }} onClick={() => { setShowPwdDialog(true); setPwdError(''); setPwdSuccess(''); }}>修改密码</md-outlined-button>
          <md-outlined-button style={{ minWidth: 80 }} onClick={logout}>退出</md-outlined-button>
        </div>
      </div>

      {error && <div style={{ background: '#c62828', color: '#fff', padding: '10px 16px', borderRadius: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {showAdmin && isAdmin ? (
        <div className="admin-panel section-card">
          <div className="admin-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}><md-icon>manage_accounts</md-icon> 用户管理</h3>
              <md-filled-button style={{ minWidth: 120 }} onClick={() => { setShowCreateUser(true); setCreateError(''); }}>
                <md-icon slot="icon">person_add</md-icon>
                创建用户
              </md-filled-button>
            </div>
            <table>
              <thead>
                <tr><th>ID</th><th>用户名</th><th>昵称</th><th>角色</th><th>注册时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                {adminUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.nickname}</td>
                    <td>
                      <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{ background: '#1e1e3a', color: '#fff', border: '1px solid #444', borderRadius: 4, padding: '4px 8px', fontSize: 13 }}>
                        <option value="player">玩家</option>
                        <option value="admin">管理员</option>
                      </select>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="actions">
                      <md-text-button onClick={() => { setAdminPwdTarget({ id: u.id, username: u.username }); setPwdError(''); setPwdSuccess(''); }}>重置密码</md-text-button>
                      <md-text-button onClick={() => handleDeleteUser(u.id)} disabled={u.id === user?.id || undefined}>删除</md-text-button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showCreateUser && (
            <div className="create-user-form">
              <h3 className="section-title"><md-icon>person_add</md-icon> 创建新用户</h3>
              <div className="form-row">
                <md-outlined-text-field ref={cuUsernameRef} label="用户名" type="text" required></md-outlined-text-field>
              </div>
              <div className="form-row">
                <md-outlined-text-field ref={cuPasswordRef} label="密码" type="password" required></md-outlined-text-field>
              </div>
              <div className="form-row">
                <md-outlined-text-field ref={cuNicknameRef} label="昵称" type="text"></md-outlined-text-field>
              </div>
              <div className="form-row">
                <md-outlined-select ref={cuRoleRef} value="player">
                  <md-select-option value="player"><div slot="headline">玩家</div></md-select-option>
                  <md-select-option value="admin"><div slot="headline">管理员</div></md-select-option>
                </md-outlined-select>
              </div>
              {createError && <div className="form-error">{createError}</div>}
              <div className="form-actions">
                <md-filled-button style={{ minWidth: 100 }} onClick={handleCreateUser}>创建</md-filled-button>
                <md-outlined-button style={{ minWidth: 100 }} onClick={() => setShowCreateUser(false)}>取消</md-outlined-button>
              </div>
            </div>
          )}

          <div className="admin-section">
            <h3 className="section-title"><md-icon>settings</md-icon> 系统设置</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={toggleReg}>
                <span style={{ fontSize: 14, color: '#ccc' }}>允许注册</span>
                <md-switch ref={regSwitchRef} selected={editSettings.allow_registration === 'true' || undefined}></md-switch>
              </div>
              <div>
                <md-outlined-text-field ref={maxPlayersRef} label="最大玩家数 (2-10)" type="number" value={editSettings.max_players || '4'}></md-outlined-text-field>
              </div>
              <div>
                <md-outlined-text-field ref={turnTimeoutRef} label="回合超时 (秒)" type="number" value={editSettings.turn_timeout || '30'}></md-outlined-text-field>
              </div>
              <div>
                <md-outlined-text-field ref={unoPenaltyRef} label="未喊UNO罚牌数" type="number" value={editSettings.uno_penalty || '2'}></md-outlined-text-field>
              </div>
              <div>
                <md-filled-button style={{ minWidth: 200 }} onClick={handleSaveSettings}>保存设置</md-filled-button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="lobby-content">
          <div className="section-card">
            <h3 className="section-title"><md-icon>meeting_room</md-icon> 游戏房间 ({rooms.length})</h3>
            {currentRoom ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ marginBottom: 16, color: '#aaa' }}>你已在房间中</p>
                <md-filled-button style={{ minWidth: 120 }} onClick={() => navigate(`/game/${currentRoom.id}`)}>返回游戏</md-filled-button>
              </div>
            ) : (
              <>
                <md-filled-button onClick={createRoom} style={{ width: '100%', marginBottom: 12 }}>
                  <md-icon slot="icon">add</md-icon>
                  创建房间
                </md-filled-button>
                <div className="room-list">
                  {rooms.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#aaa', padding: 20, fontSize: 13 }}>暂无房间，创建一局吧！</div>
                  ) : (
                    rooms.map(room => (
                      <div key={room.id} className="room-item">
                        <div className="room-info">
                          <span className="room-name">房间 #{room.id}</span>
                          <span className="room-meta">
                            {room.playerCount} 人 | {room.state === 'waiting' ? '等待中' : '游戏中'}
                          </span>
                        </div>
                        {room.state === 'waiting' ? (
                          <md-filled-button style={{ minWidth: 100 }} onClick={() => joinRoom(room.id)}>加入</md-filled-button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#aaa' }}>进行中</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="section-card">
            <h3 className="section-title"><md-icon>people</md-icon> 在线玩家 ({onlineUsers.length})</h3>
            <div className="online-chips">
              {onlineUsers.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13 }}>暂无其他在线玩家</div>
              ) : (
                onlineUsers.map(u => (
                  <div key={u.id} className="online-chip">
                    {adminUsers.find(au => au.id === u.id)?.nickname || `用户 #${u.id}`}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Player self password change dialog */}
      <dialog ref={pwdDialogRef} className="md-dialog-custom">
        <div className="md-dialog-headline">修改密码</div>
        {pwdSuccess ? (
          <div className="md-dialog-content" style={{ color: '#43a047', fontSize: 15, textAlign: 'center' }}>{pwdSuccess}</div>
        ) : (
          <div className="md-dialog-content">
            <md-outlined-text-field ref={pwdOldRef} label="原密码" type="password" required></md-outlined-text-field>
            <md-outlined-text-field ref={pwdNewRef} label="新密码" type="password" required></md-outlined-text-field>
            <md-outlined-text-field ref={pwdConfirmRef} label="确认新密码" type="password" required></md-outlined-text-field>
            {pwdError && <div className="form-error">{pwdError}</div>}
          </div>
        )}
        <div className="md-dialog-actions">
          {!pwdSuccess && <md-outlined-button style={{ minWidth: 100 }} onClick={() => pwdDialogRef.current.close()}>取消</md-outlined-button>}
          {!pwdSuccess && <md-filled-button style={{ minWidth: 100 }} onClick={handleChangePassword}>确认修改</md-filled-button>}
        </div>
      </dialog>

      {/* Admin password reset dialog */}
      <dialog ref={adminPwdDialogRef} className="md-dialog-custom">
        <div className="md-dialog-headline">重置密码</div>
        {pwdSuccess ? (
          <div className="md-dialog-content" style={{ color: '#43a047', fontSize: 15, textAlign: 'center' }}>{pwdSuccess}</div>
        ) : (
          <div className="md-dialog-content">
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>用户: {adminPwdTarget?.username}</p>
            <md-outlined-text-field ref={adminPwdNewRef} label="新密码" type="password" required></md-outlined-text-field>
            <md-outlined-text-field ref={adminPwdConfirmRef} label="确认新密码" type="password" required></md-outlined-text-field>
            {pwdError && <div className="form-error">{pwdError}</div>}
          </div>
        )}
        <div className="md-dialog-actions">
          {!pwdSuccess && <md-outlined-button style={{ minWidth: 100 }} onClick={() => adminPwdDialogRef.current.close()}>取消</md-outlined-button>}
          {!pwdSuccess && <md-filled-button style={{ minWidth: 100 }} onClick={handleAdminResetPassword}>确认重置</md-filled-button>}
        </div>
      </dialog>
    </div>
  );
}
