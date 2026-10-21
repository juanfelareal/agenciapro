/**
 * Resúmenes y alertas de Orbit por WhatsApp (Kapso) — por organización.
 *
 *  - morning (06:00): rendimiento completo de AYER por marca (Growth vs. demás marcas)
 *  - tasks   (06:00): tareas de hoy y de la semana por persona
 *  - noon    (12:00): ventas de HOY hasta el momento por marca (Growth vs. demás)
 *  - alerts  (cada hora 10:05–21:05): marcas que van muy mal (revisar) o muy bien (escalar)
 *  - hourly  (cada hora 10:00–21:00, add-on `hourly_reports`): ventas/pedidos/pauta/ROAS de HOY, compacto.
 *            Si la org tiene hourly, el de las 12:00 reemplaza al `noon` para esos destinatarios.
 *  - owner   (06:00 y 12:00, add-on `owner_reports`): cada dueño de marca recibe SOLO los datos de su marca,
 *            firmado por la agencia ("Enviado por {agencia} con Orbit").
 *
 * Destinatarios: tabla `whatsapp_briefing_recipients` (una fila por teléfono y org, con los tipos que recibe).
 * Dueños de marca: tabla `client_owner_reports` (una fila por marca).
 * Número: compartido de Orbit (env KAPSO_PHONE_NUMBER_ID) o el propio de la org si tiene `dedicated_number`.
 *
 * Entrega: si el destinatario escribió en las últimas 24 h se envía el texto directo;
 * si no, Meta no permite texto libre → se envía la plantilla `resumen_orbit_listo` (botón
 * "Ver resumen") y el reporte queda pendiente; cuando el usuario toca el botón, el webhook
 * entrega todo lo pendiente (ver deliverPendingBriefings). Si Kapso no está configurado o el
 * envío falla, el reporte queda pendiente y se registra en el log (nunca rompe el cron).
 *
 * Env:
 *   KAPSO_TEMPLATE_BRIEFING        plantilla con botón (default resumen_orbit_listo)
 *   WHATSAPP_ALERT_MIN_SPEND       pauta mínima del día para evaluar alertas (default 50000)
 *   WHATSAPP_BRIEFING_RECIPIENTS   (legado) se siembra UNA vez en la tabla para KAPSO_ORGANIZATION_ID (ver database.js [briefings])
 */
import db from '../config/database.js';
import { pickDailyDisplayRevenue, dailyAdSpend, dailyWhatsappRevenue, dailyWhatsappSpend } from '../utils/revenueMetric.js';
import { isKapsoConfigured, normalizeWaNumber, getApprovedTemplate } from '../utils/kapsoClient.js';
import { sendTextAndRecord, sendTemplateAndRecord, addonOn, loadOrgRow, orgDisplayName, orgPhoneNumberId } from './whatsappService.js';
import { isModuleEnabled } from './plans.js';

const TZ = 'America/Bogota';
const MAX_CHARS = 3800; // límite WhatsApp 4096; dejamos margen

/** Tipos que puede recibir un destinatario del equipo */
export const RECIPIENT_KINDS = ['morning', 'tasks', 'noon', 'alerts', 'hourly'];
export const DEFAULT_KINDS = ['morning', 'tasks', 'noon', 'alerts'];

