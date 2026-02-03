import { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/api';
import { Calendar, TrendingUp, Settings, Plus, RotateCcw, Check, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import WidgetGrid from '../components/dashboard/WidgetGrid';
import WidgetPicker from '../components/dashboard/WidgetPicker';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);

  const { isEditMode, toggleEditMode, setIsEditMode, resetToDefault, isLoading: widgetsLoading } = useDashboard();

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

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleSaveEdit = () => {
    setIsEditMode(false);
  };

  if (loading || widgetsLoading) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-500 mt-0.5">Resumen general de la agencia</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditMode ? (
            <>
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
              <button
                onClick={toggleEditMode}
                className="card-interactive px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-ink-900"
              >
                <Settings size={18} />
                <span className="hidden sm:inline">Personalizar</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowWidgetPicker(true)}
                className="px-4 py-2.5 flex items-center gap-2 text-sm font-medium bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
              >
                <Plus size={18} />
                Agregar Widget
              </button>
              <button
                onClick={resetToDefault}
                className="card-interactive px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-ink-900"
                title="Restaurar configuración por defecto"
              >
                <RotateCcw size={18} />
              </button>
              <button
                onClick={handleCancelEdit}
                className="card-interactive px-3 py-2.5 flex items-center gap-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <X size={18} />
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2.5 flex items-center gap-2 text-sm font-medium bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
              >
                <Check size={18} />
                Listo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="card px-4 py-3 flex items-center gap-3 border-l-4 border-l-primary-500 bg-primary-50">
          <Settings className="w-5 h-5 text-primary-600 animate-spin" style={{ animationDuration: '3s' }} />
          <p className="text-sm text-primary-800">
            <span className="font-semibold">Modo edición:</span> Arrastra los widgets para reorganizarlos, usa los botones para redimensionar o eliminar.
          </p>
        </div>
      )}

      {/* Period Info Banner - only show when not in edit mode */}
      {!isEditMode && (
        <div className="card px-4 py-3 flex items-center gap-3 border-l-4 border-l-accent">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-accent" />
          </div>
          <p className="text-sm text-ink-600">
            Mostrando datos de: <span className="font-semibold text-ink-900">{getPeriodLabel()}</span>
          </p>
        </div>
      )}


      {/* Widget Grid */}
      <WidgetGrid stats={stats} period={period} />

      {/* Widget Picker Modal */}
      <WidgetPicker isOpen={showWidgetPicker} onClose={() => setShowWidgetPicker(false)} />
    </div>
  );
};

export default Dashboard;
