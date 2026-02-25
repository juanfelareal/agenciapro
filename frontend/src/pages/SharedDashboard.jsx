import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye,
  ShoppingCart, Users, Loader2, Lightbulb, AlertCircle, Lock
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function SharedDashboard() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    loadDashboard();
  }, [token, dateRange]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/dashboard-share/public/${token}?range=${dateRange}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error cargando dashboard');
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);

  const formatNumber = (value) =>
    new Intl.NumberFormat('es-CO').format(value || 0);

  const formatPercent = (value) => `${(value || 0).toFixed(2)}%`;

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
        {value > 0 ? <TrendingUp className="w-4 h-4" /> : value < 0 ? <TrendingDown className="w-4 h-4" /> : null}
        {value > 0 ? '+' : ''}{value?.toFixed(1)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#1A1A2E] mb-2">Enlace no disponible</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const chartData = (data.dailyData || []).map(d => ({
    date: d.metric_date,
    revenue: d.shopify_revenue || 0,
    adSpend: d.fb_spend || 0,
    roas: d.overall_roas || d.fb_roas || 0,
  }));

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Dashboard de métricas</p>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">
              {data.client?.company || data.client?.name || 'Dashboard'}
            </h1>
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
                  dateRange === option.value ? 'bg-[#1A1A2E] text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI Insight */}
        {data.insight && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl border border-green-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <Lightbulb className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1A1A2E] mb-1">Insight Semanal</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{data.insight}</p>
              </div>
            </div>
          </div>
        )}

        {/* Facebook Metrics */}
        {data.facebook && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              Facebook Ads
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard label="Inversión" value={formatCurrency(data.facebook.spend)} change={data.facebook.spend_change} inverted icon={<DollarSign className="w-5 h-5" />} iconBg="bg-gray-100" iconColor="text-[#1A1A2E]" />
              <MetricCard label="Impresiones" value={formatNumber(data.facebook.impressions)} change={data.facebook.impressions_change} icon={<Eye className="w-5 h-5" />} iconBg="bg-blue-100" iconColor="text-blue-600" />
              <MetricCard label="Clics" value={formatNumber(data.facebook.clicks)} change={data.facebook.clicks_change} icon={<MousePointer className="w-5 h-5" />} iconBg="bg-green-100" iconColor="text-green-600" />
              <MetricCard label="CTR" value={formatPercent(data.facebook.ctr)} change={data.facebook.ctr_change} icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-amber-100" iconColor="text-amber-600" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SmallMetricCard label="Conversiones" value={formatNumber(data.facebook.conversions)} change={data.facebook.conversions_change} />
              <SmallMetricCard label="Costo por Conversión" value={formatCurrency(data.facebook.cpa)} change={data.facebook.cpa_change} inverted />
              <SmallMetricCard label="ROAS" value={`${(data.facebook.roas || 0).toFixed(2)}x`} change={data.facebook.roas_change} />
            </div>
          </div>
        )}

        {/* Shopify Metrics */}
        {data.shopify && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-green-600" />
              </div>
              Shopify
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard label="Ingresos" value={formatCurrency(data.shopify.revenue)} change={data.shopify.revenue_change} icon={<DollarSign className="w-5 h-5" />} iconBg="bg-green-100" iconColor="text-green-600" />
              <MetricCard label="Pedidos" value={formatNumber(data.shopify.orders)} change={data.shopify.orders_change} icon={<ShoppingCart className="w-5 h-5" />} iconBg="bg-blue-100" iconColor="text-blue-600" />
              <MetricCard label="Ticket Promedio" value={formatCurrency(data.shopify.aov)} change={data.shopify.aov_change} icon={<BarChart3 className="w-5 h-5" />} iconBg="bg-gray-100" iconColor="text-[#1A1A2E]" />
              <MetricCard label="Clientes" value={formatNumber(data.shopify.customers)} change={data.shopify.customers_change} icon={<Users className="w-5 h-5" />} iconBg="bg-amber-100" iconColor="text-amber-600" />
            </div>
          </div>
        )}

        {/* Charts */}
        {chartData.length > 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">Ingresos vs Inversión Publicitaria</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth()+1}`; }} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={formatCompactCurrency} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    formatter={(v, n) => [formatCurrency(v), n === 'revenue' ? 'Ingresos' : 'Inversión Ads']}
                    labelFormatter={(v) => new Date(v + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} />
                  <Legend formatter={(v) => v === 'revenue' ? 'Ingresos' : 'Inversión Ads'} />
                  <Line type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="adSpend" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">Tendencia ROAS</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="roasGradientPublic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => { const d = new Date(v + 'T00:00:00'); return `${d.getDate()}/${d.getMonth()+1}`; }} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    formatter={(v) => [`${Number(v).toFixed(2)}x`, 'ROAS']}
                    labelFormatter={(v) => new Date(v + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} />
                  <Area type="monotone" dataKey="roas" stroke="#8B5CF6" strokeWidth={2} fill="url(#roasGradientPublic)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4">
          Generado por AgenciaPRO
        </div>
      </div>
    </div>
  );
}

// Reusable components for this page
function MetricCard({ label, value, change, inverted, icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        {change !== undefined && (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${
            (inverted ? change < 0 : change > 0) ? 'text-green-600' : change === 0 ? 'text-gray-400' : 'text-red-500'
          }`}>
            {change > 0 ? <TrendingUp className="w-4 h-4" /> : change < 0 ? <TrendingDown className="w-4 h-4" /> : null}
            {change > 0 ? '+' : ''}{change?.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#1A1A2E]">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function SmallMetricCard({ label, value, change, inverted }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-bold text-[#1A1A2E] mt-1">{value}</p>
        </div>
        {change !== undefined && (
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${
            (inverted ? change < 0 : change > 0) ? 'text-green-600' : change === 0 ? 'text-gray-400' : 'text-red-500'
          }`}>
            {change > 0 ? <TrendingUp className="w-4 h-4" /> : change < 0 ? <TrendingDown className="w-4 h-4" /> : null}
            {change > 0 ? '+' : ''}{change?.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
