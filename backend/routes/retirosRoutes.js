import express from 'express';
import { solicitarRetiro, confirmarRetiroToken, confirmarRetiroToken2, descargarComprobanteRetiro, descargarComprobanteRetiroPdf, listarRetirosPendientes, listarHistoricoRetiros, aprobarRetiro, rechazarRetiro, obtenerSaldoCliente, ocultarRetirosCliente, ocultarTodoHistoricoRetirosCliente, ocultarRetirosAdmin, eliminarRetiroAdmin } from '../controllers/retirosController.js';
import { esAdmin, verificarToken } from '../middleware/auth.js';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validate.js';

const router = express.Router();

// RETIROS - Cliente
router.post(
  '/solicitar',
  verificarToken,
  [body('monto').isNumeric(), body('cbu').isString().trim().matches(/^\d{22}$/), validateRequest],
  solicitarRetiro
);
router.post(
  '/confirmar-token',
  verificarToken,
  [body('id').isInt({ min: 1 }), body('token').isString().trim().isLength({ min: 3, max: 12 }), validateRequest],
  confirmarRetiroToken
);
router.post(
  '/confirmar-token2',
  verificarToken,
  [body('id').isInt({ min: 1 }), body('token').isString().trim().isLength({ min: 3, max: 12 }), validateRequest],
  confirmarRetiroToken2
);
router.get('/comprobante/:id', verificarToken, descargarComprobanteRetiro);
router.get('/comprobante-pdf/:id', verificarToken, descargarComprobanteRetiroPdf);
//router.get('/comprobante-pdf-publico', descargarComprobanteRetiroPdfPublico);
router.get('/saldo/:cuit', obtenerSaldoCliente);
router.post(
  '/ocultar',
  verificarToken,
  [body('ids').isArray({ min: 1 }), body('ids.*').isInt({ min: 1 }), validateRequest],
  ocultarRetirosCliente
);
router.post('/ocultar-todo', verificarToken, ocultarTodoHistoricoRetirosCliente);

// RETIROS - Admin
router.get('/pendientes', esAdmin, listarRetirosPendientes);
router.get('/historico', esAdmin, listarHistoricoRetiros);
router.get('/historico/:cuit', listarHistoricoRetiros);
router.post('/aprobar', esAdmin, [body('id').isInt({ min: 1 }), validateRequest], aprobarRetiro);
router.post(
  '/rechazar',
  esAdmin,
  [body('id').isInt({ min: 1 }), body('motivo').optional().isString().trim().isLength({ max: 240 }), validateRequest],
  rechazarRetiro
);
router.post(
  '/eliminar-admin',
  esAdmin,
  [body('id').isInt({ min: 1 }), body('motivo').optional().isString().trim().isLength({ max: 240 }), validateRequest],
  eliminarRetiroAdmin
);
router.post(
  '/ocultar-admin',
  esAdmin,
  [body('ids').isArray({ min: 1 }), body('ids.*').isInt({ min: 1 }), validateRequest],
  ocultarRetirosAdmin
);

export default router;
