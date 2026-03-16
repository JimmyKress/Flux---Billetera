import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { db } from '../config/db.js';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  logger: false,
  debug: false,
});

transporter.verify()
  .then(() => {
    // SMTP listo
  })
  .catch((err) => {
    // Error SMTP
  });

const addColumnIfMissing = async (table, column, definition) => {
  const [cols] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (!cols.length) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

export const aceptarTerminos = async (req, res) => {
  try {
    await ensureUnverifiedUsersColumns();
    const { email, firma_base64 } = req.body;
    if (!email || !firma_base64) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos' });
    }

    const [rows] = await db.query('SELECT id, estado FROM unverified_users WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Registro pendiente no encontrado' });

    const pending = rows[0];
    if (!['PENDIENTE_TERMINOS', 'PENDIENTE_VERIFICACION'].includes(pending.estado)) {
      return res.status(400).json({ ok: false, msg: 'Estado inválido para aceptar términos' });
    }

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    await db.query(
      `UPDATE unverified_users
       SET acepta_terminos = 1,
           terminos_aceptados_at = NOW(),
           firma_base64 = ?,
           firma_ip = ?,
           estado = 'PENDIENTE_APROBACION'
       WHERE id = ?`,
      [firma_base64, clientIp, pending.id]
    );

    res.json({ ok: true, msg: 'Términos aceptados. Enviado a validación.' });
  } catch (error) {
    console.error('Error al aceptar términos:', error);
    res.status(500).json({ ok: false, msg: 'Error al guardar términos' });
  }
};

export const obtenerEstadoTerminos = async (req, res) => {
  try {
    await ensureUnverifiedUsersColumns();
    const { email } = req.query;
    if (!email) return res.status(400).json({ ok: false, msg: 'Email requerido' });

    const [rows] = await db.query(
      'SELECT estado FROM unverified_users WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Registro pendiente no encontrado' });

    res.json({ ok: true, estado: rows[0].estado });
  } catch (error) {
    console.error('Error al obtener estado de términos:', error);
    res.status(500).json({ ok: false, msg: 'Error al obtener estado' });
  }
};

const ensureUnverifiedUsersColumns = async () => {
  await addColumnIfMissing('unverified_users', 'estado', "VARCHAR(40) DEFAULT 'PENDIENTE_VERIFICACION'");
  await addColumnIfMissing('unverified_users', 'acepta_terminos', 'TINYINT(1) DEFAULT 0');
  await addColumnIfMissing('unverified_users', 'terminos_aceptados_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'firma_base64', 'LONGTEXT NULL');
  await addColumnIfMissing('unverified_users', 'firma_ip', 'VARCHAR(64) NULL');
  await addColumnIfMissing('unverified_users', 'token_verificado_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'aprobado_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'rechazado_at', 'DATETIME NULL');
  await addColumnIfMissing('unverified_users', 'rechazo_motivo', 'VARCHAR(255) NULL');
  await addColumnIfMissing('unverified_users', 'modo_acreditacion', "VARCHAR(24) DEFAULT 'INTERNAL_WALLET'");
};

// Enviar código de verificación a cualquier email
export const enviarCodigoVerificacion = async (req, res) => {
  console.log('[enviarCodigoVerificacion] Request received:', req.body);
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, msg: 'Email requerido' });
  try {
    // Generar código aleatorio
    const token = Math.floor(1000 + Math.random() * 9000).toString();
    
    console.log('[enviarCodigoVerificacion] Enviando código a:', email, 'token:', token);
    console.log('[enviarCodigoVerificacion] MAIL_USER:', process.env.MAIL_USER);
    console.log('[enviarCodigoVerificacion] MAIL_HOST:', process.env.MAIL_HOST);
    
    // Enviar email
    const info = await transporter.sendMail({
      from: `Flux-wallet <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Código de verificación',
      text: `Tu código de verificación es ${token}. Vence en 1 hora.`,
    });
    
    console.log('[enviarCodigoVerificacion] sendMail OK:', { messageId: info?.messageId, response: info?.response });
    res.json({ ok: true, msg: 'Código de verificación enviado.' });
  } catch (e) {
    console.error('[enviarCodigoVerificacion] sendMail ERROR:', e);
    res.status(500).json({ ok: false, msg: 'Error al enviar código de verificación.' });
  }
};

// Reenviar código de verificación
export const resendVerificationCode = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, msg: 'Email requerido' });
  try {
    // Buscar usuario pendiente
    const [rows] = await db.query('SELECT * FROM unverified_users WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'No hay registro pendiente para este correo.' });
    // Generar nuevo código y actualizar
    const token = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await db.query('UPDATE unverified_users SET token = ?, token_created_at = NOW(), expires_at = ? WHERE email = ?', [token, expiresAt, email]);
    // Enviar email
    console.log('[resendVerificationCode] MAIL_USER runtime:', process.env.MAIL_USER);
    console.log('[resendVerificationCode] to:', email, 'token:', token);
    const info = await transporter.sendMail({
      from: `Flux-wallet <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Código de verificación',
      text: `Tu nuevo código es ${token}. Vence en 1 hora.`,
    });
    console.log('[resendVerificationCode] sendMail OK:', { messageId: info?.messageId, response: info?.response });
    res.json({ ok: true, msg: 'Código reenviado. Revisa tu correo.' });
  } catch (e) {
    console.error('[resendVerificationCode] sendMail ERROR:', e);
    res.status(500).json({ ok: false, msg: 'Error al reenviar el código.' });
  }
};

