import React, { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Plus, ChevronRight, ChevronLeft, Check, Clock, AlertTriangle,
  Flag, Target, Zap, Users, X, Trash2, Save, TrendingUp, TrendingDown, Minus,
  Mail, Globe, Megaphone, Palette, Video, User, CheckCircle2, Calendar, ChevronDown, ChevronUp, Layers,
  CalendarDays, BarChart2
} from 'lucide-react';
import { growthAPI, clientMetricsAPI, clientsAPI } from '../utils/api';

const getColombiaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const getCurrentPeriod = () => {
  const d = getColombiaDate();
  return d.substring(0, 7); // YYYY-MM
};

// Get dates for "last 7 days" (default)
const getLast7Days = () => {
  const today = getColombiaDate();
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() - 6);
  return {
    start: d.toISOString().split('T')[0],
    end: today
  };
};

// Get dates for current month
const getCurrentMonthDates = () => {
  const today = getColombiaDate();
  const [y, m] = today.split('-');
  const start = `${y}-${m}-01`;
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const getPeriodLabel = (period) => {
  const [y, m] = period.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[parseInt(m) - 1]} ${y}`;
};

const getPeriodDates = (period) => {
  const [y, m] = period.split('-');
  const start = `${y}-${m}-01`;
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

// Format short date
const formatShortDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

// Format weekday
const formatWeekday = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'short' });
};

const formatCOP = (val) => {
  if (!val) return '$0';
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
};

// Full number format (no abbreviation) - for daily tables
const formatCOPFull = (val) => {
  if (!val) return '$0';
  return '$' + Math.round(val).toLocaleString('es-CO');
};

export default function GrowthDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(getCurrentPeriod());
  // Date range state (for flexible filtering)
  const [dateRange, setDateRange] = useState(getCurrentMonthDates());
  const [dateMode, setDateMode] = useState('month'); // 'month' | 'custom'
  const [growthClients, setGrowthClients] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [metricsData, setMetricsData] = useState({ clients: [] });
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientGrowthData, setClientGrowthData] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [activeTab, setActiveTab] = useState('financiero');
  // Expanded daily tracking for clients
  const [expandedClients, setExpandedClients] = useState({});
  const [clientDailyMetrics, setClientDailyMetrics] = useState({});
  const [loadingDaily, setLoadingDaily] = useState({});

  useEffect(() => { loadOverview(); }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    if (selectedClient) loadClientDetail(selectedClient.id);
  }, [selectedClient, period]);

  // When period changes (month navigation), update dateRange
  useEffect(() => {
    if (dateMode === 'month') {
      setDateRange(getPeriodDates(period));
    }
  }, [period, dateMode]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [gcRes, metricsRes, clientsRes] = await Promise.all([
        growthAPI.getClients(),
        clientMetricsAPI.getAggregate(dateRange.start, dateRange.end),
        clientsAPI.getAll(),
      ]);
      setGrowthClients(gcRes.data || []);
      setMetricsData(metricsRes.data || { clients: [] });
      setAllClients((clientsRes.data || []).filter(c => c.status !== 'inactive'));
    } catch (error) {
      console.error('Error loading growth overview:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load daily metrics for a client (last 7 days)
  const loadClientDailyMetrics = async (clientId) => {
    if (loadingDaily[clientId]) return;
    setLoadingDaily(prev => ({ ...prev, [clientId]: true }));
    try {
      const { start, end } = getLast7Days();
      const res = await clientMetricsAPI.getDailyMetrics(clientId, start, end);
      setClientDailyMetrics(prev => ({ ...prev, [clientId]: res.data || [] }));
    } catch (error) {
      console.error('Error loading daily metrics:', error);
      setClientDailyMetrics(prev => ({ ...prev, [clientId]: [] }));
    } finally {
      setLoadingDaily(prev => ({ ...prev, [clientId]: false }));
    }
  };

  // Toggle expanded state for a client
  const toggleClientExpanded = (clientId) => {
    const isExpanded = expandedClients[clientId];
    setExpandedClients(prev => ({ ...prev, [clientId]: !isExpanded }));
    if (!isExpanded && !clientDailyMetrics[clientId]) {
      loadClientDailyMetrics(clientId);
    }
  };

  const loadClientDetail = async (clientId) => {
    try {
      const res = await growthAPI.getClientData(clientId, period);
      setClientGrowthData(res.data);
    } catch (error) {
      console.error('Error loading client growth data:', error);
    }
  };

  const handleAddGrowthClient = async (clientId) => {
    try {
      await growthAPI.setServiceType(clientId, 'growth');
      setShowAddClient(false);
      loadOverview();
    } catch (error) {
      console.error('Error adding growth client:', error);
    }
  };

  const handleRemoveGrowthClient = async (clientId) => {
    if (!confirm('¿Quitar este cliente de Growth?')) return;
    try {
      await growthAPI.setServiceType(clientId, null);
      if (selectedClient?.id === clientId) { setSelectedClient(null); setClientGrowthData(null); }
      loadOverview();
    } catch (error) {
      console.error('Error removing growth client:', error);
    }
  };

  const changePeriod = (delta) => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Merge growth client list with metrics
  const enrichedClients = growthClients.map(gc => {
    const metrics = metricsData.clients.find(m => m.client_id === gc.id);
    return { ...gc, metrics };
  });

  // Non-growth clients available to add
  const availableClients = allClients.filter(c => !growthClients.some(gc => gc.id === c.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#17181A]" />
      </div>
    );
  }

  // CLIENT DETAIL VIEW
  if (selectedClient) {
    const cm = metricsData.clients.find(m => m.client_id === selectedClient.id);
    return (
      <ClientDetailView
        client={selectedClient}
        metrics={cm}
        growthData={clientGrowthData}
        period={period}
        onBack={() => { setSelectedClient(null); setClientGrowthData(null); }}
        onRefresh={() => loadClientDetail(selectedClient.id)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        formatCOP={formatCOP}
      />
    );
  }

  // OVERVIEW VIEW
  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick filters */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setDateMode('month');
                setPeriod(getCurrentPeriod());
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateMode === 'month' ? 'bg-white text-[#17181A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => {
                setDateMode('custom');
                setDateRange(getLast7Days());
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateMode === 'custom' ? 'bg-white text-[#17181A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Personalizado
            </button>
          </div>

          {dateMode === 'month' ? (
            /* Month navigation */
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1">
              <button onClick={() => changePeriod(-1)} className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <span className="text-sm font-medium text-[#17181A] min-w-[120px] text-center">{getPeriodLabel(period)}</span>
              <button onClick={() => changePeriod(1)} className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ) : (
            /* Custom date range */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="text-sm border-0 focus:ring-0 p-0 w-28"
                />
              </div>
              <span className="text-gray-400 text-sm">a</span>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="text-sm border-0 focus:ring-0 p-0 w-28"
                />
              </div>
              {/* Quick presets */}
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => setDateRange(getLast7Days())}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-[#17181A] hover:bg-gray-100 rounded transition-colors"
                >
                  7 días
                </button>
                <button
                  onClick={() => {
                    const today = getColombiaDate();
                    const d = new Date(today + 'T12:00:00');
                    d.setDate(d.getDate() - 14);
                    setDateRange({ start: d.toISOString().split('T')[0], end: today });
                  }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-[#17181A] hover:bg-gray-100 rounded transition-colors"
                >
                  14 días
                </button>
                <button
                  onClick={() => {
                    const today = getColombiaDate();
                    const d = new Date(today + 'T12:00:00');
                    d.setDate(d.getDate() - 29);
                    setDateRange({ start: d.toISOString().split('T')[0], end: today });
                  }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-[#17181A] hover:bg-gray-100 rounded transition-colors"
                >
                  30 días
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAddClient(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#17181A] text-white rounded-xl hover:bg-[#26282C] transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Agregar cliente
        </button>
      </div>

      {/* Overview KPIs */}
      {enrichedClients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Clientes Growth" value={enrichedClients.length} accent />
          <KpiCard
            label="Venta total Growth"
            value={formatCOP(enrichedClients.reduce((s, c) => s + (c.metrics?.display_revenue || 0), 0))}
          />
          <KpiCard
            label="ROAS promedio"
            value={(() => {
              const clients = enrichedClients.filter(c => c.metrics?.roas > 0);
              return clients.length > 0 ? (clients.reduce((s, c) => s + c.metrics.roas, 0) / clients.length).toFixed(1) + '×' : '—';
            })()}
          />
          <KpiCard
            label="Inversión total"
            value={formatCOP(enrichedClients.reduce((s, c) => s + (c.metrics?.total_ad_spend || 0), 0))}
          />
        </div>
      )}

      {/* Clients Table */}
      {enrichedClients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay clientes Growth configurados</p>
          <p className="text-sm text-gray-400 mt-1">Agrega clientes para comenzar a hacer seguimiento</p>
          <button onClick={() => setShowAddClient(true)} className="mt-4 px-4 py-2 bg-[#17181A] text-white rounded-xl text-sm">
            <Plus className="w-4 h-4 inline mr-1" /> Agregar cliente
          </button>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Todos los clientes Growth</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ventas</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Inversión</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pedidos</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrichedClients.map((client) => {
                  const m = client.metrics;
                  const isExpanded = expandedClients[client.id];
                  const dailyData = clientDailyMetrics[client.id] || [];
                  const isLoadingDaily = loadingDaily[client.id];
                  return (
                    <React.Fragment key={client.id}>
                      <tr
                        onClick={() => { setSelectedClient(client); setActiveTab('financiero'); }}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{client.nickname || client.name}</p>
                          <p className="text-xs text-gray-400">{client.company}</p>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCOPFull(m?.display_revenue)}</td>
                        <td className="px-6 py-4 text-right text-gray-600">{formatCOPFull(m?.total_ad_spend)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-medium ${(m?.roas || 0) >= 3 ? 'text-green-600' : (m?.roas || 0) >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {m?.roas?.toFixed(2) || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">{m?.total_orders || 0}</td>
                        <td className="px-6 py-4 text-right text-gray-600">{formatCOPFull(m?.ticket_promedio)}</td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleClientExpanded(client.id)}
                              className={`p-2 rounded-lg transition-colors ${isExpanded ? 'text-[#17181A] bg-gray-100' : 'text-gray-400 hover:text-[#17181A] hover:bg-gray-100'}`}
                              title="Ver últimos 7 días"
                            >
                              <BarChart2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedClient(client); setActiveTab('financiero'); }}
                              className="p-2 text-gray-400 hover:text-[#17181A] hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleRemoveGrowthClient(client.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Quitar de Growth"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expandable daily metrics row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Últimos 7 días</span>
                                <span className="text-[10px] text-gray-400">
                                  {m?.revenue_type === 'net' ? 'Venta Neta' : 'Venta Total'}
                                </span>
                              </div>
                              {isLoadingDaily ? (
                                <div className="py-8 flex justify-center">
                                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                </div>
                              ) : dailyData.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">
                                  Sin datos en los últimos 7 días
                                </div>
                              ) : (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                                      <th className="px-4 py-2 text-left font-medium">Fecha</th>
                                      <th className="px-4 py-2 text-left font-medium">Día</th>
                                      <th className="px-4 py-2 text-right font-medium">Ventas</th>
                                      <th className="px-4 py-2 text-right font-medium">Inversión</th>
                                      <th className="px-4 py-2 text-right font-medium">Pedidos</th>
                                      <th className="px-4 py-2 text-right font-medium">ROAS</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {dailyData.sort((a, b) => b.metric_date.localeCompare(a.metric_date)).map((day) => {
                                      const revenue = m?.revenue_type === 'net' ? day.shopify_net_revenue : day.shopify_revenue;
                                      const spend = (day.fb_spend || 0) + (day.ga_spend || 0) + (day.tt_spend || 0);
                                      const roas = spend > 0 ? revenue / spend : 0;
                                      return (
                                        <tr key={day.metric_date} className="hover:bg-gray-50">
                                          <td className="px-4 py-2 text-gray-600">{formatShortDate(day.metric_date)}</td>
                                          <td className="px-4 py-2 text-gray-400 capitalize">{formatWeekday(day.metric_date)}</td>
                                          <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCOPFull(revenue)}</td>
                                          <td className="px-4 py-2 text-right text-gray-600">{formatCOPFull(spend)}</td>
                                          <td className="px-4 py-2 text-right text-gray-600">{day.shopify_orders || 0}</td>
                                          <td className="px-4 py-2 text-right">
                                            <span className={`font-medium ${roas >= 3 ? 'text-green-600' : roas >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                                              {roas.toFixed(2)}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowAddClient(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-[#17181A]">Agregar cliente a Growth</h3>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {availableClients.length === 0 ? (
                <p className="p-4 text-center text-gray-400 text-sm">Todos los clientes ya están en Growth</p>
              ) : (
                availableClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleAddGrowthClient(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                      {(c.nickname || c.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.nickname || c.name}</p>
                      <p className="text-xs text-gray-400">{c.company}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setShowAddClient(false)} className="w-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({ label, value, accent }) {
  return (
    <div className="glass-solid rounded-xl p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-green-600' : 'text-[#17181A]'}`}>{value}</p>
    </div>
  );
}

// ─── Client Detail View ───
function ClientDetailView({ client, metrics, growthData, period, onBack, onRefresh, activeTab, setActiveTab, formatCOP }) {
  const m = metrics || {};
  const gd = growthData || { objectives: [], palancas: [], milestones: [], banderas: [] };

  const tabs = [
    { key: 'financiero', label: 'Salud financiera', icon: TrendingUp },
    { key: 'palancas', label: 'Palancas', icon: Zap },
    { key: 'roadmap', label: 'Roadmap', icon: Target },
    { key: 'alertas', label: 'Alertas', icon: Flag },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Client Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-[#17181A]">{client.nickname || client.name}</h2>
          <p className="text-sm text-gray-400">{client.company} · {getPeriodLabel(period)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
                activeTab === tab.key ? 'bg-white text-[#17181A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'financiero' && <FinancieroTab metrics={m} objectives={gd.objectives} formatCOP={formatCOP} clientId={client.id} period={period} onRefresh={onRefresh} />}
      {activeTab === 'palancas' && <PalancasTab clientId={client.id} period={period} />}
      {activeTab === 'roadmap' && <RoadmapTab milestones={gd.milestones} clientId={client.id} period={period} onRefresh={onRefresh} />}
      {activeTab === 'alertas' && <AlertasTab banderas={gd.banderas} clientId={client.id} period={period} onRefresh={onRefresh} />}
    </div>
  );
}

// ─── Financiero Tab ───
function FinancieroTab({ metrics, objectives, formatCOP, clientId, period, onRefresh }) {
  const m = metrics || {};
  const kpis = [
    { label: 'Ventas', value: formatCOP(m.display_revenue), color: '' },
    { label: 'Ticket promedio', value: formatCOP(m.ticket_promedio), color: '' },
    { label: 'ROAS', value: m.roas ? `${m.roas.toFixed(1)}×` : '—', color: (m.roas || 0) >= 3 ? 'text-green-600' : (m.roas || 0) >= 1 ? 'text-yellow-600' : 'text-red-600' },
    { label: 'CPO', value: formatCOP(m.cost_per_order), color: '' },
    { label: 'Inversión', value: formatCOP(m.total_ad_spend), color: '' },
    { label: 'Pedidos', value: m.total_orders || 0, color: '' },
    { label: 'Sesiones', value: m.total_sessions || 0, color: '' },
    { label: '% Inversión', value: m.ad_spend_percentage ? `${m.ad_spend_percentage.toFixed(1)}%` : '—', color: '' },
  ];

  // Objectives for revenue and roas
  const revenueObj = objectives.find(o => o.metric === 'revenue');
  const roasObj = objectives.find(o => o.metric === 'roas');

  // Projection calculation
  const [y, mo] = period.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const today = new Date();
  const colombiaDate = new Date(today.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const isCurrentMonth = colombiaDate.getFullYear() === y && (colombiaDate.getMonth() + 1) === mo;
  const daysPassed = isCurrentMonth ? colombiaDate.getDate() : daysInMonth;

  const currentRevenue = m.display_revenue || 0;
  const meta = revenueObj?.base || 0;
  const avgDailyRevenue = daysPassed > 0 ? currentRevenue / daysPassed : 0;
  const projection = avgDailyRevenue * daysInMonth;
  const metaCompletePct = meta > 0 ? Math.round((currentRevenue / meta) * 100) : 0;
  const projectionDiff = projection - meta;
  const onTrack = projection >= meta;

  return (
    <div className="space-y-6">
      {/* Meta del Mes Card - only show if we have a revenue objective */}
      {revenueObj && meta > 0 && (
        <div className="glass-solid rounded-xl p-5 border-l-4 border-l-green-500">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Meta del mes</p>
              <p className="text-2xl font-bold text-[#17181A] mt-1">{formatCOP(meta)}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              onTrack ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {onTrack ? (
                <><TrendingUp size={14} /> On track</>
              ) : (
                <><TrendingDown size={14} /> Off track</>
              )}
            </div>
          </div>

          {/* Progress bar toward goal */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">Progreso actual</span>
              <span className="text-sm font-bold text-[#17181A]">{metaCompletePct}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metaCompletePct >= 100 ? 'bg-green-500' : metaCompletePct >= 70 ? 'bg-blue-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(100, metaCompletePct)}%` }}
              />
              {/* Marker for expected progress based on day of month */}
              {isCurrentMonth && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-gray-400"
                  style={{ left: `${(daysPassed / daysInMonth) * 100}%` }}
                  title={`Día ${daysPassed} de ${daysInMonth}`}
                />
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
              <span>Actual: {formatCOP(currentRevenue)}</span>
              <span>Meta: {formatCOP(meta)}</span>
            </div>
          </div>

          {/* Projection stats */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Proyección</p>
              <p className="text-lg font-bold text-[#17181A]">{formatCOP(projection)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">vs Meta</p>
              <p className={`text-lg font-bold ${projectionDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {projectionDiff >= 0 ? '+' : ''}{formatCOP(projectionDiff)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Día / Mes</p>
              <p className="text-lg font-bold text-gray-600">{daysPassed} / {daysInMonth}</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div>
        <SectionHeader label="Revenue & Performance" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="glass-solid rounded-xl p-4 hover:border-green-200 transition-colors">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium mb-2">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color || 'text-[#17181A]'}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scenarios */}
      {(revenueObj || roasObj) && (
        <div>
          <SectionHeader label="Progreso hacia escenarios pactados" />
          <div className="grid md:grid-cols-2 gap-3">
            {revenueObj && (
              <ScenarioCard
                title="Ventas mensuales"
                actual={m.display_revenue || 0}
                conservador={revenueObj.conservador}
                base={revenueObj.base}
                optimista={revenueObj.optimista}
                format={formatCOP}
              />
            )}
            {roasObj && (
              <ScenarioCard
                title="ROAS"
                actual={m.roas || 0}
                conservador={roasObj.conservador}
                base={roasObj.base}
                optimista={roasObj.optimista}
                format={(v) => `${v.toFixed(1)}×`}
              />
            )}
          </div>
        </div>
      )}

      {/* Set Objectives */}
      <ObjectivesForm clientId={clientId} period={period} objectives={objectives} onRefresh={onRefresh} />
    </div>
  );
}

// ─── Scenario Progress Card ───
function ScenarioCard({ title, actual, conservador, base, optimista, format }) {
  const maxVal = Math.max(optimista, actual) * 1.1;
  const pct = (val) => Math.min(100, (val / maxVal) * 100);

  const scenarios = [
    { name: 'Conservador', val: conservador, color: 'bg-gray-400' },
    { name: 'Base', val: base, color: 'bg-blue-400' },
    { name: 'Optimista', val: optimista, color: 'bg-green-400' },
  ];

  return (
    <div className="glass-solid rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-sm text-[#17181A]">{title}</p>
        <span className="text-xs text-gray-400">Actual: <strong className="text-[#17181A]">{format(actual)}</strong></span>
      </div>
      <div className="space-y-3">
        {scenarios.map((s) => (
          <div key={s.name}>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{s.name}</span>
              <span className="text-xs text-gray-500">{format(s.val)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct(s.val)}%` }} />
              <div className="absolute top-0 h-full w-0.5 bg-[#17181A]" style={{ left: `${pct(actual)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Objectives Form ───
function ObjectivesForm({ clientId, period, objectives, onRefresh }) {
  const [editing, setEditing] = useState(false);

  const initialForm = useMemo(() => {
    const rev = objectives.find(o => o.metric === 'revenue');
    const roas = objectives.find(o => o.metric === 'roas');
    return {
      revenue: { conservador: rev?.conservador || '', base: rev?.base || '', optimista: rev?.optimista || '' },
      roas: { conservador: roas?.conservador || '', base: roas?.base || '', optimista: roas?.optimista || '' },
    };
  }, [objectives]);

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const handleSave = async () => {
    try {
      await Promise.all([
        growthAPI.createObjective(clientId, { period, metric: 'revenue', ...form.revenue }),
        growthAPI.createObjective(clientId, { period, metric: 'roas', ...form.roas }),
      ]);
      setEditing(false);
      onRefresh();
    } catch (error) {
      console.error('Error saving objectives:', error);
    }
  };

  return (
    <div className="glass-solid rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-sm text-[#17181A]">Escenarios pactados</p>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#17181A] text-white rounded-lg"><Save className="w-3 h-3" /> Guardar</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Editar</button>
        )}
      </div>
      {editing ? (
        <div className="space-y-4">
          {['revenue', 'roas'].map((metric) => (
            <div key={metric}>
              <p className="text-xs font-medium text-gray-500 mb-2">{metric === 'revenue' ? 'Ventas (COP)' : 'ROAS (×)'}</p>
              <div className="grid grid-cols-3 gap-2">
                {['conservador', 'base', 'optimista'].map((level) => (
                  <div key={level}>
                    <label className="text-[10px] text-gray-400 uppercase">{level}</label>
                    <input
                      type="number"
                      value={form[metric][level]}
                      onChange={(e) => setForm(f => ({ ...f, [metric]: { ...f[metric], [level]: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400">
          {objectives.length > 0
            ? 'Escenarios configurados. Edita para ajustar.'
            : 'Sin escenarios configurados. Haz clic en Editar para definir objetivos.'}
        </div>
      )}
    </div>
  );
}

// ─── Palancas Tab (from Structured Briefs) ───

const AREA_ICONS = {
  email_marketing: Mail,
  web: Globe,
  traffic: Megaphone,
  design: Palette,
  ugc: Video,
  social: Users,
  seo: Globe,
  crm: Users,
  other: Layers,
};

const TASK_STATUS_CONFIG = {
  todo: { label: 'Pendiente', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
  in_progress: { label: 'En progreso', color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
  done: { label: 'Completada', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
  blocked: { label: 'Bloqueada', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle },
};

function PalancasTab({ clientId, period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedAreas, setExpandedAreas] = useState({});

  useEffect(() => {
    loadPalancasDashboard();
  }, [clientId, period]);

  const loadPalancasDashboard = async () => {
    try {
      setLoading(true);
      const res = await growthAPI.getPalancasDashboard(clientId, period);
      setData(res.data);
      // Expand all areas by default
      const expanded = {};
      (res.data?.areas || []).forEach(a => { expanded[a.area_key] = true; });
      setExpandedAreas(expanded);
    } catch (error) {
      console.error('Error loading palancas dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleArea = (areaKey) => {
    setExpandedAreas(prev => ({ ...prev, [areaKey]: !prev[areaKey] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data?.has_brief) {
    return (
      <div className="space-y-4">
        <SectionHeader label="Palancas de crecimiento" />
        <div className="glass-solid rounded-xl p-8 text-center">
          <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sin brief estructurado para este período</p>
          <p className="text-sm text-gray-400 mt-1">
            Crea un brief estructurado para este cliente y mes para ver las palancas de crecimiento aquí.
          </p>
        </div>
      </div>
    );
  }

  const { areas, summary } = data;

  return (
    <div className="space-y-5">
      <SectionHeader label="Palancas de crecimiento" />

      {/* Overall Progress */}
      {summary.total_tasks > 0 && (
        <div className="glass-solid rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Progreso general del mes</span>
            <span className="text-sm font-bold text-[#17181A]">
              {summary.completed}/{summary.total_tasks} tareas ({summary.progress_pct}%)
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${summary.progress_pct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {summary.completed} completadas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {summary.in_progress} en progreso
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300"></span>
              {summary.total_tasks - summary.completed - summary.in_progress} pendientes
            </span>
          </div>
        </div>
      )}

      {/* Areas */}
      {areas.length === 0 ? (
        <div className="glass-solid rounded-xl p-8 text-center">
          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">El brief no tiene áreas definidas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {areas.map((area) => {
            const AreaIcon = AREA_ICONS[area.area_key] || AREA_ICONS.other;
            const isExpanded = expandedAreas[area.area_key];
            const { stats } = area;
            const progressPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

            return (
              <div key={area.area_key} className="glass-solid rounded-xl overflow-hidden">
                {/* Area header */}
                <div
                  onClick={() => toggleArea(area.area_key)}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <AreaIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-[#17181A]">{area.area_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        {area.responsible && (
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {area.responsible.name}
                          </span>
                        )}
                        {stats.total > 0 && (
                          <span>· {stats.done}/{stats.total} tareas</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {stats.total > 0 && (
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8">{progressPct}%</span>
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Area content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    {/* Context */}
                    {area.context && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 leading-relaxed">{area.context}</p>
                      </div>
                    )}

                    {/* Tasks */}
                    {area.tasks.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {area.tasks.map((task) => {
                          const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo;
                          const StatusIcon = statusConfig.icon;

                          return (
                            <div
                              key={task.id}
                              className={`p-2.5 rounded-lg border ${
                                task.status === 'done'
                                  ? 'bg-green-50/50 border-green-100'
                                  : 'bg-white border-gray-100'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className={`w-5 h-5 rounded-md ${statusConfig.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                  <StatusIcon size={12} className={statusConfig.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${
                                    task.status === 'done' ? 'text-gray-400 line-through' : 'text-[#17181A]'
                                  }`}>
                                    {task.title}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px]">
                                    <span className={`px-1.5 py-0.5 rounded ${statusConfig.bg} ${statusConfig.color}`}>
                                      {statusConfig.label}
                                    </span>
                                    {task.due_date && (
                                      <span className="text-gray-400 flex items-center gap-0.5">
                                        <Calendar size={9} />
                                        {new Date(task.due_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!area.context && area.tasks.length === 0 && (
                      <p className="mt-3 text-xs text-gray-400 italic">Sin contenido en esta área</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Roadmap Tab ───
function RoadmapTab({ milestones, clientId, period, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', meta: '', responsable: 'lareal' });

  const handleCreate = async () => {
    if (!form.nombre) return;
    try {
      await growthAPI.createMilestone(clientId, { ...form, period });
      setForm({ nombre: '', meta: '', responsable: 'lareal' });
      setShowForm(false);
      onRefresh();
    } catch (error) { console.error(error); }
  };

  const handleToggleStatus = async (ms) => {
    const next = { pending: 'progress', progress: 'done', done: 'pending', blocked: 'pending' };
    try { await growthAPI.updateMilestone(ms.id, { ...ms, status: next[ms.status] || 'pending' }); onRefresh(); } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try { await growthAPI.deleteMilestone(id); onRefresh(); } catch (e) { console.error(e); }
  };

  const statusIcons = {
    done: <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-green-600" /></div>,
    progress: <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-blue-600" /></div>,
    pending: <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"><Minus className="w-3.5 h-3.5 text-gray-400" /></div>,
    blocked: <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></div>,
  };

  const completedCount = milestones.filter(m => m.status === 'done').length;
  const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <SectionHeader label="Milestones del mes" />

      {/* Progress bar */}
      {milestones.length > 0 && (
        <div className="glass-solid rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Progreso</span>
            <span className="text-sm font-bold text-[#17181A]">{completedCount}/{milestones.length} ({progressPct}%)</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {milestones.map((ms) => (
          <div key={ms.id} className="glass-solid rounded-xl p-4 flex items-center gap-3 hover:border-green-200 transition-colors">
            <button onClick={() => handleToggleStatus(ms)} className="flex-shrink-0" title="Cambiar estado">
              {statusIcons[ms.status]}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${ms.status === 'done' ? 'line-through text-gray-400' : 'text-[#17181A]'}`}>{ms.nombre}</p>
              {ms.meta && <p className="text-xs text-gray-400 mt-0.5">{ms.meta}</p>}
            </div>
            <span className={`text-[10px] px-2 py-1 rounded font-medium flex-shrink-0 ${
              ms.responsable === 'lareal' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {ms.responsable === 'lareal' ? 'LA REAL' : 'CLIENTE'}
            </span>
            <button onClick={() => handleDelete(ms.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="glass-solid rounded-xl p-4 space-y-3">
          <input value={form.nombre} onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del milestone" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.meta} onChange={(e) => setForm(f => ({ ...f, meta: e.target.value }))} placeholder="Meta (ej: Semana 2 — Abril)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <select value={form.responsable} onChange={(e) => setForm(f => ({ ...f, responsable: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="lareal">LA REAL</option>
              <option value="cliente">Cliente</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 text-sm bg-[#17181A] text-white rounded-lg">Agregar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#17181A] transition-colors">
          <Plus className="w-4 h-4" /> Agregar milestone
        </button>
      )}
    </div>
  );
}

// ─── Alertas Tab ───
function AlertasTab({ banderas, clientId, period, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', nivel: 'media' });

  const handleCreate = async () => {
    if (!form.titulo) return;
    try {
      await growthAPI.createBandera(clientId, { ...form, period });
      setForm({ titulo: '', descripcion: '', nivel: 'media' });
      setShowForm(false);
      onRefresh();
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (id) => {
    try { await growthAPI.deleteBandera(id); onRefresh(); } catch (e) { console.error(e); }
  };

  const nivelStyles = {
    critica: 'border-l-red-500 bg-red-50',
    alta: 'border-l-yellow-500 bg-yellow-50',
    media: 'border-l-gray-300 bg-gray-50',
  };

  const nivelLabels = { critica: 'CRITICA', alta: 'ALTA', media: 'MEDIA' };

  return (
    <div className="space-y-4">
      <SectionHeader label="Banderas activas" />

      {banderas.length === 0 && !showForm && (
        <div className="glass-solid rounded-xl p-8 text-center">
          <Flag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Sin banderas activas</p>
        </div>
      )}

      <div className="space-y-2">
        {banderas.map((b) => (
          <div key={b.id} className={`rounded-xl p-4 border-l-4 ${nivelStyles[b.nivel] || nivelStyles.media}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    b.nivel === 'critica' ? 'text-red-600' : b.nivel === 'alta' ? 'text-yellow-700' : 'text-gray-500'
                  }`}>
                    {nivelLabels[b.nivel]}
                  </span>
                </div>
                <p className="font-medium text-sm text-[#17181A]">{b.titulo}</p>
                {b.descripcion && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{b.descripcion}</p>}
              </div>
              <button onClick={() => handleDelete(b.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="glass-solid rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <input value={form.titulo} onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título de la bandera" className="col-span-3 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <select value={form.nivel} onChange={(e) => setForm(f => ({ ...f, nivel: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
            </select>
          </div>
          <textarea value={form.descripcion} onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 text-sm bg-[#17181A] text-white rounded-lg">Agregar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#17181A] transition-colors">
          <Plus className="w-4 h-4" /> Agregar bandera
        </button>
      )}
    </div>
  );
}

// ─── Section Header ───
function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}
