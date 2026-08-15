import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, requireAdmin, generateToken } from '../middleware/auth.js';
import { testSmtp, sendTestMail } from '../mail.js';

const router = Router();

router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, nickname, email, role, status, title, title_enabled, title_color, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.put('/users/:id/role', authenticateToken, requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['player', 'admin'].includes(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: '角色已更新' });
});

router.delete('/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ message: '用户已删除' });
});

router.get('/settings', authenticateToken, requireAdmin, (req, res) => {
  const settings = db.prepare('SELECT key, value FROM system_settings').all();
  const result = {};
  settings.forEach(s => result[s.key] = s.value);
  res.json(result);
});

router.put('/settings', authenticateToken, requireAdmin, (req, res) => {
  const { max_players, turn_timeout, uno_penalty, no_mercy_threshold, allow_registration, announcement, email_verification, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from } = req.body;
  const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  if (max_players) upsert.run('max_players', String(Math.min(10, Math.max(2, parseInt(max_players)))));
  if (turn_timeout) upsert.run('turn_timeout', String(Math.max(10, parseInt(turn_timeout))));
  if (uno_penalty !== undefined) upsert.run('uno_penalty', String(Math.max(0, parseInt(uno_penalty))));
  if (no_mercy_threshold !== undefined) upsert.run('no_mercy_threshold', String(Math.min(100, Math.max(20, parseInt(no_mercy_threshold)))));
  if (allow_registration !== undefined) upsert.run('allow_registration', (allow_registration === true || allow_registration === 'true') ? 'true' : 'false');
  if (email_verification !== undefined) upsert.run('email_verification', (email_verification === true || email_verification === 'true') ? 'true' : 'false');
  if (smtp_host !== undefined) upsert.run('smtp_host', String(smtp_host));
  if (smtp_port !== undefined) upsert.run('smtp_port', String(parseInt(smtp_port) || 465));
  if (smtp_user !== undefined) upsert.run('smtp_user', String(smtp_user));
  if (smtp_password !== undefined) upsert.run('smtp_password', String(smtp_password));
  if (smtp_from !== undefined) upsert.run('smtp_from', String(smtp_from));
  if (announcement !== undefined) {
    const old = db.prepare("SELECT value FROM system_settings WHERE key = 'announcement'").get()?.value || '';
    if (announcement !== old) {
      upsert.run('announcement', announcement);
      const current = parseInt(db.prepare("SELECT value FROM system_settings WHERE key = 'announcement_version'").get()?.value || '0');
      upsert.run('announcement_version', String(current + 1));
    }
  }
  res.json({ message: '设置已更新' });
});

router.post('/smtp/test', authenticateToken, requireAdmin, async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_password } = req.body;
  try {
    await testSmtp({
      host: smtp_host, port: parseInt(smtp_port) || 465,
      user: smtp_user, password: smtp_password,
    });
    res.json({ message: 'SMTP 连接成功' });
  } catch (e) {
    res.status(400).json({ error: 'SMTP 连接失败：' + (e.message || '未知错误') });
  }
});

router.post('/smtp/send-test', authenticateToken, requireAdmin, async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_from } = req.body;
  const admin = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
  if (!admin || !admin.email) return res.status(400).json({ error: '当前管理员未绑定邮箱，无法发送测试邮件' });
  try {
    await sendTestMail({
      host: smtp_host, port: parseInt(smtp_port) || 465,
      user: smtp_user, password: smtp_password, from: smtp_from,
    }, admin.email);
    res.json({ message: `邮件已发送给${admin.email}` });
  } catch (e) {
    res.status(400).json({ error: '发送失败：' + (e.message || '未知错误') });
  }
});

router.post('/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, nickname, email, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度3-20个字符' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6个字符' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  if (email) {
    const emailExists = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (emailExists) return res.status(400).json({ error: '该邮箱已被使用' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const userRole = role === 'admin' ? 'admin' : 'player';
  const result = db.prepare('INSERT INTO users (username, password_hash, nickname, email, role) VALUES (?, ?, ?, ?, ?)').run(username, hash, nickname || username, email || null, userRole);
  res.json({ message: '用户已创建', user: { id: result.lastInsertRowid, username, nickname: nickname || username, email: email || null, role: userRole } });
});

router.put('/users/:id/password', authenticateToken, requireAdmin, (req, res) => {
  const { new_password } = req.body;
  if (!new_password) {
    return res.status(400).json({ error: '新密码不能为空' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: '新密码至少6个字符' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: '密码已重置' });
});

router.put('/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { username, nickname, email, role, status, title_enabled, title, title_color } = req.body;
  const targetId = parseInt(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  if (username && username !== user.username) {
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: '用户名长度3-20个字符' });
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, targetId);
    if (existing) return res.status(400).json({ error: '用户名已存在' });
  }

  if (email !== undefined && email && email !== user.email) {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').get(email, targetId);
    if (existing) return res.status(400).json({ error: '该邮箱已被其他账号使用' });
  }

  if (title !== undefined && title.length > 10) {
    return res.status(400).json({ error: '称号最多10个字符' });
  }
  if (title_color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(title_color)) {
    return res.status(400).json({ error: '颜色格式无效' });
  }

  // Admin cannot change own status or role
  if (targetId === req.user.id) {
    const newUsername = username || user.username;
    const newNickname = nickname !== undefined ? (nickname || newUsername) : user.nickname;
    const newEmail = email !== undefined ? (email || null) : user.email;
    const newTitleEnabled = title_enabled !== undefined ? (title_enabled === true || title_enabled === 'true' ? 1 : 0) : user.title_enabled;
    const newTitle = title !== undefined ? (title || null) : user.title;
    const newTitleColor = title_color !== undefined ? title_color : (user.title_color || '#00e5ff');
    db.prepare('UPDATE users SET username = ?, nickname = ?, email = ?, title_enabled = ?, title = ?, title_color = ? WHERE id = ?').run(newUsername, newNickname, newEmail, newTitleEnabled, newTitle, newTitleColor, targetId);
    return res.json({ message: '用户资料已更新' });
  }

  const newUsername = username || user.username;
  const newNickname = nickname !== undefined ? (nickname || newUsername) : user.nickname;
  const newEmail = email !== undefined ? (email || null) : user.email;
  const newRole = role || user.role;
  const newStatus = status || user.status;
  const newTitleEnabled = title_enabled !== undefined ? (title_enabled === true || title_enabled === 'true' ? 1 : 0) : user.title_enabled;
  const newTitle = title !== undefined ? (title || null) : user.title;
  const newTitleColor = title_color !== undefined ? title_color : (user.title_color || '#00e5ff');
  db.prepare('UPDATE users SET username = ?, nickname = ?, email = ?, role = ?, status = ?, title_enabled = ?, title = ?, title_color = ? WHERE id = ?').run(newUsername, newNickname, newEmail, newRole, newStatus, newTitleEnabled, newTitle, newTitleColor, targetId);
  res.json({ message: '用户资料已更新' });
});

export default router;
