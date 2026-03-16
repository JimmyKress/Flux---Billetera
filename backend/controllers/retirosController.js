import 'dotenv/config';
import crypto from 'crypto';
import https from 'https';
import nodemailer from 'nodemailer';
import { db } from '../config/db.js';
import { crearNotificacionRetiro } from './notificacionesController.js';

const mailer = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 8000),
  greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 8000),
  socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 12000),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket.remoteAddress || 
         'unknown';
};

const ensureClientesWalletModeColumn = async () => {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'wallet_mode'`
  );

  if (!cols || cols.length === 0) {
    await db.query("ALTER TABLE clientes ADD COLUMN wallet_mode VARCHAR(24) NOT NULL DEFAULT 'INTERNAL_WALLET'");
  }
};

const requireInternalWalletMode = async (cuit) => {
  await ensureClientesWalletModeColumn();
  const [rows] = await db.query('SELECT wallet_mode FROM clientes WHERE cuit = ? LIMIT 1', [cuit]);
  if (!rows.length) {
    const err = new Error('Cliente no encontrado');
    err.statusCode = 404;
    throw err;
  }

  const mode = String(rows[0]?.wallet_mode || 'INTERNAL_WALLET').toUpperCase();
  if (mode === 'DIRECT_BANK') {
    const err = new Error('Operación no disponible para este modo de wallet');
    err.statusCode = 403;
    throw err;
  }
  return mode;
};

const ensureWithdrawHoldsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS withdraw_holds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      retiro_id INT NOT NULL,
      cuit VARCHAR(50) NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      status VARCHAR(16) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_withdraw_holds_retiro (retiro_id),
      INDEX idx_withdraw_holds_cuit (cuit),
      INDEX idx_withdraw_holds_status (status)
    )
  `);
};

const computeWalletTotals = async (cuit) => {
  await ensureWithdrawHoldsTable();
  const [saldoRows] = await db.query(
    'SELECT COALESCE(SUM(monto), 0) as total FROM wallet_movements WHERE cuit = ?',
    [cuit]
  );
  const total = Number(saldoRows?.[0]?.total || 0);

  const [holdRows] = await db.query(
    "SELECT COALESCE(SUM(amount), 0) as held FROM withdraw_holds WHERE cuit = ? AND status = 'HELD'",
    [cuit]
  );
  const held = Number(holdRows?.[0]?.held || 0);

  const available = total - held;
  return {
    total,
    held,
    available,
  };
};

const ensureRetirosOcultosTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS retiros_ocultos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cuit VARCHAR(50) NOT NULL,
      retiro_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_cuit_retiro (cuit, retiro_id)
    )
  `);
};

const ensureCodigoRetiroColumn = async () => {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'retiros' AND COLUMN_NAME = 'codigo_retiro'`
  );

  if (!cols || cols.length === 0) {
    await db.query("ALTER TABLE retiros ADD COLUMN codigo_retiro VARCHAR(20) NULL");
  }
};

