import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ForgotPassword() {
  const emailRef = useRef<any>(null);
  const codeRef = useRef<any>(null);
  const pwdRef = useRef<any>(null);
  const confirmRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  async function getCode() {
    setError(''); setSuccess('');
    const email = emailRef.current?.value?.trim();
    if (!email) { setError('请输入邮箱'); return; }
    if (cooldown > 0) return;
    try {
      await api.forgotSendCode(email);
      setSuccess('验证码已发送到您的邮箱');
      setCooldown(60);
    } catch (err: any) {
      setError(err.message + '。请联系管理员');
      const match = err.message.match(/请 (\d+) 秒后重试/);
      if (match) setCooldown(parseInt(match[1]));
    }
  }

  async function handleReset() {
    setError(''); setSuccess('');
    const email = emailRef.current?.value?.trim();
    const code = codeRef.current?.value?.trim();
    const newPwd = pwdRef.current?.value;
    const confirm = confirmRef.current?.value;
    if (!email) { setError('请输入邮箱'); return; }
    if (!code) { setError('请输入验证码'); return; }
    if (!newPwd) { setError('请输入新密码'); return; }
    if (newPwd.length < 6) { setError('新密码至少6个字符'); return; }
    if (newPwd !== confirm) { setError('两次密码不一致'); return; }
    setLoading(true);
    try {
      await api.forgotReset(email, code, newPwd);
      setSuccess('密码已重置，请使用新密码登录');
    } catch (err: any) {
      setError(err.message + '。请联系管理员');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1><md-icon style={{ fontSize: 28, color: '#e53935', verticalAlign: 'middle', marginRight: 6 }}>lock_reset</md-icon> 重置密码</h1>
        <p className="subtitle">通过邮箱验证码重置密码</p>
        <div className="form-group">
          <md-outlined-text-field ref={emailRef} label="邮箱" type="email" name="email" autocomplete="email" required></md-outlined-text-field>
        </div>
        <div className="form-group">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <md-outlined-text-field ref={codeRef} label="验证码" type="text" inputmode="numeric" required></md-outlined-text-field>
            </div>
            <md-outlined-button style={{ minWidth: 130, height: 48 }} onClick={getCode} disabled={cooldown > 0 || undefined}>
              {cooldown > 0 ? `获取验证码(${cooldown}秒)` : '获取验证码'}
            </md-outlined-button>
          </div>
        </div>
        <div className="form-group">
          <md-outlined-text-field ref={pwdRef} label="新密码" type="password" required name="new-password" autocomplete="new-password"></md-outlined-text-field>
        </div>
        <div className="form-group">
          <md-outlined-text-field ref={confirmRef} label="确认新密码" type="password" required name="new-password" autocomplete="new-password"></md-outlined-text-field>
        </div>
        {error && <div className="form-error">{error}</div>}
        {success && <div style={{ color: '#43a047', fontSize: 13, marginTop: 4 }}>{success}</div>}
        <div style={{ marginTop: 8 }}>
          <md-filled-button style={{ width: '100%' }} onClick={handleReset} disabled={loading || undefined}>
            {loading ? '重置中...' : '重置密码'}
          </md-filled-button>
        </div>
        <div className="form-footer">
          <Link to="/login">返回登录</Link>
        </div>
      </div>
    </div>
  );
}
