/**
 * Resúmenes y alertas de Orbit por WhatsApp (Kapso).
 *
 *  - morning (06:00): rendimiento completo de AYER por marca (Growth vs. demás marcas)
 *  - tasks   (06:00): tareas de hoy y de la semana por persona
 *  - noon    (12:00): ventas de HOY hasta el momento por marca (Growth vs. demás)
 *  - alerts  (cada hora 10:00–21:00): marcas que van muy mal (revisar) o muy bien (escalar)
 *
 * Entrega: si el destinatario escribió en las últimas 24 h se envía el texto directo;
 * si no, Meta no permite texto libre → se envía la plantilla `resumen_orbit_listo` (botón
 * "Ver resumen") y el reporte queda pendiente; cuando el usuario toca el botón, el webhook
 * entrega todo lo pendiente (ver deliverPendingBriefings).
 *
 * Env:
 *   WHATSAPP_BRIEFING_RECIPIENTS   teléfonos destino separados por coma (default 573043148428)
 *   WHATSAPP_BRIEFING_NAMES        nombres para saludar, mismo orden (default "Juanfe")
 *   KAPSO_TEMPLATE_BRIEFING        plantilla con botón (default resumen_orbit_listo)
 *   WHATSAPP_ALERT_MIN_SPEND       pauta mínima del día para evaluar alertas (default 50000)
 */
import db from '../config/database.js';
import { pickDailyDisplayRevenue, dailyAdSpend } from '../utils/revenueMetric.js';
import { getKapsoConfig, isKapsoConfigured, normalizeWaNumber, getApprovedTemplate } from '../utils/kapsoClient.js';
import { sendTextAndRecord, sendTemplateAndRecord } from './whatsappService.js';

const TZ = 'America/Bogota';
const MAX_CHARS = 3800; // límite WhatsApp 4096; dejamos margen

// ---------------------------------------------------------------------------
// Fechas / formato
// ---------------------------------------------------------------------------
export const colombiaDate = (offsetDays = 0) => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  now.setDate(now.getDate() + offsetDays);
  return now.toLocaleDateString('en-CA');
};
export const colombiaHour = () => Number(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }));
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const toDate = (iso) => new Date(`${iso}T12:00:00`);
export const fmtDia = (iso) => { const d = toDate(iso); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };
const fmtDiaCorto = (iso) => { const d = toDate(iso); return `${DIAS_CORTO[d.getDay()]} ${d.getDate()}`; };
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const weekBounds = (iso) => { const d = toDate(iso); const dow = (d.getDay() + 6) % 7; return { start: addDays(iso, -dow), end: addDays(iso, 6 - dow) }; };

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const num = (n) => Math.round(Number(n) || 0).toLocaleString('es-CO');
const roasStr = (rev, spend) => (spend > 0 ? `${(rev / spend).toFixed(1).replace('.', ',')}x` : '—');
const pctDelta = (cur, prev) => {
  if (!prev) return cur ? 'nuevo' : '—';
  const p = ((cur - prev) / prev) * 100;
  const s = `${p >= 0 ? '+' : ''}${Math.round(p)}%`;
  return p >= 0 ? `▲ ${s}` : `▼ ${s}`;
};
const brandName = (c) => c.nickname || c.company || c.name;

// ---------------------------------------------------------------------------
// Datos: métricas por marca
// ---------------------------------------------------------------------------
const brandRow = (r) => {
  const revenue = pickDailyDisplayRevenue(r.portal_revenue_metric, r);
  const spend = dailyAdSpend(r);
  const orders = Number(r.shopify_orders) || 0;
  return {
    id: r.id, name: brandName(r), growth: r.service_type === 'growth',
    revenue, spend, orders,
    fb: Number(r.fb_spend) || 0, ga: Number(r.ga_spend) || 0, tt: Number(r.tt_spend) || 0,
    aov: orders ? revenue / orders : 0,
    cpo: orders && spend ? spend / orders : 0,
    has_shopify: r.shopify_revenue !== null && r.shopify_revenue !== undefined,
  };
};

