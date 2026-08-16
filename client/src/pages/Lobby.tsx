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
  const [onlineUsers, setOnlineUsers] = useState<{ id: number; nickname?: string }[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'settings' | 'email'>('users');
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [editSettings, setEditSettings] = useState<Record<string, string>>({ allow_registration: 'true' });
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailMsgSuccess, setEmailMsgSuccess] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createError, setCreateError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [announcementVersion, setAnnouncementVersion] = useState(0);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showTitleManager, setShowTitleManager] = useState(false);
  const [userTitleEnabled, setUserTitleEnabled] = useState(false);
  const [titleManagerTitle, setTitleManagerTitle] = useState('');
  const [titleManagerColor, setTitleManagerColor] = useState('#00e5ff');
  const [titleManagerError, setTitleManagerError] = useState('');
  const [titleManagerSuccess, setTitleManagerSuccess] = useState('');
  const userTitleInputRef = useRef<any>(null);
  const [showProfileCenter, setShowProfileCenter] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [adminEditTarget, setAdminEditTarget] = useState<any | null>(null);
  const [adminEditError, setAdminEditError] = useState('');
  const [adminEditTitleColor, setAdminEditTitleColor] = useState('#00e5ff');
  const [adminTitleManagerOpen, setAdminTitleManagerOpen] = useState(false);
  const [adminTitlePermanent, setAdminTitlePermanent] = useState(false);
  const [adminTitleValue, setAdminTitleValue] = useState('');
  const [adminTitleExpiry, setAdminTitleExpiry] = useState('');
  const [adminTitleManagerError, setAdminTitleManagerError] = useState('');
  const [adminTitleManagerSuccess, setAdminTitleManagerSuccess] = useState('');
  const regSwitchRef = useRef<any>(null);

  const cuUsernameRef = useRef<any>(null);
  const cuPasswordRef = useRef<any>(null);
  const cuNicknameRef = useRef<any>(null);
  const cuEmailRef = useRef<any>(null);
  const cuRoleRef = useRef<any>(null);
  const maxPlayersRef = useRef<any>(null);
  const turnTimeoutRef = useRef<any>(null);
  const unoPenaltyRef = useRef<any>(null);
  const noMercyThresholdRef = useRef<any>(null);
  const smtpHostRef = useRef<any>(null);
  const smtpPortRef = useRef<any>(null);
  const smtpUserRef = useRef<any>(null);
  const smtpPasswordRef = useRef<any>(null);
  const smtpFromRef = useRef<any>(null);
  const createUserDialogRef = useRef<any>(null);
  const successTimerRef = useRef<any>(null);
  const profileNicknameRef = useRef<any>(null);
  const profilePwdOldRef = useRef<any>(null);
  const profilePwdNewRef = useRef<any>(null);
  const profilePwdConfirmRef = useRef<any>(null);
  const adminEditUsernameRef = useRef<any>(null);
  const adminEditNicknameRef = useRef<any>(null);
  const adminEditEmailRef = useRef<any>(null);
  const adminEditRoleRef = useRef<any>(null);
  const adminEditStatusRef = useRef<any>(null);
  const adminTitleSwitchRef = useRef<any>(null);
  const adminTitleInputRef = useRef<any>(null);
  const adminEditPwdRef = useRef<any>(null);
  const adminEditPwdConfirmRef = useRef<any>(null);

  const profileDialogRef = useRef<any>(null);
  const titleManagerDialogRef = useRef<any>(null);
  const adminEditDialogRef = useRef<any>(null);
  const adminTitleManagerDialogRef = useRef<any>(null);

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
    s.on('spectator_joined', ({ room }: { room: Room & { id: string } }) => {
      navigate(`/game/${room.id}`);
    });
    s.on('game_mode_changed', ({ mode }) => {
      setRooms(prev => prev.map(r => r.id === currentRoom?.id ? { ...r, gameMode: mode } : r));
    });
    s.on('error', ({ message }: { message: string }) => setError(message));

    fetchRooms();
    fetchOnlineUsers();
    checkAnnouncement();
    api.getProfile().then(p => setUserTitleEnabled(!!p.title_enabled)).catch(() => {});

    return () => {
      s.off('rooms_update');
      s.off('online_users');
      s.off('room_created');
      s.off('room_joined');
      s.off('error');
    };
  }, [token, navigate]);

  async function checkAnnouncement() {
    try {
      const data = await api.getAnnouncement();
      setAnnouncement(data.announcement || '');
      setAnnouncementVersion(data.version || 0);
      if (data.announcement && data.announcement.trim()) {
        const seen = parseInt(localStorage.getItem('announcement_seen') || '0');
        if (data.version > seen) setShowAnnouncement(true);
      }
    } catch {}
  }

  const [dialogClosing, setDialogClosing] = useState(false);

  function closeNativeDialog(ref: any) {
    const el = ref.current;
    if (!el) return;
    if (dialogClosing) return;
    setDialogClosing(true);
    el.classList.add('closing');
    setTimeout(() => {
      el.classList.remove('closing');
      el.close();
      setDialogClosing(false);
    }, 150);
  }

  function dismissAnnouncement(neverAgain: boolean) {
    setDialogClosing(true);
    setTimeout(() => {
      setDialogClosing(false);
      setShowAnnouncement(false);
      if (neverAgain) localStorage.setItem('announcement_seen', String(announcementVersion));
    }, 150);
  }

  function toggleReg() {
    setEditSettings(prev => ({ ...prev, allow_registration: prev.allow_registration === 'true' ? 'false' : 'true' }));
  }

  async function toggleEmailVerification() {
    const target = editSettings.email_verification === 'true' ? 'false' : 'true';
    if (target === 'true') {
      // Test SMTP first
      const config = {
        smtp_host: editSettings.smtp_host || '',
        smtp_port: editSettings.smtp_port || '465',
        smtp_user: editSettings.smtp_user || '',
        smtp_password: editSettings.smtp_password || '',
      };
      setEmailMsg('正在测试 SMTP 连接...'); setEmailMsgSuccess(false);
      try {
        await api.smtpTest(config);
      } catch (err: any) {
        setEmailMsg('SMTP 连接失败，无法启用：' + err.message); setEmailMsgSuccess(false);
        return;
      }
    }
    setEditSettings(prev => ({ ...prev, email_verification: target }));
    try {
      await api.updateSettings({ email_verification: target });
      setEmailMsg(target === 'true' ? 'SMTP 连接成功，邮箱验证已启用' : '邮箱验证已关闭');
      setEmailMsgSuccess(true);
    } catch (err: any) {
      setEmailMsg('保存失败：' + err.message); setEmailMsgSuccess(false);
    }
  }

  async function handleSaveEmailSettings() {
    setEmailMsg(''); setEmailMsgSuccess(false);
    try {
      await api.updateSettings({
        smtp_host: editSettings.smtp_host || '',
        smtp_port: editSettings.smtp_port || '465',
        smtp_user: editSettings.smtp_user || '',
        smtp_password: editSettings.smtp_password || '',
        smtp_from: editSettings.smtp_from || '',
      });
      setEmailMsg('SMTP 配置已保存'); setEmailMsgSuccess(true);
    } catch (err: any) {
      setEmailMsg('保存失败：' + err.message); setEmailMsgSuccess(false);
    }
  }

  async function handleSendTestEmail() {
    setEmailMsg('正在发送测试邮件...'); setEmailMsgSuccess(false);
    try {
      const res = await api.smtpSendTest({
        smtp_host: editSettings.smtp_host || '',
        smtp_port: editSettings.smtp_port || '465',
        smtp_user: editSettings.smtp_user || '',
        smtp_password: editSettings.smtp_password || '',
        smtp_from: editSettings.smtp_from || '',
      });
      setEmailMsg(res.message); setEmailMsgSuccess(true);
    } catch (err: any) {
      setEmailMsg('发送失败：' + err.message); setEmailMsgSuccess(false);
    }
  }

  useEffect(() => {
    customElements.whenDefined('md-switch').then(() => {
      if (regSwitchRef.current) {
        regSwitchRef.current.selected = editSettings.allow_registration === 'true';
      }
    });
  }, [editSettings.allow_registration]);

  useEffect(() => {
    const el = createUserDialogRef.current;
    if (!el) return;
    if (showCreateUser) el.showModal();
    else el.close();
  }, [showCreateUser]);

  useEffect(() => {
    const el = createUserDialogRef.current;
    if (!el) return;
    const handler = () => setShowCreateUser(false);
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  useEffect(() => {
    const el = profileDialogRef.current;
    if (!el) return;
    if (showProfileCenter) {
      el.showModal(); setProfileError(''); setProfileSuccess('');
    }
    else el.close();
  }, [showProfileCenter]);

  useEffect(() => {
    const el = profileDialogRef.current;
    if (!el) return;
    const handler = () => setShowProfileCenter(false);
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  useEffect(() => {
    const el = titleManagerDialogRef.current;
    if (!el) return;
    if (showTitleManager) {
      el.showModal();
      api.getProfile().then(p => {
        setTitleManagerTitle(p.title || '');
        setTitleManagerColor(p.title_color || '#00e5ff');
        setTimeout(() => { if (userTitleInputRef.current) userTitleInputRef.current.value = p.title || ''; }, 50);
      }).catch(() => {});
    }
    else el.close();
  }, [showTitleManager]);

  useEffect(() => {
    const el = userTitleInputRef.current;
    if (!el) return;
    const handler = (e: any) => setTitleManagerTitle(e.target.value);
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [showTitleManager]);

  useEffect(() => {
    const el = titleManagerDialogRef.current;
    if (!el) return;
    const handler = () => setShowTitleManager(false);
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  useEffect(() => {
    const el = adminTitleManagerDialogRef.current;
    if (!el) return;
    if (adminEditTarget && adminTitleManagerOpen) el.showModal();
    else el.close();
  }, [adminTitleManagerOpen, adminEditTarget]);

  useEffect(() => {
    const el = adminTitleManagerDialogRef.current;
    if (!el) return;
    const handler = () => setAdminTitleManagerOpen(false);
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  useEffect(() => {
    customElements.whenDefined('md-switch').then(() => {
      if (adminTitleSwitchRef.current) {
        adminTitleSwitchRef.current.selected = adminTitlePermanent;
      }
    });
  }, [adminTitlePermanent]);

  useEffect(() => {
    const el = adminTitleInputRef.current;
    if (!el) return;
    const handler = (e: any) => setAdminTitleValue(e.target.value);
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [adminTitleManagerOpen]);

  useEffect(() => {
    const el = adminEditDialogRef.current;
    if (!el) return;
    if (adminEditTarget) el.showModal();
    else el.close();
  }, [adminEditTarget]);

  useEffect(() => {
    if (adminTab !== 'email') return;
    const fieldRefs: any = { smtp_host: smtpHostRef, smtp_port: smtpPortRef, smtp_user: smtpUserRef, smtp_password: smtpPasswordRef, smtp_from: smtpFromRef };
    const pairs = Object.entries(fieldRefs).map(([key, ref]: any) => [ref.current, key]);
    const handlers = pairs.map(([el, key]: any) => {
      if (!el) return null;
      const val = editSettings[key] || '';
      el.value = val;
      const handler = (e: any) => setEditSettings(prev => ({ ...prev, [key]: e.target.value }));
      el.addEventListener('input', handler);
      return { el, handler };
    });
    return () => handlers.forEach((h: any) => { if (h) h.el.removeEventListener('input', h.handler); });
  }, [adminTab]);

  useEffect(() => {
    const el = adminEditDialogRef.current;
    if (!el) return;
    const handler = () => setAdminEditTarget(null);
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

  function joinSpectator(roomId: string) {
    getSocket().emit('join_spectator', { roomId });
  }

  async function loadAdminData() {
    try {
      setAdminUsers(await api.getUsers());
      const s = await api.getSettings();
      setSettings(s);
      setEditSettings(s);
      setAnnouncement(s.announcement || '');
      setAnnouncementVersion(parseInt(s.announcement_version) || 0);
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
    if (noMercyThresholdRef.current?.value) data.no_mercy_threshold = String(Math.min(100, Math.max(20, parseInt(noMercyThresholdRef.current.value))));
    data.announcement = editSettings.announcement || '';
    try {
      await api.updateSettings(data);
      const s = await api.getSettings();
      setSettings(s);
      setEditSettings(s);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      setIsSuccess(true);
      setError('设置已保存');
      successTimerRef.current = setTimeout(() => { setError(''); setIsSuccess(false); }, 2000);
    } catch (e: any) {
      setIsSuccess(false);
      setError(e.message || '保存设置失败');
    }
  }

  async function handleUpdateProfile() {
    setProfileError(''); setProfileSuccess('');
    const nickname = profileNicknameRef.current?.value?.trim();
    const oldPwd = profilePwdOldRef.current?.value;
    const newPwd = profilePwdNewRef.current?.value;
    const confirmPwd = profilePwdConfirmRef.current?.value;
    try {
      if (nickname) await api.updateProfile(nickname);
      if (oldPwd && newPwd) {
        if (newPwd.length < 6) { setProfileError('新密码至少6个字符'); return; }
        if (newPwd !== confirmPwd) { setProfileError('两次密码不一致'); return; }
        await api.changePassword(oldPwd, newPwd);
      }
      setProfileSuccess('资料已更新');
      setTimeout(() => { closeNativeDialog(profileDialogRef); setProfileSuccess(''); }, 1500);
    } catch (err: any) { setProfileError(err.message); }
  }

  async function handleSaveTitle() {
    setTitleManagerError(''); setTitleManagerSuccess('');
    const title = titleManagerTitle;
    if (title.length > 10) { setTitleManagerError('称号最多10个字符'); return; }
    try {
      await api.updateProfile(user?.nickname || user?.username || '', title || undefined, titleManagerColor);
      setTitleManagerSuccess('称号已保存');
      setTimeout(() => { setShowTitleManager(false); setTitleManagerSuccess(''); }, 1200);
    } catch (err: any) {
      setTitleManagerError(err.message);
    }
  }

  function openAdminTitleManager() {
    const t = adminEditTarget;
    if (!t) return;
    setAdminEditTitleColor(t.title_color || '#00e5ff');
    setAdminTitlePermanent(!!t.title_permanent);
    let exp = '';
    if (t.title_expiry && new Date(t.title_expiry).getTime() > 0) {
      const d = new Date(t.title_expiry);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      exp = local.toISOString().slice(0, 16);
    }
    setAdminTitleExpiry(exp);
    setAdminTitleManagerError(''); setAdminTitleManagerSuccess('');
    setAdminTitleValue(t.title || '');
    setTimeout(() => { if (adminTitleInputRef.current) adminTitleInputRef.current.value = t.title || ''; }, 50);
    setAdminTitleManagerOpen(true);
  }

  async function handleAdminSaveTitle() {
    setAdminTitleManagerError(''); setAdminTitleManagerSuccess('');
    const title = adminTitleValue;
    if (title.length > 10) { setAdminTitleManagerError('称号最多10个字符'); return; }
    const expiryISO = adminTitlePermanent ? undefined : (adminTitleExpiry ? new Date(adminTitleExpiry).toISOString() : '1970-01-01T00:00:00.000Z');
    try {
      await api.adminUpdateUser(adminEditTarget.id, {
        title: title || undefined,
        title_color: adminEditTitleColor,
        title_permanent: adminTitlePermanent,
        title_expiry: expiryISO,
      });
      setAdminEditTarget(prev => prev ? { ...prev, title: title || null, title_color: adminEditTitleColor, title_permanent: adminTitlePermanent ? 1 : 0, title_expiry: expiryISO || null } : prev);
      setAdminTitleManagerSuccess('称号已保存');
      setTimeout(() => { setAdminTitleManagerOpen(false); setAdminTitleManagerSuccess(''); loadAdminData(); }, 1200);
    } catch (err: any) {
      setAdminTitleManagerError(err.message);
    }
  }

  async function handleAdminEditUser() {
    if (!adminEditTarget) return;
    setAdminEditError('');
    const newUsername = adminEditUsernameRef.current?.value?.trim();
    const newNickname = adminEditNicknameRef.current?.value?.trim();
    const newEmail = adminEditEmailRef.current?.value?.trim();
    const newRole = adminEditRoleRef.current?.value;
    const newStatus = adminEditStatusRef.current?.value;
    const newPwd = adminEditPwdRef.current?.value;
    const confirmPwd = adminEditPwdConfirmRef.current?.value;
    try {
      await api.adminUpdateUser(adminEditTarget.id, { username: newUsername, nickname: newNickname, email: newEmail, role: newRole, status: newStatus });
      if (newPwd) {
        if (newPwd.length < 6) { setAdminEditError('新密码至少6个字符'); return; }
        if (newPwd !== confirmPwd) { setAdminEditError('两次密码不一致'); return; }
        await api.adminResetPassword(adminEditTarget.id, newPwd);
      }
      closeNativeDialog(adminEditDialogRef);
      loadAdminData();
    } catch (err: any) { setAdminEditError(err.message); }
  }

  async function handleCreateUser() {
    setCreateError('');
    const username = cuUsernameRef.current?.value?.trim();
    const password = cuPasswordRef.current?.value;
    const nickname = cuNicknameRef.current?.value?.trim();
    const email = cuEmailRef.current?.value?.trim();
    const role = cuRoleRef.current?.value || 'player';
    if (!username || !password) { setCreateError('请填写用户名和密码'); return; }
    try {
      await api.createUser(username, password, nickname, role, email);
      closeNativeDialog(createUserDialogRef);
      loadAdminData();
    } catch (err: any) {
      setCreateError(err.message);
    }
  }

  const isBanned = user?.status === 'banned';
  const canUseTitle = !!user?.title_permanent || (!!user?.title_expiry && new Date(user.title_expiry).getTime() > Date.now());
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
          <md-outlined-button style={{ minWidth: 100 }} onClick={() => setShowProfileCenter(true)}>个人中心</md-outlined-button>
          {(canUseTitle || userTitleEnabled) ? (
            <md-outlined-button style={{ minWidth: 100 }} onClick={() => { setShowTitleManager(true); setTitleManagerError(''); setTitleManagerSuccess(''); }}>称号管理</md-outlined-button>
          ) : null}
          <md-outlined-button style={{ minWidth: 80 }} onClick={logout}>退出</md-outlined-button>
        </div>
      </div>

      {isBanned && <div style={{ background: '#b71c1c', color: '#fff', padding: '10px 16px', borderRadius: 10, marginBottom: 12, fontSize: 13, textAlign: 'center' }}>你的账号已被封禁，无法创建、加入或观战游戏</div>}
      <div className={`msg-banner ${error ? 'msg-banner-show' : 'msg-banner-enter'}`}>
        {error ? <div style={{ background: isSuccess ? '#2e7d32' : '#c62828', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <md-icon style={{ fontSize: 16 }}>{isSuccess ? 'check_circle' : 'error'}</md-icon>
          {error}
        </div> : null}
      </div>

      {showAdmin && isAdmin ? (
        <div className="admin-panel" key="admin-panel" style={{ display: 'flex', gap: 20 }}>
          <md-list style={{ width: 200, flexShrink: 0, '--md-list-container-color': 'var(--md-sys-color-surface)', borderRadius: 16, padding: 8, boxShadow: 'var(--md-elevation-level1)', height: 'fit-content' } as any}>
            <md-list-item type="button" onClick={() => setAdminTab('users')}>
              <md-icon slot="start" style={{ color: adminTab === 'users' ? '#e53935' : '#aaa' }}>manage_accounts</md-icon>
              <div slot="headline" style={{ color: adminTab === 'users' ? '#e53935' : '#ccc', fontWeight: adminTab === 'users' ? 500 : 400 }}>用户管理</div>
            </md-list-item>
            <md-list-item type="button" onClick={() => setAdminTab('settings')}>
              <md-icon slot="start" style={{ color: adminTab === 'settings' ? '#e53935' : '#aaa' }}>settings</md-icon>
              <div slot="headline" style={{ color: adminTab === 'settings' ? '#e53935' : '#ccc', fontWeight: adminTab === 'settings' ? 500 : 400 }}>系统设置</div>
            </md-list-item>
            <md-list-item type="button" onClick={() => setAdminTab('email')}>
              <md-icon slot="start" style={{ color: adminTab === 'email' ? '#e53935' : '#aaa' }}>alternate_email</md-icon>
              <div slot="headline" style={{ color: adminTab === 'email' ? '#e53935' : '#ccc', fontWeight: adminTab === 'email' ? 500 : 400 }}>邮箱配置</div>
            </md-list-item>
          </md-list>

          <div style={{ flex: 1, minWidth: 0 }}>
            {adminTab === 'users' ? (
              <div className="section-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 className="section-title" style={{ margin: 0 }}><md-icon>manage_accounts</md-icon> 用户管理</h3>
                  <md-filled-button style={{ minWidth: 120 }} onClick={() => {
                    setShowCreateUser(true); setCreateError('');
                    if (cuUsernameRef.current) cuUsernameRef.current.value = '';
                    if (cuPasswordRef.current) cuPasswordRef.current.value = '';
                    if (cuNicknameRef.current) cuNicknameRef.current.value = '';
                    if (cuEmailRef.current) cuEmailRef.current.value = '';
                    if (cuRoleRef.current) cuRoleRef.current.value = 'player';
                  }}>
                    <md-icon slot="icon">person_add</md-icon>
                    创建用户
                  </md-filled-button>
                </div>
                <table>
                  <thead>
                    <tr><th>ID</th><th>用户名</th><th>昵称</th><th>邮箱</th><th>角色</th><th>注册时间</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {adminUsers.map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                    <td>{u.username} {u.status === 'banned' ? <span style={{ background: '#d32f2f', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>被封禁</span> : ''}</td>
                    <td>{u.nickname}</td>
                    <td style={{ fontSize: 12, color: '#aaa' }}>{u.email || '-'}</td>
                        <td>
                          <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} disabled={u.id === user?.id}
                            style={{ background: '#1e1e3a', color: '#fff', border: '1px solid #444', borderRadius: 4, padding: '4px 8px', fontSize: 13, opacity: u.id === user?.id ? 0.5 : 1 }}>
                            <option value="player">玩家</option>
                            <option value="admin">管理员</option>
                          </select>
                        </td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="actions">
                          <md-text-button style={{ minWidth: 80 }} onClick={() => {
                            setAdminEditTarget(u); setAdminEditError('');
                            setTimeout(() => {
                              if (adminEditUsernameRef.current) adminEditUsernameRef.current.value = u.username;
                              if (adminEditNicknameRef.current) adminEditNicknameRef.current.value = u.nickname || u.username;
                              if (adminEditEmailRef.current) adminEditEmailRef.current.value = u.email || '';
                              if (adminEditRoleRef.current) adminEditRoleRef.current.value = u.role;
                              if (adminEditStatusRef.current) adminEditStatusRef.current.value = u.status || 'normal';
                              if (adminEditPwdRef.current) adminEditPwdRef.current.value = '';
                              if (adminEditPwdConfirmRef.current) adminEditPwdConfirmRef.current.value = '';
                            }, 50);
                          }}>修改信息</md-text-button>
                          <md-text-button style={{ minWidth: 60 }} onClick={() => handleDeleteUser(u.id)} disabled={u.id === user?.id || undefined}>删除</md-text-button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : adminTab === 'settings' ? (
              <div className="section-card">
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
                    <md-outlined-text-field ref={noMercyThresholdRef} label="No Mercy 爆牌阈值 (20-100)" type="number" value={editSettings.no_mercy_threshold || '40'}></md-outlined-text-field>
                  </div>
                  <div>
                    <div className="md-outlined-textarea-wrap">
                      <textarea value={editSettings.announcement || ''} onChange={(e) => setEditSettings({...editSettings, announcement: e.target.value})} rows={4} placeholder=" "></textarea>
                      <span className="md-outlined-textarea-label">公告内容（支持 HTML）</span>
                    </div>
                  </div>
                  <div>
                    <md-filled-button style={{ minWidth: 200 }} onClick={handleSaveSettings}>保存设置</md-filled-button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="section-card">
                <h3 className="section-title"><md-icon>alternate_email</md-icon> 邮箱配置</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={toggleEmailVerification}>
                    <span style={{ fontSize: 14, color: '#ccc' }}>邮箱验证</span>
                    <md-switch selected={editSettings.email_verification === 'true' || undefined}></md-switch>
                  </div>
                  <div>
                    <md-outlined-text-field ref={smtpHostRef} label="SMTP 服务器" type="text"></md-outlined-text-field>
                  </div>
                  <div>
                    <md-outlined-text-field ref={smtpPortRef} label="SMTP 端口" type="number"></md-outlined-text-field>
                  </div>
                  <div>
                    <md-outlined-text-field ref={smtpUserRef} label="SMTP 用户名" type="text"></md-outlined-text-field>
                  </div>
                  <div>
                    <md-outlined-text-field ref={smtpPasswordRef} label="SMTP 密码" type="password"></md-outlined-text-field>
                  </div>
                  <div>
                    <md-outlined-text-field ref={smtpFromRef} label="发件人邮箱" type="text"></md-outlined-text-field>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <md-filled-button style={{ minWidth: 140 }} onClick={handleSaveEmailSettings}>保存 SMTP 配置</md-filled-button>
                    <md-outlined-button style={{ minWidth: 120 }} onClick={handleSendTestEmail}>发送测试邮件</md-outlined-button>
                  </div>
                  {emailMsg && <div style={{ fontSize: 13, color: emailMsgSuccess ? '#43a047' : '#ef5350', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {emailMsgSuccess ? <md-icon style={{ fontSize: 15 }}>check_circle</md-icon> : <md-icon style={{ fontSize: 15 }}>error</md-icon>}
                    {emailMsg}
                  </div>}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="lobby-content" key="lobby-content">
          <div className="section-card">
            <h3 className="section-title"><md-icon>meeting_room</md-icon> 游戏房间 ({rooms.length})</h3>
            {currentRoom ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ marginBottom: 16, color: '#aaa' }}>你已在房间中</p>
                <md-filled-button style={{ minWidth: 120 }} onClick={() => navigate(`/game/${currentRoom.id}`)}>返回游戏</md-filled-button>
              </div>
            ) : (
              <>
                <md-filled-button onClick={createRoom} style={{ width: '100%', marginBottom: 12 }} disabled={isBanned || undefined}>
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
                            {room.playerCount} 人{room.spectatorCount ? ` · ${room.spectatorCount}观战` : ''} | {room.state === 'waiting' ? '等待中' : '游戏中'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {room.state === 'waiting' ? (
                            <md-filled-button style={{ minWidth: 100 }} onClick={() => joinRoom(room.id)} disabled={isBanned || undefined}>加入</md-filled-button>
                          ) : (
                            <span style={{ fontSize: 12, color: '#aaa' }}>进行中</span>
                          )}
                          <md-outlined-button style={{ minWidth: 100 }} onClick={() => joinSpectator(room.id)} disabled={isBanned || undefined}>观战</md-outlined-button>
                        </div>
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
                onlineUsers.map(u => {
                  const name = (u as any).nickname || (u as any).username || `用户 #${u.id}`;
                  const hasPerm = (u as any).title_enabled;
                  return (
                    <div key={u.id} className="online-chip" style={hasPerm ? { color: (u as any).title_color || '#00e5ff' } : undefined}>
                      {hasPerm && (u as any).title ? `『${(u as any).title}』` : ''}{name}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile center dialog */}
      <dialog ref={profileDialogRef} className="md-dialog-custom" style={{ minWidth: 420 }}>
        <div className="md-dialog-headline">个人中心</div>
        {profileSuccess ? (
          <div className="md-dialog-content" style={{ color: '#43a047', fontSize: 15, textAlign: 'center' }}>{profileSuccess}</div>
        ) : (
          <div className="md-dialog-content">
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: '#aaa' }}>UID: {user?.id}</div>
              <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>邮箱: {user?.email || '未绑定'}</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>用户名: {user?.username}</div>
            </div>
            <md-outlined-text-field ref={profileNicknameRef} label="昵称" type="text" value={user?.nickname || user?.username}></md-outlined-text-field>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginTop: 4 }}>
              <p style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>修改密码（选填）</p>
              <md-outlined-text-field ref={profilePwdOldRef} label="原密码" type="password" style={{ marginBottom: 12 }}></md-outlined-text-field>
              <md-outlined-text-field ref={profilePwdNewRef} label="新密码" type="password" style={{ marginBottom: 12 }}></md-outlined-text-field>
              <md-outlined-text-field ref={profilePwdConfirmRef} label="确认新密码" type="password"></md-outlined-text-field>
            </div>
            {profileError && <div className="form-error" style={{ marginTop: 8 }}>{profileError}</div>}
          </div>
        )}
        <div className="md-dialog-actions">
          {!profileSuccess && <md-outlined-button style={{ minWidth: 100 }} onClick={() => closeNativeDialog(profileDialogRef)}>关闭</md-outlined-button>}
          {!profileSuccess && <md-filled-button style={{ minWidth: 100 }} onClick={handleUpdateProfile}>保存</md-filled-button>}
        </div>
      </dialog>

      {/* Title manager dialog */}
      <dialog ref={titleManagerDialogRef} className="md-dialog-custom" style={{ minWidth: 400 }}>
        <div className="md-dialog-headline">称号管理</div>
        {titleManagerSuccess ? (
          <div className="md-dialog-content" style={{ color: '#43a047', fontSize: 15, textAlign: 'center' }}>{titleManagerSuccess}</div>
        ) : (
          <div className="md-dialog-content">
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 14, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>预览效果</div>
              <div style={{ fontSize: 18, color: titleManagerColor || '#00e5ff' }}>
                {titleManagerTitle ? `『${titleManagerTitle}』` : ''}{user?.nickname || user?.username}
              </div>
            </div>
            <md-outlined-text-field ref={userTitleInputRef} label="称号（最多10个字符，可留空）" type="text" style={{ marginBottom: 14 }}></md-outlined-text-field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, color: '#ccc' }}>展示颜色</span>
              <input type="color" value={titleManagerColor} onChange={(e) => setTitleManagerColor(e.target.value)} style={{ width: 48, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: '#aaa' }}>{titleManagerColor}</span>
            </div>
            {titleManagerError && <div className="form-error" style={{ marginTop: 8 }}>{titleManagerError}</div>}
          </div>
        )}
        <div className="md-dialog-actions">
          {!titleManagerSuccess && <md-outlined-button style={{ minWidth: 100 }} onClick={() => closeNativeDialog(titleManagerDialogRef)}>取消</md-outlined-button>}
          {!titleManagerSuccess && <md-filled-button style={{ minWidth: 100 }} onClick={handleSaveTitle}>保存</md-filled-button>}
        </div>
      </dialog>

      {/* Admin edit user dialog */}
      <dialog ref={adminEditDialogRef} className="md-dialog-custom" style={{ minWidth: 420 }}>
        <div className="md-dialog-headline">修改用户信息</div>
        <div className="md-dialog-content">
          <p style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>UID: {adminEditTarget?.id}</p>
          <md-outlined-text-field ref={adminEditUsernameRef} label="用户名" type="text" style={{ marginBottom: 12 }}></md-outlined-text-field>
          <md-outlined-text-field ref={adminEditNicknameRef} label="昵称" type="text" style={{ marginBottom: 12 }}></md-outlined-text-field>
          <md-outlined-text-field ref={adminEditEmailRef} label="邮箱" type="text" style={{ marginBottom: 12 }}></md-outlined-text-field>
          <md-outlined-select ref={adminEditRoleRef} value={adminEditTarget?.role || 'player'} style={{ marginBottom: 12 }} disabled={adminEditTarget?.id === user?.id || undefined}>
            <md-select-option value="player"><div slot="headline">玩家</div></md-select-option>
            <md-select-option value="admin"><div slot="headline">管理员</div></md-select-option>
          </md-outlined-select>
          <md-outlined-select ref={adminEditStatusRef} value={adminEditTarget?.status || 'normal'} style={{ marginBottom: 12 }} disabled={adminEditTarget?.id === user?.id || undefined}>
            <md-select-option value="normal"><div slot="headline">正常</div></md-select-option>
            <md-select-option value="banned"><div slot="headline">被封禁</div></md-select-option>
          </md-outlined-select>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginBottom: 12 }}>
            <md-outlined-button style={{ minWidth: 140 }} onClick={() => { openAdminTitleManager(); }}>称号管理</md-outlined-button>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>重置密码（选填）</p>
            <md-outlined-text-field ref={adminEditPwdRef} label="新密码" type="password" style={{ marginBottom: 12 }}></md-outlined-text-field>
            <md-outlined-text-field ref={adminEditPwdConfirmRef} label="确认新密码" type="password"></md-outlined-text-field>
          </div>
          {adminEditError && <div className="form-error" style={{ marginTop: 8 }}>{adminEditError}</div>}
        </div>
        <div className="md-dialog-actions">
          <md-outlined-button style={{ minWidth: 100 }} onClick={() => closeNativeDialog(adminEditDialogRef)}>取消</md-outlined-button>
          <md-filled-button style={{ minWidth: 100 }} onClick={handleAdminEditUser}>保存</md-filled-button>
        </div>
      </dialog>

      {/* Admin title manager dialog */}
      <dialog ref={adminTitleManagerDialogRef} className="md-dialog-custom" style={{ minWidth: 420 }}>
        <div className="md-dialog-headline">称号管理</div>
        {adminTitleManagerSuccess ? (
          <div className="md-dialog-content" style={{ color: '#43a047', fontSize: 15, textAlign: 'center' }}>{adminTitleManagerSuccess}</div>
        ) : (
          <div className="md-dialog-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, cursor: 'pointer' }} onClick={() => setAdminTitlePermanent(!adminTitlePermanent)}>
              <span style={{ fontSize: 14, color: '#ccc' }}>永久</span>
              <md-switch ref={adminTitleSwitchRef} selected={adminTitlePermanent || undefined}></md-switch>
            </div>
            {!adminTitlePermanent && (
              <div style={{ marginBottom: 14 }}>
                <div className="md-outlined-input-wrap">
                  <input type="datetime-local" value={adminTitleExpiry} onChange={(e) => setAdminTitleExpiry(e.target.value)} placeholder=" " className={adminTitleExpiry ? 'has-value' : ''} />
                  <span className="md-outlined-input-label">过期时间</span>
                </div>
              </div>
            )}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 14, marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>预览效果</div>
              <div style={{ fontSize: 18, color: adminEditTitleColor || '#00e5ff' }}>
                {adminTitleValue ? `『${adminTitleValue}』` : ''}{adminEditTarget?.nickname || adminEditTarget?.username}
              </div>
            </div>
            <md-outlined-text-field ref={adminTitleInputRef} label="称号（最多10个字符，可留空）" type="text" style={{ marginBottom: 14 }}></md-outlined-text-field>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, color: '#ccc' }}>展示颜色</span>
              <input type="color" value={adminEditTitleColor} onChange={(e) => setAdminEditTitleColor(e.target.value)} style={{ width: 48, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: '#aaa' }}>{adminEditTitleColor}</span>
            </div>
            {adminTitleManagerError && <div className="form-error" style={{ marginTop: 8 }}>{adminTitleManagerError}</div>}
          </div>
        )}
        <div className="md-dialog-actions">
          {!adminTitleManagerSuccess && <md-outlined-button style={{ minWidth: 100 }} onClick={() => closeNativeDialog(adminTitleManagerDialogRef)}>取消</md-outlined-button>}
          {!adminTitleManagerSuccess && <md-filled-button style={{ minWidth: 100 }} onClick={handleAdminSaveTitle}>保存</md-filled-button>}
        </div>
      </dialog>

      {/* Create user dialog */}
      <dialog ref={createUserDialogRef} className="md-dialog-custom">
        <div className="md-dialog-headline">创建新用户</div>
        {createError && <div className="md-dialog-content" style={{ paddingBottom: 0 }}><div className="form-error">{createError}</div></div>}
        <div className="md-dialog-content">
          <md-outlined-text-field ref={cuUsernameRef} label="用户名" type="text" required></md-outlined-text-field>
          <md-outlined-text-field ref={cuPasswordRef} label="密码" type="password" required></md-outlined-text-field>
          <md-outlined-text-field ref={cuNicknameRef} label="昵称" type="text"></md-outlined-text-field>
          <md-outlined-text-field ref={cuEmailRef} label="邮箱" type="text"></md-outlined-text-field>
          <md-outlined-select ref={cuRoleRef} value="player">
            <md-select-option value="player"><div slot="headline">玩家</div></md-select-option>
            <md-select-option value="admin"><div slot="headline">管理员</div></md-select-option>
          </md-outlined-select>
        </div>
        <div className="md-dialog-actions">
          <md-outlined-button style={{ minWidth: 100 }} onClick={() => closeNativeDialog(createUserDialogRef)}>取消</md-outlined-button>
          <md-filled-button style={{ minWidth: 100 }} onClick={handleCreateUser}>创建</md-filled-button>
        </div>
      </dialog>

      {/* Announcement dialog */}
      {showAnnouncement && (
        <div className={`color-picker-overlay ${dialogClosing ? 'overlay-hidden' : ''}`}>
          <div className="color-picker-dialog" style={{ maxWidth: 500, width: '90%', textAlign: 'left' }}>
            <h3 style={{ marginBottom: 14, fontWeight: 500 }}><md-icon style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 6 }}>campaign</md-icon> 公告</h3>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: '#ddd', maxHeight: 300, overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: announcement }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <md-outlined-button style={{ minWidth: 100 }} onClick={() => dismissAnnouncement(false)}>关闭</md-outlined-button>
              <md-filled-button style={{ minWidth: 100 }} onClick={() => dismissAnnouncement(true)}>不再显示</md-filled-button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
