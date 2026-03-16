import 'dotenv/config';
import nodemailer from 'nodemailer';
import { db } from '../config/db.js';
import { crearNotificacionCupon, crearNotificacionAjuste, crearNotificacionRetiro } from './notificacionesController.js';

const mailPort = Number(process.env.MAIL_PORT) || 587;
const mailSecureEnv = String(process.env.MAIL_SECURE || '').trim().toLowerCase();
const mailSecure = mailSecureEnv ? (mailSecureEnv === 'true' || mailSecureEnv === '1') : (mailPort === 465);
const mailFamily = Number(process.env.MAIL_FAMILY || 0);
const mailRequireTlsEnv = String(process.env.MAIL_REQUIRE_TLS || '').trim().toLowerCase();
const mailRequireTls = mailRequireTlsEnv
  ? (mailRequireTlsEnv === 'true' || mailRequireTlsEnv === '1')
  : (!mailSecure && mailPort === 587);

const mailer = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: mailPort,
  secure: mailSecure,
  ...(mailFamily ? { family: mailFamily } : {}),
  requireTLS: mailRequireTls,
  connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 8000),
  greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 8000),
  socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 12000),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Cola simple en memoria para enviar emails sin bloquear requests.
// Limita concurrencia para evitar saturar el SMTP.
const CUPON_EMAIL_CONCURRENCY = Number(process.env.CUPON_EMAIL_CONCURRENCY || 3);
const cuponEmailQueue = [];
let cuponEmailActive = 0;

const pumpCuponEmailQueue = () => {
  while (cuponEmailActive < CUPON_EMAIL_CONCURRENCY && cuponEmailQueue.length > 0) {
    const movimientoId = cuponEmailQueue.shift();
    cuponEmailActive += 1;
    Promise.resolve()
      .then(() => enviarCuponEmailInternal(movimientoId))
      .catch(() => {
        // no-op: no interrumpimos la cola por fallos de SMTP
      })
      .finally(() => {
        cuponEmailActive -= 1;
        setImmediate(pumpCuponEmailQueue);
      });
  }
};

const enqueueCuponEmail = (movimientoId) => {
  if (!movimientoId) return;
  cuponEmailQueue.push(Number(movimientoId));
  setImmediate(pumpCuponEmailQueue);
};

// UTILIDADES
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket.remoteAddress || 
         'unknown';
};

const ensureMovimientosOcultosTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS movimientos_ocultos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cuit VARCHAR(50) NOT NULL,
      movimiento_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_cuit_mov (cuit, movimiento_id)
    )
  `);
};

const ensureCuponesExtraColumns = async () => {
  const ensureColumn = async (column, ddl) => {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cupones' AND COLUMN_NAME = ?`,
      [column]
    );
    if (!cols.length) {
      await db.query(ddl);
    }
  };

  await ensureColumn('codigo_cupon', "ALTER TABLE cupones ADD COLUMN codigo_cupon VARCHAR(20) NULL");
  await ensureColumn('detalle_cupon', "ALTER TABLE cupones ADD COLUMN detalle_cupon VARCHAR(255) NULL");
  await ensureColumn('comision_flux_pct', "ALTER TABLE cupones ADD COLUMN comision_flux_pct DECIMAL(10,2) NULL");
  await ensureColumn('conciliacion_bancaria_pct', "ALTER TABLE cupones ADD COLUMN conciliacion_bancaria_pct DECIMAL(10,2) NULL");
  await ensureColumn('iva_comision_flux_pct', "ALTER TABLE cupones ADD COLUMN iva_comision_flux_pct DECIMAL(10,2) NULL");
  await ensureColumn('cbu_cvu', "ALTER TABLE cupones ADD COLUMN cbu_cvu VARCHAR(50) NULL");
};

const ensureCuentasBancariasClienteTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS cuentas_bancarias_cliente (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      cbu VARCHAR(50) NOT NULL,
      alias VARCHAR(50) NULL,
      banco VARCHAR(120) NULL,
      is_default TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    )
  `);
};

const resolveCbuCvuForMovimiento = async ({ cuit }) => {
  await ensureCuentasBancariasClienteTable();

  const normalizedCuit = String(cuit || '').replace(/[^0-9]/g, '');
  if (!normalizedCuit) return null;

  const [defRows] = await db.query(
    `SELECT cb.cbu
     FROM clientes cl
     LEFT JOIN cuentas_bancarias_cliente cb ON cb.cliente_id = cl.id AND cb.is_default = 1
     WHERE REPLACE(cl.cuit, '-', '') = ?
     LIMIT 1`,
    [normalizedCuit]
  );
  const defCbu = defRows?.[0]?.cbu;
  if (defCbu) return String(defCbu);

  const [regRows] = await db.query(
    `SELECT cbu_registro
     FROM clientes
     WHERE REPLACE(cuit, '-', '') = ?
     LIMIT 1`,
    [normalizedCuit]
  );
  const regCbu = regRows?.[0]?.cbu_registro;
  if (regCbu) return String(regCbu);

  return null;
};

const ensureCuponEmailLogsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS cupon_email_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      movimiento_id INT NOT NULL,
      email VARCHAR(255) NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_movimiento (movimiento_id)
    )
  `);
};

