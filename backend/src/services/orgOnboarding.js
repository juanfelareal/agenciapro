/**
 * Onboarding de organizaciones (registro autoservicio de agencias).
 *
 * - Asegura las columnas `organizations.plan_selected` y `organizations.trial_ends_at`.
 * - Lee/escribe `organizations.settings` (JSONB) con las claves:
 *     settings.onboarding = { completed_steps: [], tour_seen: bool, dismissed: bool, ... }
 *     settings.modules    = { clients: true, crm: true, ... }   (contrato compartido con "módulos por organización")
 *     settings.branding   = { accent: '#44BF47', theme: 'light' }
 */
import db from '../config/database.js';

export const PLAN_IDS = ['starter', 'growth', 'agencia'];
export const TRIAL_DAYS = 14;

/** Catálogo de módulos (misma lista que el frontend en components/onboarding/modules.js). */
export const MODULE_KEYS = [
  'clients', 'crm', 'projects', 'tasks', 'metricas', 'finanzas', 'invoices', 'expenses',
  'team', 'notas', 'formularios', 'sops', 'documentos', 'ugc', 'whatsapp', 'email_marketing', 'portal',
];

/** Preselección por tipo de agencia. */
export const MODULE_DEFAULTS = {
  ecommerce: {
    clients: true, crm: true, projects: true, tasks: true, metricas: true, finanzas: true,
    invoices: false, expenses: false, team: true, notas: true, formularios: false, sops: false,
    documentos: true, ugc: false, whatsapp: false, email_marketing: false, portal: true,
  },
  servicios: {
    clients: true, crm: true, projects: true, tasks: true, metricas: false, finanzas: false,
    invoices: true, expenses: true, team: true, notas: true, formularios: true, sops: true,
    documentos: true, ugc: false, whatsapp: false, email_marketing: false, portal: true,
  },
  mixta: {
    clients: true, crm: true, projects: true, tasks: true, metricas: true, finanzas: true,
    invoices: true, expenses: true, team: true, notas: true, formularios: true, sops: true,
    documentos: true, ugc: false, whatsapp: false, email_marketing: false, portal: true,
  },
};

const DEFAULT_ONBOARDING = { completed_steps: [], tour_seen: false, dismissed: false };

let columnsReady = null;
/** Agrega las columnas de plan/trial una sola vez por proceso (idempotente). */
export const ensureOnboardingColumns = async () => {
  if (!columnsReady) {
    columnsReady = (async () => {
      await db.exec(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_selected TEXT`);
      await db.exec(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP`);
    })().catch((e) => {
      columnsReady = null; // permitir reintento en la próxima llamada
      throw e;
    });
  }
  return columnsReady;
};

export const normalizePlan = (plan) => (PLAN_IDS.includes(String(plan || '').toLowerCase()) ? String(plan).toLowerCase() : null);

export const trialEndsAt = (from = new Date()) => new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

/** Solo deja claves conocidas y valores booleanos. Devuelve null si no hay nada válido. */
export const sanitizeModules = (modules) => {
  if (!modules || typeof modules !== 'object') return null;
  const out = {};
  for (const key of MODULE_KEYS) {
    if (key in modules) out[key] = Boolean(modules[key]);
  }
  return Object.keys(out).length ? out : null;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const sanitizeBranding = (branding) => {
  if (!branding || typeof branding !== 'object') return null;
  const out = {};
  if (typeof branding.accent === 'string' && HEX_RE.test(branding.accent.trim())) out.accent = branding.accent.trim().toUpperCase();
  if (branding.theme === 'light' || branding.theme === 'dark') out.theme = branding.theme;
  return Object.keys(out).length ? out : null;
};

export const parseSettings = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
};

export const getOrgSettings = async (orgId) => {
  const row = await db.get('SELECT settings FROM organizations WHERE id = ?', [orgId]);
  return parseSettings(row?.settings);
};

/** Reemplaza `settings[key]` con el objeto dado (merge superficial con lo anterior si merge=true). */
export const saveSettingsKey = async (orgId, key, value, { merge = true } = {}) => {
  const settings = await getOrgSettings(orgId);
  const prev = settings[key] && typeof settings[key] === 'object' ? settings[key] : {};
  settings[key] = merge ? { ...prev, ...value } : value;
  await db.run(
    'UPDATE organizations SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(settings), orgId]
  );
  return settings[key];
};

export const getOnboarding = (settings) => ({ ...DEFAULT_ONBOARDING, ...(settings?.onboarding || {}) });

/**
 * Construye el objeto `settings` inicial de una organización recién registrada.
 * Mantiene compatibilidad con el registro anterior (business_type, team_size, goals…).
 */
export const buildInitialSettings = ({ onboarding, modules, branding, agencyType, teamSize } = {}) => {
  const type = ['ecommerce', 'servicios', 'mixta'].includes(agencyType) ? agencyType : null;
  const safeModules = sanitizeModules(modules) || (type ? { ...MODULE_DEFAULTS[type] } : null);
  const safeBranding = sanitizeBranding(branding);
  const settings = {
    onboarding: {
      ...DEFAULT_ONBOARDING,
      completed_steps: ['account', 'agency', 'plan', 'modules'],
      agency_type: type,
      business_type: onboarding?.business_type || type || null,
      team_size: teamSize || onboarding?.team_size || null,
      goals: Array.isArray(onboarding?.goals) ? onboarding.goals : [],
      alternatives: Array.isArray(onboarding?.alternatives) ? onboarding.alternatives : [],
      how_found_us: onboarding?.how_found_us || null,
      registered_at: new Date().toISOString(),
    },
  };
  if (safeModules) settings.modules = safeModules;
  if (safeBranding) settings.branding = safeBranding;
  return settings;
};
