import { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/api';
import { Calendar, Settings, Plus, RotateCcw, Check, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import WidgetGrid from '../components/dashboard/WidgetGrid';
import WidgetPicker from '../components/dashboard/WidgetPicker';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);

  const { isEditMode, toggleEditMode, setIsEditMode, resetToDefault, isLoading: widgetsLoading } = useDashboard();

  useEffect(() => {
    loadDashboardData();
  }, [period, customStart, customEnd]);

  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        start = new Date(y.getFullYear(), y.getMonth(), y.getDate());
        end = new Date(y.getFullYear(), y.getMonth(), y.getDate());
        break;
      }
      case 'week': {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_3_months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case 'custom':
        if (customStart && customEnd) {
          return { start: customStart, end: customEnd };
        }
        return null;
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
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'today', label: 'Hoy' },
                  { key: 'yesterday', label: 'Ayer' },
                  { key: 'week', label: 'Esta semana' },
                  { key: 'month', label: 'Este mes' },
                  { key: 'last_month', label: 'Mes pasado' },
                  { key: 'last_3_months', label: 'Últimos 3 meses' },
                  { key: 'year', label: 'Este año' },
                  { key: 'last_year', label: 'Año pasado' },
                  { key: 'all', label: 'Todo' },
                  { key: 'custom', label: 'Personalizado' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPeriod(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      period === key
                        ? 'bg-[#1A1A2E] text-white'
                        : 'bg-white text-ink-600 hover:bg-ink-100 border border-ink-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {period === 'custom' && (
                  <div className="flex items-center gap-2 ml-1">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-ink-200 rounded-lg"
                    />
                    <span className="text-xs text-ink-400">a</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-ink-200 rounded-lg"
                    />
                  </div>
                )}
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

      {/* Widget Grid */}
      <WidgetGrid stats={stats} period={period} />

      {/* Widget Picker Modal */}
      <WidgetPicker isOpen={showWidgetPicker} onClose={() => setShowWidgetPicker(false)} />
    </div>
  );
};

export default Dashboard;
