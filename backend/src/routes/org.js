// [modules] Plan y módulos de la organización actual. Montado en /api/org (teamAuth).
import express from 'express';
import db from '../config/database.js';
import { requireAdmin } from '../middleware/teamAuth.js';
import {
  getOrgPlan,
  invalidateOrgPlanCache,
  validateModuleOverrides,
  validateAddonsChange,
  addonsMonthlyCost,
  isPlatformAdminEmail,
  SELECTABLE_PLANS,
  PLANS,
} from '../services/plans.js';
import { publicCatalog } from '../config/planCatalog.js';

const router = express.Router();

const userEmail = (req) => req.user?.email || req.teamMember?.email || null;

/**
 * GET /api/org/plan
 * Estado completo: plan, estado, prueba, límites, módulos efectivos, uso y catálogo.
 */
router.get('/plan', async (req, res) => {
  try {
    const state = await getOrgPlan(req.orgId, { withUsage: true });
    if (!state) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({
      ...state,
      org_id: req.orgId,
      is_platform_admin: isPlatformAdminEmail(userEmail(req)),
      catalog: publicCatalog(),
    });
  } catch (error) {
    console.error('[modules] GET /org/plan:', error);
    res.status(500).json({ error: 'Error al consultar el plan' });
  }
});

/**
 * GET /api/org/modules
 * { modules: { clave: boolean }, overrides, plan }
 */
router.get('/modules', async (req, res) => {
  try {
    const state = await getOrgPlan(req.orgId, { withUsage: false });
    if (!state) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({ modules: state.modules, overrides: state.overrides, plan: state.plan, plan_name: state.plan_name });
  } catch (error) {
    console.error('[modules] GET /org/modules:', error);
    res.status(500).json({ error: 'Error al consultar los módulos' });
  }
});

/**
 * PUT /api/org/modules { modules: { clave: true|false } }
 * Solo admin. Actualización parcial (se mezcla con los overrides existentes).
 * Encender un módulo fuera del plan → 402 "Este módulo está en el plan X".
 */
router.put('/modules', requireAdmin, async (req, res) => {
  try {
    const state = await getOrgPlan(req.orgId, { withUsage: false });
    if (!state) return res.status(404).json({ error: 'Organización no encontrada' });
    const result = validateModuleOverrides(state, req.body?.modules);
    if (!result.ok) return res.status(result.status).json(result.body);

    await db.run(
      `UPDATE organizations SET modules = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(result.merged), req.orgId]
    );
    invalidateOrgPlanCache(req.orgId);
    const fresh = await getOrgPlan(req.orgId, { withUsage: false });
    res.json({ modules: fresh.modules, overrides: fresh.overrides, plan: fresh.plan, plan_name: fresh.plan_name });
  } catch (error) {
    console.error('[modules] PUT /org/modules:', error);
    res.status(500).json({ error: 'Error al actualizar los módulos' });
  }
});

/**
 * GET /api/org/addons
 * { addons (efectivos), addons_raw, addons_included, limits, monthly_cost }
 */
router.get('/addons', async (req, res) => {
  try {
    const state = await getOrgPlan(req.orgId, { withUsage: true });
    if (!state) return res.status(404).json({ error: 'Organización no encontrada' });
    res.json({
      addons: state.addons,
      addons_raw: state.addons_raw,
      addons_included: state.addons_included,
      limits: state.limits,
      billing_cycle: state.billing_cycle,
      monthly_cost: addonsMonthlyCost(state.addons, state.addons_included, state.usage?.brands),
    });
  } catch (error) {
    console.error('[billing] GET /org/addons:', error);
    res.status(500).json({ error: 'Error al consultar los add-ons' });
  }
});

/**
 * PUT /api/org/addons  { addons: { hourly_reports: true, extra_users: 2, ... } }  (o las claves directamente)
 * Solo admin. Actualización parcial. Add-on fuera del plan → 402 { error, upgrade: true, required_plan }.
 * En plan anual no se pueden apagar los add-ons incluidos (400).
 * → 200 { addons, addons_included, limits }
 */
router.put('/addons', requireAdmin, async (req, res) => {
  try {
    const state = await getOrgPlan(req.orgId, { withUsage: false });
    if (!state) return res.status(404).json({ error: 'Organización no encontrada' });
    const body = req.body || {};
    const incoming = body.addons && typeof body.addons === 'object' && !Array.isArray(body.addons) ? body.addons : body;
    const result = validateAddonsChange(state, incoming);
    if (!result.ok) return res.status(result.status).json(result.body);

    await db.run(
      `UPDATE organizations SET addons = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(result.merged), req.orgId]
    );
    invalidateOrgPlanCache(req.orgId);
    console.log(`[billing] add-ons org ${req.orgId} → ${JSON.stringify(result.merged)} (por ${userEmail(req) || 'desconocido'})`);
    const fresh = await getOrgPlan(req.orgId, { withUsage: true });
    res.json({
      addons: fresh.addons,
      addons_raw: fresh.addons_raw,
      addons_included: fresh.addons_included,
      limits: fresh.limits,
      monthly_cost: addonsMonthlyCost(fresh.addons, fresh.addons_included, fresh.usage?.brands),
    });
  } catch (error) {
    console.error('[billing] PUT /org/addons:', error);
    res.status(500).json({ error: 'Error al actualizar los add-ons' });
  }
});

/**
 * PUT /api/org/plan { plan }
 * Solo admin. Sin pasarela todavía: guarda plan_selected + fecha de solicitud;
 * plan_status no cambia. LA REAL lo activa desde el panel de plataforma.
 */
router.put('/plan', requireAdmin, async (req, res) => {
  try {
    const plan = String(req.body?.plan || '').toLowerCase();
    if (!SELECTABLE_PLANS.includes(plan)) {
      return res.status(400).json({ error: `Plan inválido. Opciones: ${SELECTABLE_PLANS.join(', ')}` });
    }
    await db.run(
      `UPDATE organizations SET plan_selected = ?, plan_requested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [plan, req.orgId]
    );
    invalidateOrgPlanCache(req.orgId);
    console.log(`[modules] Solicitud de plan: org ${req.orgId} → ${plan} (por ${userEmail(req) || 'desconocido'})`);
    const state = await getOrgPlan(req.orgId, { withUsage: false });
    res.json({
      ...state,
      message: `Recibimos tu solicitud del plan ${PLANS[plan].name}. LA REAL activará tu plan y te contactará para el pago; mientras tanto sigues en ${state.status === 'trial' ? 'prueba' : 'tu plan actual'}.`,
    });
  } catch (error) {
    console.error('[modules] PUT /org/plan:', error);
    res.status(500).json({ error: 'Error al solicitar el cambio de plan' });
  }
});

export default router;
