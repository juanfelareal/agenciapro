/**
 * Servicio de WhatsApp (Kapso): persistencia de mensajes, emparejado con clientes
 * y helpers de envío que dejan trazabilidad en `whatsapp_messages`.
 */
import db from '../config/database.js';
import {
  getKapsoConfig,
  normalizeWaNumber,
  phoneTail,
  sendText,
  sendTemplate,
  extractMessageText,
} from '../utils/kapsoClient.js';
import { createNotification } from '../utils/notificationHelper.js';

const CLIENT_NAME_SQL = `CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END`;

/** Busca el cliente de la organización cuyo teléfono termina igual (10 dígitos) */
export const matchClientByPhone = async (phone, orgId) => {
  const tail = phoneTail(phone);
  if (!tail || tail.length < 7) return null;
  return db.get(`
    SELECT c.id, ${CLIENT_NAME_SQL} as display_name, c.phone
    FROM clients c
    WHERE c.organization_id = ?
      AND c.phone IS NOT NULL
      AND RIGHT(REGEXP_REPLACE(c.phone, '\\D', '', 'g'), 10) = ?
    ORDER BY c.id ASC
    LIMIT 1
  `, [orgId, tail]);
};

/** Busca un creador UGC por teléfono (opcional, para mostrar nombre en el inbox) */
const matchCreatorByPhone = async (phone, orgId) => {
  const tail = phoneTail(phone);
  if (!tail || tail.length < 7) return null;
  try {
    return await db.get(`
      SELECT id, full_name as display_name
      FROM ugc_creators
      WHERE organization_id = ? AND phone IS NOT NULL
        AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ?
      LIMIT 1
    `, [orgId, tail]);
  } catch {
    return null;
  }
};

