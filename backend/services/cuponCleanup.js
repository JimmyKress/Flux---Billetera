import { db } from '../config/db.js';
import { crearNotificacionCuponEliminado } from '../controllers/notificacionesController.js';

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

const upsertLiquidacionDiariaGlobalSnapshot = async ({ fecha, total_neto }) => {
  await ensureLiquidacionDiariaGlobalHistTable();
  await db.query(
    'INSERT INTO liquidacion_diaria_global_hist (fecha, total_neto) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_neto = VALUES(total_neto)',
    [fecha, Number(total_neto) || 0]
  );
};

export const eliminarCuponesAprobadosDiarios = async () => {
  await db.query('START TRANSACTION');
  try {
    const now = new Date();
    const argentinaNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
    );
    const argentinaYesterday = new Date(argentinaNow);
    argentinaYesterday.setDate(argentinaYesterday.getDate() - 1);
    const targetDate = argentinaYesterday.toISOString().slice(0, 10);

    const [[{ total_neto }]] = await db.query(
      `SELECT COALESCE(SUM(m.neto), 0) AS total_neto
       FROM movimientos m
       WHERE m.tipo_movimiento = 'CUPON'
         AND m.estado IN ('APROBADO', 'PAGADO', 'PENDIENTE')
         AND DATE(m.created_at) = ?`,
      [targetDate]
    );

    await upsertLiquidacionDiariaGlobalSnapshot({ fecha: targetDate, total_neto });

    const [cupones] = await db.query(
      `SELECT cp.id AS cupon_id,
              cp.codigo_cupon,
              cp.cliente_id,
              m.cuit,
              m.neto,
              m.id AS movimiento_id
       FROM cupones cp
       INNER JOIN movimientos m ON m.id = cp.movimiento_id
       WHERE m.tipo_movimiento = 'CUPON'
         AND m.estado = 'APROBADO'
         AND DATE(cp.created_at) = ?`,
      [targetDate]
    );

    if (!cupones.length) {
      await db.query('COMMIT');
      return { eliminados: 0 };
    }

    const cuponIds = cupones.map((c) => c.cupon_id);
    const movimientoIds = cupones.map((c) => c.movimiento_id);
    const cuponPlaceholders = cuponIds.map(() => '?').join(',');
    const movimientoPlaceholders = movimientoIds.map(() => '?').join(',');

    await db.query(
      `UPDATE movimientos
       SET estado = 'ELIMINADO'
       WHERE id IN (${movimientoPlaceholders})`,
      movimientoIds
    );

    await db.query(
      `DELETE FROM wallet_movements
       WHERE movimiento_id IN (${movimientoPlaceholders})`,
      movimientoIds
    );

    await db.query(
      `DELETE FROM cupones
       WHERE id IN (${cuponPlaceholders})`,
      cuponIds
    );

    for (const cupon of cupones) {
      const neto = Number(cupon.neto || 0);
      await db.query(
        `UPDATE clientes
         SET liquidacion_diaria = GREATEST(liquidacion_diaria - ?, 0)
         WHERE id = ?`,
        [neto, cupon.cliente_id]
      );
      await crearNotificacionCuponEliminado(
        cupon.cliente_id,
        cupon.cuit,
        cupon.codigo_cupon || cupon.movimiento_id
      );
    }

    await db.query('COMMIT');
    return { eliminados: cupones.length };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
};

export const scheduleCuponCleanup = () => {
  let lastRunDate = null;
  setInterval(async () => {
    try {
      const now = new Date();
      const argentinaNow = new Date(
        now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
      );
      const dateKey = argentinaNow.toISOString().slice(0, 10);
      if (argentinaNow.getHours() === 0 && argentinaNow.getMinutes() < 5 && lastRunDate !== dateKey) {
        await eliminarCuponesAprobadosDiarios();
        lastRunDate = dateKey;
      }
    } catch (error) {
      // Error en limpieza diaria de cupones
    }
  }, 60 * 1000);
};
