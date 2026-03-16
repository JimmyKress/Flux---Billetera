import crypto from 'crypto';

const env = (name, fallback = '') => {
  const v = process.env[name];
  return v === undefined || v === null ? fallback : String(v);
};

const getConfig = () => {
  const ns = env('EPAGOS_NS', 'https://api.epagos.net/').trim();
  const version = env('EPAGOS_VERSION', '1.0').trim();

  const soapActionMode = env('EPAGOS_SOAPACTION_MODE', 'endpoint').trim();
  const soapActionOverride = env('EPAGOS_SOAPACTION_OVERRIDE', '').trim();

  const debugXml = env('EPAGOS_DEBUG_XML', '').trim() === '1';

  const epagosEnv = env('EPAGOS_ENV', 'prod').trim().toLowerCase();

  const endpointProd = env(
    'EPAGOS_ENDPOINT_PROD',
    'https://api.epagos.com.ar/wsdl/index.php/generar_qr_vinculado'
  ).trim();
  const endpointSandbox = env('EPAGOS_ENDPOINT_SANDBOX', '').trim();
  const endpointExplicit = env('EPAGOS_ENDPOINT', '').trim();
  const endpoint = (
    endpointExplicit ||
    (epagosEnv === 'sandbox' && endpointSandbox ? endpointSandbox : endpointProd)
  ).trim();

  const tokenEndpointProd = env('EPAGOS_TOKEN_ENDPOINT_PROD', '').trim();
  const tokenEndpointSandbox = env('EPAGOS_TOKEN_ENDPOINT_SANDBOX', '').trim();
  const tokenEndpointExplicit = env('EPAGOS_TOKEN_ENDPOINT', '').trim();
  const tokenEndpoint = (
    tokenEndpointExplicit ||
    (epagosEnv === 'sandbox' && tokenEndpointSandbox
      ? tokenEndpointSandbox
      : tokenEndpointProd)
  ).trim();

  const pagoEndpointProd = env('EPAGOS_PAGO_ENDPOINT_PROD', '').trim();
  const pagoEndpointSandbox = env('EPAGOS_PAGO_ENDPOINT_SANDBOX', '').trim();
  const pagoEndpointExplicit = env('EPAGOS_PAGO_ENDPOINT', '').trim();
  const pagoEndpoint = (
    pagoEndpointExplicit ||
    (epagosEnv === 'sandbox' && pagoEndpointSandbox
      ? pagoEndpointSandbox
      : pagoEndpointProd)
  ).trim();

  const qrEndpointProd = env('EPAGOS_QR_ENDPOINT_PROD', '').trim();
  const qrEndpointSandbox = env('EPAGOS_QR_ENDPOINT_SANDBOX', '').trim();
  const qrEndpointExplicit = env('EPAGOS_QR_ENDPOINT', '').trim();
  const qrEndpoint = (
    qrEndpointExplicit ||
    (epagosEnv === 'sandbox' && qrEndpointSandbox ? qrEndpointSandbox : qrEndpointProd)
  ).trim();

  const idOrganismo = env('EPAGOS_ID_ORGANISMO', '').trim();
  const idUsuario = env('EPAGOS_ID_USUARIO', '').trim();
  const password = env('EPAGOS_PASSWORD', '');

  const hashOverride = env('EPAGOS_HASH', '').trim();
  const hashUppercase = env('EPAGOS_HASH_UPPERCASE', '').trim() === '1';

  const tokenMethod = env('EPAGOS_TOKEN_METHOD', 'obtener_token').trim();

  return {
    ns,
    version,
    soapActionMode,
    soapActionOverride,
    debugXml,
    epagosEnv,
    endpoint,
    tokenEndpoint,
    pagoEndpoint,
    qrEndpoint,
    idOrganismo,
    idUsuario,
    password,
    hashOverride,
    hashUppercase,
    tokenMethod,
  };
};

/* =========================
   GENERAR HASH MD5
========================= */
const generateHash = () => {
  const cfg = getConfig();
  // En la documentación de E-Checkout el HASH se entrega como credencial (no se deriva).
  // Para mantener compatibilidad, si no hay EPAGOS_HASH, caemos al cálculo md5 anterior.
  if (cfg.hashOverride) {
    const finalHash = cfg.hashUppercase
      ? cfg.hashOverride.toUpperCase()
      : cfg.hashOverride;
    return finalHash;
  }

  const raw = cfg.idOrganismo + cfg.idUsuario + cfg.password;
  const hash = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
  const finalHash = cfg.hashUppercase ? hash.toUpperCase() : hash;

  return finalHash;
};

const redactXml = (xml) => {
  const s = String(xml || '');
  return s
    .replace(/<password>[^<]*<\/password>/gi, '<password>[REDACTED]</password>')
    .replace(/<hash>[^<]*<\/hash>/gi, '<hash>[REDACTED]</hash>')
    .replace(/<token>[^<]*<\/token>/gi, '<token>[REDACTED]</token>');
};

