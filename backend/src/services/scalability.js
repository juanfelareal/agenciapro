/**
 * Escalabilidad (laboratorio financiero): Break even ROAS vs Blended ROAS.
 *
 * Método de Ramsés (@ramDTC · comercionline.com/presentacion), tal cual, sin más variables:
 *   Ticket promedio          = Σ facturación ÷ Σ pedidos (últimos 90 días)
 *   Costo promedio por pedido = (mercancía 90 días + logística 90 días) ÷ pedidos 90 días
 *   BER                      = ticket ÷ (ticket − costo por pedido)
 *   Blended ROAS             = facturación total de la tienda ÷ gasto total en publicidad
 *   Escalabilidad            = la distancia entre el BER y el Blended ROAS
 *
 * Mapeo a Orbit (dos bases, `basis`):
 *   'net' (por defecto, SIN IVA): facturación = shopify_net_revenue (neta de impuestos y descuentos)
 *                                 + shopify_shipping_collected (envío que paga el cliente) + whatsapp_revenue.
 *                                 Mercancía, logística y ads ya están sin IVA → todo en la misma base;
 *                                 el IVA no es ingreso (de cada $119 facturados, $19 son de la DIAN).
 *   'gross' (Ramsés literal, CON IVA): facturación = shopify_all_orders_revenue (si es 0, shopify_revenue)
 *                                 + whatsapp_revenue.
 *   pedidos       = shopify_orders + whatsapp_orders
 *   mercancía     = COGS en vivo (Σ units × costo + venta sin costo × default_cogs_rate);
 *                   sin ventas por producto en la ventana → facturación × default_cogs_rate
 *   logística     = SOLO los costos variables activos cuya categoría/nombre suene a logística
 *   publicidad    = fb_spend + ga_spend + tt_spend
 *
 * No usa el BE ROAS de computeFinancials (ese descuenta todas las variables).
 */
import db from '../config/database.js';
import {
  todayColombia, addDays, rangeDays, monthBounds,
  getShopifyCredentials, getFinancialSettings, ensureCogsFresh, variableCostsFor,
} from './clientFinancialsService.js';

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);
const round = (v, d = 0) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const ratio2 = (a, b) => (b > 0 ? round(a / b, 2) : null);

export const BER_WINDOW_DAYS = 90;
const LOAD_DAYS = 180;
export const LOGISTICS_RE = /log[ií]st|env[ií]o|transport|3pl|bodega|almacen|fulfil|empaque/i;
export const SCALE_MARGIN = 1.15; // Blended ≥ BER × 1.15 → escalar
export const BASES = ['net', 'gross'];
export const normalizeBasis = (b) => (BASES.includes(String(b || '').toLowerCase()) ? String(b).toLowerCase() : 'net');
const BASIS_LABEL = {
  net: 'sin IVA · venta neta + envío recaudado',
  gross: 'con IVA · facturación total',
};

export const berBenchmark = (ber) => (ber === null || ber === undefined ? null : ber < 1.5 ? 'bueno' : ber < 1.8 ? 'decente' : 'alto');

export const isLogisticsCost = (vc) => LOGISTICS_RE.test(String(vc?.category || '')) || LOGISTICS_RE.test(String(vc?.name || ''));

const isActive = (vc) => vc.is_active === null || vc.is_active === undefined || Number(vc.is_active) === 1 || vc.is_active === true;

/**
 * BER de una ventana ya totalizada.
 * `w` = { revenue, orders, units, cogs_known, revenue_without_cost, whatsapp_revenue, has_sales }.
 */
