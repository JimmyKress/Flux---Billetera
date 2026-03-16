import { Router } from 'express';
import { verificarToken } from '../middleware/auth.js';
import { generarQrEpagos, epagosWebhook } from '../controllers/epagosController.js';

const router = Router();

router.post('/qr', verificarToken, generarQrEpagos);
router.post('/webhook', epagosWebhook);

export default router;