const ensureMovimientoIdColumn = async () => {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'retiros' AND COLUMN_NAME = 'movimiento_id'`
  );

  if (!cols || cols.length === 0) {
    await db.query('ALTER TABLE retiros ADD COLUMN movimiento_id INT NULL');
  }
};

 const ensureRetiroTokenColumns = async () => {
   const [cols] = await db.query(
     `SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'retiros'
        AND COLUMN_NAME IN ('token_hash', 'token_expires_at', 'token_sent_at', 'token_verified_at', 'token_attempts')`
   );

   const existing = new Set((cols || []).map(c => c.COLUMN_NAME));

   if (!existing.has('token_hash')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token_hash VARCHAR(128) NULL');
   }
   if (!existing.has('token_expires_at')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token_expires_at DATETIME NULL');
   }
   if (!existing.has('token_sent_at')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token_sent_at DATETIME NULL');
   }
   if (!existing.has('token_verified_at')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token_verified_at DATETIME NULL');
   }
   if (!existing.has('token_attempts')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token_attempts INT NOT NULL DEFAULT 0');
   }
 };

export const confirmarRetiroToken2 = async (req, res) => {
  try {
    const cuit = req.user?.cuit || req.body?.cuit;
    const { id, token } = req.body;
    const ip = getClientIp(req);

    if (!cuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });
    if (!id) return res.status(400).json({ ok: false, msg: 'Falta ID del retiro' });
    if (!token) return res.status(400).json({ ok: false, msg: 'Falta token' });

    await requireInternalWalletMode(cuit);
    await ensureRetiroDoubleTokenColumns();
    await ensureWithdrawHoldsTable();

    const [rows] = await db.query('SELECT * FROM retiros WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, msg: 'Retiro no encontrado' });

    const retiro = rows[0];
    if (normalizeCuit(retiro.cuit) !== normalizeCuit(cuit)) {
      return res.status(403).json({ ok: false, msg: 'No autorizado' });
    }

    if (retiro.estado !== 'PENDIENTE_TOKEN2') {
      return res.status(400).json({ ok: false, msg: `No se puede confirmar retiro con estado ${retiro.estado}` });
    }

    const exp = retiro.token2_expires_at ? new Date(retiro.token2_expires_at) : null;
    if (!exp || Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, msg: 'El token expiró. Vuelve a solicitar el retiro.' });
    }

    const tokenHash = hashRetiroToken(String(token).trim());
    if (!retiro.token2_hash || tokenHash !== String(retiro.token2_hash)) {
      await db.query('UPDATE retiros SET token2_attempts = token2_attempts + 1 WHERE id = ?', [id]);
      return res.status(400).json({ ok: false, msg: 'Token inválido' });
    }

    const totals = await computeWalletTotals(cuit);
    const montoNum = Number(retiro.monto || 0);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ ok: false, msg: 'Monto inválido' });
    }
    if (montoNum > totals.available) {
      return res.status(400).json({ ok: false, msg: 'Saldo insuficiente' });
    }

    await db.query('START TRANSACTION');
    try {
      await db.query(
        `UPDATE retiros
         SET estado = 'VALIDATION',
             token2_verified_at = NOW(),
             token2_hash = NULL,
             token2_expires_at = NULL,
             token2_sent_at = NULL
         WHERE id = ?`,
        [id]
      );

      await db.query(
        "INSERT INTO withdraw_holds (retiro_id, cuit, amount, status) VALUES (?, ?, ?, 'HELD')",
        [id, cuit, montoNum]
      );

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [cuit, `Retiro confirmado TOKEN2 ID ${id} (estado VALIDATION - hold creado)`, ip]
    );

    res.json({ ok: true, msg: 'Pago procesado. La acreditación puede demorar hasta 72 horas hábiles según el banco.' });
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({ ok: false, error: e.message });
  }
};

 const generateRetiroToken = () => {
   return Math.floor(100000 + Math.random() * 900000).toString();
 };

 const hashRetiroToken = (token) => {
   const secret = process.env.JWT_SECRET || 'flux-wallet';
   return crypto.createHash('sha256').update(`${token}:${secret}`).digest('hex');
 };

 const ensureRetiroDoubleTokenColumns = async () => {
   const [cols] = await db.query(
     `SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'retiros'
        AND COLUMN_NAME IN ('token2_hash', 'token2_expires_at', 'token2_sent_at', 'token2_verified_at', 'token2_attempts')`
   );

   const existing = new Set((cols || []).map(c => c.COLUMN_NAME));
   if (!existing.has('token2_hash')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token2_hash VARCHAR(128) NULL');
   }
   if (!existing.has('token2_expires_at')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token2_expires_at DATETIME NULL');
   }
   if (!existing.has('token2_sent_at')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token2_sent_at DATETIME NULL');
   }
   if (!existing.has('token2_verified_at')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token2_verified_at DATETIME NULL');
   }
   if (!existing.has('token2_attempts')) {
     await db.query('ALTER TABLE retiros ADD COLUMN token2_attempts INT NOT NULL DEFAULT 0');
   }
 };

 const sendRetiroToken2Email = async ({ to, token, monto }) => {
   if (!to) throw new Error('Email destino requerido');
   if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
     throw new Error('Falta configuración de email (MAIL_HOST/MAIL_USER/MAIL_PASS)');
   }

   await mailer.sendMail({
     from: `Flux-wallet <${process.env.MAIL_USER}>`,
     to,
     subject: 'Código final para confirmar retiro',
     text: `Tu código final para confirmar el retiro de $${formatMoneyAr(monto)} es: ${token}.\nVence en 10 minutos`,
   });
 };

 const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');

 const sendRetiroTokenEmail = async ({ to, token, monto }) => {
   if (!to) throw new Error('Email destino requerido');
   if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
     throw new Error('Falta configuración de email (MAIL_HOST/MAIL_USER/MAIL_PASS)');
   }

   await mailer.sendMail({
     from: `Flux-wallet <${process.env.MAIL_USER}>`,
     to,
     subject: 'Código de seguridad para autorizar retiro',
     text: `Tu código de seguridad para autorizar el retiro de $${formatMoneyAr(monto)} es: ${token}.\nVence en 10 minutos.`,
   });
 };

 const formatDateTimeAr = (value) => {
   const d = value instanceof Date ? value : new Date(value);
   if (Number.isNaN(d.getTime())) return '-';
   return d.toLocaleString('es-AR', {
     day: '2-digit',
     month: '2-digit',
     year: 'numeric',
     hour: '2-digit',
     minute: '2-digit',
     hour12: false,
   });
 };

 const formatMoneyAr = (value) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0,00';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 };

 const buildRetiroComprobanteHtml = ({ retiro, clienteNombre }) => {
   const monto = Number(retiro?.monto || 0);
   const fecha = formatDateTimeAr(retiro?.aprobado_at || retiro?.pagado_at || new Date());
   const opId = String(retiro?.codigo_retiro || retiro?.movimiento_id || retiro?.id || '').trim() || '-';
   const cuit = String(retiro?.cuit || '').trim() || '-';
   const cbu = String(retiro?.cbu || '').trim() || '-';
   const origenNombre = 'Flux';
   const origenCuit = String(process.env.ADMIN_CUIT || '').trim() || '-';

   return `
     <div style="margin:0; padding:20px; background:#f3f4f6; font-family:Arial, Helvetica, sans-serif;">
       <div style="max-width:520px; margin:0 auto;">
         <div style="padding:16px 18px; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb; text-align:center;">
           <img src="https://fluxmediosdigitales.com/fluxRosa.jpeg" alt="Flux" style="max-width:160px; height:auto;" />
         </div>

         <div style="margin-top:14px; padding:16px 18px; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb;">
           <div style="font-size:14px; font-weight:800; color:#111827;">Comprobante de transferencia</div>
           <div style="margin-top:10px; padding:14px; border-radius:12px; background:#f8fafc; border:1px solid #e5e7eb;">
             <div style="font-size:12px; font-weight:800; color:#6b7280;">Enviaste</div>
             <div style="margin-top:6px; font-size:22px; font-weight:900; color:#111827;">$ ${formatMoneyAr(monto)}</div>
             <div style="margin-top:6px; font-size:12px; font-weight:700; color:#6b7280;">${fecha}</div>
           </div>
         </div>

         <div style="margin-top:14px; padding:16px 18px; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb;">
           <div style="font-size:14px; font-weight:900; color:#111827; margin-bottom:10px;">Cuenta de origen</div>
           <div style="font-size:13px; font-weight:900; color:#111827;">${origenNombre}</div>
           <div style="margin-top:4px; font-size:12px; font-weight:700; color:#6b7280;">CUIL/CUIT</div>
           <div style="margin-top:2px; font-size:12px; font-weight:900; color:#111827;">${origenCuit}</div>
         </div>

         <div style="margin-top:14px; padding:16px 18px; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb;">
           <div style="font-size:14px; font-weight:900; color:#111827; margin-bottom:10px;">Cuenta de destino</div>
           <div style="font-size:13px; font-weight:900; color:#111827;">${String(clienteNombre || 'Cliente')}</div>
           <div style="margin-top:4px; font-size:12px; font-weight:700; color:#6b7280;">CUIL/CUIT</div>
           <div style="margin-top:2px; font-size:12px; font-weight:900; color:#111827;">${cuit}</div>
           <div style="margin-top:10px; font-size:12px; font-weight:700; color:#6b7280;">CBU/CVU</div>
           <div style="margin-top:2px; font-size:12px; font-weight:900; color:#111827;">${cbu}</div>
         </div>

         <div style="margin-top:14px; padding:16px 18px; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb;">
           <div style="font-size:14px; font-weight:900; color:#111827; margin-bottom:10px;">Información de la operación</div>
           <div style="font-size:12px; font-weight:700; color:#6b7280;">ID operación</div>
           <div style="margin-top:2px; font-size:12px; font-weight:900; color:#111827;">${opId}</div>
         </div>

         <div style="margin-top:14px; padding:16px 18px; background:#ffffff; border-radius:14px; border:1px solid #e5e7eb;">
            <div style="font-size:14px; font-weight:900; color:#111827; margin-bottom:10px;">
              Pago procesado: La acreditación es inmediata,
              en algunos casos puede demorar  hasta 72 hs hábiles
              bancarias según banco o billetera receptora.
            </div>
         </div>

         <div style="margin-top:14px; font-size:11px; color:#6b7280; text-align:center;">Este comprobante fue generado automáticamente.</div>
       </div>
     </div>
   `;
 };

 const sendRetiroComprobanteEmail = async ({ to, retiro, clienteNombre }) => {
   if (!to) throw new Error('Email destino requerido');
   if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
     throw new Error('Falta configuración de email (MAIL_HOST/MAIL_USER/MAIL_PASS)');
   }

   const monto = Number(retiro?.monto || 0);
   const fecha = formatDateTimeAr(retiro?.aprobado_at || retiro?.pagado_at || new Date());
   const opId = String(retiro?.codigo_retiro || retiro?.movimiento_id || retiro?.id || '').trim() || '-';
   const cuit = String(retiro?.cuit || '').trim() || '-';
   const cbu = String(retiro?.cbu || '').trim() || '-';

   const html = buildRetiroComprobanteHtml({ retiro, clienteNombre });

   await mailer.sendMail({
     from: `Flux-wallet <${process.env.MAIL_USER}>`,
     to,
     subject: 'Comprobante de transferencia',
     text: `Comprobante de transferencia\nEnviaste: $${formatMoneyAr(monto)}\nFecha: ${fecha}\nDestino: ${clienteNombre || 'Cliente'} (${cuit})\nCBU/CVU: ${cbu}\nID operación: ${opId}`,
     html,
   });
 };

 export const descargarComprobanteRetiro = async (req, res) => {
   try {
     const id = req.params?.id;
     const requesterCuit = req.user?.cuit;

     if (!id) return res.status(400).json({ ok: false, msg: 'Falta ID del retiro' });
     if (!requesterCuit) return res.status(401).json({ ok: false, msg: 'No autorizado' });

     const [rows] = await db.query('SELECT * FROM retiros WHERE id = ? LIMIT 1', [id]);
     if (!rows || rows.length === 0) return res.status(404).json({ ok: false, msg: 'Retiro no encontrado' });

     const retiro = rows[0];
     const requesterIsAdmin = normalizeCuit(requesterCuit) === normalizeCuit(process.env.ADMIN_CUIT);
     const sameOwner = normalizeCuit(retiro?.cuit) === normalizeCuit(requesterCuit);
     if (!requesterIsAdmin && !sameOwner) {
       return res.status(403).json({ ok: false, msg: 'No autorizado' });
     }

     const estado = String(retiro?.estado ?? '').trim().toUpperCase();
     if (!['PAGADO', 'APROBADO'].includes(estado)) {
       return res.status(400).json({ ok: false, msg: 'El comprobante solo está disponible para retiros aprobados/pagados' });
     }

     const [clienteRows] = await db.query('SELECT razon_social FROM clientes WHERE id = ? LIMIT 1', [retiro?.cliente_id]);
     const clienteNombre = clienteRows?.[0]?.razon_social || 'Cliente';

     const html = buildRetiroComprobanteHtml({ retiro, clienteNombre });
     const opId = String(retiro?.codigo_retiro || retiro?.movimiento_id || retiro?.id || '').trim() || 'retiro';
     const filename = `comprobante-retiro-${opId}.html`;

     res.setHeader('Content-Type', 'text/html; charset=utf-8');
     res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
     res.send(html);
   } catch (e) {
     console.error(e);
     res.status(500).json({ ok: false, error: e.message });
   }
 };

 const fetchImageBuffer = (url) => {
   return new Promise((resolve, reject) => {
     https
       .get(url, (response) => {
         if (response.statusCode && response.statusCode >= 400) {
           reject(new Error(`HTTP ${response.statusCode}`));
           return;
         }
         const chunks = [];
         response.on('data', (d) => chunks.push(d));
         response.on('end', () => resolve(Buffer.concat(chunks)));
       })
       .on('error', reject);
   });
 };

 export const descargarComprobanteRetiroPdf = async (req, res) => {
  try {
    const id = req.params?.id;
    const requesterCuit = req.user?.cuit;

    if (!id) return res.status(400).json({ ok: false, msg: 'Falta ID del retiro' });
    if (!requesterCuit) return res.status(401).json({ ok: false, msg: 'No autorizado' });

    let puppeteer;
    try {
      const mod = await import('puppeteer');
      puppeteer = mod?.default || mod;
    } catch {
      return res.status(500).json({ ok: false, msg: 'PDF no disponible (falta instalar puppeteer en el backend)' });
    }

    const [rows] = await db.query('SELECT * FROM retiros WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, msg: 'Retiro no encontrado' });

    const retiro = rows[0];
    const requesterIsAdmin = normalizeCuit(requesterCuit) === normalizeCuit(process.env.ADMIN_CUIT);
    const sameOwner = normalizeCuit(retiro?.cuit) === normalizeCuit(requesterCuit);
    if (!requesterIsAdmin && !sameOwner) {
      return res.status(403).json({ ok: false, msg: 'No autorizado' });
    }

    const estado = String(retiro?.estado ?? '').trim().toUpperCase();
    if (!['PAGADO', 'APROBADO'].includes(estado)) {
      return res.status(400).json({ ok: false, msg: 'El comprobante solo está disponible para retiros aprobados/pagados' });
    }

    const [clienteRows] = await db.query('SELECT razon_social FROM clientes WHERE id = ? LIMIT 1', [retiro?.cliente_id]);
    const clienteNombre = clienteRows?.[0]?.razon_social || 'Cliente';

    const opId = String(retiro?.codigo_retiro || retiro?.movimiento_id || retiro?.id || '').trim() || 'retiro';
    const filename = `comprobante-retiro-${opId}.pdf`;

    const innerHtml = buildRetiroComprobanteHtml({ retiro, clienteNombre });
    const fullHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Comprobante de transferencia</title>
    <style>
      html, body { margin: 0; padding: 0; }
      @page { size: A4; margin: 0; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head>
  <body>${innerHtml}</body>
</html>`;

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(pdf);
    } finally {
      if (browser) await browser.close();
    }
  } catch (e) {
    const status = e?.statusCode || 500;
    res.status(status).json({ ok: false, error: e.message });
  }
};

