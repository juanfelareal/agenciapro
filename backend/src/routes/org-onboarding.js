/**
 * /api/org — onboarding de la organización (checklist "Primeros pasos", tour guiado)
 * + rutas mínimas de módulos y marca que escriben en organizations.settings (JSONB).
 *
 * Montado en server.js con teamAuthMiddleware → siempre hay req.orgId.
 *
 *   GET  /api/org/onboarding          → { onboarding, modules, branding, plan, plan_selected, trial_ends_at }
 *   PUT  /api/org/onboarding          → merge parcial { completed_steps?, tour_seen?, dismissed? }
 *   GET  /api/org/onboarding/status   → detección automática de las 6 tareas del checklist
 *   GET  /api/org/modules             → { modules }
 *   PUT  /api/org/modules             → { modules: { clients: true, ... } }  (admin)
 *   GET  /api/org/branding            → { branding }
 *   PUT  /api/org/branding            → { accent, theme }                    (admin)
 */
import express from 'express';
import db from '../config/database.js';
import {
  ensureOnboardingColumns,
  getOrgSettings,
  getOnboarding,
  saveSettingsKey,
  sanitizeModules,
  sanitizeBranding,
  MODULE_DEFAULTS,
} from '../services/orgOnboarding.js';

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.teamMember?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden cambiar esta configuración' });
  }
  next();
};

const requireOrg = (req, res, next) => {
  if (!req.orgId) return res.status(400).json({ error: 'Sin organización activa' });
  next();
};

router.use(requireOrg);

// ---------------------------------------------------------------------------
// Onboarding (progreso)
// ---------------------------------------------------------------------------
router.get('/onboarding', async (req, res) => {
  try {
    await ensureOnboardingColumns();
    const org = await db.get(
      'SELECT id, name, plan, plan_selected, trial_ends_at, settings, created_at FROM organizations WHERE id = ?',
      [req.orgId]
    );
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });
    const settings = (() => { try { return typeof org.settings === 'string' ? JSON.parse(org.settings) : (org.settings || {}); } catch { return {}; } })();
    const agencyType = settings?.onboarding?.agency_type;
    res.json({
      onboarding: getOnboarding(settings),
      modules: settings.modules || (agencyType ? MODULE_DEFAULTS[agencyType] : null),
      branding: settings.branding || null,
      plan: org.plan,
      plan_selected: org.plan_selected || null,
      trial_ends_at: org.trial_ends_at || null,
      created_at: org.created_at,
    });
  } catch (error) {
    console.error('GET /org/onboarding error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/onboarding', async (req, res) => {
  try {
    const { completed_steps, tour_seen, dismissed } = req.body || {};
    const patch = {};
    if (Array.isArray(completed_steps)) {
      patch.completed_steps = [...new Set(completed_steps.filter((s) => typeof s === 'string').slice(0, 50))];
    }
    if (typeof tour_seen === 'boolean') patch.tour_seen = tour_seen;
    if (typeof dismissed === 'boolean') patch.dismissed = dismissed;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada que actualizar' });
    patch.updated_at = new Date().toISOString();
    const onboarding = await saveSettingsKey(req.orgId, 'onboarding', patch);
    res.json({ onboarding: getOnboarding({ onboarding }) });
  } catch (error) {
    console.error('PUT /org/onboarding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Consulta ligera: cada bloque va en try/catch para que una tabla ausente no rompa el checklist.
const countOrNull = async (sql, params) => {
  try {
    const row = await db.get(sql, params);
    return Number(row?.n || 0);
  } catch {
    return null;
  }
};

router.get('/onboarding/status', async (req, res) => {
  try {
    const orgId = req.orgId;
    const firstClient = await db.get(
      'SELECT id, name FROM clients WHERE organization_id = ? ORDER BY created_at ASC, id ASC LIMIT 1',
      [orgId]
    ).catch(() => null);

    const [clients, shopify, woo, fb, gads, tiktok, members, projects, portal, fixedCosts, variableCosts] = await Promise.all([
      countOrNull('SELECT COUNT(*) AS n FROM clients WHERE organization_id = ?', [orgId]),
      countOrNull(`SELECT COUNT(*) AS n FROM client_shopify_credentials s JOIN clients c ON c.id = s.client_id WHERE c.organization_id = ?`, [orgId]),
      countOrNull(`SELECT COUNT(*) AS n FROM client_woocommerce_credentials w JOIN clients c ON c.id = w.client_id WHERE c.organization_id = ?`, [orgId]),
      countOrNull(`SELECT COUNT(*) AS n FROM client_facebook_credentials f JOIN clients c ON c.id = f.client_id WHERE c.organization_id = ?`, [orgId]),
      countOrNull(`SELECT COUNT(*) AS n FROM client_google_ads_credentials g JOIN clients c ON c.id = g.client_id WHERE c.organization_id = ?`, [orgId]),
      countOrNull(`SELECT COUNT(*) AS n FROM client_tiktok_credentials t JOIN clients c ON c.id = t.client_id WHERE c.organization_id = ?`, [orgId]),
      countOrNull(`SELECT COUNT(*) AS n FROM team_members WHERE organization_id = ? AND status = 'active'`, [orgId]),
      countOrNull('SELECT COUNT(*) AS n FROM projects WHERE organization_id = ?', [orgId]),
      countOrNull(`SELECT COUNT(*) AS n FROM client_access_tokens a JOIN clients c ON c.id = a.client_id WHERE c.organization_id = ? AND a.status IN ('pending', 'active')`, [orgId]),
      countOrNull('SELECT COUNT(*) AS n FROM client_fixed_costs WHERE organization_id = ?', [orgId]),
      countOrNull('SELECT COUNT(*) AS n FROM client_variable_costs WHERE organization_id = ?', [orgId]),
    ]);

    const stores = (shopify || 0) + (woo || 0);
    const ads = (fb || 0) + (gads || 0) + (tiktok || 0);
    const costs = (fixedCosts || 0) + (variableCosts || 0);

    const tasks = {
      store: stores > 0,
      ads: ads > 0,
      team: (members || 0) > 1,
      project: (projects || 0) > 0,
      portal: (portal || 0) > 0,
      costs: costs > 0,
    };
    const done = Object.values(tasks).filter(Boolean).length;

    res.json({
      tasks,
      done,
      total: Object.keys(tasks).length,
      counts: { clients: clients || 0, stores, ads, members: members || 0, projects: projects || 0, portal: portal || 0, costs },
      first_client: firstClient ? { id: firstClient.id, name: firstClient.name } : null,
    });
  } catch (error) {
    console.error('GET /org/onboarding/status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Módulos por organización (mínimo; contrato compartido con "módulos por organización")
// ---------------------------------------------------------------------------
// [modules]/[branding]: GET/PUT /modules y /branding viven en routes/org.js y routes/org-branding.js

export default router;
