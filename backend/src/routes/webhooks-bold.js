// [billing] Webhook público de Bold (bold.co). Montar en /api/webhooks/bold ANTES de
// express.json() y sin teamAuth: necesita el cuerpo crudo para verificar la firma.
//
// Firma: header `x-bold-signature` = HMAC-SHA256(secret, base64(body)) en hex.
// Eventos: SALE_APPROVED, SALE_REJECTED, VOID_APPROVED, VOID_REJECTED.
// Bold espera 200 en < 2 s y reintenta hasta 5 veces si no lo recibe.
// Sin BOLD_WEBHOOK_SECRET: 503 en producción; en desarrollo se acepta sin firma (para pruebas locales).
import express from 'express';
import { verifyBoldSignature, applyBoldEvent } from '../services/billing.js';

const router = express.Router();

// Sin secreto solo se aceptan eventos en desarrollo explícito (NODE_ENV=development|test) o con
// BOLD_WEBHOOK_ALLOW_UNSIGNED=1. En Railway NODE_ENV no está definido, así que por defecto se rechaza.
const isProduction = () => !['development', 'test'].includes(process.env.NODE_ENV || '') && process.env.BOLD_WEBHOOK_ALLOW_UNSIGNED !== '1';

router.get('/', (req, res) => {
  res.json({ ok: true, service: 'orbit-bold-webhook', configured: Boolean((process.env.BOLD_WEBHOOK_SECRET || '').trim()) });
});

router.post('/', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const secret = (process.env.BOLD_WEBHOOK_SECRET || '').trim();
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  if (!secret) {
    if (isProduction()) {
      console.error('[bold-webhook] BOLD_WEBHOOK_SECRET no configurado; evento rechazado');
      return res.status(503).json({ error: 'Webhook no configurado' });
    }
    console.warn('[bold-webhook] sin BOLD_WEBHOOK_SECRET: aceptando evento sin verificar firma (solo desarrollo)');
  } else if (!verifyBoldSignature(rawBody, req.get('x-bold-signature'), secret)) {
    console.warn('[bold-webhook] firma inválida');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  try {
    const result = await applyBoldEvent(event, { source: 'webhook' });
    if (process.env.NODE_ENV !== 'production') console.log('[bold-webhook]', event?.type, result);
    // Siempre 200 (incluso referencia desconocida) para que Bold no reintente lo que no es nuestro.
    res.status(200).json({ received: true, ...result });
  } catch (error) {
    console.error('[bold-webhook] error procesando', event?.type, error.message);
    // 500 → Bold reintenta (15 min, 1 h, 4 h, 8 h, 24 h)
    res.status(500).json({ error: 'Error procesando el evento' });
  }
});

export default router;
