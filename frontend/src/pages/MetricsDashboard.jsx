import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  MousePointerClick,
  RefreshCw,
  Calendar,
  Settings,
  ChevronRight,
  Loader2,
  EyeOff,
  Eye,
  Rocket
} from 'lucide-react';
import { clientMetricsAPI, growthAPI } from '../utils/api';
import MetricCard from '../components/MetricCard';
import GrowthDashboard from './GrowthDashboard';

// Get current date in Colombia timezone (YYYY-MM-DD)
const getColombiaDate = (offsetDays = 0) => {
  const now = new Date();
  const colombiaStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (offsetDays === 0) return colombiaStr;
  const d = new Date(colombiaStr + 'T12:00:00');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

function MetricsDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'general');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState({ clients: [], totals: {} });
  const [showHidden, setShowHidden] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: getColombiaDate(-7),
    end: getColombiaDate()
  });

  useEffect(() => {
    if (activeTab === 'general') loadData();
  }, [dateRange, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'general' ? {} : { tab });
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await clientMetricsAPI.getAggregate(dateRange.start, dateRange.end);
      setData(res.data);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm('¿Sincronizar métricas de todos los clientes (últimos 365 días)?\n\nSolo se descargarán los días que falten. El proceso corre en segundo plano.')) return;
    try {
      setSyncing(true);
      await clientMetricsAPI.syncAll();
      const refreshInterval = setInterval(() => loadData(true), 10000);
      setTimeout(() => { clearInterval(refreshInterval); setSyncing(false); }, 10 * 60 * 1000);
      window._syncInterval = refreshInterval;
    } catch (error) {
      alert('Error al sincronizar: ' + (error.response?.data?.error || error.message));
      setSyncing(false);
    }
  };

  const handleToggleHidden = async (clientId, currentlyHidden) => {
    try {
      await growthAPI.hideClient(clientId, !currentlyHidden);
      loadData(true);
    } catch (error) {
      console.error('Error toggling visibility:', error);
    }
  };

  const setPreset = (preset) => {
    const today = getColombiaDate();
    const todayDate = new Date(today + 'T12:00:00');
    let start, end;
    switch (preset) {
      case 'today': start = end = today; break;
      case 'yesterday': start = end = getColombiaDate(-1); break;
      case 'thisWeek': {
        const dow = todayDate.getDay();
        start = getColombiaDate(-(dow === 0 ? 6 : dow - 1));
        end = today;
        break;
      }
      case 'lastWeek': {
        const dow = todayDate.getDay();
        const diffMon = dow === 0 ? 6 : dow - 1;
        const thisMon = new Date(todayDate); thisMon.setDate(thisMon.getDate() - diffMon);
        const lastMon = new Date(thisMon); lastMon.setDate(lastMon.getDate() - 7);
        const lastSun = new Date(thisMon); lastSun.setDate(lastSun.getDate() - 1);
        start = lastMon.toISOString().split('T')[0];
        end = lastSun.toISOString().split('T')[0];
        break;
      }
      case 'thisMonth': { const [y, m] = today.split('-'); start = `${y}-${m}-01`; end = today; break; }
      case 'lastMonth': {
        const d = new Date(todayDate); d.setDate(1); d.setMonth(d.getMonth() - 1);
        start = d.toISOString().split('T')[0];
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      }
      case 'thisYear': start = `${today.split('-')[0]}-01-01`; end = today; break;
      case 'lastYear': { const y = parseInt(today.split('-')[0]) - 1; start = `${y}-01-01`; end = `${y}-12-31`; break; }
      default: return;
    }
    setDateRange({ start, end });
  };

  const formatCurrency = (val) => {
    if (!val) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  // Filter visible clients
  const visibleClients = showHidden ? data.clients : data.clients.filter(c => !c.is_hidden_from_metrics);
  const hiddenCount = data.clients.filter(c => c.is_hidden_from_metrics).length;

  // Recalculate totals for visible clients only
  const visibleTotals = visibleClients.reduce((acc, c) => ({
    display_revenue: acc.display_revenue + (c.display_revenue || 0),
    total_ad_spend: acc.total_ad_spend + (c.total_ad_spend || 0),
    total_orders: acc.total_orders + (c.total_orders || 0),
    total_impressions: acc.total_impressions + (c.total_impressions || 0),
    total_clicks: acc.total_clicks + (c.total_clicks || 0),
  }), { display_revenue: 0, total_ad_spend: 0, total_orders: 0, total_impressions: 0, total_clicks: 0 });
  visibleTotals.roas = visibleTotals.total_ad_spend > 0 ? visibleTotals.display_revenue / visibleTotals.total_ad_spend : 0;
  visibleTotals.avg_ctr = visibleTotals.total_impressions > 0 ? (visibleTotals.total_clicks / visibleTotals.total_impressions) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Métricas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen de todos los clientes</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors disabled:opacity-50"
        >
          {syncing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> Sincronizar Todo</>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => handleTabChange('general')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'general' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          General
        </button>
        <button
          onClick={() => handleTabChange('growth')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'growth' ? 'bg-white text-[#1A1A2E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Rocket className="w-4 h-4" />
          Growth
        </button>
      </div>

      {activeTab === 'general' ? (
        <>
          {/* Date Range */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <span className="text-gray-400">-</span>
                <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'yesterday', label: 'Ayer' },
                  { key: 'today', label: 'Hoy' },
                  { key: 'thisWeek', label: 'Esta semana' },
                  { key: 'lastWeek', label: 'Semana pasada' },
                  { key: 'thisMonth', label: 'Este mes' },
                  { key: 'lastMonth', label: 'Mes anterior' },
                  { key: 'thisYear', label: 'Este año' },
                  { key: 'lastYear', label: 'Año pasado' },
                ].map((preset) => (
                  <button key={preset.key} onClick={() => setPreset(preset.key)} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard title="Venta Total" value={visibleTotals.display_revenue} icon={DollarSign} iconBgColor="bg-green-100" iconColor="text-green-600" format="currency" loading={loading} />
            <MetricCard title="Inversion Publicidad" value={visibleTotals.total_ad_spend} icon={MousePointerClick} iconBgColor="bg-blue-100" iconColor="text-blue-600" format="currency" loading={loading} />
            <MetricCard title="ROAS" value={visibleTotals.roas} icon={TrendingUp} iconBgColor="bg-purple-100" iconColor="text-purple-600" format="decimal" loading={loading} />
            <MetricCard title="Pedidos" value={visibleTotals.total_orders} icon={ShoppingCart} iconBgColor="bg-orange-100" iconColor="text-orange-600" format="integer" loading={loading} />
          </div>

          {/* Clients Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Reporte General</h2>
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowHidden(!showHidden)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {showHidden ? 'Ocultar' : `Mostrar ${hiddenCount} ocultos`}
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A1A2E] mx-auto mb-2" />
                <p className="text-gray-500">Cargando métricas...</p>
              </div>
            ) : visibleClients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No hay datos disponibles para el rango seleccionado.</p>
                <p className="text-sm mt-2">Conecta Facebook Ads y Shopify a tus clientes para ver métricas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Venta</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Inversion</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pedidos</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleClients.map((client) => (
                      <tr key={client.client_id} className={`hover:bg-gray-50 transition-colors ${client.is_hidden_from_metrics ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-gray-900">{client.nickname || client.company || client.client_name}</p>
                              <p className="text-sm text-gray-500">{client.company || client.client_name}</p>
                            </div>
                            {client.service_type && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                client.service_type === 'growth' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {client.service_type === 'growth' ? 'Growth' : 'Fee'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          <div className="flex items-center justify-end gap-2">
                            {formatCurrency(client.display_revenue)}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              client.portal_revenue_metric === 'net_confirmed' ? 'bg-blue-100 text-blue-700' :
                              client.portal_revenue_metric === 'confirmed' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {client.portal_revenue_metric === 'net_confirmed' ? 'Neta' : client.portal_revenue_metric === 'confirmed' ? 'Confirmada' : 'Total'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(client.total_ad_spend)}</td>
                        <td className="px-6 py-4 text-right text-gray-600">{client.total_orders || 0}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-medium ${client.roas >= 3 ? 'text-green-600' : client.roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {client.roas?.toFixed(2) || '0.00'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">{client.avg_ctr?.toFixed(2) || '0.00'}%</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => navigate(`/app/metricas/cliente/${client.client_id}`)} className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors" title="Ver detalle">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <button onClick={() => navigate(`/app/clients/${client.client_id}/plataformas`)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Configurar plataformas">
                              <Settings className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleToggleHidden(client.client_id, client.is_hidden_from_metrics)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title={client.is_hidden_from_metrics ? 'Mostrar en tabla' : 'Ocultar de tabla'}
                            >
                              {client.is_hidden_from_metrics ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-medium">
                    <tr>
                      <td className="px-6 py-4 text-gray-900">Total</td>
                      <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(visibleTotals.display_revenue)}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(visibleTotals.total_ad_spend)}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{visibleTotals.total_orders || 0}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{visibleTotals.roas?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 text-right text-gray-900">{visibleTotals.avg_ctr?.toFixed(2) || '0.00'}%</td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <GrowthDashboard />
      )}
    </div>
  );
}

export default MetricsDashboard;
