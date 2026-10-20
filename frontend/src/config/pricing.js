/**
 * Oferta comercial de Orbit — ÚNICA fuente de verdad para precios.
 * La usan la Landing (/), el Registro (/register) y Suscripción (/app/suscripcion).
 *
 * Reglas:
 *  - Precios en COP sin IVA (IVA 19 % se muestra aparte con `withIva`).
 *  - Anual = paga 10 meses, usa 12. Precio congelado 24 meses. Garantía 30 días.
 *  - Lo que viene con el anual se etiqueta SIEMPRE "Incluido al iniciar" con su valor.
 *    Nunca "Regalo" ni "gratis".
 */

export const IVA_RATE = 0.19;
export const TRIAL_DAYS = 14;
export const PRICE_LOCK_MONTHS = 24;
export const GUARANTEE_DAYS = 30;

export const fmtCOP = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
export const withIva = (n) => Math.round((Number(n) || 0) * (1 + IVA_RATE));
export const ivaOf = (n) => Math.round((Number(n) || 0) * IVA_RATE);

export const CYCLES = {
  monthly: { key: 'monthly', label: 'Mensual', short: 'mes', per: '/ mes' },
  annual: { key: 'annual', label: 'Anual', short: 'año', per: '/ año', chip: 'Paga 10, usa 12' },
};

export const CYCLE_KEYS = ['monthly', 'annual'];
export const normalizeCycle = (v) => (String(v || '').toLowerCase() === 'monthly' ? 'monthly' : 'annual');

/* ------------------------------------------------------------------ */
/* Add-ons (mensuales)                                                  */
/* ------------------------------------------------------------------ */

export const ADDONS = [
  {
    key: 'hourly_reports',
    name: 'Reportes cada hora por WhatsApp',
    desc: 'Ventas, pauta y ROAS de todas tus marcas, cada hora, al WhatsApp de la agencia.',
    price: 59000,
    unit: 'mes · por agencia',
    type: 'bool',
    plans: ['growth', 'agencia'],
    whatsapp: true,
  },
  {
    key: 'owner_reports',
    name: 'Reporte diario al dueño de cada marca',
    desc: 'A las 6:00 el rendimiento de ayer y a las 12:00 las ventas del día, al celular del dueño.',
    price: 19000,
    unit: 'mes · por marca',
    type: 'bool',
    plans: ['starter', 'growth', 'agencia'],
    whatsapp: true,
  },
  {
    key: 'dedicated_number',
    name: 'Número de WhatsApp propio de la agencia',
    desc: 'Los reportes y la bandeja salen desde un número de tu agencia, con tu nombre.',
    price: 89000,
    unit: 'mes',
    type: 'bool',
    plans: ['growth', 'agencia'],
    note: 'Pensado para Agencia; opcional en Growth.',
    whatsapp: true,
  },
  {
    key: 'extra_user',
    name: 'Usuario adicional',
    desc: 'Una persona más de tu equipo, con su PIN y sus permisos.',
    price: 29000,
    unit: 'mes · por usuario',
    type: 'int',
    countKey: 'extra_users',
    plans: ['starter', 'growth'],
  },
  {
    key: 'extra_brand',
    name: 'Marca adicional',
    desc: 'Una marca más conectada por encima del límite de tu plan.',
    price: 39000,
    unit: 'mes · por marca',
    type: 'int',
    countKey: 'extra_brands',
    plans: ['starter', 'growth'],
  },
];

export const ADDONS_BY_KEY = Object.fromEntries(ADDONS.map((a) => [a.key, a]));
export const WHATSAPP_ADDON_KEYS = ADDONS.filter((a) => a.whatsapp).map((a) => a.key);
export const addonsForPlan = (planKey) => ADDONS.filter((a) => a.plans.includes(planKey));

/* ------------------------------------------------------------------ */
/* Planes                                                               */
/* ------------------------------------------------------------------ */

const impl = (value) => ({ key: 'implementation', label: 'Implementación acompañada por LA REAL', value });
const owner = (brands, value) => ({
  key: 'owner_reports',
  label: `Reporte diario al dueño de ${brands}, 12 meses`,
  value,
  addon: 'owner_reports',
});
const hourly = { key: 'hourly_reports', label: 'Reportes cada hora por WhatsApp, 12 meses', value: 708000, addon: 'hourly_reports' };
const numbers = { key: 'numbers_session', label: 'Sesión de números con Juanfe, 90 min: BE ROAS y punto de equilibrio', value: 800000 };

