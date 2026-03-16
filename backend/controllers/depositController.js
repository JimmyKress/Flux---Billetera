import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import pdfParse from 'pdf-parse';
import puppeteer from 'puppeteer';
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

const sendDepositApprovedEmail = async ({ to, depositId, amount }) => {
  if (!to) return;
  await mailer.sendMail({
    from: `Flux-wallet <${process.env.MAIL_USER}>`,
    to,
    subject: 'Ingreso aprobado',
    text: `Tu ingreso fue aprobado.\nMonto acreditado: $${Number(amount).toFixed(2)}\n\nYa podés verlo reflejado en tu billetera.`,
  });
};

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

const ensureClientesWalletModeColumn = async () => {
  const [cols] = await db.query("SHOW COLUMNS FROM clientes LIKE 'wallet_mode'");
  if (!cols.length) {
    await db.query("ALTER TABLE clientes ADD COLUMN wallet_mode VARCHAR(24) NOT NULL DEFAULT 'INTERNAL_WALLET'");
  }
};

const extractPdfText = async (filePath) => {
  // 1) Se intenta la extracción nativa desde el PDF (cuando es PDF con texto, es lo más confiable)
  try {
    const buffer = await fs.promises.readFile(filePath);
    const data = await pdfParse(buffer);
    const t = String(data?.text || '').trim();
    if (t) return t;
  } catch {
    // fallback
  }

  // 2) Fallback: intentar con Chromium (puede fallar dependiendo del PDF)
  try {
    const t2 = await extractPdfTextWithPuppeteer(filePath);
    if (t2) return t2;
  } catch {
    // ignore
  }

  return '';
};

