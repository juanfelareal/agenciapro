/**
 * WhatsApp (Kapso) — rutas del equipo: estado del número, bandeja de conversaciones,
 * envío de mensajes de texto y plantillas, y configuración de los resúmenes por organización.
 *
 * Multi-organización: el módulo `whatsapp` lo valida requireModule('whatsapp') en server.js; todas
 * las consultas van filtradas por req.orgId. El número es compartido (Orbit) salvo que la org tenga
 * el add-on `dedicated_number` y su propio `kapso_phone_number_id`.
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
  addonOn,
  loadOrgRow,
  orgDisplayName,
  orgPhoneNumberId,
  orgSendOptions,
  ADDON_KEYS,
} from '../services/whatsappService.js';
import { sendBriefing, buildReport, parseKinds, RECIPIENT_KINDS, DEFAULT_KINDS } from '../services/whatsappBriefings.js';
import { requireAdmin } from '../middleware/teamAuth.js';
import * as meetings from '../services/meetingTasks.js';

const router = express.Router();

const CLIENT_NAME_SQL = `CASE WHEN c.company IS NOT NULL AND c.company != '' THEN c.company ELSE c.name END`;

/** Estado de add-ons de la org (contrato: ver addonOn en whatsappService.js) */
const addonState = (org) => Object.fromEntries(ADDON_KEYS.map((k) => [k, addonOn(org, k)]));

/** Respuesta 402 estándar cuando falta un add-on */
const ADDON_NAMES = { hourly_reports: 'Reportes cada hora', owner_reports: 'Reporte diario al dueño de cada marca', dedicated_number: 'Número de WhatsApp propio' };
const addonRequired = (res, addon) => res.status(402).json({ error: `Activa el add-on "${ADDON_NAMES[addon]}" en Suscripción`, upgrade: true, addon });

/** Errores de servicios con status/payload (400/402/404) → respuesta HTTP */
const sendError = (res, error, fallback = 500) => {
  const status = error?.status || fallback;
  if (error?.payload) return res.status(status).json(error.payload);
  return res.status(status).json({ error: error?.message || 'Error inesperado' });
};

