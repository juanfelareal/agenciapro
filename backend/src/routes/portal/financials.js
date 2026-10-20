/**
 * Portal del cliente: SU dashboard financiero (P&L del mes) con edición de costos y metas.
 * Montado en /api/portal/financials.
 *
 * Permisos (client_portal_settings):
 *   - can_view_financials = 1 → puede ver (si no, 403 en todo)
 *   - financials_editable = 1 → puede escribir costos fijos/variables, costo de producto, meta y % estimado
 *
 * Mismo contrato de respuesta que las rutas del equipo en routes/growth.js para reutilizar los
 * componentes del dashboard. Toda la lógica vive en services/clientFinancialsService.js y
 * services/clientFinancialsEdits.js; aquí solo se autoriza y se enruta.
 */
import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';
import * as financials from '../../services/clientFinancialsService.js';
import * as edits from '../../services/clientFinancialsEdits.js';
import * as scenarios from '../../services/financialScenarios.js';
import * as orderLedger from '../../services/orderLedger.js';
import { buildFinancialsWorkbook, financialsExportFilename, getClientBrandName } from '../../services/financialsExport.js';

const router = express.Router();

const isOn = (v) => v === true || Number(v) === 1;

/** El cliente debe tener Finanzas activas en su portal; además cargamos su organization_id. */
const requireFinancials = async (req, res, next) => {
  try {
    if (!isOn(req.client?.permissions?.can_view_financials)) {
      return res.status(403).json({ error: 'Finanzas no está habilitado para tu cuenta. Pídele a LA REAL activarlo.' });
    }
    const row = await db.get('SELECT organization_id FROM clients WHERE id = ?', [req.client.id]);
    if (!row?.organization_id) return res.status(404).json({ error: 'Cliente no encontrado' });
    req.orgId = row.organization_id;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Las escrituras solo con financials_editable = 1. */
const requireEditable = (req, res, next) => {
  if (!isOn(req.client?.permissions?.financials_editable)) {
    return res.status(403).json({ error: 'Tu dashboard financiero es de solo lectura. Pídele a LA REAL activar la edición.', read_only: true });
  }
  next();
};

const sendError = (res, error, label) => {
  if (!error?.status) console.error(`Portal financials: error ${label}:`, error);
  res.status(error?.status || 500).json({ error: error?.message || 'Error inesperado', ...(error?.needs_reconnect ? { needs_reconnect: true } : {}) });
};

const currentPeriod = () => financials.todayColombia().slice(0, 7);
const periodFrom = (q) => (/^\d{4}-\d{2}$/.test(q || '') ? q : currentPeriod());

router.use(clientAuthMiddleware, requireFinancials);

// ─── Lectura ───

// GET /?period=YYYY-MM[&light=1]
router.get('/', async (req, res) => {
  try {
    const period = periodFrom(req.query.period);
    const light = req.query.light === '1' || req.query.light === 'true';
    const data = await financials.computeFinancials({ clientId: Number(req.client.id), orgId: req.orgId, period, light });
    // El laboratorio financiero es interno del equipo; el portal nunca lo muestra.
    res.json({ ...data, lab_enabled: false, editable: isOn(req.client.permissions.financials_editable) });
  } catch (error) {
    sendError(res, error, 'computing financials');
  }
});

router.get('/fixed-costs', async (req, res) => {
  try { res.json(await edits.listFixedCosts(req.client.id, req.orgId)); } catch (error) { sendError(res, error, 'listing fixed costs'); }
});

router.get('/variable-costs', async (req, res) => {
  try { res.json(await edits.listVariableCosts(req.client.id, req.orgId)); } catch (error) { sendError(res, error, 'listing variable costs'); }
});

// GET /objective?period=YYYY-MM → meta de venta del mes ({ id, conservador, base, optimista } | null)
router.get('/objective', async (req, res) => {
  try { res.json(await edits.getObjective(req.client.id, req.orgId, periodFrom(req.query.period), 'revenue')); } catch (error) { sendError(res, error, 'getting objective'); }
});

// Volver a traer el catálogo de la tienda: no edita datos del cliente (el GET lo hace solo cuando está viejo).
router.post('/products/sync', async (req, res) => {
  try { res.json(await edits.syncProductsForClient(req.client.id, req.orgId)); } catch (error) { sendError(res, error, 'syncing products'); }
});

// ─── Escritura (solo con financials_editable) ───

// ─── Escenarios del cliente (owner_type 'client'): los privados solo los ve la marca, nunca la agencia ───
const scenarioOwner = (req) => ({ owner_type: 'client', owner_id: Number(req.client.id) });
const scenarioPeriod = (v, fallback) => (/^\d{4}-\d{2}$/.test(v || '') ? v : fallback);

router.get('/scenarios', async (req, res) => {
  try {
    const withResults = String(req.query.light || '') !== '1';
    res.json(await scenarios.listScenarios({ clientId: Number(req.client.id), orgId: req.orgId, owner: scenarioOwner(req), period: scenarioPeriod(req.query.period, periodFrom(req.query.period)), withResults }));
  } catch (error) { sendError(res, error, 'listing scenarios'); }
});
router.get('/scenarios/compare', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').map((x) => Number(x)).filter(Boolean);
    res.json(await scenarios.compareScenarios({ clientId: Number(req.client.id), orgId: req.orgId, owner: scenarioOwner(req), ids, period: scenarioPeriod(req.query.period, periodFrom(req.query.period)) }));
  } catch (error) { sendError(res, error, 'comparing scenarios'); }
});
router.post('/scenarios/evaluate', async (req, res) => {
  try {
    const { period, params } = req.body || {};
    res.json(await scenarios.evaluateScenario({ clientId: Number(req.client.id), orgId: req.orgId, period: scenarioPeriod(period, periodFrom(req.query.period)), params: params || {} }));
  } catch (error) { sendError(res, error, 'evaluating scenario'); }
});
router.post('/scenarios', async (req, res) => {
  try {
    const { name, description, visibility, params, period } = req.body || {};
    const s = await scenarios.createScenario({ clientId: Number(req.client.id), orgId: req.orgId, owner: scenarioOwner(req), name, description, visibility: visibility || 'private', params, period });
    res.status(201).json(s);
  } catch (error) { sendError(res, error, 'creating scenario'); }
});
router.put('/scenarios/:id', async (req, res) => {
  try {
    const { name, description, visibility, params, period } = req.body || {};
    const s = await scenarios.updateScenario({ clientId: Number(req.client.id), orgId: req.orgId, id: Number(req.params.id), owner: scenarioOwner(req), name, description, visibility, params, period });
    if (!s) return res.status(404).json({ error: 'Escenario no encontrado' });
    res.json(s);
  } catch (error) { sendError(res, error, 'updating scenario'); }
});
router.delete('/scenarios/:id', async (req, res) => {
  try {
    const ok = await scenarios.deleteScenario({ clientId: Number(req.client.id), orgId: req.orgId, id: Number(req.params.id), owner: scenarioOwner(req) });
    if (!ok) return res.status(404).json({ error: 'Escenario no encontrado' });
    res.json({ success: true });
  } catch (error) { sendError(res, error, 'deleting scenario'); }
});

