import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { generateCode, verifyCode, canSend, markSent } from '../verification.js';
import { sendMail } from '../mail.js';

const router = Router();

function emailVerificationEnabled() {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = 'email_verification'").get();
  return row && row.value === 'true';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/check', (req, res) => {
  const { username, email } = req.body;
  const errors = [];
  if (username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) errors.push('用户名已存在');
  }
  if (email) {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existing) errors.push('该邮箱已注册');
  }
  res.json({ available: errors.length === 0, errors });
});

router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(400).json({ error: '该邮箱已注册' });
  }
  const cooldown = canSend(email);
  if (!cooldown.ok) {
    return res.status(429).json({ error: `发送过于频繁，请 ${cooldown.remaining} 秒后重试` });
  }
  try {
    const code = generateCode(email);
    await sendMail(email, 'UNO Online 注册验证码', `<p style="font-family:sans-serif">您的注册验证码是：<strong style="font-size:24px">${code}</strong></p><p>验证码 10 分钟内有效。</p>`);
    markSent(email);
    res.json({ message: '验证码已发送' });
  } catch (e) {
    res.status(500).json({ error: '邮件发送失败：' + (e.message || '未知错误') });
  }
});

router.post('/register', async (req, res) => {
  const { username, password, nickname, email, code } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度3-20个字符' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6个字符' });
  }

  const allow = db.prepare("SELECT value FROM system_settings WHERE key = 'allow_registration'").get();
  if (allow && allow.value !== 'true') {
    return res.status(403).json({ error: '管理员已关闭注册' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const finalEmail = (email || '').trim();
  if (!finalEmail || !EMAIL_RE.test(finalEmail)) {
    return res.status(400).json({ error: '请输入有效的邮箱' });
  }
  const emailExists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(finalEmail);
  if (emailExists) {
    return res.status(400).json({ error: '该邮箱已注册' });
  }
  if (emailVerificationEnabled()) {
    if (!finalEmail) {
      return res.status(400).json({ error: '请输入邮箱' });
    }
    if (!code || !verifyCode(finalEmail, code)) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }
  }

  const hash = bcrypt.hashSync(password, 10);
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const role = userCount === 0 ? 'admin' : 'player';
  const result = db.prepare('INSERT INTO users (username, password_hash, nickname, email, role) VALUES (?, ?, ?, ?, ?)').run(username, hash, nickname || username, finalEmail || null, role);
  const user = { id: result.lastInsertRowid, username, nickname: nickname || username, role };
  const token = generateToken(user);

  res.json({ token, user: { id: user.id, username, nickname: nickname || username, role, status: 'normal', email: finalEmail || null, title: null, title_enabled: 0 } });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role, status: user.status, email: user.email || null, title: user.title || null, title_enabled: user.title_enabled || 0 } });
});

router.get('/profile', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, nickname, email, title, title_enabled, role, status, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

router.put('/password', authenticateToken, (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json({ error: '原密码和新密码不能为空' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: '新密码至少6个字符' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.status === 'banned') return res.status(403).json({ error: '账号已被封禁' });

  if (!bcrypt.compareSync(old_password, user.password_hash)) {
    return res.status(403).json({ error: '原密码错误' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: '密码已修改' });
});

router.put('/profile', authenticateToken, (req, res) => {
  const { nickname, title } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.status === 'banned') return res.status(403).json({ error: '账号已被封禁' });

  if (title !== undefined && !user.title_enabled) {
    return res.status(403).json({ error: '未启用称号功能' });
  }
  if (title !== undefined && title.length > 10) {
    return res.status(400).json({ error: '称号最多10个字符' });
  }
  db.prepare('UPDATE users SET nickname = ?, title = ? WHERE id = ?').run(nickname || req.user.username, title !== undefined ? (title || null) : user.title, req.user.id);
  res.json({ message: '资料已更新' });
});

router.post('/forgot/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱' });
  }
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!user) {
    return res.status(400).json({ error: '该邮箱未注册' });
  }
  const cooldown = canSend(email);
  if (!cooldown.ok) {
    return res.status(429).json({ error: `发送过于频繁，请 ${cooldown.remaining} 秒后重试` });
  }
  try {
    const code = generateCode(email, 'forgot');
    await sendMail(email, 'UNO Online 重置密码验证码', `<p style="font-family:sans-serif">您的重置密码验证码是：<strong style="font-size:24px">${code}</strong></p><p>验证码 10 分钟内有效。</p>`);
    markSent(email);
    res.json({ message: '验证码已发送' });
  } catch (e) {
    res.status(500).json({ error: '邮件发送失败：' + (e.message || '未知错误') });
  }
});

router.post('/forgot/reset', (req, res) => {
  const { email, code, new_password } = req.body;
  if (!email || !new_password) return res.status(400).json({ error: '请填写邮箱和新密码' });
  if (new_password.length < 6) return res.status(400).json({ error: '新密码至少6个字符' });
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!user) return res.status(400).json({ error: '该邮箱未注册' });
  if (!verifyCode(email, code, 'forgot')) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ message: '密码已重置，请使用新密码登录' });
});

export default router;
