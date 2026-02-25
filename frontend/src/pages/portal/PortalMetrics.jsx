import { useState, useEffect } from 'react';
import { usePortal } from '../../context/PortalContext';
import { portalMetricsAPI } from '../../utils/portalApi';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MousePointer,
  Eye,
  ShoppingCart,
  Users,
  Loader2,
  Calendar,
  AlertCircle,
  Lightbulb,
  Video,
  Target,
  Receipt,
  Percent
} from 'lucide-react';

export default function PortalMetrics() {
  const { hasPermission } = usePortal();
  const [metrics, setMetrics] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [summaryRes, dailyRes, insightRes] = await Promise.all([
        portalMetricsAPI.getSummary({ range: dateRange }),
        portalMetricsAPI.getDaily({ range: dateRange }),
        portalMetricsAPI.getInsight().catch(() => null),
      ]);
      setMetrics(summaryRes);
      setDailyData(dailyRes || []);
      setInsight(insightRes);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('es-CO').format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(2)}%`;
  };

  const formatCompactCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const TrendIndicator = ({ value, inverted = false }) => {
    const isPositive = inverted ? value < 0 : value > 0;
    return (
      <span className={`inline-flex items-center gap-1 text-sm font-medium ${
        isPositive ? 'text-green-600' : value === 0 ? 'text-gray-400' : 'text-red-500'
      }`}>
        {value > 0 ? (
          <TrendingUp className="w-4 h-4" />
        ) : value < 0 ? (
          <TrendingDown className="w-4 h-4" />
        ) : null}
        {value > 0 ? '+' : ''}{value?.toFixed(1)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const hasData = metrics?.facebook || metrics?.shopify;

  // Prepare chart data
  const chartData = dailyData.map(d => ({
    date: d.metric_date,
    revenue: d.shopify_revenue || 0,
    adSpend: d.fb_spend || 0,
    roas: d.overall_roas || d.fb_roas || 0,
    hookRate: d.fb_hook_rate || 0,
    holdRate: d.fb_hold_rate || 0,
  }));

  const hasVideoData = chartData.some(d => d.hookRate > 0 || d.holdRate > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Métricas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rendimiento de tus campañas y ventas</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1">
          {[
            { value: '7d', label: '7 días' },
            { value: '30d', label: '30 días' },
            { value: '90d', label: '90 días' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === option.value
                  ? 'bg-[#1A1A2E] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Insight Card */}
      {insight?.content && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl border border-green-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Lightbulb className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1A1A2E] mb-1">Insight Semanal</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{insight.content}</p>
            </div>
          </div>
        </div>
      )}

      {!hasData ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">Sin métricas disponibles</h3>
          <p className="text-gray-500">
            No hay datos de métricas conectados para tu cuenta.
          </p>
        </div>
      ) : (
        <>
          {/* Facebook Ads Metrics */}
          {metrics?.facebook && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                Facebook Ads
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ad Spend */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-[#1A1A2E]" />
                    </div>
                    <TrendIndicator value={metrics.facebook.spend_change} inverted />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatCurrency(metrics.facebook.spend)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Inversión</p>
                </div>

                {/* Impressions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <TrendIndicator value={metrics.facebook.impressions_change} />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatNumber(metrics.facebook.impressions)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Impresiones</p>
                </div>

                {/* Clicks */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <MousePointer className="w-5 h-5 text-green-600" />
                    </div>
                    <TrendIndicator value={metrics.facebook.clicks_change} />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatNumber(metrics.facebook.clicks)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Clics</p>
                </div>

                {/* CTR */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                    </div>
                    <TrendIndicator value={metrics.facebook.ctr_change} />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatPercent(metrics.facebook.ctr)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">CTR</p>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Conversions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Conversiones</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatNumber(metrics.facebook.conversions)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.facebook.conversions_change} />
                  </div>
                </div>

                {/* CPA */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Costo por Conversión</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.facebook.cpa)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.facebook.cpa_change} inverted />
                  </div>
                </div>

                {/* ROAS */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">ROAS</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {(metrics.facebook.roas || 0).toFixed(2)}x
                      </p>
                    </div>
                    <TrendIndicator value={metrics.facebook.roas_change} />
                  </div>
                </div>
              </div>

              {/* Cost Efficiency Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* CPM */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">CPM</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.facebook.cpm)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.facebook.cpm_change} inverted />
                  </div>
                </div>

                {/* Cost per Purchase */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Costo por Compra</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.facebook.cost_per_purchase)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.facebook.cost_per_purchase_change} inverted />
                  </div>
                </div>

                {/* Cost per Landing Page View */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Costo por Visita</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.facebook.cost_per_landing_page_view)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.facebook.cost_per_landing_page_view_change} inverted />
                  </div>
                </div>
              </div>

              {/* Creative Performance (only if video data exists) */}
              {(metrics.facebook.hook_rate > 0 || metrics.facebook.hold_rate > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Rendimiento Creativo
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Hook Rate */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Hook Rate (3s)</p>
                          <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                            {formatPercent(metrics.facebook.hook_rate)}
                          </p>
                        </div>
                        <TrendIndicator value={metrics.facebook.hook_rate_change} />
                      </div>
                    </div>

                    {/* Hold Rate */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Hold Rate (ThruPlay)</p>
                          <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                            {formatPercent(metrics.facebook.hold_rate)}
                          </p>
                        </div>
                        <TrendIndicator value={metrics.facebook.hold_rate_change} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shopify Metrics */}
          {metrics?.shopify && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-green-600" />
                </div>
                Shopify
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Revenue */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <TrendIndicator value={metrics.shopify.revenue_change} />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatCurrency(metrics.shopify.revenue)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Ingresos</p>
                </div>

                {/* Orders */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-blue-600" />
                    </div>
                    <TrendIndicator value={metrics.shopify.orders_change} />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatNumber(metrics.shopify.orders)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Pedidos</p>
                </div>

                {/* AOV */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-[#1A1A2E]" />
                    </div>
                    <TrendIndicator value={metrics.shopify.aov_change} />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatCurrency(metrics.shopify.aov)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Ticket Promedio</p>
                </div>

                {/* Customers */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-amber-600" />
                    </div>
                    <TrendIndicator value={metrics.shopify.customers_change} />
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {formatNumber(metrics.shopify.customers)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Clientes</p>
                </div>
              </div>

              {/* Additional Shopify Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tax */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Impuestos</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.shopify.total_tax)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.shopify.total_tax_change} />
                  </div>
                </div>

                {/* Discounts */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Descuentos</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.shopify.total_discounts)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.shopify.total_discounts_change} inverted />
                  </div>
                </div>

                {/* Sessions (conditional) */}
                {metrics.shopify.sessions > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Sesiones</p>
                        <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                          {formatNumber(metrics.shopify.sessions)}
                        </p>
                      </div>
                      <TrendIndicator value={metrics.shopify.sessions_change} />
                    </div>
                  </div>
                )}

                {/* Conversion Rate (conditional) */}
                {metrics.shopify.conversion_rate > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Tasa de Conversión</p>
                        <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                          {formatPercent(metrics.shopify.conversion_rate)}
                        </p>
                      </div>
                      <TrendIndicator value={metrics.shopify.conversion_rate_change} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Charts */}
          {chartData.length > 1 && (
            <div className="space-y-6">
              {/* Revenue vs Ad Spend */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">Ingresos vs Inversión Publicitaria</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        const d = new Date(v + 'T00:00:00');
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCompactCurrency}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                      formatter={(value, name) => [formatCurrency(value), name === 'revenue' ? 'Ingresos' : 'Inversión Ads']}
                      labelFormatter={(v) => {
                        const d = new Date(v + 'T00:00:00');
                        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                      }}
                    />
                    <Legend formatter={(v) => v === 'revenue' ? 'Ingresos' : 'Inversión Ads'} />
                    <Line type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="adSpend" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ROAS Trend */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">Tendencia ROAS</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="roasGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        const d = new Date(v + 'T00:00:00');
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v.toFixed(1)}x`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                      formatter={(value) => [`${Number(value).toFixed(2)}x`, 'ROAS']}
                      labelFormatter={(v) => {
                        const d = new Date(v + 'T00:00:00');
                        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                      }}
                    />
                    <Area type="monotone" dataKey="roas" stroke="#8B5CF6" strokeWidth={2} fill="url(#roasGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Video Performance Chart (Hook Rate + Hold Rate) */}
              {hasVideoData && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                  <h3 className="text-base font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-500" />
                    Rendimiento de Video
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#9CA3AF' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => {
                          const d = new Date(v + 'T00:00:00');
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#9CA3AF' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                        formatter={(value, name) => [
                          `${Number(value).toFixed(2)}%`,
                          name === 'hookRate' ? 'Hook Rate' : 'Hold Rate'
                        ]}
                        labelFormatter={(v) => {
                          const d = new Date(v + 'T00:00:00');
                          return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
                        }}
                      />
                      <Legend formatter={(v) => v === 'hookRate' ? 'Hook Rate (3s)' : 'Hold Rate (ThruPlay)'} />
                      <Line type="monotone" dataKey="hookRate" stroke="#F59E0B" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="holdRate" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-800">Datos actualizados diariamente</p>
          <p className="text-sm text-blue-700 mt-1">
            Las métricas se sincronizan automáticamente cada 24 horas.
          </p>
        </div>
      </div>
    </div>
  );
}
