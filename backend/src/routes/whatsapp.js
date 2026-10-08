/**
 * WhatsApp (Kapso) — rutas del equipo: estado del número, bandeja de conversaciones,
 * envío de mensajes de texto y plantillas.
 */
import express from 'express';
import db from '../config/database.js';
import {
  getKapsoConfig,
  isKapsoConfigured,
  getPhoneNumberInfo,
  listTemplates,
  normalizeWaNumber,
  formatWaNumber,
} from '../utils/kapsoClient.js';
import {
  listConversations,
  listMessages,
  markConversationRead,
  unreadCount,
  sendTextAndRecord,
  sendTemplateAndRecord,
  linkConversationToClient,
  matchClientByPhone,
} from '../services/whatsappService.js';

const router = express.Router();

const CLIENT_NAME_SQL = `CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END`;

/** Solo la organización dueña del número puede operar WhatsApp */
const requireOwnerOrg = (req, res, next) => {
  const { organizationId } = getKapsoConfig();
  if (Number(req.orgId) !== Number(organizationId)) {
    return res.status(403).json({ error: 'WhatsApp no está habilitado para esta organización' });
  }
  next();
};

router.use(requireOwnerOrg);

// Estado de la integración + número conectado
router.get('/status', async (req, res) => {
  const configured = isKapsoConfigured();
  const base = {
    configured,
    webhook_configured: Boolean(getKapsoConfig().webhookSecret),
    phone_number_id: getKapsoConfig().phoneNumberId || null,
    unread: configured ? await unreadCount(req.orgId).catch(() => 0) : 0,
  };
  if (!configured) return res.json({ ...base, number: null });
  try {
    const info = await getPhoneNumberInfo();
    res.json({
      ...base,
      number: {
        display_phone_number: info?.display_phone_number || null,
        display_name: info?.display_name || info?.verified_name || null,
        status: info?.status || null,
        quality_rating: info?.quality_rating || null,
        messaging_limit: info?.whatsapp_business_manager_messaging_limit || null,
        business_account_id: info?.business_account_id || null,
      },
    });
  } catch (error) {
    res.json({ ...base, number: null, error: error.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    res.json({ unread: await unreadCount(req.orgId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bandeja: una fila por teléfono con el último mensaje
router.get('/conversations', async (req, res) => {
  try {
    const rows = await listConversations(req.orgId, { search: req.query.q || '', limit: Number(req.query.limit) || 100 });
    res.json(rows.map((r) => ({ ...r, phone_formatted: formatWaNumber(r.phone) })));
  } catch (error) {
    console.error('[whatsapp] conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:phone/messages', async (req, res) => {
  try {
    const phone = normalizeWaNumber(req.params.phone);
    const messages = await listMessages(req.orgId, phone, { limit: Number(req.query.limit) || 200 });
    const client = await matchClientByPhone(phone, req.orgId);
    res.json({ phone, phone_formatted: formatWaNumber(phone), client, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:phone/read', async (req, res) => {
  try {
    const changed = await markConversationRead(req.orgId, req.params.phone);
    res.json({ marked: changed, unread: await unreadCount(req.orgId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:phone/link-client', async (req, res) => {
  try {
    const { client_id } = req.body || {};
    if (!client_id) return res.status(400).json({ error: 'client_id es requerido' });
    const client = await db.get(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`, [client_id, req.orgId]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    await linkConversationToClient(req.orgId, req.params.phone, client_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar texto libre (requiere ventana de 24 h abierta; si no, Meta lo rechaza y aquí devolvemos el error)
router.post('/send', async (req, res) => {
  try {
    if (!isKapsoConfigured()) return res.status(503).json({ error: 'WhatsApp no está configurado (KAPSO_API_KEY / KAPSO_PHONE_NUMBER_ID)' });
    const { to, body, client_id, context } = req.body || {};
    if (!to || !body) return res.status(400).json({ error: 'to y body son requeridos' });
    const result = await sendTextAndRecord({
      orgId: req.orgId, to, body, clientId: client_id || null, context: context || null, sentBy: req.teamMember?.id || null,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[whatsapp] send:', error.message);
    res.status(error.status && error.status < 500 ? 400 : 500).json({ error: error.message, meta_code: error.metaCode || null });
  }
});

// Enviar plantilla aprobada (sirve fuera de la ventana de 24 h)
router.post('/send-template', async (req, res) => {
  try {
    if (!isKapsoConfigured()) return res.status(503).json({ error: 'WhatsApp no está configurado' });
    const { to, name, language = 'es', components = [], rendered_text, client_id, context } = req.body || {};
    if (!to || !name) return res.status(400).json({ error: 'to y name son requeridos' });
    const result = await sendTemplateAndRecord({
      orgId: req.orgId, to, name, language, components, renderedText: rendered_text || '',
      clientId: client_id || null, context: context || null, sentBy: req.teamMember?.id || null,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[whatsapp] send-template:', error.message);
    res.status(error.status && error.status < 500 ? 400 : 500).json({ error: error.message, meta_code: error.metaCode || null });
  }
});

// Plantillas del WABA (nombre, idioma, categoría, estado, cuerpo)
router.get('/templates', async (req, res) => {
  try {
    if (!isKapsoConfigured()) return res.json([]);
    const templates = await listTemplates({ force: req.query.refresh === '1' });
    res.json(templates.map((t) => ({
      id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      parameter_format: t.parameter_format,
      body: t.components?.find((c) => c.type === 'BODY')?.text || '',
      components: t.components || [],
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Directorio: clientes y creadores con teléfono (para iniciar conversaciones)
router.get('/contacts', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const clients = await db.all(`
      SELECT c.id, ${CLIENT_NAME_SQL} as name, c.phone, 'client' as kind
      FROM clients c
      WHERE c.organization_id = ? AND c.phone IS NOT NULL AND c.phone != ''
      ORDER BY name ASC
    `, [req.orgId]);
    let creators = [];
    try {
      creators = await db.all(`
        SELECT id, full_name as name, phone, 'creator' as kind
        FROM ugc_creators
        WHERE organization_id = ? AND phone IS NOT NULL AND phone != ''
        ORDER BY full_name ASC
      `, [req.orgId]);
    } catch { creators = []; }
    const all = [...clients, ...creators]
      .map((c) => ({ ...c, wa: normalizeWaNumber(c.phone), phone_formatted: formatWaNumber(normalizeWaNumber(c.phone)) }))
      .filter((c) => c.wa.length >= 8);
    const filtered = q
      ? all.filter((c) => c.name.toLowerCase().includes(q) || c.wa.includes(q.replace(/\D/g, '') || '§'))
      : all;
    res.json(filtered.slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