// Estado de la integración + número conectado (propio de la org si tiene el add-on; si no, el compartido)
router.get('/status', async (req, res) => {
  const configured = isKapsoConfigured();
  const org = await loadOrgRow(req.orgId).catch(() => null);
  const ownNumber = orgPhoneNumberId(org);
  const base = {
    configured,
    webhook_configured: Boolean(getKapsoConfig().webhookSecret),
    phone_number_id: ownNumber || getKapsoConfig().phoneNumberId || null,
    number_mode: ownNumber ? 'dedicated' : 'shared',
    addons: addonState(org),
    unread: configured ? await unreadCount(req.orgId).catch(() => 0) : 0,
  };
  if (!configured) return res.json({ ...base, number: null });
  try {
    const info = await getPhoneNumberInfo({ phoneNumberId: ownNumber });
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
    const { phoneNumberId } = await orgSendOptions(req.orgId);
    const result = await sendTextAndRecord({
      orgId: req.orgId, to, body, clientId: client_id || null, context: context || null, sentBy: req.teamMember?.id || null, phoneNumberId,
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
    const { phoneNumberId } = await orgSendOptions(req.orgId);
    const result = await sendTemplateAndRecord({
      orgId: req.orgId, to, name, language, components, renderedText: rendered_text || '',
      clientId: client_id || null, context: context || null, sentBy: req.teamMember?.id || null, phoneNumberId,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[whatsapp] send-template:', error.message);
    res.status(error.status && error.status < 500 ? 400 : 500).json({ error: error.message, meta_code: error.metaCode || null });
  }
});

// ---------------------------------------------------------------------------
// Resúmenes programados por organización: destinatarios, dueños de marca, número, prueba y vista previa
// ---------------------------------------------------------------------------

/** Vista previa del texto (sin enviar). kind = morning | tasks | noon | alerts | hourly | owner (+ clientId) */
router.get('/briefings/preview', async (req, res) => {
  try {
    const kind = String(req.query.kind || 'morning');
    const text = await buildReport(req.orgId, kind, {
      name: req.teamMember?.name?.split(' ')[0] || '',
      date: req.query.date ? String(req.query.date) : null,
      clientId: req.query.clientId ? Number(req.query.clientId) : null,
      sub: req.query.sub ? String(req.query.sub) : null,
    });
    res.json({ kind, text: text || '', empty: !text });
  } catch (error) {
    sendError(res, error);
  }
});

/** Enviar ahora (admin). body: { kind, phone?, clientId?, date?, force? }. kind admite `hourly` y `owner:<clientId>`. */
router.post('/briefings/test', requireAdmin, async (req, res) => {
  try {
    const { kind = 'morning', phone, to, force = true, date, clientId, client_id, sub } = req.body || {};
    let target = phone || to || null;
    if (!target && !String(kind).startsWith('owner')) {
      // Sin teléfono: al del propio solicitante (equipo) si lo tiene registrado
      const me = await db.get(`SELECT phone FROM team_members WHERE id = ? AND organization_id = ?`, [req.teamMember.id, req.orgId]);
      target = me?.phone || null;
    }
    const results = await sendBriefing(kind, {
      orgId: req.orgId, to: target, force: Boolean(force), date: date || null,
      clientId: Number(clientId || client_id) || null, sub: sub || null,
    });
    res.json({ kind, results });
  } catch (error) {
    console.error('[whatsapp] briefings/test:', error.message);
    sendError(res, error);
  }
});

const memberRow = (m) => ({ id: m.id, name: m.name, role: m.role, phone: m.phone || null, wa: normalizeWaNumber(m.phone || '') });

/** Destinatarios del equipo + miembros con teléfono + estado de add-ons y del número */
router.get('/briefings/recipients', async (req, res) => {
  try {
    const org = await loadOrgRow(req.orgId);
    const [recipients, members] = await Promise.all([
      db.all(`SELECT id, team_member_id, client_id, phone, name, kinds, enabled, created_at FROM whatsapp_briefing_recipients WHERE organization_id = ? ORDER BY id ASC`, [req.orgId]),
      db.all(`SELECT id, name, role, phone FROM team_members WHERE organization_id = ? AND status = 'active' ORDER BY name ASC`, [req.orgId]),
    ]);
    const ownNumber = String(org?.kapso_phone_number_id || '').trim() || null;
    res.json({
      kinds: RECIPIENT_KINDS,
      default_kinds: DEFAULT_KINDS,
      recipients: recipients.map((r) => ({ ...r, phone: normalizeWaNumber(r.phone), phone_formatted: formatWaNumber(normalizeWaNumber(r.phone)), kinds: parseKinds(r.kinds), enabled: r.enabled !== false })),
      members: members.map(memberRow),
      addons: addonState(org),
      number: {
        mode: orgPhoneNumberId(org) ? 'dedicated' : 'shared',
        phone_number_id: ownNumber,
        shared_configured: Boolean(getKapsoConfig().phoneNumberId),
      },
      agency_name: orgDisplayName(org),
      plan: org?.plan || null,
      billing_cycle: org?.billing_cycle || 'monthly',
    });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * Reemplaza la lista de destinatarios de la org (admin).
 * body: { recipients: [{ team_member_id?, phone, name?, kinds?, enabled? }] }
 * `hourly` solo si el add-on está activo (402 si no).
 */
router.put('/briefings/recipients', requireAdmin, async (req, res) => {
  try {
    const list = Array.isArray(req.body?.recipients) ? req.body.recipients : null;
    if (!list) return res.status(400).json({ error: 'Formato inválido: se espera { recipients: [...] }' });
    const org = await loadOrgRow(req.orgId);
    const hourlyOk = addonOn(org, 'hourly_reports');
    const members = await db.all(`SELECT id, name, phone FROM team_members WHERE organization_id = ? AND status = 'active'`, [req.orgId]);
    const byId = Object.fromEntries(members.map((m) => [m.id, m]));
    const clean = [];
    const seen = new Set();
    for (const r of list) {
      const member = r.team_member_id ? byId[Number(r.team_member_id)] : null;
      if (r.team_member_id && !member) return res.status(400).json({ error: `Miembro ${r.team_member_id} no pertenece a esta organización` });
      const phone = normalizeWaNumber(r.phone || member?.phone || '');
      if (!phone || phone.length < 8) return res.status(400).json({ error: `Teléfono inválido para ${r.name || member?.name || 'destinatario'}` });
      if (seen.has(phone)) continue;
      seen.add(phone);
      const kinds = Array.isArray(r.kinds) ? r.kinds.map(String).filter((k) => RECIPIENT_KINDS.includes(k)) : [...DEFAULT_KINDS];
      if (kinds.includes('hourly') && !hourlyOk) return addonRequired(res, 'hourly_reports');
      clean.push({
        team_member_id: member?.id || null,
        client_id: Number(r.client_id) || null,
        phone,
        name: String(r.name || member?.name || '').slice(0, 80) || null,
        kinds,
        enabled: r.enabled !== false,
      });
    }
    // Reemplazo completo: borrar los que ya no están, upsert el resto
    if (clean.length) {
      await db.run(`DELETE FROM whatsapp_briefing_recipients WHERE organization_id = ? AND phone NOT IN (${clean.map(() => '?').join(',')})`, [req.orgId, ...clean.map((c) => c.phone)]);
    } else {
      await db.run(`DELETE FROM whatsapp_briefing_recipients WHERE organization_id = ?`, [req.orgId]);
    }
    for (const c of clean) {
      await db.run(`
        INSERT INTO whatsapp_briefing_recipients (organization_id, team_member_id, client_id, phone, name, kinds, enabled)
        VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)
        ON CONFLICT (organization_id, phone) DO UPDATE SET
          team_member_id = EXCLUDED.team_member_id, client_id = EXCLUDED.client_id, name = EXCLUDED.name,
          kinds = EXCLUDED.kinds, enabled = EXCLUDED.enabled
      `, [req.orgId, c.team_member_id, c.client_id, c.phone, c.name, JSON.stringify(c.kinds), c.enabled]);
    }
    const rows = await db.all(`SELECT id, team_member_id, client_id, phone, name, kinds, enabled FROM whatsapp_briefing_recipients WHERE organization_id = ? ORDER BY id ASC`, [req.orgId]);
    res.json({ recipients: rows.map((r) => ({ ...r, phone_formatted: formatWaNumber(r.phone), kinds: parseKinds(r.kinds), enabled: r.enabled !== false })) });
  } catch (error) {
    console.error('[whatsapp] briefings/recipients:', error.message);
    sendError(res, error);
  }
});

/** Marcas activas de la org con su configuración de reporte al dueño */
router.get('/briefings/owners', async (req, res) => {
  try {
    const org = await loadOrgRow(req.orgId);
    const rows = await db.all(`
      SELECT c.id AS client_id, COALESCE(NULLIF(c.nickname, ''), NULLIF(c.company, ''), c.name) AS brand, c.service_type, c.phone AS client_phone,
             w.phone, w.name, w.enabled, w.send_morning, w.send_noon
      FROM clients c
      LEFT JOIN client_owner_reports w ON w.client_id = c.id AND w.organization_id = c.organization_id
      WHERE c.organization_id = ? AND c.status = 'active'
      ORDER BY (c.service_type = 'growth') DESC, brand ASC
    `, [req.orgId]);
    res.json({
      addon_enabled: addonOn(org, 'owner_reports'),
      agency_name: orgDisplayName(org),
      owners: rows.map((r) => ({
        client_id: r.client_id,
        brand: r.brand,
        growth: r.service_type === 'growth',
        phone: r.phone ? normalizeWaNumber(r.phone) : '',
        suggested_phone: r.client_phone ? normalizeWaNumber(r.client_phone) : '',
        name: r.name || '',
        enabled: r.enabled === true,
        send_morning: r.send_morning !== false,
        send_noon: r.send_noon !== false,
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * Guarda la configuración de dueños (admin). body: { owners: [{ client_id, phone, name?, enabled, send_morning?, send_noon? }] }
 * Activar una marca sin el add-on → 402 { error, upgrade:true, addon:'owner_reports' }.
 */
router.put('/briefings/owners', requireAdmin, async (req, res) => {
  try {
    const list = Array.isArray(req.body?.owners) ? req.body.owners : null;
    if (!list) return res.status(400).json({ error: 'Formato inválido: se espera { owners: [...] }' });
    const org = await loadOrgRow(req.orgId);
    const ownerOk = addonOn(org, 'owner_reports');
    const clients = await db.all(`SELECT id FROM clients WHERE organization_id = ?`, [req.orgId]);
    const valid = new Set(clients.map((c) => c.id));
    const clean = [];
    for (const o of list) {
      const clientId = Number(o.client_id);
      if (!valid.has(clientId)) return res.status(400).json({ error: `La marca ${o.client_id} no pertenece a esta organización` });
      const enabled = o.enabled === true;
      if (enabled && !ownerOk) return addonRequired(res, 'owner_reports');
      const phone = normalizeWaNumber(o.phone || '');
      if (enabled && (!phone || phone.length < 8)) return res.status(400).json({ error: 'Cada marca activa necesita el teléfono del dueño' });
      clean.push({ clientId, phone, name: String(o.name || '').slice(0, 80) || null, enabled, send_morning: o.send_morning !== false, send_noon: o.send_noon !== false });
    }
    for (const c of clean) {
      if (!c.phone && !c.enabled) {
        await db.run(`DELETE FROM client_owner_reports WHERE client_id = ? AND organization_id = ?`, [c.clientId, req.orgId]);
        continue;
      }
      await db.run(`
        INSERT INTO client_owner_reports (client_id, organization_id, phone, name, enabled, send_morning, send_noon)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (client_id) DO UPDATE SET
          phone = EXCLUDED.phone, name = EXCLUDED.name, enabled = EXCLUDED.enabled,
          send_morning = EXCLUDED.send_morning, send_noon = EXCLUDED.send_noon
        RETURNING client_id
      `, [c.clientId, req.orgId, c.phone, c.name, c.enabled, c.send_morning, c.send_noon]);
    }
    res.json({ success: true, saved: clean.length });
  } catch (error) {
    console.error('[whatsapp] briefings/owners:', error.message);
    sendError(res, error);
  }
});

/**
 * Número de WhatsApp de la org (admin). body: { mode: 'shared' | 'dedicated', phone_number_id? }
 * `dedicated` requiere el add-on `dedicated_number` (402 si no) y un phone_number_id de Meta.
 */
router.put('/briefings/number', requireAdmin, async (req, res) => {
  try {
    const mode = String(req.body?.mode || 'shared');
    const org = await loadOrgRow(req.orgId);
    if (mode === 'dedicated') {
      if (!addonOn(org, 'dedicated_number')) return addonRequired(res, 'dedicated_number');
      const pnid = String(req.body?.phone_number_id || '').trim();
      if (!/^\d{6,32}$/.test(pnid)) return res.status(400).json({ error: 'phone_number_id inválido: solo dígitos (lo da Meta / Kapso)' });
      const taken = await db.get(`SELECT id FROM organizations WHERE kapso_phone_number_id = ? AND id <> ?`, [pnid, req.orgId]);
      if (taken) return res.status(409).json({ error: 'Ese número ya está asociado a otra organización' });
      await db.run(`UPDATE organizations SET kapso_phone_number_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [pnid, req.orgId]);
      return res.json({ mode: 'dedicated', phone_number_id: pnid });
    }
    await db.run(`UPDATE organizations SET kapso_phone_number_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.orgId]);
    res.json({ mode: 'shared', phone_number_id: null });
  } catch (error) {
    sendError(res, error);
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
