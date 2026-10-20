/**
 * Libro de pedidos liviano (client_orders): un renglón por pedido confirmado de la tienda
 * (Shopify o WooCommerce) con su fecha/hora en Colombia, la llave del comprador y la venta neta.
 *
 * Sirve para dos preguntas del dashboard financiero:
 *   - "Cuándo compran": mapa de calor día × hora y ranking de días de la semana.
 *   - "Nuevos vs recurrentes": venta por clientes nuevos/recompra, CAC y tasa de recompra.
 *
 * Reglas:
 *   - Solo se guardan pedidos pagados o parcialmente reembolsados y no cancelados (mismo criterio
 *     que calculateMetricsFromOrders). Si un pedido guardado aparece después cancelado o
 *     reembolsado por completo, se marca `cancelled = 1` (no se borra).
 *   - net_revenue = venta neta sin IVA ni envío (subtotal − impuesto de productos − devoluciones).
 *   - customer_key = id del cliente en la tienda; si no hay, sha256 del email en minúsculas.
 *     Nunca se guarda el email en claro.
 *   - is_new_customer: 1 cuando el pedido es la primera compra de ese comprador. Se infiere con
 *     `customer.orders_count` (Shopify, conteo de por vida) y con lo que haya en el libro.
 */
import { createHash } from 'node:crypto';
import db from '../config/database.js';
import { getStoreCredentials, createStoreIntegration } from '../integrations/storeIntegration.js';
import { todayColombia, addDays, rangeDays } from './clientFinancialsService.js';

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
const round = (v, d = 0) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : 0);
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

export const WEEKEND_DAYS = [6, 0]; // sábado y domingo
export const REPEAT_WINDOW_DAYS = 180;
const INSERT_BATCH = 100;
const BACKFILL_BLOCK_DAYS = 30;
const RETRY_EMPTY_MS = 10 * 60 * 1000;

// ─── Fecha y hora en Colombia ───
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const BOGOTA_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
});

/** { local_date: 'YYYY-MM-DD', local_hour: 0-23, weekday: 0=domingo…6=sábado } en hora Colombia. */
export function bogotaParts(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(BOGOTA_FMT.formatToParts(d).map((x) => [x.type, x.value]));
  return { local_date: `${p.year}-${p.month}-${p.day}`, local_hour: Number(p.hour) % 24, weekday: WD[p.weekday] ?? d.getUTCDay() };
}

/** Día de la semana (0=domingo) de una fecha YYYY-MM-DD (sin depender de la zona del servidor). */
export const weekdayOf = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

const emailKey = (email) => {
  const e = String(email || '').trim().toLowerCase();
  return e ? `e:${createHash('sha256').update(e).digest('hex').slice(0, 32)}` : null;
};

// ─── Normalización por tienda ───
const SHOPIFY_CONFIRMED = new Set(['paid', 'partially_refunded']);
const SHOPIFY_VOID = new Set(['refunded', 'voided']);
const WOO_PAID = new Set(['processing', 'completed']);
const WOO_VOID = new Set(['cancelled', 'failed', 'refunded', 'trash']);

function normalizeShopify(order) {
  const id = order?.id != null ? String(order.id) : null;
  if (!id) return null;
  const status = String(order.financial_status || '');
  if (order.cancelled_at || SHOPIFY_VOID.has(status)) return { kind: 'void', store_order_id: id, financial_status: order.cancelled_at ? 'cancelled' : status };
  if (!SHOPIFY_CONFIRMED.has(status)) return { kind: 'skip', store_order_id: id };

  const taxesIncluded = Boolean(order.taxes_included);
  const subtotal = num(order.subtotal_price);
  const totalTax = num(order.total_tax);
  const shippingTax = (order.shipping_lines || []).reduce((s, sl) => s + (sl.tax_lines || []).reduce((t, tl) => t + num(tl.price), 0), 0);
  const refunds = (order.refunds || []).reduce((s, r) => s + (r.refund_line_items || []).reduce((t, ri) => t + num(ri.subtotal), 0), 0);
  const net = taxesIncluded ? subtotal - (totalTax - shippingTax) - refunds : subtotal - refunds;
  const items = (order.line_items || []).reduce((s, li) => s + (parseInt(li.quantity, 10) || 0), 0);
  const customerId = order.customer?.id != null ? String(order.customer.id) : null;
  const ordersCount = order.customer?.orders_count != null ? parseInt(order.customer.orders_count, 10) : null;
  const parts = bogotaParts(order.created_at || order.processed_at);
  if (!parts) return null;

  return {
    kind: 'confirmed',
    store_order_id: id,
    order_number: order.name || (order.order_number != null ? String(order.order_number) : null),
    created_at: new Date(order.created_at || order.processed_at).toISOString(),
    ...parts,
    financial_status: status,
    customer_key: customerId ? `c:${customerId}` : emailKey(order.customer?.email || order.email || order.contact_email),
    customer_orders_count: Number.isFinite(ordersCount) ? ordersCount : null,
    gross_total: round(num(order.total_price), 2),
    net_revenue: round(net, 2),
    discounts: round(num(order.total_discounts), 2),
    items,
    source_name: order.source_name || null,
  };
}

