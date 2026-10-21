/**
 * Ediciones del dashboard financiero de un cliente: costos fijos, costos variables,
 * costo unitario de productos, sincronización del catálogo y meta de venta del mes.
 *
 * Lo usan dos capas con el MISMO contrato de respuesta:
 *   - el equipo de la agencia (routes/growth.js, /api/growth/clients/:clientId/...)
 *   - el cliente desde su portal (routes/portal/financials.js, /api/portal/financials/...)
 *
 * Los errores de validación/no-encontrado se lanzan con `err.status` (400/404/403) y un
 * mensaje en español listo para devolver al frontend.
 */
import db from '../config/database.js';
import { getShopifyCredentials, syncProducts } from './clientFinancialsService.js';

export const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

const VARIABLE_KINDS = ['per_order', 'per_unit', 'monthly_fixed'];

// ─── Costos fijos ───

export async function listFixedCosts(clientId, orgId) {
  return db.all('SELECT * FROM client_fixed_costs WHERE client_id = ? AND organization_id = ? ORDER BY category, name', [clientId, orgId]);
}

export async function createFixedCost(clientId, orgId, body = {}) {
  const { category, name, amount, start_date, end_date, notes } = body;
  if (!category || !name || amount === undefined || !start_date) {
    throw httpError(400, 'category, name, amount, and start_date are required');
  }
  const result = await db.run(`
    INSERT INTO client_fixed_costs (organization_id, client_id, category, name, amount, start_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [orgId, clientId, category, name, amount, start_date, end_date || null, notes || null]);
  return { id: result.lastInsertRowid, category, name, amount, start_date, end_date, notes };
}

export async function updateFixedCost(clientId, orgId, costId, body = {}) {
  const { category, name, amount, start_date, end_date, notes } = body;
  await db.run(`
    UPDATE client_fixed_costs
    SET category = ?, name = ?, amount = ?, start_date = ?, end_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND client_id = ? AND organization_id = ?
  `, [category, name, amount, start_date, end_date || null, notes || null, costId, clientId, orgId]);
  return { success: true };
}

export async function deleteFixedCost(clientId, orgId, costId) {
  await db.run('DELETE FROM client_fixed_costs WHERE id = ? AND client_id = ? AND organization_id = ?', [costId, clientId, orgId]);
  return { success: true };
}

// ─── Costos variables ───

export async function listVariableCosts(clientId, orgId) {
  return db.all('SELECT * FROM client_variable_costs WHERE client_id = ? AND organization_id = ? ORDER BY category, name', [clientId, orgId]);
}

export async function createVariableCost(clientId, orgId, body = {}) {
  const { category, name, applies_to, notes } = body;
  const kind = VARIABLE_KINDS.includes(body.kind) ? body.kind : 'percent';
  const percentage = kind === 'percent' ? parseFloat(body.percentage) : 0;
  const amount = kind !== 'percent' ? parseFloat(body.amount) : null;
  const reserveProvider = String(body.reserve_provider || '').trim() || null;

  if (!category || !name) throw httpError(400, 'category y name son requeridos');
  if (kind === 'percent' && !Number.isFinite(percentage)) throw httpError(400, 'percentage es requerido');
  if (kind !== 'percent' && !Number.isFinite(amount)) throw httpError(400, 'amount es requerido');

  const result = await db.run(`
    INSERT INTO client_variable_costs (organization_id, client_id, category, name, percentage, applies_to, kind, amount, notes, reserve_provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [orgId, clientId, category, name, percentage, applies_to || 'revenue', kind, amount, notes || null, reserveProvider]);
  return { id: result.lastInsertRowid, category, name, percentage, applies_to: applies_to || 'revenue', kind, amount, notes, reserve_provider: reserveProvider };
}

export async function updateVariableCost(clientId, orgId, costId, body = {}) {
  const { category, name, applies_to, is_active, notes } = body;
  const kind = VARIABLE_KINDS.includes(body.kind) ? body.kind : 'percent';
  const percentage = kind === 'percent' ? (parseFloat(body.percentage) || 0) : 0;
  const amount = kind !== 'percent' ? (parseFloat(body.amount) || 0) : null;
  const active = is_active === undefined || is_active === null ? 1 : (is_active ? 1 : 0);
  const reserveProvider = body.reserve_provider === undefined ? undefined : (String(body.reserve_provider || '').trim() || null);

  await db.run(`
    UPDATE client_variable_costs
    SET category = ?, name = ?, percentage = ?, applies_to = ?, is_active = ?, notes = ?, kind = ?, amount = ?,
        reserve_provider = CASE WHEN ?::boolean THEN ? ELSE reserve_provider END, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND client_id = ? AND organization_id = ?
  `, [category, name, percentage, applies_to || 'revenue', active, notes || null, kind, amount, reserveProvider !== undefined, reserveProvider ?? null, costId, clientId, orgId]);
  return { success: true };
}

export async function deleteVariableCost(clientId, orgId, costId) {
  await db.run('DELETE FROM client_variable_costs WHERE id = ? AND client_id = ? AND organization_id = ?', [costId, clientId, orgId]);
  return { success: true };
}

// ─── Costo unitario de productos ───

const parseCost = (raw) => {
  const cost = parseFloat(raw);
  if (!Number.isFinite(cost) || cost < 0) throw httpError(400, 'cost debe ser un número mayor o igual a 0');
  return cost;
};

/** Costo manual de un producto del catálogo (pisa el de Shopify; el COGS se recalcula en vivo). */
export async function setProductCost(clientId, orgId, productId, rawCost) {
  const cost = parseCost(rawCost);
  const result = await db.run(`
    UPDATE shopify_products
    SET cost = ?, cost_source = 'manual', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND client_id = ? AND organization_id = ?
  `, [cost, productId, clientId, orgId]);
  if (result.changes === 0) throw httpError(404, 'Producto no encontrado');
  return { success: true, cost, cost_source: 'manual' };
}

/**
 * Costo manual para una variante vendida que NO está en el catálogo (p. ej. la tienda no dio permiso
 * read_products y nunca se pudo sincronizar). Creamos la fila del producto a partir de las ventas.
 */
export async function setVariantCost(clientId, orgId, variantId, rawCost) {
  const cost = parseCost(rawCost);
  const sale = await db.get(`
    SELECT MAX(shopify_product_id) AS shopify_product_id, MAX(title) AS title, MAX(variant_title) AS variant_title, MAX(sku) AS sku
    FROM client_product_daily_sales WHERE client_id = ? AND shopify_variant_id = ?
  `, [clientId, String(variantId)]);
  if (!sale || !sale.title) throw httpError(404, 'No encontramos ventas de esa variante');

  await db.run(`
    INSERT INTO shopify_products (organization_id, client_id, shopify_product_id, shopify_variant_id, sku, title, variant_title, cost, shopify_cost, cost_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'manual')
    ON CONFLICT (client_id, shopify_variant_id) DO UPDATE SET cost = EXCLUDED.cost, cost_source = 'manual', updated_at = CURRENT_TIMESTAMP
  `, [orgId, clientId, String(sale.shopify_product_id || variantId), String(variantId), sale.sku, sale.title, sale.variant_title, cost]);
  const row = await db.get('SELECT id FROM shopify_products WHERE client_id = ? AND shopify_variant_id = ?', [clientId, String(variantId)]);
  return { success: true, id: row?.id || null, cost, cost_source: 'manual' };
}

/** Volver al costo que está en Shopify (quita el manual). */
export async function resetProductCost(clientId, orgId, productId) {
  const result = await db.run(`
    UPDATE shopify_products
    SET cost = shopify_cost, cost_source = 'shopify', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND client_id = ? AND organization_id = ?
  `, [productId, clientId, orgId]);
  if (result.changes === 0) throw httpError(404, 'Producto no encontrado');
  const row = await db.get('SELECT cost, shopify_cost, cost_source FROM shopify_products WHERE id = ?', [productId]);
  return { success: true, cost: row?.cost === null ? null : Number(row.cost), cost_source: 'shopify' };
}

// ─── Sincronizar catálogo con la tienda ───

const isPermissionError = (message = '') => message.includes('Access denied') || message.includes('products field') || message.includes('permission');

/** Trae el catálogo de la tienda y arma la respuesta/mensaje que muestran ambos dashboards. */
export async function syncProductsForClient(clientId, orgId) {
  const cred = await getShopifyCredentials(clientId);
  if (!cred) throw httpError(400, 'Sin conexión Shopify activa');
  try {
    const result = await syncProducts(Number(clientId), orgId);
    return {
      success: true,
      synced: result.synced,
      without_cost: result.without_cost,
      products_synced_at: result.synced_at,
      message: `Sincronizados ${result.synced} productos. ${result.without_cost} sin costo en Shopify.`,
    };
  } catch (error) {
    if (isPermissionError(error.message)) {
      throw httpError(403, 'Tu conexión de Shopify no tiene permisos para leer productos. Ve a la pestaña de Shopify del cliente, desconecta y vuelve a conectar la tienda para obtener los permisos necesarios.', { needs_reconnect: true });
    }
    throw error;
  }
}

// ─── Metas del mes (growth_objectives) ───

const isPeriod = (p) => /^\d{4}-\d{2}$/.test(String(p || ''));

export async function getObjective(clientId, orgId, period, metric = 'revenue') {
  if (!isPeriod(period)) throw httpError(400, 'period debe tener formato YYYY-MM');
  const g = await db.get(
    'SELECT id, client_id, period, metric, conservador, base, optimista FROM growth_objectives WHERE client_id = ? AND organization_id = ? AND period = ? AND metric = ?',
    [clientId, orgId, period, metric]
  );
  if (!g) return null;
  return { ...g, conservador: Number(g.conservador) || 0, base: Number(g.base) || 0, optimista: Number(g.optimista) || 0 };
}

/** Upsert de un objetivo del mes (borra el existente e inserta). Misma lógica para equipo y portal. */
export async function upsertObjective(clientId, orgId, { period, metric, conservador, base, optimista }) {
  if (!isPeriod(period)) throw httpError(400, 'period debe tener formato YYYY-MM');
  if (!metric) throw httpError(400, 'metric es requerido');
  if (metric === 'conversion_rate') {
    const outOfRange = [conservador, base, optimista].some((v) => {
      const n = Number(v || 0);
      return !Number.isFinite(n) || n < 0 || n > 100;
    });
    if (outOfRange) throw httpError(400, 'La tasa de conversión debe estar entre 0 y 100 %');
  }
  await db.run('DELETE FROM growth_objectives WHERE client_id = ? AND period = ? AND metric = ? AND organization_id = ?', [clientId, period, metric, orgId]);
  const result = await db.run(`
    INSERT INTO growth_objectives (client_id, period, metric, conservador, base, optimista, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [clientId, period, metric, conservador || 0, base || 0, optimista || 0, orgId]);
  return { id: result.lastInsertRowid, client_id: clientId, period, metric, conservador, base, optimista };
}

/** Valida el % de costo estimado para productos sin costo (0 ≤ rate < 1). */
export function parseCogsRate(raw) {
  const rate = parseFloat(raw);
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw httpError(400, 'default_cogs_rate debe estar entre 0 y 0.95 (ej. 0.35 = 35 %)');
  }
  return rate;
}
