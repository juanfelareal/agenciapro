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
  Loader2
} from 'lucide-react';
import { clientsAPI, clientMetricsAPI } from '../utils/api';
import MetricCard from '../components/MetricCard';
import MetricsTable from '../components/MetricsTable';

function ClientMetrics() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
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

  const loadMetrics = async () => {
    try {
      setLoading(true);
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

  // Quick date presets
  const setPreset = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = end = today.toISOString().split('T')[0];
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = end = yesterday.toISOString().split('T')[0];
        break;
      case 'last7':
        end = today.toISOString().split('T')[0];
        start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last30':
        end = today.toISOString().split('T')[0];
        start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
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
    { key: 'shopify_aov', label: 'Ticket Promedio', type: 'currency', align: 'right' },
    { key: 'fb_spend', label: 'Inversion', type: 'currency', align: 'right' },
    { key: 'cost_per_order', label: 'Costo/Pedido', type: 'currency', align: 'right' },
    { key: 'overall_roas', label: 'ROAS', type: 'decimal', align: 'right' },
    { key: 'ad_spend_percentage', label: '% Inversion', type: 'percent', align: 'right' }
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

      {/* Daily Metrics Table */}
      <MetricsTable
        title="Seguimiento Diario"
        data={dailyMetrics}
        columns={dailyColumns}
        loading={loading}
        emptyMessage="No hay datos para el rango seleccionado. Sincroniza las métricas para obtener datos."
      />
    </div>
  );
}

export default ClientMetrics;
