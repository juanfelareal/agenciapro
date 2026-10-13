/**
 * Ventas por WhatsApp — canal de venta "offline" que el cliente reporta (no pasa por la tienda).
 *
 *  - Registro diario en `client_whatsapp_sales` (desde Orbit, el portal del cliente o un mensaje
 *    al número de Kapso) y espejo en `client_daily_metrics.whatsapp_revenue / whatsapp_orders`.
 *  - Pauta de WhatsApp: las campañas de Meta se clasifican como `whatsapp` o `web`
 *    (override manual en `client_campaign_channels`; si no, por nombre/objetivo/conversaciones)
 *    y el sync guarda `fb_spend_whatsapp` por día.
 *  - Con eso: ROAS web = venta tienda / (pauta − pauta WhatsApp); ROAS WhatsApp = venta WhatsApp / pauta WhatsApp;
 *    ROAS total = (tienda + WhatsApp) / pauta total.
 */
import db from '../config/database.js';
import { withFacebookFallback } from '../utils/facebookClient.js';

const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const isoDate = (v) => String(v || '').slice(0, 10);

// ---------------------------------------------------------------------------
// Clasificación de campañas
// ---------------------------------------------------------------------------
const WA_NAME_RE = /whats?\s?app|\bwsp\b|\bwa\b|\bwpp\b|mensajes?\b|messag|conversaci|chat\b|\bdm\b/i;
const WA_OBJECTIVES = new Set(['MESSAGES', 'OUTCOME_ENGAGEMENT']);

/** 'whatsapp' | 'web' + motivo. `override` viene de client_campaign_channels. */
export function classifyCampaign(c, override = null) {
  if (override === 'whatsapp' || override === 'web') return { channel: override, reason: 'manual' };
  const name = String(c.campaign_name || '');
  if (WA_NAME_RE.test(name)) return { channel: 'whatsapp', reason: 'nombre' };
  const objective = String(c.objective || c.campaign_objective || '').toUpperCase();
  const msgs = num(c.messaging_conversations ?? c.messagingConversations);
  if (WA_OBJECTIVES.has(objective) && msgs > 0) return { channel: 'whatsapp', reason: 'objetivo de mensajes' };
  if (objective === 'MESSAGES') return { channel: 'whatsapp', reason: 'objetivo de mensajes' };
  return { channel: 'web', reason: objective ? 'objetivo' : 'default' };
}

export async function getCampaignOverrides(clientId, platform = 'facebook') {
  const rows = await db.all(
    'SELECT campaign_id, channel FROM client_campaign_channels WHERE client_id = ? AND platform = ?',
    [clientId, platform],
  );
  return Object.fromEntries(rows.map((r) => [String(r.campaign_id), r.channel]));
}

export async function setCampaignChannel({ clientId, orgId, platform = 'facebook', campaignId, campaignName, channel }) {
  if (channel === 'auto' || !channel) {
    await db.run('DELETE FROM client_campaign_channels WHERE client_id = ? AND platform = ? AND campaign_id = ?', [clientId, platform, String(campaignId)]);
    return { channel: 'auto' };
  }
  if (!['whatsapp', 'web'].includes(channel)) throw new Error('channel debe ser whatsapp, web o auto');
  await db.query(`
    INSERT INTO client_campaign_channels (organization_id, client_id, platform, campaign_id, campaign_name, channel)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (client_id, platform, campaign_id) DO UPDATE SET channel = EXCLUDED.channel, campaign_name = COALESCE(EXCLUDED.campaign_name, client_campaign_channels.campaign_name), updated_at = CURRENT_TIMESTAMP
  `, [orgId, clientId, platform, String(campaignId), campaignName || null, channel]);
  return { channel };
}

const getFacebookCred = (clientId) => db.get(
  'SELECT access_token, ad_account_id FROM client_facebook_credentials WHERE client_id = ? ORDER BY id ASC LIMIT 1',
  [clientId],
);

/**
 * Campañas de Meta en el rango con gasto, clasificación y origen de la clasificación.
 * @returns {{ campaigns: Array, whatsapp_spend: number, web_spend: number, total_spend: number }}
 */
