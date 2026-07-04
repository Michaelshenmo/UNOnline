import { useState, useEffect } from 'react';
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
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', nickname: '', role: 'player' });
  const [createError, setCreateError] = useState('');

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

  async function fetchRooms() {
    try { setRooms(await api.getRooms()); } catch {}
  }

  async function fetchOnlineUsers() {
    try {
      const users = await api.getOnlineUsers();
      setOnlineUsers(users);
    } catch {}
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
    } catch {}
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
    try {
      await api.updateSettings(editSettings);
      const s = await api.getSettings();
      setSettings(s);
      setEditSettings(s);
    } catch {}
  }

  async function handleCreateUser() {
    setCreateError('');
    try {
      await api.createUser(newUser.username, newUser.password, newUser.nickname, newUser.role);
      setShowCreateUser(false);
      setNewUser({ username: '', password: '', nickname: '', role: 'player' });
      loadAdminData();
    } catch (err: any) {
      setCreateError(err.message);
    }
  }

  const currentRoom = rooms.find(r => r.players.some(p => p.id === user?.id));

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <h1>🎴 UNO Online</h1>
        <div className="user-info">
          <span>{user?.nickname || user?.username}</span>
          {isAdmin && <span className="role-badge">管理员</span>}
          {isAdmin && (
            <button className="btn-secondary btn-small" onClick={() => { setShowAdmin(!showAdmin); if (!showAdmin) loadAdminData(); }}>
              {showAdmin ? '关闭管理' : '管理面板'}
            </button>
          )}
          <button className="btn-secondary btn-small" onClick={logout}>退出</button>
        </div>
      </div>

      {error && <div style={{ background: '#d32f2f', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {showAdmin && isAdmin ? (
        <div className="admin-panel card">
          <div className="admin-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>用户管理</h3>
              <button className="btn-success btn-small" onClick={() => { setShowCreateUser(true); setCreateError(''); }}>创建用户</button>
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
                      <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                        <option value="player">玩家</option>
                        <option value="admin">管理员</option>
                      </select>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="actions">
                      <button className="btn-small btn-danger" onClick={() => handleDeleteUser(u.id)} disabled={u.id === user?.id}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showCreateUser && (
            <div className="admin-section" style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <h3 className="section-title">创建新用户</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>用户名</label>
                  <input type="text" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} placeholder="3-20个字符" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>密码</label>
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} placeholder="至少6个字符" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>昵称</label>
                  <input type="text" value={newUser.nickname} onChange={(e) => setNewUser({...newUser, nickname: e.target.value})} placeholder="选填" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>角色</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})}>
                    <option value="player">玩家</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
                {createError && <div className="form-error">{createError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary btn-small" onClick={handleCreateUser}>创建</button>
                  <button className="btn-secondary btn-small" onClick={() => setShowCreateUser(false)}>取消</button>
                </div>
              </div>
            </div>
          )}

          <div className="admin-section">
            <h3 className="section-title">系统设置</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
              <div className="form-group">
                <label>允许注册</label>
                <select value={editSettings.allow_registration || 'true'} onChange={(e) => setEditSettings({...editSettings, allow_registration: e.target.value})}>
                  <option value="true">开启</option>
                  <option value="false">关闭</option>
                </select>
              </div>
              <div className="form-group">
                <label>最大玩家数 (2-10)</label>
                <input type="number" value={editSettings.max_players || ''} onChange={(e) => setEditSettings({...editSettings, max_players: e.target.value})} />
              </div>
              <div className="form-group">
                <label>回合超时 (秒)</label>
                <input type="number" value={editSettings.turn_timeout || ''} onChange={(e) => setEditSettings({...editSettings, turn_timeout: e.target.value})} />
              </div>
              <div className="form-group">
                <label>未喊UNO罚牌数</label>
                <input type="number" value={editSettings.uno_penalty || ''} onChange={(e) => setEditSettings({...editSettings, uno_penalty: e.target.value})} />
              </div>
              <button className="btn-primary btn-small" onClick={handleSaveSettings} style={{ alignSelf: 'flex-start' }}>保存设置</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="lobby-content">
          <div className="card">
            <h3 className="section-title">游戏房间 ({rooms.length})</h3>
            {currentRoom ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ marginBottom: 12 }}>你已在房间中</p>
                <button className="btn-success" onClick={() => navigate(`/game/${currentRoom.id}`)}>返回游戏</button>
              </div>
            ) : (
              <>
                <button className="btn-primary" onClick={createRoom} style={{ width: '100%', marginBottom: 12 }}>创建房间</button>
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
                          <button className="btn-success btn-small" onClick={() => joinRoom(room.id)}>加入</button>
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

          <div className="card">
            <h3 className="section-title">在线玩家 ({onlineUsers.length})</h3>
            <div className="online-users">
              {onlineUsers.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13 }}>暂无其他在线玩家</div>
              ) : (
                onlineUsers.map(u => (
                  <div key={u.id} className="online-user">
                    {adminUsers.find(au => au.id === u.id)?.nickname || `用户 #${u.id}`}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
