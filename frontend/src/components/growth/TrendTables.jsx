import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { pickDailyDisplayRevenue, pickDailyDisplayRoas, dailyAdSpend } from '../../utils/revenueMetric';
import {
  DAY_RANGES,
  WEEK_RANGES,
  formatCOPFull,
  formatShortDate,
  formatWeekday,
  formatWeekLabel,
  groupByWeek,
  roasColor,
  summarizeDays,
} from './trendRange';

const TH = 'px-4 py-2 font-medium whitespace-nowrap';
const TD = 'px-4 py-2 whitespace-nowrap';

/**
 * Segmented control (Días | Semanas) + range buttons for the active view.
 * `selection` = { view, days, weeks }; onChange receives the new selection.
 */
export function TrendViewControls({ selection, onChange }) {
  const isWeeks = selection.view === 'weeks';
  const ranges = isWeeks ? WEEK_RANGES : DAY_RANGES;
  const current = isWeeks ? selection.weeks : selection.days;
  const setRange = (n) => onChange({ ...selection, [isWeeks ? 'weeks' : 'days']: n });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div role="tablist" aria-label="Vista" className="inline-flex rounded-md bg-gray-200/70 p-0.5">
        {[['days', 'Días'], ['weeks', 'Semanas']].map(([value, text]) => {
          const active = selection.view === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ ...selection, view: value })}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {text}
            </button>
          );
        })}
      </div>
      <div className="inline-flex items-center gap-0.5" aria-label="Rango">
        {ranges.map((n) => {
          const active = n === current;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => setRange(n)}
              className={`px-2 py-0.5 text-[11px] rounded tabular-nums transition-colors ${
                active ? 'bg-gray-800 text-white font-medium' : 'text-gray-500 hover:bg-gray-200/70 hover:text-gray-700'
              }`}
            >
              {n}
            </button>
          );
        })}
        <span className="ml-1 text-[10px] text-gray-400">{isWeeks ? 'sem.' : 'días'}</span>
      </div>
    </div>
  );
}

