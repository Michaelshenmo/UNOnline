import { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface RegData { username: string; password: string; nickname?: string; email: string; }

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const regData = (location.state as RegData) || null;
  const codeRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  if (!regData) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>页面失效</h1>
          <p className="subtitle">请重新填写注册信息</p>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Link to="/register">返回注册</Link>
          </div>
        </div>
      </div>
    );
  }

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    setSent(true);
  }

  async function getCode() {
    setError(''); setSuccess('');
    if (cooldown > 0) return;
    try {
      await api.sendVerificationCode(regData.email);
      setSuccess('验证码已发送到您的邮箱');
      startCooldown(60);
    } catch (err: any) {
      setError(err.message);
      const match = err.message.match(/请 (\d+) 秒后重试/);
      if (match) startCooldown(parseInt(match[1]));
    }
  }

  async function handleVerify() {
    setError(''); setSuccess('');
    const code = codeRef.current?.value?.trim();
    if (!code) { setError('请输入验证码'); return; }
    setLoading(true);
    try {
      const data = await api.register(regData.username, regData.password, regData.nickname, regData.email, code);
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
        <h1><md-icon style={{ fontSize: 28, color: '#e53935', verticalAlign: 'middle', marginRight: 6 }}>mark_email_read</md-icon> 邮箱验证</h1>
        <p className="subtitle">验证邮箱以完成注册</p>
        <div className="form-group">
          <label style={{ fontSize: 13, color: '#aaa', marginBottom: 6, display: 'block' }}>邮箱</label>
          <md-outlined-text-field value={regData.email} disabled></md-outlined-text-field>
        </div>
        <div className="form-group">
          <label style={{ fontSize: 13, color: '#aaa', marginBottom: 6, display: 'block' }}>验证码</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <md-outlined-text-field ref={codeRef} label="验证码" type="text" inputmode="numeric"></md-outlined-text-field>
            </div>
            <md-outlined-button style={{ minWidth: 140, height: 48 }} onClick={getCode} disabled={cooldown > 0 || undefined}>
              {cooldown > 0 ? `重新发送(${cooldown}秒)` : (sent ? '重新发送' : '获取验证码')}
            </md-outlined-button>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && <div style={{ color: '#43a047', fontSize: 13, marginTop: 4 }}>{success}</div>}
        <div style={{ marginTop: 8 }}>
          <md-filled-button style={{ width: '100%' }} onClick={handleVerify} disabled={loading || undefined}>
            {loading ? '验证中...' : '验证并注册'}
          </md-filled-button>
        </div>
        <div className="form-footer">
          <Link to="/register">返回重新填写</Link>
        </div>
      </div>
    </div>
  );
}
