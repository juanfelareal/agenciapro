/**
 * Laboratorio financiero (por cliente, `client_financial_settings.lab_enabled`):
 *   - Inventario: existencias por variante (sincronizadas con el sync de 5 min) + proyección según ventas.
 *   - Reservas: cuánto ir guardando para proveedores que se pagan después (transportadora, 3PL…),
 *     a partir de costos variables marcados con `reserve_provider`, menos pagos registrados.
 */
import db from '../config/database.js';
import { getStoreIntegration } from '../integrations/storeIntegration.js';
import { variableCostsFor, todayColombia, monthBounds, rangeDays } from './clientFinancialsService.js';

const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const round = (v) => Math.round(num(v));
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

export async function isLabEnabled(clientId) {
  const row = await db.get('SELECT lab_enabled FROM client_financial_settings WHERE client_id = ?', [clientId]);
  return Number(row?.lab_enabled) === 1;
}

export async function setLabEnabled(clientId, orgId, enabled) {
  await db.query(`
    INSERT INTO client_financial_settings (client_id, organization_id, lab_enabled, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (client_id) DO UPDATE SET lab_enabled = EXCLUDED.lab_enabled, updated_at = CURRENT_TIMESTAMP
  `, [clientId, orgId, enabled ? 1 : 0]);
  return { lab_enabled: Boolean(enabled) };
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

/** Trae existencias por variante desde la tienda y las guarda en shopify_products. */
export async function syncInventory(clientId, { store = null } = {}) {
  let integration = store;
  if (!integration) {
    const info = await getStoreIntegration(clientId);
    if (!info) throw new Error('Sin tienda conectada');
    integration = info.store;
  }
  if (typeof integration.getInventoryLevels !== 'function') return { synced: 0, reason: 'la plataforma no expone inventario' };
  const levels = await integration.getInventoryLevels();
  const now = new Date().toISOString();
  let synced = 0;
  for (const l of levels) {
    const r = await db.run(
      'UPDATE shopify_products SET inventory_quantity = ?, inventory_tracked = ?, inventory_synced_at = ? WHERE client_id = ? AND shopify_variant_id = ?',
      [l.quantity, l.tracked ? 1 : 0, now, clientId, String(l.variant_id)],
    );
    synced += r.changes || 0;
  }
  return { synced, levels: levels.length, synced_at: now };
}

/**
 * Inventario + proyección según ventas de los últimos `windowDays` días.
 * Estados: sin_stock (0), critico (< 14 días), bajo (< 30), ok, sin_ventas (stock sin rotación).
 */
export async function setInventoryHidden(clientId, productId, hidden) {
  const r = await db.run('UPDATE shopify_products SET inventory_hidden = ? WHERE id = ? AND client_id = ?', [hidden ? 1 : 0, productId, clientId]);
  if (!r.changes) throw new Error('Producto no encontrado');
  return { id: Number(productId), hidden: Boolean(hidden) };
}

export async function computeInventory(clientId, orgId, { windowDays = 30, horizonDays = 30, includeHidden = false } = {}) {
  const today = todayColombia();
  const from = addDays(today, -(windowDays - 1));
  const from90 = addDays(today, -89);
  const [products, sales30, sales90, state] = await Promise.all([
    db.all(`
      SELECT id, shopify_product_id, shopify_variant_id, sku, title, variant_title, price, cost, image_url, status,
             inventory_quantity, inventory_tracked, inventory_synced_at, COALESCE(inventory_hidden, 0) AS inventory_hidden
      FROM shopify_products WHERE client_id = ? AND organization_id = ?
    `, [clientId, orgId]),
    db.all('SELECT shopify_variant_id, SUM(units) AS units, SUM(revenue) AS revenue, SUM(orders) AS orders FROM client_product_daily_sales WHERE client_id = ? AND date >= ? AND date <= ? GROUP BY shopify_variant_id', [clientId, from, today]),
    db.all('SELECT shopify_variant_id, SUM(units) AS units FROM client_product_daily_sales WHERE client_id = ? AND date >= ? AND date <= ? GROUP BY shopify_variant_id', [clientId, from90, today]),
    db.get('SELECT MAX(inventory_synced_at) AS synced_at, COUNT(*) FILTER (WHERE inventory_quantity IS NOT NULL) AS with_stock FROM shopify_products WHERE client_id = ?', [clientId]),
  ]);
  const s30 = Object.fromEntries(sales30.map((r) => [String(r.shopify_variant_id), r]));
  const s90 = Object.fromEntries(sales90.map((r) => [String(r.shopify_variant_id), num(r.units)]));

  const allItems = products
    .filter((p) => p.status === 'active' || p.status === null || p.status === 'publish')
    .map((p) => {
      const qty = p.inventory_quantity === null || p.inventory_quantity === undefined ? null : Number(p.inventory_quantity);
      const u30 = num(s30[p.shopify_variant_id]?.units);
      const u90 = num(s90[p.shopify_variant_id]);
      const perDay = u30 / windowDays;
      const perDay90 = u90 / 90;
      const rate = perDay > 0 ? perDay : perDay90; // si no vendió en 30 días, usa el ritmo de 90
      const daysOfStock = qty === null ? null : qty <= 0 ? 0 : (rate > 0 ? qty / rate : null);
      const stockoutDate = daysOfStock !== null && qty > 0 ? addDays(today, Math.floor(daysOfStock)) : (qty === 0 ? today : null);
      const needHorizon = Math.max(Math.ceil(rate * horizonDays) - (qty || 0), 0);
      let status = 'ok';
      if (qty === null) status = 'sin_dato';
      else if (qty <= 0) status = 'sin_stock';
      else if (rate === 0) status = 'sin_ventas';
      else if (daysOfStock < 14) status = 'critico';
      else if (daysOfStock < 30) status = 'bajo';
      return {
        id: p.id, shopify_product_id: p.shopify_product_id, shopify_variant_id: p.shopify_variant_id,
        sku: p.sku, title: p.title, variant_title: p.variant_title, image_url: p.image_url,
        price: num(p.price), cost: p.cost === null ? null : num(p.cost),
        inventory_quantity: qty, inventory_tracked: Number(p.inventory_tracked) === 1,
        units_30d: u30, revenue_30d: num(s30[p.shopify_variant_id]?.revenue), units_90d: u90,
        units_per_day: Math.round(rate * 100) / 100,
        days_of_stock: daysOfStock === null ? null : Math.round(daysOfStock),
        stockout_date: stockoutDate,
        units_to_restock: needHorizon,
        inventory_value_cost: qty > 0 && p.cost !== null ? round(qty * num(p.cost)) : (qty !== null && p.cost !== null ? 0 : null),
        inventory_value_price: qty > 0 ? round(qty * num(p.price)) : 0,
        hidden: Number(p.inventory_hidden) === 1,
        status,
      };
    });
  const hiddenCount = allItems.filter((i) => i.hidden).length;
  const items = includeHidden ? allItems : allItems.filter((i) => !i.hidden);

  const sum = (k, f = () => true) => items.filter(f).reduce((t, i) => t + num(i[k]), 0);
  const summary = {
    products: items.length,
    units_in_stock: sum('inventory_quantity', (i) => i.inventory_quantity > 0),
    inventory_value_cost: sum('inventory_value_cost'),
    inventory_value_price: sum('inventory_value_price'),
    units_sold_30d: sum('units_30d'),
    sin_stock: items.filter((i) => i.status === 'sin_stock').length,
    critico: items.filter((i) => i.status === 'critico').length,
    bajo: items.filter((i) => i.status === 'bajo').length,
    sin_ventas: items.filter((i) => i.status === 'sin_ventas').length,
    units_to_restock: sum('units_to_restock'),
    restock_cost: round(items.reduce((t, i) => t + (i.cost !== null ? i.units_to_restock * i.cost : 0), 0)),
    hidden_count: hiddenCount,
    synced_at: state?.synced_at || null,
    window_days: windowDays,
    horizon_days: horizonDays,
  };
  const order = { sin_stock: 0, critico: 1, bajo: 2, ok: 3, sin_ventas: 4, sin_dato: 5 };
  items.sort((a, b) => (order[a.status] - order[b.status]) || (b.units_30d - a.units_30d));
  return { items, summary, today };
}

// ---------------------------------------------------------------------------
// Reservas (transportadora, 3PL, …)
// ---------------------------------------------------------------------------

/** Acumulado del mes para cada proveedor con reserva, pagos y pendiente por guardar. */
export async function computeReserves(clientId, orgId, period) {
  const { start, end, daysInMonth } = monthBounds(period);
  const today = todayColombia();
  const effEnd = end > today ? today : end;
  const isFuture = start > today;
  const daysElapsed = isFuture ? 0 : rangeDays(start, effEnd).length;

  const CARRIER_RE = /coordinadora|transport|env[ií]o|servientrega|interrapid|tcc\b|envia\b|deprisa|mensajer|domicilio/i;
  const [rules, metrics, sales, payments] = await Promise.all([
    db.all(`SELECT id, category, name, percentage, applies_to, kind, amount, is_active, notes, reserve_provider FROM client_variable_costs WHERE client_id = ? AND organization_id = ? AND reserve_provider IS NOT NULL AND reserve_provider <> '' ORDER BY reserve_provider, name`, [clientId, orgId]),
    isFuture ? null : db.get(`
      SELECT COALESCE(SUM(shopify_net_revenue), 0) + COALESCE(SUM(whatsapp_revenue), 0) AS revenue,
             COALESCE(SUM(shopify_orders), 0) + COALESCE(SUM(whatsapp_orders), 0) AS orders,
             COALESCE(SUM(shopify_shipping_collected), 0) AS shipping_collected
      FROM client_daily_metrics WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?
    `, [clientId, start, effEnd]),
    isFuture ? null : db.get(`
      SELECT COALESCE(SUM(s.units), 0) AS units,
             COALESCE(SUM(CASE WHEN p.cost IS NOT NULL THEN s.units * p.cost ELSE 0 END), 0) AS cogs
      FROM client_product_daily_sales s LEFT JOIN shopify_products p ON p.client_id = s.client_id AND p.shopify_variant_id = s.shopify_variant_id
      WHERE s.client_id = ? AND s.date >= ? AND s.date <= ?
    `, [clientId, start, effEnd]),
    db.all('SELECT id, provider, period, amount, paid_at, notes, created_at FROM client_reserve_payments WHERE client_id = ? AND period = ? ORDER BY paid_at DESC, id DESC', [clientId, period]),
  ]);

  const revenue = num(metrics?.revenue); const orders = num(metrics?.orders);
  const shippingCollected = num(metrics?.shipping_collected);
  const units = num(sales?.units); const cogs = num(sales?.cogs);
  const providers = {};
  for (const r of rules) {
    const active = r.is_active === null || r.is_active === undefined || Number(r.is_active) === 1 || r.is_active === true;
    const accrued = active && !isFuture ? variableCostsFor([r], revenue, cogs, orders, { units, dayFraction: daysElapsed / daysInMonth }) : 0;
    const p = providers[r.reserve_provider] || (providers[r.reserve_provider] = { provider: r.reserve_provider, rules: [], accrued: 0, paid: 0, pending: 0, projected: 0 });
    p.rules.push({ ...r, kind: r.kind || 'percent', amount: r.amount === null ? null : num(r.amount), percentage: num(r.percentage), accrued: round(accrued), is_active: active });
    p.accrued += accrued;
  }
  for (const pay of payments) {
    const p = providers[pay.provider] || (providers[pay.provider] = { provider: pay.provider, rules: [], accrued: 0, paid: 0, pending: 0, projected: 0 });
    p.paid += num(pay.amount);
  }
  const list = Object.values(providers).map((p) => {
    const isCarrier = CARRIER_RE.test(p.provider);
    return {
      ...p,
      is_carrier: isCarrier,
      accrued: round(p.accrued),
      paid: round(p.paid),
      pending: round(p.accrued - p.paid),
      projected: round(daysElapsed > 0 ? (p.accrued / daysElapsed) * daysInMonth : 0),
      per_day: round(daysElapsed > 0 ? p.accrued / daysElapsed : 0),
      // Transportadora: lo que cobramos de envío a los clientes vs. lo que reservamos
      shipping_collected: isCarrier ? round(shippingCollected) : null,
      shipping_coverage: isCarrier && p.accrued > 0 ? shippingCollected / p.accrued : null,
      shipping_net: isCarrier ? round(shippingCollected - p.accrued) : null,
    };
  });
  const totals = list.reduce((t, p) => ({ accrued: t.accrued + p.accrued, paid: t.paid + p.paid, pending: t.pending + p.pending, projected: t.projected + p.projected }), { accrued: 0, paid: 0, pending: 0, projected: 0 });
  return { period, start, end: effEnd, days_elapsed: daysElapsed, days_in_month: daysInMonth, base: { revenue: round(revenue), orders, units, cogs: round(cogs), shipping_collected: round(shippingCollected), shipping_per_order: orders > 0 ? round(shippingCollected / orders) : 0 }, providers: list, payments, totals: { ...totals, shipping_collected: round(shippingCollected) } };
}

/** Renombra un proveedor (tarifas y pagos) */
export async function renameReserveProvider(clientId, orgId, from, to) {
  const name = String(to || '').trim();
  if (!name) throw new Error('Nombre requerido');
  await db.run('UPDATE client_variable_costs SET reserve_provider = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND organization_id = ? AND reserve_provider = ?', [name, clientId, orgId, from]);
  await db.run('UPDATE client_reserve_payments SET provider = ? WHERE client_id = ? AND provider = ?', [name, clientId, from]);
  return { provider: name };
}

export async function addReservePayment({ clientId, orgId, provider, period, amount, paidAt, notes, createdBy }) {
  if (!provider || !/^\d{4}-\d{2}$/.test(period || '')) throw new Error('provider y period (YYYY-MM) son requeridos');
  const r = await db.run(
    'INSERT INTO client_reserve_payments (organization_id, client_id, provider, period, amount, paid_at, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [orgId, clientId, provider, period, num(amount), paidAt || todayColombia(), notes || null, createdBy || null],
  );
  return { id: r.lastInsertRowid };
}

export async function deleteReservePayment(clientId, id) {
  await db.run('DELETE FROM client_reserve_payments WHERE id = ? AND client_id = ?', [id, clientId]);
  return { deleted: true };
}

export default { isLabEnabled, setLabEnabled, syncInventory, computeInventory, setInventoryHidden, renameReserveProvider, computeReserves, addReservePayment, deleteReservePayment };
