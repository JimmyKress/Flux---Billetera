import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/authRoutes.js';
import transaccionesRoutes from './routes/transaccionesRoutes.js';
import clientesRoutes from './routes/clientes.js';
import retirosRoutes from './routes/retirosRoutes.js';
import notificacionesRoutes from './routes/notificacionesRoutes.js';
import configRoutes from './routes/configRoutes.js';
import refreshRoutes from './routes/refreshRoutes.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import mercadoRoutes from './routes/mercadoRoutes.js';
import epagosRoutes from './routes/epagosRoutes.js';
import tokenRoutes from './routes/tokenRoutes.js';
import depositRoutes from './routes/depositRoutes.js';
import { scheduleCuponCleanup } from './services/cuponCleanup.js';
import { apiRateLimiter, authRateLimiter, heavyWriteRateLimiter, preventParameterPollution, sanitizeAndBlockMalicious, securityHeaders, strictJson, globalRateLimiter } from './middleware/security.js';

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '.env.epagos'), override: true });
const app = express();

app.set('trust proxy', 1);

// Agrego las credenciales
const client = new MercadoPagoConfig({ accessToken: 'MP_ACCESS_TOKEN' });
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Permitir requests sin origin (curl, postman) y si no hay allowlist configurada
      if (!origin || allowed.length === 0) return cb(null, true);

      if (allowed.includes(origin)) return cb(null, true);

      try {
        const originUrl = new URL(origin);
        const allowedHosts = allowed
          .map((value) => {
            try {
              return new URL(value).hostname;
            } catch {
              return String(value || '')
                .replace(/^https?:\/\//i, '')
                .replace(/\/.+$/, '')
                .replace(/:.+$/, '');
            }
          })
          .filter(Boolean);

        if (allowedHosts.includes(originUrl.hostname)) return cb(null, true);
      } catch {
        // ignore parse errors
      }

      console.warn('[CORS][BLOCK]', { origin, allowed });
      return cb(new Error('CORS: origin no permitido'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(securityHeaders());
app.use(globalRateLimiter());
app.use(preventParameterPollution());
app.use(apiRateLimiter());
app.use(strictJson());
app.use(express.json({
  limit: '25mb',
  verify: (req, res, buf) => {
    try {
      req.rawBody = buf?.toString('utf8');
    } catch (e) {
      req.rawBody = undefined;
    }
  },
}));
app.use(sanitizeAndBlockMalicious());

app.use('/api/auth', authRateLimiter(), authRoutes);
app.use('/api/transacciones', heavyWriteRateLimiter(), transaccionesRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/retiros', retirosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/refresh', refreshRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/deposit', depositRoutes);

app.use('/api/mercadopago', mercadoRoutes);

app.use('/api/epagos', epagosRoutes);

scheduleCuponCleanup();

app.use(
  '/public',
  express.static(path.join(process.cwd(), '../frontend/public'))
);

app.get('/', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  // Error handler global para evitar que el proceso se caiga ante errores no manejados.
  console.error('[API][ERROR]', {
    method: req.method,
    url: req.originalUrl,
    msg: err?.message,
  });
  if (res.headersSent) return next(err);
  return res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[API][unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[API][uncaughtException]', err);
});

const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`Servidor backend corriendo en puerto ${port}`)
);
