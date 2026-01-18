import { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/api';
import { Users, FolderKanban, CheckSquare, DollarSign, Calendar, TrendingUp, Wallet, PieChart } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (period) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        start = weekStart;
        end = new Date();
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date();
        break;
      case 'all':
      default:
        return null;
    }

    return {
      start: start?.toISOString().split('T')[0],
      end: end?.toISOString().split('T')[0]
    };
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      const response = await dashboardAPI.getStats(dateRange);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Hoy';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mes';
      case 'year': return 'Este Año';
      case 'all': return 'Todo el Tiempo';
      default: return 'Este Mes';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-white/50 rounded-2xl animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 bg-white/50 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Clientes Activos',
      value: stats?.clients?.active || 0,
      icon: Users,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Proyectos Activos',
      value: stats?.projects?.in_progress || 0,
      icon: FolderKanban,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-600',
    },
    {
      title: 'Tareas Pendientes',
      value: (stats?.tasks?.todo || 0) + (stats?.tasks?.in_progress || 0),
      icon: CheckSquare,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
    },
    {
      title: 'Ingresos Netos',
      value: `$${(stats?.finances?.net_income || 0).toLocaleString('es-CO')}`,
      icon: DollarSign,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-500 mt-0.5">Resumen general de la agencia</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <Calendar className="text-ink-400" size={18} />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-sm font-medium text-ink-700 focus:outline-none cursor-pointer"
            >
              <option value="today">Hoy</option>
              <option value="week">Esta Semana</option>
              <option value="month">Este Mes</option>
              <option value="year">Este Año</option>
              <option value="all">Todo el Tiempo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Period Info Banner */}
      <div className="card px-4 py-3 flex items-center gap-3 border-l-4 border-l-accent">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-accent" />
        </div>
        <p className="text-sm text-ink-600">
          Mostrando datos de: <span className="font-semibold text-ink-900">{getPeriodLabel()}</span>
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="card-interactive p-5 group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-ink-500 font-medium">{card.title}</span>
                <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-semibold text-ink-900 tracking-tight">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Finances Card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-ink-900">Finanzas</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-500">Total Facturado</span>
              <span className="text-sm font-semibold text-ink-900">
                ${(stats?.finances?.total_invoiced || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-500">Total Pagado</span>
              <span className="text-sm font-semibold text-green-600">
                ${(stats?.finances?.total_paid || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-500">Pendiente de Pago</span>
              <span className="text-sm font-semibold text-amber-600">
                ${(stats?.finances?.total_pending || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-500">Total Gastos</span>
              <span className="text-sm font-semibold text-red-500">
                ${(stats?.finances?.total_expenses_amount || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="border-t border-ink-100 pt-4 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-ink-700">Ingreso Neto</span>
                <span className="text-xl font-bold text-accent">
                  ${(stats?.finances?.net_income || 0).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-ink-900">Proyectos</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-500">Total Proyectos</span>
              <span className="text-sm font-semibold text-ink-900">{stats?.projects?.total || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-500">En Progreso</span>
              <span className="text-sm font-semibold text-blue-600">
                {stats?.projects?.in_progress || 0}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-ink-500">Completados</span>
              <span className="text-sm font-semibold text-green-600">
                {stats?.projects?.completed || 0}
              </span>
            </div>
            <div className="border-t border-ink-100 pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-ink-500">Presupuesto Total</span>
                <span className="text-sm font-semibold text-ink-900">
                  ${(stats?.projects?.total_budget || 0).toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-ink-500">Gastado</span>
                <span className="text-sm font-semibold text-red-500">
                  ${(stats?.projects?.total_spent || 0).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
