import nodemailer from 'nodemailer';
import db from './db.js';

export function getSmtpConfig() {
  const get = (key) => db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)?.value || '';
  return {
    host: get('smtp_host'),
    port: parseInt(get('smtp_port')) || 465,
    user: get('smtp_user'),
    password: get('smtp_password'),
    from: get('smtp_from'),
  };
}

export function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    tls: { rejectUnauthorized: false },
  });
}

export async function sendMail(to, subject, html) {
  const config = getSmtpConfig();
  if (!config.host) throw new Error('SMTP 未配置');
  const transporter = createTransporter(config);
  await transporter.sendMail({
    from: config.from || config.user,
    to,
    subject,
    html,
  });
}

export async function testSmtp(config) {
  const transporter = createTransporter(config);
  await transporter.verify();
  return true;
}

export async function sendTestMail(config, to) {
  const transporter = createTransporter(config);
  await transporter.sendMail({
    from: config.from || config.user,
    to,
    subject: 'UNO Online 邮件测试',
    html: '<p style="font-family:sans-serif">这是一封测试邮件，说明 SMTP 配置正确。</p>',
  });
}
