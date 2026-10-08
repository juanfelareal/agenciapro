/**
 * Client Financials (P&L por cliente) — modelo Tanteo adaptado a Orbit.
 *
 * Fórmulas (por día, luego se suman al mes):
 *   revenue        = shopify_net_revenue (venta neta confirmada)       [client_daily_metrics]
 *   revenue_total  = shopify_all_orders_revenue (todos los pedidos)     [referencia]
 *   cogs           = Σ units × costo vigente del producto (manual > Shopify);
 *                    si el producto no tiene costo → revenue_línea × default_cogs_rate (estimado)
 *   ad_spend       = fb_spend + ga_spend + tt_spend
 *   variable_costs = Σ %×base (venta neta ó venta neta − COGS) + Σ $ por pedido × pedidos
 *   fixed_costs    = Σ fijos activos del mes / días del mes (prorrateo diario)
 *   gross_profit   = revenue − cogs
 *   net_profit     = gross_profit − ad_spend − variable_costs − fixed_costs
 *   break_even_day = (fijos_día + ads_día) / (1 − (cogs + variables) / revenue)
 *
 * Las ventas por producto viven en client_product_daily_sales (units/revenue por variante y día);
 * el COGS se calcula EN VIVO con el costo actual, así un cambio de costo se refleja al instante.
 * daily_cogs se mantiene como marcador de "día sincronizado" (y total legacy).
 */
import db from '../config/database.js';
import ShopifyIntegration from '../integrations/shopify.js';

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
const round = (v, d = 0) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : 0);
const ratio = (a, b) => (b > 0 ? a / b : null);

export const DEFAULT_COGS_RATE = 0.35;
const PRODUCTS_STALE_MS = 24 * 60 * 60 * 1000;
const COGS_STALE_MS = 24 * 60 * 60 * 1000;
const COGS_RECENT_DAYS = 3;

