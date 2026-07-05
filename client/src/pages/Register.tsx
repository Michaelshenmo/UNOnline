import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Register() {
  const usernameRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);
  const nicknameRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const username = usernameRef.current?.value.trim();
    const password = passwordRef.current?.value;
    const confirm = confirmRef.current?.value;
    const nickname = nicknameRef.current?.value.trim();
    if (!username || !password) { setError('请填写用户名和密码'); return; }
    if (password !== confirm) { setError('两次密码不一致'); return; }
    setLoading(true);
    try {
      const data = await api.register(username, password, nickname || undefined);
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
        <p className="subtitle">创建新账号</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <md-outlined-text-field ref={usernameRef} label="用户名" type="text" required></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={nicknameRef} label="昵称（可选）" type="text"></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={passwordRef} label="密码" type="password" required></md-outlined-text-field>
          </div>
          <div className="form-group">
            <md-outlined-text-field ref={confirmRef} label="确认密码" type="password" required></md-outlined-text-field>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div style={{ marginTop: 8 }}>
            <md-filled-button type="submit" style={{ width: '100%' }} disabled={loading || undefined}>
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
