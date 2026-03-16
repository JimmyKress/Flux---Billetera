import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';

export const verificarToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ ok: false, msg: 'No se proporcionó token de autenticación' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_jwt');
    
    // Verificar si el usuario existe
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    
    if (users.length === 0) {
      return res.status(401).json({ ok: false, msg: 'Usuario no encontrado' });
    }

    // Agregar información del usuario al request
    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, msg: 'Token inválido o expirado' });
  }
};

export const esAdmin = (req, res, next) => {
  verificarToken(req, res, () => {
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const adminCuit = normalizeCuit(process.env.ADMIN_CUIT || process.env.VITE_ADMIN_CUIT);
    const userCuit = normalizeCuit(req.user?.cuit);
    if (req.user && adminCuit && userCuit === adminCuit) {
      next();
    } else {
      res.status(403).json({ ok: false, msg: 'Acceso no autorizado. Se requieren privilegios de administrador' });
    }
  });
};
