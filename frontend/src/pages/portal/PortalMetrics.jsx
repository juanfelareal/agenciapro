import { useState, useEffect } from 'react';
import { usePortal } from '../../context/PortalContext';
import { portalMetricsAPI } from '../../utils/portalApi';
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
  AlertCircle
} from 'lucide-react';

export default function PortalMetrics() {
  const { hasPermission } = usePortal();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const response = await portalMetricsAPI.getSummary({ range: dateRange });
      setMetrics(response);
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