export const adminListApprovedDeposits = async (req, res) => {
  try {
    await ensureDepositsTable();
    await ensureDepositReceiptsTable();

    const [rows] = await db.query(
      `SELECT d.id, d.user_id, d.cuit, d.status, d.amount_detected as monto_bruto, d.date_detected, d.bank_origin, d.operation_number,
              d.created_at, d.admin_action_at,
              u.email,
              r.id as receipt_id, r.original_filename, r.mime, r.file_size,
              wm.monto as amount_credited,
              (d.amount_detected * 0.01) as comision_arwpay,
              (d.amount_detected * 0.015) as conciliacion_bancaria,
              (d.amount_detected * 0.025) as total_descuentos,
              (d.amount_detected - (d.amount_detected * 0.025)) as monto_neto
       FROM deposits d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN deposit_receipts r ON r.id = d.receipt_id
       LEFT JOIN wallet_movements wm ON wm.cuit = d.cuit AND wm.movimiento_id = d.id AND wm.tipo = 'DEPOSIT_APPROVED'
       WHERE d.status = 'APPROVED'
       ORDER BY d.admin_action_at DESC, d.id DESC
       LIMIT 500`
    );

    res.json({ ok: true, data: rows || [] });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
};

const requireInternalWalletMode = async (cuit) => {
  await ensureClientesWalletModeColumn();
  const [rows] = await db.query('SELECT wallet_mode FROM clientes WHERE cuit = ? LIMIT 1', [cuit]);
  if (!rows.length) throw new Error('Cliente no encontrado');
  const mode = String(rows[0]?.wallet_mode || 'INTERNAL_WALLET').toUpperCase();
  if (mode === 'DIRECT_BANK') {
    const err = new Error('Operación no disponible para este modo de wallet');
    err.statusCode = 403;
    throw err;
  }
  return mode;
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

const normalizeSpaces = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const parseReceiptText = (textRaw) => {
  const text = normalizeSpaces(textRaw);

  const out = {
    amount_detected: null,
    date_detected: null,
    time_detected: null,
    bank_origin: null,
    account_origin: null,
    operation_number: null,
  };

  // Importe: $ 15.250,75  |  $15250.75
  const mAmount = text.match(/(?:Importe|Monto\s*transferido|Monto|Importe\s*transferido)\s*[:\-]?\s*\$?\s*([0-9]{1,3}(?:[\.,\s][0-9]{3})*(?:[\.,][0-9]{2})?)/i);
  if (mAmount?.[1]) {
    const raw = String(mAmount[1]).replace(/\s/g, '');
    // Convertir miles y decimal a formato JS
    const normalized = raw
      .replace(/\.(?=\d{3}(?:[\.,]|$))/g, '')
      .replace(/,(?=\d{2}$)/, '.');
    const num = Number(normalized);
    if (Number.isFinite(num) && num > 0) out.amount_detected = num;
  }

  // Fecha: 18/02/2026 o 18-02-2026
  const mDate = text.match(/\bFecha\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/i);
  if (mDate?.[1]) {
    const [d, mo, y] = String(mDate[1]).split(/[\/\-]/).map((x) => x.trim());
    const yyyy = y.length === 2 ? `20${y}` : y;
    const dt = new Date(`${yyyy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) out.date_detected = dt;
  }

  // Hora: 15:42
  const mTime = text.match(/\bHora\s*[:\-]?\s*(\d{1,2}:\d{2})\b/i);
  if (mTime?.[1]) out.time_detected = mTime[1];

  // Operación / ID
  const mOp = text.match(/\b(?:N(?:ro|°|\.)?\s*Operaci[oó]n|Operaci[oó]n|ID)\s*[:\-]?\s*([A-Za-z0-9\-]{5,})\b/i);
  if (mOp?.[1]) out.operation_number = mOp[1];

  // Banco Origen
  const mBank = text.match(/\bBanco\s*Origen\s*[:\-]?\s*([^\n\r]+?)(?=\s+(?:Cuenta\s*Origen|Titular\s*Origen|CUIT\s*Origen|Banco\s*Destino|CBU\s*Destino|Alias\s*Destino|Importe|Fecha|Hora|N(?:ro|°|\.)?\s*Operaci[oó]n|Operaci[oó]n|ID)\b|$)/i);
  if (mBank?.[1]) out.bank_origin = normalizeSpaces(mBank[1]).slice(0, 120);

  // Cuenta Origen
  const mAcc = text.match(/\bCuenta\s*Origen\s*[:\-]?\s*([^\n\r]+?)(?=\s+(?:Titular\s*Origen|CUIT\s*Origen|Banco\s*Destino|CBU\s*Destino|Alias\s*Destino|Importe|Fecha|Hora|N(?:ro|°|\.)?\s*Operaci[oó]n|Operaci[oó]n|ID)\b|$)/i);
  if (mAcc?.[1]) out.account_origin = normalizeSpaces(mAcc[1]).slice(0, 120);

  return out;
};

const extractPdfTextWithPuppeteer = async (filePath) => {
  const fileUrl = `file:///${String(filePath).replace(/\\/g, '/')}`;
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    // En muchos PDFs con texto, Chromium expone un text layer accesible como innerText.
    // Si no existe, devolverá string vacío y quedará sin detección.
    const text = await page.evaluate(() => {
      try {
        return document?.body?.innerText || '';
      } catch {
        return '';
      }
    });
    return String(text || '').trim();
  } finally {
    await browser.close();
  }
};

const ensureDepositReceiptsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS deposit_receipts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      original_filename VARCHAR(180) NULL,
      mime VARCHAR(80) NULL,
      file_size INT NULL,
      amount_detected DECIMAL(18,2) NULL,
      date_detected DATETIME NULL,
      time_detected VARCHAR(20) NULL,
      bank_origin VARCHAR(120) NULL,
      account_origin VARCHAR(120) NULL,
      operation_number VARCHAR(80) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deposit_receipts_user (user_id)
    )
  `);
};

const ensureDepositsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      cuit VARCHAR(32) NOT NULL,
      receipt_id INT NOT NULL,
      status VARCHAR(24) NOT NULL,
      amount_detected DECIMAL(18,2) NULL,
      date_detected DATETIME NULL,
      bank_origin VARCHAR(120) NULL,
      account_origin VARCHAR(120) NULL,
      operation_number VARCHAR(80) NULL,
      admin_user_id INT NULL,
      admin_ip VARCHAR(64) NULL,
      admin_action_at DATETIME NULL,
      reject_reason VARCHAR(240) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deposits_status (status),
      INDEX idx_deposits_user (user_id)
    )
  `);
};

const uploadsDir = path.join(process.cwd(), 'uploads', 'deposits');
const ensureUploadsDir = async () => {
  await fs.promises.mkdir(uploadsDir, { recursive: true });
};

const hashToken = (token) => {
  const secret = process.env.JWT_SECRET || 'flux-wallet';
  return crypto.createHash('sha256').update(`${String(token)}:${secret}`).digest('hex');
};

const generateTokenValue = () => crypto.randomBytes(16).toString('hex');