function normalizeWoo(order) {
  const id = order?.id != null ? String(order.id) : null;
  if (!id) return null;
  const status = String(order.status || '').toLowerCase();
  if (WOO_VOID.has(status)) return { kind: 'void', store_order_id: id, financial_status: status };
  if (!WOO_PAID.has(status)) return { kind: 'skip', store_order_id: id };

  // date_created_gmt viene sin zona (es UTC); date_created viene en la zona de la tienda (asumimos Colombia).
  const created = order.date_created_gmt ? `${order.date_created_gmt}Z` : (order.date_created ? `${order.date_created}-05:00` : null);
  const parts = created ? bogotaParts(created) : null;
  if (!parts) return null;
  const lines = order.line_items || [];
  const refunds = (order.refunds || []).reduce((s, r) => s + Math.abs(num(r.total)), 0);
  const net = lines.reduce((s, li) => s + num(li.total), 0) - refunds;
  const customerId = order.customer_id ? String(order.customer_id) : null;

  return {
    kind: 'confirmed',
    store_order_id: id,
    order_number: order.number != null ? String(order.number) : id,
    created_at: new Date(created).toISOString(),
    ...parts,
    financial_status: status,
    customer_key: customerId ? `c:${customerId}` : emailKey(order.billing?.email),
    customer_orders_count: null,
    gross_total: round(num(order.total), 2),
    net_revenue: round(net, 2),
    discounts: round(num(order.discount_total), 2),
    items: lines.reduce((s, li) => s + (parseInt(li.quantity, 10) || 0), 0),
    source_name: order.created_via || null,
  };
}

/** Pedido crudo de la tienda → fila del libro ({ kind: 'confirmed' | 'void' | 'skip' }) o null. */
export function normalizeOrder(order, store = 'shopify') {
  return store === 'woocommerce' ? normalizeWoo(order) : normalizeShopify(order);
}

// ─── Escritura ───
const INSERT_COLS = [
  'organization_id', 'client_id', 'store', 'store_order_id', 'order_number', 'created_at', 'local_date', 'local_hour', 'weekday',
  'financial_status', 'cancelled', 'customer_key', 'is_new_customer', 'customer_orders_count', 'gross_total', 'net_revenue',
  'discounts', 'items', 'source_name',
];

async function insertBatch(rows) {
  if (!rows.length) return;
  const values = [];
  const params = [];
  rows.forEach((r) => {
    const ph = [];
    for (const c of INSERT_COLS) { params.push(r[c]); ph.push(`$${params.length}`); }
    values.push(`(${ph.join(', ')})`);
  });
  await db.query(`
    INSERT INTO client_orders (${INSERT_COLS.join(', ')})
    VALUES ${values.join(', ')}
    ON CONFLICT (client_id, store_order_id) DO UPDATE SET
      organization_id = COALESCE(EXCLUDED.organization_id, client_orders.organization_id),
      order_number = EXCLUDED.order_number,
      created_at = EXCLUDED.created_at,
      local_date = EXCLUDED.local_date,
      local_hour = EXCLUDED.local_hour,
      weekday = EXCLUDED.weekday,
      financial_status = EXCLUDED.financial_status,
      cancelled = 0,
      customer_key = COALESCE(EXCLUDED.customer_key, client_orders.customer_key),
      customer_orders_count = COALESCE(EXCLUDED.customer_orders_count, client_orders.customer_orders_count),
      gross_total = EXCLUDED.gross_total,
      net_revenue = EXCLUDED.net_revenue,
      discounts = EXCLUDED.discounts,
      items = EXCLUDED.items,
      source_name = EXCLUDED.source_name,
      synced_at = CURRENT_TIMESTAMP
  `, params);
}

