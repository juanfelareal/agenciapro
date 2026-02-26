import { useState, useEffect } from 'react';
import { usePortal } from '../../context/PortalContext';
import { portalMetricsAPI } from '../../utils/portalApi';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
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
  Percent,
  ExternalLink,
  Package
} from 'lucide-react';

export default function PortalMetrics() {
  const { hasPermission } = usePortal();
  const [metrics, setMetrics] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [ads, setAds] = useState(null);
  const [adsLoading, setAdsLoading] = useState(false);
  const [topProducts, setTopProducts] = useState(null);
  const [topProductsLoading, setTopProductsLoading] = useState(false);

  useEffect(() => {
    if (dateRange !== 'custom') {
      loadMetrics();
    }
  }, [dateRange]);

  useEffect(() => {
    if (dateRange === 'custom' && customDates.start && customDates.end) {
      loadMetrics();
    }
  }, [customDates.start, customDates.end]);

  const getApiParams = () => {
    if (dateRange === 'custom' && customDates.start && customDates.end) {
      return { start_date: customDates.start, end_date: customDates.end };
    }
    return { range: dateRange };
  };

  const loadMetrics = async () => {
    setLoading(true);
    setAds(null);
    setTopProducts(null);
    try {
      const params = getApiParams();
      const [summaryRes, dailyRes, insightRes] = await Promise.all([
        portalMetricsAPI.getSummary(params),
        portalMetricsAPI.getDaily(params),
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

  const loadAds = async () => {
    setAdsLoading(true);
    try {
      const res = await portalMetricsAPI.getAds(getApiParams());
      setAds(res.ads || []);
    } catch (error) {
      console.error('Error loading ads:', error);
      setAds([]);
    } finally {
      setAdsLoading(false);
    }
  };

  const loadTopProducts = async () => {
    setTopProductsLoading(true);
    try {
      const res = await portalMetricsAPI.getTopProducts(getApiParams());
      setTopProducts(res.products || []);
    } catch (error) {
      console.error('Error loading top products:', error);
      setTopProducts([]);
    } finally {
      setTopProductsLoading(false);
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

  const fmtDate = (v) => {
    const d = new Date(v + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const fmtDateLabel = (v) => {
    const d = new Date(v + 'T00:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
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
    costoCompra: d.fb_cost_per_purchase || 0,
    cpm: d.fb_cpm || 0,
    sessions: d.shopify_sessions || 0,
    orders: d.shopify_orders || 0,
    conversionRate: d.shopify_conversion_rate || 0,
  }));

  const tooltipStyle = { borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Métricas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rendimiento de tus campañas y ventas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
            {[
              { value: '7d', label: '7 días' },
              { value: '30d', label: '30 días' },
              { value: '90d', label: '90 días' },
              { value: 'custom', label: 'Personalizado' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === option.value
                    ? 'bg-[#1A1A2E] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={customDates.start}
                onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customDates.end}
                onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
            </div>
          )}
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
          {/* Blended Metrics */}
          {metrics?.blended && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                Métricas Combinadas
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Revenue */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Venta Total</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.blended.total_revenue)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.blended.total_revenue_change} />
                  </div>
                </div>

                {/* Total Ad Spend */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Inversión Total</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.blended.total_ad_spend)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.blended.total_ad_spend_change} inverted />
                  </div>
                </div>

                {/* Overall ROAS */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">ROAS Real</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {(metrics.blended.overall_roas || 0).toFixed(2)}x
                      </p>
                    </div>
                    <TrendIndicator value={metrics.blended.overall_roas_change} />
                  </div>
                </div>

                {/* Cost per Order */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Costo por Pedido</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.blended.cost_per_order)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.blended.cost_per_order_change} inverted />
                  </div>
                </div>

                {/* Ad Spend Percentage */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">% Inversión</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatPercent(metrics.blended.ad_spend_percentage)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.blended.ad_spend_percentage_change} inverted />
                  </div>
                </div>

                {/* Margin After Ads */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Margen después de Ads</p>
                      <p className="text-xl font-bold text-[#1A1A2E] mt-1">
                        {formatCurrency(metrics.blended.margin_after_ads)}
                      </p>
                    </div>
                    <TrendIndicator value={metrics.blended.margin_after_ads_change} />
                  </div>
                </div>
              </div>
            </div>
          )}

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

              {/* Creative Performance */}
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

                {/* Sessions (always visible) */}
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

                {/* Conversion Rate (always visible) */}
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
              </div>
            </div>
          )}

          {/* Top Products */}
          {metrics?.shopify && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[#1A1A2E] flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-500" />
                  Productos Más Vendidos
                </h3>
                {topProducts === null && (
                  <button
                    onClick={loadTopProducts}
                    disabled={topProductsLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors disabled:opacity-50"
                  >
                    {topProductsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Package className="w-4 h-4" />
                    )}
                    Ver productos
                  </button>
                )}
              </div>

              {topProductsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              )}

              {topProducts !== null && !topProductsLoading && topProducts.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No hay productos vendidos en este periodo
                </p>
              )}

              {topProducts !== null && !topProductsLoading && topProducts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 font-medium text-gray-500 w-10">#</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-500">Producto</th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">Unidades</th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">Ingresos</th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">Pedidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((product, idx) => (
                        <tr key={product.product_id || idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-3 px-3 text-gray-400 font-medium">{idx + 1}</td>
                          <td className="py-3 px-3 font-medium text-[#1A1A2E]">{product.title}</td>
                          <td className="py-3 px-3 text-right">{formatNumber(product.quantity)}</td>
                          <td className="py-3 px-3 text-right font-medium">{formatCurrency(product.revenue)}</td>
                          <td className="py-3 px-3 text-right">{formatNumber(product.orders)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Charts */}
          {chartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Revenue vs Ad Spend (ComposedChart) */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Venta vs Inversión</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [formatCurrency(value), name === 'revenue' ? 'Ingresos' : 'Inversión Ads']}
                      labelFormatter={fmtDateLabel}
                    />
                    <Legend formatter={(v) => v === 'revenue' ? 'Ingresos' : 'Inversión Ads'} />
                    <Bar dataKey="adSpend" fill="#3B82F6" opacity={0.3} radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* 2. ROAS Trend */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">ROAS</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="portalRoasGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${Number(value).toFixed(2)}x`, 'ROAS']}
                      labelFormatter={fmtDateLabel}
                    />
                    <Area type="monotone" dataKey="roas" stroke="#8B5CF6" strokeWidth={2} fill="url(#portalRoasGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 3. Costo por Compra */}
              {metrics?.facebook && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Costo por Compra</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [formatCurrency(value), 'Costo/Compra']}
                        labelFormatter={fmtDateLabel}
                      />
                      <Line type="monotone" dataKey="costoCompra" stroke="#EF4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 4. CPM */}
              {metrics?.facebook && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">CPM</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="portalCpmGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [formatCurrency(value), 'CPM']}
                        labelFormatter={fmtDateLabel}
                      />
                      <Area type="monotone" dataKey="cpm" stroke="#F59E0B" strokeWidth={2} fill="url(#portalCpmGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 5. Sesiones vs Pedidos */}
              {metrics?.shopify && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Sesiones vs Pedidos</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [formatNumber(value), name === 'sessions' ? 'Sesiones' : 'Pedidos']}
                        labelFormatter={fmtDateLabel}
                      />
                      <Legend formatter={(v) => v === 'sessions' ? 'Sesiones' : 'Pedidos'} />
                      <Bar yAxisId="left" dataKey="sessions" fill="#6366F1" opacity={0.3} radius={[3, 3, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#22C55E" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 6. Tasa de Conversión */}
              {metrics?.shopify && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Tasa de Conversión</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="portalConvGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Conversión']}
                        labelFormatter={fmtDateLabel}
                      />
                      <Area type="monotone" dataKey="conversionRate" stroke="#10B981" strokeWidth={2} fill="url(#portalConvGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 7. Hook Rate vs Hold Rate */}
              {metrics?.facebook && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-500" />
                    Hook Rate vs Hold Rate
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [
                          `${Number(value).toFixed(2)}%`,
                          name === 'hookRate' ? 'Hook Rate' : 'Hold Rate'
                        ]}
                        labelFormatter={fmtDateLabel}
                      />
                      <Legend formatter={(v) => v === 'hookRate' ? 'Hook Rate (3s)' : 'Hold Rate (ThruPlay)'} />
                      <Line type="monotone" dataKey="hookRate" stroke="#F59E0B" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="holdRate" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 8. Pedidos por Día */}
              {metrics?.shopify && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                  <h3 className="text-sm font-semibold text-[#1A1A2E] mb-4">Pedidos por Día</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [value, 'Pedidos']}
                        labelFormatter={fmtDateLabel}
                      />
                      <Bar dataKey="orders" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Ad-Level Performance */}
      {metrics?.facebook && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1A1A2E] flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Rendimiento por Anuncio
            </h3>
            {ads === null && (
              <button
                onClick={loadAds}
                disabled={adsLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors disabled:opacity-50"
              >
                {adsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                Ver anuncios
              </button>
            )}
          </div>

          {adsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          )}

          {ads !== null && !adsLoading && ads.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No hay anuncios con actividad en este periodo
            </p>
          )}

          {ads !== null && !adsLoading && ads.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Anuncio</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Campaña</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Inversión</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Presupuesto</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">CPM</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Frecuencia</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">CTR único</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Clics enlace</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">CPC</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Visitas página</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Resultados</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Costo/Resultado</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">ROAS</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Hook Rate</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Hold Rate</th>
                    <th className="py-3 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad) => (
                    <tr key={ad.ad_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-3 max-w-[200px] truncate" title={ad.ad_name}>
                        {ad.ad_name}
                      </td>
                      <td className="py-3 px-3 max-w-[160px] truncate text-gray-500" title={ad.campaign_name}>
                        {ad.campaign_name}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">{formatCurrency(ad.spend)}</td>
                      <td className="py-3 px-3 text-right">{ad.budget ? formatCurrency(ad.budget) : '—'}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(ad.cpm)}</td>
                      <td className="py-3 px-3 text-right">{(ad.frequency || 0).toFixed(2)}</td>
                      <td className="py-3 px-3 text-right">{formatPercent(ad.unique_ctr)}</td>
                      <td className="py-3 px-3 text-right">{formatNumber(ad.link_clicks)}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(ad.cpc)}</td>
                      <td className="py-3 px-3 text-right">{formatNumber(ad.landing_page_views)}</td>
                      <td className="py-3 px-3 text-right">{formatNumber(ad.conversions)}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(ad.cost_per_purchase)}</td>
                      <td className="py-3 px-3 text-right font-medium">{(ad.roas || 0).toFixed(2)}x</td>
                      <td className="py-3 px-3 text-right">{formatPercent(ad.hook_rate)}</td>
                      <td className="py-3 px-3 text-right">{formatPercent(ad.hold_rate)}</td>
                      <td className="py-3 px-1">
                        {ad.preview_url && (
                          <a
                            href={ad.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Ver anuncio"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(() => {
                    const totSpend = ads.reduce((s, a) => s + a.spend, 0);
                    const totImpressions = ads.reduce((s, a) => s + a.impressions, 0);
                    const totClicks = ads.reduce((s, a) => s + a.clicks, 0);
                    const totLinkClicks = ads.reduce((s, a) => s + (a.link_clicks || 0), 0);
                    const totLandingPageViews = ads.reduce((s, a) => s + (a.landing_page_views || 0), 0);
                    const totConversions = ads.reduce((s, a) => s + a.conversions, 0);
                    const totRevenue = ads.reduce((s, a) => s + (a.revenue || 0), 0);
                    const avgCpm = totImpressions > 0 ? (totSpend / totImpressions) * 1000 : 0;
                    const avgFrequency = ads.length > 0 ? ads.reduce((s, a) => s + (a.frequency || 0), 0) / ads.length : 0;
                    const avgUniqueCtr = totImpressions > 0 ? (totClicks / totImpressions) * 100 : 0;
                    const avgCpc = totClicks > 0 ? totSpend / totClicks : 0;
                    const avgRoas = totSpend > 0 ? totRevenue / totSpend : 0;
                    const avgCostPerPurchase = totConversions > 0 ? totSpend / totConversions : 0;
                    const adsWithHook = ads.filter(a => a.hook_rate > 0);
                    const avgHookRate = adsWithHook.length > 0 ? adsWithHook.reduce((s, a) => s + a.hook_rate, 0) / adsWithHook.length : 0;
                    const adsWithHold = ads.filter(a => a.hold_rate > 0);
                    const avgHoldRate = adsWithHold.length > 0 ? adsWithHold.reduce((s, a) => s + a.hold_rate, 0) / adsWithHold.length : 0;
                    return (
                      <tr className="border-t-2 border-gray-200 bg-gray-50/80 font-semibold text-[#1A1A2E]">
                        <td className="py-3 px-3">Total</td>
                        <td className="py-3 px-3"></td>
                        <td className="py-3 px-3 text-right">{formatCurrency(totSpend)}</td>
                        <td className="py-3 px-3"></td>
                        <td className="py-3 px-3 text-right">{formatCurrency(avgCpm)}</td>
                        <td className="py-3 px-3 text-right">{avgFrequency.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right">{formatPercent(avgUniqueCtr)}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(totLinkClicks)}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(avgCpc)}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(totLandingPageViews)}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(totConversions)}</td>
                        <td className="py-3 px-3 text-right">{formatCurrency(avgCostPerPurchase)}</td>
                        <td className="py-3 px-3 text-right">{avgRoas.toFixed(2)}x</td>
                        <td className="py-3 px-3 text-right">{formatPercent(avgHookRate)}</td>
                        <td className="py-3 px-3 text-right">{formatPercent(avgHoldRate)}</td>
                        <td className="py-3 px-1"></td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          )}
        </div>
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
