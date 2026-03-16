import { Router } from 'express';
import { refreshToken } from '../controllers/authController.js';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

router.post(
  '/',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token requerido'),
    validateRequest,
  ],
  refreshToken
);

export default router;
