// ADMIN: Agregar sucursal a cliente
export async function agregarSucursalACliente(req, res) {
  const { clienteId } = req.params;
  const { nombre, direccion } = req.body;
  if (!nombre || !direccion) {
    return res.status(400).json({ ok: false, msg: 'Faltan datos de sucursal' });
  }
  try {
    // Verificar que el cliente existe
    const [clientes] = await db.query('SELECT id FROM clientes WHERE id = ?', [clienteId]);
    if (clientes.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    }
    // Insertar sucursal asociada al cliente
    await db.query('INSERT INTO sucursales (nombre, direccion, cliente_id) VALUES (?, ?, ?)', [nombre, direccion, clienteId]);
    return res.json({ ok: true, msg: 'Sucursal agregada correctamente' });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Error al agregar sucursal', error: err });
  }
}

// ADMIN: Eliminar sucursal de cliente
export async function eliminarSucursalDeCliente(req, res) {
  const { clienteId, sucursalId } = req.params;
  try {
    // Verificar que la sucursal pertenece al cliente
    const [sucursales] = await db.query('SELECT id FROM sucursales WHERE id = ? AND cliente_id = ?', [sucursalId, clienteId]);
    if (sucursales.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Sucursal no encontrada para este cliente' });
    }
    // Eliminar sucursal
    await db.query('DELETE FROM sucursales WHERE id = ?', [sucursalId]);
    return res.json({ ok: true, msg: 'Sucursal eliminada correctamente' });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: 'Error al eliminar sucursal', error: err });
  }
}
import { db } from '../config/db.js';

export const obtenerSucursalesPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const [sucursales] = await db.query(
      'SELECT id, nombre, direccion FROM sucursales WHERE cliente_id = ? ORDER BY nombre',
      [clienteId]
    );
    res.json({ ok: true, data: sucursales });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const obtenerTerminalesPorSucursal = async (req, res) => {
  try {
    const { sucursalId } = req.params;
    const [terminales] = await db.query(
      'SELECT id, nombre, tipo FROM terminales WHERE sucursal_id = ? ORDER BY nombre',
      [sucursalId]
    );
    res.json({ ok: true, data: terminales });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const moverTerminalASucursal = async (req, res) => {
  try {
    const { terminalId } = req.params;
    const { sucursal_id } = req.body;
    if (!terminalId) return res.status(400).json({ ok: false, msg: 'terminalId requerido' });
    if (!sucursal_id) return res.status(400).json({ ok: false, msg: 'sucursal_id requerido' });

    const [termRows] = await db.query('SELECT id, sucursal_id FROM terminales WHERE id = ? LIMIT 1', [terminalId]);
    if (!termRows.length) return res.status(404).json({ ok: false, msg: 'Terminal no encontrada' });

    const [sucRows] = await db.query('SELECT id FROM sucursales WHERE id = ? LIMIT 1', [sucursal_id]);
    if (!sucRows.length) return res.status(404).json({ ok: false, msg: 'Sucursal destino no encontrada' });

    await db.query('UPDATE terminales SET sucursal_id = ? WHERE id = ?', [sucursal_id, terminalId]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: 'Error al mover terminal' });
  }
};

// ADMIN: Agregar terminal a sucursal
export const agregarTerminalASucursal = async (req, res) => {
  try {
    const { sucursalId } = req.params;
    const { nombre, tipo } = req.body;
    if (!nombre) {
      return res.status(400).json({ ok: false, msg: 'Falta el nombre de la terminal' });
    }
    // Verificar que la sucursal existe
    const [sucursales] = await db.query('SELECT id FROM sucursales WHERE id = ?', [sucursalId]);
    if (sucursales.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Sucursal no encontrada' });
    }
    await db.query('INSERT INTO terminales (nombre, tipo, sucursal_id) VALUES (?, ?, ?)', [nombre, tipo || '', sucursalId]);
    res.json({ ok: true, msg: 'Terminal agregada correctamente' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al agregar terminal', error: e.message });
  }
};

// ADMIN: Eliminar terminal de sucursal
export const eliminarTerminalDeSucursal = async (req, res) => {
  try {
    const { sucursalId, terminalId } = req.params;
    // Verificar que la terminal pertenece a la sucursal
    const [terminales] = await db.query('SELECT id FROM terminales WHERE id = ? AND sucursal_id = ?', [terminalId, sucursalId]);
    if (terminales.length === 0) {
      return res.status(404).json({ ok: false, msg: 'Terminal no encontrada para esta sucursal' });
    }

    await db.query('START TRANSACTION');
    try {
      await db.query('UPDATE cupones SET terminal_id = NULL WHERE terminal_id = ?', [terminalId]);
      await db.query('UPDATE movimientos SET terminal_id = NULL WHERE terminal_id = ?', [terminalId]);
      await db.query('DELETE FROM terminales WHERE id = ?', [terminalId]);
      await db.query('COMMIT');
    } catch (inner) {
      await db.query('ROLLBACK');
      throw inner;
    }

    res.json({ ok: true, msg: 'Terminal eliminada correctamente' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Error al eliminar terminal', error: e.message });
  }
};
