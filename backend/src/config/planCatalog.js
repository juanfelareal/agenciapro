// [modules] Catálogo estático de planes y módulos de Orbit.
// Sin dependencias de base de datos: lo importan database.js (backfill),
// plans.js (servicio) y auth.js (platform admin). La fuente de verdad de
// precios/límites/módulos por plan vive aquí.

export const MODULES = [
  { key: 'dashboard', name: 'Dashboard', description: 'Resumen diario de la agencia: ventas, tareas y alertas.', always_on: true },
  { key: 'novedades', name: 'Novedades', description: 'Anuncios internos para el equipo con lectura confirmada.' },
  { key: 'clients', name: 'Clientes', description: 'Fichas de marca, contactos, integraciones y bitácora.' },
  { key: 'crm', name: 'CRM', description: 'Pipeline de prospectos y oportunidades.' },
  { key: 'email_marketing', name: 'Email marketing', description: 'Campañas y métricas de email por cliente.' },
  { key: 'whatsapp', name: 'WhatsApp', description: 'Bandeja compartida, plantillas y ventas por WhatsApp.' },
  { key: 'ugc', name: 'UGC', description: 'Creadores, proyectos UGC y contratos.' },
  { key: 'documentos', name: 'Documentos', description: 'Plantillas de NDA y contratos con firma.' },
  { key: 'projects', name: 'Proyectos', description: 'Tableros por cliente con etapas y entregables.' },
  { key: 'plantillas', name: 'Plantillas de proyecto', description: 'Proyectos reutilizables con tareas predefinidas.' },
  { key: 'tasks', name: 'Tareas', description: 'Tareas del equipo con vistas, dependencias y comentarios.' },
  { key: 'reuniones', name: 'Reuniones', description: 'Transcripciones que se convierten en tareas.' },
  { key: 'calendario', name: 'Calendario', description: 'Vista de fechas de tareas y entregas.' },
  { key: 'metricas', name: 'Métricas', description: 'Meta Ads, Shopify, Google y TikTok por cliente.' },
  { key: 'finanzas', name: 'Finanzas por cliente', description: 'Dashboard financiero por marca y escenarios.' },
  { key: 'invoices', name: 'Facturas y cartera', description: 'Facturación recurrente y seguimiento de cobros.' },
  { key: 'expenses', name: 'Gastos', description: 'Gastos de la agencia por categoría.' },
  { key: 'comisiones', name: 'Comisiones', description: 'Comisiones del equipo sobre ventas.' },
  { key: 'siigo', name: 'Siigo', description: 'Sincronización contable con Siigo Nube.' },
  { key: 'payroll', name: 'Nómina', description: 'Nómina del equipo (integración Aleluya).' },
  { key: 'team', name: 'Equipo', description: 'Miembros, roles y permisos.' },
  { key: 'notas', name: 'Bloc de notas', description: 'Notas colaborativas y compartibles.' },
  { key: 'formularios', name: 'Formularios', description: 'Formularios para clientes y asignaciones.' },
  { key: 'sops', name: 'SOPs', description: 'Procedimientos operativos del equipo.' },
  { key: 'reportes', name: 'Reportes', description: 'Reportes de desempeño y exportables.' },
  { key: 'automatizaciones', name: 'Automatizaciones', description: 'Reglas automáticas sobre tareas y proyectos.' },
  { key: 'portal', name: 'Portal del cliente', description: 'Acceso del cliente a proyectos, métricas y facturas.' },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
export const ALWAYS_ON = MODULES.filter((m) => m.always_on).map((m) => m.key);

const STARTER_MODULES = [
  'dashboard', 'novedades', 'clients', 'crm', 'projects', 'tasks', 'calendario',
  'metricas', 'portal', 'notas', 'documentos', 'team',
];
const GROWTH_MODULES = [
  ...STARTER_MODULES,
  'finanzas', 'reuniones', 'whatsapp', 'invoices', 'expenses', 'comisiones',
  'formularios', 'reportes', 'email_marketing', 'plantillas', 'sops',
];
const AGENCIA_MODULES = [...GROWTH_MODULES, 'ugc', 'siigo', 'payroll', 'automatizaciones'];

export const TRIAL_DAYS = 14;

// Precios en COP/mes, sin IVA. `null` en un límite = ilimitado.
export const PLANS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    price: 249000,
    tagline: 'Para agencias que empiezan a ordenar la operación.',
    limits: { brands: 3, users: 3 },
    modules: STARTER_MODULES,
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    price: 489000,
    tagline: 'Para agencias con pauta activa y equipo creciendo.',
    limits: { brands: 10, users: 10 },
    modules: GROWTH_MODULES,
    recommended: true,
  },
  agencia: {
    key: 'agencia',
    name: 'Agencia',
    price: 990000,
    tagline: 'Sin límites: UGC, Siigo, nómina y automatizaciones.',
    limits: { brands: null, users: null },
    modules: AGENCIA_MODULES,
  },
  trial: {
    key: 'trial',
    name: 'Prueba',
    price: 0,
    tagline: `${TRIAL_DAYS} días con todo lo de Growth.`,
    limits: { brands: 10, users: 10 },
    modules: GROWTH_MODULES,
    hidden: true,
  },
};