const sendDepositAccessEmail = async ({ to, token }) => {
  if (!to) throw new Error('Email destino requerido');
  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error('Falta configuración de email (MAIL_HOST/MAIL_USER/MAIL_PASS)');
  }

  await mailer.sendMail({
    from: `Flux-wallet <${process.env.MAIL_USER}>`,
    to,
    subject: 'Token para ver datos de transferencia',
    text: `Tu token para ver los datos de transferencia es: ${token}\nVence en 10 minutos.`,
  });
};

const getBankDetailsFromClienteProfile = async (cuit) => {
  const [rows] = await db.query(
    `SELECT cuit, razon_social, cbu_registro, alias, banco
     FROM clientes
     WHERE cuit = ?
     LIMIT 1`,
    [cuit]
  );

  if (!rows.length) throw new Error('Cliente no encontrado');

  const r = rows[0];
  return {
    banco: r?.banco || '',
    titular: r?.razon_social || '',
    cuit: r?.cuit || '',
    cbu: r?.cbu_registro || '',
    alias: r?.alias || '',
  };
};

export const requestDepositAccess = async (req, res) => {
  try {
    const userId = req.user?.id;
    const cuit = req.user?.cuit;
    const ip = getClientIp(req);

    if (!userId || !cuit) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    await requireInternalWalletMode(cuit);
    await ensureAuthTokensTable();

    const [emailRows] = await db.query('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
    const email = emailRows?.[0]?.email;
    if (!email) return res.status(400).json({ ok: false, msg: 'El usuario no tiene email registrado' });

    const token = generateTokenValue();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [result] = await db.query(
      `INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at, sent_at, ip_created)
       VALUES (?, ?, 'DEPOSIT_ACCESS', ?, NOW(), ?)` ,
      [userId, tokenHash, expiresAt, ip]
    );

    await sendDepositAccessEmail({ to: email, token });

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [cuit, `DEPOSIT_ACCESS_TOKEN_REQUEST token_id=${result.insertId}`, ip]
    );

    res.json({ ok: true, msg: 'Token enviado por email.' });
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({ ok: false, msg: e.message });
  }
};

