import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  MousePointerClick,
  RefreshCw,
  Calendar,
  Settings,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { clientMetricsAPI } from '../utils/api';
import MetricCard from '../components/MetricCard';

function MetricsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState({ clients: [], totals: {} });
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await clientMetricsAPI.getAggregate(dateRange.start, dateRange.end);
      setData(res.data);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm('¿Sincronizar metricas de todos los clientes?')) return;

    try {
      setSyncing(true);
      await clientMetricsAPI.syncAll();
      alert('Sincronizacion iniciada. Los datos se actualizaran en unos minutos.');
      loadData();
    } catch (error) {
      alert('Error al sincronizar: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  // Quick date range presets
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

  // Format currency
  const formatCurrency = (val) => {
    if (!val) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metricas</h1>
          <p className="text-gray-500">Resumen de todos los clientes</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sincronizar Todo
        </button>
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
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
                {preset === 'last7' && '7 dias'}
                {preset === 'last30' && '30 dias'}
                {preset === 'thisMonth' && 'Este mes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Venta Total"
          value={data.totals?.total_revenue}
          icon={DollarSign}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Inversion Publicidad"
          value={data.totals?.total_ad_spend}
          icon={MousePointerClick}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="ROAS"
          value={data.totals?.roas}
          icon={TrendingUp}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          format="decimal"
          loading={loading}
        />
        <MetricCard
          title="Pedidos"
          value={data.totals?.total_orders}
          icon={ShoppingCart}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
          format="integer"
          loading={loading}
        />
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Reporte General</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
            <p className="text-gray-500">Cargando metricas...</p>
          </div>
        ) : data.clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No hay datos disponibles para el rango seleccionado.</p>
            <p className="text-sm mt-2">Conecta Facebook Ads y Shopify a tus clientes para ver metricas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Venta Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inversion
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedidos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ROAS
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTR
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.clients.map((client) => (
                  <tr key={client.client_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{client.company || client.client_name}</p>
                        {client.company && (
                          <p className="text-sm text-gray-500">{client.client_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(client.total_revenue)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatCurrency(client.total_ad_spend)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {client.total_orders || 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${client.roas >= 3 ? 'text-green-600' : client.roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {client.roas?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {client.avg_ctr?.toFixed(2) || '0.00'}%
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate(`/metricas/cliente/${client.client_id}`)}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => navigate(`/clients/${client.client_id}/plataformas`)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Configurar plataformas"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-gray-50 font-medium">
                <tr>
                  <td className="px-6 py-4 text-gray-900">Total</td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {formatCurrency(data.totals?.total_revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {formatCurrency(data.totals?.total_ad_spend)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {data.totals?.total_orders || 0}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {data.totals?.roas?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    {data.totals?.avg_ctr?.toFixed(2) || '0.00'}%
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricsDashboard;
