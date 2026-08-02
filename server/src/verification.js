const codes = new Map();
const lastSent = new Map();
const CODE_EXPIRY = 10 * 60 * 1000;
const COOLDOWN = 60 * 1000;

export function canSend(email) {
  const last = lastSent.get(email.toLowerCase());
  if (!last) return { ok: true };
  const elapsed = Date.now() - last;
  if (elapsed < COOLDOWN) {
    return { ok: false, remaining: Math.ceil((COOLDOWN - elapsed) / 1000) };
  }
  return { ok: true };
}

export function markSent(email) {
  lastSent.set(email.toLowerCase(), Date.now());
}

export function generateCode(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  codes.set(email.toLowerCase(), { code, expiresAt: Date.now() + CODE_EXPIRY });
  return code;
}

export function verifyCode(email, code) {
  const entry = codes.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codes.delete(email.toLowerCase());
    return false;
  }
  if (entry.code !== code) return false;
  codes.delete(email.toLowerCase());
  return true;
}

export function clearCode(email) {
  codes.delete(email.toLowerCase());
}
