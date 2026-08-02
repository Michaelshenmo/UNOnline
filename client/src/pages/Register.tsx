import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Register() {
  const usernameRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);
  const nicknameRef = useRef<any>(null);
  const emailRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allowReg, setAllowReg] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getPublicConfig()
      .then(c => { setAllowReg(c.allow_registration); })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!allowReg) { setError('管理员已关闭注册'); return; }
    const username = usernameRef.current?.value.trim();
    const password = passwordRef.current?.value;
    const confirm = confirmRef.current?.value;
    const nickname = nicknameRef.current?.value.trim();
    const email = emailRef.current?.value.trim();
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    if (!email) { setError('请填写邮箱'); return; }
    if (password !== confirm) { setError('两次密码不一致'); return; }
    setLoading(true);
    try {
      const config = await api.getPublicConfig();
      if (config.email_verification) {
        const check = await api.checkRegistration(username, email);
        if (!check.available) {
          setError(check.errors.join('；'));
          setLoading(false);
          return;
        }
        navigate('/verify', { state: { username, password, nickname, email } });
        return;
      }
      const data = await api.register(username, password, nickname, email);
      login(data.token, data.user);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const disabled = !allowReg || !configLoaded;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1><md-icon style={{ fontSize: 28, color: '#e53935', verticalAlign: 'middle', marginRight: 6 }}>playing_cards</md-icon> UNO Online</h1>
        <p className="subtitle">创建新账号</p>
        {!allowReg && configLoaded && (
          <div style={{ background: 'rgba(211,47,47,0.15)', color: '#ef5350', border: '1px solid #d32f2f', borderRadius: 8, padding: 12, marginBottom: 16, textAlign: 'center', fontSize: 14 }}>
            <md-icon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>block</md-icon>
            管理员已关闭注册
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <md-outlined-text-field ref={usernameRef} label="用户名" type="text" required name="username" autocomplete="username" disabled={disabled || undefined} onKeyDown={(e: any) => { if (e.key === 'Enter') handleSubmit(e); }}></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={nicknameRef} label="昵称（可选）" type="text" name="nickname" autocomplete="nickname" disabled={disabled || undefined}></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={emailRef} label="邮箱" type="email" name="email" autocomplete="email" required disabled={disabled || undefined}></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={passwordRef} label="密码" type="password" required name="new-password" autocomplete="new-password" disabled={disabled || undefined} onKeyDown={(e: any) => { if (e.key === 'Enter') handleSubmit(e); }}></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={confirmRef} label="确认密码" type="password" required name="new-password" autocomplete="new-password" disabled={disabled || undefined} onKeyDown={(e: any) => { if (e.key === 'Enter') handleSubmit(e); }}></md-outlined-text-field>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div style={{ marginTop: 8 }}>
            <md-filled-button type="submit" style={{ width: '100%' }} disabled={loading || disabled || undefined}>
              {loading ? '注册中...' : '注册'}
            </md-filled-button>
          </div>
        </form>
        <div className="form-footer">
          已有账号？ <Link to="/login">立即登录</Link>
        </div>
      </div>
    </div>
  );
}
