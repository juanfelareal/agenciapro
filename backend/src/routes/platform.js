// [modules] Panel de plataforma de LA REAL: todas las agencias, su plan y su uso.
// Solo para emails en PLATFORM_ADMIN_EMAILS. Montado en /api/platform (teamAuth).
// Sin impersonación: aquí solo se administra el plan de cada organización.
import express from 'express';
import db from '../config/database.js';
import {
  computePlanState,
  invalidateOrgPlanCache,
  isPlatformAdminEmail,
  SELECTABLE_PLANS,
} from '../services/plans.js';
import { PLAN_STATUSES, BILLING_CYCLES, publicCatalog } from '../config/planCatalog.js';
import { normalizeAddons } from '../services/plans.js'; // [billing]

const router = express.Router();

const requirePlatformAdmin = (req, res, next) => {
  const email = req.user?.email || req.teamMember?.email;
  if (!isPlatformAdminEmail(email)) {
    return res.status(403).json({ error: 'Solo el equipo de LA REAL puede acceder al panel de plataforma' });
  }
  next();
};

router.use(requirePlatformAdmin);

/**
 * GET /api/platform/organizations
 * Todas las organizaciones con plan, estado, prueba, uso, creación y último acceso.
 */
router.get('/organizations', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT o.id, o.name, o.slug, o.logo_url, o.plan, o.plan_selected, o.plan_status, o.trial_ends_at,
             o.modules, o.plan_limits, o.plan_requested_at, o.created_at, o.settings,
             o.billing_cycle, o.addons, o.plan_started_at, o.plan_renews_at, o.price_locked_until, o.plan_price_locked, o.kapso_phone_number_id,
             (SELECT COUNT(*) FROM clients c WHERE c.organization_id = o.id AND c.status = 'active') AS brands,
             (SELECT COUNT(*) FROM team_members tm WHERE tm.organization_id = o.id AND tm.status = 'active') AS users,
             (SELECT COUNT(*) FROM client_shopify_credentials s JOIN clients c ON c.id = s.client_id
                WHERE c.organization_id = o.id AND s.status = 'active') AS shopify_stores,
             (SELECT COUNT(*) FROM client_woocommerce_credentials w JOIN clients c ON c.id = w.client_id
                WHERE c.organization_id = o.id) AS woo_stores,
             (SELECT MAX(ust.last_used_at) FROM user_session_tokens ust WHERE ust.current_org_id = o.id) AS last_access_at,
             (SELECT tm.email FROM team_members tm WHERE tm.organization_id = o.id AND tm.role = 'admin'
                ORDER BY tm.id LIMIT 1) AS admin_email
      FROM organizations o
      ORDER BY o.created_at DESC, o.id DESC
    `);

    const organizations = rows.map((row) => {
      const state = computePlanState(row);
      let onboarding = null;
      try {
        const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
        onboarding = settings?.onboarding || null;
      } catch { /* ignore */ }
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        logo_url: row.logo_url,
        admin_email: row.admin_email || null,
        created_at: row.created_at,
        last_access_at: row.last_access_at || null,
        onboarding,
        plan: state.plan,
        plan_name: state.plan_name,
        plan_db: row.plan,
        plan_selected: state.plan_selected,
        plan_requested_at: state.plan_requested_at,
        status: state.status,
        trial_ends_at: state.trial_ends_at,
        days_left: state.days_left,
        trial_expired: state.trial_expired,
        limits: state.limits,
        plan_limits: row.plan_limits || null,
        modules: state.modules,
        overrides: state.overrides,
        // [billing]
        billing_cycle: state.billing_cycle,
        addons: state.addons,
        addons_raw: state.addons_raw,
        addons_included: state.addons_included,
        plan_started_at: state.plan_started_at,
        plan_renews_at: state.plan_renews_at,
        price_locked_until: state.price_locked_until,
        plan_price_locked: state.plan_price_locked,
        has_dedicated_number: state.has_dedicated_number,
        usage: {
          brands: Number(row.brands || 0),
          users: Number(row.users || 0),
          stores: Number(row.shopify_stores || 0) + Number(row.woo_stores || 0),
        },
      };
    });

    res.json({ organizations, catalog: publicCatalog(), statuses: PLAN_STATUSES });
  } catch (error) {
    console.error('[modules] GET /platform/organizations:', error);
    res.status(500).json({ error: 'Error al listar organizaciones' });
  }
});

/**
 * PUT /api/platform/organizations/:id/plan
 * { plan, plan_status, trial_ends_at, plan_limits: { brands, users }, modules,
 *   billing_cycle, addons, plan_renews_at, price_locked_until, plan_price_locked, plan_started_at }   // [billing]
 * Solo actualiza los campos enviados. Activar un plan → plan = plan_selected = <plan>.
 * Activación manual por transferencia: { plan, plan_status: 'active', billing_cycle: 'annual', plan_renews_at, price_locked_until }.
 */
router.put('/organizations/:id/plan', async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    if (!Number.isFinite(orgId)) return res.status(400).json({ error: 'ID inválido' });
    const org = await db.get('SELECT id FROM organizations WHERE id = ?', [orgId]);
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const { plan, plan_status, trial_ends_at, plan_limits, modules } = req.body || {};
    const { billing_cycle, addons, plan_renews_at, price_locked_until, plan_price_locked, plan_started_at } = req.body || {}; // [billing]
    const sets = [];
    const params = [];

    if (plan !== undefined) {
      const p = String(plan || '').toLowerCase();
      if (!SELECTABLE_PLANS.includes(p)) {
        return res.status(400).json({ error: `Plan inválido. Opciones: ${SELECTABLE_PLANS.join(', ')}` });
      }
      sets.push('plan = ?', 'plan_selected = ?');
      params.push(p, p);
    }
    if (plan_status !== undefined) {
      if (!PLAN_STATUSES.includes(plan_status)) {
        return res.status(400).json({ error: `Estado inválido. Opciones: ${PLAN_STATUSES.join(', ')}` });
      }
      sets.push('plan_status = ?');
      params.push(plan_status);
    }
    if (trial_ends_at !== undefined) {
      if (trial_ends_at === null || trial_ends_at === '') {
        sets.push('trial_ends_at = NULL');
      } else {
        const d = new Date(trial_ends_at);
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Fecha de fin de prueba inválida' });
        sets.push('trial_ends_at = ?');
        params.push(d.toISOString());
      }
    }
    if (plan_limits !== undefined) {
      if (plan_limits === null) {
        sets.push('plan_limits = NULL');
      } else if (typeof plan_limits === 'object') {
        const clean = {};
        for (const k of ['brands', 'users']) {
          if (!Object.prototype.hasOwnProperty.call(plan_limits, k)) continue;
          const v = plan_limits[k];
          if (v === null || v === '' || v === undefined) { clean[k] = null; continue; }
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: `Límite inválido para ${k}` });
          clean[k] = n;
        }
        sets.push('plan_limits = ?::jsonb');
        params.push(JSON.stringify(clean));
      } else {
        return res.status(400).json({ error: 'plan_limits debe ser un objeto { brands, users }' });
      }
    }
    if (modules !== undefined) {
      if (modules === null) sets.push('modules = NULL');
      else if (typeof modules === 'object' && !Array.isArray(modules)) {
        sets.push('modules = ?::jsonb');
        params.push(JSON.stringify(modules));
      } else {
        return res.status(400).json({ error: 'modules debe ser un objeto { clave: boolean } o null' });
      }
    }

    // [billing] ciclo, add-ons y fechas del plan
    if (billing_cycle !== undefined) {
      if (!BILLING_CYCLES.includes(billing_cycle)) {
        return res.status(400).json({ error: `Ciclo inválido. Opciones: ${BILLING_CYCLES.join(', ')}` });
      }
      sets.push('billing_cycle = ?');
      params.push(billing_cycle);
    }
    if (addons !== undefined) {
      if (addons === null) sets.push(`addons = '{}'::jsonb`);
      else if (typeof addons === 'object' && !Array.isArray(addons)) {
        sets.push('addons = ?::jsonb');
        params.push(JSON.stringify(normalizeAddons(addons)));
      } else {
        return res.status(400).json({ error: 'addons debe ser un objeto { hourly_reports, owner_reports, dedicated_number, extra_users, extra_brands } o null' });
      }
    }
    for (const [field, value] of [['plan_renews_at', plan_renews_at], ['price_locked_until', price_locked_until], ['plan_started_at', plan_started_at]]) {
      if (value === undefined) continue;
      if (value === null || value === '') { sets.push(`${field} = NULL`); continue; }
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: `Fecha inválida para ${field}` });
      sets.push(`${field} = ?`);
      params.push(d.toISOString());
    }
    if (plan_price_locked !== undefined) {
      if (plan_price_locked === null || plan_price_locked === '') sets.push('plan_price_locked = NULL');
      else {
        const n = Number(plan_price_locked);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'plan_price_locked inválido' });
        sets.push('plan_price_locked = ?');
        params.push(Math.round(n));
      }
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(orgId);
    await db.run(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`, params);
    invalidateOrgPlanCache(orgId);

    const row = await db.get(
      `SELECT id, name, slug, plan, plan_selected, plan_status, trial_ends_at, modules, plan_limits, plan_requested_at, created_at,
              billing_cycle, addons, plan_started_at, plan_renews_at, price_locked_until, plan_price_locked, kapso_phone_number_id
       FROM organizations WHERE id = ?`,
      [orgId]
    );
    const by = req.user?.email || req.teamMember?.email || 'desconocido';
    console.log(`[modules] Plataforma: org ${orgId} actualizada por ${by}:`, JSON.stringify(req.body || {}));
    res.json({ id: orgId, name: row.name, ...computePlanState(row) });
  } catch (error) {
    console.error('[modules] PUT /platform/organizations/:id/plan:', error);
    res.status(500).json({ error: 'Error al actualizar el plan de la organización' });
  }
});

export default router;
