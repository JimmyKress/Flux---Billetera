import { db } from '../config/db.js';

// Obtener IP del cliente
export const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket.remoteAddress || 
         'unknown';
};

export const crearNotificacionCuponEliminado = async (cliente_id, cuit, codigoCupon) => {
  try {
    const codigo = (codigoCupon || '').toString().trim() || '-';
    const mensaje = `Cupón eliminado, '${codigo}'`;
    await db.query(
      `INSERT INTO notificaciones (cliente_id, cuit, tipo, mensaje, leida, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [cliente_id, cuit, 'CUPON_ELIMINADO', mensaje]
    );
  } catch (e) {
    // Error al crear notificación de cupón eliminado
  }
};

// ============= NOTIFICACIONES =============

export const obtenerNotificaciones = async (req, res) => {
  try {
    const { cuit } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!cuit) {
      return res.status(400).json({ ok: false, msg: 'CUIT es requerido' });
    }

    // Obtener notificaciones del cliente, incluyendo cliente_id
    const [notificaciones] = await db.query(
      `SELECT id, cliente_id, cuit, tipo, mensaje, detalles, leida, created_at FROM notificaciones 
       WHERE cuit = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [cuit, parseInt(limit), parseInt(offset)]
    );

    res.json({ ok: true, data: notificaciones });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const obtenerNotificacionesAdmin = async (req, res) => {
  try {
    const { tipo } = req.query;
    const { limit = 50, offset = 0 } = req.query;

    let sql =
      'SELECT id, cliente_id, cuit, tipo, mensaje, detalles, leida, created_at FROM notificaciones';
    const params = [];
    if (tipo) {
      sql += ' WHERE tipo = ?';
      params.push(tipo);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [notificaciones] = await db.query(sql, params);
    res.json({ ok: true, data: notificaciones });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const marcarComoLeida = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ ok: false, msg: 'ID de notificación es requerido' });
    }

    await db.query(
      'UPDATE notificaciones SET leida = 1 WHERE id = ?',
      [id]
    );

    res.json({ ok: true, msg: 'Notificación marcada como leída' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const eliminarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ ok: false, msg: 'ID de notificación es requerido' });
    }

    await db.query(
      'DELETE FROM notificaciones WHERE id = ?',
      [id]
    );

    res.json({ ok: true, msg: 'Notificación eliminada' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

// Crear notificación (función interna)
export const crearNotificacion = async (cuit, tipo, mensaje, detalles = null) => {
  try {
    // Buscar el cliente_id por CUIT
    const [clientes] = await db.query('SELECT id FROM clientes WHERE cuit = ?', [cuit]);
    const cliente_id = clientes.length > 0 ? clientes[0].id : null;
    if (!cliente_id) throw new Error('No se encontró cliente para CUIT: ' + cuit);
    await db.query(
      `INSERT INTO notificaciones (cliente_id, cuit, tipo, mensaje, leida, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [cliente_id, cuit, tipo, mensaje]
    );
  } catch (e) {
    // Error al crear notificación
  }
};

// Crear notificaciones cuando se aprueba/rechaza un cupón
export const crearNotificacionCupon = async (cliente_id, cuit, estado, neto, motivo = null) => {
  try {
    let tipo, mensaje;
    if (estado === 'APROBADO') {
      tipo = 'CUPON_APROBADO';
      mensaje = `Tu cupón ha sido aprobado. Acreditación: +$${parseFloat(neto).toFixed(2)}`;
    } else if (estado === 'RECHAZADO') {
      tipo = 'CUPON_RECHAZADO';
      mensaje = `Tu cupón ha sido rechazado. ${motivo ? `Motivo: ${motivo}` : ''}`;
    } else if (estado === 'PENDIENTE' || estado === 'CREADO') {
      // Omitir notificación si el neto es 0 o negativo
      if (!neto || parseFloat(neto) <= 0) return;
      tipo = 'CUPON_PENDIENTE';
      mensaje = `Se ha registrado un cupón pendiente de aprobación. Neto estimado: $${parseFloat(neto).toFixed(2)}`;
    } else {
      return;
    }

    await crearNotificacion(cuit, tipo, mensaje, `Cupón: Acreditación estimada $${parseFloat(neto || 0).toFixed(2)}`);
  } catch (e) {
    // Error al crear notificación de cupón
  }
};

// Crear notificaciones cuando se aprueba/rechaza un ajuste negativo
export const crearNotificacionAjuste = async (cliente_id, cuit, estado, monto, motivo = null) => {
  try {
    let tipo, mensaje;
    if (estado === 'APROBADO') {
      tipo = 'AJUSTE_APROBADO';
      mensaje = `Se ha aplicado un ajuste negativo de -$${parseFloat(monto).toFixed(2)} a tu cuenta`;
    } else if (estado === 'RECHAZADO') {
      tipo = 'AJUSTE_RECHAZADO';
      mensaje = `Tu ajuste negativo ha sido rechazado. ${motivo ? `Motivo: ${motivo}` : ''}`;
    } else if (estado === 'PENDIENTE' || estado === 'CREADO') {
      tipo = 'AJUSTE_PENDIENTE';
      mensaje = `Se ha registrado un ajuste negativo pendiente de aprobación por -$${parseFloat(monto || 0).toFixed(2)}`;
    } else {
      return;
    }
    await crearNotificacion(cuit, tipo, mensaje, `Ajuste: -$${parseFloat(monto || 0).toFixed(2)}`);
  } catch (e) {
    // Error al crear notificación de ajuste
  }
};

// Crear notificaciones para retiros
export const crearNotificacionRetiro = async (cuit, estado, monto, motivoRechazo = null) => {
  try {
    let tipo, mensaje;
    switch (estado) {
      case 'SOLICITADO':
      case 'PENDIENTE':
        tipo = 'RETIRO_SOLICITADO';
        mensaje = `Tu retiro de $${parseFloat(monto).toFixed(2)} ha sido solicitado y está pendiente de revisión`;
        break;
      case 'APROBADO':
        tipo = 'RETIRO_APROBADO';
        mensaje = `Tu retiro de $${parseFloat(monto).toFixed(2)} ha sido aprobado`;
        break;
      case 'RECHAZADO':
        tipo = 'RETIRO_RECHAZADO';
        mensaje = `Tu retiro de $${parseFloat(monto).toFixed(2)} ha sido rechazado. ${motivoRechazo ? `Motivo: ${motivoRechazo}` : ''}`;
        break;
      case 'PAGADO':
        tipo = 'RETIRO_PAGADO';
        mensaje = `Tu retiro de $${parseFloat(monto).toFixed(2)} ha sido pagado exitosamente`;
        break;
      default:
        return;
    }

    await crearNotificacion(cuit, tipo, mensaje, `Retiro de $${parseFloat(monto || 0).toFixed(2)}`);
  } catch (e) {
    // Error al crear notificación de retiro
  }
};
