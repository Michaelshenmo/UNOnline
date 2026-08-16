import db from './db.js';

export function isTitleActive(user) {
  if (!user) return false;
  if (user.title_permanent) return true;
  if (!user.title_expiry) return false;
  const t = new Date(user.title_expiry).getTime();
  if (isNaN(t)) return false;
  return Date.now() < t;
}

export function getTitleData(userId) {
  const user = db.prepare('SELECT title, title_enabled, title_color, title_permanent, title_expiry FROM users WHERE id = ?').get(userId);
  if (!user) return { title: null, title_enabled: false, title_color: '#00e5ff' };

  let title = user.title;
  if (title && !isTitleActive(user)) {
    db.prepare('UPDATE users SET title = NULL WHERE id = ?').run(userId);
    title = null;
  }
  return {
    title,
    title_enabled: isTitleActive(user),
    title_color: user.title_color || '#00e5ff',
  };
}
