import { getClientIp } from '../controllers/notificacionesController.js';

export const adminIpWhitelist = () => (req, res, next) => {
  const allowedIps = (process.env.ADMIN_IP_WHITELIST || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);

  if (allowedIps.includes('*')) return next();

  const onlyLocalhost =
    allowedIps.length > 0 &&
    allowedIps.every((ip) => ip === '127.0.0.1' || ip === '::1' || ip === 'localhost');

  // Si no hay whitelist configurada, permitir todo (dev mode)
  if (allowedIps.length === 0 || onlyLocalhost) return next();

  const clientIp = getClientIp(req);
  if (!allowedIps.includes(clientIp)) {
    console.warn(`[ADMIN IP BLOCK] IP no autorizada intentó acceder a ruta de admin: ${clientIp}`);
    return res.status(403).json({ ok: false, msg: 'Acceso no autorizado desde esta ubicación' });
  }

  next();
};
