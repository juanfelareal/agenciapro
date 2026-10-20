/**
 * Catálogo de módulos de Orbit — una sola fuente de verdad para:
 *  - el paso "Módulos" del registro,
 *  - el preview en vivo del sidebar,
 *  - el tour guiado (data-tour en Layout) y
 *  - el contrato PUT /api/org/modules { modules: { clave: boolean } }.
 *
 * Las claves coinciden con el backend (services/orgOnboarding.js).
 */
import {
  Users, Target, FolderKanban, CheckSquare, BarChart3, Wallet, FileText, CreditCard,
  UsersRound, StickyNote, ClipboardList, BookOpen, FileSignature, Video, MessageCircle, Mail, Globe,
} from 'lucide-react';

export const AGENCY_TYPES = [
  { id: 'ecommerce', name: 'Ecommerce', desc: 'Operas marcas que venden online (Shopify / Woo + pauta).' },
  { id: 'servicios', name: 'Servicios', desc: 'Branding, contenido, web, consultoría: proyectos y facturas.' },
  { id: 'mixta', name: 'Mixta', desc: 'Un poco de todo: marcas de ecommerce y proyectos de servicios.' },
];

export const TEAM_SIZES = [
  { id: 'solo', label: 'Solo yo' },
  { id: '2-5', label: '2 a 5' },
  { id: '6-15', label: '6 a 15' },
  { id: '16+', label: 'Más de 15' },
];

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 249000,
    for: 'Agencias que arrancan a ordenar la operación',
    features: ['Hasta 3 marcas conectadas', 'Clientes, CRM, proyectos y tareas', 'Métricas en vivo de tienda y pauta', 'Portal del cliente'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 489000,
    featured: true,
    badge: 'Recomendado',
    for: 'Agencias que venden resultados por marca',
    features: ['Hasta 10 marcas conectadas', 'Todo lo de Starter', 'Finanzas por marca: P&L diario y BE ROAS', 'Facturación y cartera', 'Resúmenes al celular del dueño'],
  },
  {
    id: 'agencia',
    name: 'Agencia',
    price: 990000,
    for: 'Operaciones con varios equipos y muchas marcas',
    features: ['Marcas ilimitadas', 'Todo lo de Growth', 'UGC: creadores y contratos', 'Bandeja de WhatsApp de la agencia', 'Acompañamiento mensual'],
  },
];

export const ACCENT_PRESETS = [
  { hex: '#44BF47', name: 'Verde Orbit' },
  { hex: '#2563EB', name: 'Azul' },
  { hex: '#7C3AED', name: 'Violeta' },
  { hex: '#F97316', name: 'Naranja' },
  { hex: '#E11D48', name: 'Rosa' },
  { hex: '#0EA5E9', name: 'Cielo' },
];

/**
 * key: contrato con el backend · tour: valor de data-tour en el sidebar (derivado de la ruta)
 * path: ruta en la app · group: agrupación visual en el paso de módulos
 */