/**
 * Decide qué pedidos de cada comprador son "primera compra":
 *   - Si la tienda reporta orders_count ≤ 1 en algún pedido, ese pedido es nuevo.
 *   - El pedido más antiguo del comprador en el libro es nuevo cuando no hay orders_count (Woo) o
 *     cuando el libro ya tiene tantos pedidos como la tienda reporta (no hay compras más viejas afuera).
 * Función pura; devuelve los ids cuyo flag cambia.
 */
export function decideNewFlags(rows) {
  const byKey = new Map();
  for (const r of rows) {
    if (!r.customer_key || Number(r.cancelled)) continue;
    if (!byKey.has(r.customer_key)) byKey.set(r.customer_key, []);
    byKey.get(r.customer_key).push(r);
  }
  const changes = [];
  for (const list of byKey.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : num(a.id) - num(b.id)));
    const counts = list.map((r) => r.customer_orders_count).filter((c) => c != null);
    const lifetime = counts.length ? Math.max(...counts) : null;
    list.forEach((r, i) => {
      const reported = r.customer_orders_count;
      const isNew = (reported != null && reported <= 1) || (i === 0 && (lifetime === null || lifetime <= list.length)) ? 1 : 0;
      if (Number(r.is_new_customer) !== isNew) changes.push({ id: r.id, is_new_customer: isNew });
    });
  }
  return changes;
}

async function recomputeNewFlags(clientId, keys) {
  const uniq = [...new Set(keys.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200);
    const rows = await db.query(
      `SELECT id, customer_key, customer_orders_count, is_new_customer, cancelled, created_at
         FROM client_orders WHERE client_id = $1 AND customer_key = ANY($2::text[])`,
      [clientId, chunk],
    );
    const changes = decideNewFlags(rows.rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })));
    const toOne = changes.filter((c) => c.is_new_customer === 1).map((c) => c.id);
    const toZero = changes.filter((c) => c.is_new_customer === 0).map((c) => c.id);
    if (toOne.length) await db.query('UPDATE client_orders SET is_new_customer = 1 WHERE id = ANY($1::int[])', [toOne]);
    if (toZero.length) await db.query('UPDATE client_orders SET is_new_customer = 0 WHERE id = ANY($1::int[])', [toZero]);
  }
}

/**
 * Guarda (idempotente) los pedidos confirmados y marca como cancelados los que ya estaban y hoy
 * aparecen cancelados/reembolsados. Devuelve { saved, voided, skipped }.
 */
export async function upsertOrders(clientId, orgId, orders, store = 'shopify') {
  const list = Array.isArray(orders) ? orders : [];
  const confirmed = new Map();
  const voided = [];
  let skipped = 0;
  for (const o of list) {
    const n = normalizeOrder(o, store);
    if (!n) { skipped += 1; continue; }
    if (n.kind === 'void') voided.push(n);
    else if (n.kind === 'confirmed') confirmed.set(n.store_order_id, n); // dedupe dentro del lote
    else skipped += 1;
  }

  const rows = [...confirmed.values()].map((n) => ({
    organization_id: orgId ?? null,
    client_id: Number(clientId),
    store,
    store_order_id: n.store_order_id,
    order_number: n.order_number,
    created_at: n.created_at,
    local_date: n.local_date,
    local_hour: n.local_hour,
    weekday: n.weekday,
    financial_status: n.financial_status,
    cancelled: 0,
    customer_key: n.customer_key,
    // provisional; recomputeNewFlags lo ajusta mirando todo el historial del comprador
    is_new_customer: n.customer_orders_count != null && n.customer_orders_count <= 1 ? 1 : 0,
    customer_orders_count: n.customer_orders_count,
    gross_total: n.gross_total,
    net_revenue: n.net_revenue,
    discounts: n.discounts,
    items: n.items,
    source_name: n.source_name,
  }));
  for (let i = 0; i < rows.length; i += INSERT_BATCH) await insertBatch(rows.slice(i, i + INSERT_BATCH));

  let voidedCount = 0;
  if (voided.length) {
    const r = await db.query(
      `UPDATE client_orders SET cancelled = 1, synced_at = CURRENT_TIMESTAMP
        WHERE client_id = $1 AND store_order_id = ANY($2::text[]) AND cancelled = 0`,
      [clientId, voided.map((v) => v.store_order_id)],
    );
    voidedCount = r.rowCount || 0;
  }

  const keys = rows.map((r) => r.customer_key);
  if (voidedCount) {
    const k = await db.query('SELECT customer_key FROM client_orders WHERE client_id = $1 AND store_order_id = ANY($2::text[])', [clientId, voided.map((v) => v.store_order_id)]);
    keys.push(...k.rows.map((x) => x.customer_key));
  }
  if (keys.length) await recomputeNewFlags(clientId, keys);

  return { saved: rows.length, voided: voidedCount, skipped };
}

