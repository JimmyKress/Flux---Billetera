import express from 'express';
import {
  limpiarCupones,
  limpiarNotificaciones,
  limpiarClientes,
  obtenerLiquidacionDiariaGlobal,
  obtenerLiquidacionDiariaGlobalHistorial,
  guardarLiquidacionDiariaGlobalSnapshot,
  obtenerFinancingPlans,
  actualizarFinancingPlans,
  obtenerFinancingStatus,
  actualizarFinancingStatus,
  obtenerClientCalcHistory,
  crearClientCalcHistory,
  eliminarClientCalcHistory,
  eliminarClientCalcHistoryItem,
} from '../controllers/configController.js';
import { esAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/financing-status', obtenerFinancingStatus);
router.put('/financing-status', esAdmin, actualizarFinancingStatus);
router.get('/financing-plans', obtenerFinancingPlans);
router.put('/financing-plans', esAdmin, actualizarFinancingPlans);

router.get('/client-calc-history', esAdmin, obtenerClientCalcHistory);
router.post('/client-calc-history', esAdmin, crearClientCalcHistory);
router.delete('/client-calc-history', esAdmin, eliminarClientCalcHistory);
router.delete('/client-calc-history/:id', esAdmin, eliminarClientCalcHistoryItem);

router.get('/liquidacion-diaria-global', esAdmin, obtenerLiquidacionDiariaGlobal);
router.get('/liquidacion-diaria-global/historial', esAdmin, obtenerLiquidacionDiariaGlobalHistorial);
router.post('/liquidacion-diaria-global/snapshot', esAdmin, guardarLiquidacionDiariaGlobalSnapshot);

// Rutas de configuración (solo admin)
router.post('/limpiar-cupones', esAdmin, limpiarCupones);
router.post('/limpiar-notificaciones', esAdmin, limpiarNotificaciones);
router.post('/limpiar-clientes', esAdmin, limpiarClientes);

export default router;
