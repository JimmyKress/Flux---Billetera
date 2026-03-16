import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import xss from 'xss';
import { logSecurityEvent } from './auditLogger.js';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

const rateLimitHandler = (limitType) => (req, res) => {
  logSecurityEvent('RATE_LIMIT_EXCEEDED', {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    method: req.method,
    url: req.originalUrl,
    limitType,
  });
  res.set('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SECONDS));
  return res.status(429).json({
    ok: false,
    code: 'RATE_LIMIT',
    msg: 'Se detectó mucha actividad. Por favor esperá 1 minuto e intentá nuevamente.',
  });
};

const SUSPICIOUS_PATTERNS = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on\w+\s*=/i,
  /\b(eval|Function)\s*\(/i,
];

const isSuspiciousString = (value) => {
  if (typeof value !== 'string') return false;
  return SUSPICIOUS_PATTERNS.some((rx) => rx.test(value));
};

const sanitizeDeep = (input) => {
  if (typeof input === 'string') {
    return xss(input, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    });
  }
  if (Array.isArray(input)) return input.map(sanitizeDeep);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[k] = sanitizeDeep(v);
    return out;
  }
  return input;
};

export const securityHeaders = () =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });

export const apiRateLimiter = () =>
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    // API general: bastante permisivo para no cortar flujos normales (admin + wallet refresh)
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler('api'),
  });

export const authRateLimiter = () =>
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler('auth'),
  });

export const heavyWriteRateLimiter = () =>
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    // Endpoints pesados (crear/aprobar en lote). Permite bursts razonables.
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler('heavy_write'),
  });

export const preventParameterPollution = () => hpp();

export const globalRateLimiter = () =>
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    // Global: no debe ser el cuello de botella. Solo frena floods simples.
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler('global'),
  });

export const sanitizeAndBlockMalicious = () => (req, res, next) => {
  const inspect = (obj) => {
    if (!obj) return false;
    if (typeof obj === 'string') return isSuspiciousString(obj);
    if (Array.isArray(obj)) return obj.some(inspect);
    if (typeof obj === 'object') return Object.values(obj).some(inspect);
    return false;
  };

  if (
    inspect(req.body) ||
    inspect(req.query) ||
    inspect(req.params) ||
    inspect(req.headers?.['user-agent']) ||
    inspect(req.headers?.referer) ||
    inspect(req.headers?.origin)
  ) {
    logSecurityEvent('MALICIOUS_REQUEST_BLOCKED', {
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      query: req.query,
      params: req.params
    });
    return res.status(400).json({ ok: false, msg: 'Solicitud rechazada por contenido no permitido' });
  }

  req.body = sanitizeDeep(req.body);
  req.query = sanitizeDeep(req.query);
  req.params = sanitizeDeep(req.params);

  return next();
};

export const strictJson = () => (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const ct = String(req.headers['content-type'] || '');
  if (ct && !ct.includes('application/json') && !ct.includes('multipart/form-data')) {
    return res.status(415).json({ ok: false, msg: 'Content-Type no soportado' });
  }
  return next();
};