// ─── Backfill ───
const inflight = new Map(); // clientId → Promise
const lastAttempt = new Map(); // clientId → timestamp

export const isBackfilling = (clientId) => inflight.has(String(clientId));

/** Trae los pedidos de la tienda en bloques de 30 días y los guarda. */
export async function backfillOrders(clientId, orgId, days = 180, { store = null, platform = null } = {}) {
  let integration = store;
  let plat = platform;
  if (!integration) {
    const cred = await getStoreCredentials(clientId);
    if (!cred) throw new Error('Sin tienda conectada (Shopify o WooCommerce)');
    integration = createStoreIntegration(cred);
    plat = cred.platform;
  }
  const span = Math.max(1, Math.min(Number(days) || 180, 730));
  const end = todayColombia();
  const start = addDays(end, -(span - 1));
  let total = 0;
  let blocks = 0;
  for (let from = start; from <= end; from = addDays(from, BACKFILL_BLOCK_DAYS)) {
    const to = addDays(from, BACKFILL_BLOCK_DAYS - 1) > end ? end : addDays(from, BACKFILL_BLOCK_DAYS - 1);
    const orders = await integration.getOrders(from, to);
    const r = await upsertOrders(clientId, orgId, orders, plat || 'shopify');
    total += r.saved;
    blocks += 1;
  }
  return { start, end, days: span, blocks, orders: total };
}