export const loadBrandMetrics = async (orgId, date) => {
  const rows = await db.all(`
    SELECT c.id, c.nickname, c.company, c.name, c.service_type, ps.portal_revenue_metric,
           m.shopify_revenue, m.shopify_net_revenue, m.shopify_all_orders_revenue, m.shopify_orders,
           m.fb_spend, m.ga_spend, m.tt_spend
    FROM clients c
    JOIN client_daily_metrics m ON m.client_id = c.id AND m.metric_date = ?
    LEFT JOIN client_portal_settings ps ON ps.client_id = c.id
    WHERE c.organization_id = ? AND c.status = 'active' AND COALESCE(c.is_hidden_from_metrics, 0) = 0
  `, [date, orgId]);
  return rows.map(brandRow).filter((b) => b.revenue > 0 || b.spend > 0 || b.orders > 0);
};

/** Promedios de los últimos N días (excluyendo `date`) por marca: ventas/día y ROAS blended */
const loadBaselines = async (orgId, date, days = 14) => {
  const rows = await db.all(`
    SELECT c.id, ps.portal_revenue_metric, m.metric_date, m.shopify_revenue, m.shopify_net_revenue, m.shopify_all_orders_revenue,
           m.shopify_orders, m.fb_spend, m.ga_spend, m.tt_spend
    FROM clients c
    JOIN client_daily_metrics m ON m.client_id = c.id AND m.metric_date >= ? AND m.metric_date < ?
    LEFT JOIN client_portal_settings ps ON ps.client_id = c.id
    WHERE c.organization_id = ? AND c.status = 'active' AND COALESCE(c.is_hidden_from_metrics, 0) = 0
  `, [addDays(date, -days), date, orgId]);
  const acc = {};
  for (const r of rows) {
    const b = brandRow(r);
    const a = acc[b.id] || (acc[b.id] = { revenue: 0, spend: 0, orders: 0, days: 0 });
    a.revenue += b.revenue; a.spend += b.spend; a.orders += b.orders; a.days += 1;
  }
  for (const a of Object.values(acc)) {
    a.avgRevenue = a.days ? a.revenue / a.days : 0;
    a.avgSpend = a.days ? a.spend / a.days : 0;
    a.roas = a.spend ? a.revenue / a.spend : 0;
  }
  return acc;
};

const sumGroup = (list) => list.reduce((t, b) => ({ revenue: t.revenue + b.revenue, spend: t.spend + b.spend, orders: t.orders + b.orders }), { revenue: 0, spend: 0, orders: 0 });

const brandBlockFull = (b, prev) => {
  const lines = [`• *${b.name}*`];
  lines.push(`Venta neta: ${money(b.revenue)}${prev ? ` (${pctDelta(b.revenue, prev.revenue)} vs día anterior)` : ''}`);
  lines.push(`Cantidad de pedidos: ${b.orders} ped.${b.orders ? ` · ticket ${money(b.aov)}` : ''}`);
  const mix = [b.fb ? `Meta ${money(b.fb)}` : null, b.ga ? `Google ${money(b.ga)}` : null, b.tt ? `TikTok ${money(b.tt)}` : null].filter(Boolean);
  lines.push(`Inversión en pauta: ${money(b.spend)}${mix.length > 1 ? ` (${mix.join(' · ')})` : ''}`);
  lines.push(`ROAS: ${roasStr(b.revenue, b.spend)}${b.cpo ? ` · costo por pedido ${money(b.cpo)}` : ''}`);
  return lines.join('\n');
};

const brandBlockShort = (b) => [
  `• *${b.name}*`,
  `Venta neta: ${money(b.revenue)}`,
  `Cantidad de pedidos: ${b.orders} ped.`,
  `Inversión en pauta: ${money(b.spend)}`,
  `ROAS: ${roasStr(b.revenue, b.spend)}`,
].join('\n');

const totalBlock = (label, t) => [
  `*${label}*`,
  `Venta neta: ${money(t.revenue)}`,
  `Cantidad de pedidos: ${t.orders} ped.`,
  `Inversión en pauta: ${money(t.spend)}`,
  `ROAS: ${roasStr(t.revenue, t.spend)}`,
].join('\n');

const groupSection = (title, brands, { full = false, prevMap = {} } = {}) => {
  if (!brands.length) return [`${title}`, '_Sin datos sincronizados._'];
  const sorted = [...brands].sort((a, b) => b.revenue - a.revenue);
  const out = [title, ''];
  for (const b of sorted) {
    out.push(full ? brandBlockFull(b, prevMap[b.id]) : brandBlockShort(b));
    out.push('');
  }
  if (sorted.length > 1) out.push(totalBlock(`Total ${title.replace(/[*_]/g, '').replace(/^[^\p{L}]+/u, '').toLowerCase()}`, sumGroup(sorted)));
  return out;
};

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

