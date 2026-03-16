import fs from 'fs';
import path from 'path';

const logFile = path.join(process.cwd(), 'logs', 'audit.log');

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFile))) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

export const logSecurityEvent = (event, details = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...details
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error('[AUDIT LOG ERROR]', err);
  });
};

export const auditMiddleware = (event) => (req, res, next) => {
  const details = {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    method: req.method,
    url: req.originalUrl,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
    user: req.user?.id || null
  };

  logSecurityEvent(event, details);
  next();
};