/** Lanza el backfill en segundo plano (una sola vez por cliente a la vez). */
export function startBackfill(clientId, orgId, days = 180) {
  const key = String(clientId);
  if (inflight.has(key)) return inflight.get(key);
  lastAttempt.set(key, Date.now());
  const p = backfillOrders(clientId, orgId, days)
    .then((r) => { console.log(`[orderLedger] cliente ${clientId}: histórico listo (${r.orders} pedidos, ${r.days} días)`); return r; })
    .catch((err) => { console.error(`[orderLedger] cliente ${clientId}: falló el histórico:`, err.message); return null; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * ¿Hay libro para este cliente? Si está vacío y hay tienda conectada, arranca el backfill.
 * @returns {{ ready: boolean, building: boolean, no_store?: boolean }}
 */
export async function ensureLedger(clientId, orgId, days = 180) {
  const key = String(clientId);
  const row = await db.get('SELECT COUNT(*)::int AS n FROM client_orders WHERE client_id = ?', [clientId]);
  if (num(row?.n) > 0) return { ready: true, building: inflight.has(key) };
  if (inflight.has(key)) return { ready: false, building: true };
  if (Date.now() - (lastAttempt.get(key) || 0) < RETRY_EMPTY_MS) return { ready: false, building: false };
  const cred = await getStoreCredentials(clientId);
  if (!cred) return { ready: false, building: false, no_store: true };
  startBackfill(clientId, orgId, days);
  return { ready: false, building: true };
}

// ─── Agregaciones (puras, testeables sin base de datos) ───
const emptyWeekdays = () => Array.from({ length: 7 }, (_, weekday) => ({ weekday, orders: 0, revenue: 0, days: 0, avg_orders_per_day: 0, avg_revenue_per_day: 0, share: 0 }));

/**
 * rows: [{ local_date, local_hour, weekday, net_revenue }] ya filtradas al rango.
 * Los promedios por día usan los días calendario del rango efectivo (desde que hay datos), no solo los días con venta.
 */
export function aggregatePatterns(rows, { start, end, firstDate = null }) {
  const effectiveStart = firstDate && firstDate > start ? firstDate : start;
  const calendar = effectiveStart <= end ? rangeDays(effectiveStart, end) : [];
  const grid = new Map(); // `${weekday}-${hour}` → cell
  const byWeekday = emptyWeekdays();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0, share: 0 }));
  const datesWithData = new Set();
  let totalRevenue = 0;
  let totalOrders = 0;

  for (const d of calendar) byWeekday[weekdayOf(d)].days += 1;
  for (const r of rows) {
    const wd = Number(r.weekday);
    const h = Number(r.local_hour);
    const rev = num(r.net_revenue);
    if (!(wd >= 0 && wd <= 6) || !(h >= 0 && h <= 23)) continue;
    const key = `${wd}-${h}`;
    if (!grid.has(key)) grid.set(key, { weekday: wd, hour: h, orders: 0, revenue: 0 });
    const cell = grid.get(key);
    cell.orders += 1; cell.revenue += rev;
    byWeekday[wd].orders += 1; byWeekday[wd].revenue += rev;
    byHour[h].orders += 1; byHour[h].revenue += rev;
    totalRevenue += rev; totalOrders += 1;
    if (r.local_date) datesWithData.add(r.local_date);
  }

  const heatmap = [];
  for (let wd = 0; wd < 7; wd += 1) for (let h = 0; h < 24; h += 1) {
    const c = grid.get(`${wd}-${h}`);
    heatmap.push({ weekday: wd, hour: h, orders: c ? c.orders : 0, revenue: c ? round(c.revenue) : 0 });
  }
  for (const w of byWeekday) {
    w.revenue = round(w.revenue);
    w.avg_orders_per_day = w.days ? round(w.orders / w.days, 2) : 0;
    w.avg_revenue_per_day = w.days ? round(w.revenue / w.days) : 0;
    w.share = totalRevenue > 0 ? round(w.revenue / totalRevenue, 4) : 0;
  }
  for (const h of byHour) { h.revenue = round(h.revenue); h.share = totalOrders > 0 ? round(h.orders / totalOrders, 4) : 0; }

  const weekend = byWeekday.filter((w) => WEEKEND_DAYS.includes(w.weekday));
  const weekday = byWeekday.filter((w) => !WEEKEND_DAYS.includes(w.weekday));
  const sum = (list, k) => list.reduce((s, x) => s + num(x[k]), 0);
  const weekendRevenue = sum(weekend, 'revenue');
  const weekdayRevenue = sum(weekday, 'revenue');
  const weekendDays = sum(weekend, 'days');
  const weekdayDays = sum(weekday, 'days');

  const bestDays = [...byWeekday].filter((w) => w.days > 0).sort((a, b) => b.avg_revenue_per_day - a.avg_revenue_per_day).slice(0, 3).map((w) => w.weekday);
  const peakHour = [...byHour].sort((a, b) => b.orders - a.orders)[0];

  return {
    heatmap,
    by_weekday: byWeekday,
    by_hour: byHour,
    best_days: bestDays,
    peak_hour: peakHour && peakHour.orders > 0 ? { hour: peakHour.hour, orders: peakHour.orders, share: peakHour.share } : null,
    weekend_vs_weekday: {
      weekend_share_revenue: totalRevenue > 0 ? round(weekendRevenue / totalRevenue, 4) : 0,
      weekday_share_revenue: totalRevenue > 0 ? round(weekdayRevenue / totalRevenue, 4) : 0,
      avg_daily_revenue_weekend: weekendDays ? round(weekendRevenue / weekendDays) : 0,
      avg_daily_revenue_weekday: weekdayDays ? round(weekdayRevenue / weekdayDays) : 0,
      ratio: weekdayDays && weekendDays && weekdayRevenue > 0 ? round((weekendRevenue / weekendDays) / (weekdayRevenue / weekdayDays), 2) : null,
    },
    totals: { orders: totalOrders, revenue: round(totalRevenue) },
    period: { start, end, effective_start: effectiveStart, days: calendar.length, days_with_data: datesWithData.size },
  };
}

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

/**
 * rangeRows: pedidos del rango [{ customer_key, is_new_customer, net_revenue }]
 * windowRows: pedidos de los últimos 180 días hasta `end` [{ customer_key, local_date }] (para recompra)
 * adSpend: pauta del rango (Meta + Google + TikTok)
 */
