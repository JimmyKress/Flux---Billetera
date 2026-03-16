import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validate.js';
import { requestToken, validateToken } from '../controllers/tokenController.js';

const router = express.Router();

router.post(
  '/request',
  verificarToken,
  [body('type').isString().trim().isLength({ min: 3, max: 40 }), validateRequest],
  requestToken
);

router.post(
  '/validate',
  verificarToken,
  [
    body('type').isString().trim().isLength({ min: 3, max: 40 }),
    body('token').isString().trim().isLength({ min: 3, max: 64 }),
    validateRequest,
  ],
  validateToken
);

export default router;