/** 1) Reporte completo del día anterior por marca */
export const buildMorningReport = async (orgId, { date = colombiaDate(-1), name = '' } = {}) => {
  const [brands, prevBrands] = await Promise.all([loadBrandMetrics(orgId, date), loadBrandMetrics(orgId, addDays(date, -1))]);
  const prevMap = Object.fromEntries(prevBrands.map((b) => [b.id, b]));
  const growth = brands.filter((b) => b.growth);
  const others = brands.filter((b) => !b.growth);
  const all = sumGroup(brands);
  const lines = [
    `☀️ *Buenos días${name ? `, ${name}` : ''}* — ${fmtDia(colombiaDate(0))}`,
    `📊 *Rendimiento ${date === colombiaDate(-1) ? 'de ayer' : 'del'} ${fmtDia(date)}*`,
    '',
    ...groupSection('🚀 *Marcas Growth*', growth, { full: true, prevMap }),
    '',
    ...groupSection('🏷️ *Otras marcas*', others, { full: true, prevMap }),
    '',
    `*Total general* — ${money(all.revenue)} · ${all.orders} ped. · pauta ${money(all.spend)} · ROAS ${roasStr(all.revenue, all.spend)}`,
  ];
  return lines.join('\n');
};

/** 3) Ventas de hoy hasta el momento */
export const buildNoonReport = async (orgId, { date = colombiaDate(0) } = {}) => {
  const brands = await loadBrandMetrics(orgId, date);
  const growth = brands.filter((b) => b.growth);
  const others = brands.filter((b) => !b.growth);
  const all = sumGroup(brands);
  const hora = new Date().toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const lines = [
    `🕛 *Ventas de hoy (${fmtDia(date)}) · corte ${hora}*`,
    '',
    ...groupSection('🚀 *Marcas Growth*', growth),
    '',
    ...groupSection('🏷️ *Otras marcas*', others),
    '',
    `*Total general* — ${money(all.revenue)} · ${all.orders} ped. · pauta ${money(all.spend)} · ROAS ${roasStr(all.revenue, all.spend)}`,
    '_Datos de Shopify y pauta sincronizados cada 5 min._',
  ];
  return lines.join('\n');
};

/** 2) Tareas de hoy y de la semana por persona */
export const buildTasksReport = async (orgId, { date = colombiaDate(0) } = {}) => {
  const { start, end } = weekBounds(date);
  const rows = await db.all(`
    SELECT t.id, t.title, t.due_date, t.priority,
           COALESCE(NULLIF(c.nickname, ''), NULLIF(c.company, ''), c.name) AS client_name, p.name AS project_name,
           COALESCE(
             (SELECT string_agg(tm2.name, '|') FROM task_assignees ta JOIN team_members tm2 ON tm2.id = ta.team_member_id WHERE ta.task_id = t.id),
             tm.name
           ) AS assignees
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN team_members tm ON tm.id = t.assigned_to
    WHERE t.organization_id = ?
      AND t.status NOT IN ('done', 'completed', 'cancelled')
      AND t.due_date IS NOT NULL AND t.due_date != ''
      AND t.due_date <= ?
    ORDER BY t.due_date ASC, t.priority DESC, t.id ASC
  `, [orgId, end]);

  const people = {};
  for (const t of rows) {
    const names = String(t.assignees || 'Sin asignar').split('|').map((s) => s.trim()).filter(Boolean);
    const due = String(t.due_date).slice(0, 10);
    for (const n of names) {
      const p = people[n] || (people[n] = { today: [], week: [], overdue: 0 });
      if (due === date) p.today.push(t);
      else if (due < date) p.overdue += 1;
      else if (due <= end) p.week.push(t);
    }
  }
  const firsts = {};
  Object.keys(people).forEach((n) => { const f = n.split(' ')[0]; firsts[f] = (firsts[f] || 0) + 1; });
  const short = (n) => { const p = n.split(' '); return (firsts[p[0]] === 1 && n !== 'Sin asignar') ? p[0] : p.slice(0, 2).join(' '); };
  const label = (t) => { const cl = t.client_name || t.project_name; return `${t.title.slice(0, 60)}${cl ? ` _[${cl.slice(0, 22)}]_` : ''}`; };

  const lines = [`✅ *Tareas del equipo — ${fmtDia(date)}*`, `_Semana ${fmtDiaCorto(start)} al ${fmtDiaCorto(end)}_`, ''];
  const order = Object.keys(people).sort((a, b) => (people[b].today.length - people[a].today.length) || (people[b].week.length - people[a].week.length) || a.localeCompare(b));
  let any = false;
  for (const n of order) {
    const p = people[n];
    if (!p.today.length && !p.week.length && !p.overdue) continue;
    any = true;
    lines.push(`*${short(n)}* · hoy ${p.today.length} · semana ${p.week.length}${p.overdue ? ` · ⚠️ ${p.overdue} vencidas` : ''}`);
    if (p.today.length) {
      lines.push('Hoy:');
      p.today.slice(0, 6).forEach((t) => lines.push(`  – ${label(t)}`));
      if (p.today.length > 6) lines.push(`  – … y ${p.today.length - 6} más`);
    }
    if (p.week.length) {
      lines.push('Resto de la semana:');
      p.week.slice(0, 5).forEach((t) => lines.push(`  – ${fmtDiaCorto(String(t.due_date).slice(0, 10))}: ${label(t)}`));
      if (p.week.length > 5) lines.push(`  – … y ${p.week.length - 5} más`);
    }
    lines.push('');
  }
  if (!any) lines.push('Nadie tiene tareas con fecha esta semana.');
  return lines.join('\n').trimEnd();
};