/** Guarda un mensaje saliente ya aceptado por Meta */
export const recordOutbound = async ({
  orgId, clientId = null, phone, wamid, body, messageType = 'text', templateName = null,
  context = null, sentBy = null, status = 'sent', contactName = null, payload = null,
}) => {
  const result = await db.run(`
    INSERT INTO whatsapp_messages
      (organization_id, client_id, wa_message_id, direction, phone, contact_name, message_type, body, template_name, status, context, sent_by, payload)
    VALUES (?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    orgId, clientId, wamid, normalizeWaNumber(phone), contactName, messageType, body, templateName, status,
    context ? JSON.stringify(context) : null, sentBy, payload ? JSON.stringify(payload) : null,
  ]);
  return result.lastInsertRowid;
};

/**
 * Envía texto libre y lo registra. Si no se pasa clientId intenta emparejar por teléfono.
 */
export const sendTextAndRecord = async ({ orgId, to, body, clientId = null, context = null, sentBy = null }) => {
  const phone = normalizeWaNumber(to);
  if (!phone || phone.length < 8) throw new Error('Número de WhatsApp inválido');
  if (!body || !String(body).trim()) throw new Error('El mensaje no puede estar vacío');
  const client = clientId ? null : await matchClientByPhone(phone, orgId);
  const result = await sendText({ to: phone, body });
  const id = await recordOutbound({
    orgId, clientId: clientId || client?.id || null, phone, wamid: result.wamid, body, messageType: 'text',
    context, sentBy, status: result.messageStatus === 'accepted' ? 'sent' : (result.messageStatus || 'sent'), contactName: client?.display_name || null,
  });
  return { id, wamid: result.wamid, phone, clientId: clientId || client?.id || null };
};

/** Envía una plantilla y la registra con el texto renderizado (para el inbox) */
export const sendTemplateAndRecord = async ({
  orgId, to, name, language = 'es', components = [], renderedText = '', clientId = null, context = null, sentBy = null,
}) => {
  const phone = normalizeWaNumber(to);
  if (!phone || phone.length < 8) throw new Error('Número de WhatsApp inválido');
  const client = clientId ? null : await matchClientByPhone(phone, orgId);
  const result = await sendTemplate({ to: phone, name, language, components });
  const id = await recordOutbound({
    orgId, clientId: clientId || client?.id || null, phone, wamid: result.wamid,
    body: renderedText || `[Plantilla ${name}]`, messageType: 'template', templateName: name,
    context, sentBy, status: 'sent', contactName: client?.display_name || null,
    payload: { components },
  });
  return { id, wamid: result.wamid, phone, clientId: clientId || client?.id || null };
};

// ---------------------------------------------------------------------------
// Webhooks entrantes
// ---------------------------------------------------------------------------

/** Deduplicación por idempotency key (Kapso reintenta si no respondemos 200) */
export const rememberWebhookEvent = async (idempotencyKey, eventName) => {
  if (!idempotencyKey) return true;
  try {
    await db.run(
      `INSERT INTO whatsapp_webhook_events (idempotency_key, event) VALUES (?, ?) RETURNING idempotency_key`,
      [idempotencyKey, eventName || null],
    );
    return true;
  } catch (error) {
    if (String(error.message || '').includes('duplicate key')) return false;
    throw error;
  }
};

const notifyTeamInbound = async ({ orgId, phone, contactName, text, messageId }) => {
  try {
    const recipients = await db.all(`
      SELECT id FROM team_members
      WHERE organization_id = ? AND role IN ('admin', 'manager') AND status = 'active'
    `, [orgId]);
    const title = `WhatsApp de ${contactName || `+${phone}`}`;
    const preview = String(text || '').slice(0, 140);
    await Promise.all((recipients || []).map((m) =>
      createNotification(m.id, 'whatsapp_received', title, preview, 'whatsapp_message', messageId, { phone }, orgId, { category: 'system' })));
  } catch (error) {
    console.error('[whatsapp] notifyTeamInbound:', error.message);
  }
};

/** Procesa whatsapp.message.received */
export const handleInboundMessage = async (payload) => {
  const { organizationId: orgId } = getKapsoConfig();
  const message = payload?.message;
  const conversation = payload?.conversation || {};
  if (!message?.id) return { skipped: 'sin message.id' };

  const rawPhone = conversation.phone_number || message.from || payload?.from || '';
  const phone = normalizeWaNumber(rawPhone);
  const text = extractMessageText(message);
  const contactNameFromWa = conversation.kapso?.contact_name || message.kapso?.contact_name || null;
  const client = await matchClientByPhone(phone, orgId);
  const creator = client ? null : await matchCreatorByPhone(phone, orgId);
  const contactName = client?.display_name || creator?.display_name || contactNameFromWa;
  const mediaUrl = message.kapso?.media_url || message.image?.link || message.document?.link || null;
  const ts = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();

  const existing = await db.get(`SELECT id FROM whatsapp_messages WHERE wa_message_id = ?`, [message.id]);
  if (existing) return { duplicate: true, id: existing.id };

  const result = await db.run(`
    INSERT INTO whatsapp_messages
      (organization_id, client_id, wa_message_id, conversation_id, direction, phone, contact_name, message_type, body, media_url, status, payload, created_at)
    VALUES (?, ?, ?, ?, 'inbound', ?, ?, ?, ?, ?, 'received', ?, ?)
  `, [
    orgId, client?.id || null, message.id, conversation.id || null, phone, contactName,
    message.type || 'text', text, mediaUrl, JSON.stringify(message), ts,
  ]);

  await notifyTeamInbound({ orgId, phone, contactName, text, messageId: result.lastInsertRowid });
  return { id: result.lastInsertRowid, phone, clientId: client?.id || null };
};

const STATUS_BY_EVENT = {
  'whatsapp.message.sent': 'sent',
  'whatsapp.message.delivered': 'delivered',
  'whatsapp.message.read': 'read',
  'whatsapp.message.failed': 'failed',
};
const STATUS_RANK = { queued: 0, accepted: 0, sent: 1, delivered: 2, read: 3, failed: 9 };

/** Procesa whatsapp.message.sent/delivered/read/failed */
export const handleStatusEvent = async (eventName, payload) => {
  const status = STATUS_BY_EVENT[eventName];
  const message = payload?.message;
  if (!status || !message?.id) return { skipped: true };

  const statuses = message.kapso?.statuses || [];
  const last = statuses[statuses.length - 1] || {};
  const errors = last.errors || message.kapso?.errors || [];
  const errorMessage = status === 'failed'
    ? (errors[0]?.error_data?.details || errors[0]?.message || errors[0]?.title || 'Entrega fallida')
    : null;

  const row = await db.get(`SELECT id, status FROM whatsapp_messages WHERE wa_message_id = ?`, [message.id]);
  if (!row) {
    // Mensaje enviado desde otro lado (ej. inbox de Kapso): lo registramos como saliente
    const { organizationId: orgId } = getKapsoConfig();
    const phone = normalizeWaNumber(payload?.conversation?.phone_number || message.to || '');
    if (!phone) return { skipped: 'sin teléfono' };
    const client = await matchClientByPhone(phone, orgId);
    const r = await db.run(`
      INSERT INTO whatsapp_messages
        (organization_id, client_id, wa_message_id, conversation_id, direction, phone, contact_name, message_type, body, status, error_message, payload)
      VALUES (?, ?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?)
    `, [
      orgId, client?.id || null, message.id, payload?.conversation?.id || null, phone, client?.display_name || null,
      message.type || 'text', extractMessageText(message), status, errorMessage, JSON.stringify(message),
    ]);
    return { id: r.lastInsertRowid, created: true };
  }

  // No retroceder estados (read → delivered) salvo que sea failed
  if ((STATUS_RANK[status] ?? 0) < (STATUS_RANK[row.status] ?? 0) && status !== 'failed') return { id: row.id, unchanged: true };

  await db.run(`
    UPDATE whatsapp_messages
    SET status = ?, error_message = COALESCE(?, error_message), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, errorMessage, row.id]);
  return { id: row.id, status };
};

