import express from 'express';
import { obtenerNotificaciones, obtenerNotificacionesAdmin, marcarComoLeida, eliminarNotificacion } from '../controllers/notificacionesController.js';
import { eliminarCuponesAprobadosDiarios } from '../services/cuponCleanup.js';
import { esAdmin } from '../middleware/auth.js';

const router = express.Router();

// Obtener notificaciones para admin
router.get('/admin/list', esAdmin, obtenerNotificacionesAdmin);

// Ejecutar limpieza de cupones (solo admin, endpoint de prueba)
router.post('/admin/test-cleanup', esAdmin, async (req, res) => {
  try {
    const resultado = await eliminarCuponesAprobadosDiarios();
    res.json({ ok: true, data: resultado });
  } catch (error) {
    res.status(500).json({ ok: false, msg: error.message });
  }
});

// Obtener notificaciones del cliente
router.get('/:cuit', obtenerNotificaciones);

// Marcar como leída
router.post('/:id/marcar-leida', marcarComoLeida);

// Eliminar notificación
router.delete('/:id', eliminarNotificacion);

export default router;
