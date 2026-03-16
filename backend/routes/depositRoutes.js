import express from 'express';
import { verificarToken, esAdmin } from '../middleware/auth.js';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validate.js';
import {
  requestDepositAccess,
  validateDepositAccess,
  uploadDepositReceipt,
  confirmDeposit,
  adminListPendingDeposits,
  adminListApprovedDeposits,
  adminDownloadReceipt,
  adminApproveDeposit,
  adminRejectDeposit,
} from '../controllers/depositController.js';

const router = express.Router();

router.post('/access/request', verificarToken, requestDepositAccess);
router.post(
  '/access/validate',
  verificarToken,
  [body('token').isString().trim().isLength({ min: 3, max: 64 }), validateRequest],
  validateDepositAccess
);

router.post(
  '/receipt/upload',
  verificarToken,
  [
    body('filename').isString().trim().isLength({ min: 1, max: 180 }),
    body('mime').isString().trim().isLength({ min: 3, max: 80 }),
    body('data_base64').isString().trim().isLength({ min: 10 }),
    validateRequest,
  ],
  uploadDepositReceipt
);

router.post(
  '/confirm',
  verificarToken,
  [body('receipt_id').isInt({ min: 1 }), validateRequest],
  confirmDeposit
);

// Admin
router.get('/admin/pending', esAdmin, adminListPendingDeposits);
router.get('/admin/approved', esAdmin, adminListApprovedDeposits);
router.get('/admin/receipt/:id', esAdmin, adminDownloadReceipt);
router.post(
  '/admin/approve',
  esAdmin,
  [
    body('deposit_id').isInt({ min: 1 }),
    validateRequest,
  ],
  adminApproveDeposit
);
router.post(
  '/admin/reject',
  esAdmin,
  [
    body('deposit_id').isInt({ min: 1 }),
    body('reason').optional().isString().trim().isLength({ max: 240 }),
    validateRequest,
  ],
  adminRejectDeposit
);

export default router;
