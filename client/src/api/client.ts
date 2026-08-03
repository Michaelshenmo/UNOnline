const API_BASE = '/api';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || '请求失败');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register(username: string, password: string, nickname?: string, email?: string, code?: string) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname, email, code }),
    });
  },

  checkRegistration(username: string, email: string) {
    return request('/auth/check', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    });
  },

  sendVerificationCode(email: string) {
    return request('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  forgotSendCode(email: string) {
    return request('/auth/forgot/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  forgotReset(email: string, code: string, new_password: string) {
    return request('/auth/forgot/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password }),
    });
  },

  smtpTest(config: Record<string, string>) {
    return request('/admin/smtp/test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  smtpSendTest(config: Record<string, string>) {
    return request('/admin/smtp/send-test', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  login(username: string, password: string) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getProfile() {
    return request('/auth/profile');
  },

  getRooms() {
    return request('/rooms');
  },

  getOnlineUsers() {
    return request('/online-users');
  },

  // Admin
  getUsers() {
    return request('/admin/users');
  },

  updateUserRole(userId: number, role: string) {
    return request(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  deleteUser(userId: number) {
    return request(`/admin/users/${userId}`, { method: 'DELETE' });
  },

  getSettings() {
    return request('/admin/settings');
  },

  updateSettings(settings: Record<string, string>) {
    return request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  createUser(username: string, password: string, nickname: string, role: string, email?: string) {
    return request('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname, role, email }),
    });
  },

  changePassword(old_password: string, new_password: string) {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ old_password, new_password }),
    });
  },

  adminResetPassword(userId: number, new_password: string) {
    return request(`/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password }),
    });
  },

  updateProfile(nickname: string) {
    return request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    });
  },

  adminUpdateUser(userId: number, data: { username?: string; nickname?: string; email?: string; role?: string; status?: string }) {
    return request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getAnnouncement() {
    return request('/announcement');
  },

  getPublicConfig() {
    return request('/public-config');
  },
};