// Planes que un admin puede elegir (orden de menor a mayor)
export const SELECTABLE_PLANS = ['starter', 'growth', 'agencia'];

// ---------------------------------------------------------------------------
// [billing] Facturación: IVA, comisión de Bold, plan anual y add-ons
// ---------------------------------------------------------------------------
export const IVA = 0.19;
export const BOLD_FEE = { pct: 0.0299, fixed: 900 }; // + IVA sobre la comisión
export const ANNUAL_MONTHS = 10;          // el anual se paga como 10 meses por 12
export const PRICE_LOCK_MONTHS = 24;      // precio congelado (anual)
export const GUARANTEE_DAYS = 30;         // garantía de devolución (anual)
export const BILLING_CYCLES = ['monthly', 'annual'];

/**
 * Add-ons mensuales (COP/mes, sin IVA).
 *  - `field`: clave dentro de organizations.addons (JSONB).
 *  - `type`: 'boolean' (se activa/desactiva) o 'count' (entero ≥ 0, se cobra por unidad).
 *  - `plans`: planes donde se puede contratar. El plan de prueba se comporta como Growth.
 */
export const ADDONS = [
  {
    key: 'hourly_reports', field: 'hourly_reports', type: 'boolean',
    name: 'Reportes cada hora por WhatsApp',
    description: 'Alertas de ventas y pauta cada hora (10 a 21 h) al WhatsApp de la agencia.',
    price: 59000, unit: 'agencia', plans: ['growth', 'agencia'],
  },
  {
    key: 'owner_reports', field: 'owner_reports', type: 'boolean',
    name: 'Reporte diario al dueño de cada marca',
    description: 'Cada mañana, el dueño de cada marca recibe por WhatsApp el resumen de ayer. Se cobra por marca activada.',
    price: 19000, unit: 'marca', plans: ['starter', 'growth', 'agencia'],
  },
  {
    key: 'dedicated_number', field: 'dedicated_number', type: 'boolean',
    name: 'Número de WhatsApp propio de la agencia',
    description: 'Los reportes salen desde un número con el nombre de tu agencia, no desde el de Orbit.',
    price: 89000, unit: 'agencia', plans: ['growth', 'agencia'],
  },
  {
    key: 'extra_user', field: 'extra_users', type: 'count',
    name: 'Usuario adicional',
    description: 'Un asiento más para tu equipo por encima del límite del plan.',
    price: 29000, unit: 'usuario', plans: ['starter', 'growth'],
  },
  {
    key: 'extra_brand', field: 'extra_brands', type: 'count',
    name: 'Marca adicional',
    description: 'Una marca (cliente activo) más por encima del límite del plan.',
    price: 39000, unit: 'marca', plans: ['starter', 'growth'],
  },
];
export const ADDON_KEYS = ADDONS.map((a) => a.key);
export const ADDON_FIELDS = ADDONS.map((a) => a.field);

export function addonInfo(keyOrField) {
  return ADDONS.find((a) => a.key === keyOrField || a.field === keyOrField) || null;
}

/** Plan más barato donde se puede contratar el add-on. */
export function planForAddon(keyOrField) {
  const a = addonInfo(keyOrField);
  if (!a) return null;
  for (const planKey of SELECTABLE_PLANS) if (a.plans.includes(planKey)) return PLANS[planKey];
  return null;
}

/** Precio anual = 10 meses por 12. */
export function annualPrice(planKey) {
  const plan = PLANS[planKey];
  if (!plan || !plan.price) return 0;
  return plan.price * ANNUAL_MONTHS;
}

/** Ahorro frente a pagar 12 meses. */
export function annualSavings(planKey) {
  const plan = PLANS[planKey];
  if (!plan || !plan.price) return 0;
  return plan.price * 12 - annualPrice(planKey);
}