export const MODULES = [
  { key: 'clients', name: 'Clientes', desc: 'Cada marca con su ficha, plataformas conectadas y equipo asignado.', icon: Users, path: '/app/clients', tour: 'clients', group: 'Operación' },
  { key: 'crm', name: 'CRM', desc: 'Pipeline de prospectos: de la primera llamada al contrato firmado.', icon: Target, path: '/app/crm', tour: 'crm', group: 'Operación' },
  { key: 'projects', name: 'Proyectos', desc: 'Tableros por cliente con etapas, entregables y plantillas.', icon: FolderKanban, path: '/app/projects', tour: 'projects', group: 'Operación' },
  { key: 'tasks', name: 'Tareas', desc: 'Lo de hoy, lo vencido y lo asignado a cada persona, en una vista.', icon: CheckSquare, path: '/app/tasks', tour: 'tasks', group: 'Operación' },
  { key: 'metricas', name: 'Métricas', desc: 'Ventas de tienda y pauta (Meta, Google, TikTok) cada 5 minutos.', icon: BarChart3, path: '/app/metricas', tour: 'metricas', group: 'Resultados' },
  { key: 'finanzas', name: 'Finanzas por marca', desc: 'Utilidad real día a día: ventas − producto − pauta − costos.', icon: Wallet, path: '/app/metricas', tour: 'metricas', group: 'Resultados' },
  { key: 'portal', name: 'Portal del cliente', desc: 'Tu cliente entra con su enlace y ve avances, métricas y facturas.', icon: Globe, path: '/app/clients', tour: 'clients', group: 'Resultados' },
  { key: 'invoices', name: 'Facturas y cartera', desc: 'Factura recurrente, seguimiento de cobro y recordatorios.', icon: FileText, path: '/app/invoices', tour: 'finanzas', group: 'Dinero de la agencia' },
  { key: 'expenses', name: 'Gastos', desc: 'Gastos de la agencia por categoría para ver tu margen real.', icon: CreditCard, path: '/app/expenses', tour: 'finanzas', group: 'Dinero de la agencia' },
  { key: 'team', name: 'Equipo', desc: 'Miembros, roles y permisos por pestaña. Cada quien ve lo suyo.', icon: UsersRound, path: '/app/team', tour: 'team', group: 'Equipo y conocimiento' },
  { key: 'notas', name: 'Bloc de notas', desc: 'Notas colaborativas por cliente, con comentarios y versiones.', icon: StickyNote, path: '/app/notas', tour: 'notas', group: 'Equipo y conocimiento' },
  { key: 'formularios', name: 'Formularios', desc: 'Briefs y encuestas que el cliente llena desde un enlace.', icon: ClipboardList, path: '/app/formularios', tour: 'formularios', group: 'Equipo y conocimiento' },
  { key: 'sops', name: 'SOPs', desc: 'Procesos documentados paso a paso para que nadie dependa de nadie.', icon: BookOpen, path: '/app/sops', tour: 'sops', group: 'Equipo y conocimiento' },
  { key: 'documentos', name: 'Documentos', desc: 'Contratos y NDAs con firma digital desde el portal.', icon: FileSignature, path: '/app/documentos', tour: 'documentos', group: 'Canales' },
  { key: 'ugc', name: 'UGC', desc: 'Creadores, briefs, contratos y liquidaciones de contenido.', icon: Video, path: '/app/ugc', tour: 'ugc', group: 'Canales' },
  { key: 'whatsapp', name: 'WhatsApp', desc: 'Bandeja del número de la agencia y reuniones que se vuelven tareas.', icon: MessageCircle, path: '/app/whatsapp', tour: 'whatsapp', group: 'Canales' },
  { key: 'email_marketing', name: 'Email marketing', desc: 'Campañas y flujos de cada marca con sus resultados.', icon: Mail, path: '/app/email-marketing', tour: 'email-marketing', group: 'Canales' },
];

export const MODULE_GROUPS = ['Operación', 'Resultados', 'Dinero de la agencia', 'Equipo y conocimiento', 'Canales'];

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

export const defaultModulesFor = (agencyType) => ({ ...(MODULE_DEFAULTS[agencyType] || MODULE_DEFAULTS.mixta) });

/** Ítems del sidebar que se muestran en el preview / tour según módulos activos (sin duplicar rutas). */
export const sidebarItemsFor = (modules) => {
  const seen = new Set();
  const out = [];
  for (const m of MODULES) {
    if (!modules?.[m.key]) continue;
    if (m.key === 'portal' || m.key === 'finanzas') continue; // viven dentro de Clientes / Métricas
    if (seen.has(m.path)) continue;
    seen.add(m.path);
    out.push(m);
  }
  return out;
};

export const formatCOP = (n) => '$' + Math.round(n).toLocaleString('es-CO');

export const initialsOf = (name, fallback = 'OR') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
};