export const validateDepositAccess = async (req, res) => {
  try {
    const userId = req.user?.id;
    const cuit = req.user?.cuit;
    const { token } = req.body;
    const ip = getClientIp(req);

    if (!userId || !cuit) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    await requireInternalWalletMode(cuit);
    await ensureAuthTokensTable();

    const tokenHash = hashToken(String(token || '').trim());

    const [rows] = await db.query(
      `SELECT id, expires_at, used_at
       FROM auth_tokens
       WHERE user_id = ? AND token_type = 'DEPOSIT_ACCESS' AND token_hash = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userId, tokenHash]
    );

    if (!rows.length) {
      return res.status(400).json({ ok: false, msg: 'Token inválido o expirado' });
    }

    const row = rows[0];
    const exp = row.expires_at ? new Date(row.expires_at) : null;
    if (row.used_at) return res.status(400).json({ ok: false, msg: 'Token inválido o expirado' });
    if (!exp || Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, msg: 'Token inválido o expirado' });
    }

    await db.query('UPDATE auth_tokens SET used_at = NOW() WHERE id = ?', [row.id]);

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [cuit, `DEPOSIT_ACCESS_TOKEN_VALIDATE_OK token_id=${row.id}`, ip]
    );

    const bank = await getBankDetailsFromClienteProfile(cuit);
    res.json({ ok: true, data: bank });
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({ ok: false, msg: e.message });
  }
};

export const uploadDepositReceipt = async (req, res) => {
  try {
    const userId = req.user?.id;
    const cuit = req.user?.cuit;
    const ip = getClientIp(req);

    if (!userId || !cuit) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    await requireInternalWalletMode(cuit);
    await ensureUploadsDir();
    await ensureDepositReceiptsTable();

    const { filename, mime, data_base64 } = req.body;

    const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']);
    const safeMime = String(mime || '').toLowerCase();
    if (!allowed.has(safeMime)) {
      return res.status(400).json({ ok: false, msg: 'Formato de archivo no permitido' });
    }

    const raw = String(data_base64 || '').trim();
    const commaIdx = raw.indexOf(',');
    const base64Payload = commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;

    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer || buffer.length < 20) {
      return res.status(400).json({ ok: false, msg: 'Archivo inválido' });
    }

    const extFromMime = (m) => {
      if (m === 'application/pdf') return 'pdf';
      if (m === 'image/png') return 'png';
      return 'jpg';
    };

    const ext = extFromMime(safeMime);
    const storedName = `deposit_${userId}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const storedPath = path.join(uploadsDir, storedName);

    await fs.promises.writeFile(storedPath, buffer);

    const [result] = await db.query(
      `INSERT INTO deposit_receipts (user_id, file_path, original_filename, mime, file_size)
       VALUES (?, ?, ?, ?, ?)` ,
      [userId, storedPath, String(filename || '').slice(0, 180), safeMime, buffer.length]
    );

    // Detección automática (solo PDFs con texto)
    try {
      if (safeMime === 'application/pdf') {
        const pdfText = await extractPdfText(storedPath);
        const detected = parseReceiptText(pdfText);

        if (
          detected.amount_detected ||
          detected.date_detected ||
          detected.time_detected ||
          detected.bank_origin ||
          detected.account_origin ||
          detected.operation_number
        ) {
          await db.query(
            `UPDATE deposit_receipts
             SET amount_detected = ?, date_detected = ?, time_detected = ?, bank_origin = ?, account_origin = ?, operation_number = ?
             WHERE id = ? AND user_id = ?`,
            [
              detected.amount_detected,
              detected.date_detected,
              detected.time_detected,
              detected.bank_origin,
              detected.account_origin,
              detected.operation_number,
              result.insertId,
              userId,
            ]
          );
        }
      }
    } catch {
      // Si falla la detección, igualmente dejamos el recibo subido.
    }

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [cuit, `DEPOSIT_RECEIPT_UPLOAD receipt_id=${result.insertId}`, ip]
    );

    const [detRows] = await db.query(
      'SELECT amount_detected, date_detected, time_detected, bank_origin, account_origin, operation_number FROM deposit_receipts WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    res.json({ ok: true, data: { receipt_id: result.insertId, detected: detRows?.[0] || null } });
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({ ok: false, msg: e.message });
  }
};

export const confirmDeposit = async (req, res) => {
  try {
    const userId = req.user?.id;
    const cuit = req.user?.cuit;
    const ip = getClientIp(req);
    const { receipt_id } = req.body;

    if (!userId || !cuit) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    await requireInternalWalletMode(cuit);
    await ensureDepositsTable();
    await ensureDepositReceiptsTable();

    const [rrows] = await db.query(
      'SELECT * FROM deposit_receipts WHERE id = ? AND user_id = ? LIMIT 1',
      [receipt_id, userId]
    );
    if (!rrows.length) return res.status(404).json({ ok: false, msg: 'Comprobante no encontrado' });

    const receipt = rrows[0];

    const [result] = await db.query(
      `INSERT INTO deposits (user_id, cuit, receipt_id, status, amount_detected, date_detected, bank_origin, account_origin, operation_number)
       VALUES (?, ?, ?, 'PENDING_REVIEW', ?, ?, ?, ?, ?)` ,
      [
        userId,
        cuit,
        receipt_id,
        receipt.amount_detected || null,
        receipt.date_detected || null,
        receipt.bank_origin || null,
        receipt.account_origin || null,
        receipt.operation_number || null,
      ]
    );

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [cuit, `DEPOSIT_CONFIRM deposit_id=${result.insertId} receipt_id=${receipt_id}`, ip]
    );

    res.json({ ok: true, msg: 'Ingreso registrado. Queda pendiente de revisión.', data: { deposit_id: result.insertId } });
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({ ok: false, msg: e.message });
  }
};