export async function getCampaignChannels(clientId, startDate, endDate) {
  const cred = await getFacebookCred(clientId);
  if (!cred?.ad_account_id) return { campaigns: [], whatsapp_spend: 0, web_spend: 0, total_spend: 0, connected: false };
  const [overrides, { result: rows }] = await Promise.all([
    getCampaignOverrides(clientId),
    withFacebookFallback(cred, (fb) => fb.getCampaignSpend(startDate, endDate), 'Campañas WA'),
  ]);
  // Agrupar por campaña (getCampaignSpend devuelve filas por día)
  const byCampaign = {};
  for (const r of rows || []) {
    const id = String(r.campaign_id);
    const c = byCampaign[id] || (byCampaign[id] = { campaign_id: id, campaign_name: r.campaign_name, objective: r.objective, spend: 0, messaging_conversations: 0, days: 0 });
    c.spend += num(r.spend);
    c.messaging_conversations += num(r.messaging_conversations);
    c.days += 1;
  }
  const campaigns = Object.values(byCampaign).map((c) => {
    const { channel, reason } = classifyCampaign(c, overrides[c.campaign_id] || null);
    return { ...c, channel, reason, is_override: Boolean(overrides[c.campaign_id]) };
  }).sort((a, b) => b.spend - a.spend);
  const whatsapp_spend = campaigns.filter((c) => c.channel === 'whatsapp').reduce((s, c) => s + c.spend, 0);
  const total_spend = campaigns.reduce((s, c) => s + c.spend, 0);
  return { campaigns, whatsapp_spend, web_spend: total_spend - whatsapp_spend, total_spend, connected: true };
}

/**
 * Calcula y guarda fb_spend_whatsapp para un día (o rango) de un cliente.
 * Usa las filas diarias por campaña para que cada fecha quede con su valor.
 */
export async function recalcWhatsappSpend(clientId, startDate, endDate = startDate, { fbIntegration = null } = {}) {
  const cred = await getFacebookCred(clientId);
  if (!cred?.ad_account_id) return { updated: 0, reason: 'sin Meta' };
  const overrides = await getCampaignOverrides(clientId);
  let rows;
  if (fbIntegration) rows = await fbIntegration.getCampaignSpend(startDate, endDate);
  else ({ result: rows } = await withFacebookFallback(cred, (fb) => fb.getCampaignSpend(startDate, endDate), 'Campañas WA'));
  const perDay = {};
  for (const r of rows || []) {
    const d = isoDate(r.date);
    perDay[d] = perDay[d] || { whatsapp: 0, total: 0 };
    const { channel } = classifyCampaign(r, overrides[String(r.campaign_id)] || null);
    perDay[d].total += num(r.spend);
    if (channel === 'whatsapp') perDay[d].whatsapp += num(r.spend);
  }
  // Días sin campañas → 0
  let updated = 0;
  const cur = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10);
    const wa = perDay[d]?.whatsapp || 0;
    const r = await db.run('UPDATE client_daily_metrics SET fb_spend_whatsapp = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND metric_date = ?', [wa, clientId, d]);
    if (!r.changes && wa > 0) {
      await db.run('INSERT INTO client_daily_metrics (client_id, metric_date, fb_spend_whatsapp) VALUES (?, ?, ?)', [clientId, d, wa]);
    }
    updated += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return { updated, per_day: perDay };
}

// ---------------------------------------------------------------------------
// Ventas por WhatsApp (registro manual)
// ---------------------------------------------------------------------------
async function mirrorToDailyMetrics(clientId, date) {
  const row = await db.get('SELECT revenue, orders FROM client_whatsapp_sales WHERE client_id = ? AND sale_date = ?', [clientId, date]);
  const revenue = num(row?.revenue);
  const orders = Math.round(num(row?.orders));
  const r = await db.run('UPDATE client_daily_metrics SET whatsapp_revenue = ?, whatsapp_orders = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND metric_date = ?', [revenue, orders, clientId, date]);
  if (!r.changes && (revenue > 0 || orders > 0)) {
    await db.run('INSERT INTO client_daily_metrics (client_id, metric_date, whatsapp_revenue, whatsapp_orders) VALUES (?, ?, ?, ?)', [clientId, date, revenue, orders]);
  }
}

