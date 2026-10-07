import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clientMetricsAPI } from '../../utils/api';
import { revenueMetricLabel, pickDailyDisplayRevenue, dailyAdSpend } from '../../utils/revenueMetric';
import MonthlyGrowthChart from './MonthlyGrowthChart';
import { DailyTrendTable, TrendViewControls, WeeklyTrendTable } from './TrendTables';
import {
  getColombiaDate,
  loadTrendView,
  roasColor,
  saveTrendView,
  trendDateRange,
  trendEmptyText,
  trendTitle,
} from './trendRange';

// ─── Date helpers (Colombia timezone) ───
const getCurrentPeriod = () => getColombiaDate().substring(0, 7); // YYYY-MM

// ─── Formatters ───
const formatCOP = (val) => {
  if (!val) return '$0';
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
};
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Expandable trend panel for one client: daily/weekly trend table (configurable
 * range, persisted in localStorage), last 4 months cards and the monthly growth
 * chart. Self-contained: loads its own data.
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
  const [selection, setSelection] = useState(loadTrendView);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [daily, setDaily] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [monthly, setMonthly] = useState([]);

  const { view } = selection;

  const changeSelection = (next) => {
    setSelection(next);
    saveTrendView(next);
  };

  // Trend table: one request for exactly the selected range (days or whole weeks)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTrend(true);
      try {
        const { start, end } = trendDateRange(selection);
        const res = await clientMetricsAPI.getDailyMetrics(clientId, start, end);
        if (!cancelled) setDaily(res.data || []);
      } catch (error) {
        console.error('Error loading client trend table:', error);
        if (!cancelled) setDaily([]);
      } finally {
        if (!cancelled) setLoadingTrend(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [clientId, revenueMetric, refreshKey, selection]);

  // Monthly cards + growth chart: last 4 months
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingMonthly(true);
      try {
        const todayStr = getColombiaDate();
        const today = new Date(todayStr + 'T12:00:00');
        const monthlyStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        const monthlyStartStr = monthlyStart.toISOString().split('T')[0];

        const monthlyRes = await clientMetricsAPI.getDailyMetrics(clientId, monthlyStartStr, todayStr);
        if (cancelled) return;

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
        if (!cancelled) setMonthly([]);
      } finally {
        if (!cancelled) setLoadingMonthly(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [clientId, revenueMetric, refreshKey]);

  const currentPeriod = getCurrentPeriod();
  const label = revenueLabel || revenueMetricLabel(revenueMetric);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Trend table: days or weeks, configurable range */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2 mr-auto">
          <span className="text-xs font-medium text-gray-600">{trendTitle(selection)}</span>
          <span className="text-[10px] text-gray-400">{label}</span>
        </div>
        <TrendViewControls selection={selection} onChange={changeSelection} />
      </div>
      {loadingTrend ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : daily.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm">{trendEmptyText(selection)}</div>
      ) : view === 'weeks' ? (
        <WeeklyTrendTable rows={daily} revenueMetric={revenueMetric} selection={selection} />
      ) : (
        <DailyTrendTable rows={daily} revenueMetric={revenueMetric} />
      )}

      {/* Monthly breakdown - last 4 months */}
      {!loadingMonthly && monthly.length > 0 && (
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