export const adminListPendingDeposits = async (req, res) => {
  try {
    await ensureDepositsTable();
    await ensureDepositReceiptsTable();

    const [rows] = await db.query(
      `SELECT d.id, d.user_id, d.cuit, d.status, d.amount_detected, d.date_detected, d.bank_origin, d.operation_number,
              d.created_at,
              u.email,
              r.id as receipt_id, r.original_filename, r.mime, r.file_size
       FROM deposits d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN deposit_receipts r ON r.id = d.receipt_id
       WHERE d.status = 'PENDING_REVIEW'
       ORDER BY d.created_at ASC
       LIMIT 500`
    );

    res.json({ ok: true, data: rows || [] });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
};

export const adminDownloadReceipt = async (req, res) => {
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, msg: 'ID inválido' });

    await ensureDepositReceiptsTable();

    const [rows] = await db.query('SELECT * FROM deposit_receipts WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Comprobante no encontrado' });

    const receipt = rows[0];
    const filePath = receipt.file_path;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, msg: 'Archivo no disponible' });
    }

    const downloadName = receipt.original_filename || `receipt-${id}`;
    res.setHeader('Content-Type', receipt.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${String(downloadName).replace(/\"/g, '')}"`);

    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
};

export const adminApproveDeposit = async (req, res) => {
  try {
    const adminUserId = req.user?.id || null;
    const adminCuit = req.user?.cuit || req.user?.email || 'admin';
    const ip = getClientIp(req);
    const { deposit_id } = req.body;

    await ensureDepositsTable();

    const [rows] = await db.query('SELECT * FROM deposits WHERE id = ? LIMIT 1', [deposit_id]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Depósito no encontrado' });

    const dep = rows[0];
    if (String(dep.status).toUpperCase() !== 'PENDING_REVIEW') {
      return res.status(400).json({ ok: false, msg: 'Estado inválido para aprobar' });
    }

    const detectedNum = Number(dep.amount_detected || 0);
    const amount = detectedNum;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, msg: 'No se puede aprobar: el comprobante no tiene un monto detectado válido' });
    }

    // Calcular descuentos
    const comisionRecaudacion = amount * 0.01; // 1%
    const conciliacionBancaria = amount * 0.015; // 1.5%
    const totalDescuentos = comisionRecaudacion + conciliacionBancaria;
    const netoLiquidado = amount - totalDescuentos;

    await db.query('START TRANSACTION');
    try {
      await db.query(
        `UPDATE deposits
         SET status = 'APPROVED', admin_user_id = ?, admin_ip = ?, admin_action_at = NOW(), reject_reason = NULL
         WHERE id = ?`,
        [adminUserId, ip, deposit_id]
      );

      await db.query(
        'INSERT INTO wallet_movements (cuit, movimiento_id, monto, tipo, created_at) VALUES (?,?,?,?,NOW())',
        [dep.cuit, deposit_id, netoLiquidado, 'DEPOSIT_APPROVED']
      );

      const [clientes] = await db.query('SELECT id FROM clientes WHERE cuit = ? LIMIT 1', [dep.cuit]);
      if (!clientes.length) {
        throw new Error('Cliente no encontrado para acreditar el ingreso');
      }
      const cliente_id = clientes[0].id;

      await db.query(
        `INSERT INTO movimientos
         (cuit, cliente_id, tipo_movimiento, montoBruto, arancel, ajuste, comision, neto, estado, aprobador, aprobada_at, usuario_creador, ip_creador, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),?,?,NOW())`,
        [
          dep.cuit,
          cliente_id,
          'INGRESO',
          amount,
          comisionRecaudacion,
          0,
          conciliacionBancaria,
          netoLiquidado,
          'APROBADO',
          adminCuit,
          adminCuit,
          ip,
        ]
      );

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [adminCuit, `DEPOSIT_ADMIN_APPROVE deposit_id=${deposit_id} amount=${amount} neto=${netoLiquidado} descuentos=${totalDescuentos}`, ip]
    );

    // Notificar al cliente (si falla el mail, no revertimos la aprobación)
    try {
      const [urows] = await db.query('SELECT email FROM users WHERE id = ? LIMIT 1', [dep.user_id]);
      const email = urows?.[0]?.email;
      await sendDepositApprovedEmail({ to: email, depositId: deposit_id, amount: netoLiquidado });
    } catch {
      // ignore
    }

    res.json({ ok: true, msg: 'Depósito aprobado y acreditado.' });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
};

export const adminRejectDeposit = async (req, res) => {
  try {
    const adminUserId = req.user?.id || null;
    const adminCuit = req.user?.cuit || req.user?.email || 'admin';
    const ip = getClientIp(req);
    const { deposit_id, reason } = req.body;

    await ensureDepositsTable();

    const [rows] = await db.query('SELECT * FROM deposits WHERE id = ? LIMIT 1', [deposit_id]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: 'Depósito no encontrado' });

    const dep = rows[0];
    if (String(dep.status).toUpperCase() !== 'PENDING_REVIEW') {
      return res.status(400).json({ ok: false, msg: 'Estado inválido para rechazar' });
    }

    await db.query(
      `UPDATE deposits
       SET status = 'REJECTED', admin_user_id = ?, admin_ip = ?, admin_action_at = NOW(), reject_reason = ?
       WHERE id = ?`,
      [adminUserId, ip, String(reason || '').slice(0, 240) || null, deposit_id]
    );

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [adminCuit, `DEPOSIT_ADMIN_REJECT deposit_id=${deposit_id}`, ip]
    );

    res.json({ ok: true, msg: 'Depósito rechazado.' });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
};
