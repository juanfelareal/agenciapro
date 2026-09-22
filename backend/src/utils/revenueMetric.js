/**
 * Single source of truth for "which Shopify revenue number do we show for this client".
 *
 * The setting lives in client_portal_settings.portal_revenue_metric and has 3 values:
 *   - 'total'         → shopify_all_orders_revenue (all orders, including pending/unpaid)
 *   - 'confirmed'     → shopify_revenue            (paid/confirmed orders)  ← default
 *   - 'net_confirmed' → shopify_net_revenue        (confirmed minus refunds/tax/discounts)
 *
 * Every endpoint that reports revenue or ROAS for a client MUST go through these helpers
 * so the summary rows, daily breakdowns, monthly cards and portal always agree.
 */

export const DEFAULT_REVENUE_METRIC = 'confirmed';

export const REVENUE_METRIC_LABELS = {
  total: 'Venta Total',
  confirmed: 'Venta Confirmada',
  net_confirmed: 'Venta Neta',
};

export function normalizeRevenueMetric(metric) {
  return REVENUE_METRIC_LABELS[metric] ? metric : DEFAULT_REVENUE_METRIC;
}

export function revenueMetricLabel(metric) {
  return REVENUE_METRIC_LABELS[normalizeRevenueMetric(metric)];
}

/**
 * Pick the revenue to display given the client's setting and the three raw values.
 * Accepts either a daily row or aggregated sums (all values parsed to numbers).
 */
export function pickDisplayRevenue(metric, { total = 0, net = 0, allOrders = 0 } = {}) {
  const t = parseFloat(total) || 0;
  const n = parseFloat(net) || 0;
  const a = parseFloat(allOrders) || 0;
  switch (normalizeRevenueMetric(metric)) {
    case 'total':
      // Older rows may not have all_orders populated; fall back to confirmed.
      return a || t;
    case 'net_confirmed':
      return n;
    case 'confirmed':
    default:
      return t;
  }
}

/** Convenience for a client_daily_metrics row. */
export function pickDailyDisplayRevenue(metric, row) {
  return pickDisplayRevenue(metric, {
    total: row.shopify_revenue,
    net: row.shopify_net_revenue,
    allOrders: row.shopify_all_orders_revenue,
  });
}

/** Blended ad spend (Meta + Google + TikTok) for a daily row. */
export function dailyAdSpend(row) {
  return (parseFloat(row.fb_spend) || 0) + (parseFloat(row.ga_spend) || 0) + (parseFloat(row.tt_spend) || 0);
}

/**
 * Fetch the revenue metric setting for a client (normalized, with default).
 * `db` must expose prepare().get() like the app's database wrapper.
 */
export async function getClientRevenueMetric(db, clientId) {
  const row = await db.prepare(
    'SELECT portal_revenue_metric FROM client_portal_settings WHERE client_id = ?'
  ).get(clientId);
  return normalizeRevenueMetric(row?.portal_revenue_metric);
}
