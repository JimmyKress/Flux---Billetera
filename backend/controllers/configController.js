import { db } from '../config/db.js';

const ensureFinancingPlansTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS financing_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cuotas INT NOT NULL UNIQUE,
      ctf_pct DECIMAL(10,2) NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const seedDefaultFinancingPlansIfEmpty = async () => {
  const defaults = [
    { cuotas: 1, ctf_pct: 17.85, enabled: 1 },
    { cuotas: 3, ctf_pct: 42.19, enabled: 1 },
    { cuotas: 6, ctf_pct: 60.28, enabled: 1 },
    { cuotas: 12, ctf_pct: 108.69, enabled: 1 },
  ];

  const [existingRows] = await db.query('SELECT cuotas FROM financing_plans');
  const existing = new Set((existingRows || []).map(r => Number(r?.cuotas)).filter(n => Number.isFinite(n)));

  for (const p of defaults) {
    if (existing.has(Number(p.cuotas))) continue;
    await db.query(
      'INSERT INTO financing_plans (cuotas, ctf_pct, enabled) VALUES (?, ?, ?)',
      [p.cuotas, p.ctf_pct, p.enabled]
    );
  }
};

export const obtenerLiquidacionDiariaGlobal = async (req, res) => {
  try {
    await ensureLiquidacionDiariaGlobalHistTable();
    const fecha = normalizeDate(req.query?.fecha);
    if (!fecha) {
      return res.status(400).json({ ok: false, msg: 'Debe indicar fecha (YYYY-MM-DD)' });
    }

    const [rows] = await db.query(
      'SELECT fecha, total_neto FROM liquidacion_diaria_global_hist WHERE fecha = ? LIMIT 1',
      [fecha]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, msg: 'Sin snapshot para la fecha indicada' });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error('Error al obtener liquidación diaria global:', error);
    return res.status(500).json({ ok: false, msg: 'Error al obtener liquidación diaria global' });
  }
};

export const obtenerLiquidacionDiariaGlobalHistorial = async (req, res) => {
  try {
    await ensureLiquidacionDiariaGlobalHistTable();
    const limit = Math.min(Math.max(Number(req.query?.limit) || 30, 1), 366);

    const [rows] = await db.query(
      'SELECT fecha, total_neto FROM liquidacion_diaria_global_hist ORDER BY fecha DESC LIMIT ?',
      [limit]
    );

    return res.json({ ok: true, data: { items: rows || [] } });
  } catch (error) {
    console.error('Error al obtener historial de liquidación diaria global:', error);
    return res.status(500).json({ ok: false, msg: 'Error al obtener historial de liquidación diaria global' });
  }
};

export const guardarLiquidacionDiariaGlobalSnapshot = async (req, res) => {
  try {
    await ensureLiquidacionDiariaGlobalHistTable();
    const fecha = normalizeDate(req.body?.fecha);
    const total_neto = Number(req.body?.total_neto);
    if (!fecha) {
      return res.status(400).json({ ok: false, msg: 'Debe indicar fecha (YYYY-MM-DD)' });
    }
    if (!Number.isFinite(total_neto)) {
      return res.status(400).json({ ok: false, msg: 'total_neto inválido' });
    }

    await db.query(
      'INSERT INTO liquidacion_diaria_global_hist (fecha, total_neto) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_neto = VALUES(total_neto)',
      [fecha, total_neto]
    );

    return res.json({ ok: true, msg: 'Snapshot guardado' });
  } catch (error) {
    console.error('Error al guardar snapshot de liquidación diaria global:', error);
    return res.status(500).json({ ok: false, msg: 'Error al guardar snapshot de liquidación diaria global' });
  }
};

const ensureSystemFlagsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_flags (
      k VARCHAR(80) PRIMARY KEY,
      v VARCHAR(255) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

async function ensureClientCalcHistoryTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS client_calc_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cuit VARCHAR(32) NOT NULL,
      monto DECIMAL(12,2) NOT NULL,
      cuotas INT NOT NULL,
      ctf_pct DECIMAL(10,2) NOT NULL,
      precio_por_cuota DECIMAL(12,2) NOT NULL,
      total_a_dicar DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_client_calc_history_cuit (cuit)
    )
  `);
}

const ensureLiquidacionDiariaGlobalHistTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS liquidacion_diaria_global_hist (
      fecha DATE PRIMARY KEY,
      total_neto DECIMAL(18,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const normalizeDate = (value) => {
  if (!value) return '';
  const s = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

export const obtenerFinancingStatus = async (req, res) => {
  try {
    await ensureSystemFlagsTable();
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const queryCuit = normalizeCuit(req.query?.cuit);

    const [rowsEditing] = await db.query('SELECT v, updated_at FROM system_flags WHERE k = ?', ['financing_editing']);
    const [rowsCuit] = await db.query('SELECT v FROM system_flags WHERE k = ?', ['financing_editing_cuit']);

    const globalEditing = String(rowsEditing?.[0]?.v ?? '0') === '1';
    const editing_cuit = normalizeCuit(rowsCuit?.[0]?.v ?? '');
    const updated_at = rowsEditing?.[0]?.updated_at ?? null;

    const editing = queryCuit
      ? (globalEditing && Boolean(editing_cuit) && editing_cuit === queryCuit)
      : globalEditing;

    res.json({ ok: true, data: { editing, updated_at, editing_cuit: editing_cuit || null } });
  } catch (error) {
    console.error('Error al obtener estado de financiación:', error);
    res.status(500).json({ ok: false, msg: 'Error al obtener estado de financiación' });
  }
};

export const actualizarFinancingStatus = async (req, res) => {
  try {
    await ensureSystemFlagsTable();
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const editing = req.body?.editing === true || req.body?.editing === 1 || req.body?.editing === '1';

    const cuit = normalizeCuit(req.body?.cuit);
    if (editing && !cuit) {
      return res.status(400).json({ ok: false, msg: 'Debe indicar el CUIT del cliente al activar el aviso' });
    }

    await db.query(
      'INSERT INTO system_flags (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
      ['financing_editing', editing ? '1' : '0']
    );

    await db.query(
      'INSERT INTO system_flags (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
      ['financing_editing_cuit', editing ? cuit : '']
    );

    res.json({ ok: true, msg: 'Estado actualizado' });
  } catch (error) {
    console.error('Error al actualizar estado de financiación:', error);
    res.status(500).json({ ok: false, msg: 'Error al actualizar estado de financiación' });
  }
};

export const obtenerFinancingPlans = async (req, res) => {
  try {
    await ensureFinancingPlansTable();
    await seedDefaultFinancingPlansIfEmpty();

    const [plans] = await db.query(
      'SELECT cuotas, ctf_pct, enabled, updated_at FROM financing_plans ORDER BY cuotas ASC'
    );

    res.json({ ok: true, data: { plans } });
  } catch (error) {
    console.error('Error al obtener planes de financiación:', error);
    res.status(500).json({ ok: false, msg: 'Error al obtener planes de financiación' });
  }
};

export const obtenerClientCalcHistory = async (req, res) => {
  try {
    await ensureClientCalcHistoryTable();
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const cuit = normalizeCuit(req.query?.cuit);
    if (!cuit) {
      return res.status(400).json({ ok: false, msg: 'Debe indicar cuit' });
    }

    const [rows] = await db.query(
      'SELECT id, cuit, monto, cuotas, ctf_pct, precio_por_cuota, total_a_dicar, created_at FROM client_calc_history WHERE cuit = ? ORDER BY id DESC LIMIT 200',
      [cuit]
    );

    res.json({ ok: true, data: { items: rows || [] } });
  } catch (error) {
    console.error('Error al obtener historial de cálculos:', error);
    res.status(500).json({ ok: false, msg: 'Error al obtener historial de cálculos' });
  }
};

export const crearClientCalcHistory = async (req, res) => {
  try {
    await ensureClientCalcHistoryTable();
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');

    const cuit = normalizeCuit(req.body?.cuit);
    const monto = Number(req.body?.monto);
    const cuotas = Number(req.body?.cuotas);
    const ctf_pct = Number(req.body?.ctf_pct);
    const precio_por_cuota = Number(req.body?.precio_por_cuota);
    const total_a_dicar = Number(req.body?.total_a_dicar);

    if (!cuit) return res.status(400).json({ ok: false, msg: 'Debe indicar cuit' });
    if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ ok: false, msg: 'Monto inválido' });
    if (!Number.isFinite(cuotas) || cuotas <= 0 || cuotas > 24) return res.status(400).json({ ok: false, msg: 'Cuotas inválidas' });
    if (!Number.isFinite(ctf_pct) || ctf_pct < 0) return res.status(400).json({ ok: false, msg: 'CTF inválido' });
    if (!Number.isFinite(precio_por_cuota) || precio_por_cuota <= 0) return res.status(400).json({ ok: false, msg: 'Precio por cuota inválido' });
    if (!Number.isFinite(total_a_dicar) || total_a_dicar <= 0) return res.status(400).json({ ok: false, msg: 'Total a dicar inválido' });

    const [result] = await db.query(
      'INSERT INTO client_calc_history (cuit, monto, cuotas, ctf_pct, precio_por_cuota, total_a_dicar) VALUES (?, ?, ?, ?, ?, ?)',
      [cuit, monto, cuotas, ctf_pct, precio_por_cuota, total_a_dicar]
    );

    res.json({ ok: true, data: { id: result?.insertId } });
  } catch (error) {
    console.error('Error al guardar cálculo:', error);
    res.status(500).json({ ok: false, msg: 'Error al guardar cálculo' });
  }
};

export const eliminarClientCalcHistoryItem = async (req, res) => {
  try {
    await ensureClientCalcHistoryTable();
    const id = Number(req.params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, msg: 'ID inválido' });
    }

    await db.query('DELETE FROM client_calc_history WHERE id = ?', [id]);
    res.json({ ok: true, msg: 'Eliminado' });
  } catch (error) {
    console.error('Error al eliminar item de historial:', error);
    res.status(500).json({ ok: false, msg: 'Error al eliminar item de historial' });
  }
};

export const eliminarClientCalcHistory = async (req, res) => {
  try {
    await ensureClientCalcHistoryTable();
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const cuit = normalizeCuit(req.query?.cuit);
    if (!cuit) {
      return res.status(400).json({ ok: false, msg: 'Debe indicar cuit' });
    }

    await db.query('DELETE FROM client_calc_history WHERE cuit = ?', [cuit]);
    res.json({ ok: true, msg: 'Historial eliminado' });
  } catch (error) {
    console.error('Error al eliminar historial:', error);
    res.status(500).json({ ok: false, msg: 'Error al eliminar historial' });
  }
};

export const actualizarFinancingPlans = async (req, res) => {
  try {
    await ensureFinancingPlansTable();

    const MAX_CUOTAS = 24;

    const plans = Array.isArray(req.body?.plans) ? req.body.plans : null;
    if (!plans) {
      return res.status(400).json({ ok: false, msg: 'Formato inválido: se requiere plans[]' });
    }

    const normalized = plans
      .map(p => ({
        cuotas: Number(p?.cuotas),
        ctf_pct: Number(p?.ctf_pct),
        enabled: p?.enabled === false || p?.enabled === 0 ? 0 : 1,
      }))
      .filter(p => Number.isFinite(p.cuotas) && p.cuotas > 0 && p.cuotas <= MAX_CUOTAS && Number.isFinite(p.ctf_pct) && p.ctf_pct >= 0);

    if (normalized.length === 0) {
      return res.status(400).json({ ok: false, msg: 'Debe enviar al menos un plan válido' });
    }

    const uniqueCuotas = new Set();
    for (const p of normalized) {
      if (uniqueCuotas.has(p.cuotas)) {
        return res.status(400).json({ ok: false, msg: 'No se permiten cuotas duplicadas' });
      }
      uniqueCuotas.add(p.cuotas);
    }

    await db.query('START TRANSACTION');
    await db.query('DELETE FROM financing_plans');

    for (const p of normalized) {
      await db.query(
        'INSERT INTO financing_plans (cuotas, ctf_pct, enabled) VALUES (?, ?, ?)',
        [p.cuotas, p.ctf_pct, p.enabled]
      );
    }

    await db.query('COMMIT');
    res.json({ ok: true, msg: 'Planes de financiación actualizados' });
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch {
      // noop
    }
    console.error('Error al actualizar planes de financiación:', error);
    res.status(500).json({ ok: false, msg: 'Error al actualizar planes de financiación' });
  }
};

export const limpiarCupones = async (req, res) => {
  try {
    await db.query('START TRANSACTION');
    
    // Eliminar todos los cupones
    const [result] = await db.query('DELETE FROM cupones');
    
    await db.query('COMMIT');
    
    res.json({ 
      ok: true, 
      msg: `Se eliminaron ${result.affectedRows} cupones correctamente` 
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al limpiar cupones:', error);
    res.status(500).json({ 
      ok: false, 
      msg: 'Error al limpiar cupones' 
    });
  }
};

export const limpiarNotificaciones = async (req, res) => {
  try {
    await db.query('START TRANSACTION');
    
    // Eliminar todas las notificaciones
    const [result] = await db.query('DELETE FROM notificaciones');
    
    await db.query('COMMIT');
    
    res.json({ 
      ok: true, 
      msg: `Se eliminaron ${result.affectedRows} notificaciones correctamente` 
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al limpiar notificaciones:', error);
    res.status(500).json({ 
      ok: false, 
      msg: 'Error al limpiar notificaciones' 
    });
  }
};

export const limpiarClientes = async (req, res) => {
  try {
    await db.query('START TRANSACTION');
    
    // Primero eliminar datos relacionados con clientes
    // Terminales
    await db.query('DELETE FROM terminales');
    
    // Sucursales
    await db.query('DELETE FROM sucursales');
    
    // Cupones (que puedan estar relacionados)
    await db.query('DELETE FROM cupones');
    
    // Notificaciones
    await db.query('DELETE FROM notificaciones');
    
    // Finalmente eliminar clientes
    const [result] = await db.query('DELETE FROM clientes');
    
    await db.query('COMMIT');
    
    res.json({ 
      ok: true, 
      msg: `Se eliminaron ${result.affectedRows} clientes y todos sus datos relacionados correctamente` 
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error al limpiar clientes:', error);
    res.status(500).json({ 
      ok: false, 
      msg: 'Error al limpiar clientes' 
    });
  }
};
