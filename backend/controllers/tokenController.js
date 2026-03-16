import 'dotenv/config';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '../config/db.js';

const mailer = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

const ensureAuthTokensTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      token_type VARCHAR(40) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      sent_at DATETIME NULL,
      attempts INT NOT NULL DEFAULT 0,
      ip_created VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auth_tokens_user (user_id),
      INDEX idx_auth_tokens_type (token_type),
      INDEX idx_auth_tokens_expires (expires_at)
    )
  `);
};

const generateTokenValue = () => {
  return crypto.randomBytes(16).toString('hex');
};

const hashToken = (token) => {
  const secret = process.env.JWT_SECRET || 'flux-wallet';
  return crypto.createHash('sha256').update(`${String(token)}:${secret}`).digest('hex');
};

const sendTokenEmail = async ({ to, token, tokenType }) => {
  if (!to) throw new Error('Email destino requerido');
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error('Falta configuración de email (MAIL_HOST/MAIL_USER/MAIL_PASS)');
  }

  const safeType = String(tokenType || '').toUpperCase();

  await mailer.sendMail({
    from: `Flux-wallet <${process.env.MAIL_USER}>`,
    to,
    subject: 'Código de seguridad',
    text: `Tu código de seguridad (${safeType}) es: ${token}.\nVence en 10 minutos.`,
  });
};

export const requestToken = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userCuit = req.user?.cuit;
    const { type } = req.body;
    const ip = getClientIp(req);

    if (!userId) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    const tokenType = String(type || '').trim().toUpperCase();
    if (!tokenType) return res.status(400).json({ ok: false, msg: 'Tipo de token requerido' });

    await ensureAuthTokensTable();

    const [emailRows] = await db.query('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
    const email = emailRows?.[0]?.email;
    if (!email) return res.status(400).json({ ok: false, msg: 'El usuario no tiene email registrado' });

    const token = generateTokenValue();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [result] = await db.query(
      `INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at, sent_at, ip_created)
       VALUES (?, ?, ?, ?, NOW(), ?)` ,
      [userId, tokenHash, tokenType, expiresAt, ip]
    );

    await sendTokenEmail({ to: email, token, tokenType });

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [userCuit || String(userId), `TOKEN_REQUEST type=${tokenType} token_id=${result.insertId}`, ip]
    );

    res.json({ ok: true, msg: 'Token enviado por email.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const validateToken = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userCuit = req.user?.cuit;
    const { type, token } = req.body;
    const ip = getClientIp(req);

    if (!userId) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    const tokenType = String(type || '').trim().toUpperCase();
    const tokenValue = String(token || '').trim();
    if (!tokenType || !tokenValue) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos' });
    }

    await ensureAuthTokensTable();

    const tokenHash = hashToken(tokenValue);

    const [rows] = await db.query(
      `SELECT id, expires_at, used_at, attempts
       FROM auth_tokens
       WHERE user_id = ? AND token_type = ? AND token_hash = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userId, tokenType, tokenHash]
    );

    if (!rows || rows.length === 0) {
      await db.query(
        'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
        [userCuit || String(userId), `TOKEN_VALIDATE_FAIL type=${tokenType} reason=not_found`, ip]
      );
      return res.status(400).json({ ok: false, msg: 'Token inválido o expirado' });
    }

    const row = rows[0];
    const exp = row.expires_at ? new Date(row.expires_at) : null;

    if (row.used_at) {
      return res.status(400).json({ ok: false, msg: 'Token inválido o expirado' });
    }

    if (!exp || Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, msg: 'Token inválido o expirado' });
    }

    await db.query('UPDATE auth_tokens SET used_at = NOW() WHERE id = ?', [row.id]);

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [userCuit || String(userId), `TOKEN_VALIDATE_OK type=${tokenType} token_id=${row.id}`, ip]
    );

    res.json({ ok: true, msg: 'Token válido' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
