import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientMetricsAPI } from '../utils/api';
import {
  Mail, Loader2, TrendingUp, TrendingDown, Users, DollarSign,
  Send, MousePointerClick, Eye, ShoppingCart, ChevronLeft, ChevronRight,
  BarChart3,
} from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const fmtCurrency = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;

function MetricCard({ title, value, icon: Icon, format = 'number', subtitle, trend, iconBg = 'bg-gray-100', iconColor = 'text-gray-600' }) {
  const formatted = format === 'currency'
    ? fmtCurrency(value)
    : format === 'percent'
    ? fmtPct(value)
    : fmtInt(value);

  return (
    <div className="glass-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-[#17181A] mt-1 truncate">{formatted}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs mes anterior</span>
        </div>
      )}
    </div>
  );
}

function ClientRow({ client, onClick }) {
  const totalRevenue = (client.campaigns_revenue || 0) + (client.flows_revenue || 0);
  const totalDeliveries = (client.campaigns_deliveries || 0) + (client.flows_deliveries || 0);
  const totalOpens = (client.campaigns_opens || 0) + (client.flows_opens || 0);
  const totalClicks = (client.campaigns_clicks || 0) + (client.flows_clicks || 0);
  const totalConversions = (client.campaigns_conversions || 0) + (client.flows_conversions || 0);
  const hasData = totalDeliveries > 0;

  const openRate = totalDeliveries > 0 ? (totalOpens / totalDeliveries) * 100 : null;
  const clickRate = totalOpens > 0 ? (totalClicks / totalOpens) * 100 : null;
  const convRate = totalDeliveries > 0 ? (totalConversions / totalDeliveries) * 100 : null;

  return (
    <tr
      onClick={onClick}
      className={`hover:bg-gray-50 cursor-pointer transition-colors ${!hasData ? 'opacity-50' : ''}`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 font-semibold text-sm">
            {(client.nickname || client.client_name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[#17181A]">{client.nickname || client.client_name}</p>
            {client.nickname && <p className="text-xs text-gray-400">{client.client_name}</p>}
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="font-semibold text-[#17181A]">{hasData ? fmtCurrency(totalRevenue) : '—'}</span>
        {hasData && totalRevenue > 0 && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            C: {fmtCurrency(client.campaigns_revenue)} · F: {fmtCurrency(client.flows_revenue)}
          </p>
        )}
      </td>
      <td className="py-3 px-3 text-right">{hasData ? fmtInt(totalDeliveries) : '—'}</td>
      <td className="py-3 px-3 text-right">
        {openRate !== null ? (
          <span className={openRate >= 20 ? 'text-green-600 font-medium' : openRate >= 15 ? 'text-yellow-600' : 'text-red-500'}>
            {fmtPct(openRate)}
          </span>
        ) : '—'}
      </td>
      <td className="py-3 px-3 text-right">
        {clickRate !== null ? (
          <span className={clickRate >= 2 ? 'text-green-600 font-medium' : clickRate >= 1 ? 'text-yellow-600' : 'text-red-500'}>
            {fmtPct(clickRate)}
          </span>
        ) : '—'}
      </td>
      <td className="py-3 px-3 text-right">
        {convRate !== null ? fmtPct(convRate) : '—'}
      </td>
      <td className="py-3 px-3 text-right">{hasData ? fmtInt(client.master_segment_size || 0) : '—'}</td>
      <td className="py-3 px-3 text-right">
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            hasData
              ? 'text-purple-600 bg-purple-50 hover:bg-purple-100'
              : 'text-white bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {hasData ? 'Editar' : 'Registrar'}
        </button>
      </td>
    </tr>
  );
}

export default function EmailMarketingDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    load();
  }, [year, month]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await clientMetricsAPI.getEmailDashboard(year, month);
      setData(res.data);
    } catch (error) {
      console.error('Error loading email dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrentMonth) return;

    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1;

  // Separate clients with and without data
  const { clientsWithData, clientsWithoutData } = useMemo(() => {
    if (!data?.clients) return { clientsWithData: [], clientsWithoutData: [] };
    return {
      clientsWithData: data.clients.filter(c => (c.campaigns_deliveries || 0) + (c.flows_deliveries || 0) > 0),
      clientsWithoutData: data.clients.filter(c => !((c.campaigns_deliveries || 0) + (c.flows_deliveries || 0) > 0)),
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const totals = data?.totals || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-100">
            <Mail size={24} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#17181A] tracking-tight">Email Marketing</h1>
            <p className="text-sm text-gray-500">Panorama general de todos los clientes</p>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-3 py-1.5 font-medium text-[#17181A] min-w-[140px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Ingresos Totales"
          value={totals.total_revenue}
          icon={DollarSign}
          format="currency"
          subtitle={`Campaigns: ${fmtCurrency(totals.total_campaigns_revenue)} · Flows: ${fmtCurrency(totals.total_flows_revenue)}`}
          iconBg="bg-green-100"
          iconColor="text-green-600"
        />
        <MetricCard
          title="Correos Enviados"
          value={totals.total_deliveries}
          icon={Send}
          format="number"
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <MetricCard
          title="Open Rate Promedio"
          value={totals.avg_open_rate}
          icon={Eye}
          format="percent"
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
        <MetricCard
          title="CTR Promedio"
          value={totals.avg_click_rate}
          icon={MousePointerClick}
          format="percent"
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <MetricCard
          title="Clientes con Datos"
          value={totals.clients_with_data}
          icon={Users}
          format="number"
          subtitle={`de ${data?.clients?.length || 0} activos`}
          iconBg="bg-gray-100"
          iconColor="text-gray-600"
        />
      </div>

      {/* Revenue Split */}
      {totals.total_revenue > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 font-medium mb-3">Distribución de Ingresos</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Campaigns</span>
                <span className="text-sm font-semibold">{fmtCurrency(totals.total_campaigns_revenue)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(totals.total_campaigns_revenue / totals.total_revenue) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Flows</span>
                <span className="text-sm font-semibold">{fmtCurrency(totals.total_flows_revenue)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(totals.total_flows_revenue / totals.total_revenue) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clients Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#17181A]">Clientes</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {clientsWithData.length} con datos · {clientsWithoutData.length} sin registrar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Click en un cliente para ver/editar sus KPIs</span>
          </div>
        </div>

        {data?.clients?.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Mail className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm">No hay clientes activos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Cliente</th>
                  <th className="text-right py-3 px-3 font-medium">Ingresos</th>
                  <th className="text-right py-3 px-3 font-medium">Enviados</th>
                  <th className="text-right py-3 px-3 font-medium">Open Rate</th>
                  <th className="text-right py-3 px-3 font-medium">CTR</th>
                  <th className="text-right py-3 px-3 font-medium">Conv Rate</th>
                  <th className="text-right py-3 px-3 font-medium">Suscriptores</th>
                  <th className="text-right py-3 px-3 font-medium w-24">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Clients with data first */}
                {clientsWithData.map((client) => (
                  <ClientRow
                    key={client.client_id}
                    client={client}
                    onClick={() => navigate(`/app/clients/${client.client_id}/email-marketing`)}
                  />
                ))}
                {/* Separator if both groups have items */}
                {clientsWithData.length > 0 && clientsWithoutData.length > 0 && (
                  <tr>
                    <td colSpan={8} className="py-2 px-4 bg-gray-50">
                      <p className="text-xs text-gray-400 font-medium">Sin datos registrados este mes</p>
                    </td>
                  </tr>
                )}
                {/* Clients without data */}
                {clientsWithoutData.map((client) => (
                  <ClientRow
                    key={client.client_id}
                    client={client}
                    onClick={() => navigate(`/app/clients/${client.client_id}/email-marketing`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical Trend */}
      {data?.history?.length > 1 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-gray-400" />
            <h3 className="font-semibold text-[#17181A]">Tendencia de Ingresos</h3>
          </div>
          <div className="flex items-end gap-2 h-32">
            {data.history.map((h, i) => {
              const maxRevenue = Math.max(...data.history.map(x => x.total_revenue || 0));
              const height = maxRevenue > 0 ? ((h.total_revenue || 0) / maxRevenue) * 100 : 0;
              const isCurrentMonth = h.year === year && h.month === month;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-lg transition-all ${isCurrentMonth ? 'bg-purple-500' : 'bg-gray-200'}`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={fmtCurrency(h.total_revenue)}
                  />
                  <span className="text-[10px] text-gray-400">{MONTHS[h.month - 1].slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