// "Incluido al iniciar" del plan anual, con su valor (COP, sin IVA). Nunca la palabra "Regalo".
// Keys de add-on (owner_reports, hourly_reports, dedicated_number) activan el add-on por regla.
const STARTER_ANNUAL_INCLUDES = [
  { key: 'implementation', label: 'Implementación acompañada', value: 600000 },
  { key: 'owner_reports', label: 'Reporte diario al dueño en tus 3 marcas (12 meses)', value: 684000 },
];
const GROWTH_ANNUAL_INCLUDES = [
  { key: 'implementation', label: 'Implementación acompañada', value: 1200000 },
  { key: 'hourly_reports', label: 'Reportes cada hora por WhatsApp (12 meses)', value: 708000 },
  { key: 'owner_reports', label: 'Reporte diario al dueño hasta en 10 marcas (12 meses)', value: 2280000 },
  { key: 'numbers_session', label: 'Sesión de números con Juanfe (90 min)', value: 800000 },
];
const AGENCIA_ANNUAL_INCLUDES = [
  { key: 'implementation', label: 'Implementación acompañada', value: 1200000 },
  { key: 'hourly_reports', label: 'Reportes cada hora por WhatsApp (12 meses)', value: 708000 },
  { key: 'owner_reports', label: 'Reporte diario al dueño sin límite de marcas (12 meses)', value: 2280000 },
  { key: 'dedicated_number', label: 'Número de WhatsApp propio de la agencia (12 meses)', value: 1068000 },
  { key: 'numbers_session', label: 'Sesión de números con Juanfe (90 min)', value: 800000 },
  { key: 'quarterly_reviews', label: '4 sesiones trimestrales con Juanfe', value: 3200000 },
];
PLANS.starter.annual_includes = STARTER_ANNUAL_INCLUDES;
PLANS.growth.annual_includes = GROWTH_ANNUAL_INCLUDES;
PLANS.agencia.annual_includes = AGENCIA_ANNUAL_INCLUDES;
PLANS.trial.annual_includes = [];

/** Keys de add-on que el anual de un plan incluye (p. ej. ['hourly_reports','owner_reports']). */
export function annualIncludedAddons(planKey) {
  const list = PLANS[planKey]?.annual_includes || [];
  return list.map((i) => i.key).filter((k) => ADDON_KEYS.includes(k));
}

export function annualIncludesValue(planKey) {
  return (PLANS[planKey]?.annual_includes || []).reduce((sum, i) => sum + (Number(i.value) || 0), 0);
}
export const PLAN_STATUSES = ['trial', 'active', 'past_due', 'canceled'];

export const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || 'juanfe@larealmarketing.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const isPlatformAdminEmail = (email) =>
  !!email && PLATFORM_ADMIN_EMAILS.includes(String(email).trim().toLowerCase());

/** Mapa { clave: boolean } con los módulos por defecto de un plan. */
export function defaultModulesFor(planKey) {
  const plan = PLANS[planKey] || PLANS.starter;
  const out = {};
  for (const key of MODULE_KEYS) out[key] = plan.modules.includes(key);
  for (const key of ALWAYS_ON) out[key] = true;
  return out;
}

/** Mapa con todos los módulos encendidos (LA REAL). */
export function allModulesOn() {
  const out = {};
  for (const key of MODULE_KEYS) out[key] = true;
  return out;
}

/** Plan más barato que incluye el módulo (para el mensaje "Disponible en Growth"). */
export function planForModule(key) {
  for (const planKey of SELECTABLE_PLANS) {
    if (PLANS[planKey].modules.includes(key)) return PLANS[planKey];
  }
  return null;
}

export function moduleInfo(key) {
  return MODULES.find((m) => m.key === key) || null;
}

/** Catálogo público para el frontend (sin el plan de prueba). */
export function publicCatalog() {
  return {
    plans: SELECTABLE_PLANS.map((k) => {
      const p = PLANS[k];
      return {
        key: p.key, name: p.name, price: p.price, tagline: p.tagline, limits: p.limits, modules: p.modules,
        recommended: !!p.recommended,
        annual_price: annualPrice(k),
        annual_savings: annualSavings(k),
        annual_includes: p.annual_includes || [],
        annual_includes_value: annualIncludesValue(k),
        addons: ADDONS.filter((a) => a.plans.includes(k)).map((a) => a.key),
      };
    }),
    modules: MODULES.map((m) => ({ ...m, required_plan: planForModule(m.key)?.key || null })),
    addons: ADDONS.map((a) => ({ ...a, required_plan: planForAddon(a.key)?.key || null })),
    annual: { months: ANNUAL_MONTHS, price_lock_months: PRICE_LOCK_MONTHS, guarantee_days: GUARANTEE_DAYS },
    billing: { iva: IVA, bold_fee: BOLD_FEE, cycles: BILLING_CYCLES },
    trial_days: TRIAL_DAYS,
  };
}