const generarCodigoRetiro = async () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 25; i++) {
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM retiros WHERE codigo_retiro = ?', [code]);
    if (Number(total) === 0) return code;
  }
  throw new Error('No se pudo generar un código de retiro único');
};

// ============= SOLICITAR RETIRO MANUAL =============

export const solicitarRetiro = async (req, res) => {
  try {
    const cuit = req.user?.cuit || req.body?.cuit;
    const { monto, cbu } = req.body;
    const ip = getClientIp(req);

    if (!cuit || !monto || !cbu) {
      return res.status(400).json({ ok: false, msg: 'Faltan CUIT, monto o CBU' });
    }

    if (monto <= 0) {
      return res.status(400).json({ ok: false, msg: 'El monto debe ser mayor a 0' });
    }

    await requireInternalWalletMode(cuit);

    const totals = await computeWalletTotals(cuit);
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ ok: false, msg: 'El monto debe ser mayor a 0' });
    }
    if (montoNum > totals.available) {
      return res.status(400).json({ ok: false, msg: 'Saldo insuficiente' });
    }

    // Validar cliente
    const [clientes] = await db.query('SELECT id FROM clientes WHERE cuit = ?', [cuit]);
    if (clientes.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    }
    const cliente_id = clientes[0].id;

    // Email del cliente (desde users)
    const [emailRows] = await db.query(
      'SELECT email FROM users WHERE REPLACE(cuit, "-", "") = ? LIMIT 1',
      [normalizeCuit(cuit)]
    );
    const email = emailRows?.[0]?.email;
    if (!email) {
      return res.status(400).json({ ok: false, msg: 'El cliente no tiene email registrado' });
    }

    await ensureRetiroTokenColumns();
    await ensureRetiroDoubleTokenColumns();

    const [pendingRows] = await db.query(
      "SELECT id, estado, monto, cbu FROM retiros WHERE cuit = ? AND estado IN ('PENDIENTE_TOKEN','PENDIENTE_TOKEN2','VALIDATION','PROCESSING') ORDER BY id DESC LIMIT 1",
      [cuit]
    );
    if (pendingRows && pendingRows.length > 0) {
      const pending = pendingRows[0];
      const pendingEstado = String(pending?.estado || '').toUpperCase();
      const pendingId = pending?.id;
      const pendingMonto = Number(pending?.monto || 0);

      if (['PENDIENTE_TOKEN', 'PENDIENTE_TOKEN2'].includes(pendingEstado)) {
        const token = generateRetiroToken();
        const tokenHash = hashRetiroToken(token);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.query(
          `UPDATE retiros
           SET estado = 'PENDIENTE_TOKEN',
               token_hash = ?,
               token_expires_at = ?,
               token_sent_at = NOW(),
               token_attempts = 0,
               token_verified_at = NULL,
               token2_hash = NULL,
               token2_expires_at = NULL,
               token2_sent_at = NULL,
               token2_attempts = 0,
               ip_solicitante = ?
           WHERE id = ?`,
          [tokenHash, expiresAt, ip, pendingId]
        );

        res.json({
          ok: true,
          id: pendingId,
          requires_token: true,
          msg: 'Ya tenías un retiro pendiente. Te reenviamos un código para autorizarlo.'
        });

        setImmediate(async () => {
          try {
            await sendRetiroTokenEmail({ to: email, token, monto: pendingMonto });
          } catch (e) {
            // noop
          }
          try {
            await db.query(
              'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
              [cuit, `Retiro reintento ID ${pendingId}: reenvío token (monto $${pendingMonto})`, ip]
            );
          } catch (e) {
            // noop
          }
        });

        return;
      }

      res.json({
        ok: true,
        id: pendingId,
        requires_token: false,
        msg: 'Ya tenés un retiro en proceso. Por favor esperá a que sea procesado.'
      });
      return;
    }

    const token = generateRetiroToken();
    const tokenHash = hashRetiroToken(token);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Crear retiro: primer factor
    const [result] = await db.query(
      `INSERT INTO retiros 
       (cuit, cliente_id, cbu, monto, estado, solicitado_at, ip_solicitante, token_hash, token_expires_at, token_sent_at, token_attempts, created_at) 
       VALUES (?,?,?,?,?,NOW(),?,?,?,NOW(),0,NOW())`,
      [cuit, cliente_id, cbu, montoNum, 'PENDIENTE_TOKEN', ip, tokenHash, expiresAt]
    );

    const retiroId = result.insertId;

    res.json({
      ok: true,
      id: retiroId,
      requires_token: true,
      msg: 'Te enviamos un código a tu correo para autorizar el retiro.'
    });

    setImmediate(async () => {
      try {
        await sendRetiroTokenEmail({ to: email, token, monto: montoNum });
      } catch (e) {
        // noop
      }
      try {
        await db.query(
          'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
          [cuit, `Retiro solicitado ID ${retiroId}: $${montoNum} a CBU ${cbu}`, ip]
        );
      } catch (e) {
        // noop
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

 export const confirmarRetiroToken = async (req, res) => {
   try {
     const cuit = req.user?.cuit || req.body?.cuit;
     const { id, token } = req.body;
     const ip = getClientIp(req);

     if (!cuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });
     if (!id) return res.status(400).json({ ok: false, msg: 'Falta ID del retiro' });
     if (!token) return res.status(400).json({ ok: false, msg: 'Falta token' });

     await requireInternalWalletMode(cuit);
     await ensureRetiroTokenColumns();
     await ensureRetiroDoubleTokenColumns();

     const [rows] = await db.query('SELECT * FROM retiros WHERE id = ?', [id]);
     if (!rows || rows.length === 0) return res.status(404).json({ ok: false, msg: 'Retiro no encontrado' });

     const retiro = rows[0];
     if (normalizeCuit(retiro.cuit) !== normalizeCuit(cuit)) {
       return res.status(403).json({ ok: false, msg: 'No autorizado' });
     }

     if (retiro.estado !== 'PENDIENTE_TOKEN') {
       return res.status(400).json({ ok: false, msg: `No se puede confirmar retiro con estado ${retiro.estado}` });
     }

     const exp = retiro.token_expires_at ? new Date(retiro.token_expires_at) : null;
     if (!exp || Number.isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
       return res.status(400).json({ ok: false, msg: 'El token expiró. Vuelve a solicitar el retiro.' });
     }

     const tokenHash = hashRetiroToken(String(token).trim());
     if (!retiro.token_hash || tokenHash !== String(retiro.token_hash)) {
       await db.query(
         'UPDATE retiros SET token_attempts = token_attempts + 1 WHERE id = ?',
         [id]
       );
       return res.status(400).json({ ok: false, msg: 'Token inválido' });
     }

     // Token 1 ok -> generar Token 2
     const token2 = generateRetiroToken();
     const token2Hash = hashRetiroToken(token2);
     const token2ExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

     await db.query(
       `UPDATE retiros
        SET estado = 'PENDIENTE_TOKEN2',
            token_verified_at = NOW(),
            token_hash = NULL,
            token_expires_at = NULL,
            token_sent_at = NULL,
            token2_hash = ?,
            token2_expires_at = ?,
            token2_sent_at = NOW(),
            token2_attempts = 0
        WHERE id = ?`,
       [token2Hash, token2ExpiresAt, id]
     );

     // Enviar token2 por email
     const [emailRows] = await db.query(
       'SELECT email FROM users WHERE REPLACE(cuit, "-", "") = ? LIMIT 1',
       [normalizeCuit(cuit)]
     );
     const email = emailRows?.[0]?.email;
     if (email) {
       await sendRetiroToken2Email({ to: email, token: token2, monto: retiro.monto });
     }

     // Auditoría
     await db.query(
       'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
       [cuit, `Retiro confirmado por token ID ${id}`, ip]
     );

     // Notificar al cliente que su retiro fue solicitado
     try {
       await crearNotificacionRetiro(cuit, 'SOLICITADO', retiro.monto);
     } catch (nerr) {
       // Error al crear notificación de retiro SOLICITADO
     }

     res.json({ ok: true, requires_token2: true, msg: 'Primer factor validado. Te enviamos un segundo código para confirmar el retiro.' });
   } catch (e) {
     console.error(e);
     res.status(500).json({ ok: false, error: e.message });
   }
 };

// ============= LISTAR RETIROS PENDIENTES =============

export const listarRetirosPendientes = async (req, res) => {
  try {
    const { cuit, limit = 100, offset = 0 } = req.query;
    const adminCuit = req.user?.cuit;
    await ensureCodigoRetiroColumn();
    await ensureMovimientoIdColumn();
    await ensureRetirosOcultosTable();
    let sql = `
      SELECT r.*, cl.razon_social as nombre_cliente
      FROM retiros r
      JOIN (
        SELECT cuit, MAX(id) AS max_id
        FROM retiros
        WHERE estado IN ('PENDIENTE_TOKEN', 'PENDIENTE_TOKEN2', 'VALIDATION', 'PROCESSING')
        GROUP BY cuit
      ) last ON last.max_id = r.id
      LEFT JOIN clientes cl ON r.cliente_id = cl.id
      WHERE r.estado IN ('PENDIENTE_TOKEN', 'PENDIENTE_TOKEN2', 'VALIDATION', 'PROCESSING')
    `;
    const params = [];

    // Permite al admin ocultar notificaciones de retiros pendientes sin borrar datos
    if (adminCuit) {
      sql += ` AND NOT EXISTS (
        SELECT 1 FROM retiros_ocultos ro
        WHERE ro.cuit = ? AND ro.retiro_id = r.id
      )`;
      params.push(adminCuit);
    }

    if (cuit) {
      sql += ' AND r.cuit = ?';
      params.push(cuit);
    }

    sql += ' ORDER BY r.solicitado_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);

    let countSql = `
      SELECT COUNT(*) as total
      FROM (
        SELECT cuit, MAX(id) AS max_id
        FROM retiros
        WHERE estado IN ("PENDIENTE_TOKEN","PENDIENTE_TOKEN2","VALIDATION","PROCESSING")
        GROUP BY cuit
      ) t
    `;
    const countParams = [];
    if (cuit) {
      countParams.push(cuit);
    }

    const [[{ total }]] = await db.query(
      cuit
        ? `SELECT COUNT(*) as total FROM (${countSql}) t2 JOIN retiros r ON r.id = t2.max_id WHERE r.cuit = ?`
        : countSql,
      cuit ? [cuit] : []
    );

    res.json({ ok: true, data: rows, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const eliminarRetiroAdmin = async (req, res) => {
  try {
    const { id, motivo } = req.body;
    const admin = req.user?.email || req.user?.cuit || 'admin';
    const ip = getClientIp(req);

    await ensureMovimientoIdColumn();

    if (!id) return res.status(400).json({ ok: false, msg: 'Falta ID del retiro' });

    const [rows] = await db.query('SELECT * FROM retiros WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, msg: 'Retiro no encontrado' });

    const retiro = rows[0];

    // Si hay movimiento asociado, lo eliminamos lógicamente también
    if (retiro.movimiento_id) {
      await db.query('UPDATE movimientos SET estado = ? WHERE id = ?', ['ELIMINADO', retiro.movimiento_id]);
    }

    await db.query(
      'UPDATE retiros SET estado = ?, observaciones = CONCAT(IFNULL(observaciones, \'\'), ?, \'\n\'), aprobado_at = IFNULL(aprobado_at, NOW()) WHERE id = ?',
      ['ELIMINADO', `Eliminado por admin ${admin}. Motivo: ${motivo || 'Sin especificar'}`, id]
    );

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [admin, `Retiro eliminado ID ${id} (movimiento_id: ${retiro.movimiento_id || 'N/A'})`, ip]
    );

    res.json({ ok: true, msg: 'Retiro eliminado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const ocultarRetirosAdmin = async (req, res) => {
  try {
    const adminCuit = req.user?.cuit;
    const { ids } = req.body;

    if (!adminCuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, msg: 'Faltan ids' });

    await ensureRetirosOcultosTable();

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id FROM retiros WHERE id IN (${placeholders})`,
      [...ids]
    );

    if (!rows || rows.length === 0) {
      return res.json({ ok: true, ocultados: 0 });
    }

    const values = rows.map(r => [adminCuit, r.id]);
    await db.query(
      'INSERT IGNORE INTO retiros_ocultos (cuit, retiro_id) VALUES ?',
      [values]
    );

    res.json({ ok: true, ocultados: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ============= LISTAR HISTÓRICO DE RETIROS =============

export const listarHistoricoRetiros = async (req, res) => {
  try {
    const { cuit, limit = 100, offset = 0 } = req.query;
    const cuitParam = req.params.cuit;
    const finalCuit = cuitParam || cuit;
    await ensureCodigoRetiroColumn();
    await ensureMovimientoIdColumn();
    await ensureRetirosOcultosTable();
    
    let sql = `
      SELECT r.*, cl.razon_social as nombre_cliente
      FROM retiros r
      LEFT JOIN clientes cl ON r.cliente_id = cl.id
    `;
    const params = [];

    if (finalCuit) {
      sql += ' WHERE r.cuit = ? AND r.estado IN ("PAGADO","REJECTED","APPROVED")';
      params.push(finalCuit);
      sql += ` AND NOT EXISTS (
        SELECT 1 FROM retiros_ocultos ro
        WHERE ro.cuit = r.cuit AND ro.retiro_id = r.id
      )`;
    } else {
      sql += ' WHERE r.estado IN ("PAGADO","REJECTED","APPROVED")';
    }

    sql += ' ORDER BY r.solicitado_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM retiros';
    const countParams = [];
    if (finalCuit) {
      countSql += ' WHERE cuit = ?';
      countParams.push(finalCuit);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    res.json({ ok: true, data: rows, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ============= APROBAR RETIRO =============

export const aprobarRetiro = async (req, res) => {
  try {
    const { id } = req.body;
    const aprobador = req.user?.email || 'admin';
    const ip = getClientIp(req);

    console.log('=== APROBAR RETIRO DEBUG ===');
    console.log('ID recibido:', id);
    console.log('Aprobador:', aprobador);
    console.log('IP:', ip);

    await ensureCodigoRetiroColumn();
    await ensureMovimientoIdColumn();

    if (!id) {
      console.log('ERROR: Falta ID del retiro');
      return res.status(400).json({ ok: false, msg: 'Falta ID del retiro' });
    }

    // Obtener retiro
    const [retiros] = await db.query('SELECT * FROM retiros WHERE id = ?', [id]);
    if (retiros.length === 0) {
      console.log('ERROR: Retiro no encontrado');
      return res.status(404).json({ ok: false, msg: 'Retiro no encontrado' });
    }

    const retiro = retiros[0];
    console.log('Retiro encontrado:', retiro);
    console.log('Estado del retiro:', retiro.estado);

    if (!['VALIDATION', 'PROCESSING'].includes(String(retiro.estado || '').toUpperCase())) {
      console.log('ERROR: Estado no permitido para aprobación:', retiro.estado);
      return res.status(400).json({ ok: false, msg: `No se puede aprobar retiro con estado ${retiro.estado}` });
    }

    await ensureWithdrawHoldsTable();

    const montoRetiro = Number(retiro.monto ?? 0);
    console.log('Monto del retiro:', montoRetiro);
    
    if (!Number.isFinite(montoRetiro) || montoRetiro <= 0) {
      console.log('ERROR: Monto inválido:', montoRetiro);
      return res.status(400).json({ ok: false, msg: 'Monto inválido' });
    }

    const [holdRows] = await db.query(
      "SELECT id, amount, status FROM withdraw_holds WHERE retiro_id = ? AND status = 'HELD' ORDER BY id DESC LIMIT 1",
      [id]
    );
    console.log('Holds encontrados:', holdRows);
    
    if (!holdRows.length) {
      console.log('ERROR: No hay reserva de saldo para este retiro');
      return res.status(400).json({ ok: false, msg: 'No hay reserva de saldo para este retiro' });
    }
    const hold = holdRows[0];

    const reserved = Number(hold.amount || 0);
    console.log('Monto reservado:', reserved);
    console.log('¿Coinciden montos?', reserved === montoRetiro);
    
    if (!Number.isFinite(reserved) || reserved <= 0 || reserved !== montoRetiro) {
      console.log('ERROR: La reserva no coincide con el monto del retiro');
      return res.status(400).json({ ok: false, msg: 'La reserva no coincide con el monto del retiro' });
    }

    // Crear movimiento de pago (negativo para restar del saldo)
    const [movResult] = await db.query(
      `INSERT INTO movimientos 
       (cuit, cliente_id, tipo_movimiento, montoBruto, arancel, comision, neto, estado, aprobador, aprobada_at, usuario_creador, ip_creador, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?,NOW(),?,?,NOW())`,
      [retiro.cuit, retiro.cliente_id, 'PAGO_RETIRO', -montoRetiro, 0, 0, -montoRetiro, 'APROBADO', aprobador, aprobador, ip]
    );

    await db.query('START TRANSACTION');
    try {
      // Actualizar retiro
      await db.query(
        'UPDATE retiros SET estado = ?, aprobado_at = NOW(), usuario_aprobador = ?, movimiento_id = ? WHERE id = ?',
        ['APPROVED', aprobador, movResult.insertId, id]
      );

      await db.query(
        "UPDATE retiros SET estado = 'ELIMINADO', aprobado_at = IFNULL(aprobado_at, NOW()), usuario_aprobador = ?, observaciones = CONCAT(IFNULL(observaciones,''), 'Cancelado por duplicado (aprobado otro retiro).\n') WHERE cuit = ? AND id <> ? AND estado IN ('PENDIENTE_TOKEN','PENDIENTE_TOKEN2','VALIDATION','PROCESSING')",
        [aprobador, retiro.cuit, id]
      );

      // Debitar definitivamente
      await db.query(
        'INSERT INTO wallet_movements (cuit, movimiento_id, monto, tipo, created_at) VALUES (?,?,?,?,NOW())',
        [retiro.cuit, movResult.insertId, -montoRetiro, 'WITHDRAW_APPROVED']
      );

      // Consumir hold
      await db.query(
        "UPDATE withdraw_holds SET status = 'CAPTURED' WHERE id = ?",
        [hold.id]
      );

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    // Generar y guardar código de retiro (solo si no existe)
    const [[retiroActualizado]] = await db.query('SELECT codigo_retiro FROM retiros WHERE id = ?', [id]);
    if (!retiroActualizado?.codigo_retiro) {
      const codigo = await generarCodigoRetiro();
      await db.query('UPDATE retiros SET codigo_retiro = ? WHERE id = ?', [codigo, id]);
    }

    const [[retiroConCodigo]] = await db.query('SELECT * FROM retiros WHERE id = ?', [id]);
    const [clienteRows] = await db.query('SELECT razon_social FROM clientes WHERE id = ? LIMIT 1', [retiroConCodigo?.cliente_id]);
    const clienteNombre = clienteRows?.[0]?.razon_social || 'Cliente';
    const [emailRows] = await db.query(
      'SELECT email FROM users WHERE REPLACE(cuit, "-", "") = ? LIMIT 1',
      [normalizeCuit(retiroConCodigo?.cuit)]
    );
    const email = emailRows?.[0]?.email;
    if (email) {
      try {
        await sendRetiroComprobanteEmail({ to: email, retiro: retiroConCodigo, clienteNombre });
      } catch (mailErr) {
        console.error('Error enviando comprobante de retiro:', mailErr);
      }
    }

    // Crear notificación
    try {
      await crearNotificacionRetiro(retiro.cuit, 'APPROVED', montoRetiro);
    } catch (nerr) {
      // Error al crear notificación de retiro PAGADO
    }

    // Registrar auditoría
    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [aprobador, `APROBAR RETIRO ID:${id} - MONTO:${montoRetiro}`, ip]
    );

    res.json({ 
      ok: true, 
      msg: 'Retiro aprobado.'
    });
  } catch (error) {
    console.error('Error al aprobar retiro:', error);
    res.status(500).json({ ok: false, msg: 'Error al aprobar retiro' });
  }
};

// ============= RECHAZAR RETIRO =============

export const rechazarRetiro = async (req, res) => {
  try {
    const { id, motivo } = req.body;
    const aprobador = req.user?.email || 'admin';
    const ip = getClientIp(req);

    if (!id) return res.status(400).json({ ok: false, msg: 'Falta ID del retiro' });

    const [retiros] = await db.query('SELECT * FROM retiros WHERE id = ?', [id]);
    if (retiros.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Retiro no encontrado' });
    }

    const retiro = retiros[0];

    if (!['VALIDATION', 'PROCESSING', 'PENDIENTE_TOKEN', 'PENDIENTE_TOKEN2'].includes(String(retiro.estado || '').toUpperCase())) {
      return res.status(400).json({ ok: false, msg: `No se puede rechazar retiro con estado ${retiro.estado}` });
    }

    await ensureWithdrawHoldsTable();

    await db.query('START TRANSACTION');
    try {
      await db.query(
        'UPDATE retiros SET estado = ?, usuario_aprobador = ?, aprobado_at = NOW(), observaciones = ? WHERE id = ?',
        ['REJECTED', aprobador, motivo || 'Sin especificar', id]
      );

      await db.query(
        "UPDATE retiros SET estado = 'ELIMINADO', aprobado_at = IFNULL(aprobado_at, NOW()), usuario_aprobador = ?, observaciones = CONCAT(IFNULL(observaciones,''), 'Cancelado por duplicado (rechazado otro retiro).\n') WHERE cuit = ? AND id <> ? AND estado IN ('PENDIENTE_TOKEN','PENDIENTE_TOKEN2','VALIDATION','PROCESSING')",
        [aprobador, retiro.cuit, id]
      );

      await db.query(
        "UPDATE withdraw_holds SET status = 'RELEASED' WHERE retiro_id = ? AND status = 'HELD'",
        [id]
      );

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    // Crear notificación
    try {
      await crearNotificacionRetiro(retiro.cuit, 'REJECTED', retiro.monto, motivo);
    } catch (nerr) {
      // Error al crear notificación de retiro RECHAZADO
    }

    // Registrar auditoría
    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [aprobador, `Retiro rechazado ID ${id} para CUIT ${retiro.cuit}: ${motivo}`, ip]
    );

    res.json({ ok: true, msg: 'Retiro rechazado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ============= OBTENER SALDO DEL CLIENTE =============

export const obtenerSaldoCliente = async (req, res) => {
  try {
    const { cuit } = req.params;

    const totals = await computeWalletTotals(cuit);
    res.json({
      ok: true,
      saldo: parseFloat(totals.available),
      saldo_disponible: parseFloat(totals.available),
      saldo_pendiente: parseFloat(totals.held),
      saldo_total: parseFloat(totals.total),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const ocultarRetirosCliente = async (req, res) => {
  try {
    const cuit = req.user?.cuit;
    const { ids } = req.body;

    if (!cuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, msg: 'Faltan ids' });

    await ensureRetirosOcultosTable();

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id FROM retiros WHERE cuit = ? AND id IN (${placeholders})`,
      [cuit, ...ids]
    );

    if (!rows || rows.length === 0) {
      return res.json({ ok: true, ocultados: 0 });
    }

    const values = rows.map(r => [cuit, r.id]);
    await db.query(
      'INSERT IGNORE INTO retiros_ocultos (cuit, retiro_id) VALUES ?',
      [values]
    );

    res.json({ ok: true, ocultados: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const ocultarTodoHistoricoRetirosCliente = async (req, res) => {
  try {
    const cuit = req.user?.cuit;
    if (!cuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });

    await ensureRetirosOcultosTable();

    await db.query(
      `INSERT IGNORE INTO retiros_ocultos (cuit, retiro_id)
       SELECT ?, r.id FROM retiros r WHERE r.cuit = ?`,
      [cuit, cuit]
    );

    res.json({ ok: true, msg: 'Histórico de retiros ocultado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