export const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    for: 'Agencias que arrancan a ordenar la operación',
    monthly: 249000,
    annual: 2490000,
    limits: { brands: 3, users: 3 },
    features: [
      'Clientes, CRM, proyectos y tareas',
      'Métricas en vivo (Shopify / Woo + pauta)',
      'Portal del cliente',
    ],
    included: [impl(600000), owner('sus 3 marcas', 684000)],
    includedAddons: ['owner_reports'],
    cta: 'Agenda una demo',
  },
  {
    key: 'growth',
    name: 'Growth',
    for: 'Agencias que venden resultados por marca',
    monthly: 489000,
    annual: 4890000,
    recommended: true,
    badge: 'Recomendado',
    limits: { brands: 10, users: 10 },
    features: [
      'Todo lo de Starter',
      'Finanzas por marca: P&L diario, BE ROAS y escenarios',
      'Reuniones → tareas con IA',
      'Facturación y cartera',
    ],
    included: [impl(1200000), hourly, owner('hasta 10 marcas', 2280000), numbers],
    includedAddons: ['hourly_reports', 'owner_reports'],
    cta: 'Agenda una demo',
  },
  {
    key: 'agencia',
    name: 'Agencia',
    for: 'Operaciones con varios equipos y muchas marcas',
    monthly: 990000,
    annual: 9900000,
    limits: { brands: null, users: null },
    features: [
      'Todo lo de Growth',
      'UGC: creadores, contratos y onboarding',
      'Bandeja de WhatsApp del número de la agencia',
      'Acompañamiento mensual de LA REAL',
    ],
    included: [
      impl(1200000),
      hourly,
      owner('todas sus marcas', 2280000),
      numbers,
      { key: 'dedicated_number', label: 'Número de WhatsApp propio, 12 meses', value: 1068000, addon: 'dedicated_number' },
      { key: 'quarterly_review', label: 'Revisión trimestral de números con Juanfe, 4 sesiones', value: 3200000 },
    ],
    includedAddons: ['hourly_reports', 'owner_reports', 'dedicated_number'],
    cta: 'Hablemos',
  },
];

export const PLANS_BY_KEY = Object.fromEntries(PLANS.map((p) => [p.key, p]));
export const getPlan = (key) => PLANS_BY_KEY[String(key || '').toLowerCase()] || null;
export const DEFAULT_PLAN = 'growth';

/* ------------------------------------------------------------------ */
/* Helpers de cálculo                                                   */
/* ------------------------------------------------------------------ */

/** Precio del ciclo (sin IVA). */
export const priceFor = (plan, cycle) => (cycle === 'annual' ? plan.annual : plan.monthly);
/** Equivalente mensual del anual (sin IVA). */
export const monthlyEquivalent = (plan) => Math.round(plan.annual / 12);
/** Lo que cuesta pagar 12 meses sueltos (lo que se tacha). */
export const monthlyTimes12 = (plan) => plan.monthly * 12;
/** Ahorro del anual frente a 12 meses sueltos. */
export const annualSavings = (plan) => monthlyTimes12(plan) - plan.annual;
/** Suma de "Incluido al iniciar". */
export const includedTotal = (plan) => (plan.included || []).reduce((s, i) => s + (i.value || 0), 0);
/** Texto de límites ("Hasta 3 marcas · 3 usuarios" / "Marcas y usuarios sin límite"). */
export const limitsLabel = (plan) => {
  const { brands, users } = plan.limits || {};
  if (brands == null && users == null) return 'Marcas y usuarios sin límite';
  return `Hasta ${brands} marcas · ${users} usuarios`;
};

export const INCLUDED_LABEL = 'Incluido al iniciar';
export const PRICE_LOCK_LABEL = `Precio congelado ${PRICE_LOCK_MONTHS} meses`;
export const GUARANTEE_LABEL = `Garantía ${GUARANTEE_DAYS} días`;
export const ANNUAL_PITCH = 'Paga 10 meses, usa 12.';
