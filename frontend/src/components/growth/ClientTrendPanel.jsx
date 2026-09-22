import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clientMetricsAPI } from '../../utils/api';
import { revenueMetricLabel, pickDailyDisplayRevenue, pickDailyDisplayRoas, dailyAdSpend } from '../../utils/revenueMetric';
import MonthlyGrowthChart from './MonthlyGrowthChart';

// ─── Date helpers (Colombia timezone) ───
const getColombiaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const getCurrentPeriod = () => getColombiaDate().substring(0, 7); // YYYY-MM
const getLast7Days = () => {
  const today = getColombiaDate();
  const d = new Date(today + 'T12:00:00');
  d.setDate(d.getDate() - 6);
  return { start: d.toISOString().split('T')[0], end: today };
};

// ─── Formatters ───
const formatShortDate = (dateStr) => dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—';
const formatWeekday = (dateStr) => dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short' }) : '';
const formatCOP = (val) => {
  if (!val) return '$0';
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
};
const formatCOPFull = (val) => val ? '$' + Math.round(val).toLocaleString('es-CO') : '$0';
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const roasColor = (roas, zeroClass = 'text-red-600') =>
  roas >= 3 ? 'text-green-600' : roas >= 1 ? 'text-yellow-600' : zeroClass;

/**
 * Expandable trend panel for one client: last 7 days table, last 4 months cards
 * and the monthly growth chart. Self-contained: loads its own data.
 *
 * Revenue always follows the client's configured metric (total / confirmed / net):
 * the backend already returns display_revenue per day, the helpers are a fallback.
 *
 * Props:
 *  - clientId
 *  - revenueMetric / revenueLabel: from the aggregate row (portal_revenue_metric / revenue_label)
 *  - refreshKey: change it to force a reload (e.g. when the parent summary reloads)
 *  - footer: optional extra section rendered inside the panel, below the growth chart
 */
export default function ClientTrendPanel({ clientId, revenueMetric, revenueLabel, refreshKey, footer = null }) {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { start: dailyStart, end: dailyEnd } = getLast7Days();
        const today = new Date(getColombiaDate() + 'T12:00:00');
        const monthlyStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        const monthlyStartStr = monthlyStart.toISOString().split('T')[0];

        const [dailyRes, monthlyRes] = await Promise.all([
          clientMetricsAPI.getDailyMetrics(clientId, dailyStart, dailyEnd),
          clientMetricsAPI.getDailyMetrics(clientId, monthlyStartStr, dailyEnd),
        ]);
        if (cancelled) return;

        setDaily(dailyRes.data || []);

        const byMonth = (monthlyRes.data || []).reduce((acc, day) => {
          const key = day.metric_date.substring(0, 7);
          if (!acc[key]) acc[key] = { month: key, revenue: 0, orders: 0, spend: 0 };
          acc[key].revenue += pickDailyDisplayRevenue(revenueMetric, day);
          acc[key].orders += day.shopify_orders || 0;
          acc[key].spend += dailyAdSpend(day);
          return acc;
        }, {});
        // Chronological: oldest on the left, current month on the right
        setMonthly(Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)));
      } catch (error) {
        console.error('Error loading client trend panel:', error);
        if (!cancelled) { setDaily([]); setMonthly([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [clientId, revenueMetric, refreshKey]);

  const currentPeriod = getCurrentPeriod();
  const label = revenueLabel || revenueMetricLabel(revenueMetric);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Last 7 days */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Últimos 7 días</span>
        <span className="text-[10px] text-gray-400">{label}</span>
      </div>
      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : daily.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm">Sin datos en los últimos 7 días</div>
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
            {[...daily].sort((a, b) => b.metric_date.localeCompare(a.metric_date)).map((day) => {
              const revenue = pickDailyDisplayRevenue(revenueMetric, day);
              const spend = dailyAdSpend(day);
              const roas = pickDailyDisplayRoas(revenueMetric, day);
              return (
                <tr key={day.metric_date} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{formatShortDate(day.metric_date)}</td>
                  <td className="px-4 py-2 text-gray-400 capitalize">{formatWeekday(day.metric_date)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCOPFull(revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatCOPFull(spend)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{day.shopify_orders || 0}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-medium ${roasColor(roas)}`}>{roas.toFixed(2)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Monthly breakdown - last 4 months */}
      {!loading && monthly.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Ventas por Mes</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-3">
            {monthly.map((m) => {
              const roas = m.spend > 0 ? m.revenue / m.spend : 0;
              const [y, mm] = m.month.split('-');
              const isCurrent = m.month === currentPeriod;
              return (
                <div key={m.month} className={`bg-gray-50 rounded-lg p-3 ${isCurrent ? 'ring-1 ring-emerald-200' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">{`${MONTHS[parseInt(mm, 10) - 1]} ${y}`}</span>
                    {isCurrent && <span className="text-[10px] text-emerald-600 font-medium">En curso</span>}
                  </div>
                  <div className="text-base font-semibold text-gray-900">{formatCOP(m.revenue)}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    <span>{m.orders} pedidos</span>
                    <span>·</span>
                    <span className={roasColor(roas, 'text-gray-400')}>{roas > 0 ? `${roas.toFixed(1)}× ROAS` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Growth chart: sales + ROAS per month */}
          <MonthlyGrowthChart months={monthly} currentPeriod={currentPeriod} />
        </div>
      )}

      {footer}
    </div>
  );
}
