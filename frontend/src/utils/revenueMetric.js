/**
 * Mirror of backend/src/utils/revenueMetric.js.
 * The backend already returns `display_revenue` / `display_roas` / `revenue_label`;
 * these helpers are only a fallback for rows that predate that change.
 */
export const DEFAULT_REVENUE_METRIC = 'confirmed';

export const REVENUE_METRIC_LABELS = {
  total: 'Venta Total',
  confirmed: 'Venta Confirmada',
  net_confirmed: 'Venta Neta',
};

export const normalizeRevenueMetric = (metric) =>
  REVENUE_METRIC_LABELS[metric] ? metric : DEFAULT_REVENUE_METRIC;

export const revenueMetricLabel = (metric) => REVENUE_METRIC_LABELS[normalizeRevenueMetric(metric)];

export const dailyAdSpend = (row) =>
  (parseFloat(row?.fb_spend) || 0) + (parseFloat(row?.ga_spend) || 0) + (parseFloat(row?.tt_spend) || 0);

export const pickDailyDisplayRevenue = (metric, row) => {
  if (!row) return 0;
  if (row.display_revenue !== undefined && row.display_revenue !== null) return parseFloat(row.display_revenue) || 0;
  const total = parseFloat(row.shopify_revenue) || 0;
  const net = parseFloat(row.shopify_net_revenue) || 0;
  const allOrders = parseFloat(row.shopify_all_orders_revenue) || 0;
  switch (normalizeRevenueMetric(metric)) {
    case 'total': return allOrders || total;
    case 'net_confirmed': return net;
    default: return total;
  }
};

export const pickDailyDisplayRoas = (metric, row) => {
  if (!row) return 0;
  if (row.display_roas !== undefined && row.display_roas !== null) return parseFloat(row.display_roas) || 0;
  const spend = dailyAdSpend(row);
  return spend > 0 ? pickDailyDisplayRevenue(metric, row) / spend : 0;
};