// ---------------------------------------------------------------------------
// Consultas para la UI
// ---------------------------------------------------------------------------

export const listConversations = async (orgId, { search = '', limit = 100 } = {}) => {
  const rows = await db.all(`
    WITH last_msg AS (
      SELECT DISTINCT ON (m.phone) m.*
      FROM whatsapp_messages m
      WHERE m.organization_id = ?
      ORDER BY m.phone, m.created_at DESC
    ),
    unread AS (
      SELECT phone, COUNT(*)::int as unread_count
      FROM whatsapp_messages
      WHERE organization_id = ? AND direction = 'inbound' AND read_by_team_at IS NULL
      GROUP BY phone
    ),
    names AS (
      SELECT phone, MAX(contact_name) as contact_name, MAX(client_id) as client_id
      FROM whatsapp_messages WHERE organization_id = ? GROUP BY phone
    )
    SELECT lm.phone, lm.body as last_body, lm.message_type as last_type, lm.direction as last_direction,
           lm.status as last_status, lm.created_at as last_at,
           COALESCE(u.unread_count, 0) as unread_count,
           COALESCE(c.id, n.client_id) as client_id,
           COALESCE(${CLIENT_NAME_SQL}, n.contact_name) as display_name,
           n.contact_name
    FROM last_msg lm
    LEFT JOIN unread u ON u.phone = lm.phone
    LEFT JOIN names n ON n.phone = lm.phone
    LEFT JOIN clients c ON c.id = n.client_id
    ORDER BY lm.created_at DESC
    LIMIT ?
  `, [orgId, orgId, orgId, limit]);

  const q = String(search || '').trim().toLowerCase();
  if (!q) return rows;
  const qDigits = q.replace(/\D/g, '');
  return rows.filter((r) =>
    (r.display_name || '').toLowerCase().includes(q)
    || (r.contact_name || '').toLowerCase().includes(q)
    || (qDigits && r.phone.includes(qDigits)));
};

export const listMessages = async (orgId, phone, { limit = 200 } = {}) => {
  const normalized = normalizeWaNumber(phone);
  const rows = await db.all(`
    SELECT m.id, m.wa_message_id, m.direction, m.phone, m.contact_name, m.message_type, m.body, m.template_name,
           m.media_url, m.status, m.error_message, m.context, m.client_id, m.created_at, m.updated_at,
           tm.name as sent_by_name
    FROM whatsapp_messages m
    LEFT JOIN team_members tm ON tm.id = m.sent_by
    WHERE m.organization_id = ? AND m.phone = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `, [orgId, normalized, limit]);
  return rows.reverse().map((r) => ({ ...r, context: safeJson(r.context) }));
};

export const markConversationRead = async (orgId, phone) => {
  const normalized = normalizeWaNumber(phone);
  const r = await db.run(`
    UPDATE whatsapp_messages SET read_by_team_at = CURRENT_TIMESTAMP
    WHERE organization_id = ? AND phone = ? AND direction = 'inbound' AND read_by_team_at IS NULL
  `, [orgId, normalized]);
  return r.changes ?? 0;
};

export const unreadCount = async (orgId) => {
  const row = await db.get(`
    SELECT COUNT(*)::int as unread FROM whatsapp_messages
    WHERE organization_id = ? AND direction = 'inbound' AND read_by_team_at IS NULL
  `, [orgId]);
  return row?.unread || 0;
};

export const linkConversationToClient = async (orgId, phone, clientId) => {
  const normalized = normalizeWaNumber(phone);
  await db.run(`UPDATE whatsapp_messages SET client_id = ? WHERE organization_id = ? AND phone = ?`, [clientId, orgId, normalized]);
};

const safeJson = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};

export default {
  matchClientByPhone,
  recordOutbound,
  sendTextAndRecord,
  sendTemplateAndRecord,
  rememberWebhookEvent,
  handleInboundMessage,
  handleStatusEvent,
  listConversations,
  listMessages,
  markConversationRead,
  unreadCount,
  linkConversationToClient,
};