export function berForWindow(w, { logisticsItems, defaultRate, daysInMonth, windowDays = BER_WINDOW_DAYS }) {
  const revenue = num(w.revenue);
  const orders = num(w.orders);
  const estimatedFromSales = (num(w.revenue_without_cost) + num(w.whatsapp_revenue)) * defaultRate;
  const merchandise = w.has_sales ? num(w.cogs_known) + estimatedFromSales : revenue * defaultRate;
  const merchandiseEstimated = w.has_sales ? estimatedFromSales : merchandise;
  const logistics = variableCostsFor(logisticsItems, revenue, merchandise, orders, {
    units: num(w.units), dayFraction: windowDays / daysInMonth, grossRevenue: revenue,
  });
  const ticket = orders > 0 ? revenue / orders : null;
  const costPerOrder = orders > 0 ? (merchandise + logistics) / orders : null;
  const margin = ticket !== null ? ticket - costPerOrder : null;
  const ber = margin !== null && margin > 0 ? round(ticket / margin, 2) : null;
  return {
    value: ber,
    benchmark: berBenchmark(ber),
    reachable: margin !== null && margin > 0,
    ticket: ticket === null ? null : round(ticket),
    cost_per_order: costPerOrder === null ? null : round(costPerOrder),
    merchandise_90d: round(merchandise),
    merchandise_estimated_90d: round(merchandiseEstimated),
    logistics_90d: round(logistics),
    orders_90d: orders,
    revenue_90d: round(revenue),
    units_90d: num(w.units),
    cogs_estimated: !w.has_sales || num(w.cogs_known) === 0,
    cogs_estimated_share: merchandise > 0 ? round(merchandiseEstimated / merchandise, 2) : null,
  };
}

/**
 * @param {{ clientId:number, orgId:number, period?:string }} args
 * period 'YYYY-MM' (default mes actual, Colombia); fin = min(fin de mes, hoy).
 */