// Solicitar recuperación de contraseña
export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, msg: 'Email requerido' });
  try {
    // Buscar usuario por email
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(200).json({ ok: true, msg: 'Si el correo está registrado, recibirás un email.' });
    // Generar token único y guardar en tabla temporal
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
    await db.query('INSERT INTO password_reset (email, code, expires_at) VALUES (?, ?, ?)', [email, token, expiresAt]);
    // Enviar email con enlace
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: `Wallet App <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Recuperación de contraseña',
      text: `Haz click en el siguiente enlace para recuperar tu contraseña: ${resetUrl}\nEste enlace vence en 30 minutos.`
    });
    res.json({ ok: true, msg: 'Enlace enviado.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al enviar el enlace.' });
  }
};

// Cambiar la contraseña con código
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ ok: false, msg: 'Faltan datos' });
  try {
    // Verificar token
    const [rows] = await db.query('SELECT * FROM password_reset WHERE code = ? AND expires_at > NOW()', [token]);
    if (!rows.length) return res.status(400).json({ ok: false, msg: 'Enlace inválido o vencido' });
    const email = rows[0].email;
    // Cambiar contraseña
    const hashed = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE email = ?', [hashed, email]);
    // Eliminar token usado
    await db.query('DELETE FROM password_reset WHERE code = ?', [token]);
    res.json({ ok: true, msg: 'Contraseña cambiada exitosamente.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al cambiar la contraseña.' });
  }
};

export const register = async (req, res) => {
  try {
    await ensureUnverifiedUsersColumns();
    const { nombre, apellido, cuit, email, cbu, password, modoAcreditacion } = req.body;

    const normalizedWalletMode = String(modoAcreditacion || '').toUpperCase();
    const walletMode = normalizedWalletMode === 'DIRECT_BANK' ? 'DIRECT_BANK' : 'INTERNAL_WALLET';

    if (!nombre || !apellido || !cuit || !email || !cbu || !password) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos' });
    }

    if (cbu.length !== 22 || !/^\d+$/.test(cbu)) {
      return res.status(400).json({ ok: false, msg: 'CBU debe tener 22 dígitos' });
    }

    const passRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passRegex.test(password)) {
      return res.status(400).json({ ok: false, msg: 'Contraseña no cumple requisitos' });
    }

    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const adminCuit = normalizeCuit(process.env.ADMIN_CUIT || process.env.VITE_ADMIN_CUIT);
    const requestedCuit = normalizeCuit(cuit);

    // Verifica si el usuario ya existe en users, clientes o en pendientes
    const [userExists] = await db.query(
      'SELECT id FROM users WHERE email = ? OR cuit = ?',
      [email, cuit]
    );

    const [clientExists] = await db.query(
      'SELECT id FROM clientes WHERE cuit = ?',
      [cuit]
    );

    const [pendingExists] = await db.query(
      'SELECT id FROM unverified_users WHERE email = ? OR cuit = ?',
      [email, cuit]
    );

    if (userExists.length || clientExists.length || pendingExists.length) {
      return res.status(409).json({ ok: false, msg: 'Usuario ya existe o pendiente de verificación' });
    }

    // Registro directo para administrador: sin verificación por código ni términos
    if (adminCuit && requestedCuit === adminCuit) {
      const hashed = await bcrypt.hash(password, 10);

      const [cbuCol] = await db.query("SHOW COLUMNS FROM users LIKE 'cbu'");
      const hasCbu = Array.isArray(cbuCol) ? cbuCol.length > 0 : !!cbuCol.length;

      if (hasCbu) {
        await db.query(
          'INSERT INTO users (nombre, apellido, cuit, email, password, cbu, verificado, es_admin, created_at) VALUES (?,?,?,?,?,?,1,1,NOW())',
          [nombre, apellido, cuit, email, hashed, cbu]
        );
      } else {
        await db.query(
          'INSERT INTO users (nombre, apellido, cuit, email, password, verificado, es_admin, created_at) VALUES (?,?,?,?,?,1,1,NOW())',
          [nombre, apellido, cuit, email, hashed]
        );
      }

      return res.json({ ok: true, msg: 'Administrador registrado correctamente. Ya podés iniciar sesión en el panel.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const token = Math.floor(1000 + Math.random() * 9000).toString();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Guardar en tabla temporal unverified_users en lugar de users/clientes
    await db.query(
      `INSERT INTO unverified_users
        (nombre, apellido, cuit, email, password, cbu, modo_acreditacion, token, token_created_at, expires_at, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [nombre, apellido, cuit, email, hashed, cbu, walletMode, token, now, expiresAt, 'PENDIENTE_VERIFICACION']
    );

    try {
      console.log('[register] MAIL_USER runtime:', process.env.MAIL_USER);
      console.log('[register] to:', email, 'token:', token);
      const info = await transporter.sendMail({
        from: `Flux-wallet <${process.env.MAIL_USER}>`,
        to: email,
        subject: 'Código de verificación',
        text: `Tu código es ${token}. Vence en 1 hora.`
      });
      console.log('[register] sendMail OK:', { messageId: info?.messageId, response: info?.response });
      res.json({ ok: true, msg: 'Código enviado. Verifica tu correo para completar el registro.' });
    } catch (mailError) {
      console.error('[register] Error al enviar el correo:', mailError);
      // Si falla el envío, eliminamos el registro pendiente
      await db.query('DELETE FROM unverified_users WHERE email = ?', [email]);
      return res.status(500).json({ 
        ok: false, 
        msg: 'Error al enviar el correo de verificación',
        debug: process.env.NODE_ENV === 'development' ? mailError.message : undefined
      });
    }

  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const verify = async (req, res) => {
  try {
    await ensureUnverifiedUsersColumns();
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ ok: false, msg: 'Faltan datos' });

    // Buscar en la tabla temporal
    const [rows] = await db.query(
      'SELECT * FROM unverified_users WHERE email = ? AND token = ? AND expires_at > NOW()',
      [email, token]
    );

    if (!rows.length) return res.status(400).json({ ok: false, msg: 'Token inválido o vencido' });

    const pending = rows[0];

    const [userExists] = await db.query('SELECT id FROM users WHERE email = ? OR cuit = ?', [pending.email, pending.cuit]);
    const [clientExists] = await db.query('SELECT id FROM clientes WHERE cuit = ?', [pending.cuit]);
    if (userExists.length || clientExists.length) {
      // Eliminamos el registro pendiente para evitar retries y devolvemos conflicto
      await db.query('DELETE FROM unverified_users WHERE id = ?', [pending.id]);
      return res.status(409).json({ ok: false, msg: 'Ya existe un usuario o cliente con esos datos' });
    }

    await db.query(
      `UPDATE unverified_users
       SET estado = 'PENDIENTE_TERMINOS', token_verificado_at = NOW()
       WHERE id = ?`,
      [pending.id]
    );

    res.json({ ok: true, msg: 'Verificación exitosa. Continuar con términos.' });

  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ ok: false, msg: 'Refresh token requerido' });
    }

    // Verify refresh token (should be stored in DB with longer expiry)
    const [rows] = await db.query(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [refreshToken]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, msg: 'Refresh token inválido o vencido' });
    }

    const { user_id } = rows[0];

    // Get user data
    const [userRows] = await db.query('SELECT id, cuit FROM users WHERE id = ?', [user_id]);
    if (!userRows.length) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    }

    const user = userRows[0];

    // Generate new short-lived access token (15 minutes)
    const token = jwt.sign(
      { id: user.id, cuit: user.cuit },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ ok: true, token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ ok: false, msg: 'Faltan datos' });

    const cleanEmail = String(email).trim().toLowerCase();
    const [rows] = await db.query(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = ?',
      [cleanEmail]
    );
    if (!rows.length)
      return res.status(404).json({ ok: false, msg: 'No encontrado' });

    const user = rows[0];
    if (!user.verificado)
      return res.status(403).json({ ok: false, msg: 'Cuenta no verificada' });

    const okPass = await bcrypt.compare(password, user.password);
    if (!okPass)
      return res.status(401).json({ ok: false, msg: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: user.id, cuit: user.cuit },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate refresh token (7 days)
    const refreshTokenValue = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token in database
    await db.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [refreshTokenValue, user.id]
    );

    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const adminCuit = normalizeCuit(process.env.ADMIN_CUIT || process.env.VITE_ADMIN_CUIT);
    const userCuit = normalizeCuit(user.cuit);

    if (adminCuit && userCuit === adminCuit) {
      return res.json({
        ok: true,
        token,
        refreshToken: refreshTokenValue,
        role: 'admin',
        redirect: '/admin',
        cuit: user.cuit
      });
    }

    // CUIT normal → wallet cliente
    return res.json({
      ok: true,
      token,
      refreshToken: refreshTokenValue,
      role: 'cliente',
      redirect: '/wallet',
      cuit: user.cuit
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const me = async (req, res) => {
  try {
    // `verificarToken` middleware agrega `req.user`
    const user = req.user;
    if (!user) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    // Devolver solo campos seguros
    const safe = {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      cuit: user.cuit,
      es_admin: user.es_admin
    };

    res.json({ ok: true, data: safe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