// ─── Fechas (Colombia) ───
export const todayColombia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const rangeDays = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
export const monthBounds = (period) => {
  const [y, m] = period.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(daysInMonth).padStart(2, '0')}`, daysInMonth, year: y, month: m };
};
export const prevPeriod = (period) => {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};

// ─── Utilidades de concurrencia ───
const inflight = new Map();
/** Ejecuta `fn` una sola vez por `key` aunque lo pidan varios a la vez. */
function dedupe(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve()
    .then(fn)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
/** Espera hasta `ms`; si no termina, devuelve { done:false } y deja la promesa corriendo. */
async function waitUpTo(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ done: false }), ms); });
  const result = await Promise.race([
    promise.then((value) => ({ done: true, value })).catch((error) => ({ done: true, error })),
    timeout,
  ]);
  clearTimeout(timer);
  return result;
}

// ─── Acceso a datos básicos ───
export async function getShopifyCredentials(clientId) {
  const row = await db.get(
    'SELECT store_url, access_token, status, last_sync_at, last_error FROM client_shopify_credentials WHERE client_id = ?',
    [clientId]
  );
  if (!row || !row.store_url || !row.access_token) return null;
  return row;
}

export async function getFinancialSettings(clientId) {
  const row = await db.get('SELECT default_cogs_rate FROM client_financial_settings WHERE client_id = ?', [clientId]);
  const rate = row?.default_cogs_rate;
  return { default_cogs_rate: rate === null || rate === undefined ? DEFAULT_COGS_RATE : Number(rate) };
}

export async function saveFinancialSettings(clientId, orgId, { default_cogs_rate }) {
  const rate = Math.min(Math.max(num(default_cogs_rate), 0), 0.95);
  // db.query directo: la tabla no tiene columna id (db.run agregaría RETURNING id)
  await db.query(`
    INSERT INTO client_financial_settings (client_id, organization_id, default_cogs_rate, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (client_id) DO UPDATE SET default_cogs_rate = EXCLUDED.default_cogs_rate, updated_at = CURRENT_TIMESTAMP
  `, [clientId, orgId, rate]);
  return { default_cogs_rate: rate };
}

async function getProductsSyncState(clientId) {
  const row = await db.get(
    'SELECT COUNT(*) AS total, MAX(last_synced_at) AS last_synced_at FROM shopify_products WHERE client_id = ?',
    [clientId]
  );
  return { total: num(row?.total), last_synced_at: row?.last_synced_at || null };
}

// ─── Productos ───

/** Trae el catálogo de Shopify (variantes + costo por artículo + imagen) y lo guarda. Manual > Shopify. */
export async function syncProducts(clientId, orgId, shopify = null) {
  if (!shopify) {
    const cred = await getShopifyCredentials(clientId);
    if (!cred) throw new Error('Sin conexión Shopify activa');
    shopify = new ShopifyIntegration(cred.store_url, cred.access_token);
  }
  const products = await shopify.getProductsWithCosts();
  const now = new Date().toISOString();
  let withoutCost = 0;
  for (const p of products) {
    await db.run(`
      INSERT INTO shopify_products (
        organization_id, client_id, shopify_product_id, shopify_variant_id,
        sku, title, variant_title, price, cost, shopify_cost, cost_source, image_url, status, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shopify', ?, ?, ?)
      ON CONFLICT (client_id, shopify_variant_id) DO UPDATE SET
        shopify_product_id = EXCLUDED.shopify_product_id,
        sku = EXCLUDED.sku,
        title = EXCLUDED.title,
        variant_title = EXCLUDED.variant_title,
        price = EXCLUDED.price,
        shopify_cost = EXCLUDED.shopify_cost,
        cost = CASE WHEN shopify_products.cost_source = 'manual' THEN shopify_products.cost ELSE EXCLUDED.cost END,
        image_url = EXCLUDED.image_url,
        status = EXCLUDED.status,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = CURRENT_TIMESTAMP
    `, [
      orgId, clientId, String(p.shopify_product_id), String(p.shopify_variant_id),
      p.sku, p.title, p.variant_title, p.price, p.cost, p.cost, p.image_url, p.status, now,
    ]);
    if (p.cost === null) withoutCost++;
  }
  return { synced: products.length, without_cost: withoutCost, synced_at: now };
}

/**
 * Garantiza un catálogo razonablemente fresco.
 * - Nunca sincronizado → espera hasta `waitMs` (el COGS depende de los costos).
 * - Más de 24 h → dispara en segundo plano y responde con lo que hay.
 */
export async function ensureProductsFresh(clientId, orgId, { waitMs = 10000 } = {}) {
  const state = await getProductsSyncState(clientId);
  const ageMs = state.last_synced_at ? Date.now() - new Date(state.last_synced_at).getTime() : Infinity;
  if (state.total > 0 && ageMs < PRODUCTS_STALE_MS) return { ...state, syncing: false };

  const job = dedupe(`products:${clientId}`, () => syncProducts(clientId, orgId));
  job.catch((e) => console.error(`[financials] sync productos cliente ${clientId}:`, e.message));
  if (state.total === 0) {
    const r = await waitUpTo(job, waitMs);
    if (r.done && !r.error) return { total: r.value.synced, last_synced_at: r.value.synced_at, syncing: false };
    if (r.done && r.error) return { ...state, syncing: false, error: r.error.message };
    return { ...state, syncing: true };
  }
  return { ...state, syncing: true };
}

// ─── Ventas por producto / COGS ───

/** Guarda filas de ventas por variante (sustituye lo que había en esas fechas) y marca daily_cogs. */
async function storeProductSales(clientId, orgId, dates, rows, costMap, defaultRate) {
  if (!dates.length) return;
  const byDate = new Map(dates.map((d) => [d, []]));
  for (const r of rows) if (byDate.has(r.date)) byDate.get(r.date).push(r);

  await db.query(
    'DELETE FROM client_product_daily_sales WHERE client_id = $1 AND date = ANY($2::text[])',
    [clientId, dates]
  );
  for (const [date, list] of byDate) {
    let cogs = 0; let units = 0;
    for (const r of list) {
      const cost = costMap[r.shopify_variant_id];
      cogs += cost !== undefined && cost !== null ? r.units * cost : r.revenue * defaultRate;
      units += r.units;
      await db.run(`
        INSERT INTO client_product_daily_sales
          (organization_id, client_id, date, shopify_variant_id, shopify_product_id, title, variant_title, sku, units, revenue, orders, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (client_id, date, shopify_variant_id) DO UPDATE SET
          shopify_product_id = EXCLUDED.shopify_product_id, title = EXCLUDED.title, variant_title = EXCLUDED.variant_title,
          sku = EXCLUDED.sku, units = EXCLUDED.units, revenue = EXCLUDED.revenue, orders = EXCLUDED.orders, synced_at = CURRENT_TIMESTAMP
      `, [orgId, clientId, date, r.shopify_variant_id, r.shopify_product_id, r.title, r.variant_title, r.sku, r.units, r.revenue, r.orders]);
    }
    const orders = list.reduce((s, r) => s + num(r.orders), 0);
    await db.run(`
      INSERT INTO daily_cogs (organization_id, client_id, date, total_cogs, units_sold, orders_count, calculated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (client_id, date) DO UPDATE SET
        total_cogs = EXCLUDED.total_cogs, units_sold = EXCLUDED.units_sold, orders_count = EXCLUDED.orders_count, calculated_at = CURRENT_TIMESTAMP
    `, [orgId, clientId, date, round(cogs, 2), units, orders]);
  }
}

async function getCostMap(clientId) {
  const rows = await db.all('SELECT shopify_variant_id, cost FROM shopify_products WHERE client_id = ? AND cost IS NOT NULL', [clientId]);
  return Object.fromEntries(rows.map((r) => [String(r.shopify_variant_id), num(r.cost)]));
}

/** Trae de Shopify las ventas por producto del rango y las guarda (una sola lectura de pedidos). */
export async function syncProductSalesRange(clientId, orgId, start, end, shopify = null) {
  if (!shopify) {
    const cred = await getShopifyCredentials(clientId);
    if (!cred) throw new Error('Sin conexión Shopify activa');
    shopify = new ShopifyIntegration(cred.store_url, cred.access_token);
  }
  const [rows, costMap, settings] = await Promise.all([
    shopify.getProductSales(start, end), getCostMap(clientId), getFinancialSettings(clientId),
  ]);
  const dates = rangeDays(start, end);
  await storeProductSales(clientId, orgId, dates, rows.filter((r) => r.date >= start && r.date <= end), costMap, settings.default_cogs_rate);
  return { days: dates.length, rows: rows.length };
}

/**
 * Para el sync diario: ya tenemos los pedidos del día, no volvemos a pedirlos.
 * Si no hay productos con costo igual guardamos unidades (el COGS queda estimado).
 */
export async function recordProductSalesFromOrders(clientId, orgId, date, orders, shopify) {
  const rows = shopify.aggregateProductSales(orders).filter((r) => r.date === date);
  const [costMap, settings] = await Promise.all([getCostMap(clientId), getFinancialSettings(clientId)]);
  await storeProductSales(clientId, orgId, [date], rows, costMap, settings.default_cogs_rate);
  return { rows: rows.length };
}

/**
 * Revisa que todos los días del rango tengan ventas por producto registradas y que los
 * últimos 3 días no tengan más de 24 h. Si falta algo lo trae de Shopify (con dedupe).
 * Devuelve el estado sin bloquear más de `waitMs`.
 */
export async function ensureCogsFresh(clientId, orgId, start, end, { waitMs = 8000 } = {}) {
  const today = todayColombia();
  const effEnd = end > today ? today : end;
  if (start > effEnd) return { status: 'ok', refreshing: false, missing_days: 0 };

  const rows = await db.all('SELECT date, calculated_at FROM daily_cogs WHERE client_id = ? AND date >= ? AND date <= ?', [clientId, start, effEnd]);
  const have = new Map(rows.map((r) => [String(r.date).slice(0, 10), r.calculated_at]));
  const recentFrom = addDays(today, -(COGS_RECENT_DAYS - 1));
  const now = Date.now();
  const toRefresh = rangeDays(start, effEnd).filter((d) => {
    const at = have.get(d);
    if (!at) return true;
    return d >= recentFrom && now - new Date(at).getTime() > COGS_STALE_MS;
  });
  if (!toRefresh.length) return { status: 'ok', refreshing: false, missing_days: 0 };

  const from = toRefresh[0];
  const to = toRefresh[toRefresh.length - 1];
  const job = dedupe(`cogs:${clientId}:${from}:${to}`, () => syncProductSalesRange(clientId, orgId, from, to));
  job.catch((e) => console.error(`[financials] COGS cliente ${clientId} ${from}..${to}:`, e.message));
  const r = await waitUpTo(job, waitMs);
  const missingBefore = toRefresh.filter((d) => !have.has(d)).length;
  if (r.done && !r.error) return { status: 'ok', refreshing: false, missing_days: 0 };
  if (r.done && r.error) return { status: missingBefore === 0 ? 'ok' : (have.size ? 'partial' : 'missing'), refreshing: false, missing_days: missingBefore, error: r.error.message };
  return { status: missingBefore === 0 ? 'ok' : (have.size ? 'partial' : 'missing'), refreshing: true, missing_days: missingBefore };
}

// ─── Costos fijos y variables ───

export function fixedCostsForMonth(items, start, end) {
  return items.filter((fc) => {
    const s = fc.start_date ? String(fc.start_date).slice(0, 10) : null;
    const e = fc.end_date ? String(fc.end_date).slice(0, 10) : null;
    if (s && s > end) return false;
    if (e && e < start) return false;
    return true;
  });
}

export function variableCostsFor(items, revenue, cogs, orders) {
  let total = 0;
  for (const vc of items) {
    if ((vc.kind || 'percent') === 'per_order') total += orders * num(vc.amount);
    else {
      const base = vc.applies_to === 'net_revenue' ? revenue - cogs : revenue;
      total += base * (num(vc.percentage) / 100);
    }
  }
  return total;
}

// ─── Cálculo principal ───

/**
 * P&L del mes: totales, diario, acumulado, desglose, productos, costos.
 * `light=true` salta la verificación/sincronización contra Shopify (para el mes de comparación).
 */
export async function computeFinancials({ clientId, orgId, period, light = false }) {
  const { start, end, daysInMonth } = monthBounds(period);
  const today = todayColombia();
  const isCurrentMonth = today.slice(0, 7) === period;
  const isFuture = start > today;
  const effEnd = isFuture ? null : (end > today ? today : end);
  const daysElapsed = isFuture ? 0 : rangeDays(start, effEnd).length;

  const [shopifyCred, settings, fixedAll, variableAll] = await Promise.all([
    getShopifyCredentials(clientId),
    getFinancialSettings(clientId),
    db.all('SELECT id, category, name, amount, start_date, end_date, notes FROM client_fixed_costs WHERE client_id = ? AND organization_id = ? ORDER BY category, name', [clientId, orgId]),
    db.all('SELECT id, category, name, percentage, applies_to, kind, amount, is_active, notes FROM client_variable_costs WHERE client_id = ? AND organization_id = ? ORDER BY category, name', [clientId, orgId]),
  ]);
  const defaultRate = settings.default_cogs_rate;

  // Frescura de datos (productos + ventas por producto) — solo para el mes principal y si hay Shopify
  let productsState = await getProductsSyncState(clientId);
  let cogsState = { status: shopifyCred ? 'missing' : 'missing', refreshing: false, missing_days: daysElapsed };
  if (shopifyCred && !light && !isFuture) {
    productsState = await ensureProductsFresh(clientId, orgId);
    cogsState = await ensureCogsFresh(clientId, orgId, start, effEnd);
  } else if (shopifyCred && !isFuture) {
    const n = await db.get('SELECT COUNT(*) AS c FROM daily_cogs WHERE client_id = ? AND date >= ? AND date <= ?', [clientId, start, effEnd]);
    const c = num(n?.c);
    cogsState = { status: c >= daysElapsed ? 'ok' : (c > 0 ? 'partial' : 'missing'), refreshing: false, missing_days: Math.max(daysElapsed - c, 0) };
  }

  // Datos diarios
  const [metricRows, salesRows, productRows, orphanRows] = isFuture ? [[], [], [], []] : await Promise.all([
    db.all(`
      SELECT metric_date, shopify_net_revenue, shopify_revenue, shopify_all_orders_revenue, shopify_orders,
             fb_spend, ga_spend, tt_spend
      FROM client_daily_metrics WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?
    `, [clientId, start, effEnd]),
    db.all(`
      SELECT s.date,
             SUM(s.units) AS units,
             SUM(s.revenue) AS revenue,
             SUM(CASE WHEN p.cost IS NOT NULL THEN s.units * p.cost ELSE 0 END) AS cogs_known,
             SUM(CASE WHEN p.cost IS NULL THEN s.revenue ELSE 0 END) AS revenue_without_cost
      FROM client_product_daily_sales s
      LEFT JOIN shopify_products p ON p.client_id = s.client_id AND p.shopify_variant_id = s.shopify_variant_id
      WHERE s.client_id = ? AND s.date >= ? AND s.date <= ?
      GROUP BY s.date
    `, [clientId, start, effEnd]),
    db.all(`
      SELECT p.id, p.shopify_product_id, p.shopify_variant_id, p.title, p.variant_title, p.sku, p.price,
             p.cost, p.shopify_cost, p.cost_source, p.image_url, p.status, p.last_synced_at,
             COALESCE(s.units, 0) AS units, COALESCE(s.revenue, 0) AS revenue, COALESCE(s.orders, 0) AS orders
      FROM shopify_products p
      LEFT JOIN (
        SELECT shopify_variant_id, SUM(units) AS units, SUM(revenue) AS revenue, SUM(orders) AS orders
        FROM client_product_daily_sales WHERE client_id = ? AND date >= ? AND date <= ?
        GROUP BY shopify_variant_id
      ) s ON s.shopify_variant_id = p.shopify_variant_id
      WHERE p.client_id = ? AND p.organization_id = ?
    `, [clientId, start, effEnd, clientId, orgId]),
    db.all(`
      SELECT s.shopify_variant_id, MAX(s.shopify_product_id) AS shopify_product_id, MAX(s.title) AS title,
             MAX(s.variant_title) AS variant_title, MAX(s.sku) AS sku,
             SUM(s.units) AS units, SUM(s.revenue) AS revenue, SUM(s.orders) AS orders
      FROM client_product_daily_sales s
      WHERE s.client_id = ? AND s.date >= ? AND s.date <= ?
        AND NOT EXISTS (SELECT 1 FROM shopify_products p WHERE p.client_id = s.client_id AND p.shopify_variant_id = s.shopify_variant_id)
      GROUP BY s.shopify_variant_id
    `, [clientId, start, effEnd]),
  ]);

  const fixedItems = fixedCostsForMonth(fixedAll, start, end);
  const fixedMonthly = fixedItems.reduce((s, fc) => s + num(fc.amount), 0);
  const fixedPerDay = fixedMonthly / daysInMonth;
  const variableItems = variableAll.filter((vc) => vc.is_active === null || vc.is_active === undefined || Number(vc.is_active) === 1 || vc.is_active === true);

  const metricsByDate = new Map(metricRows.map((r) => [String(r.metric_date).slice(0, 10), r]));
  const salesByDate = new Map(salesRows.map((r) => [String(r.date).slice(0, 10), r]));

  const daily = (isFuture ? [] : rangeDays(start, effEnd)).map((date) => {
    const m = metricsByDate.get(date) || {};
    const s = salesByDate.get(date) || {};
    const revenue = num(m.shopify_net_revenue);
    const revenue_confirmed = num(m.shopify_revenue);
    const revenue_total = num(m.shopify_all_orders_revenue) || revenue_confirmed;
    const orders = num(m.shopify_orders);
    const cogs_known = num(s.cogs_known);
    const cogs_estimated = num(s.revenue_without_cost) * defaultRate;
    const cogs = cogs_known + cogs_estimated;
    const fb = num(m.fb_spend); const ga = num(m.ga_spend); const tt = num(m.tt_spend);
    const ad_spend = fb + ga + tt;
    const variable_costs = variableCostsFor(variableItems, revenue, cogs, orders);
    const fixed_costs = fixedPerDay;
    const gross_profit = revenue - cogs;
    const net_profit = gross_profit - ad_spend - variable_costs - fixed_costs;
    // Sin redondear: los totales y el acumulado se suman sobre estos valores y se redondean al final
    return {
      date, revenue, revenue_total, revenue_confirmed, orders,
      units: num(s.units), cogs, cogs_estimated, gross_profit,
      ad_spend, ad_spend_by_source: { fb, ga, tt },
      variable_costs, fixed_costs, net_profit,
      has_sales_data: salesByDate.has(date),
    };
  });
  const MONEY_KEYS = ['revenue', 'revenue_total', 'revenue_confirmed', 'cogs', 'cogs_estimated', 'gross_profit', 'ad_spend', 'variable_costs', 'fixed_costs', 'net_profit'];
  const roundDay = (d) => ({
    ...d,
    ...Object.fromEntries(MONEY_KEYS.map((k) => [k, round(d[k])])),
    ad_spend_by_source: { fb: round(d.ad_spend_by_source.fb), ga: round(d.ad_spend_by_source.ga), tt: round(d.ad_spend_by_source.tt) },
  });

  // Acumulado
  const acc = { revenue: 0, revenue_total: 0, orders: 0, cogs: 0, ad_spend: 0, variable_costs: 0, fixed_costs: 0, net_profit: 0, gross_profit: 0 };
  const cumulative = daily.map((d) => {
    for (const k of Object.keys(acc)) acc[k] += d[k];
    return { date: d.date, ...Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, round(v)])) };
  });

  // Totales
  const sum = (k) => daily.reduce((s, d) => s + d[k], 0);
  const t = {
    revenue: sum('revenue'), revenue_total: sum('revenue_total'), revenue_confirmed: sum('revenue_confirmed'), orders: sum('orders'), units: sum('units'),
    cogs: sum('cogs'), cogs_estimated: sum('cogs_estimated'), gross_profit: sum('gross_profit'), ad_spend: sum('ad_spend'),
    ad_spend_by_source: { fb: daily.reduce((s, d) => s + d.ad_spend_by_source.fb, 0), ga: daily.reduce((s, d) => s + d.ad_spend_by_source.ga, 0), tt: daily.reduce((s, d) => s + d.ad_spend_by_source.tt, 0) },
    variable_costs: sum('variable_costs'), fixed_costs: sum('fixed_costs'), net_profit: sum('net_profit'),
  };
  t.aov = ratio(t.revenue, t.orders);
  t.gross_margin = ratio(t.gross_profit, t.revenue);
  t.margin = ratio(t.net_profit, t.revenue);
  t.mer = ratio(t.revenue, t.ad_spend);
  t.roas = t.mer;
  t.cpa = ratio(t.ad_spend, t.orders);
  t.cogs_pct = ratio(t.cogs, t.revenue);
  t.ads_pct = ratio(t.ad_spend, t.revenue);
  for (const k of MONEY_KEYS) t[k] = round(t[k]);
  t.ad_spend_by_source = Object.fromEntries(Object.entries(t.ad_spend_by_source).map(([k, v]) => [k, round(v)]));

  // Desglose "a dónde se fue la plata" (sobre la venta neta)
  const share = (v) => (t.revenue > 0 ? v / t.revenue : null);
  const breakdown = {
    cogs: t.cogs, ads: t.ad_spend, variable: t.variable_costs, fixed: t.fixed_costs, profit: t.net_profit,
    cogs_pct: share(t.cogs), ads_pct: share(t.ad_spend), variable_pct: share(t.variable_costs), fixed_pct: share(t.fixed_costs), profit_pct: share(t.net_profit),
    ads_by_source: t.ad_spend_by_source,
  };

  // Proyección lineal y punto de equilibrio
  const contributionRatio = t.revenue > 0 ? 1 - (t.cogs + t.variable_costs) / t.revenue : null;
  const revenuePerDay = daysElapsed > 0 ? t.revenue / daysElapsed : 0;
  const adsPerDay = daysElapsed > 0 ? t.ad_spend / daysElapsed : 0;
  const contributionPerDay = daysElapsed > 0 ? (t.gross_profit - t.variable_costs - t.ad_spend) / daysElapsed : 0;
  const projection = {
    revenue_eom: round(revenuePerDay * daysInMonth),
    net_profit_eom: round(contributionPerDay * daysInMonth - fixedMonthly),
    revenue_per_day: round(revenuePerDay),
    net_profit_per_day: round(daysElapsed > 0 ? t.net_profit / daysElapsed : 0),
    days_remaining: Math.max(daysInMonth - daysElapsed, 0),
  };
  const breakEven = {
    contribution_ratio: contributionRatio,
    fixed_per_day: round(fixedPerDay),
    ads_per_day: round(adsPerDay),
    revenue_per_day: contributionRatio && contributionRatio > 0 ? round((fixedPerDay + adsPerDay) / contributionRatio) : null,
    revenue_per_day_without_ads: contributionRatio && contributionRatio > 0 ? round(fixedPerDay / contributionRatio) : null,
    current_revenue_per_day: round(revenuePerDay),
    reachable: contributionRatio !== null && contributionRatio > 0,
  };
  if (breakEven.revenue_per_day !== null) {
    breakEven.gap_per_day = round(breakEven.revenue_per_day - revenuePerDay);
    breakEven.revenue_month = round(breakEven.revenue_per_day * daysInMonth);
  }
  // ROAS de equilibrio según el margen real de los productos:
  //  - roas_min: cada $1 de pauta debe traer 1/margen_contribución para que la pauta no pierda (cubre producto + variables)
  //  - roas_target: además cubre los costos fijos del mes al ritmo de pauta actual
  if (contributionRatio && contributionRatio > 0) {
    breakEven.roas_min = Math.round((1 / contributionRatio) * 100) / 100;
    breakEven.roas_target = adsPerDay > 0 ? Math.round(((fixedPerDay + adsPerDay) / (contributionRatio * adsPerDay)) * 100) / 100 : null;
    breakEven.current_roas = adsPerDay > 0 ? Math.round((revenuePerDay / adsPerDay) * 100) / 100 : null;
    breakEven.revenue_for_roas_min = round(adsPerDay * daysInMonth * breakEven.roas_min); // venta del mes para que la pauta empate
  } else {
    breakEven.roas_min = null; breakEven.roas_target = null; breakEven.current_roas = null; breakEven.revenue_for_roas_min = null;
  }

  // Productos con ventas del mes
  const toProduct = (p, orphan = false) => {
    const units = num(p.units); const revenue = num(p.revenue);
    const hasCost = p.cost !== null && p.cost !== undefined;
    const cogs = hasCost ? units * num(p.cost) : revenue * defaultRate;
    const gross = revenue - cogs;
    return {
      id: p.id ?? null, shopify_product_id: p.shopify_product_id, shopify_variant_id: p.shopify_variant_id,
      title: p.title, variant_title: p.variant_title, sku: p.sku, image_url: p.image_url || null, status: p.status || null,
      price: p.price === null || p.price === undefined ? null : num(p.price),
      cost: hasCost ? num(p.cost) : null,
      shopify_cost: p.shopify_cost === null || p.shopify_cost === undefined ? null : num(p.shopify_cost),
      cost_source: hasCost ? (p.cost_source || 'shopify') : null,
      cost_estimated: !hasCost,
      units, orders: num(p.orders), revenue: round(revenue), cogs: round(cogs), gross_profit: round(gross),
      margin_pct: revenue > 0 ? round((gross / revenue) * 100, 1) : null,
      in_catalog: !orphan,
    };
  };
  const products = [...productRows.map((p) => toProduct(p)), ...orphanRows.map((p) => toProduct(p, true))]
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units || String(a.title).localeCompare(String(b.title)));
  const missingSold = products.filter((p) => p.cost_estimated && p.units > 0);

  // Días con venta pero sin pedidos registrados por producto (p. ej. fuera de la ventana de 60 días de Shopify)
  const daysRevenueNoSales = daily.filter((d) => d.revenue > 0 && !d.has_sales_data).length;
  let cogsStatus = cogsState.status;
  let cogsMessage = null;
  if (!shopifyCred) { cogsStatus = 'missing'; cogsMessage = 'Conecta Shopify para traer productos y calcular el costo de producto.'; }
  else if (productsState.total === 0 && productsState.syncing) { cogsMessage = 'Trayendo los productos de Shopify…'; }
  else if (productsState.total === 0) { cogsStatus = 'missing'; cogsMessage = productsState.error ? `No pudimos traer los productos: ${productsState.error}` : 'Aún no hay productos sincronizados.'; }
  else if (cogsState.refreshing) { cogsMessage = 'Calculando el costo de producto con los pedidos de Shopify…'; }
  else if (cogsState.error) { cogsMessage = `No pudimos leer los pedidos de Shopify: ${cogsState.error}`; }
  else if (daysRevenueNoSales > 0) { cogsStatus = cogsStatus === 'ok' ? 'partial' : cogsStatus; cogsMessage = `${daysRevenueNoSales} día${daysRevenueNoSales > 1 ? 's' : ''} con venta sin detalle de productos (Shopify solo entrega pedidos de los últimos 60 días).`; }
  else if (missingSold.length > 0) { cogsMessage = `${missingSold.length} producto${missingSold.length > 1 ? 's' : ''} vendido${missingSold.length > 1 ? 's' : ''} sin costo: se estiman al ${Math.round(defaultRate * 100)} % del precio.`; }

  // Meta de venta del mes (objetivo "revenue" definido en Growth para este periodo)
  let goal = null;
  try {
    const g = await db.get(
      "SELECT id, conservador, base, optimista FROM growth_objectives WHERE client_id = ? AND organization_id = ? AND period = ? AND metric = 'revenue'",
      [clientId, orgId, period]
    );
    if (g) goal = { id: g.id, conservador: num(g.conservador), base: num(g.base), optimista: num(g.optimista) };
  } catch (e) {
    console.warn('financials: no se pudo leer la meta del mes:', e.message);
  }

  return {
    period, start, end: effEnd || end, today, is_current_month: isCurrentMonth, is_future: isFuture,
    days_in_month: daysInMonth, days_elapsed: daysElapsed,
    revenue_basis: 'net_confirmed',
    goal,
    totals: t, daily: daily.map(roundDay), cumulative, breakdown, projection, break_even: breakEven,
    fixed_costs: {
      monthly_total: round(fixedMonthly), per_day: round(fixedPerDay), prorated: t.fixed_costs,
      items: fixedItems.map((fc) => ({ ...fc, amount: num(fc.amount), per_day: round(num(fc.amount) / daysInMonth) })),
      all_items: fixedAll.map((fc) => ({ ...fc, amount: num(fc.amount) })),
    },
    variable_costs: {
      total: t.variable_costs,
      items: variableAll.map((vc) => {
        const active = vc.is_active === null || vc.is_active === undefined || Number(vc.is_active) === 1 || vc.is_active === true;
        const amount = active ? variableCostsFor([vc], t.revenue, t.cogs, t.orders) : 0;
        return { ...vc, kind: vc.kind || 'percent', percentage: vc.percentage === null ? null : num(vc.percentage), amount_per_order: vc.amount === null ? null : num(vc.amount), is_active: active, amount: round(amount) };
      }),
    },
    products,
    products_count: products.filter((p) => p.in_catalog).length,
    missing_cost_count: missingSold.length,
    missing_cost_catalog: products.filter((p) => p.in_catalog && p.cost_estimated).length,
    default_cogs_rate: defaultRate,
    shopify: shopifyCred ? { connected: true, store_url: shopifyCred.store_url, status: shopifyCred.status, last_sync_at: shopifyCred.last_sync_at, last_error: shopifyCred.last_error } : { connected: false },
    products_synced_at: productsState.last_synced_at,
    products_syncing: !!productsState.syncing,
    cogs_status: cogsStatus,
    cogs_message: cogsMessage,
    cogs_refreshing: !!cogsState.refreshing || !!productsState.syncing,
  };
}
