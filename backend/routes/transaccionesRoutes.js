import express from 'express';
import { crearCupon, listarMovimientos, aprobarMovimiento, rechazarMovimiento, crearAjuste, listarAjustes, obtenerAuditoria, crearAjusteNegativo, obtenerAjustesNegativos, aprobarAjuste, rechazarAjuste, ingresarDinero, eliminarMovimiento, ocultarMovimientosCliente, ocultarTodoHistorialCliente, enviarCuponEmail, aprobarTodosLosCupones, rechazarTodosLosCupones, notificarCuponesCreados } from '../controllers/transaccionesController.js';
import { esAdmin, verificarToken } from '../middleware/auth.js';
import { body, query } from 'express-validator';
import { validateRequest } from '../middleware/validate.js';

const router = express.Router();

// CUPONES
router.post(
  '/cupon',
  esAdmin,
  [
    body('cuit').isString().trim().matches(/^\d{11}$/),
    body('montoBruto').isNumeric(),
    body('descripcion').optional().isString().trim().isLength({ max: 240 }),
    validateRequest,
  ],
  crearCupon
);
router.get(
  '/',
  [
    query('cuit').optional().isString().trim().matches(/^\d{11}$/),
    query('tipo_movimiento').optional().isString().trim().isLength({ max: 30 }),
    query('estado').optional().isString().trim().isLength({ max: 30 }),
    query('fechaDesde').optional().isString().trim().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('fechaHasta').optional().isString().trim().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('excludeTipos').optional().isString().trim().isLength({ max: 240 }),
    query('excludeEstados').optional().isString().trim().isLength({ max: 240 }),
    query('limit').optional().isInt({ min: 1, max: 20000 }),
    query('offset').optional().isInt({ min: 0, max: 200000 }),
    validateRequest,
  ],
  listarMovimientos
);

// AJUSTES REGULARES
router.post('/ajuste', esAdmin, crearAjuste);
router.get('/ajustes', listarAjustes);

// AJUSTES NEGATIVOS
router.post('/crear-ajuste-negativo', esAdmin, crearAjusteNegativo);
router.get('/ajustes-negativos', obtenerAjustesNegativos);
router.post('/aprobar-ajuste', esAdmin, aprobarAjuste);
router.post('/rechazar-ajuste', esAdmin, rechazarAjuste);

// APROBACIONES (Compatibilidad)
router.post('/aprobar', esAdmin, aprobarMovimiento);
router.post('/rechazar', esAdmin, rechazarMovimiento);

// APROBACIONES MASIVAS
router.post(
  '/aprobar-todos-cupones',
  esAdmin,
  [body('cuit').optional().isString().trim().matches(/^\d{11}$/), validateRequest],
  aprobarTodosLosCupones
);
router.post(
  '/rechazar-todos-cupones',
  esAdmin,
  [body('cuit').optional().isString().trim().matches(/^\d{11}$/), validateRequest],
  rechazarTodosLosCupones
);

// NOTIFICACIONES
router.post(
  '/notificar-cupones-creados',
  esAdmin,
  [body('cuit').optional().isString().trim().matches(/^\d{11}$/), validateRequest],
  notificarCuponesCreados
);

// CREAR CUPÓN (Ruta alternativa)
router.post(
  '/crear-cupon',
  esAdmin,
  [
    body('cuit').isString().trim().matches(/^\d{11}$/),
    body('montoBruto').isNumeric(),
    body('descripcion').optional().isString().trim().isLength({ max: 240 }),
    validateRequest,
  ],
  crearCupon
);

// ENVIAR CUPÓN POR EMAIL (Admin)
router.post(
  '/cupon/enviar-email',
  esAdmin,
  [body('id').isInt({ min: 1 }), body('force').optional().isBoolean(), validateRequest],
  enviarCuponEmail
);

// INGRESO DE DINERO (Cliente)
router.post(
  '/ingresar-dinero',
  verificarToken,
  [body('monto').isNumeric(), body('cuit').optional().isString().trim().matches(/^\d{11}$/), validateRequest],
  ingresarDinero
);

// OCULTAR historial (Cliente)
router.post(
  '/ocultar',
  verificarToken,
  [body('ids').isArray({ min: 1 }), body('ids.*').isInt({ min: 1 }), validateRequest],
  ocultarMovimientosCliente
);
router.post('/ocultar-todo', verificarToken, ocultarTodoHistorialCliente);

// ELIMINAR (soft-delete) movimiento (Admin)
router.post(
  '/eliminar',
  esAdmin,
  [body('id').isInt({ min: 1 }), body('motivo').optional().isString().trim().isLength({ max: 240 }), validateRequest],
  eliminarMovimiento
);

// AUDITORÍA
router.get('/auditoria/logs', obtenerAuditoria);

export default router;

