import { Users, FolderKanban, CheckSquare, DollarSign, AlertCircle } from 'lucide-react';

const METRIC_CONFIG = {
  clients: {
    title: 'Clientes Activos',
    getValue: (stats) => stats?.clients?.active || 0,
    icon: Users,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
  },
  projects: {
    title: 'Proyectos Activos',
    getValue: (stats) => stats?.projects?.in_progress || 0,
    icon: FolderKanban,
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-600',
  },
  tasks: {
    title: 'Tareas Pendientes',
    getValue: (stats) => (stats?.tasks?.todo || 0) + (stats?.tasks?.in_progress || 0),
    icon: CheckSquare,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
  },
  income: {
    title: 'Ingresos Netos',
    getValue: (stats) => `$${(stats?.finances?.net_income || 0).toLocaleString('es-CO')}`,
    icon: DollarSign,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600',
  },
  invoices_overdue: {
    title: 'Facturas Vencidas',
    getValue: (stats) => stats?.invoices?.overdue || 0,
    icon: AlertCircle,
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-600',
  },
};

const StatWidget = ({ widget, stats }) => {
  const metric = widget.config?.metric || 'clients';
  const config = METRIC_CONFIG[metric];

  if (!config) return null;

  const Icon = config.icon;
  const value = config.getValue(stats);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-ink-500 font-medium">{config.title}</span>
        <div className={`w-11 h-11 ${config.iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-ink-900 tracking-tight">{value}</p>
    </div>
  );
};

export default StatWidget;