// ---------------------------------------------------------------------------
// Fechas / formato
// ---------------------------------------------------------------------------
export const colombiaDate = (offsetDays = 0) => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  now.setDate(now.getDate() + offsetDays);
  return now.toLocaleDateString('en-CA');
};
export const colombiaHour = () => Number(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false })) % 24;
const colombiaClock = () => new Date().toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
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
const parseJson = (v, fallback = null) => {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
export const parseKinds = (v) => {
  const arr = parseJson(v, null);
  if (!Array.isArray(arr)) return [...DEFAULT_KINDS];
  return arr.map(String).filter((k) => RECIPIENT_KINDS.includes(k));
};

// ---------------------------------------------------------------------------
// Datos: métricas por marca
// ---------------------------------------------------------------------------
const METRIC_COLS = `c.id, c.nickname, c.company, c.name, c.service_type, ps.portal_revenue_metric,
           m.shopify_revenue, m.shopify_net_revenue, m.shopify_all_orders_revenue, m.shopify_orders,
           m.fb_spend, m.ga_spend, m.tt_spend, m.whatsapp_revenue, m.whatsapp_orders, m.fb_spend_whatsapp`;

const brandRow = (r) => {
  const webRevenue = pickDailyDisplayRevenue(r.portal_revenue_metric, r);
  const waRevenue = dailyWhatsappRevenue(r);
  const revenue = webRevenue + waRevenue; // tienda + WhatsApp
  const spend = dailyAdSpend(r);
  const waSpend = Math.min(dailyWhatsappSpend(r), spend);
  const orders = (Number(r.shopify_orders) || 0) + (Number(r.whatsapp_orders) || 0);
  return {
    id: r.id, name: brandName(r), growth: r.service_type === 'growth',
    revenue, spend, orders,
    webRevenue, waRevenue, waSpend, webSpend: spend - waSpend,
    fb: Number(r.fb_spend) || 0, ga: Number(r.ga_spend) || 0, tt: Number(r.tt_spend) || 0,
    aov: orders ? revenue / orders : 0,
    cpo: orders && spend ? spend / orders : 0,
    has_shopify: r.shopify_revenue !== null && r.shopify_revenue !== undefined,
  };
};

const emptyBrand = (c) => ({ id: c.id, name: brandName(c), growth: c.service_type === 'growth', revenue: 0, spend: 0, orders: 0, webRevenue: 0, waRevenue: 0, waSpend: 0, webSpend: 0, fb: 0, ga: 0, tt: 0, aov: 0, cpo: 0, has_shopify: false, empty: true });

export const loadBrandMetrics = async (orgId, date) => {
  const rows = await db.all(`
    SELECT ${METRIC_COLS}
    FROM clients c
    JOIN client_daily_metrics m ON m.client_id = c.id AND m.metric_date = ?
    LEFT JOIN client_portal_settings ps ON ps.client_id = c.id
    WHERE c.organization_id = ? AND c.status = 'active' AND COALESCE(c.is_hidden_from_metrics, 0) = 0
  `, [date, orgId]);
  return rows.map(brandRow).filter((b) => b.revenue > 0 || b.spend > 0 || b.orders > 0);
};

/** Métricas de UNA marca para la fecha (fila en ceros si no hay datos sincronizados). Null si la marca no es de la org. */
export const loadClientMetrics = async (orgId, clientId, date) => {
  const client = await db.get(`SELECT id, nickname, company, name, service_type FROM clients WHERE id = ? AND organization_id = ?`, [clientId, orgId]);
  if (!client) return null;
  const row = await db.get(`
    SELECT ${METRIC_COLS}
    FROM clients c
    JOIN client_daily_metrics m ON m.client_id = c.id AND m.metric_date = ?
    LEFT JOIN client_portal_settings ps ON ps.client_id = c.id
    WHERE c.id = ? AND c.organization_id = ?
  `, [date, clientId, orgId]);
  return row ? brandRow(row) : emptyBrand(client);
};

/** Promedios de los últimos N días (excluyendo `date`) por marca: ventas/día, pedidos/día y ROAS blended */
const loadBaselines = async (orgId, date, days = 14) => {
  const rows = await db.all(`
    SELECT ${METRIC_COLS}, m.metric_date
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
    a.avgOrders = a.days ? a.orders / a.days : 0;
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
  if (b.waRevenue > 0 || b.waSpend > 0) {
    lines.push(`Web: ${money(b.webRevenue)} · pauta ${money(b.webSpend)} · ROAS ${roasStr(b.webRevenue, b.webSpend)}`);
    lines.push(`WhatsApp: ${money(b.waRevenue)} · pauta ${money(b.waSpend)} · ROAS ${roasStr(b.waRevenue, b.waSpend)}`);
  }
  return lines.join('\n');
};

const brandBlockShort = (b) => [
  `• *${b.name}*`,
  `Venta neta: ${money(b.revenue)}${b.waRevenue > 0 ? ` (web ${money(b.webRevenue)} + WhatsApp ${money(b.waRevenue)})` : ''}`,
  `Cantidad de pedidos: ${b.orders} ped.`,
  `Inversión en pauta: ${money(b.spend)}`,
  `ROAS: ${roasStr(b.revenue, b.spend)}${b.waSpend > 0 ? ` (web ${roasStr(b.webRevenue, b.webSpend)} · WhatsApp ${roasStr(b.waRevenue, b.waSpend)})` : ''}`,
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
// Reportes del equipo
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
  const lines = [
    `🕛 *Ventas de hoy (${fmtDia(date)}) · corte ${colombiaClock()}*`,
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

/** 5) Cada hora (add-on): ventas, pedidos, pauta y ROAS de HOY por marca, compacto (Growth primero) */
export const buildHourlyReport = async (orgId, { date = colombiaDate(0), hour = colombiaHour() } = {}) => {
  const brands = await loadBrandMetrics(orgId, date);
  const byRevenue = (a, b) => b.revenue - a.revenue;
  const growth = brands.filter((b) => b.growth).sort(byRevenue);
  const others = brands.filter((b) => !b.growth).sort(byRevenue);
  const all = sumGroup(brands);
  const hh = `${String(hour).padStart(2, '0')}:00`;
  const line = (b) => `• *${b.name}* — ${money(b.revenue)} · ${b.orders} ped. · pauta ${money(b.spend)} · ROAS ${roasStr(b.revenue, b.spend)}`;
  const head = [`⏱ *Ventas de hoy · ${hh}*`, `_${fmtDia(date)}_`, ''];
  const foot = ['', `*Total* — ${money(all.revenue)} · ${all.orders} ped. · pauta ${money(all.spend)} · ROAS ${roasStr(all.revenue, all.spend)}`];
  if (!brands.length) return [...head, '_Sin ventas ni pauta sincronizadas todavía._', ...foot].join('\n');

  const render = (g, o, hidden) => {
    const body = [];
    if (g.length) body.push('🚀 *Growth*', ...g.map(line));
    if (o.length) { if (g.length) body.push(''); body.push('🏷️ *Otras marcas*', ...o.map(line)); }
    if (hidden) body.push(`_… y ${hidden} marca${hidden === 1 ? '' : 's'} más_`);
    return [...head, ...body, ...foot].join('\n');
  };
  // Compactar: recortar "otras" (y luego Growth) desde el final hasta caber en MAX_CHARS
  let g = [...growth]; let o = [...others]; let hidden = 0;
  let text = render(g, o, hidden);
  while (text.length > MAX_CHARS && (o.length || g.length > 1)) {
    if (o.length) o.pop(); else g.pop();
    hidden += 1;
    text = render(g, o, hidden);
  }
  return text;
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
// Reporte al dueño de una marca (add-on owner_reports): SOLO sus datos
// ---------------------------------------------------------------------------

/**
 * sub = 'morning' → ayer vs. promedio de 14 días · sub = 'noon' → hoy hasta ahora.
 * Devuelve null si la marca no pertenece a la organización.
 */
export const buildOwnerReport = async (orgId, clientId, { sub = 'morning', date = null } = {}) => {
  const org = await loadOrgRow(orgId);
  const agency = orgDisplayName(org);
  if (sub === 'noon') {
    const d = date || colombiaDate(0);
    const b = await loadClientMetrics(orgId, clientId, d);
    if (!b) return null;
    return [
      `*${agency}* · *${b.name}*`,
      `🕛 Ventas de hoy (${fmtDia(d)}) · corte ${colombiaClock()}`,
      '',
      ...(b.empty ? ['_Aún no hay datos sincronizados de hoy._'] : [
        `Ventas: ${money(b.revenue)}`,
        `Pedidos: ${b.orders}${b.orders ? ` · ticket ${money(b.aov)}` : ''}`,
        `Pauta: ${money(b.spend)}`,
        `ROAS: ${roasStr(b.revenue, b.spend)}`,
      ]),
      '',
      '_Datos de tienda y pauta sincronizados cada 5 min._',
      `_Enviado por ${agency} con Orbit_`,
    ].join('\n');
  }
  const d = date || colombiaDate(-1);
  const [b, base] = await Promise.all([loadClientMetrics(orgId, clientId, d), loadBaselines(orgId, d, 14)]);
  if (!b) return null;
  const bl = base[Number(clientId)];
  const hasBase = bl && bl.days >= 3;
  return [
    `*${agency}* · *${b.name}*`,
    `☀️ Resumen ${d === colombiaDate(-1) ? 'de ayer' : 'del'} ${fmtDia(d)}`,
    '',
    ...(b.empty ? ['_Sin datos sincronizados para ese día._'] : [
      `Ventas: ${money(b.revenue)}${hasBase ? ` (${pctDelta(b.revenue, bl.avgRevenue)} vs promedio 14 días)` : ''}`,
      `Pedidos: ${b.orders}${b.orders ? ` · ticket ${money(b.aov)}` : ''}${hasBase ? ` (prom. ${num(bl.avgOrders)}/día)` : ''}`,
      `Pauta: ${money(b.spend)}${hasBase ? ` (prom. ${money(bl.avgSpend)}/día)` : ''}`,
      `ROAS: ${roasStr(b.revenue, b.spend)}${hasBase && bl.spend ? ` (prom. ${roasStr(bl.revenue, bl.spend)})` : ''}`,
    ]),
    '',
    ...(hasBase ? ['_Comparado con el promedio de los últimos 14 días._'] : []),
    `_Enviado por ${agency} con Orbit_`,
  ].join('\n');
};

// ---------------------------------------------------------------------------
// Destinatarios y dueños
// ---------------------------------------------------------------------------

/** Destinatarios activos de la org; con `kind`, solo los que reciben ese tipo */
export const getRecipients = async (orgId, kind = null) => {
  const rows = await db.all(`
    SELECT id, team_member_id, client_id, phone, name, kinds, enabled
    FROM whatsapp_briefing_recipients WHERE organization_id = ? AND enabled = TRUE ORDER BY id ASC
  `, [orgId]);
  return rows
    .map((r) => ({ ...r, phone: normalizeWaNumber(r.phone), kinds: parseKinds(r.kinds) }))
    .filter((r) => r.phone.length >= 8 && (!kind || r.kinds.includes(kind)));
};

/** Dueños de marca con reporte activo (marca activa) para la franja `sub` ('morning' | 'noon' | null = todos) */
export const getOwnerTargets = async (orgId, sub = null) => {
  const rows = await db.all(`
    SELECT w.client_id, w.phone, w.name, w.send_morning, w.send_noon,
           COALESCE(NULLIF(c.nickname, ''), NULLIF(c.company, ''), c.name) AS brand
    FROM client_owner_reports w
    JOIN clients c ON c.id = w.client_id AND c.organization_id = w.organization_id
    WHERE w.organization_id = ? AND w.enabled = TRUE AND c.status = 'active'
    ORDER BY brand ASC
  `, [orgId]);
  return rows
    .map((r) => ({ ...r, phone: normalizeWaNumber(r.phone) }))
    .filter((r) => r.phone.length >= 8 && (!sub || (sub === 'morning' ? r.send_morning !== false : r.send_noon !== false)));
};

// ---------------------------------------------------------------------------
// Entrega
// ---------------------------------------------------------------------------

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

const KIND_LABEL = { morning: 'resumen de la mañana', tasks: 'resumen de tareas', noon: 'reporte de ventas del mediodía', alerts: 'reporte de alertas', hourly: 'reporte de ventas de la hora', test: 'resumen de prueba' };
export const kindLabel = (kind) => (String(kind).startsWith('owner') ? 'reporte diario de tu marca' : (KIND_LABEL[kind] || 'resumen'));

const savePending = async ({ orgId, phone, kind, text }) =>
  db.run(`INSERT INTO whatsapp_pending_briefings (organization_id, phone, kind, body) VALUES (?, ?, ?, ?)`, [orgId, phone, kind, text]);

/**
 * Envía `text` al teléfono: directo si hay ventana de 24 h; si no, plantilla con botón y queda pendiente.
 * force=true salta la verificación de ventana (p. ej. pruebas manuales).
 * phoneNumberId: número propio de la org (add-on) o null para el compartido.
 * Nunca lanza por fallas de envío: deja el reporte pendiente y devuelve { delivered:false, pending:true, reason }.
 */
export const deliverBriefing = async ({ orgId, phone, name, kind, text, force = false, phoneNumberId = null, clientId = null }) => {
  const to = normalizeWaNumber(phone);
  const chunks = chunkText(text);
  const ctx = { source: 'briefing', kind, ...(clientId ? { client_id: clientId } : {}) };
  if (!isKapsoConfigured()) {
    await savePending({ orgId, phone: to, kind, text });
    console.warn(`[briefings] org ${orgId} → ${to} (${kind}): Kapso no configurado; quedó pendiente`);
    return { delivered: false, pending: true, reason: 'WhatsApp (Kapso) no está configurado' };
  }
  const open = force || await windowOpenFor(orgId, to);
  if (open) {
    try {
      const ids = [];
      for (const body of chunks) {
        const r = await sendTextAndRecord({ orgId, to, body, context: ctx, phoneNumberId, clientId });
        ids.push(r.wamid);
      }
      return { delivered: true, parts: chunks.length, wamids: ids };
    } catch (e) {
      await savePending({ orgId, phone: to, kind, text }).catch(() => {});
      console.error(`[briefings] org ${orgId} → ${to} (${kind}) falló el envío directo:`, e.message);
      return { delivered: false, pending: true, reason: e.message };
    }
  }
  // Sin ventana: guardar pendiente y avisar con plantilla (si está aprobada)
  await savePending({ orgId, phone: to, kind, text });
  const tplName = process.env.KAPSO_TEMPLATE_BRIEFING || 'resumen_orbit_listo';
  const tpl = await getApprovedTemplate(tplName, 'es');
  if (!tpl) return { delivered: false, pending: true, reason: `plantilla ${tplName} no aprobada aún` };
  const already = await db.get(`
    SELECT id FROM whatsapp_messages WHERE organization_id = ? AND phone = ? AND template_name = ? AND created_at > NOW() - INTERVAL '3 hours'
  `, [orgId, to, tpl.name]);
  if (already) return { delivered: false, pending: true, reason: 'aviso ya enviado hace < 3 h' };
  try {
    await sendTemplateAndRecord({
      orgId, to, name: tpl.name, language: tpl.language || 'es', phoneNumberId, clientId,
      components: [{ type: 'body', parameters: [{ type: 'text', text: name || 'equipo' }, { type: 'text', text: kindLabel(kind) }] }],
      renderedText: `Hola, ${name || 'equipo'} 👋 Tu ${kindLabel(kind)} de Orbit ya está listo. Toca el botón y te lo envío completo por aquí.`,
      context: { ...ctx, pending: true },
    });
    return { delivered: false, pending: true, notified: true };
  } catch (e) {
    console.error(`[briefings] org ${orgId} → ${to} (${kind}) falló el aviso con plantilla:`, e.message);
    return { delivered: false, pending: true, reason: e.message };
  }
};

/** Entrega todo lo pendiente de un teléfono en una org (lo llama el webhook cuando el usuario responde) */
export const deliverPendingBriefings = async (orgId, phone) => {
  const to = normalizeWaNumber(phone);
  const rows = await db.all(`
    SELECT id, kind, body FROM whatsapp_pending_briefings
    WHERE organization_id = ? AND phone = ? AND delivered_at IS NULL AND created_at > NOW() - INTERVAL '36 hours'
    ORDER BY created_at ASC
  `, [orgId, to]);
  if (!rows.length) return 0;
  const phoneNumberId = orgPhoneNumberId(await loadOrgRow(orgId));
  let sent = 0;
  for (const r of rows) {
    try {
      const clientId = String(r.kind).startsWith('owner:') ? Number(String(r.kind).split(':')[1]) || null : null;
      for (const body of chunkText(r.body)) await sendTextAndRecord({ orgId, to, body, context: { source: 'briefing', kind: r.kind }, phoneNumberId, clientId });
      await db.run(`UPDATE whatsapp_pending_briefings SET delivered_at = CURRENT_TIMESTAMP WHERE id = ?`, [r.id]);
      sent += 1;
    } catch (e) {
      console.error('[briefings] pendiente', r.id, e.message);
    }
  }
  // Expirar lo viejo
  await db.run(`UPDATE whatsapp_pending_briefings SET delivered_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND phone = ? AND delivered_at IS NULL AND created_at <= NOW() - INTERVAL '36 hours'`, [orgId, to]).catch(() => {});
  return sent;
};

// ---------------------------------------------------------------------------
// Construcción genérica (vista previa y envío manual)
// ---------------------------------------------------------------------------

/** kind = morning | tasks | noon | alerts | hourly | owner:<clientId>[:morning|noon] */
export const parseKind = (raw, { clientId = null, sub = null } = {}) => {
  const k = String(raw || 'morning').trim();
  if (k.startsWith('owner')) {
    const [, idPart, subPart] = k.split(':');
    const id = Number(clientId || idPart) || null;
    const s = (sub || subPart || (colombiaHour() >= 12 ? 'noon' : 'morning')) === 'noon' ? 'noon' : 'morning';
    return { base: 'owner', clientId: id, sub: s, key: id ? `owner:${id}:${s}` : null };
  }
  if (!RECIPIENT_KINDS.includes(k)) return null;
  return { base: k, clientId: null, sub: null, key: k };
};

/** Texto renderizado de cualquier tipo de reporte (sin enviar). Null si no hay contenido (p. ej. alertas sin novedades). */
export const buildReport = async (orgId, kind, { name = '', date = null, clientId = null, sub = null, hour = null } = {}) => {
  const k = parseKind(kind, { clientId, sub });
  if (!k) throw Object.assign(new Error('kind inválido (morning | tasks | noon | alerts | hourly | owner:<clientId>)'), { status: 400 });
  const d = date ? { date } : {};
  switch (k.base) {
    case 'morning': return buildMorningReport(orgId, { name, ...d });
    case 'tasks': return buildTasksReport(orgId, d);
    case 'noon': return buildNoonReport(orgId, d);
    case 'alerts': return buildAlertsReport(orgId, d);
    case 'hourly': return buildHourlyReport(orgId, { ...d, ...(hour != null ? { hour } : {}) });
    case 'owner': {
      if (!k.clientId) throw Object.assign(new Error('clientId es requerido para el reporte al dueño'), { status: 400 });
      const text = await buildOwnerReport(orgId, k.clientId, { sub: k.sub, date });
      if (text === null) throw Object.assign(new Error('Marca no encontrada en esta organización'), { status: 404 });
      return text;
    }
    default: return null;
  }
};

const addonError = (addon) => {
  const names = { hourly_reports: 'Reportes cada hora', owner_reports: 'Reporte diario al dueño de cada marca', dedicated_number: 'Número de WhatsApp propio' };
  const err = new Error(`Activa el add-on "${names[addon] || addon}" en Suscripción`);
  err.status = 402;
  err.payload = { error: err.message, upgrade: true, addon };
  return err;
};

/**
 * Construye y envía un tipo de reporte a los destinatarios configurados de la org
 * (o solo a `to`). Para `owner:<clientId>` envía al dueño configurado (o a `to`).
 */
export const sendBriefing = async (kind, { orgId, force = false, to = null, date = null, clientId = null, sub = null } = {}) => {
  if (!orgId) throw new Error('orgId es requerido');
  const k = parseKind(kind, { clientId, sub });
  if (!k) throw Object.assign(new Error(`Tipo de reporte desconocido: ${kind}`), { status: 400 });
  const org = await loadOrgRow(orgId);
  if (!org) throw Object.assign(new Error('Organización no encontrada'), { status: 404 });
  const phoneNumberId = orgPhoneNumberId(org);
  if (k.base === 'hourly' && !addonOn(org, 'hourly_reports')) throw addonError('hourly_reports');
  if (k.base === 'owner' && !addonOn(org, 'owner_reports')) throw addonError('owner_reports');

  let targets;
  if (k.base === 'owner') {
    const owners = (await getOwnerTargets(orgId)).filter((o) => Number(o.client_id) === k.clientId);
    targets = to ? [{ phone: normalizeWaNumber(to), name: owners[0]?.name || '' }] : owners.map((o) => ({ phone: o.phone, name: o.name || '' }));
    if (!targets.length) throw Object.assign(new Error('Esa marca no tiene un dueño con reporte activo; configura su teléfono primero'), { status: 400 });
  } else {
    const all = await getRecipients(orgId, null);
    if (to) {
      const p = normalizeWaNumber(to);
      targets = [{ phone: p, name: all.find((r) => r.phone === p)?.name || '' }];
    } else {
      targets = all.filter((r) => r.kinds.includes(k.base));
    }
  }
  const results = [];
  for (const r of targets) {
    const text = await buildReport(orgId, k.key, { name: r.name, date, clientId: k.clientId, sub: k.sub });
    if (!text) { results.push({ phone: r.phone, skipped: 'sin contenido' }); continue; }
    const res = await deliverBriefing({ orgId, phone: r.phone, name: r.name, kind: k.key, text, force, phoneNumberId, clientId: k.clientId });
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

/** Organizaciones con al menos un destinatario o un dueño de marca activo */
const listBriefingOrgs = async () => db.all(`
  SELECT o.id, o.name, o.plan, o.plan_status, o.billing_cycle, o.addons, o.kapso_phone_number_id, o.branding
  FROM organizations o
  WHERE EXISTS (SELECT 1 FROM whatsapp_briefing_recipients r WHERE r.organization_id = o.id AND r.enabled = TRUE)
     OR EXISTS (SELECT 1 FROM client_owner_reports w WHERE w.organization_id = o.id AND w.enabled = TRUE)
  ORDER BY o.id ASC
`);

/** Reportes a los dueños de marca de una org para la franja `sub` (06:00 morning / 12:00 noon) */
const runOwnerReports = async (org, sub, { today, phoneNumberId }) => {
  if (!addonOn(org, 'owner_reports')) return { owners: 0, skipped: 'sin add-on owner_reports' };
  const owners = await getOwnerTargets(org.id, sub);
  let sent = 0;
  for (const o of owners) {
    const key = `owner:${o.client_id}:${sub}`;
    if (!(await claimRun(key, today))) continue;
    try {
      const text = await buildOwnerReport(org.id, o.client_id, { sub });
      if (!text) continue;
      const r = await deliverBriefing({ orgId: org.id, phone: o.phone, name: o.name, kind: key, text, phoneNumberId, clientId: o.client_id });
      sent += 1;
      console.log(`[briefings] owner ${o.brand} (org ${org.id}) ${sub}:`, JSON.stringify(r));
    } catch (e) {
      console.error(`[briefings] owner ${o.client_id} (org ${org.id}):`, e.message);
    }
  }
  return { owners: sent, candidates: owners.length };
};

const runScheduledForOrg = async (org, kind, { today, hour }) => {
  const orgId = org.id;
  const phoneNumberId = orgPhoneNumberId(org);
  const hourlyOn = addonOn(org, 'hourly_reports');

  if (kind === 'alerts') {
    const recipients = await getRecipients(orgId, 'alerts');
    if (!recipients.length) return null;
    const alerts = await computeAlerts(orgId, { date: today, hour });
    const fresh = [];
    for (const a of alerts) {
      if (await claimRun(`alert:${orgId}:${a.kind}:${a.client_id}`, today)) fresh.push(a);
    }
    if (!fresh.length) return { sent: 0 };
    const text = [`🚨 *Alertas (${fmtDia(today)} · ${hour}:00)*`, '', ...fresh.map((a) => a.text), '', '_Comparado con el promedio de los últimos 14 días, prorrateado a la hora actual._'].join('\n');
    for (const r of recipients) await deliverBriefing({ orgId, phone: r.phone, name: r.name, kind: 'alerts', text, phoneNumberId });
    return { sent: fresh.length, recipients: recipients.length };
  }

  if (kind === 'hourly') {
    if (!hourlyOn) return null;
    const recipients = await getRecipients(orgId, 'hourly');
    if (!recipients.length) return null;
    if (!(await claimRun(`hourly:${orgId}`, `${today}:${hour}`))) return { skipped: 'ya enviado esta hora' };
    const text = await buildHourlyReport(orgId, { date: today, hour });
    const results = [];
    for (const r of recipients) results.push({ phone: r.phone, ...(await deliverBriefing({ orgId, phone: r.phone, name: r.name, kind: 'hourly', text, phoneNumberId })) });
    return { results };
  }

  if (kind === 'noon') {
    // Quien recibe el reporte cada hora ya tiene el de las 12:00: no se le manda el noon aparte
    const recipients = (await getRecipients(orgId, 'noon')).filter((r) => !(hourlyOn && r.kinds.includes('hourly')));
    const out = {};
    if (recipients.length && await claimRun(`noon:${orgId}`, today)) {
      const text = await buildNoonReport(orgId, { date: today });
      out.results = [];
      for (const r of recipients) out.results.push({ phone: r.phone, ...(await deliverBriefing({ orgId, phone: r.phone, name: r.name, kind: 'noon', text, phoneNumberId })) });
    }
    out.owner = await runOwnerReports(org, 'noon', { today, phoneNumberId });
    return out;
  }

  if (kind === 'morning' || kind === 'tasks') {
    const recipients = await getRecipients(orgId, kind);
    const out = {};
    if (recipients.length && await claimRun(`${kind}:${orgId}`, today)) {
      out.results = [];
      const shared = kind === 'tasks' ? await buildTasksReport(orgId, { date: today }) : null;
      for (const r of recipients) {
        const text = shared ?? await buildMorningReport(orgId, { name: r.name });
        if (!text) { out.results.push({ phone: r.phone, skipped: 'sin contenido' }); continue; }
        out.results.push({ phone: r.phone, ...(await deliverBriefing({ orgId, phone: r.phone, name: r.name, kind, text, phoneNumberId })) });
      }
    }
    if (kind === 'morning') out.owner = await runOwnerReports(org, 'morning', { today, phoneNumberId });
    return Object.keys(out).length ? out : null;
  }
  throw new Error(`Tipo de reporte programado desconocido: ${kind}`);
};

/**
 * Cron: recorre todas las organizaciones con el módulo `whatsapp` encendido y al menos un
 * destinatario (o dueño de marca) y envía el tipo `kind` por organización.
 */
export const runScheduled = async (kind) => {
  if (!isKapsoConfigured()) return { kind, skipped: 'Kapso no configurado' };
  const today = colombiaDate(0);
  const hour = colombiaHour();
  const orgs = await listBriefingOrgs();
  const out = [];
  for (const org of orgs) {
    try {
      if (!(await isModuleEnabled(org.id, 'whatsapp'))) { out.push({ orgId: org.id, skipped: 'módulo whatsapp apagado' }); continue; }
      const r = await runScheduledForOrg(org, kind, { today, hour });
      if (r) out.push({ orgId: org.id, ...r });
    } catch (e) {
      console.error(`[briefings] ${kind} org ${org.id}:`, e.message);
      out.push({ orgId: org.id, error: e.message });
    }
  }
  if (out.length) console.log(`[briefings] ${kind} ${today} ${hour}:00 →`, JSON.stringify(out).slice(0, 1500));
  return { kind, orgs: out };
};

export default {
  buildMorningReport, buildNoonReport, buildTasksReport, buildAlertsReport, buildHourlyReport, buildOwnerReport, buildReport,
  computeAlerts, sendBriefing, runScheduled, deliverBriefing, deliverPendingBriefings, chunkText,
  getRecipients, getOwnerTargets, parseKind, parseKinds, RECIPIENT_KINDS, DEFAULT_KINDS,
};
