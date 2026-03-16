import express from 'express';
import { register, verify, login, me, enviarCodigoVerificacion, aceptarTerminos, obtenerEstadoTerminos } from '../controllers/authController.js';
import { verificarToken } from '../middleware/auth.js';
import { body, query } from 'express-validator';
import { validateRequest } from '../middleware/validate.js';

const router = express.Router();

router.post(
  '/register',
  [
    body('nombre').isString().trim().isLength({ min: 2, max: 60 }),
    body('apellido').isString().trim().isLength({ min: 2, max: 60 }),
    body('cuit').isString().trim().matches(/^\d{11}$/),
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    body('cbu').isString().trim().matches(/^\d{22}$/),
    body('password').isString().isLength({ min: 8, max: 128 }),
    validateRequest,
  ],
  register
);

router.post(
  '/verify',
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }), body('token').isString().trim().isLength({ min: 3, max: 16 }), validateRequest],
  verify
);

router.post(
  '/aceptar-terminos',
  [
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    body('firma_base64').isString().trim().matches(/^data:image\/(png|jpeg);base64,/),
    validateRequest,
  ],
  aceptarTerminos
);

router.get(
  '/estado-terminos',
  [query('email').optional().isEmail().normalizeEmail({ gmail_remove_dots: false }), validateRequest],
  obtenerEstadoTerminos
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }), body('password').isString().isLength({ min: 1, max: 128 }), validateRequest],
  login
);

router.post(
  '/enviar-codigo-verificacion',
  [body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }), validateRequest],
  enviarCodigoVerificacion
);
router.post('/resend-code', async (req, res) => {
	const { email } = req.body;
	if (!email) return res.status(400).json({ ok: false, msg: 'Email requerido' });
	try {
		const { resendVerificationCode } = await import('../controllers/authController.js');
		await resendVerificationCode(req, res);
	} catch (e) {
		res.status(500).json({ ok: false, msg: 'Error reenviando código' });
	}
});
router.post('/resend-verify', async (req, res) => {
	const { email } = req.body;
	if (!email) return res.status(400).json({ ok: false, msg: 'Email requerido' });
	try {
		const { resendVerificationCode } = await import('../controllers/authController.js');
		await resendVerificationCode(req, res);
	} catch (e) {
		res.status(500).json({ ok: false, msg: 'Error reenviando código' });
	}
});
router.post('/request-password-reset', async (req, res) => {
	const { requestPasswordReset } = await import('../controllers/authController.js');
	await requestPasswordReset(req, res);
});
router.post('/reset-password', async (req, res) => {
	const { resetPassword } = await import('../controllers/authController.js');
	await resetPassword(req, res);
});
router.get('/me', verificarToken, me);

export default router;