export function aggregateCustomerMix({ rangeRows, windowRows, adSpend, start, end }) {
  const bucket = () => ({ orders: 0, revenue: 0, aov: null, customers: 0, _keys: new Set(), _anon: 0 });
  const groups = { new: bucket(), returning: bucket() };
  const allKeys = new Set();
  let anonOrders = 0;
  for (const r of rangeRows) {
    const g = Number(r.is_new_customer) === 1 ? groups.new : groups.returning;
    g.orders += 1; g.revenue += num(r.net_revenue);
    if (r.customer_key) { g._keys.add(r.customer_key); allKeys.add(r.customer_key); } else { g._anon += 1; anonOrders += 1; }
  }
  for (const g of Object.values(groups)) {
    g.customers = g._keys.size + g._anon; // sin llave: cada pedido cuenta como un comprador
    g.revenue = round(g.revenue);
    g.aov = g.orders ? round(g.revenue / g.orders) : null;
    delete g._keys; delete g._anon;
  }
  const totalOrders = groups.new.orders + groups.returning.orders;
  const totalRevenue = groups.new.revenue + groups.returning.revenue;
  const totalCustomers = allKeys.size + anonOrders;

  // Recompra en la ventana de 180 días: compradores con ≥2 pedidos ÷ compradores con ≥1
  const dates = new Map();
  for (const r of windowRows) {
    if (!r.customer_key) continue;
    if (!dates.has(r.customer_key)) dates.set(r.customer_key, []);
    dates.get(r.customer_key).push(r.local_date);
  }
  let repeaters = 0;
  const gaps = [];
  for (const list of dates.values()) {
    if (list.length < 2) continue;
    repeaters += 1;
    const sorted = [...list].sort();
    for (let i = 1; i < sorted.length; i += 1) gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }
  const spend = num(adSpend);

  return {
    new: groups.new,
    returning: groups.returning,
    new_share_revenue: totalRevenue > 0 ? round(groups.new.revenue / totalRevenue, 4) : null,
    new_share_orders: totalOrders > 0 ? round(groups.new.orders / totalOrders, 4) : null,
    repeat_rate: dates.size ? round(repeaters / dates.size, 4) : null,
    repeat_window_days: REPEAT_WINDOW_DAYS,
    repeat_customers: repeaters,
    window_customers: dates.size,
    cac: groups.new.customers > 0 && spend > 0 ? round(spend / groups.new.customers) : null,
    ad_spend: round(spend),
    orders_per_customer: totalCustomers > 0 ? round(totalOrders / totalCustomers, 2) : null,
    days_between_orders_median: median(gaps),
    totals: { orders: totalOrders, revenue: round(totalRevenue), customers: totalCustomers },
    period: { start, end },
  };
}

// ─── Lecturas ───
export async function getPatterns(clientId, orgId, { days = 90 } = {}) {
  const span = Math.max(7, Math.min(Number(days) || 90, 365));
  const end = todayColombia();
  const start = addDays(end, -(span - 1));
  const [rows, first] = await Promise.all([
    db.all(
      `SELECT local_date, local_hour, weekday, net_revenue FROM client_orders
        WHERE client_id = ? AND cancelled = 0 AND local_date BETWEEN ? AND ?`,
      [clientId, start, end],
    ),
    db.get('SELECT MIN(local_date) AS first_date FROM client_orders WHERE client_id = ? AND cancelled = 0', [clientId]),
  ]);
  const out = aggregatePatterns(rows, { start, end, firstDate: first?.first_date || null });
  out.period.requested_days = span;
  out.building = isBackfilling(clientId);
  return out;
}

export async function getCustomerMix(clientId, orgId, { start, end } = {}) {
  const today = todayColombia();
  let s = isIso(start) ? start : `${today.slice(0, 7)}-01`;
  let e = isIso(end) ? end : today;
  if (e > today) e = today;
  if (s > e) s = e;
  const windowStart = addDays(e, -(REPEAT_WINDOW_DAYS - 1));
  const [rangeRows, windowRows, spend] = await Promise.all([
    db.all(
      `SELECT customer_key, is_new_customer, net_revenue FROM client_orders
        WHERE client_id = ? AND cancelled = 0 AND local_date BETWEEN ? AND ?`,
      [clientId, s, e],
    ),
    db.all(
      `SELECT customer_key, local_date FROM client_orders
        WHERE client_id = ? AND cancelled = 0 AND customer_key IS NOT NULL AND local_date BETWEEN ? AND ?`,
      [clientId, windowStart, e],
    ),
    db.get(
      `SELECT COALESCE(SUM(fb_spend), 0) + COALESCE(SUM(ga_spend), 0) + COALESCE(SUM(tt_spend), 0) AS ad_spend
         FROM client_daily_metrics WHERE client_id = ? AND metric_date BETWEEN ? AND ?`,
      [clientId, s, e],
    ),
  ]);
  const out = aggregateCustomerMix({ rangeRows, windowRows, adSpend: spend?.ad_spend, start: s, end: e });
  out.building = isBackfilling(clientId);
  return out;
}

export default {
  bogotaParts, normalizeOrder, upsertOrders, backfillOrders, startBackfill, isBackfilling, ensureLedger,
  aggregatePatterns, aggregateCustomerMix, decideNewFlags, getPatterns, getCustomerMix,
};