const soapActionFor = ({ method, endpoint }) => {
  const cfg = getConfig();

  if (cfg.soapActionOverride) return cfg.soapActionOverride;

  if (cfg.soapActionMode === 'endpoint') {
    const base = String(endpoint || '').trim();
    if (!base) return '';
    return `${base}/${method}`;
  }

  const normalizedNs = cfg.ns.endsWith('/') ? cfg.ns : `${cfg.ns}/`;
  return `${normalizedNs}${method}`;
};

const escapeXml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const fillTemplate = (template, vars) => {
  let out = String(template ?? '');

  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replaceAll(`{{${k}}}`, String(v));
  }

  return out;
};

const buildEnvelope = (method, innerXml) => {
  const { ns } = getConfig();
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:urn="${ns}">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:${method} soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      ${innerXml}
    </urn:${method}>
  </soapenv:Body>
</soapenv:Envelope>`;
};

const extractTag = (xml, tag) => {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = String(xml || '').match(re);
  return m ? String(m[1]).trim() : null;
};

const parseSoapFault = (xml) => {
  const fault =
    extractTag(xml, 'faultstring') ||
    extractTag(xml, 'Fault') ||
    null;

  return fault ? String(fault) : null;
};

const fetchSoap = async ({ method, envelope, timeoutMs, endpointOverride }) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { endpoint: defaultEndpoint } = getConfig();
    const endpoint = String(endpointOverride || defaultEndpoint || '').trim();
    console.log(`[EPAGOS][${method}][endpoint]`, endpoint);
    const soapAction = soapActionFor({ method, endpoint });
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        ...(soapAction ? { SOAPAction: soapAction } : {}),
      },
      body: envelope,
      signal: controller.signal,
    });

    const text = await res.text();

    const cfg = getConfig();
    if (cfg.debugXml) {
      console.log(`[EPAGOS][${method}][response]`, redactXml(text));
    }

    const looksLikeHtml = /^\s*<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text);
    if (looksLikeHtml) {
      const err = new Error(
        `EPagos devolvió HTML (endpoint incorrecto o 404). endpoint=${endpoint} status=${res.status}`
      );
      err.statusCode = 502;
      throw err;
    }

    if (!res.ok) {
      const fault = parseSoapFault(text);

      const err = new Error(fault || `EPagos HTTP ${res.status}. endpoint=${endpoint}`);
      err.statusCode = 502;
      throw err;
    }

    const fault = parseSoapFault(text);

    if (fault) {
      const err = new Error(fault);
      err.statusCode = 502;
      throw err;
    }

    return text;
  } finally {
    clearTimeout(t);
  }
};

/* =========================
   TOKEN
========================= */

export const obtenerTokenEpagos = async ({ timeoutMs = 20000 } = {}) => {
  const credencialesInner = process.env.EPAGOS_CREDENCIALES_XML || '';

  if (!credencialesInner.trim()) {
    const err = new Error('EPagos no configurado: falta EPAGOS_CREDENCIALES_XML');
    err.statusCode = 500;
    throw err;
  }

  const hash = generateHash();

  const cfg = getConfig();

  const vars = {
    ID_ORGANISMO: escapeXml(cfg.idOrganismo),
    ID_USUARIO: escapeXml(cfg.idUsuario),
    PASSWORD: escapeXml(cfg.password),
    HASH: escapeXml(hash),
  };

  const inner = `
<version>${escapeXml(cfg.version)}</version>
<credenciales>${fillTemplate(credencialesInner, vars)}</credenciales>
`;

  const tokenMethod = String(cfg.tokenMethod || 'obtener_token').trim();
  const envelope = buildEnvelope(tokenMethod, inner);

  if (cfg.debugXml) {
    console.log(`[EPAGOS][${tokenMethod}][request]`, redactXml(envelope));
  }

  const xml = await fetchSoap({
    method: tokenMethod,
    envelope,
    timeoutMs,
    endpointOverride: cfg.tokenEndpoint,
  });

  const token = extractTag(xml, 'token');
  const idResp = extractTag(xml, 'id_resp');
  const respuesta = extractTag(xml, 'respuesta');

  if (!token) {
    const err = new Error(respuesta || 'EPagos: no se recibió token');
    err.statusCode = 502;
    err.details = { id_resp: idResp, respuesta };
    throw err;
  }

  return { token, idResp, respuesta };
};

/* =========================
   SOLICITUD PAGO
========================= */

export const solicitudPagoEpagos = async ({
  token,
  amount,
  reference,
  note,
  convenio,
  timeoutMs = 25000,
} = {}) => {
  const amountNumber = Number(amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw new Error('Monto inválido');
  }

  const credencialesPagoInner =
    process.env.EPAGOS_CREDENCIALES_PAGO_XML || '';

  const operacionTemplate =
    process.env.EPAGOS_SOLICITUD_PAGO_OPERACION_XML || '';

  const fpTemplate =
    process.env.EPAGOS_SOLICITUD_PAGO_FP_XML || '';

  const telefonoPagadorXml =
    process.env.EPAGOS_TELEFONO_PAGADOR_XML || '';

  const convenioValue = convenio || process.env.EPAGOS_CONVENIO;

  const hash = generateHash();

  const cfg = getConfig();

  const vars = {
    TOKEN: escapeXml(token),
    AMOUNT: escapeXml(amountNumber.toFixed(2)),
    REFERENCE: escapeXml(reference || `ARWPAY-${Date.now()}`),
    NOTE: escapeXml(note || ''),
    TELEFONO_PAGADOR_XML: telefonoPagadorXml,
    ID_ORGANISMO: escapeXml(cfg.idOrganismo),
    ID_USUARIO: escapeXml(cfg.idUsuario),
    PASSWORD: escapeXml(cfg.password),
    HASH: escapeXml(hash),
  };

  const inner = `
<version>${escapeXml(cfg.version)}</version>
<tipo_operacion>op_pago</tipo_operacion>
<credenciales>${fillTemplate(credencialesPagoInner, vars)}</credenciales>
<operacion>${fillTemplate(operacionTemplate, vars)}</operacion>
<fp>${fillTemplate(fpTemplate, vars)}</fp>
<convenio>${escapeXml(convenioValue)}</convenio>
`;

  const envelope = buildEnvelope('solicitud_pago', inner);

  console.log('[EPAGOS][solicitud_pago][request]', envelope);

  const xml = await fetchSoap({
    method: 'solicitud_pago',
    envelope,
    timeoutMs,
    endpointOverride: cfg.pagoEndpoint,
  });

  const idTransaccion = extractTag(xml, 'id_transaccion');

  if (!idTransaccion) {
    throw new Error('EPagos no devolvió id_transaccion');
  }

  return {
    idTransaccion,
  };
};

/* =========================
   GENERAR QR
========================= */

export const generarQrVinculadoEpagos = async ({
  amount,
  reference,
  cuit,
  note,
  timeoutMs = 25000,
} = {}) => {

  const amountNumber = Number(amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw new Error('Monto inválido');
  }

  const operacionesTemplate = process.env.EPAGOS_OPERACIONES_QR_XML || '';
  if (!operacionesTemplate.trim()) {
    const err = new Error('EPagos no configurado: falta EPAGOS_OPERACIONES_QR_XML');
    err.statusCode = 500;
    throw err;
  }

  const credencialesPagoInner = process.env.EPAGOS_CREDENCIALES_PAGO_XML || '';
  if (!credencialesPagoInner.trim()) {
    const err = new Error('EPagos no configurado: falta EPAGOS_CREDENCIALES_PAGO_XML');
    err.statusCode = 500;
    throw err;
  }

  const { token } = await obtenerTokenEpagos({ timeoutMs });

  const { idTransaccion } = await solicitudPagoEpagos({
    token,
    amount: amountNumber,
    reference,
    note,
  });

  const hash = generateHash();

  const vars = {
    TOKEN: escapeXml(token),
    ID_TRANSACCION: escapeXml(idTransaccion),
    AMOUNT: escapeXml(amountNumber.toFixed(2)),
    AMOUNT_INT: escapeXml(Math.round(amountNumber * 100)),
    REFERENCE: escapeXml(reference || `ARWPAY-${Date.now()}`),
    CUIT: escapeXml(cuit || ''),
    NOTE: escapeXml(note || ''),
    HASH: escapeXml(hash),
  };

  const cfg = getConfig();

  const inner = `
<version>${escapeXml(cfg.version)}</version>
<credenciales>${fillTemplate(credencialesPagoInner, vars)}</credenciales>
<operaciones_qr>
${fillTemplate(operacionesTemplate, vars)}
</operaciones_qr>
`;

  const envelope = buildEnvelope('generar_qr_vinculado', inner);

  if (cfg.debugXml) {
    console.log('[EPAGOS][generar_qr][request]', redactXml(envelope));
  }

  const xml = await fetchSoap({
    method: 'generar_qr_vinculado',
    envelope,
    timeoutMs,
    endpointOverride: cfg.qrEndpoint,
  });

  const idResp = extractTag(xml, 'id_resp');
  const respuesta = extractTag(xml, 'respuesta');
  const qrBase64 = extractTag(xml, 'qr');

  if (!qrBase64) {
    const err = new Error(respuesta || 'EPagos: no se recibió QR');
    err.statusCode = 502;
    err.details = { id_resp: idResp, respuesta };
    throw err;
  }

  return { qrBase64, token, idResp, respuesta };
};

/* =========================
   WEBHOOK VERIFY
========================= */

export const verifyWebhookSignature = ({
  rawBody,
  signature,
  secret,
}) => {
  if (!secret || !signature) return false;

  const h = crypto.createHmac('sha256', secret);

  h.update(rawBody);

  const digest = h.digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(digest);

  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
};