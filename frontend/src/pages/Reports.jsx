import { useState, useEffect, useRef } from 'react';
import { reportsAPI, projectsAPI, teamAPI, clientsAPI } from '../utils/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FolderKanban,
  DollarSign,
  Calendar,
  Filter,
  ChevronDown,
  Activity,
  Zap,
  Target,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

// ============================================
// ANIMATED NUMBER COMPONENT
// ============================================
const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 0, duration = 1500 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef(null);
  const animationFrame = useRef(null);

  useEffect(() => {
    const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;

    const animate = (timestamp) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(numericValue * easeOutQuart);

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    startTime.current = null;
    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [value, duration]);

  const formatNumber = (num) => {
    if (decimals === 0) return Math.round(num).toLocaleString('es-CO');
    return num.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  return <span>{prefix}{formatNumber(displayValue)}{suffix}</span>;
};

// ============================================
// GLASS CARD COMPONENT (Light Theme)
// ============================================
const GlassCard = ({ children, className = '', glow = false, glowColor = 'indigo' }) => {
  const glowColors = {
    indigo: 'shadow-[0_0_30px_rgba(99,102,241,0.12)]',
    emerald: 'shadow-[0_0_30px_rgba(16,185,129,0.12)]',
    amber: 'shadow-[0_0_30px_rgba(245,158,11,0.12)]',
    red: 'shadow-[0_0_30px_rgba(239,68,68,0.12)]',
    cyan: 'shadow-[0_0_30px_rgba(6,182,212,0.12)]',
  };

  return (
    <div className={`
      bg-white
      border border-slate-200/60
      rounded-2xl
      shadow-sm
      transition-all duration-300
      hover:shadow-md hover:border-slate-200
      ${glow ? glowColors[glowColor] : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

// ============================================
// KPI CARD COMPONENT (Light Theme)
// ============================================
const KPICard = ({ label, value, prefix = '', suffix = '', icon: Icon, trend, trendValue, color = 'indigo' }) => {
  const colorConfig = {
    indigo: { text: 'text-indigo-600', value: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    emerald: { text: 'text-emerald-600', value: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    amber: { text: 'text-amber-600', value: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    red: { text: 'text-red-600', value: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    cyan: { text: 'text-cyan-600', value: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100' },
    purple: { text: 'text-purple-600', value: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  };

  const config = colorConfig[color];

  return (
    <GlassCard className="p-6 relative overflow-hidden group" glow glowColor={color}>
      <div className="relative">
        {/* Icon */}
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${config.bg} ${config.text} mb-4`}>
          <Icon size={20} />
        </div>

        {/* Value */}
        <div className={`text-4xl font-bold ${config.value} mb-1`}>
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
        </div>

        {/* Label */}
        <p className="text-slate-500 text-sm font-medium">{label}</p>

        {/* Trend */}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-3 text-sm ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{trend >= 0 ? '+' : ''}{trendValue || trend}%</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

// ============================================
// CUSTOM TOOLTIP FOR CHARTS (Light Theme)
// ============================================
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-slate-600 text-sm mb-2 font-medium">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

// ============================================
// MAIN REPORTS COMPONENT
// ============================================
const Reports = () => {
  const [activeTab, setActiveTab] = useState('productivity');
  const [loading, setLoading] = useState(true);
  const [productivityData, setProductivityData] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [projectsData, setProjectsData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    start_date: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    project_id: '',
    user_id: '',
    client_id: '',
  });

  // Gradient colors for charts
  const CHART_COLORS = [
    { main: '#6366F1', gradient: 'url(#gradientIndigo)' },
    { main: '#10B981', gradient: 'url(#gradientEmerald)' },
    { main: '#F59E0B', gradient: 'url(#gradientAmber)' },
    { main: '#EF4444', gradient: 'url(#gradientRed)' },
    { main: '#8B5CF6', gradient: 'url(#gradientPurple)' },
    { main: '#06B6D4', gradient: 'url(#gradientCyan)' },
    { main: '#EC4899', gradient: 'url(#gradientPink)' },
  ];

  const tabs = [
    { id: 'productivity', label: 'Productividad', icon: Activity },
    { id: 'financial', label: 'Financiero', icon: DollarSign },
    { id: 'projects', label: 'Proyectos', icon: FolderKanban },
    { id: 'team', label: 'Equipo', icon: Users },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [activeTab, filters]);

  const loadInitialData = async () => {
    try {
      const [projectsRes, teamRes, clientsRes] = await Promise.all([
        projectsAPI.getAll(),
        teamAPI.getAll(),
        clientsAPI.getAll(),
      ]);
      setProjects(projectsRes.data);
      setTeamMembers(teamRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'productivity':
          const productivityRes = await reportsAPI.getProductivity(filters);
          setProductivityData(productivityRes.data);
          break;
        case 'financial':
          const financialRes = await reportsAPI.getFinancial(filters);
          setFinancialData(financialRes.data);
          break;
        case 'projects':
          const projectsRes = await reportsAPI.getProjects(filters);
          setProjectsData(projectsRes.data);
          break;
        case 'team':
          const teamRes = await reportsAPI.getTeam(filters);
          setTeamData(teamRes.data);
          break;
      }
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatCurrencyFull = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const statusLabels = {
    todo: 'Por Hacer',
    in_progress: 'En Progreso',
    review: 'En Revisión',
    done: 'Completada',
  };

  const priorityLabels = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
  };

  // ============================================
  // CHART GRADIENTS (Light Theme)
  // ============================================
  const ChartGradients = () => (
    <defs>
      <linearGradient id="gradientIndigo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#6366F1" stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradientEmerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#EF4444" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#EF4444" stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradientPurple" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.05} />
      </linearGradient>
    </defs>
  );

  // ============================================
  // PRODUCTIVITY REPORT
  // ============================================
  const renderProductivityReport = () => {
    if (!productivityData) return null;

    const statusData = productivityData.tasksByStatus.map((item) => ({
      name: statusLabels[item.status] || item.status,
      value: item.count,
    }));

    const priorityData = productivityData.tasksByPriority.map((item) => ({
      name: priorityLabels[item.priority] || item.priority,
      value: item.count,
    }));

    const successRate = productivityData.completionStats?.on_time && productivityData.completionStats?.late
      ? Math.round((productivityData.completionStats.on_time / (productivityData.completionStats.on_time + productivityData.completionStats.late)) * 100)
      : 0;

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Completadas a tiempo"
            value={productivityData.completionStats?.on_time || 0}
            icon={Zap}
            color="emerald"
          />
          <KPICard
            label="Completadas tarde"
            value={productivityData.completionStats?.late || 0}
            icon={Clock}
            color="amber"
          />
          <KPICard
            label="Tareas vencidas"
            value={productivityData.completionStats?.overdue || 0}
            icon={AlertTriangle}
            color="red"
          />
          <KPICard
            label="Tasa de éxito"
            value={successRate}
            suffix="%"
            icon={Target}
            color="indigo"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks by Status - Donut Chart */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Tareas por Estado</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <ChartGradients />
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="transparent"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length].main} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length].main }} />
                  <span className="text-sm text-slate-500">{entry.name}</span>
                  <span className="text-sm text-slate-800 font-medium">{entry.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Tasks by Priority - Bar Chart */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Tareas por Prioridad</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="url(#gradientIndigo)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        {/* Performance by User */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Rendimiento por Usuario</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productivityData.tasksPerUser} layout="vertical">
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" stroke="#64748B" fontSize={12} />
              <YAxis dataKey="name" type="category" width={120} stroke="#64748B" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#64748B' }} />
              <Bar dataKey="completed" name="Completadas" fill="#10B981" radius={[0, 4, 4, 0]} />
              <Bar dataKey="total" name="Total" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Weekly Trend */}
        {productivityData.weeklyTrend.length > 0 && (
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Tendencia Semanal</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={productivityData.weeklyTrend}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="week" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completadas"
                  stroke="#6366F1"
                  fill="url(#gradientIndigo)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>
        )}
      </div>
    );
  };

  // ============================================
  // FINANCIAL REPORT
  // ============================================
  const renderFinancialReport = () => {
    if (!financialData) return null;

    const invoiceStatusLabels = {
      draft: 'Borrador',
      approved: 'Aprobada',
      invoiced: 'Facturada',
      paid: 'Pagada',
    };

    const invoiceData = financialData.invoiceSummary.map((item) => ({
      name: invoiceStatusLabels[item.status] || item.status,
      count: item.count,
      total: item.total,
    }));

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Ingresos (12 meses)"
            value={financialData.profitSummary.revenue}
            prefix="$"
            icon={TrendingUp}
            color="emerald"
          />
          <KPICard
            label="Gastos (12 meses)"
            value={financialData.profitSummary.expenses}
            prefix="$"
            icon={TrendingDown}
            color="red"
          />
          <KPICard
            label="Utilidad neta"
            value={financialData.profitSummary.profit}
            prefix="$"
            icon={DollarSign}
            color={financialData.profitSummary.profit >= 0 ? 'emerald' : 'red'}
          />
          <KPICard
            label="Margen de ganancia"
            value={financialData.profitSummary.margin}
            suffix="%"
            icon={Target}
            color="indigo"
          />
        </div>

        {/* Outstanding Invoices Alert */}
        {financialData.outstandingInvoices.count > 0 && (
          <GlassCard className="p-4 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertTriangle className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="text-amber-700 font-medium">
                  {financialData.outstandingInvoices.count} facturas pendientes
                </p>
                <p className="text-amber-600 text-sm">
                  Total: {formatCurrencyFull(financialData.outstandingInvoices.total)}
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Month */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Ingresos Mensuales</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={financialData.revenueByMonth}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={12} />
                <YAxis tickFormatter={formatCurrency} stroke="#64748B" fontSize={12} />
                <Tooltip content={<CustomTooltip formatter={formatCurrencyFull} />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Ingresos"
                  stroke="#10B981"
                  fill="url(#gradientEmerald)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Expenses by Category */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Gastos por Categoría</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <ChartGradients />
                <Pie
                  data={financialData.expensesByCategory}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="total"
                  nameKey="category"
                  stroke="transparent"
                >
                  {financialData.expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length].main} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip formatter={formatCurrencyFull} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {financialData.expensesByCategory.map((entry, index) => (
                <div key={entry.category} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length].main }} />
                  <span className="text-xs text-slate-500">{entry.category}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Revenue by Client */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Top 10 Clientes por Ingresos</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={financialData.revenueByClient} layout="vertical">
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tickFormatter={formatCurrency} stroke="#64748B" fontSize={12} />
              <YAxis dataKey="name" type="category" width={150} stroke="#64748B" fontSize={12} />
              <Tooltip content={<CustomTooltip formatter={formatCurrencyFull} />} />
              <Bar dataKey="total_revenue" name="Ingresos" fill="url(#gradientIndigo)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Invoice Summary */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Facturas por Estado</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={invoiceData}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
              <YAxis yAxisId="left" stroke="#64748B" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={formatCurrency} stroke="#64748B" fontSize={12} />
              <Tooltip content={<CustomTooltip formatter={(v, name) => name === 'Total' ? formatCurrencyFull(v) : v} />} />
              <Legend wrapperStyle={{ color: '#64748B' }} />
              <Bar yAxisId="left" dataKey="count" name="Cantidad" fill="#6366F1" radius={[8, 8, 0, 0]} />
              <Bar yAxisId="right" dataKey="total" name="Total" fill="#10B981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    );
  };

  // ============================================
  // PROJECTS REPORT
  // ============================================
  const renderProjectsReport = () => {
    if (!projectsData) return null;

    const statusLabelsProj = {
      planning: 'Planificación',
      active: 'Activo',
      on_hold: 'En Pausa',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };

    const projectStatusData = projectsData.projectsByStatus.map((item) => ({
      name: statusLabelsProj[item.status] || item.status,
      value: item.count,
    }));

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Proyectos"
            value={projectsData.projectsOverview.length}
            icon={FolderKanban}
            color="indigo"
          />
          <KPICard
            label="Proyectos Activos"
            value={projectsData.projectsByStatus.find((s) => s.status === 'active')?.count || 0}
            icon={Activity}
            color="emerald"
          />
          <KPICard
            label="Proyectos Vencidos"
            value={projectsData.overdueProjects.length}
            icon={AlertTriangle}
            color="red"
          />
          <KPICard
            label="Completados"
            value={projectsData.projectsByStatus.find((s) => s.status === 'completed')?.count || 0}
            icon={Target}
            color="cyan"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects by Status */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Proyectos por Estado</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <ChartGradients />
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="transparent"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length].main} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {projectStatusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length].main }} />
                  <span className="text-sm text-slate-500">{entry.name}</span>
                  <span className="text-sm text-slate-800 font-medium">{entry.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Projects by Client */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Proyectos por Cliente</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectsData.projectsByClient}>
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="project_count" name="Proyectos" fill="url(#gradientPurple)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        {/* Budget Utilization */}
        {projectsData.budgetUtilization.length > 0 && (
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Utilización del Presupuesto</h3>
            <div className="space-y-4">
              {projectsData.budgetUtilization.slice(0, 8).map((project) => {
                const percentage = (project.spent / project.budget) * 100;
                const isOverBudget = percentage > 100;
                const barColor = isOverBudget ? '#EF4444' : percentage > 80 ? '#F59E0B' : '#10B981';

                return (
                  <div key={project.id}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700 font-medium">{project.name}</span>
                      <span className={isOverBudget ? 'text-red-600' : 'text-slate-500'}>
                        {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
                        <span className="ml-2 text-xs">({percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* Projects Table */}
        <GlassCard className="overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800">Detalle de Proyectos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-4 text-sm font-medium text-slate-500">Proyecto</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-500">Cliente</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-500">Estado</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-500">Tareas</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-500">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectsData.projectsOverview.slice(0, 10).map((project) => {
                  const progress = project.total_tasks > 0 ? (project.completed_tasks / project.total_tasks) * 100 : 0;
                  return (
                    <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-slate-800 font-medium">{project.name}</td>
                      <td className="p-4 text-slate-500">{project.client_name || '-'}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          project.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          project.status === 'completed' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {statusLabelsProj[project.status] || project.status}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-600">
                        {project.completed_tasks}/{project.total_tasks}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-10">{Math.round(progress)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    );
  };

  // ============================================
  // TEAM REPORT
  // ============================================
  const renderTeamReport = () => {
    if (!teamData) return null;

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Miembros Activos"
            value={teamData.teamPerformance.length}
            icon={Users}
            color="indigo"
          />
          <KPICard
            label="Tareas Sin Asignar"
            value={teamData.unassignedTasks}
            icon={AlertTriangle}
            color="amber"
          />
          <KPICard
            label="Tareas Activas"
            value={teamData.workloadDistribution.reduce((acc, m) => acc + m.active_tasks, 0)}
            icon={Activity}
            color="emerald"
          />
          <KPICard
            label="Horas Estimadas"
            value={teamData.workloadDistribution.reduce((acc, m) => acc + (m.estimated_hours || 0), 0)}
            suffix="h"
            icon={Clock}
            color="purple"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workload Distribution */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Distribución de Carga</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={teamData.workloadDistribution} layout="vertical">
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" stroke="#64748B" fontSize={12} />
                <YAxis dataKey="name" type="category" width={120} stroke="#64748B" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="active_tasks" name="Tareas Activas" fill="url(#gradientIndigo)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Completion Rates */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Tasa de Completitud (30 días)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={teamData.completionRates} layout="vertical">
                <ChartGradients />
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#64748B" fontSize={12} />
                <YAxis dataKey="name" type="category" width={120} stroke="#64748B" fontSize={12} />
                <Tooltip content={<CustomTooltip formatter={(v) => `${v?.toFixed(1)}%`} />} />
                <Bar dataKey="completion_rate" name="Tasa" fill="url(#gradientEmerald)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        {/* Team Performance Table */}
        <GlassCard className="overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800">Rendimiento del Equipo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-4 text-sm font-medium text-slate-500">Miembro</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-500">Rol</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-500">Completadas</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-500">En Progreso</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-500">Pendientes</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-500">Vencidas</th>
                  <th className="text-center p-4 text-sm font-medium text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamData.teamPerformance.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-800 font-medium">{member.name}</td>
                    <td className="p-4 text-slate-500 capitalize">{member.role}</td>
                    <td className="p-4 text-center text-emerald-600 font-medium">{member.completed_tasks}</td>
                    <td className="p-4 text-center text-cyan-600">{member.in_progress_tasks}</td>
                    <td className="p-4 text-center text-slate-500">{member.pending_tasks}</td>
                    <td className="p-4 text-center text-red-600">{member.overdue_tasks}</td>
                    <td className="p-4 text-center text-slate-800 font-semibold">{member.total_tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Tasks by Priority per Member */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Tareas por Prioridad</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamData.tasksByPriorityPerMember}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#64748B' }} />
              <Bar dataKey="urgent" name="Urgente" stackId="a" fill="#EF4444" />
              <Bar dataKey="high" name="Alta" stackId="a" fill="#F59E0B" />
              <Bar dataKey="medium" name="Media" stackId="a" fill="#3B82F6" />
              <Bar dataKey="low" name="Baja" stackId="a" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Reportes
          </h1>
          <p className="text-slate-500 text-sm mt-1">Análisis y métricas de tu agencia</p>
        </div>
      </div>

      {/* Navigation & Filters */}
      <GlassCard className="p-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              showFilters ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter size={18} />
            Filtros
            <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Desde</label>
              <input
                type="date"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Hasta</label>
              <input
                type="date"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
            {(activeTab === 'productivity' || activeTab === 'projects') && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Proyecto</label>
                <select
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  value={filters.project_id}
                  onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                >
                  <option value="">Todos</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            )}
            {activeTab === 'productivity' && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Usuario</label>
                <select
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  value={filters.user_id}
                  onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                >
                  <option value="">Todos</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
            )}
            {activeTab === 'financial' && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Cliente</label>
                <select
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  value={filters.client_id}
                  onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
                >
                  <option value="">Todos</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary-500 rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-slate-500">Cargando reporte...</p>
        </div>
      ) : (
        <>
          {activeTab === 'productivity' && renderProductivityReport()}
          {activeTab === 'financial' && renderFinancialReport()}
          {activeTab === 'projects' && renderProjectsReport()}
          {activeTab === 'team' && renderTeamReport()}
        </>
      )}

      {/* Custom animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Reports;
