import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  MousePointerClick,
  Percent,
  Receipt,
  RefreshCw,
  Calendar,
  Settings,
  Loader2,
  Share2,
  Eye,
  Video,
  Target,
  Tag,
  ExternalLink
} from 'lucide-react';
import { clientsAPI, clientMetricsAPI } from '../utils/api';
import MetricCard from '../components/MetricCard';
import MetricsTable from '../components/MetricsTable';
import DashboardShareModal from '../components/DashboardShareModal';

// Get current date in Colombia timezone (YYYY-MM-DD)
const getColombiaDate = (offsetDays = 0) => {
  const now = new Date();
  const colombiaStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (offsetDays === 0) return colombiaStr;
  const d = new Date(colombiaStr + 'T12:00:00');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

function ClientMetrics() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [ads, setAds] = useState(null);
  const [adsLoading, setAdsLoading] = useState(false);

  const [dateRange, setDateRange] = useState({
    start: getColombiaDate(-7),
    end: getColombiaDate()
  });

  useEffect(() => {
    loadClient();
  }, [clientId]);

  useEffect(() => {
    if (client) {
      loadMetrics();
    }
  }, [dateRange, client]);

  const loadClient = async () => {
    try {
      const res = await clientsAPI.getById(clientId);
      setClient(res.data);
    } catch (error) {
      console.error('Error loading client:', error);
    }
  };

  const loadAds = async () => {
    setAdsLoading(true);
    try {
      const res = await clientMetricsAPI.getAds(clientId, dateRange.start, dateRange.end);
      setAds(res.data.ads || []);
    } catch (error) {
      console.error('Error loading ads:', error);
      setAds([]);
    } finally {
      setAdsLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setAds(null);
      const [metricsRes, dailyRes] = await Promise.all([
        clientMetricsAPI.getMetrics(clientId, dateRange.start, dateRange.end),
        clientMetricsAPI.getDailyMetrics(clientId, dateRange.start, dateRange.end)
      ]);
      setMetrics(metricsRes.data);
      setDailyMetrics(dailyRes.data);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await clientMetricsAPI.syncClient(clientId, dateRange.start, dateRange.end);
      alert('Sincronización completada');
      loadMetrics();
    } catch (error) {
      alert('Error al sincronizar: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  // Quick date presets (Colombia timezone)
  const setPreset = (preset) => {
    const today = getColombiaDate();
    let start, end;

    switch (preset) {
      case 'today':
        start = end = today;
        break;
      case 'yesterday':
        start = end = getColombiaDate(-1);
        break;
      case 'last7':
        end = today;
        start = getColombiaDate(-6);
        break;
      case 'last30':
        end = today;
        start = getColombiaDate(-29);
        break;
      case 'thisMonth': {
        const [year, month] = today.split('-');
        start = `${year}-${month}-01`;
        end = today;
        break;
      }
      default:
        return;
    }

    setDateRange({ start, end });
  };

  // Daily table columns
  const dailyColumns = [
    { key: 'metric_date', label: 'Fecha', type: 'date' },
    { key: 'shopify_net_revenue', label: 'Venta Neta', type: 'currency', align: 'right' },
    { key: 'shopify_orders', label: 'Pedidos', type: 'integer', align: 'right' },
    { key: 'shopify_pending_orders', label: 'Pendientes', type: 'integer', align: 'right' },
    { key: 'shopify_aov', label: 'Ticket Promedio', type: 'currency', align: 'right' },
    { key: 'fb_spend', label: 'Inversion', type: 'currency', align: 'right' },
    { key: 'cost_per_order', label: 'Costo/Pedido', type: 'currency', align: 'right' },
    { key: 'overall_roas', label: 'ROAS', type: 'decimal', align: 'right' },
    { key: 'ad_spend_percentage', label: '% Inversion', type: 'percent', align: 'right' },
    { key: 'fb_cpm', label: 'CPM', type: 'currency', align: 'right' },
    { key: 'fb_cost_per_purchase', label: 'Costo/Compra', type: 'currency', align: 'right' },
    { key: 'fb_hook_rate', label: 'Hook Rate', type: 'percent', align: 'right' },
    { key: 'fb_hold_rate', label: 'Hold Rate', type: 'percent', align: 'right' }
  ];

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A1A2E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/metricas')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">{client.company || client.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Métricas de rendimiento</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </button>
          <button
            onClick={() => navigate(`/app/clients/${clientId}/plataformas`)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sincronizar
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            {['today', 'yesterday', 'last7', 'last30', 'thisMonth'].map((preset) => (
              <button
                key={preset}
                onClick={() => setPreset(preset)}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {preset === 'today' && 'Hoy'}
                {preset === 'yesterday' && 'Ayer'}
                {preset === 'last7' && '7 días'}
                {preset === 'last30' && '30 días'}
                {preset === 'thisMonth' && 'Este mes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards - Similar to Master Metrics layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Venta Total"
          value={metrics?.total_revenue}
          icon={DollarSign}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Venta Neta"
          value={metrics?.net_revenue}
          icon={DollarSign}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Pedidos"
          value={metrics?.total_orders}
          icon={ShoppingCart}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
          format="integer"
          loading={loading}
        />
        <MetricCard
          title="Ticket Promedio"
          value={metrics?.ticket_promedio}
          icon={Receipt}
          iconBgColor="bg-yellow-100"
          iconColor="text-yellow-600"
          format="currency"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Inversion Publicidad"
          value={metrics?.total_ad_spend}
          icon={MousePointerClick}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Inversion Por Pedido"
          value={metrics?.cost_per_order}
          icon={Receipt}
          iconBgColor="bg-indigo-100"
          iconColor="text-indigo-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="ROAS"
          value={metrics?.roas}
          icon={TrendingUp}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          format="decimal"
          loading={loading}
        />
        <MetricCard
          title="% Inversion Publicidad"
          value={metrics?.ad_spend_percentage}
          icon={Percent}
          iconBgColor="bg-pink-100"
          iconColor="text-pink-600"
          format="percent"
          loading={loading}
        />
      </div>

      {/* New Metrics Row: Facebook Expanded */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="CPM"
          value={metrics?.cpm}
          icon={Eye}
          iconBgColor="bg-sky-100"
          iconColor="text-sky-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Costo por Compra"
          value={metrics?.cost_per_purchase}
          icon={Target}
          iconBgColor="bg-rose-100"
          iconColor="text-rose-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Hook Rate"
          value={metrics?.hook_rate}
          icon={Video}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
          format="percent"
          loading={loading}
        />
        <MetricCard
          title="Hold Rate"
          value={metrics?.hold_rate}
          icon={Video}
          iconBgColor="bg-violet-100"
          iconColor="text-violet-600"
          format="percent"
          loading={loading}
        />
      </div>

      {/* New Metrics Row: Shopify Expanded */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Pedidos Pendientes"
          value={metrics?.total_pending_orders}
          icon={ShoppingCart}
          iconBgColor="bg-red-100"
          iconColor="text-red-600"
          format="integer"
          loading={loading}
        />
        <MetricCard
          title="Tasa de Conversión"
          value={metrics?.conversion_rate}
          icon={TrendingUp}
          iconBgColor="bg-teal-100"
          iconColor="text-teal-600"
          format="percent"
          loading={loading}
        />
        <MetricCard
          title="Sesiones"
          value={metrics?.total_sessions}
          icon={MousePointerClick}
          iconBgColor="bg-cyan-100"
          iconColor="text-cyan-600"
          format="integer"
          loading={loading}
        />
        <MetricCard
          title="Impuestos"
          value={metrics?.total_tax}
          icon={Receipt}
          iconBgColor="bg-gray-100"
          iconColor="text-gray-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Descuentos"
          value={metrics?.total_discounts}
          icon={Tag}
          iconBgColor="bg-lime-100"
          iconColor="text-lime-600"
          format="currency"
          loading={loading}
        />
      </div>

      {/* Ad-Level Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
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
                <Eye className="w-4 h-4" />
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Anuncio</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Campaña</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Inversión</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Impresiones</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Clics</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">CTR</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Conv.</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">ROAS</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Costo/Compra</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Hook Rate</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Hold Rate</th>
                  <th className="py-3 px-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => {
                  const fmtCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
                  const fmtNumber = (v) => new Intl.NumberFormat('es-CO').format(v || 0);
                  const fmtPercent = (v) => `${(v || 0).toFixed(2)}%`;
                  return (
                    <tr key={ad.ad_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-3 max-w-[200px] truncate" title={ad.ad_name}>
                        {ad.ad_name}
                      </td>
                      <td className="py-3 px-3 max-w-[160px] truncate text-gray-500" title={ad.campaign_name}>
                        {ad.campaign_name}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">{fmtCurrency(ad.spend)}</td>
                      <td className="py-3 px-3 text-right">{fmtNumber(ad.impressions)}</td>
                      <td className="py-3 px-3 text-right">{fmtNumber(ad.clicks)}</td>
                      <td className="py-3 px-3 text-right">{fmtPercent(ad.ctr)}</td>
                      <td className="py-3 px-3 text-right">{fmtNumber(ad.conversions)}</td>
                      <td className="py-3 px-3 text-right font-medium">{(ad.roas || 0).toFixed(2)}x</td>
                      <td className="py-3 px-3 text-right">{fmtCurrency(ad.cost_per_purchase)}</td>
                      <td className="py-3 px-3 text-right">{fmtPercent(ad.hook_rate)}</td>
                      <td className="py-3 px-3 text-right">{fmtPercent(ad.hold_rate)}</td>
                      <td className="py-3 px-1">
                        <a
                          href={`https://www.facebook.com/adsmanager/manage/ads?act=&selected_ad_ids=${ad.ad_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Ver en Facebook Ads Manager"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const fmtCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
                  const fmtNumber = (v) => new Intl.NumberFormat('es-CO').format(v || 0);
                  const fmtPercent = (v) => `${(v || 0).toFixed(2)}%`;
                  const totSpend = ads.reduce((s, a) => s + a.spend, 0);
                  const totImpressions = ads.reduce((s, a) => s + a.impressions, 0);
                  const totClicks = ads.reduce((s, a) => s + a.clicks, 0);
                  const totConversions = ads.reduce((s, a) => s + a.conversions, 0);
                  const totRevenue = ads.reduce((s, a) => s + (a.revenue || 0), 0);
                  const avgCtr = totImpressions > 0 ? (totClicks / totImpressions) * 100 : 0;
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
                      <td className="py-3 px-3 text-right">{fmtCurrency(totSpend)}</td>
                      <td className="py-3 px-3 text-right">{fmtNumber(totImpressions)}</td>
                      <td className="py-3 px-3 text-right">{fmtNumber(totClicks)}</td>
                      <td className="py-3 px-3 text-right">{fmtPercent(avgCtr)}</td>
                      <td className="py-3 px-3 text-right">{fmtNumber(totConversions)}</td>
                      <td className="py-3 px-3 text-right">{avgRoas.toFixed(2)}x</td>
                      <td className="py-3 px-3 text-right">{fmtCurrency(avgCostPerPurchase)}</td>
                      <td className="py-3 px-3 text-right">{fmtPercent(avgHookRate)}</td>
                      <td className="py-3 px-3 text-right">{fmtPercent(avgHoldRate)}</td>
                      <td className="py-3 px-1"></td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Daily Metrics Table */}
      <MetricsTable
        title="Seguimiento Diario"
        data={dailyMetrics}
        columns={dailyColumns}
        loading={loading}
        emptyMessage="No hay datos para el rango seleccionado. Sincroniza las métricas para obtener datos."
      />

      {/* Share Modal */}
      {showShareModal && (
        <DashboardShareModal
          clientId={clientId}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

export default ClientMetrics;