// ─── Cuándo compran / nuevos vs recurrentes (libro de pedidos) ───
const ledgerState = async (req, res) => {
  const state = await orderLedger.ensureLedger(Number(req.client.id), req.orgId);
  if (!state.ready) { res.json({ building: state.building, empty: !state.building, no_store: Boolean(state.no_store) }); return false; }
  return true;
};
router.get('/patterns', async (req, res) => {
  try {
    if (!(await ledgerState(req, res))) return;
    res.json(await orderLedger.getPatterns(Number(req.client.id), req.orgId, { days: Number(req.query.days) || 90 }));
  } catch (error) { sendError(res, error, 'fetching purchase patterns'); }
});
router.get('/customer-mix', async (req, res) => {
  try {
    if (!(await ledgerState(req, res))) return;
    res.json(await orderLedger.getCustomerMix(Number(req.client.id), req.orgId, { start: req.query.start, end: req.query.end }));
  } catch (error) { sendError(res, error, 'fetching customer mix'); }
});
router.post('/orders/backfill', async (req, res) => {
  try {
    const cred = await financials.getShopifyCredentials(req.client.id);
    if (!cred) return res.status(400).json({ error: 'Sin tienda conectada' });
    const days = Math.max(7, Math.min(Number(req.body?.days) || 180, 730));
    const already = orderLedger.isBackfilling(req.client.id);
    orderLedger.startBackfill(Number(req.client.id), req.orgId, days);
    res.json({ started: !already, building: true, days });
  } catch (error) { sendError(res, error, 'starting orders backfill'); }
});

