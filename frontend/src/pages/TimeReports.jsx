import { useState, useEffect } from 'react';
import {
  Clock,
  DollarSign,
  BarChart3,
  PieChart,
  Download,
  Calendar,
  Users,
  FolderKanban,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#84CC16'];

const TimeReports = () => {
  const [reports, setReports] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetchReports();
  }, [dateRange, customStartDate, customEndDate]);

  const getDateRange = () => {
    const today = new Date();
    switch (dateRange) {
      case 'week':
        return {
          start_date: format(subDays(today, 7), 'yyyy-MM-dd'),
          end_date: format(today, 'yyyy-MM-dd')
        };
      case 'month':
        return {
          start_date: format(startOfMonth(today), 'yyyy-MM-dd'),
          end_date: format(endOfMonth(today), 'yyyy-MM-dd')
        };
      case 'last_month':
        const lastMonth = subMonths(today, 1);
        return {
          start_date: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          end_date: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
        };
      case 'year':
        return {
          start_date: format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'),
          end_date: format(today, 'yyyy-MM-dd')
        };
      case 'custom':
        return {
          start_date: customStartDate,
          end_date: customEndDate
        };
      default:
        return {
          start_date: format(startOfMonth(today), 'yyyy-MM-dd'),
          end_date: format(endOfMonth(today), 'yyyy-MM-dd')
        };
    }
  };

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { start_date, end_date } = getDateRange();
      if (!start_date || !end_date) return;

      const res = await fetch(
        `${API_URL}/time-entries/reports?start_date=${start_date}&end_date=${end_date}`
      );
      const data = await res.json();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatHours = (minutes) => {
    if (!minutes) return '0h';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  const projectChartData = reports?.by_project?.map(p => ({
    name: p.project_name || 'Sin proyecto',
    hours: Math.round((p.total_minutes || 0) / 60 * 10) / 10,
    billable: Math.round((p.billable_minutes || 0) / 60 * 10) / 10
  })) || [];

  const userChartData = reports?.by_user?.map(u => ({
    name: u.user_name || 'Sin asignar',
    hours: Math.round((u.total_minutes || 0) / 60 * 10) / 10
  })) || [];

  const dailyChartData = reports?.by_day?.map(d => ({
    date: format(new Date(d.date), 'dd/MM', { locale: es }),
    hours: Math.round((d.total_minutes || 0) / 60 * 10) / 10,
    billable: Math.round((d.billable_minutes || 0) / 60 * 10) / 10
  })) || [];

  const pieData = reports?.by_project?.slice(0, 6).map(p => ({
    name: p.project_name || 'Sin proyecto',
    value: p.total_minutes || 0
  })) || [];

  const exportCSV = () => {
    if (!reports) return;

    const { start_date, end_date } = getDateRange();
    let csv = 'Reporte de Tiempo\n';
    csv += `Periodo: ${start_date} a ${end_date}\n\n`;

    csv += 'Tiempo por Proyecto\n';
    csv += 'Proyecto,Horas Totales,Horas Facturables,Registros\n';
    reports.by_project?.forEach(p => {
      csv += `"${p.project_name || 'Sin proyecto'}",${(p.total_minutes / 60).toFixed(2)},${(p.billable_minutes / 60).toFixed(2)},${p.entry_count}\n`;
    });

    csv += '\nTiempo por Usuario\n';
    csv += 'Usuario,Horas Totales,Horas Facturables,Registros\n';
    reports.by_user?.forEach(u => {
      csv += `"${u.user_name || 'Sin asignar'}",${(u.total_minutes / 60).toFixed(2)},${(u.billable_minutes / 60).toFixed(2)},${u.entry_count}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-tiempo-${start_date}-${end_date}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Reportes de Tiempo</h1>
          <p className="text-gray-500 text-sm mt-1">
            Análisis de horas trabajadas
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!reports}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={18} />
          Exportar CSV
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Periodo:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'week', label: 'Últimos 7 días' },
              { value: 'month', label: 'Este mes' },
              { value: 'last_month', label: 'Mes anterior' },
              { value: 'year', label: 'Este año' },
              { value: 'custom', label: 'Personalizado' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  dateRange === option.value
                    ? 'bg-[#1A1A2E] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input text-sm py-1.5"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 rounded-lg">
              <Clock size={20} className="text-success-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Horas</p>
              <p className="text-xl font-bold text-[#1A1A2E]">
                {reports?.totals?.total_hours || 0}h
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Horas Facturables</p>
              <p className="text-xl font-bold text-[#1A1A2E]">
                {reports?.totals?.billable_hours || 0}h
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <FolderKanban size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Proyectos</p>
              <p className="text-xl font-bold text-[#1A1A2E]">
                {reports?.by_project?.length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Registros</p>
              <p className="text-xl font-bold text-[#1A1A2E]">
                {reports?.totals?.entry_count || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center text-gray-500">Cargando reportes...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend Chart */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <BarChart3 size={18} />
              Horas por Día
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="h" />
                  <Tooltip
                    formatter={(value) => [`${value}h`, 'Horas']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar dataKey="hours" fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time by Project (Pie) */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <PieChart size={18} />
              Distribución por Proyecto
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name.slice(0, 15)}${name.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatHours(value)} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time by Project (Bar) */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <FolderKanban size={18} />
              Tiempo por Proyecto
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit="h" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}h`, 'Horas']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar dataKey="hours" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time by User */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <Users size={18} />
              Tiempo por Usuario
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit="h" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}h`, 'Horas']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Bar dataKey="hours" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Project Table */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#1A1A2E]">Detalle por Proyecto</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Proyecto</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600">Total</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600">Facturable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports?.by_project?.map(project => (
                  <tr key={project.project_id || 'no'} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-[#1A1A2E]">
                      {project.project_name || 'Sin proyecto'}
                    </td>
                    <td className="p-3 text-right text-gray-700">
                      {formatHours(project.total_minutes)}
                    </td>
                    <td className="p-3 text-right text-success-600">
                      {formatHours(project.billable_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By User Table */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-[#1A1A2E]">Detalle por Usuario</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-gray-600">Usuario</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600">Total</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600">Facturable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports?.by_user?.map(user => (
                  <tr key={user.user_id || 'no'} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-[#1A1A2E]">
                      {user.user_name || 'Sin asignar'}
                    </td>
                    <td className="p-3 text-right text-gray-700">
                      {formatHours(user.total_minutes)}
                    </td>
                    <td className="p-3 text-right text-success-600">
                      {formatHours(user.billable_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeReports;
