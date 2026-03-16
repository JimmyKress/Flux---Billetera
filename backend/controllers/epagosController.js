import { generarQrVinculadoEpagos, verifyWebhookSignature } from '../services/epagosSoap.js';

export const generarQrEpagos = async (req, res) => {
  try {
    const amount = req.body?.amount;
    const reference = req.body?.reference;
    const cuit = req.user?.cuit || req.body?.cuit;
    const note = req.body?.note;

    const data = await generarQrVinculadoEpagos({ amount, reference, cuit, note });

    return res.status(200).json({
      ok: true,
      qrBase64: data.qrBase64,
      idResp: data.idResp ?? null,
      respuesta: data.respuesta ?? null,
    });
  } catch (e) {
    console.error('[API][epagos][generarQr][error]', {
      code: e?.code,
      statusCode: e?.statusCode,
      message: e?.message,
      details: e?.details,
    });
    const status = e?.statusCode || 500;
    return res.status(status).json({ ok: false, msg: e?.message || 'Error generando QR.' });
  }
};

export const epagosWebhook = async (req, res) => {
  try {
    const rawBody = req.rawBody;
    const signature = req.headers['x-epagos-signature'] || req.headers['x-signature'] || '';
    const secret = process.env.EPAGOS_WEBHOOK_SECRET || '';

    if (secret) {
      const valid = verifyWebhookSignature({ rawBody, signature, secret });
      if (!valid) {
        console.error('[API][epagos][webhook][invalid_signature]');
        return res.status(401).json({ ok: false });
      }
    }

    console.log('[API][epagos][webhook][event]', {
      headers: {
        'x-epagos-signature': req.headers['x-epagos-signature'],
        'x-signature': req.headers['x-signature'],
      },
      body: req.body,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[API][epagos][webhook][error]', e?.message || e);
    return res.status(500).json({ ok: false });
  }
};