/** 4) Alertas del día: marcas muy mal (revisar) o muy bien (escalar) */
export const computeAlerts = async (orgId, { date = colombiaDate(0), hour = colombiaHour() } = {}) => {
  const minSpend = Number(process.env.WHATSAPP_ALERT_MIN_SPEND || 50000);
  const [brands, base] = await Promise.all([loadBrandMetrics(orgId, date), loadBaselines(orgId, date, 14)]);
  // Fracción del día transcurrida (las ventas se comparan contra el promedio diario prorrateado)
  const dayFrac = Math.min(1, Math.max(0.2, (hour - 6) / 16));
  const alerts = [];
  for (const b of brands) {
    const bl = base[b.id];
    if (!bl || bl.days < 5) continue;
    const roas = b.spend ? b.revenue / b.spend : 0;
    const expectedRevenue = bl.avgRevenue * dayFrac;
    const enoughSpend = b.spend >= minSpend;
    // MAL: pauta corriendo y ROAS muy por debajo del normal, o sin ventas pasado el mediodía
    if (enoughSpend && bl.roas > 0 && ((roas < bl.roas * 0.5) || (b.revenue === 0 && hour >= 13))) {
      alerts.push({
        client_id: b.id, kind: 'bad', name: b.name,
        text: `🔴 *${b.name}* va mal hoy: ROAS ${roasStr(b.revenue, b.spend)} vs ${roasStr(bl.revenue, bl.spend)} habitual · ventas ${money(b.revenue)} (esperado a esta hora ~${money(expectedRevenue)}) · pauta ${money(b.spend)}. 👉 Revisar campañas.`,
      });
      continue;
    }
    // BIEN: ROAS muy por encima del normal y ventas claramente arriba del ritmo habitual
    if (enoughSpend && bl.roas > 0 && roas >= bl.roas * 1.6 && b.revenue >= expectedRevenue * 1.3 && b.orders >= 3) {
      alerts.push({
        client_id: b.id, kind: 'good', name: b.name,
        text: `🟢 *${b.name}* va muy bien hoy: ROAS ${roasStr(b.revenue, b.spend)} vs ${roasStr(bl.revenue, bl.spend)} habitual · ventas ${money(b.revenue)} (ritmo normal ~${money(expectedRevenue)}) · ${b.orders} pedidos. 👉 Revisar para escalar presupuesto.`,
      });
    }
  }
  return alerts;
};

export const buildAlertsReport = async (orgId, opts = {}) => {
  const alerts = await computeAlerts(orgId, opts);
  if (!alerts.length) return null;
  return [`🚨 *Alertas de hoy (${fmtDia(opts.date || colombiaDate(0))})*`, '', ...alerts.map((a) => a.text), '', '_Comparado con el promedio de los últimos 14 días, prorrateado a la hora actual._'].join('\n');
};