/** Daily table: most recent day on top, totals/average row at the bottom. */
export function DailyTrendTable({ rows, revenueMetric }) {
  const sorted = [...rows].sort((a, b) => b.metric_date.localeCompare(a.metric_date));
  const total = summarizeDays(rows, revenueMetric);
  const totalRoas = total.spend > 0 ? total.revenue / total.spend : 0;
  const avgRevenue = total.days > 0 ? total.revenue / total.days : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className={`${TH} text-left`}>Fecha</th>
            <th className={`${TH} text-left`}>Día</th>
            <th className={`${TH} text-right`}>Ventas</th>
            <th className={`${TH} text-right`}>Inversión</th>
            <th className={`${TH} text-right`}>Pedidos</th>
            <th className={`${TH} text-right`}>ROAS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((day) => {
            const revenue = pickDailyDisplayRevenue(revenueMetric, day);
            const spend = dailyAdSpend(day);
            const roas = pickDailyDisplayRoas(revenueMetric, day);
            return (
              <tr key={day.metric_date} className="hover:bg-gray-50">
                <td className={`${TD} text-gray-600`}>{formatShortDate(day.metric_date)}</td>
                <td className={`${TD} text-gray-400 capitalize`}>{formatWeekday(day.metric_date)}</td>
                <td className={`${TD} text-right font-medium text-gray-900`}>{formatCOPFull(revenue)}</td>
                <td className={`${TD} text-right text-gray-600`}>{formatCOPFull(spend)}</td>
                <td className={`${TD} text-right text-gray-600`}>{day.shopify_orders || 0}</td>
                <td className={`${TD} text-right`}>
                  <span className={`font-medium ${roasColor(roas)}`}>{roas.toFixed(2)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50/70 text-xs">
            <td className={`${TD} text-gray-700 font-medium`} colSpan={2}>
              Total
              <span className="ml-2 font-normal text-gray-400">prom. {formatCOPFull(avgRevenue)}/día</span>
            </td>
            <td className={`${TD} text-right font-semibold text-gray-900`}>{formatCOPFull(total.revenue)}</td>
            <td className={`${TD} text-right font-medium text-gray-700`}>{formatCOPFull(total.spend)}</td>
            <td className={`${TD} text-right font-medium text-gray-700`}>{total.orders}</td>
            <td className={`${TD} text-right`}>
              <span className={`font-semibold ${roasColor(totalRoas)}`}>{totalRoas.toFixed(2)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ChangePill({ pct }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return <span className="text-gray-300">—</span>;
  }
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
        up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      }`}
    >
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}{pct.toFixed(0)}%
    </span>
  );
}

/** Weekly table (Mon–Sun): most recent week on top, totals row at the bottom. */
export function WeeklyTrendTable({ rows, revenueMetric, selection }) {
  const weeks = groupByWeek(rows, revenueMetric, selection);
  const total = weeks.reduce(
    (acc, w) => ({ revenue: acc.revenue + w.revenue, spend: acc.spend + w.spend, orders: acc.orders + w.orders }),
    { revenue: 0, spend: 0, orders: 0 }
  );
  const totalRoas = total.spend > 0 ? total.revenue / total.spend : 0;
  const totalTicket = total.orders > 0 ? total.revenue / total.orders : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className={`${TH} text-left`}>Semana</th>
            <th className={`${TH} text-right`}>Ventas</th>
            <th className={`${TH} text-right`}>Inversión</th>
            <th className={`${TH} text-right`}>Pedidos</th>
            <th className={`${TH} text-right`}>Ticket prom.</th>
            <th className={`${TH} text-right`}>ROAS</th>
            <th className={`${TH} text-right`}>vs sem. anterior</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {weeks.map((w) => (
            <tr key={w.start} className="hover:bg-gray-50">
              <td className={`${TD} text-gray-600`}>
                <span>{formatWeekLabel(w.start, w.end)}</span>
                {w.isCurrent && (
                  <span className="ml-2 text-[10px] text-emerald-600 font-medium">
                    En curso · {w.daysElapsed} {w.daysElapsed === 1 ? 'día' : 'días'}
                  </span>
                )}
              </td>
              <td className={`${TD} text-right font-medium text-gray-900`}>{formatCOPFull(w.revenue)}</td>
              <td className={`${TD} text-right text-gray-600`}>{formatCOPFull(w.spend)}</td>
              <td className={`${TD} text-right text-gray-600`}>{w.orders}</td>
              <td className={`${TD} text-right text-gray-600`}>{w.orders > 0 ? formatCOPFull(w.avgTicket) : '—'}</td>
              <td className={`${TD} text-right`}>
                <span className={`font-medium ${roasColor(w.roas)}`}>{w.roas.toFixed(2)}</span>
              </td>
              <td className={`${TD} text-right`}>
                <ChangePill pct={w.changePct} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50/70 text-xs">
            <td className={`${TD} text-gray-700 font-medium`}>
              Total
              <span className="ml-2 font-normal text-gray-400">{weeks.length} {weeks.length === 1 ? 'semana' : 'semanas'}</span>
            </td>
            <td className={`${TD} text-right font-semibold text-gray-900`}>{formatCOPFull(total.revenue)}</td>
            <td className={`${TD} text-right font-medium text-gray-700`}>{formatCOPFull(total.spend)}</td>
            <td className={`${TD} text-right font-medium text-gray-700`}>{total.orders}</td>
            <td className={`${TD} text-right font-medium text-gray-700`}>{total.orders > 0 ? formatCOPFull(totalTicket) : '—'}</td>
            <td className={`${TD} text-right`}>
              <span className={`font-semibold ${roasColor(totalRoas)}`}>{totalRoas.toFixed(2)}</span>
            </td>
            <td className={TD} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
