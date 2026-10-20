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
      return { key: p.key, name: p.name, price: p.price, tagline: p.tagline, limits: p.limits, modules: p.modules, recommended: !!p.recommended };
    }),
    modules: MODULES.map((m) => ({ ...m, required_plan: planForModule(m.key)?.key || null })),
    trial_days: TRIAL_DAYS,
  };
}
