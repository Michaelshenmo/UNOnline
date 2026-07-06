import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password, nickname } = req.body;
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

  const hash = bcrypt.hashSync(password, 10);
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const role = userCount === 0 ? 'admin' : 'player';
  const result = db.prepare('INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)').run(username, hash, nickname || username, role);
  const user = { id: result.lastInsertRowid, username, role };
  const token = generateToken(user);

  res.json({ token, user: { id: user.id, username, nickname: nickname || username, role } });
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
  res.json({ token, user: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } });
});

router.get('/profile', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, nickname, role, created_at FROM users WHERE id = ?').get(req.user.id);
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

  if (!bcrypt.compareSync(old_password, user.password_hash)) {
    return res.status(403).json({ error: '原密码错误' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: '密码已修改' });
});

router.put('/profile', authenticateToken, (req, res) => {
  const { nickname } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname || req.user.username, req.user.id);
  res.json({ message: '资料已更新' });
});

export default router;
