// [modules] Servicio de planes: estado del plan de una organización, módulos
// efectivos, límites y uso. Los datos estáticos viven en config/planCatalog.js.
import db from '../config/database.js';
import {
  PLANS,
  MODULE_KEYS,
  ALWAYS_ON,
  SELECTABLE_PLANS,
  defaultModulesFor,
  planForModule,
  moduleInfo,
  isPlatformAdminEmail,
} from '../config/planCatalog.js';

export { PLANS, SELECTABLE_PLANS, MODULE_KEYS, planForModule, moduleInfo, isPlatformAdminEmail };

// Caché corta por organización (el trialGate y requireModule consultan en cada request)
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // orgId -> { at, row }

export function invalidateOrgPlanCache(orgId) {
  if (orgId == null) cache.clear();
  else cache.delete(Number(orgId));
}

async function loadOrgRow(orgId) {
  const id = Number(orgId);
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.row;
  const row = await db.get(
    `SELECT id, name, slug, plan, plan_selected, plan_status, trial_ends_at, modules, plan_limits, plan_requested_at, created_at
     FROM organizations WHERE id = ?`,
    [id]
  );
  if (row) cache.set(id, { at: Date.now(), row });
  return row || null;
}

const parseJson = (v) => {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};

/** Clave de plan efectiva a partir de la fila de organizations. */
export function resolvePlanKey(row) {
  if (!row) return 'starter';
  const status = row.plan_status || 'trial';
  if (status === 'trial') return 'trial';
  const plan = String(row.plan || '').toLowerCase();
  return SELECTABLE_PLANS.includes(plan) ? plan : 'starter';
}

/**
 * Módulos efectivos: defaults del plan ∪ overrides de la org.
 * Un override puede apagar un módulo del plan, pero no encender uno que el plan no incluye.
 * `dashboard` siempre queda encendido.
 */
export function computeEffectiveModules(planKey, overrides) {
  const defaults = defaultModulesFor(planKey);
  const ov = parseJson(overrides) || {};
  const out = {};
  for (const key of MODULE_KEYS) {
    const inPlan = defaults[key] === true;
    const wanted = Object.prototype.hasOwnProperty.call(ov, key) ? ov[key] !== false : true;
    out[key] = inPlan && wanted;
  }
  for (const key of ALWAYS_ON) out[key] = true;
  return out;
}

function computeLimits(planKey, planLimits) {
  const base = { ...(PLANS[planKey]?.limits || PLANS.starter.limits) };
  const ov = parseJson(planLimits) || {};
  for (const k of ['brands', 'users']) {
    if (Object.prototype.hasOwnProperty.call(ov, k)) {
      const v = ov[k];
      base[k] = v === null || v === '' || v === undefined ? null : Number(v);
    }
  }
  return base;
}

/** Estado del plan sin consultar uso (puro, testeable sin DB). */
export function computePlanState(row, now = new Date()) {
  const planKey = resolvePlanKey(row);
  const plan = PLANS[planKey];
  const status = row?.plan_status || 'trial';
  const trialEndsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : null;
  let daysLeft = null;
  if (status === 'trial' && trialEndsAt) {
    daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000));
  }
  const trialExpired = status === 'trial' && !!trialEndsAt && trialEndsAt.getTime() < now.getTime();
  const writesBlocked = trialExpired || status === 'canceled';
  return {
    plan: planKey,
    plan_name: plan.name,
    price: plan.price,
    plan_selected: row?.plan_selected || null,
    plan_requested_at: row?.plan_requested_at || null,
    status,
    trial_ends_at: trialEndsAt ? trialEndsAt.toISOString() : null,
    days_left: daysLeft,
    trial_expired: trialExpired,
    writes_blocked: writesBlocked,
    limits: computeLimits(planKey, row?.plan_limits),
    modules: computeEffectiveModules(planKey, row?.modules),
    overrides: parseJson(row?.modules) || {},
  };
}