export async function upsertWhatsappSale({ clientId, orgId, date, revenue, orders = 0, notes = null, source = 'orbit', createdBy = null }) {
  const d = isoDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Fecha inválida (YYYY-MM-DD)');
  const rev = num(revenue);
  if (rev < 0) throw new Error('El monto no puede ser negativo');
  await db.query(`
    INSERT INTO client_whatsapp_sales (organization_id, client_id, sale_date, revenue, orders, notes, source, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (client_id, sale_date) DO UPDATE SET
      revenue = EXCLUDED.revenue, orders = EXCLUDED.orders, notes = COALESCE(EXCLUDED.notes, client_whatsapp_sales.notes),
      source = EXCLUDED.source, created_by = COALESCE(EXCLUDED.created_by, client_whatsapp_sales.created_by), updated_at = CURRENT_TIMESTAMP
  `, [orgId, clientId, d, rev, Math.round(num(orders)), notes, source, createdBy]);
  await mirrorToDailyMetrics(clientId, d);
  return { date: d, revenue: rev, orders: Math.round(num(orders)) };
}

/** Reparte un total entre start y end (parejo por día; el residuo va al último día) */
export async function distributeWhatsappSales({ clientId, orgId, start, end, revenue, orders = 0, notes = null, source = 'orbit', createdBy = null }) {
  const s = isoDate(start); const e = isoDate(end);
  if (!s || !e || s > e) throw new Error('Rango de fechas inválido');
  const days = [];
  const cur = new Date(`${s}T12:00:00`);
  const last = new Date(`${e}T12:00:00`);
  while (cur <= last) { days.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
  if (days.length > 93) throw new Error('Máximo 93 días por registro');
  const rev = num(revenue); const ord = Math.round(num(orders));
  const perDayRev = Math.floor((rev / days.length) * 100) / 100;
  const perDayOrd = Math.floor(ord / days.length);
  let accRev = 0; let accOrd = 0;
  const out = [];
  for (let i = 0; i < days.length; i++) {
    const isLast = i === days.length - 1;
    const r = isLast ? Math.round((rev - accRev) * 100) / 100 : perDayRev;
    const o = isLast ? ord - accOrd : perDayOrd;
    accRev += r; accOrd += o;
    out.push(await upsertWhatsappSale({ clientId, orgId, date: days[i], revenue: r, orders: o, notes: notes || `Total repartido ${s} → ${e}`, source, createdBy }));
  }
  return { days: days.length, entries: out };
}

export async function deleteWhatsappSale(clientId, date) {
  const d = isoDate(date);
  await db.run('DELETE FROM client_whatsapp_sales WHERE client_id = ? AND sale_date = ?', [clientId, d]);
  await mirrorToDailyMetrics(clientId, d);
  return { deleted: true };
}

export async function listWhatsappSales(clientId, start, end) {
  return db.all(`
    SELECT s.id, s.sale_date AS date, s.revenue, s.orders, s.notes, s.source, s.created_at, s.updated_at, tm.name AS created_by_name
    FROM client_whatsapp_sales s
    LEFT JOIN team_members tm ON tm.id = s.created_by
    WHERE s.client_id = ? AND s.sale_date BETWEEN ? AND ?
    ORDER BY s.sale_date DESC
  `, [clientId, isoDate(start), isoDate(end)]);
}

/** Resumen por canal en el rango (lee client_daily_metrics) */
export async function channelSummary(clientId, start, end, { storeRevenue = null } = {}) {
  const row = await db.get(`
    SELECT COALESCE(SUM(whatsapp_revenue), 0) AS wa_revenue, COALESCE(SUM(whatsapp_orders), 0) AS wa_orders,
           COALESCE(SUM(fb_spend_whatsapp), 0) AS wa_spend,
           COALESCE(SUM(fb_spend), 0) + COALESCE(SUM(ga_spend), 0) + COALESCE(SUM(tt_spend), 0) AS total_spend
    FROM client_daily_metrics WHERE client_id = ? AND metric_date BETWEEN ? AND ?
  `, [clientId, isoDate(start), isoDate(end)]);
  const wa_revenue = num(row?.wa_revenue); const wa_orders = num(row?.wa_orders);
  const wa_spend = num(row?.wa_spend); const total_spend = num(row?.total_spend);
  const web_spend = Math.max(total_spend - wa_spend, 0);
  const web_revenue = storeRevenue === null ? null : num(storeRevenue);
  return {
    whatsapp_revenue: wa_revenue, whatsapp_orders: wa_orders, whatsapp_ad_spend: wa_spend,
    web_ad_spend: web_spend, total_ad_spend: total_spend,
    web_revenue,
    total_revenue: web_revenue === null ? null : web_revenue + wa_revenue,
    roas_whatsapp: wa_spend > 0 ? wa_revenue / wa_spend : 0,
    roas_web: web_revenue === null ? null : (web_spend > 0 ? web_revenue / web_spend : 0),
    roas_total: web_revenue === null ? null : (total_spend > 0 ? (web_revenue + wa_revenue) / total_spend : 0),
    has_whatsapp: wa_revenue > 0 || wa_orders > 0 || wa_spend > 0,
  };
}

// ---------------------------------------------------------------------------
// Intake por mensaje de WhatsApp (Kapso)
// ---------------------------------------------------------------------------
const MONTHS = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 };

