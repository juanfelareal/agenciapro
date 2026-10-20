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