/** Uso actual: marcas (clientes activos), usuarios (miembros activos) y tiendas conectadas. */
export async function getOrgUsage(orgId) {
  const [brands, users, shopify, woo] = await Promise.all([
    db.get(`SELECT COUNT(*) AS c FROM clients WHERE organization_id = ? AND status = 'active'`, [orgId]),
    db.get(`SELECT COUNT(*) AS c FROM team_members WHERE organization_id = ? AND status = 'active'`, [orgId]),
    db.get(
      `SELECT COUNT(*) AS c FROM client_shopify_credentials s
       JOIN clients c ON c.id = s.client_id
       WHERE c.organization_id = ? AND s.status = 'active'`,
      [orgId]
    ).catch(() => ({ c: 0 })),
    db.get(
      `SELECT COUNT(*) AS c FROM client_woocommerce_credentials w
       JOIN clients c ON c.id = w.client_id
       WHERE c.organization_id = ?`,
      [orgId]
    ).catch(() => ({ c: 0 })),
  ]);
  return {
    brands: Number(brands?.c || 0),
    users: Number(users?.c || 0),
    stores: Number(shopify?.c || 0) + Number(woo?.c || 0),
  };
}

/**
 * Estado completo del plan de una organización.
 * { plan, status, trial_ends_at, days_left, limits, modules, usage, ... }
 */
export async function getOrgPlan(orgId, { withUsage = true } = {}) {
  const row = await loadOrgRow(orgId);
  if (!row) return null;
  const state = computePlanState(row);
  if (withUsage) state.usage = await getOrgUsage(orgId);
  return state;
}

export async function isModuleEnabled(orgId, key) {
  if (ALWAYS_ON.includes(key)) return true;
  const state = await getOrgPlan(orgId, { withUsage: false });
  if (!state) return false;
  return state.modules[key] === true;
}

const LIMIT_LABELS = {
  brands: { singular: 'marca', plural: 'marcas' },
  users: { singular: 'usuario', plural: 'usuarios' },
};

/** Mensaje y payload 402 para un límite alcanzado (puro). */
export function limitPayload(planName, kind, limit) {
  const label = LIMIT_LABELS[kind] || { singular: kind, plural: kind };
  return {
    error: `Tu plan ${planName} permite hasta ${limit} ${limit === 1 ? label.singular : label.plural}. Cambia de plan para agregar más.`,
    limit_reached: true,
    upgrade: true,
    limit_kind: kind,
    limit,
  };
}

/** Evalúa un límite sin lanzar: { allowed, used, limit, payload }. */
export function evaluateLimit(state, usage, kind) {
  const limit = state?.limits?.[kind];
  const used = Number(usage?.[kind] || 0);
  if (limit == null) return { allowed: true, used, limit: null, payload: null };
  if (used < limit) return { allowed: true, used, limit, payload: null };
  return { allowed: false, used, limit, payload: limitPayload(state.plan_name, kind, limit) };
}

/** Consulta DB y evalúa el límite. */
export async function checkLimit(orgId, kind) {
  const state = await getOrgPlan(orgId, { withUsage: true });
  if (!state) return { allowed: true, used: 0, limit: null, payload: null };
  return evaluateLimit(state, state.usage, kind);
}

/** Lanza un error con status 402 si el límite está alcanzado. */
export async function assertWithinLimit(orgId, kind) {
  const result = await checkLimit(orgId, kind);
  if (!result.allowed) {
    const err = new Error(result.payload.error);
    err.status = 402;
    err.payload = result.payload;
    throw err;
  }
  return result;
}

/**
 * Valida un cambio de overrides de módulos contra el plan.
 * Devuelve { ok: true, merged } o { ok: false, status, body }.
 */
export function validateModuleOverrides(state, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { ok: false, status: 400, body: { error: 'Formato inválido: se espera { modules: { clave: true|false } }' } };
  }
  const planModules = defaultModulesFor(state.plan);
  const merged = { ...(state.overrides || {}) };
  for (const [key, value] of Object.entries(incoming)) {
    if (!MODULE_KEYS.includes(key)) {
      return { ok: false, status: 400, body: { error: `Módulo desconocido: ${key}` } };
    }
    const on = value !== false;
    if (ALWAYS_ON.includes(key)) { merged[key] = true; continue; }
    if (on && !planModules[key]) {
      const req = planForModule(key);
      const info = moduleInfo(key);
      return {
        ok: false,
        status: 402,
        body: {
          error: `Este módulo está en el plan ${req?.name || 'superior'}`,
          module: key,
          module_name: info?.name || key,
          required_plan: req?.key || null,
          upgrade: true,
        },
      };
    }
    merged[key] = on;
  }
  return { ok: true, merged };
}