// ---------------------------------------------------------------------------
// Entrega
// ---------------------------------------------------------------------------
const recipients = () => {
  const phones = (process.env.WHATSAPP_BRIEFING_RECIPIENTS || '573043148428').split(',').map((p) => normalizeWaNumber(p.trim())).filter(Boolean);
  const names = (process.env.WHATSAPP_BRIEFING_NAMES || 'Juanfe').split(',').map((n) => n.trim());
  return phones.map((phone, i) => ({ phone, name: names[i] || names[0] || '' }));
};

/** Divide un texto largo en trozos ≤ MAX_CHARS cortando en líneas en blanco */
export const chunkText = (text, max = MAX_CHARS) => {
  if (text.length <= max) return [text];
  const parts = [];
  let cur = '';
  for (const para of text.split('\n\n')) {
    const candidate = cur ? `${cur}\n\n${para}` : para;
    if (candidate.length > max && cur) { parts.push(cur); cur = para; } else cur = candidate;
    while (cur.length > max) { parts.push(cur.slice(0, max)); cur = cur.slice(max); }
  }
  if (cur) parts.push(cur);
  return parts.map((p, i) => (parts.length > 1 ? `${p}\n\n_(${i + 1}/${parts.length})_` : p));
};

const windowOpenFor = async (orgId, phone) => {
  const row = await db.get(`
    SELECT MAX(created_at) AS last_in FROM whatsapp_messages
    WHERE organization_id = ? AND phone = ? AND direction = 'inbound'
  `, [orgId, phone]);
  return row?.last_in ? (Date.now() - new Date(row.last_in).getTime()) < 23.5 * 60 * 60 * 1000 : false;
};

const KIND_LABEL = { morning: 'resumen de la mañana', tasks: 'resumen de tareas', noon: 'reporte de ventas del mediodía', alerts: 'reporte de alertas', test: 'resumen de prueba' };

/**
 * Envía `text` al teléfono: directo si hay ventana de 24 h; si no, plantilla con botón y queda pendiente.
 * force=true salta la verificación de ventana (p. ej. pruebas manuales).
 */
export const deliverBriefing = async ({ orgId, phone, name, kind, text, force = false }) => {
  const to = normalizeWaNumber(phone);
  const chunks = chunkText(text);
  const open = force || await windowOpenFor(orgId, to);
  if (open) {
    const ids = [];
    for (const body of chunks) {
      const r = await sendTextAndRecord({ orgId, to, body, context: { source: 'briefing', kind } });
      ids.push(r.wamid);
    }
    return { delivered: true, parts: chunks.length, wamids: ids };
  }
  // Sin ventana: guardar pendiente y avisar con plantilla (si está aprobada)
  await db.run(`INSERT INTO whatsapp_pending_briefings (organization_id, phone, kind, body) VALUES (?, ?, ?, ?)`, [orgId, to, kind, text]);
  const tplName = process.env.KAPSO_TEMPLATE_BRIEFING || 'resumen_orbit_listo';
  const tpl = await getApprovedTemplate(tplName, 'es');
  if (!tpl) return { delivered: false, pending: true, reason: `plantilla ${tplName} no aprobada aún` };
  const already = await db.get(`
    SELECT id FROM whatsapp_messages WHERE organization_id = ? AND phone = ? AND template_name = ? AND created_at > NOW() - INTERVAL '3 hours'
  `, [orgId, to, tpl.name]);
  if (already) return { delivered: false, pending: true, reason: 'aviso ya enviado hace < 3 h' };
  await sendTemplateAndRecord({
    orgId, to, name: tpl.name, language: tpl.language || 'es',
    components: [{ type: 'body', parameters: [{ type: 'text', text: name || 'equipo' }, { type: 'text', text: KIND_LABEL[kind] || 'resumen' }] }],
    renderedText: `Hola, ${name || 'equipo'} 👋 Tu ${KIND_LABEL[kind] || 'resumen'} de Orbit ya está listo. Toca el botón y te lo envío completo por aquí.`,
    context: { source: 'briefing', kind, pending: true },
  });
  return { delivered: false, pending: true, notified: true };
};