export async function getScalability({ clientId, orgId, period, basis: basisIn }) {
  const basis = normalizeBasis(basisIn);
  const today = todayColombia();
  const p = /^\d{4}-\d{2}$/.test(period || '') ? period : today.slice(0, 7);
  const { start, end, daysInMonth } = monthBounds(p);
  const fin = end > today ? today : end;
  const isCurrentMonth = today.slice(0, 7) === p;
  const isFuture = start > today;

  const loadStart = addDays(fin, -(LOAD_DAYS - 1));
  const berStart = addDays(fin, -(BER_WINDOW_DAYS - 1));

  const [shopifyCred, settings, variableAll] = await Promise.all([
    getShopifyCredentials(clientId),
    getFinancialSettings(clientId),
    db.all('SELECT id, category, name, percentage, applies_to, kind, amount, is_active, reserve_provider FROM client_variable_costs WHERE client_id = ? AND organization_id = ?', [clientId, orgId]),
  ]);
  const defaultRate = settings.default_cogs_rate;
  const logisticsItems = variableAll.filter((vc) => isActive(vc) && isLogisticsCost(vc));

  // Frescura del COGS para la ventana de 90 días (no bloquea más de ~8 s)
  let cogsState = { status: 'missing', refreshing: false, missing_days: 0 };
  if (shopifyCred) {
    try {
      cogsState = await ensureCogsFresh(clientId, orgId, berStart, fin, { waitMs: 8000 });
    } catch (e) {
      cogsState = { status: 'missing', refreshing: false, missing_days: 0, error: e.message };
    }
  }

  // Una sola pasada por las dos tablas (180 días). shopify_shipping_collected puede no existir en BDs viejas → 0.
  const metricsQuery = async () => {
    const cols = 'metric_date, shopify_revenue, shopify_net_revenue, shopify_all_orders_revenue, shopify_orders, fb_spend, ga_spend, tt_spend, whatsapp_revenue, whatsapp_orders';
    try {
      return await db.all(`SELECT ${cols}, shopify_shipping_collected FROM client_daily_metrics WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?`, [clientId, loadStart, fin]);
    } catch (e) {
      if (!/shopify_shipping_collected/i.test(e.message)) throw e;
      return db.all(`SELECT ${cols} FROM client_daily_metrics WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?`, [clientId, loadStart, fin]);
    }
  };
  const [metricRows, salesRows] = await Promise.all([
    metricsQuery(),
    db.all(`
      SELECT s.date,
             SUM(s.units) AS units,
             SUM(CASE WHEN p.cost IS NOT NULL THEN s.units * p.cost ELSE 0 END) AS cogs_known,
             SUM(CASE WHEN p.cost IS NULL THEN s.revenue ELSE 0 END) AS revenue_without_cost
      FROM client_product_daily_sales s
      LEFT JOIN shopify_products p ON p.client_id = s.client_id AND p.shopify_variant_id = s.shopify_variant_id
      WHERE s.client_id = ? AND s.date >= ? AND s.date <= ?
      GROUP BY s.date
    `, [clientId, loadStart, fin]),
  ]);
  const metricsByDate = new Map(metricRows.map((r) => [String(r.metric_date).slice(0, 10), r]));
  const salesByDate = new Map(salesRows.map((r) => [String(r.date).slice(0, 10), r]));

  const days = rangeDays(loadStart, fin).map((date) => {
    const m = metricsByDate.get(date) || {};
    const s = salesByDate.get(date);
    const whatsapp = num(m.whatsapp_revenue);
    const revenue = basis === 'gross'
      ? (num(m.shopify_all_orders_revenue) || num(m.shopify_revenue)) + whatsapp
      : num(m.shopify_net_revenue) + num(m.shopify_shipping_collected) + whatsapp;
    return {
      date,
      revenue,
      orders: num(m.shopify_orders) + num(m.whatsapp_orders),
      ad_spend: num(m.fb_spend) + num(m.ga_spend) + num(m.tt_spend),
      units: num(s?.units),
      cogs_known: num(s?.cogs_known),
      revenue_without_cost: num(s?.revenue_without_cost),
      whatsapp_revenue: whatsapp,
      has_sales: s ? 1 : 0,
    };
  });
  const idx = new Map(days.map((d, i) => [d.date, i]));
  const KEYS = ['revenue', 'orders', 'ad_spend', 'units', 'cogs_known', 'revenue_without_cost', 'whatsapp_revenue', 'has_sales'];
  // Sumas prefijas para ventanas móviles: prefix[i] = Σ days[0..i-1]
  const prefix = [Object.fromEntries(KEYS.map((k) => [k, 0]))];
  for (const d of days) prefix.push(Object.fromEntries(KEYS.map((k) => [k, prefix[prefix.length - 1][k] + d[k]])));
  const windowSum = (fromDate, toDate) => {
    const a = Math.max(idx.get(fromDate) ?? 0, 0);
    const b = idx.get(toDate);
    if (b === undefined || b < a) return Object.fromEntries(KEYS.map((k) => [k, 0]));
    return Object.fromEntries(KEYS.map((k) => [k, prefix[b + 1][k] - prefix[a][k]]));
  };
  const windowFor = (toDate, n) => windowSum(addDays(toDate, -(n - 1)), toDate);
  const berAt = (toDate) => {
    const w = windowFor(toDate, BER_WINDOW_DAYS);
    return berForWindow(w, { logisticsItems, defaultRate, daysInMonth: monthBounds(toDate.slice(0, 7)).daysInMonth });
  };

  // Serie: un punto por día de los últimos 90 días hasta `fin`
  const series = rangeDays(berStart, fin).map((date) => {
    const d = days[idx.get(date)];
    const w7 = windowFor(date, 7);
    return {
      date,
      ber: berAt(date).value,
      blended_7d: ratio2(w7.revenue, w7.ad_spend),
      blended_day: ratio2(d.revenue, d.ad_spend),
      revenue_total: round(d.revenue),
      ad_spend: round(d.ad_spend),
      orders: d.orders,
      in_period: date >= start && date <= fin,
    };
  });

  // BER de la ventana de 90 días que termina en `fin`
  const berMain = berForWindow(windowFor(fin, BER_WINDOW_DAYS), { logisticsItems, defaultRate, daysInMonth });
  const ber = {
    ...berMain,
    window: { start: berStart, end: fin, days: BER_WINDOW_DAYS },
    cogs_status: cogsState.status,
    cogs_refreshing: !!cogsState.refreshing,
    default_cogs_rate: defaultRate,
    logistics_items: logisticsItems.map((vc) => ({ id: vc.id, category: vc.category, name: vc.name, kind: vc.kind || 'percent', amount: vc.amount === null ? null : num(vc.amount), percentage: vc.percentage === null ? null : num(vc.percentage), reserve_provider: vc.reserve_provider || null })),
  };

  // Blended ROAS del periodo (hasta fin), últimos 7 y 30 días
  const mtd = isFuture ? { revenue: 0, ad_spend: 0, orders: 0 } : windowSum(start, fin);
  const l7 = windowFor(fin, 7);
  const l30 = windowFor(fin, 30);
  const blended = {
    mtd: ratio2(mtd.revenue, mtd.ad_spend),
    revenue_total_mtd: round(mtd.revenue),
    ad_spend_mtd: round(mtd.ad_spend),
    orders_mtd: mtd.orders,
    last7: ratio2(l7.revenue, l7.ad_spend),
    last30: ratio2(l30.revenue, l30.ad_spend),
  };

  // Brecha = espacio para escalar
  let gap = { value: null, pct: null, status: null };
  if (ber.value !== null && blended.mtd !== null) {
    const value = round(blended.mtd - ber.value, 2);
    gap = {
      value,
      pct: round(value / ber.value, 4),
      status: blended.mtd >= ber.value * SCALE_MARGIN ? 'escalar' : blended.mtd >= ber.value ? 'sostener' : 'frenar',
      scale_from: round(ber.value * SCALE_MARGIN, 2),
    };
  }

  // Avisos
  const warnings = [];
  if (ber.orders_90d === 0) warnings.push('Sin pedidos registrados en los últimos 90 días: todavía no hay BER.');
  else if (!ber.reachable) warnings.push('El costo por pedido supera el ticket promedio: no hay ROAS que alcance. Revisa precios o costos.');
  if (ber.orders_90d > 0 && ber.logistics_90d === 0) warnings.push('Logística en $0: carga la tarifa real de Coordinadora y Simplistics en Reservas para que el BER sea real');
  if (ber.orders_90d > 0 && ber.cogs_estimated) warnings.push(`Costo de mercancía estimado al ${Math.round(defaultRate * 100)} % de la venta: carga el costo de tus productos para que el BER sea real`);
  else if (ber.orders_90d > 0 && ber.cogs_estimated_share !== null && ber.cogs_estimated_share >= 0.25) warnings.push(`El ${Math.round(ber.cogs_estimated_share * 100)} % de la mercancía está estimada al ${Math.round(defaultRate * 100)} %: hay productos vendidos sin costo cargado`);
  if (cogsState.refreshing) warnings.push('Estamos trayendo los pedidos de la tienda para afinar el costo de mercancía…');
  if (cogsState.error) warnings.push(`No pudimos leer los pedidos de la tienda: ${cogsState.error}`);
  if (!isFuture && blended.mtd === null) warnings.push('Sin inversión en pauta registrada en el mes: no hay Blended ROAS que comparar.');
  if (isFuture) warnings.push('Ese mes todavía no ha empezado: se muestra el BER a hoy.');

  return {
    client_id: Number(clientId),
    basis,
    basis_label: BASIS_LABEL[basis],
    period: p, start, end: fin, today,
    is_current_month: isCurrentMonth, is_future: isFuture,
    loaded_from: loadStart,
    series,
    ber,
    blended,
    gap,
    benchmarks: { bueno: [1.2, 1.5], decente: [1.5, 1.8], alto: [1.8, null] },
    warnings,
    cogs_status: cogsState.status,
    cogs_refreshing: !!cogsState.refreshing,
    store_connected: !!shopifyCred,
    method: {
      basis: basis === 'gross'
        ? 'facturación = venta total de la tienda con IVA (como en el curso) + ventas WhatsApp'
        : 'facturación = venta neta sin IVA ni descuentos + envío recaudado + ventas WhatsApp',
      iva: 'El IVA no es ingreso: de cada $119 facturados, $19 son de la DIAN. Por eso el BER y el Blended se calculan sin IVA por defecto; la opción "con IVA" reproduce la fórmula del curso para comparar.',
      ticket: 'Σ facturación ÷ Σ pedidos (90 días)',
      cost_per_order: '(mercancía + logística) ÷ pedidos (90 días)',
      ber: 'ticket ÷ (ticket − costo por pedido)',
      blended: 'facturación total ÷ gasto total en publicidad',
      gap: 'Blended ROAS − BER = espacio para escalar',
      source: 'Ramsés @ramDTC · comercionline.com/presentacion',
    },
  };
}

export default { getScalability, berForWindow, berBenchmark, isLogisticsCost, normalizeBasis, BASES, LOGISTICS_RE, BER_WINDOW_DAYS, SCALE_MARGIN };
