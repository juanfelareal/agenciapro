/**
 * Webhook público de Kapso (WhatsApp).
 * Montado ANTES de express.json() para poder verificar la firma HMAC sobre el cuerpo crudo.
 *
 * Headers de Kapso: X-Webhook-Event, X-Webhook-Signature (HMAC-SHA256 hex), X-Idempotency-Key,
 * X-Webhook-Payload-Version, y opcionalmente X-Webhook-Batch / X-Batch-Size.
 */
import express from 'express';
import { getKapsoConfig, verifyKapsoSignature } from '../utils/kapsoClient.js';
import { rememberWebhookEvent, handleInboundMessage, handleStatusEvent } from '../services/whatsappService.js';
import { deliverPendingBriefings } from '../services/whatsappBriefings.js';
import { parseWhatsappSalesMessage, upsertWhatsappSale, isWhatsappSalesEnabled } from '../services/whatsappSales.js';
import { sendTextAndRecord } from '../services/whatsappService.js';
import db from '../config/database.js';

const router = express.Router();

const STATUS_EVENTS = new Set([
  'whatsapp.message.sent',
  'whatsapp.message.delivered',
  'whatsapp.message.read',
  'whatsapp.message.failed',
]);

const processEvent = async (eventName, payload) => {
  if (eventName === 'whatsapp.message.received') {
    const result = await handleInboundMessage(payload);
    // Si había resúmenes pendientes (sin ventana de 24 h), el mensaje del usuario la abre: entregarlos
    if (result?.phone) {
      const sent = await deliverPendingBriefings(getKapsoConfig().organizationId, result.phone).catch((e) => { console.error('[briefings]', e.message); return 0; });
      if (sent) result.pending_delivered = sent;
      // Reporte de ventas por WhatsApp escrito por el cliente ("Ventas WhatsApp hoy: $1.250.000, 8 pedidos")
      await maybeRecordWhatsappSales(result, payload).catch((e) => console.error('[whatsapp-sales intake]', e.message));
    }
    return result;
  }
  if (STATUS_EVENTS.has(eventName)) return handleStatusEvent(eventName, payload);
  return { ignored: eventName };
};

/**
 * Si el mensaje entrante viene de un cliente con ficha en Orbit y tiene la forma
 * "ventas whatsapp <fecha> <monto> <pedidos>", lo registra y responde con confirmación.
 */
async function maybeRecordWhatsappSales(result, payload) {
  if (!result?.clientId) return;
  if (!(await isWhatsappSalesEnabled(result.clientId))) return;
  const text = payload?.message?.text?.body || payload?.message?.kapso?.content || '';
  const parsed = parseWhatsappSalesMessage(text);
  if (!parsed) return;
  const orgId = getKapsoConfig().organizationId;
  const client = await db.get('SELECT id, name, company, nickname FROM clients WHERE id = ? AND organization_id = ?', [result.clientId, orgId]);
  if (!client) return;
  const saved = await upsertWhatsappSale({ clientId: client.id, orgId, date: parsed.date, revenue: parsed.revenue, orders: parsed.orders, notes: `Reportado por WhatsApp: "${text.slice(0, 140)}"`, source: 'whatsapp' });
  const money = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const name = client.nickname || client.company || client.name;
  await sendTextAndRecord({
    orgId, to: result.phone, clientId: client.id,
    body: `✅ Registrado en Orbit para *${name}*: ventas por WhatsApp del ${saved.date} por ${money(saved.revenue)}${saved.orders ? ` (${saved.orders} pedidos)` : ''}. Si hay un error, envía el dato corregido con la misma fecha y lo reemplazo.`,
    context: { source: 'whatsapp-sales', date: saved.date },
  });
}

// Verificación simple de que el endpoint está vivo (Kapso no usa GET challenge, pero sirve para probar)
router.get('/', (req, res) => {
  res.json({ ok: true, service: 'orbit-whatsapp-webhook', configured: Boolean(getKapsoConfig().webhookSecret) });
});

router.post('/', express.raw({ type: '*/*', limit: '2mb' }), async (req, res) => {
  const { webhookSecret } = getKapsoConfig();
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  if (!webhookSecret) {
    console.error('[whatsapp-webhook] KAPSO_WEBHOOK_SECRET no configurado; evento rechazado');
    return res.status(503).json({ error: 'Webhook no configurado' });
  }
  if (!verifyKapsoSignature(rawBody, req.get('X-Webhook-Signature'), webhookSecret)) {
    console.warn('[whatsapp-webhook] firma inválida');
    return res.status(401).json({ error: 'Firma inválida' });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  const eventName = req.get('X-Webhook-Event') || body?.event || body?.event_type || '';
  const idempotencyKey = req.get('X-Idempotency-Key') || null;

  // Respondemos rápido (Kapso exige 200 en < 10 s) y procesamos sin bloquear la respuesta.
  res.status(200).json({ received: true });

  try {
    const fresh = await rememberWebhookEvent(idempotencyKey, eventName);
    if (!fresh) return;

    const isBatch = String(req.get('X-Webhook-Batch') || '').toLowerCase() === 'true' || Array.isArray(body) || Array.isArray(body?.events);
    const items = isBatch ? (Array.isArray(body) ? body : (body.events || [])) : [body];

    for (const item of items) {
      const itemEvent = item?.event || item?.event_type || eventName;
      const payload = item?.data && (item.data.message || item.data.conversation) ? item.data : item;
      try {
        const result = await processEvent(itemEvent, payload);
        if (process.env.NODE_ENV !== 'production') console.log('[whatsapp-webhook]', itemEvent, result);
      } catch (err) {
        console.error('[whatsapp-webhook] error procesando', itemEvent, err.message);
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] error general:', err.message);
  }
});

export default router;