/** Entrega todo lo pendiente de un teléfono (lo llama el webhook cuando el usuario responde) */
export const deliverPendingBriefings = async (orgId, phone) => {
  const to = normalizeWaNumber(phone);
  const rows = await db.all(`
    SELECT id, kind, body FROM whatsapp_pending_briefings
    WHERE organization_id = ? AND phone = ? AND delivered_at IS NULL AND created_at > NOW() - INTERVAL '36 hours'
    ORDER BY created_at ASC
  `, [orgId, to]);
  let sent = 0;
  for (const r of rows) {
    try {
      for (const body of chunkText(r.body)) await sendTextAndRecord({ orgId, to, body, context: { source: 'briefing', kind: r.kind } });
      await db.run(`UPDATE whatsapp_pending_briefings SET delivered_at = CURRENT_TIMESTAMP WHERE id = ?`, [r.id]);
      sent += 1;
    } catch (e) {
      console.error('[briefings] pendiente', r.id, e.message);
    }
  }
  // Expirar lo viejo
  await db.run(`UPDATE whatsapp_pending_briefings SET delivered_at = CURRENT_TIMESTAMP WHERE phone = ? AND delivered_at IS NULL AND created_at <= NOW() - INTERVAL '36 hours'`, [to]).catch(() => {});
  return sent;
};

const BUILDERS = {
  morning: (orgId, r, opts) => buildMorningReport(orgId, { name: r.name, ...(opts?.date ? { date: opts.date } : {}) }),
  tasks: (orgId) => buildTasksReport(orgId),
  noon: (orgId) => buildNoonReport(orgId),
  alerts: (orgId) => buildAlertsReport(orgId),
};

/** Construye y envía un tipo de reporte a los destinatarios configurados */
export const sendBriefing = async (kind, { force = false, to = null, date = null, orgId = getKapsoConfig().organizationId } = {}) => {
  if (!isKapsoConfigured()) throw new Error('WhatsApp (Kapso) no está configurado');
  const build = BUILDERS[kind];
  if (!build) throw new Error(`Tipo de reporte desconocido: ${kind}`);
  const targets = to ? [{ phone: normalizeWaNumber(to), name: recipients()[0]?.name || '' }] : recipients();
  const results = [];
  for (const r of targets) {
    const text = await build(orgId, r, { date });
    if (!text) { results.push({ phone: r.phone, skipped: 'sin contenido' }); continue; }
    const res = await deliverBriefing({ orgId, phone: r.phone, name: r.name, kind, text, force });
    results.push({ phone: r.phone, ...res, chars: text.length });
  }
  return results;
};

// ---------------------------------------------------------------------------
// Programación (evita duplicados por reinicios con whatsapp_briefing_runs)
// ---------------------------------------------------------------------------
const claimRun = async (kind, key) => {
  try {
    await db.run(`INSERT INTO whatsapp_briefing_runs (kind, run_key) VALUES (?, ?) RETURNING kind`, [kind, key]);
    return true;
  } catch (e) {
    if (String(e.message).includes('duplicate key')) return false;
    throw e;
  }
};

export const runScheduled = async (kind) => {
  if (!isKapsoConfigured()) return;
  const orgId = getKapsoConfig().organizationId;
  const today = colombiaDate(0);
  if (kind === 'alerts') {
    const hour = colombiaHour();
    const alerts = await computeAlerts(orgId, { date: today, hour });
    const fresh = [];
    for (const a of alerts) {
      if (await claimRun(`alert:${a.kind}:${a.client_id}`, today)) fresh.push(a);
    }
    if (!fresh.length) return { kind, sent: 0 };
    const text = [`🚨 *Alertas (${fmtDia(today)} · ${hour}:00)*`, '', ...fresh.map((a) => a.text), '', '_Comparado con el promedio de los últimos 14 días, prorrateado a la hora actual._'].join('\n');
    for (const r of recipients()) await deliverBriefing({ orgId, phone: r.phone, name: r.name, kind: 'alerts', text });
    return { kind, sent: fresh.length };
  }
  if (!(await claimRun(kind, today))) return { kind, skipped: 'ya enviado hoy' };
  const results = await sendBriefing(kind, { orgId });
  console.log(`[briefings] ${kind} ${today}:`, JSON.stringify(results));
  return { kind, results };
};

export default { buildMorningReport, buildNoonReport, buildTasksReport, buildAlertsReport, computeAlerts, sendBriefing, runScheduled, deliverPendingBriefings, chunkText };
