/**
 * Webhook público de Kapso (WhatsApp).
 * Montado ANTES de express.json() para poder verificar la firma HMAC sobre el cuerpo crudo.
 *
 * Headers de Kapso: X-Webhook-Event, X-Webhook-Signature (HMAC-SHA256 hex), X-Idempotency-Key,
 * X-Webhook-Payload-Version, y opcionalmente X-Webhook-Batch / X-Batch-Size.
 *
 * Número compartido: un solo número de WhatsApp ("Orbit") atiende a todas las agencias, así que
 * cada evento se atribuye a una organización con resolveInboundOrg():
 *   1. si el número de destino (metadata.phone_number_id) es el número propio de una org → esa org;
 *   2. si no, por el teléfono del remitente (destinatarios de resúmenes, equipo, dueños de marca, clientes);
 *   3. fallback: KAPSO_ORGANIZATION_ID.
 * Todo lo que sigue (pendientes, reuniones → tareas, ventas por WhatsApp, respuestas) usa esa org
 * y responde desde el número de esa org (propio si tiene el add-on, compartido si no).
 */
import express from 'express';
import { getKapsoConfig, verifyKapsoSignature } from '../utils/kapsoClient.js';
import {
  rememberWebhookEvent, handleInboundMessage, handleStatusEvent, resolveInboundOrg, orgSendOptions, sendTextAndRecord,
} from '../services/whatsappService.js';
import { deliverPendingBriefings } from '../services/whatsappBriefings.js';
import { parseWhatsappSalesMessage, upsertWhatsappSale, isWhatsappSalesEnabled } from '../services/whatsappSales.js';
import { handleWhatsappMessage as handleMeetingMessage } from '../services/meetingTasks.js';
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
    const orgId = await resolveInboundOrg(payload);
    const result = await handleInboundMessage(payload, { orgId });
    result.orgId = orgId;
    // Si había resúmenes pendientes (sin ventana de 24 h), el mensaje del usuario la abre: entregarlos
    if (result?.phone) {
      const sent = await deliverPendingBriefings(orgId, result.phone).catch((e) => { console.error('[briefings]', e.message); return 0; });
      if (sent) result.pending_delivered = sent;
      const send = await orgSendOptions(orgId);
      // Equipo: transcripción de reunión → propuesta de tareas (o registro "soy <nombre>")
      const handled = await maybeHandleTeamMeeting(result, payload, send).catch((e) => { console.error('[meetings]', e.message); return false; });
      // Reporte de ventas por WhatsApp escrito por el cliente ("Ventas WhatsApp hoy: $1.250.000, 8 pedidos")
      if (!handled) await maybeRecordWhatsappSales(result, payload, send).catch((e) => console.error('[whatsapp-sales intake]', e.message));
    }
    return result;
  }
  if (STATUS_EVENTS.has(eventName)) {
    const orgId = await resolveInboundOrg(payload).catch(() => getKapsoConfig().organizationId);
    return handleStatusEvent(eventName, payload, { orgId });
  }
  return { ignored: eventName };
};

/**
 * Si el mensaje entrante viene de un cliente con ficha en Orbit y tiene la forma
 * "ventas whatsapp <fecha> <monto> <pedidos>", lo registra y responde con confirmación.
 */
async function maybeRecordWhatsappSales(result, payload, { orgId, phoneNumberId }) {
  if (!result?.clientId) return;
  if (!(await isWhatsappSalesEnabled(result.clientId))) return;
  const text = payload?.message?.text?.body || payload?.message?.kapso?.content || '';
  const parsed = parseWhatsappSalesMessage(text);
  if (!parsed) return;
  const client = await db.get('SELECT id, name, company, nickname FROM clients WHERE id = ? AND organization_id = ?', [result.clientId, orgId]);
  if (!client) return;
  const saved = await upsertWhatsappSale({ clientId: client.id, orgId, date: parsed.date, revenue: parsed.revenue, orders: parsed.orders, notes: `Reportado por WhatsApp: "${text.slice(0, 140)}"`, source: 'whatsapp' });
  const money = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
  const name = client.nickname || client.company || client.name;
  await sendTextAndRecord({
    orgId, to: result.phone, clientId: client.id, phoneNumberId,
    body: `✅ Registrado en Orbit para *${name}*: ventas por WhatsApp del ${saved.date} por ${money(saved.revenue)}${saved.orders ? ` (${saved.orders} pedidos)` : ''}. Si hay un error, envía el dato corregido con la misma fecha y lo reemplazo.`,
    context: { source: 'whatsapp-sales', date: saved.date },
  });
}

/** Mensajes del equipo: reuniones → tareas. Devuelve true si respondió. */
async function maybeHandleTeamMeeting(result, payload, { orgId, phoneNumberId }) {
  const message = payload?.message;
  const text = message?.text?.body || message?.kapso?.content || '';
  const out = await handleMeetingMessage({ orgId, phone: result.phone, text, message });
  if (!out?.reply) return false;
  await sendTextAndRecord({ orgId, to: result.phone, body: out.reply, context: { source: 'meetings' }, phoneNumberId });
  return true;
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
      // Conservamos metadata (phone_number_id de destino) junto al mensaje para resolver la organización
      const payload = item?.data && (item.data.message || item.data.conversation)
        ? { ...item.data, metadata: item.data.metadata || item.metadata || body?.metadata || null }
        : item;
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
