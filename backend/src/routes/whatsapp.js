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
import { sendBriefing, buildMorningReport, buildNoonReport, buildTasksReport, buildAlertsReport } from '../services/whatsappBriefings.js';
import * as meetings from '../services/meetingTasks.js';

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

// Resúmenes programados: vista previa y envío de prueba (solo admin)
const BRIEFING_BUILDERS = { morning: buildMorningReport, noon: buildNoonReport, tasks: buildTasksReport, alerts: buildAlertsReport };
router.get('/briefings/preview', async (req, res) => {
  try {
    const kind = String(req.query.kind || 'morning');
    const build = BRIEFING_BUILDERS[kind];
    if (!build) return res.status(400).json({ error: 'kind inválido (morning | noon | tasks | alerts)' });
    const text = await build(req.orgId, { name: req.teamMember?.name?.split(' ')[0] || '', ...(req.query.date ? { date: String(req.query.date) } : {}) });
    res.json({ kind, text: text || '', empty: !text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/briefings/test', async (req, res) => {
  try {
    if (req.teamMember?.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
    const { kind = 'morning', to, force = true, date } = req.body || {};
    const results = await sendBriefing(kind, { orgId: req.orgId, to: to || null, force: Boolean(force), date: date || null });
    res.json({ kind, results });
  } catch (error) {
    console.error('[whatsapp] briefings/test:', error.message);
    res.status(500).json({ error: error.message });
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

// ---------------------------------------------------------------------------
// Reuniones → tareas (también desde Orbit, pegando la transcripción)
// ---------------------------------------------------------------------------
router.get('/meetings', async (req, res) => {
  try { res.json({ items: await meetings.listIntakes(req.orgId, { limit: Number(req.query.limit) || 50 }), ai: meetings.hasAI(), ai_provider: meetings.aiProvider() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/meetings/:id', async (req, res) => {
  try {
    const it = await meetings.getIntake(req.params.id);
    if (!it || it.organization_id !== req.orgId) return res.status(404).json({ error: 'No encontrada' });
    res.json(it);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** Pegar transcripción desde Orbit → propuesta */
router.post('/meetings', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (text.length < 120) return res.status(400).json({ error: 'Pega la transcripción completa (mínimo 120 caracteres)' });
    const extraction = await meetings.extractTasksFromTranscript({ orgId: req.orgId, text, senderName: req.teamMember.name });
    const intake = await meetings.createIntake({ orgId: req.orgId, teamMemberId: req.teamMember.id, phone: null, source: 'orbit', title: req.body?.title || extraction.meeting_title, text, extraction });
    res.status(201).json(intake);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** Editar tareas propuestas (lista completa) */
router.put('/meetings/:id/tasks', async (req, res) => {
  try {
    const it = await meetings.getIntake(req.params.id);
    if (!it || it.organization_id !== req.orgId) return res.status(404).json({ error: 'No encontrada' });
    if (it.status !== 'proposed') return res.status(400).json({ error: `La reunión ya está ${it.status}` });
    const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : null;
    if (!tasks) return res.status(400).json({ error: 'tasks requerido' });
    const [members, clients] = await Promise.all([
      db.all("SELECT id, name FROM team_members WHERE organization_id = ? AND status = 'active'", [req.orgId]),
      db.all("SELECT id, nickname, company, name FROM clients WHERE organization_id = ?", [req.orgId]),
    ]);
    const mById = Object.fromEntries(members.map((m) => [m.id, m])); const cById = Object.fromEntries(clients.map((c) => [c.id, c]));
    const clean = tasks.map((t, i) => ({
      n: Number(t.n) || i + 1,
      title: String(t.title || '').slice(0, 120),
      detail: String(t.detail || '').slice(0, 600),
      assignee_member_id: mById[Number(t.assignee_member_id)] ? Number(t.assignee_member_id) : null,
      assignee_name: mById[Number(t.assignee_member_id)]?.name || null,
      client_id: cById[Number(t.client_id)] ? Number(t.client_id) : null,
      client_name: cById[Number(t.client_id)] ? (cById[Number(t.client_id)].nickname || cById[Number(t.client_id)].company || cById[Number(t.client_id)].name) : null,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date || '') ? t.due_date : null,
      confidence: Number(t.confidence) || 0.8,
      quote: String(t.quote || '').slice(0, 160),
      removed: Boolean(t.removed),
    })).filter((t) => t.title);
    await meetings.saveIntakeTasks(it.id, clean);
    res.json(await meetings.getIntake(it.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** Corrección en lenguaje natural */
router.post('/meetings/:id/correct', async (req, res) => {
  try {
    const it = await meetings.getIntake(req.params.id);
    if (!it || it.organization_id !== req.orgId) return res.status(404).json({ error: 'No encontrada' });
    if (it.status !== 'proposed') return res.status(400).json({ error: `La reunión ya está ${it.status}` });
    const instruction = String(req.body?.instruction || '').trim();
    if (!instruction) return res.status(400).json({ error: 'instruction requerido' });
    const { tasks, note } = await meetings.applyCorrections({ orgId: req.orgId, intake: it, instruction });
    await meetings.saveIntakeTasks(it.id, tasks);
    res.json({ ...(await meetings.getIntake(it.id)), note });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/meetings/:id/confirm', async (req, res) => {
  try {
    const it = await meetings.getIntake(req.params.id);
    if (!it || it.organization_id !== req.orgId) return res.status(404).json({ error: 'No encontrada' });
    const { created } = await meetings.confirmIntake({ orgId: req.orgId, intakeId: it.id, createdBy: req.teamMember.id });
    res.json({ created, intake: await meetings.getIntake(it.id) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/meetings/:id/cancel', async (req, res) => {
  try {
    const it = await meetings.getIntake(req.params.id);
    if (!it || it.organization_id !== req.orgId) return res.status(404).json({ error: 'No encontrada' });
    await meetings.cancelIntake(it.id);
    res.json(await meetings.getIntake(it.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
