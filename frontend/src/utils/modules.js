// [modules] Catálogo de módulos del lado del cliente: iconos y mapa ruta → módulo.
// Nombres, descripciones y planes vienen del backend (GET /api/org/plan → catalog).
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Target,
  Mail,
  MessageCircle,
  Video,
  FileSignature,
  FolderKanban,
  Copy,
  CheckSquare,
  ClipboardList,
  CalendarDays,
  BarChart3,
  Wallet,
  FileText,
  CreditCard,
  Percent,
  Link2,
  Banknote,
  UsersRound,
  StickyNote,
  FormInput,
  BookOpen,
  FileBarChart,
  Zap,
  Globe,
  Puzzle,
} from 'lucide-react';

export const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  novedades: Megaphone,
  clients: Users,
  crm: Target,
  email_marketing: Mail,
  whatsapp: MessageCircle,
  ugc: Video,
  documentos: FileSignature,
  projects: FolderKanban,
  plantillas: Copy,
  tasks: CheckSquare,
  reuniones: ClipboardList,
  calendario: CalendarDays,
  metricas: BarChart3,
  finanzas: Wallet,
  invoices: FileText,
  expenses: CreditCard,
  comisiones: Percent,
  siigo: Link2,
  payroll: Banknote,
  team: UsersRound,
  notas: StickyNote,
  formularios: FormInput,
  sops: BookOpen,
  reportes: FileBarChart,
  automatizaciones: Zap,
  portal: Globe,
};

export const moduleIcon = (key) => MODULE_ICONS[key] || Puzzle;

// Prefijos de ruta del frontend → módulo. El más específico primero.
const MODULE_PATHS = [
  ['/app/clients', 'clients'],
  ['/app/crm', 'crm'],
  ['/app/email-marketing', 'email_marketing'],
  ['/app/whatsapp', 'whatsapp'],
  ['/app/ugc', 'ugc'],
  ['/app/documentos', 'documentos'],
  ['/app/projects', 'projects'],
  ['/app/plantillas-proyecto', 'plantillas'],
  ['/app/tasks', 'tasks'],
  ['/app/reuniones', 'reuniones'],
  ['/app/calendario', 'calendario'],
  ['/app/metricas', 'metricas'],
  ['/app/growth', 'finanzas'],
  ['/app/finanzas-dashboard', 'finanzas'],
  ['/app/invoices', 'invoices'],
  ['/app/cartera', 'invoices'],
  ['/app/expenses', 'expenses'],
  ['/app/comisiones', 'comisiones'],
  ['/app/siigo', 'siigo'],
  ['/app/team', 'team'],
  ['/app/notas', 'notas'],
  ['/app/formularios', 'formularios'],
  ['/app/sops', 'sops'],
  ['/app/reportes', 'reportes'],
  ['/app/automatizaciones', 'automatizaciones'],
  ['/app/novedades', 'novedades'],
];

/** Módulo al que pertenece una ruta del frontend (null si no está mapeada). */
export function moduleForPath(pathname = '') {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const [prefix, key] of MODULE_PATHS) {
    if (path === prefix || path.startsWith(prefix + '/')) return key;
  }
  return null;
}

export const PLAN_LABELS = { trial: 'Prueba', starter: 'Starter', growth: 'Growth', agencia: 'Agencia' };
export const STATUS_LABELS = { trial: 'En prueba', active: 'Activo', past_due: 'Pago pendiente', canceled: 'Cancelado' };

export const formatCOP = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;