// ─── Exportar a Excel ───
router.get('/export.xlsx', async (req, res) => {
  try {
    const period = periodFrom(req.query.period);
    const brand = await getClientBrandName(Number(req.client.id), req.orgId);
    const buffer = await buildFinancialsWorkbook({ clientId: Number(req.client.id), orgId: req.orgId, period, brand });
    const filename = financialsExportFilename(brand, period);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error) { sendError(res, error, 'exporting financials to Excel'); }
});

router.use(requireEditable);

router.post('/fixed-costs', async (req, res) => {
  try { res.json(await edits.createFixedCost(req.client.id, req.orgId, req.body)); } catch (error) { sendError(res, error, 'creating fixed cost'); }
});
router.put('/fixed-costs/:id', async (req, res) => {
  try { res.json(await edits.updateFixedCost(req.client.id, req.orgId, req.params.id, req.body)); } catch (error) { sendError(res, error, 'updating fixed cost'); }
});
router.delete('/fixed-costs/:id', async (req, res) => {
  try { res.json(await edits.deleteFixedCost(req.client.id, req.orgId, req.params.id)); } catch (error) { sendError(res, error, 'deleting fixed cost'); }
});

router.post('/variable-costs', async (req, res) => {
  try { res.json(await edits.createVariableCost(req.client.id, req.orgId, req.body)); } catch (error) { sendError(res, error, 'creating variable cost'); }
});
router.put('/variable-costs/:id', async (req, res) => {
  try { res.json(await edits.updateVariableCost(req.client.id, req.orgId, req.params.id, req.body)); } catch (error) { sendError(res, error, 'updating variable cost'); }
});
router.delete('/variable-costs/:id', async (req, res) => {
  try { res.json(await edits.deleteVariableCost(req.client.id, req.orgId, req.params.id)); } catch (error) { sendError(res, error, 'deleting variable cost'); }
});

// Costo unitario: variante vendida fuera del catálogo primero (ruta más específica)
router.put('/products/variant/:variantId/cost', async (req, res) => {
  try { res.json(await edits.setVariantCost(req.client.id, req.orgId, req.params.variantId, req.body?.cost)); } catch (error) { sendError(res, error, 'setting variant cost'); }
});
router.put('/products/:productId/cost', async (req, res) => {
  try { res.json(await edits.setProductCost(req.client.id, req.orgId, req.params.productId, req.body?.cost)); } catch (error) { sendError(res, error, 'updating product cost'); }
});
router.delete('/products/:productId/cost', async (req, res) => {
  try { res.json(await edits.resetProductCost(req.client.id, req.orgId, req.params.productId)); } catch (error) { sendError(res, error, 'resetting product cost'); }
});

// POST /objective { period, conservador, base, optimista } → meta de venta del mes (metric 'revenue')
router.post('/objective', async (req, res) => {
  try {
    const { period, conservador, base, optimista } = req.body || {};
    res.json(await edits.upsertObjective(req.client.id, req.orgId, { period: periodFrom(period), metric: 'revenue', conservador, base, optimista }));
  } catch (error) {
    sendError(res, error, 'saving objective');
  }
});

// PUT /settings { default_cogs_rate } → % estimado para productos sin costo
router.put('/settings', async (req, res) => {
  try {
    const rate = edits.parseCogsRate(req.body?.default_cogs_rate);
    res.json(await financials.saveFinancialSettings(req.client.id, req.orgId, { default_cogs_rate: rate }));
  } catch (error) {
    sendError(res, error, 'saving financial settings');
  }
});

export default router;
