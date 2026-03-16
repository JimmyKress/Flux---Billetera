import { MercadoPagoConfig, Preference } from 'mercadopago';

const mpAccessToken = process.env.MP_ACCESS_TOKEN;
const mpClient = mpAccessToken ? new MercadoPagoConfig({ accessToken: mpAccessToken }) : null;

export const crearPreferenciaMercadoPago = async (req, res) => {
  try {
    if (!mpClient) {
      return res.status(500).json({ ok: false, msg: 'Mercado Pago no configurado: falta MP_ACCESS_TOKEN' });
    }

    const preference = new Preference(mpClient);

    const title = String(req.body?.title ?? 'Mi producto').slice(0, 120);
    const amount = Number(req.body?.amount);
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;

    return preference
      .create({
        body: {
          items: [
            {
              title,
              quantity: 1,
              unit_price: safeAmount,
            },
          ],
        },
      })
      .then((data) => {
        console.log(data);
        return res.status(200).json({
          preference_id: data?.id ?? null,
          preference_url: data?.init_point ?? data?.sandbox_init_point ?? null,
        });
      })
      .catch((err) => {
        console.error('Error creando preferencia Mercado Pago:', err?.message || err);
        return res.status(500).json({ ok: false, msg: 'Error creando preferencia Mercado Pago' });
      });

  } catch (error) {
    console.error('Error creando preferencia Mercado Pago:', error?.message || error);
    res.status(500).json({ ok: false, msg: 'Error creando preferencia Mercado Pago' });
  }
};
