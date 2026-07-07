import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Login() {
  const usernameRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const username = usernameRef.current?.value.trim();
    const password = passwordRef.current?.value;
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    setLoading(true);
    try {
      const data = await api.login(username, password);
      login(data.token, data.user);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🎴 UNO Online</h1>
        <p className="subtitle">联机UNO卡牌游戏</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <md-outlined-text-field ref={usernameRef} label="用户名" type="text" required onKeyDown={(e: any) => { if (e.key === 'Enter') handleSubmit(e); }}></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={passwordRef} label="密码" type="password" required onKeyDown={(e: any) => { if (e.key === 'Enter') handleSubmit(e); }}></md-outlined-text-field>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div style={{ marginTop: 8 }}>
            <md-filled-button type="submit" style={{ width: '100%' }} disabled={loading || undefined}>
              {loading ? '登录中...' : '登录'}
            </md-filled-button>
          </div>
        </form>
        <div className="form-footer">
          还没有账号？ <Link to="/register">立即注册</Link>
        </div>
      </div>
    </div>
  );
}
