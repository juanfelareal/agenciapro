import { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/api';
import { TrendingUp, Users, FolderKanban, CheckSquare, DollarSign, Calendar } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month'); // today, week, month, year, all
  const [customDates, setCustomDates] = useState({
    start: '',
    end: ''
  });

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
      case 'custom':
        if (customDates.start && customDates.end) {
          start = new Date(customDates.start);
          end = new Date(customDates.end);
        } else {
          return null;
        }
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
      case 'custom': return 'Período Personalizado';
      case 'all': return 'Todo el Tiempo';
      default: return 'Este Mes';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const statCards = [
    {
      title: 'Clientes Activos',
      value: stats?.clients?.active || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Proyectos Activos',
      value: stats?.projects?.in_progress || 0,
      icon: FolderKanban,
      color: 'bg-green-500',
    },
    {
      title: 'Tareas Pendientes',
      value: (stats?.tasks?.todo || 0) + (stats?.tasks?.in_progress || 0),
      icon: CheckSquare,
      color: 'bg-yellow-500',
    },
    {
      title: 'Ingresos Netos',
      value: `$${(stats?.finances?.net_income || 0).toLocaleString('es-CO')}`,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-gray-600">Resumen general de la agencia</p>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="text-gray-500" size={20} />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border rounded-lg px-4 py-2 bg-white text-gray-700 font-medium"
            >
              <option value="today">Hoy</option>
              <option value="week">Esta Semana</option>
              <option value="month">Este Mes</option>
              <option value="year">Este Año</option>
              <option value="all">Todo el Tiempo</option>
            </select>
          </div>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-sm text-blue-700 font-medium">
            📊 Mostrando datos de: <span className="font-bold">{getPeriodLabel()}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Finanzas</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Facturado:</span>
              <span className="font-semibold">
                ${(stats?.finances?.total_invoiced || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Pagado:</span>
              <span className="font-semibold text-green-600">
                ${(stats?.finances?.total_paid || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pendiente de Pago:</span>
              <span className="font-semibold text-yellow-600">
                ${(stats?.finances?.total_pending || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Gastos:</span>
              <span className="font-semibold text-red-600">
                ${(stats?.finances?.total_expenses_amount || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="text-gray-800 font-semibold">Ingreso Neto:</span>
              <span className="font-bold text-lg text-primary-600">
                ${(stats?.finances?.net_income || 0).toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Proyectos</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Proyectos:</span>
              <span className="font-semibold">{stats?.projects?.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">En Progreso:</span>
              <span className="font-semibold text-blue-600">
                {stats?.projects?.in_progress || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completados:</span>
              <span className="font-semibold text-green-600">
                {stats?.projects?.completed || 0}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="text-gray-600">Presupuesto Total:</span>
              <span className="font-semibold">
                ${(stats?.projects?.total_budget || 0).toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Gastado:</span>
              <span className="font-semibold text-red-600">
                ${(stats?.projects?.total_spent || 0).toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