const enviarCuponEmailInternal = async (movimientoId) => {
  await ensureCuponesExtraColumns();
  await ensureCuponEmailLogsTable();

  // Idempotencia fuerte:
  // 1) Intentar reservar el envío antes de mandar el correo.
  // 2) Si ya existe el log (unique movimiento_id), omitimos.
  // 3) Si el envío falla, eliminamos la reserva para permitir reintento.
  try {
    await db.query('INSERT INTO cupon_email_logs (movimiento_id, email) VALUES (?, NULL)', [movimientoId]);
  } catch (e) {
    return { ok: true, skipped: true };
  }

  const [rows] = await db.query(
    `SELECT
      m.id,
      m.cuit,
      m.montoBruto,
      m.arancel,
      m.ajuste,
      m.comision,
      m.neto,
      m.estado,
      m.created_at,
      cl.razon_social,
      cl.alias,
      s.nombre as sucursal_nombre,
      cp.codigo_cupon,
      cp.detalle_cupon,
      cp.numero_autorizacion,
      cp.fecha_transaccion,
      cp.comision_flux_pct,
      cp.conciliacion_bancaria_pct,
      cp.iva_comision_flux_pct,
      cp.cbu_cvu,
      u.email as email
    FROM movimientos m
    LEFT JOIN clientes cl ON m.cliente_id = cl.id
    LEFT JOIN sucursales s ON m.sucursal_id = s.id
    LEFT JOIN cupones cp ON cp.movimiento_id = m.id
    LEFT JOIN terminales t ON t.id = cp.terminal_id
    LEFT JOIN users u ON REPLACE(u.cuit, '-', '') = REPLACE(m.cuit, '-', '')
    WHERE m.id = ? AND m.tipo_movimiento = 'CUPON'
    LIMIT 1`,
    [movimientoId]
  );

  if (!rows.length) {
    const err = new Error('Cupón no encontrado');
    err.statusCode = 404;
    throw err;
  }

  const cupon = rows[0];
  let email = cupon.email;
  if (!email && cupon.cuit) {
    const [clienteRows] = await db.query('SELECT email FROM clientes WHERE cuit = ?', [cupon.cuit]);
    if (clienteRows.length && clienteRows[0].email) {
      email = clienteRows[0].email;
    }
  }
  if (!email) {
    const err = new Error('El cliente no tiene email registrado');
    err.statusCode = 400;
    throw err;
  }

  const bruto = Number(cupon.montoBruto || 0);
  const comision = Number(cupon.comision || 0);
  const conciliacion = Number(cupon.ajuste || 0);
  const arancel = Number(cupon.arancel || 0);
  const neto = Number(cupon.neto || 0);
  let cbuCvu = (cupon.cbu_cvu || '').toString().trim();
  if (!cbuCvu) {
    try {
      const resolved = await resolveCbuCvuForMovimiento({
        cuit: cupon.cuit,
      });
      if (resolved) cbuCvu = String(resolved).trim();
    } catch (e) {
      // noop
    }
  }
  cbuCvu = cbuCvu || '-';
  const ivaPct = Number(cupon.iva_comision_flux_pct || 0);
  const ivaComision = ivaPct > 0 ? (comision * (ivaPct / 100)) : 0;
  const totalDescuentos = Math.max(0, comision + ivaComision + conciliacion + arancel);

  const formatCurrency = (n) => {
    const value = Number(n || 0);
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (d) => {
    const dt = d ? new Date(d) : null;
    if (!dt || Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('es-AR');
  };

  const clienteNombre = (cupon.razon_social || cupon.alias || 'Cliente').toString();
  const codigo = (cupon.codigo_cupon || '').toString().trim() || String(cupon.id);
  const fecha = formatDate(cupon.created_at || cupon.fecha_transaccion);
  const detalle = (cupon.detalle_cupon || '').toString().trim() || '-';
  const numeroAut = (cupon.numero_autorizacion || '').toString().trim() || '-';
  const logoUrl = `${process.env.PUBLIC_BASE_URL || 'https://arwpay.com'}/LogoArgen.png`;

      const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; background:#ffffff; padding:24px;">
        <div style="max-width:720px; margin:0 auto; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="padding:18px 20px; background:#ffffff; text-align:center;">
            <img
              src="https://fluxmediosdigitales.com/fluxRosa.jpeg"
              style="width:100%; max-width:600px; height:auto; display:block; margin:0 auto;"
              alt="Imagen"
            />
          </div>
                <div style="background:#f472b6; color:#0f172a; padding:10px 16px; font-weight:900; text-align:center;">Liquidación a Comercios</div>

          <div style="padding:18px 20px; background:#ffffff;">
            <div style="font-size:14px; color:#111827; font-weight:800;">Hola ${clienteNombre}</div>
            <div style="font-size:12px; color:#374151; margin-top:6px;">Gracias por confiar en nosotros, a continuación dejamos la presentación de tu cupón.</div>

             <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; border:1px solid #e5e7eb; border-radius:10px; overflow:visible;">
              <div style="flex:1; min-width:105px; padding:10px 12px; background:#fff;">
                <div style="font-size:11px; color:#6b7280; font-weight:800;">ID</div>
                <div style="font-size:12px; color:#111827; font-weight:900; word-break:break-all;">${codigo}</div>
              </div>
              <div style="flex:1; min-width:380px; padding:10px 20px; background:#fff; border-left:1px solid #e5e7eb; white-space: normal; box-sizing: border-box;">
                <div style="font-size:11px; color:#6b7280; font-weight:800;">Fecha</div>
                <div style="font-size:12px; color:#111827; font-weight:900; overflow: visible; width: 100%; display: inline-block; white-space: normal;">${fecha}</div>
              </div>
              <div style="flex:1; min-width:180px; padding:10px 12px; background:#fff; border-left:1px solid #e5e7eb;">
                <div style="font-size:11px; color:#6b7280; font-weight:800;">Total acreditado</div>
                <div style="font-size:12px; color:#111827; font-weight:900;">$${formatCurrency(neto)}</div>
                <div style="font-size:11px; color:#6b7280; font-weight:800; margin-top:6px;">Total</div>
                <div style="font-size:12px; color:#111827; font-weight:900;">$${formatCurrency(bruto)}</div>
              </div>
            </div>

            <div style="margin-top:14px; background:#0b2a6a; color:#fff; font-weight:900; text-align:center; padding:10px; border-radius:10px;">Detalles del cupón</div>

            <div style="margin-top:10px; border:0px solid #fbcfe8; border-radius:10px; overflow:hidden;">
              <div style="display:flex; gap:0; padding:1px; background:#f9a8d4;">
                <div style="flex:1; padding:0 14px 0 0; min-width: 120px;">
                  <div style="font-size:11px; color:#111827; font-weight:900;">Concepto</div>
                  <div style="font-size:12px; color:#111827; font-weight:900;">Acreditación de cupones</div>
                </div>
                <div style="flex:1; padding:0 20px; border-left:2px solid rgba(15, 23, 42, 0.18);">
                  <div style="font-size:11px; color:#111827; font-weight:900;">Detalle</div>
                  <div style="font-size:12px; color:#111827; font-weight:900;">${detalle} ${numeroAut !== '-' ? `• ${numeroAut}` : ''}</div>
                </div>
              </div>
            </div>
 <div style="margin-top:10px; border:0px solid #fbcfe8; border-radius:10px; overflow:hidden;">
              <div style="display:flex; gap:0; padding:1px; background:#f9a8d4;">
                <div style="flex:1; padding:0 14px 0 0; min-width: 120px;">
                  <div style="font-size:11px; color:#111827; font-weight:900;">Neto bruto</div>
                  <div style="font-size:12px; color:#111827; font-weight:900;">$${formatCurrency(bruto)}</div>
                </div>
              </div>
            </div>

            <div style="margin-top:14px; background:#0b2a6a; color:#fff; font-weight:900; text-align:center; padding:10px; border-radius:10px;">Descuentos</div>

            <div style="margin-top:10px; border:1px solid #fbcfe8; border-radius:10px; overflow:hidden;">
              <div style="padding:12px; background:#f9a8d4;">
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0;">Comisión Flux</td>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0; text-align:right;">$${formatCurrency(comision)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0;">IVA Com Flux</td>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0; text-align:right;">$${formatCurrency(ivaComision)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0;">Conciliación Bancaria</td>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0; text-align:right;">$${formatCurrency(conciliacion)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0;">Otros</td>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0; text-align:right;">$${formatCurrency(arancel)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0;">Total descuentos</td>
                    <td style="font-size:12px; font-weight:900; color:#111827; padding:6px 0; text-align:right;">$${formatCurrency(totalDescuentos)}</td>
                  </tr>
                </table>
                <div style="height:1px; background:#f472b6; margin:10px 0;"></div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:900; color:#111827;">
                  <div>Monto liquidado <br>
                  $${formatCurrency(neto)}</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:900; color:#111827; margin-top:6px;">
                  <div>En CBU/CVU<br>
                  ${cbuCvu}</div>
                </div>
              </div>
            </div>

            <div style="margin-top:14px; font-size:11px; color:#374151; line-height:1.5;">
              <div style="font-weight:900;">NORDATA MEDIOS DIGITALES S.A.S.</div>
              <div>CUIT: 30-71890890-2</div>
              <div>Av. Belgrano 687, Piso 8, Oficina 33 – CABA – CP 1092.</div>
              <div>El presente resumen no constituye una factura.</div>
              <div>
                Se detalla el importe bruto de los cupones ingresados en la cuenta recaudadora de NORDATA en su carácter de mayorista,
                 las comisiones aplicadas por nuestra administración, los gastos por conciliación bancaria y otros cargos asociados.
                  El importe neto resultante ha sido liquidado en la cuenta del comercio o empresa minorista informada.
              </div>
              <div>
                NORDATA actúa como intermediario entre las entidades emisoras (tarjetas y bancos) y la cuenta receptora del minorista.
                Los descuentos procesados por NORDATA incluyen el correspondiente IVA a favor del CUIT minorista.
                Las retenciones de Ingresos Brutos aplicadas dependen de la condición fiscal del CUIT y de los coeficientes y equivalencias establecidos por cada jurisdicción provincial, conforme al régimen de Convenio Multilateral y la actividad declarada por el contribuyente.
              </div>
              <div>
                Todos los descuentos efectuados por la administración no son computables,
                compensables, reembolsables, reintegrables ni transferibles bajo ningún concepto ni circunstancia.
              </div>
              <div>La información contenida es confidencial y está destinada exclusivamente al titular de la cuenta.</div>
            </div>
          </div>

          <div style="padding:14px; text-align:center; font-size:11px; color:#9ca3af; background:#fafafa;">Flux Medios Digitales</div>
        </div>
      </div>
    `;


  try {
    await mailer.sendMail({
      from: `Flux-wallet <${process.env.MAIL_USER}>`,
      to: email,
      subject: `Cupón ${codigo} - Liquidación`,
      html,
    });

    // Completar el log con el email real.
    await db.query('UPDATE cupon_email_logs SET email = ? WHERE movimiento_id = ? LIMIT 1', [email, movimientoId]);
  } catch (e) {
    try {
      console.error('[API][enviarCuponEmailInternal][smtp_error]', {
        movimientoId,
        email,
        code: e?.code,
        responseCode: e?.responseCode,
        message: e?.message,
      });
    } catch (logErr) {
      // noop
    }
    try {
      await db.query('DELETE FROM cupon_email_logs WHERE movimiento_id = ? LIMIT 1', [movimientoId]);
    } catch (e2) {
      // noop
    }
    throw e;
  }
  return { ok: true, skipped: false };
};

const generarCodigoCupon = async () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 25; i++) {
    let code = '';
    for (let j = 0; j < 10; j++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM cupones WHERE codigo_cupon = ?', [code]);
    if (Number(total) === 0) return code;
  }
  throw new Error('No se pudo generar un código de cupón único');
};

const toMySqlDateTime = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const result = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return result;
};

// ============= CUPONES =============

export const crearCupon = async (req, res) => {
  try {
    const {
      cuit,
      sucursal_id,
      terminal_id,
      montoBruto = 0,
      arancel: arancelBody = 0,
      detalle_cupon,
      comision_flux_pct,
      conciliacion_bancaria_pct,
      iva_comision_flux_pct,
      cbu_cvu: cbuCvuBody,
      fecha_transaccion
    } = req.body;

    try {
      console.log('[API][crearCupon][request]', {
        cuit,
        sucursal_id,
        terminal_id,
        montoBruto,
        arancel: arancelBody,
        detalle_cupon,
        comision_flux_pct,
        conciliacion_bancaria_pct,
        iva_comision_flux_pct,
        fecha_transaccion,
      });
    } catch (e) {
      // noop
    }
    const usuario = req.user?.email || 'sistema';
    const ip = getClientIp(req);

    await ensureCuponesExtraColumns();
    await ensureCuentasBancariasClienteTable();

    if (!cuit || !sucursal_id || !terminal_id) {
      return res.status(400).json({ ok: false, msg: 'Faltan CUIT, sucursal_id o terminal_id' });
    }

    // Validar que cliente existe (y traer CBU/CVU)
    const [clientes] = await db.query('SELECT id, cbu_registro FROM clientes WHERE cuit = ?', [cuit]);
    if (clientes.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    }
    const cliente_id = clientes[0].id;
    const fallbackCbu = clientes[0].cbu_registro || null;

    // Validar que sucursal pertenece al cliente
    const [sucursales] = await db.query('SELECT id FROM sucursales WHERE id = ? AND cliente_id = ?', [sucursal_id, cliente_id]);
    if (sucursales.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Sucursal no válida para este cliente' });
    }

    // Validar que terminal pertenece a la sucursal
    const [terminales] = await db.query('SELECT id FROM terminales WHERE id = ? AND sucursal_id = ?', [terminal_id, sucursal_id]);
    if (terminales.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Terminal no válida para esta sucursal' });
    }

    let resolvedCbu = null;
    const [defRows] = await db.query(
      'SELECT cbu FROM cuentas_bancarias_cliente WHERE cliente_id = ? AND is_default = 1 LIMIT 1',
      [cliente_id]
    );
    resolvedCbu = defRows[0]?.cbu || null;
    const normalizeCbu = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return null;
      const digits = raw.replace(/\D/g, '');
      // CBU Argentino suele ser 22 dígitos. Si aparece esa longitud, guardamos sólo dígitos.
      if (digits.length === 22) return digits;
      // Si no, preservamos el string original (puede ser CVU u otro identificador).
      return raw;
    };

    const cbuCvuRequested = normalizeCbu(cbuCvuBody);
    const cbu_cvu = cbuCvuRequested || resolvedCbu || fallbackCbu || null;

    const bruto = Number(montoBruto) || 0;
    if (bruto <= 0) {
      return res.status(400).json({ ok: false, msg: 'Monto bruto requerido y debe ser mayor a 0' });
    }

    const parsePct = (value, fallback) => {
      if (value === undefined || value === null || value === '') return fallback;
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const pctFlux = parsePct(comision_flux_pct, 3);
    const pctConc = parsePct(conciliacion_bancaria_pct, 3.7);
    const pctIvaFlux = parsePct(iva_comision_flux_pct, 21);

    // arancel viene como monto calculado desde frontend (otros % del bruto)
    const arancel = Number(arancelBody) || 0;

    if (pctFlux < 0 || pctConc < 0 || pctIvaFlux < 0 || arancel < 0) {
      return res.status(400).json({ ok: false, msg: 'Los porcentajes no pueden ser negativos' });
    }

    // Calcular descuentos
    // OTROS (arancel) descuenta del bruto, pero las comisiones se calculan sobre el bruto.
    const comision = bruto * (pctFlux / 100);
    const ivaComision = pctIvaFlux > 0 ? (comision * (pctIvaFlux / 100)) : 0;
    const ajuste = bruto * (pctConc / 100);
    
    // Neto = bruto - otros - comision - iva - conciliación
    const neto = bruto - arancel - comision - ivaComision - ajuste;

    const codigo_cupon = await generarCodigoCupon();

    // Crear movimiento
    const [result] = await db.query(
      `INSERT INTO movimientos 
       (cuit, cliente_id, sucursal_id, terminal_id, tipo_movimiento, montoBruto, arancel, ajuste, comision, neto, estado, usuario_creador, ip_creador, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cuit, cliente_id, sucursal_id, terminal_id, 'CUPON', bruto, arancel, ajuste, comision, neto, 'PENDIENTE', usuario, ip, toMySqlDateTime(fecha_transaccion)]
    );

    const movimiento_id = result.insertId;

    try {
      console.log('[API][crearCupon][created]', {
        movimiento_id,
        cuit,
        bruto,
        arancel,
        comision,
        ivaComision,
        ajuste,
        neto,
        estado: 'PENDIENTE',
      });
    } catch (e) {
      // noop
    }

    // Crear cupón
    await db.query(
      `INSERT INTO cupones 
       (movimiento_id, cliente_id, sucursal_id, terminal_id, monto_bruto, numero_autorizacion, fecha_transaccion, created_at, codigo_cupon, detalle_cupon, comision_flux_pct, conciliacion_bancaria_pct, iva_comision_flux_pct, cbu_cvu) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        movimiento_id,
        cliente_id,
        sucursal_id,
        terminal_id,
        bruto,
        (req.body?.numero_autorizacion || null),
        toMySqlDateTime(fecha_transaccion),
        toMySqlDateTime(fecha_transaccion),
        codigo_cupon,
        (detalle_cupon || null),
        pctFlux,
        pctConc,
        pctIvaFlux,
        cbu_cvu || null
      ]
    );

    // Registrar auditoría
    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [usuario, `Creado cupón ${movimiento_id} para CUIT ${cuit}`, ip]
    );

    // Notificar al cliente que tiene un cupón pendiente (creado desde Admin o API)
    try {
      await crearNotificacionCupon(cliente_id, cuit, 'PENDIENTE', neto);
    } catch (nerr) {
      // Error al crear notificación de cupón PENDIENTE
    }

    res.json({ ok: true, id: movimiento_id, neto, codigo_cupon, cbu_cvu });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const enviarCuponEmail = async (req, res) => {
  try {
    const { id, force } = req.body;
    if (!id) return res.status(400).json({ ok: false, msg: 'Falta id' });

    if (force) {
      try {
        await ensureCuponEmailLogsTable();
        await db.query('DELETE FROM cupon_email_logs WHERE movimiento_id = ? LIMIT 1', [Number(id)]);
      } catch (e) {
        // noop
      }
    }
    const r = await enviarCuponEmailInternal(Number(id));
    if (r && r.skipped) {
      return res.json({ ok: true, msg: 'Cupón ya enviado previamente (omitido).' });
    }
    return res.json({ ok: true, msg: 'Cupón enviado al correo.' });
  } catch (e) {
    try {
      console.error('[API][enviarCuponEmail][error]', {
        id: req?.body?.id,
        code: e?.code,
        responseCode: e?.responseCode,
        message: e?.message,
      });
    } catch (logErr) {
      // noop
    }
    const status = e?.statusCode || 500;
    res.status(status).json({ ok: false, msg: e?.message || 'Error al enviar el cupón por correo.' });
  }
};

export const listarMovimientos = async (req, res) => {
  try {
    const {
      cuit,
      tipo_movimiento,
      estado,
      fechaDesde,
      fechaHasta,
      excludeTipos,
      excludeEstados,
      limit = 50,
      offset = 0
    } = req.query;
    await ensureMovimientosOcultosTable();
    await ensureCuponesExtraColumns();
    let sql = `
      SELECT 
        m.id,
        m.cuit,
        m.cliente_id,
        m.sucursal_id,
        m.tipo_movimiento as tipo,
        m.tipo_movimiento,
        m.montoBruto,
        m.arancel,
        m.ajuste,
        m.comision,
        m.neto,
        m.estado,
        m.descripcion as detalle_descripcion,
        m.aprobador,
        m.aprobada_at,
        m.created_at,
        cl.razon_social as nombre_cliente,
        s.nombre as sucursal_nombre,
        s.direccion as sucursal_direccion,
        t.nombre as terminal_nombre,
        cp.marca_tarjeta,
        cp.numero_lote,
        cp.numero_autorizacion,
        cp.fecha_transaccion,
        cp.codigo_cupon,
        cp.detalle_cupon,
        cp.comision_flux_pct,
        cp.conciliacion_bancaria_pct,
        cp.iva_comision_flux_pct,
        cp.cbu_cvu,
        CASE 
          WHEN m.tipo_movimiento = 'PAGO_RETIRO' THEN 'Retiro Aprobado'
          WHEN m.tipo_movimiento = 'ACREDITACION' THEN 'Acreditación'
          WHEN m.tipo_movimiento = 'CUPON' THEN 'Cupón'
          WHEN m.tipo_movimiento = 'INGRESO' THEN 'Ingreso'
          ELSE m.tipo_movimiento
        END as descripcion
      FROM movimientos m
      LEFT JOIN clientes cl ON m.cliente_id = cl.id
      LEFT JOIN sucursales s ON m.sucursal_id = s.id
      LEFT JOIN terminales t ON m.terminal_id = t.id
      LEFT JOIN cupones cp ON cp.movimiento_id = m.id
      WHERE 1=1
    `;
    const params = [];

    const parseCsv = (value) => {
      if (!value) return [];
      return String(value)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    };

    const excludedTipos = parseCsv(excludeTipos);
    const excludedEstados = parseCsv(excludeEstados);

    if (cuit) {
      sql += ' AND m.cuit = ?';
      params.push(cuit);
      sql += ` AND NOT EXISTS (
        SELECT 1 FROM movimientos_ocultos mo
        WHERE mo.cuit = m.cuit AND mo.movimiento_id = m.id
      )`;
    }
    if (tipo_movimiento) {
      sql += ' AND m.tipo_movimiento = ?';
      params.push(tipo_movimiento);
    }
    if (estado) {
      sql += ' AND m.estado = ?';
      params.push(estado);
    }

    if (excludedTipos.length > 0) {
      sql += ` AND m.tipo_movimiento NOT IN (${excludedTipos.map(() => '?').join(', ')})`;
      params.push(...excludedTipos);
    }

    if (excludedEstados.length > 0) {
      sql += ` AND m.estado NOT IN (${excludedEstados.map(() => '?').join(', ')})`;
      params.push(...excludedEstados);
    }

    if (fechaDesde) {
      sql += ' AND DATE(COALESCE(m.aprobada_at, m.created_at)) >= DATE(?)';
      params.push(fechaDesde);
    }

    if (fechaHasta) {
      sql += ' AND DATE(COALESCE(m.aprobada_at, m.created_at)) <= DATE(?)';
      params.push(fechaHasta);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM movimientos m WHERE 1=1';
    const countParams = [];
    if (cuit) {
      countSql += ' AND m.cuit = ?';
      countParams.push(cuit);
    }
    if (tipo_movimiento) {
      countSql += ' AND m.tipo_movimiento = ?';
      countParams.push(tipo_movimiento);
    }
    if (estado) {
      countSql += ' AND m.estado = ?';
      countParams.push(estado);
    }

    if (excludedTipos.length > 0) {
      countSql += ` AND m.tipo_movimiento NOT IN (${excludedTipos.map(() => '?').join(', ')})`;
      countParams.push(...excludedTipos);
    }

    if (excludedEstados.length > 0) {
      countSql += ` AND m.estado NOT IN (${excludedEstados.map(() => '?').join(', ')})`;
      countParams.push(...excludedEstados);
    }

    if (fechaDesde) {
      countSql += ' AND DATE(COALESCE(m.aprobada_at, m.created_at)) >= DATE(?)';
      countParams.push(fechaDesde);
    }

    if (fechaHasta) {
      countSql += ' AND DATE(COALESCE(m.aprobada_at, m.created_at)) <= DATE(?)';
      countParams.push(fechaHasta);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    res.json({ ok: true, data: rows, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ============= AJUSTES NEGATIVOS =============

export const crearAjuste = async (req, res) => {
  try {
    const { cuit, sucursal_id, terminal_id, monto, motivo } = req.body;
    const usuario = req.user?.email || 'sistema';
    const ip = getClientIp(req);

    if (!cuit || !monto || !motivo) {
      return res.status(400).json({ ok: false, msg: 'Faltan CUIT, monto o motivo' });
    }

    if (monto > 0) {
      return res.status(400).json({ ok: false, msg: 'El monto debe ser negativo' });
    }

    // Validar cliente
    const [clientes] = await db.query('SELECT id FROM clientes WHERE cuit = ?', [cuit]);
    if (clientes.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    }
    const cliente_id = clientes[0].id;

    const [result] = await db.query(
      `INSERT INTO movimientos 
       (cuit, cliente_id, sucursal_id, terminal_id, tipo_movimiento, montoBruto, neto, descripcion, estado, usuario_creador, ip_creador, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [cuit, cliente_id, sucursal_id, terminal_id, 'AJUSTE_NEGATIVO', monto, monto, motivo, 'PENDIENTE', usuario, ip]
    );

    // Registrar auditoría
    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [usuario, `Creado ajuste negativo ${result.insertId} para CUIT ${cuit} por $${Math.abs(monto)}`, ip]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};


export const listarAjustes = async (req, res) => {
  try {
    const { cuit, estado, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT m.*, cl.razon_social as nombre_cliente
      FROM movimientos m
      LEFT JOIN clientes cl ON m.cliente_id = cl.id
      WHERE m.tipo_movimiento = 'AJUSTE_NEGATIVO'
    `;
    const params = [];

    if (cuit) {
      sql += ' AND m.cuit = ?';
      params.push(cuit);
    }
    if (estado) {
      sql += ' AND m.estado = ?';
      params.push(estado);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM movimientos WHERE tipo_movimiento = "AJUSTE_NEGATIVO"';
    const countParams = [];
    if (cuit) {
      countSql += ' AND cuit = ?';
      countParams.push(cuit);
    }
    if (estado) {
      countSql += ' AND estado = ?';
      countParams.push(estado);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    res.json({ ok: true, data: rows, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ============= APROBACIONES Y RECHAZOS =============

export const notificarCuponesCreados = async (req, res) => {
  try {
    const { cuit, mensaje } = req.body;
    
    if (!cuit || !mensaje) {
      return res.status(400).json({ ok: false, msg: 'Faltan CUIT o mensaje' });
    }

    // Obtener cliente
    const [clientes] = await db.query('SELECT id FROM clientes WHERE cuit = ?', [cuit]);
    if (clientes.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    }

    const cliente_id = clientes[0].id;
    
    // Obtener cupones pendientes del cliente
    const [cuponesPendientes] = await db.query(
      'SELECT * FROM movimientos WHERE cliente_id = ? AND tipo_movimiento = ? AND estado = ? ORDER BY created_at DESC LIMIT 10',
      [cliente_id, 'CUPON', 'PENDIENTE']
    );

    // Enviar una sola notificación general para todos los cupones
    try {
      await crearNotificacionCupon(cliente_id, cuit, 'PENDIENTE', 0, mensaje);
    } catch (error) {
      // Error al crear notificación general de cupones
    }

    res.json({ 
      ok: true, 
      msg: `Se envió notificación general sobre ${cuponesPendientes.length} cupones`,
      notificados: cuponesPendientes.length
    });

  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al enviar notificaciones' });
  }
};

export const rechazarTodosLosCupones = async (req, res) => {
  try {
    const { motivo } = req.body;
    const aprobador = req.user?.email || 'admin';
    const ip = getClientIp(req);

    if (!motivo) {
      return res.status(400).json({ ok: false, msg: 'El motivo es obligatorio para rechazar cupones' });
    }

    // Obtener todos los cupones pendientes
    const [cuponesPendientes] = await db.query(
      'SELECT * FROM movimientos WHERE tipo_movimiento = ? AND estado = ?',
      ['CUPON', 'PENDIENTE']
    );

    if (cuponesPendientes.length === 0) {
      return res.json({ ok: true, msg: 'No hay cupones pendientes para rechazar', rechazados: 0 });
    }

    let rechazados = 0;
    let errores = [];

    // Procesar cada cupón
    for (const cupon of cuponesPendientes) {
      try {
        // Actualizar movimiento
        await db.query(
          'UPDATE movimientos SET estado = ?, aprobador = ?, aprobada_at = NOW(), motivo_rechazo = ? WHERE id = ?',
          ['RECHAZADO', aprobador, motivo, cupon.id]
        );

        // Notificar al cliente que el cupón fue rechazado
        try {
          await crearNotificacionCupon(cupon.cliente_id, cupon.cuit, 'RECHAZADO', cupon.neto, motivo);
        } catch (nerr) {
          // Error al crear notificación de cupón RECHAZADO
        }

        rechazados++;
      } catch (error) {
        errores.push(`Cupón ID ${cupon.id}: ${error.message}`);
      }
    }

    // Registrar auditoría
    await db.query(
      'INSERT INTO auditoria_logs (accion, detalles, usuario, ip_origen, created_at) VALUES (?,?,?,?,NOW())',
      ['RECHAZAR_TODOS_CUPONES', `Rechazados ${rechazados} cupones pendientes. Motivo: ${motivo}`, aprobador, ip]
    );

    res.json({ 
      ok: true, 
      msg: `Se rechazaron ${rechazados} cupones exitosamente`, 
      rechazados,
      total: cuponesPendientes.length,
      errores: errores.length > 0 ? errores : undefined
    });

  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al rechazar todos los cupones' });
  }
};

export const aprobarTodosLosCupones = async (req, res) => {
  try {
    const aprobador = req.user?.email || 'admin';
    const ip = getClientIp(req);

    try {
      console.log('[API][aprobarTodosLosCupones][start]', { aprobador, ip });
    } catch (e) {
      // noop
    }

    // Obtener todos los cupones pendientes
    const [cuponesPendientes] = await db.query(
      'SELECT * FROM movimientos WHERE tipo_movimiento = ? AND estado = ?',
      ['CUPON', 'PENDIENTE']
    );

    if (cuponesPendientes.length === 0) {
      return res.json({ ok: true, msg: 'No hay cupones pendientes para aprobar', aprobados: 0 });
    }

    let aprobados = 0;
    let errores = [];
    const approvedIds = [];

    // Procesar cada cupón
    for (const cupon of cuponesPendientes) {
      try {
        try {
          console.log('[API][aprobarTodosLosCupones][item]', {
            id: cupon.id,
            cuit: cupon.cuit,
            neto: cupon.neto,
            estado: cupon.estado,
          });
        } catch (e) {
          // noop
        }

        // Actualizar movimiento
        await db.query(
          'UPDATE movimientos SET estado = ?, aprobador = ?, aprobada_at = NOW() WHERE id = ?',
          ['APROBADO', aprobador, cupon.id]
        );

        // Registrar en wallet
        await db.query(
          'INSERT INTO wallet_movements (cuit, movimiento_id, monto, tipo, created_at) VALUES (?,?,?,?,NOW())',
          [cupon.cuit, cupon.id, cupon.neto, 'ACREDITACION']
        );

        try {
          console.log('[API][aprobarTodosLosCupones][wallet_insert]', {
            movimiento_id: cupon.id,
            cuit: cupon.cuit,
            monto: cupon.neto,
            tipo: 'ACREDITACION',
          });
        } catch (e) {
          // noop
        }

        // Notificar al cliente que el cupón fue aprobado
        try {
          await crearNotificacionCupon(cupon.cliente_id, cupon.cuit, 'APROBADO', cupon.neto);
        } catch (nerr) {
          // Error al crear notificación de cupón APROBADO
        }

        approvedIds.push(cupon.id);

        // Si es retiro automático, generar pago automático
        const [clientes] = await db.query('SELECT config_retiro_automatico, cbu FROM clientes WHERE cuit = ?', [cupon.cuit]);
        if (clientes.length > 0 && clientes[0].config_retiro_automatico === 1) {
          // Crear movimiento de pago automático
          await db.query(
            `INSERT INTO movimientos 
             (cuit, cliente_id, tipo_movimiento, montoBruto, neto, descripcion, estado, aprobador, aprobada_at, usuario_creador, ip_creador, created_at) 
             VALUES (?,?,?,?,?,?,?,?,NOW(),?,?,NOW())`,
            [cupon.cuit, cupon.cliente_id, 'PAGO_RETIRO', -cupon.neto, -cupon.neto, 'Pago automático a CBU/CVU', 'APROBADO', aprobador, aprobador, ip]
          );
        }

        aprobados++;
      } catch (error) {
        errores.push(`Cupón ID ${cupon.id}: ${error.message}`);
      }
    }

    // Enviar emails en background para no demorar el response
    try {
      for (const id of approvedIds) enqueueCuponEmail(id);
    } catch (e) {
      // noop
    }

    // Registrar auditoría
    await db.query(
      'INSERT INTO auditoria_logs (accion, detalles, usuario, ip_origen, created_at) VALUES (?,?,?,?,NOW())',
      ['APROBAR_TODOS_CUPONES', `Aprobados ${aprobados} cupones pendientes`, aprobador, ip]
    );

    res.json({ 
      ok: true, 
      msg: `Se aprobaron ${aprobados} cupones exitosamente`, 
      aprobados,
      total: cuponesPendientes.length,
      errores: errores.length > 0 ? errores : undefined
    });

  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error al aprobar todos los cupones' });
  }
};

export const aprobarMovimiento = async (req, res) => {
  try {
    const { id } = req.body;
    const aprobador = req.user?.email || 'admin';
    const ip = getClientIp(req);

    try {
      console.log('[API][aprobarMovimiento][request]', { id, aprobador, ip });
    } catch (e) {
      // noop
    }

    if (!id) return res.status(400).json({ ok: false, msg: 'Falta id' });

    // Obtener movimiento
    const [movimientos] = await db.query('SELECT * FROM movimientos WHERE id = ?', [id]);
    if (movimientos.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Movimiento no encontrado' });
    }

    const mov = movimientos[0];

    try {
      console.log('[API][aprobarMovimiento][mov]', {
        id: mov.id,
        cuit: mov.cuit,
        tipo_movimiento: mov.tipo_movimiento,
        estado: mov.estado,
        neto: mov.neto,
        montoBruto: mov.montoBruto,
      });
    } catch (e) {
      // noop
    }

    // Validar estado
    if (mov.estado !== 'PENDIENTE') {
      return res.status(400).json({ ok: false, msg: `No se puede aprobar movimiento con estado ${mov.estado}` });
    }

    // Actualizar movimiento
    await db.query(
      'UPDATE movimientos SET estado = ?, aprobador = ?, aprobada_at = NOW() WHERE id = ?',
      ['APROBADO', aprobador, id]
    );

    // Registrar en wallet
    await db.query(
      'INSERT INTO wallet_movements (cuit, movimiento_id, monto, tipo, created_at) VALUES (?,?,?,?,NOW())',
      [mov.cuit, mov.id, mov.neto, mov.tipo_movimiento === 'AJUSTE_NEGATIVO' ? 'EGRESO' : 'ACREDITACION']
    );

    try {
      console.log('[API][aprobarMovimiento][wallet_insert]', {
        movimiento_id: mov.id,
        cuit: mov.cuit,
        monto: mov.neto,
        tipo: mov.tipo_movimiento === 'AJUSTE_NEGATIVO' ? 'EGRESO' : 'ACREDITACION',
      });
    } catch (e) {
      // noop
    }

    // Si es retiro automático, generar pago automático
    const [clientes] = await db.query('SELECT config_retiro_automatico, cbu FROM clientes WHERE cuit = ?', [mov.cuit]);
    if (clientes.length > 0 && clientes[0].config_retiro_automatico === 1 && mov.tipo_movimiento === 'CUPON') {
      // Crear movimiento de pago automático
      const [payResult] = await db.query(
        `INSERT INTO movimientos 
         (cuit, cliente_id, tipo_movimiento, montoBruto, neto, descripcion, estado, aprobador, aprobada_at, usuario_creador, ip_creador, created_at) 
         VALUES (?,?,?,?,?,?,?,?,NOW(),?,?,NOW())`,
        [mov.cuit, mov.cliente_id, 'PAGO_RETIRO', -mov.neto, -mov.neto, 'Pago automático a CBU/CVU', 'APROBADO', aprobador, aprobador, ip]
      );

      // Crear retiro automático
      await db.query(
        `INSERT INTO retiros 
         (cuit, cliente_id, movimiento_id, cbu, monto, estado, solicitado_at, aprobado_at, pagado_at, usuario_aprobador, ip_aprobador, created_at) 
         VALUES (?,?,?,?,?,?,NOW(),NOW(),NOW(),?,?,NOW())`,
        [mov.cuit, mov.cliente_id, payResult.insertId, clientes[0].cbu, mov.neto, 'PAGADO', aprobador, ip]
      );

      // Registrar pago en wallet
      await db.query(
        'INSERT INTO wallet_movements (cuit, movimiento_id, monto, tipo, created_at) VALUES (?,?,?,?,NOW())',
        [mov.cuit, payResult.insertId, -mov.neto, 'PAGO_RETIRO']
      );
    }

    // Crear notificación según tipo de movimiento
    if (mov.tipo_movimiento === 'CUPON') {
      await crearNotificacionCupon(mov.cliente_id, mov.cuit, 'APROBADO', mov.neto);

      // Enviar email en background para no demorar la aprobación
      enqueueCuponEmail(mov.id);
    } else if (mov.tipo_movimiento === 'AJUSTE_NEGATIVO') {
      await crearNotificacionAjuste(mov.cliente_id, mov.cuit, 'APROBADO', mov.montoBruto);
    } else if (mov.tipo_movimiento === 'PAGO_RETIRO') {
      await crearNotificacionRetiro(mov.cuit, 'PAGADO', mov.neto);
    }

    // Auditoría
    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [aprobador, `Aprobado movimiento ${id} (${mov.tipo_movimiento}) para CUIT ${mov.cuit}`, ip]
    );

    res.json({ ok: true, msg: 'Movimiento aprobado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const rechazarMovimiento = async (req, res) => {
  try {
    const { id, motivo } = req.body;
    const aprobador = req.user?.email || 'admin';
    const ip = getClientIp(req);

    if (!id) return res.status(400).json({ ok: false, msg: 'Falta id' });

    const [movimientos] = await db.query('SELECT * FROM movimientos WHERE id = ?', [id]);
    if (movimientos.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Movimiento no encontrado' });
    }

    const mov = movimientos[0];

    if (mov.estado !== 'PENDIENTE') {
      return res.status(400).json({ ok: false, msg: `No se puede rechazar movimiento con estado ${mov.estado}` });
    }

    await db.query(
      'UPDATE movimientos SET estado = ?, aprobador = ?, aprobada_at = NOW(), descripcion = CONCAT(descripcion, ?) WHERE id = ?',
      ['RECHAZADO', aprobador, ` | Motivo rechazo: ${motivo || 'Sin especificar'}`, id]
    );

    // Crear notificación según tipo de movimiento
    if (mov.tipo_movimiento === 'CUPON') {
      await crearNotificacionCupon(mov.cliente_id, mov.cuit, 'RECHAZADO', mov.neto, motivo);
    } else if (mov.tipo_movimiento === 'AJUSTE_NEGATIVO') {
      await crearNotificacionAjuste(mov.cliente_id, mov.cuit, 'RECHAZADO', mov.montoBruto, motivo);
    } else if (mov.tipo_movimiento === 'PAGO_RETIRO') {
      await crearNotificacionRetiro(mov.cuit, 'RECHAZADO', mov.neto, motivo);
    }

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [aprobador, `Rechazado movimiento ${id} (${mov.tipo_movimiento}) para CUIT ${mov.cuit}: ${motivo}`, ip]
    );

    res.json({ ok: true, msg: 'Movimiento rechazado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ============= AJUSTES NEGATIVOS =============

export const crearAjusteNegativo = async (req, res) => {
  try {
    const { cuit, monto, motivo = 'otro', descripcion = '' } = req.body;
    const usuario = req.user?.email || 'sistema';
    const ip = getClientIp(req);

    if (!cuit) {
      return res.status(400).json({ ok: false, msg: 'CUIT es requerido' });
    }

    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ ok: false, msg: 'Monto debe ser mayor a 0' });
    }

    // Validar que cliente existe
    const [clientes] = await db.query('SELECT id FROM clientes WHERE cuit = ?', [cuit]);
    if (clientes.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    }
    const cliente_id = clientes[0].id;

    // Crear movimiento NEGATIVO
    const montoNegativo = -parseFloat(monto); // Neto es negativo
    const tipoMovimiento = 'AJUSTE_NEGATIVO';
    const estado = 'PENDIENTE'; // Requiere aprobación
    
    // Descripción incluye motivo
    const descCompleta = `[${motivo.toUpperCase()}] ${descripcion}`;

    const [result] = await db.query(
      `INSERT INTO movimientos 
       (cliente_id, cuit, tipo_movimiento, montoBruto, neto, estado, descripcion, usuario_creador, ip_creador, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [cliente_id, cuit, tipoMovimiento, monto, montoNegativo, estado, descCompleta, usuario, ip]
    );

    // Log de auditoría
    await db.query(
      `INSERT INTO auditoria_logs (accion, detalles, usuario, ip_origen, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [`CREAR_AJUSTE_NEGATIVO_${result.insertId}`, `Ajuste negativo creado por ${usuario}: -$${monto}`, usuario, ip]
    );

    // Notificar al cliente que hay un ajuste pendiente
    try {
      await crearNotificacionAjuste(cliente_id, cuit, 'PENDIENTE', montoNegativo);
    } catch (nerr) {
      // Error al crear notificación de ajuste PENDIENTE
    }

    res.json({ 
      ok: true, 
      msg: 'Ajuste negativo creado exitosamente',
      movimiento_id: result.insertId,
      neto: montoNegativo
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const obtenerAjustesNegativos = async (req, res) => {
  try {
    const { estado = 'PENDIENTE', limit = 100, offset = 0, cuit } = req.query;

    let sql = `
      SELECT 
        m.id,
        m.cuit,
        m.tipo_movimiento,
        m.montoBruto as monto,
        m.neto,
        m.descripcion,
        m.estado,
        m.usuario_creador as creado_por,
        m.created_at,
        cl.razon_social as nombre_cliente
      FROM movimientos m
      LEFT JOIN clientes cl ON m.cliente_id = cl.id
      WHERE m.tipo_movimiento = 'AJUSTE_NEGATIVO'
    `;
    const params = [];

    if (estado) {
      sql += ' AND m.estado = ?';
      params.push(estado);
    }

    if (cuit) {
      sql += ' AND m.cuit = ?';
      params.push(cuit);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);

    // Contar total
    let countSql = `
      SELECT COUNT(*) as total FROM movimientos 
      WHERE tipo_movimiento = 'AJUSTE_NEGATIVO'
    `;
    const countParams = [];

    if (estado) {
      countSql += ' AND estado = ?';
      countParams.push(estado);
    }

    if (cuit) {
      countSql += ' AND cuit = ?';
      countParams.push(cuit);
    }

    const [[{ total }]] = await db.query(countSql, countParams);

    res.json({ 
      ok: true, 
      data: rows, 
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } 
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const aprobarAjuste = async (req, res) => {
  try {
    const { id } = req.body;
    const usuario = req.user?.email || 'sistema';
    const ip = getClientIp(req);

    if (!id) {
      return res.status(400).json({ ok: false, msg: 'ID de movimiento es requerido' });
    }

    // Obtener el ajuste
    const [movimientos] = await db.query(
      'SELECT * FROM movimientos WHERE id = ? AND tipo_movimiento = ?',
      [id, 'AJUSTE_NEGATIVO']
    );

    if (movimientos.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Ajuste negativo no encontrado' });
    }

    const ajuste = movimientos[0];

    // Actualizar estado del movimiento
    await db.query(
      'UPDATE movimientos SET estado = ?, aprobador = ?, aprobada_at = NOW() WHERE id = ?',
      ['APROBADO', usuario, id]
    );

    // Log de auditoría
    await db.query(
      `INSERT INTO auditoria_logs (accion, detalles, usuario, ip_origen, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [`APROBAR_AJUSTE_NEGATIVO_${id}`, `Ajuste negativo aprobado: -$${ajuste.montoBruto}`, usuario, ip]
    );

    res.json({ 
      ok: true, 
      msg: 'Ajuste negativo aprobado exitosamente'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const rechazarAjuste = async (req, res) => {
  try {
    const { id, motivo } = req.body;
    const usuario = req.user?.email || 'sistema';
    const ip = getClientIp(req);

    if (!id) {
      return res.status(400).json({ ok: false, msg: 'ID de movimiento es requerido' });
    }

    // Obtener el ajuste
    const [movimientos] = await db.query(
      'SELECT * FROM movimientos WHERE id = ? AND tipo_movimiento = ?',
      [id, 'AJUSTE_NEGATIVO']
    );

    if (movimientos.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Ajuste negativo no encontrado' });
    }

    const ajuste = movimientos[0];

    // Actualizar estado del movimiento (Usamos descripcion para almacenar el motivo de rechazo)
    const descRechazo = `[RECHAZADO] ${motivo || 'No especificado'}`;
    await db.query(
      'UPDATE movimientos SET estado = ?, descripcion = ? WHERE id = ?',
      ['RECHAZADO', descRechazo, id]
    );

    // Log de auditoría
    await db.query(
      `INSERT INTO auditoria_logs (accion, detalles, usuario, ip_origen, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [`RECHAZAR_AJUSTE_NEGATIVO_${id}`, `Ajuste negativo rechazado: -$${ajuste.montoBruto}. Motivo: ${motivo || 'No especificado'}`, usuario, ip]
    );

    res.json({ 
      ok: true, 
      msg: 'Ajuste negativo rechazado exitosamente'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// ============= INGRESO DE DINERO =============

export const ingresarDinero = async (req, res) => {
  try {
    const cuit = req.user?.cuit || req.body.cuit;
    const { monto } = req.body;
    const ip = getClientIp(req);

    if (!cuit) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'CUIT no proporcionado' 
      });
    }

    if (!monto || monto <= 0) {
      return res.status(400).json({ 
        ok: false, 
        msg: 'Monto debe ser mayor a 0' 
      });
    }

    // Validar que cliente existe
    const [clientes] = await db.query(
      'SELECT id FROM clientes WHERE cuit = ?',
      [cuit]
    );

    if (clientes.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        msg: 'Cliente no encontrado' 
      });
    }

    const cliente_id = clientes[0].id;

    // Crear movimiento de tipo INGRESO
    const [movResult] = await db.query(
      `INSERT INTO movimientos 
       (cuit, cliente_id, tipo_movimiento, montoBruto, neto, descripcion, estado, usuario_creador, ip_creador, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [cuit, cliente_id, 'INGRESO', monto, monto, 'Ingreso manual de dinero', 'APROBADO', cuit, ip]
    );

    const movimiento_id = movResult.insertId;

    // Crear movimiento en wallet_movements (positivo, suma al balance)
    const walletRes = await db.query(
      `INSERT INTO wallet_movements (cuit, movimiento_id, monto, tipo, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [cuit, movimiento_id, monto, 'INGRESO']
    );

    // Registrar auditoría
    await db.query(
      `INSERT INTO auditoria_logs (usuario, accion, ip, created_at) 
       VALUES (?, ?, ?, NOW())`,
      [cuit, `Ingreso de dinero: ${monto}`, ip]
    );

    res.json({ 
      ok: true, 
      msg: 'Dinero ingresado exitosamente',
      movimiento_id
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Error al ingresar dinero' 
    });
  }
};

// ============= AUDITORÍA =============

export const obtenerAuditoria = async (req, res) => {
  try {
    const { movimiento_id, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM auditoria_logs';
    const params = [];

    if (movimiento_id) {
      sql += ' WHERE accion LIKE ?';
      params.push(`%${movimiento_id}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const eliminarMovimiento = async (req, res) => {
  try {
    const { id, motivo } = req.body;
    const usuario = req.user?.email || 'admin';
    const ip = getClientIp(req);

    if (!id) return res.status(400).json({ ok: false, msg: 'Falta id' });

    const [movimientos] = await db.query('SELECT * FROM movimientos WHERE id = ?', [id]);
    if (movimientos.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Movimiento no encontrado' });
    }

    const mov = movimientos[0];

    if (mov.estado === 'ELIMINADO') {
      return res.status(400).json({ ok: false, msg: 'El movimiento ya está eliminado' });
    }

    // Soft-delete: marcar como ELIMINADO y dejar rastro en la descripción
    const motivoTxt = ` | Eliminado: ${motivo || 'Sin motivo'}`;
    await db.query("UPDATE movimientos SET estado = ?, descripcion = CONCAT(IFNULL(descripcion, ''), ?) WHERE id = ?", ['ELIMINADO', motivoTxt, id]);

    await db.query(
      'INSERT INTO auditoria_logs (usuario, accion, ip, created_at) VALUES (?,?,?,NOW())',
      [usuario, `Eliminado movimiento ${id} (${mov.tipo_movimiento}) para CUIT ${mov.cuit}. Motivo: ${motivo || 'No especificado'}`, ip]
    );

    res.json({ ok: true, msg: 'Movimiento eliminado (soft-delete)' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const ocultarMovimientosCliente = async (req, res) => {
  try {
    const cuit = req.user?.cuit;
    const { ids } = req.body;

    if (!cuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, msg: 'Faltan ids' });

    await ensureMovimientosOcultosTable();

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id FROM movimientos WHERE cuit = ? AND id IN (${placeholders})`,
      [cuit, ...ids]
    );

    if (!rows || rows.length === 0) {
      return res.json({ ok: true, ocultados: 0 });
    }

    const values = rows.map(r => [cuit, r.id]);
    await db.query(
      'INSERT IGNORE INTO movimientos_ocultos (cuit, movimiento_id) VALUES ?',
      [values]
    );

    res.json({ ok: true, ocultados: rows.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const ocultarTodoHistorialCliente = async (req, res) => {
  try {
    const cuit = req.user?.cuit;
    if (!cuit) return res.status(400).json({ ok: false, msg: 'CUIT no proporcionado' });

    await ensureMovimientosOcultosTable();

    await db.query(
      `INSERT IGNORE INTO movimientos_ocultos (cuit, movimiento_id)
       SELECT ?, m.id FROM movimientos m WHERE m.cuit = ?`,
      [cuit, cuit]
    );

    res.json({ ok: true, msg: 'Historial ocultado' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

