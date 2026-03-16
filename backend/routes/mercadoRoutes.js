import { Router } from 'express';
import { crearPreferenciaMercadoPago } from '../controllers/mercadoController.js';

const router = Router();

router.post('/preference', crearPreferenciaMercadoPago);

export default router;