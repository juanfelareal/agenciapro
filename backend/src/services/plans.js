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
  ADDONS,
  ADDON_KEYS,
  BILLING_CYCLES,
  addonInfo,
  planForAddon,
  annualIncludedAddons,
} from '../config/planCatalog.js';

export { PLANS, SELECTABLE_PLANS, MODULE_KEYS, planForModule, moduleInfo, isPlatformAdminEmail, ADDONS, ADDON_KEYS, addonInfo, planForAddon };

// [billing] Organización de LA REAL: todo activo siempre.
export const LA_REAL_ORG_ID = 1;

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
    `SELECT id, name, slug, plan, plan_selected, plan_status, trial_ends_at, modules, plan_limits, plan_requested_at, created_at,
            billing_cycle, addons, plan_started_at, plan_renews_at, price_locked_until, plan_price_locked, kapso_phone_number_id
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

function computeLimits(planKey, planLimits, addons = null) {
  const base = { ...(PLANS[planKey]?.limits || PLANS.starter.limits) };
  const ov = parseJson(planLimits) || {};
  for (const k of ['brands', 'users']) {
    if (Object.prototype.hasOwnProperty.call(ov, k)) {
      const v = ov[k];
      base[k] = v === null || v === '' || v === undefined ? null : Number(v);
    }
  }
  // [billing] Los add-ons "usuario adicional" / "marca adicional" suman al límite (si no es ilimitado)
  if (addons) {
    if (base.users != null) base.users += Number(addons.extra_users || 0);
    if (base.brands != null) base.brands += Number(addons.extra_brands || 0);
  }
  return base;
}

/* ---------------------------------------------------------------------------
 * [billing] Add-ons
 * ------------------------------------------------------------------------- */

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** addons crudos de la fila normalizados a { hourly_reports, owner_reports, dedicated_number, extra_users, extra_brands }. */
export function normalizeAddons(raw) {
  const src = parseJson(raw) || {};
  const out = {};
  for (const a of ADDONS) {
    const v = src[a.field] ?? src[a.key];
    out[a.field] = a.type === 'count' ? toInt(v) : v === true || v === 'true' || v === 1;
  }
  return out;
}

/** Plan que rige qué add-ons se pueden contratar (la prueba se comporta como Growth). */
export function addonPlanKey(planKey) {
  return planKey === 'trial' ? 'growth' : (SELECTABLE_PLANS.includes(planKey) ? planKey : 'starter');
}

/**
 * Regla de add-on efectivo (puro):
 * activo si está en `addons` (true / entero > 0) O si lo incluye el anual del plan
 * (billing_cycle === 'annual' y el add-on está en PLANS[plan].annual_includes).
 * Org 1 (LA REAL): todo activo siempre.
 * state: { org_id|id, plan, billing_cycle, addons_raw|addons }
 * → { addons, included }  (included = keys de add-on que vienen del anual)
 */
export function addonsFor(state) {
  const raw = normalizeAddons(state?.addons_raw ?? state?.addons);
  const planKey = state?.plan || 'starter';
  const isAnnual = state?.billing_cycle === 'annual';
  const included = isAnnual ? annualIncludedAddons(planKey) : [];
  const orgId = Number(state?.org_id ?? state?.id);
  const effective = { ...raw };
  for (const a of ADDONS) {
    if (a.type !== 'boolean') continue;
    if (included.includes(a.key)) effective[a.field] = true;
    if (orgId === LA_REAL_ORG_ID) effective[a.field] = true;
  }
  return { addons: effective, included };
}

/** ¿Está activo el add-on `key` (key o field) para la organización? */
export async function isAddonEnabled(orgId, key) {
  if (Number(orgId) === LA_REAL_ORG_ID) return true;
  const info = addonInfo(key);
  if (!info) return false;
  const state = await getOrgPlan(orgId, { withUsage: false });
  if (!state) return false;
  const v = state.addons?.[info.field];
  return info.type === 'count' ? Number(v) > 0 : v === true;
}

/**
 * Valida un cambio parcial de add-ons contra el plan.
 * incoming: { hourly_reports: true, extra_users: 2, ... } (acepta key o field).
 * Devuelve { ok: true, merged } o { ok: false, status, body }.
 *  - clave desconocida / valor inválido → 400
 *  - add-on no disponible en el plan → 402 { error, upgrade: true, required_plan }
 *  - anual: no se puede apagar un add-on incluido → 400
 */
export function validateAddonsChange(state, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { ok: false, status: 400, body: { error: 'Formato inválido: se espera { addons: { clave: true|false|entero } }' } };
  }
  const isLaReal = Number(state?.org_id ?? state?.id) === LA_REAL_ORG_ID;
  const planKey = addonPlanKey(state?.plan);
  const included = state?.billing_cycle === 'annual' ? annualIncludedAddons(state.plan) : [];
  const merged = { ...normalizeAddons(state?.addons_raw) };

  for (const [k, value] of Object.entries(incoming)) {
    const a = addonInfo(k);
    if (!a) return { ok: false, status: 400, body: { error: `Add-on desconocido: ${k}` } };

    if (a.type === 'count') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        return { ok: false, status: 400, body: { error: `${a.name}: se espera un entero mayor o igual a 0`, addon: a.key } };
      }
      if (n > 0 && !isLaReal && !a.plans.includes(planKey)) {
        return {
          ok: false, status: 402,
          body: {
            error: planKey === 'agencia'
              ? `El plan Agencia no tiene límite de ${a.unit}s; no necesitas este add-on.`
              : `${a.name} está disponible en el plan ${planForAddon(a.key)?.name || 'superior'}`,
            addon: a.key, addon_name: a.name, required_plan: planForAddon(a.key)?.key || null, upgrade: true,
          },
        };
      }
      merged[a.field] = n;
      continue;
    }

    if (typeof value !== 'boolean') {
      return { ok: false, status: 400, body: { error: `${a.name}: se espera true o false`, addon: a.key } };
    }
    if (value && !isLaReal && !a.plans.includes(planKey)) {
      const req = planForAddon(a.key);
      return {
        ok: false, status: 402,
        body: {
          error: `${a.name} está disponible desde el plan ${req?.name || 'superior'}`,
          addon: a.key, addon_name: a.name, required_plan: req?.key || null, upgrade: true,
        },
      };
    }
    if (!value && included.includes(a.key)) {
      return {
        ok: false, status: 400,
        body: { error: `${a.name} está incluido en tu plan anual y no se puede desactivar`, addon: a.key, included: true },
      };
    }
    merged[a.field] = value;
  }
  return { ok: true, merged };
}

/** Costo mensual (COP, sin IVA) de los add-ons contratados que NO vienen incluidos. */
export function addonsMonthlyCost(addons, included = [], brandsCount = 0) {
  let total = 0;
  const lines = [];
  for (const a of ADDONS) {
    if (included.includes(a.key)) continue;
    const v = addons?.[a.field];
    let qty = 0;
    if (a.type === 'count') qty = Number(v) || 0;
    else if (v === true) qty = a.key === 'owner_reports' ? Math.max(1, Number(brandsCount) || 0) : 1;
    if (!qty) continue;
    const amount = qty * a.price;
    total += amount;
    lines.push({ key: a.key, name: a.name, qty, unit_price: a.price, amount });
  }
  return { total, lines };
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
  // [billing]
  const billingCycle = BILLING_CYCLES.includes(row?.billing_cycle) ? row.billing_cycle : 'monthly';
  const addonsRaw = normalizeAddons(row?.addons);
  const { addons, included } = addonsFor({ org_id: row?.id, plan: planKey, billing_cycle: billingCycle, addons_raw: addonsRaw });
  const iso = (v) => (v ? new Date(v).toISOString() : null);
  return {
    org_id: row?.id ?? null,
    plan: planKey,
    plan_name: plan.name,
    price: plan.price,
    billing_cycle: billingCycle,
    addons,
    addons_raw: addonsRaw,
    addons_included: included,
    plan_started_at: iso(row?.plan_started_at),
    plan_renews_at: iso(row?.plan_renews_at),
    price_locked_until: iso(row?.price_locked_until),
    plan_price_locked: row?.plan_price_locked != null ? Number(row.plan_price_locked) : null,
    has_dedicated_number: !!row?.kapso_phone_number_id,
    plan_selected: row?.plan_selected || null,
    plan_requested_at: row?.plan_requested_at || null,
    status,
    trial_ends_at: trialEndsAt ? trialEndsAt.toISOString() : null,
    days_left: daysLeft,
    trial_expired: trialExpired,
    writes_blocked: writesBlocked,
    limits: computeLimits(planKey, row?.plan_limits, addons),
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