const parseAmount = (txt) => {
  // "$1.250.000", "1250000", "1,250,000", "1.2M", "850k"
  const m = String(txt).replace(/\s/g, '').match(/\$?([\d.,]+)\s*(m|k)?/i);
  if (!m) return null;
  let raw = m[1];
  const suffix = (m[2] || '').toLowerCase();
  // Si hay puntos como miles y una coma decimal → formato es-CO
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) raw = raw.replace(/,/g, '');
  else raw = raw.replace(/\./g, (x, i, s) => (s.indexOf('.') === s.lastIndexOf('.') && s.split('.')[1]?.length !== 3 ? '.' : '')).replace(',', '.');
  let v = parseFloat(raw);
  if (!Number.isFinite(v)) return null;
  if (suffix === 'm') v *= 1_000_000;
  if (suffix === 'k') v *= 1_000;
  return v;
};

/**
 * Interpreta mensajes tipo:
 *   "Ventas whatsapp hoy: $1.250.000, 8 pedidos"
 *   "ventas wsp 12/10 1.800.000 (11 pedidos)"
 *   "WhatsApp ayer: 950k 6 ped"
 * @returns {null | { date, revenue, orders }}
 */
export function parseWhatsappSalesMessage(text, { today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) } = {}) {
  const t = String(text || '').trim();
  // Debe mencionar WhatsApp y además hablar de ventas/pedidos o traer un monto con $
  if (!/whats?\s?app|\bwsp\b|\bwa\b/i.test(t)) return null;
  if (!/\bventas?\b|\bvendi|\bpedidos?\b|\bped\b|\$/i.test(t)) return null;

  // Fecha
  let date = today;
  const toISO = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const yr = Number(today.slice(0, 4));
  if (/\bayer\b/i.test(t)) {
    const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - 1); date = d.toISOString().slice(0, 10);
  } else {
    const dm = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    const dMon = t.match(/\b(\d{1,2})\s*(?:de\s*)?(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)[a-z]*\b/i);
    if (dm) {
      const y = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : yr;
      date = toISO(y, Number(dm[2]), Number(dm[1]));
    } else if (dMon) {
      date = toISO(yr, MONTHS[dMon[2].toLowerCase().slice(0, 4)] || MONTHS[dMon[2].toLowerCase().slice(0, 3)], Number(dMon[1]));
    }
  }

  // Pedidos
  let orders = 0;
  const om = t.match(/(\d+)\s*(?:pedidos?|ped\b|ordenes?|órdenes?|ventas?\b(?!\s*(?:whats|wsp|wa)))/i);
  if (om) orders = Number(om[1]);

  // Monto: el número más grande con $ o con separadores / sufijo
  const candidates = [...t.matchAll(/\$?\s?\d[\d.,]*\s?(?:m|k)?\b/gi)].map((m) => m[0]).filter((c) => /\$|[.,]\d{3}|\d{4,}|[mk]$/i.test(c.replace(/\s/g, '')));
  let revenue = null;
  for (const c of candidates) { const v = parseAmount(c); if (v !== null && (revenue === null || v > revenue)) revenue = v; }
  if (revenue === null || revenue <= 0) return null;
  return { date, revenue, orders };
}

export default {
  classifyCampaign, getCampaignOverrides, setCampaignChannel, getCampaignChannels, recalcWhatsappSpend,
  upsertWhatsappSale, distributeWhatsappSales, deleteWhatsappSale, listWhatsappSales, channelSummary, parseWhatsappSalesMessage,
};
