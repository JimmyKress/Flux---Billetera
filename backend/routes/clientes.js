import { Router } from 'express';
import { listarClientes, listarClientesAdmin, obtenerClientePorCuit, obtenerPerfilCliente, actualizarPerfilCliente, listarRegistrosPendientes, ocultarRegistrosPendientesAdmin, aprobarRegistroPendiente, rechazarRegistroPendiente, crearClienteAdmin, actualizarClienteAdmin, eliminarClienteAdmin, listarCuentasBancariasClienteAdmin, crearCuentaBancariaClienteAdmin, eliminarCuentaBancariaClienteAdmin } from '../controllers/clientesController.js';
import { obtenerSucursalesPorCliente, obtenerTerminalesPorSucursal, agregarSucursalACliente, eliminarSucursalDeCliente, moverTerminalASucursal } from '../controllers/sucursalesController.js';
import { esAdmin, verificarToken } from '../middleware/auth.js';
import { adminIpWhitelist } from '../middleware/adminIpWhitelist.js';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

// ADMIN: CRUD de clientes + registros pendientes
router.get('/admin', esAdmin, adminIpWhitelist(), listarClientesAdmin);
router.post(
  '/admin',
  esAdmin,
  adminIpWhitelist(),
  [
    body('nombre').isString().trim().isLength({ min: 2, max: 60 }),
    body('apellido').isString().trim().isLength({ min: 2, max: 60 }),
    body('cuit').isString().trim().matches(/^\d{11}$/),
    body('email').isEmail().normalizeEmail(),
    body('cbu').isString().trim().matches(/^\d{22}$/),
    body('password').isString().isLength({ min: 8, max: 128 }),
    validateRequest,
  ],
  crearClienteAdmin
);
router.get('/admin/registros-pendientes', esAdmin, adminIpWhitelist(), listarRegistrosPendientes);
router.post(
  '/admin/registros-pendientes/ocultar',
  esAdmin,
  adminIpWhitelist(),
  [body('ids').isArray({ min: 1 }), body('ids.*').isInt({ min: 1 }), validateRequest],
  ocultarRegistrosPendientesAdmin
);
router.post('/admin/registros-pendientes/aprobar', esAdmin, adminIpWhitelist(), [body('id').isInt({ min: 1 }), validateRequest], aprobarRegistroPendiente);
router.post(
  '/admin/registros-pendientes/rechazar',
  esAdmin,
  adminIpWhitelist(),
  [body('id').isInt({ min: 1 }), body('motivo').optional().isString().trim().isLength({ max: 240 }), validateRequest],
  rechazarRegistroPendiente
);
router.put(
  '/admin/:id',
  esAdmin,
  adminIpWhitelist(),
  [
    param('id').isInt({ min: 1 }),
    body('nombre').optional().isString().trim().isLength({ min: 2, max: 60 }),
    body('apellido').optional().isString().trim().isLength({ min: 2, max: 60 }),
    body('cuit').optional().isString().trim().matches(/^\d{11}$/),
    body('email').optional().isEmail().normalizeEmail(),
    body('cbu_registro').optional().isString().trim().matches(/^\d{22}$/),
    body('banco').optional().isString().trim().isLength({ max: 120 }),
    body('alias').optional().isString().trim().isLength({ max: 50 }),
    body('edad').optional().isInt({ min: 0, max: 120 }),
    body('direccion').optional().isString().trim().isLength({ max: 120 }),
    body('ubicacion').optional().isString().trim().isLength({ max: 120 }),
    body('sexo').optional().isString().trim().isLength({ max: 20 }),
    validateRequest,
  ],
  actualizarClienteAdmin
);

router.get('/admin/:clienteId/cuentas-bancarias', esAdmin, adminIpWhitelist(), [param('clienteId').isInt({ min: 1 }), validateRequest], listarCuentasBancariasClienteAdmin);
router.post(
  '/admin/:clienteId/cuentas-bancarias',
  esAdmin,
  adminIpWhitelist(),
  [
    param('clienteId').isInt({ min: 1 }),
    body('cbu').isString().trim().matches(/^\d{22}$/),
    body('alias').optional().isString().trim().isLength({ max: 50 }),
    body('banco').optional().isString().trim().isLength({ max: 120 }),
    body('is_default').optional().isBoolean(),
    validateRequest,
  ],
  crearCuentaBancariaClienteAdmin
);
router.delete('/admin/cuentas-bancarias/:id', esAdmin, adminIpWhitelist(), [param('id').isInt({ min: 1 }), validateRequest], eliminarCuentaBancariaClienteAdmin);

router.put(
  '/admin/terminales/:terminalId/mover-sucursal',
  esAdmin,
  adminIpWhitelist(),
  [param('terminalId').isInt({ min: 1 }), body('sucursal_id').isInt({ min: 1 }), validateRequest],
  moverTerminalASucursal
);
router.delete('/admin/:id', esAdmin, adminIpWhitelist(), eliminarClienteAdmin);

// Obtener todos los clientes
router.get('/', listarClientes);

// Obtener perfil del cliente autenticado (con saldo)
router.get('/perfil/actual', verificarToken, obtenerPerfilCliente);

// Actualizar perfil del cliente autenticado (CBU, alias)
router.put(
  '/perfil/actual',
  verificarToken,
  [
    body('alias').optional().isString().trim().isLength({ max: 50 }),
    body('banco').optional().isString().trim().isLength({ max: 120 }),
    body('edad').optional().isInt({ min: 0, max: 120 }),
    body('direccion').optional().isString().trim().isLength({ max: 120 }),
    body('ubicacion').optional().isString().trim().isLength({ max: 120 }),
    body('sexo').optional().isString().trim().isLength({ max: 20 }),
    validateRequest,
  ],
  actualizarPerfilCliente
);

// Obtener un cliente por CUIT
router.get('/:cuit', obtenerClientePorCuit);

// Obtener sucursales de un cliente
router.get('/:clienteId/sucursales', obtenerSucursalesPorCliente);

// Obtener terminales de una sucursal
router.get('/sucursal/:sucursalId/terminales', obtenerTerminalesPorSucursal);

// ADMIN: Agregar terminal a sucursal
import { agregarTerminalASucursal, eliminarTerminalDeSucursal } from '../controllers/sucursalesController.js';
router.post('/sucursal/:sucursalId/terminales', agregarTerminalASucursal);
// ADMIN: Eliminar terminal de sucursal
router.delete('/sucursal/:sucursalId/terminales/:terminalId', eliminarTerminalDeSucursal);

// ADMIN: Agregar sucursal a cliente
router.post('/:clienteId/sucursales', agregarSucursalACliente);

// ADMIN: Eliminar sucursal de cliente
router.delete('/:clienteId/sucursales/:sucursalId', eliminarSucursalDeCliente);

export default router;
