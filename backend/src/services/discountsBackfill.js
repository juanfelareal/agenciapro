/**
 * Relleno histórico de descuentos (sin IVA) en client_daily_metrics.shopify_discounts_net.
 *
 * Trae los pedidos de la tienda del rango UNA sola vez, los agrupa por día y recalcula con
 * calculateMetricsFromOrders (misma lógica del sync diario) SOLO la columna de descuentos.
 * No toca ventas, pauta ni ninguna otra columna. Solo actualiza filas que ya existen.
 */
import db from '../config/database.js';
import { getStoreCredentials, createStoreIntegration } from '../integrations/storeIntegration.js';
import { todayColombia, rangeDays } from './clientFinancialsService.js';

const MAX_DAYS = 400;

/** Fecha (YYYY-MM-DD) del pedido tal como la usa cada integración (Shopify: created_at; Woo: date_created). */
function orderDate(order) {
  const raw = order.created_at || order.date_created || order.date_created_gmt || '';
  return String(raw).slice(0, 10);
}

/**
 * @returns {Promise<{client_id, platform, start_date, end_date, days, orders, updated, days_without_row, discounts_net_total}>}
 */
export async function backfillDiscounts(clientId, startDate, endDate) {
  const cred = await getStoreCredentials(clientId);
  if (!cred) throw new Error('Sin tienda conectada (Shopify o WooCommerce)');

  const today = todayColombia();
  const end = endDate > today ? today : endDate;
  if (startDate > end) throw new Error('El rango no tiene días válidos');
  const dates = rangeDays(startDate, end);
  if (dates.length > MAX_DAYS) throw new Error(`Máximo ${MAX_DAYS} días por corrida`);

  const store = createStoreIntegration(cred);
  const orders = await store.getOrders(startDate, end);

  const byDate = new Map(dates.map((d) => [d, []]));
  for (const o of orders) {
    const d = orderDate(o);
    if (byDate.has(d)) byDate.get(d).push(o);
  }

  let updated = 0;
  let daysWithoutRow = 0;
  let total = 0;
  for (const date of dates) {
    const m = store.calculateMetricsFromOrders(byDate.get(date) || []);
    const net = Number(m.totalDiscountsNet ?? m.totalDiscounts ?? 0) || 0;
    total += net;
    const r = await db.run(
      'UPDATE client_daily_metrics SET shopify_discounts_net = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND metric_date = ?',
      [Math.round(net * 100) / 100, clientId, date],
    );
    if (r.changes) updated += r.changes; else daysWithoutRow += 1;
  }

  return {
    client_id: Number(clientId),
    platform: cred.platform,
    start_date: startDate,
    end_date: end,
    days: dates.length,
    orders: orders.length,
    updated,
    days_without_row: daysWithoutRow,
    discounts_net_total: Math.round(total),
  };
}

export default { backfillDiscounts };
