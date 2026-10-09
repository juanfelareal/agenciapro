import React from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import Info from './Info';
import { DeltaPill } from './StatCard';
import { fmtMoney, fmtPct, relDelta, monthShort, prevPeriod } from './format';

/**
 * Utilidad neta del mes en grande + margen, proyección a fin de mes y punto de equilibrio en una frase.
 * `prev` = totales de los mismos días del mes anterior (para el delta).
 */
export default function ProfitHero({ data, prev }) {
  const t = data.totals;
  const profit = t.net_profit || 0;
  const positive = profit >= 0;
  const be = data.break_even || {};
  const proj = data.projection || {};
  const delta = prev ? relDelta(profit, prev.net_profit) : null;
  const isCurrent = data.is_current_month;
  const prevLabel = monthShort(prevPeriod(data.period));
  const costsTotal = (t.cogs || 0) + (t.ad_spend || 0) + (t.variable_costs || 0) + (t.fixed_costs || 0);

  const beSentence = (() => {
    if (!t.revenue) return 'Cuando haya ventas te decimos cuánto necesitas vender al día para no perder.';
    if (!be.reachable) return 'Con el costo de producto y los costos variables actuales no hay punto de equilibrio: cada venta deja menos de lo que cuesta. Revisa precios o costos.';
    const need = fmtMoney(be.revenue_per_day);
    const now = fmtMoney(be.current_revenue_per_day);
    if (be.gap_per_day <= 0) return `Necesitas vender ${need} por día para no perder (con tu ritmo actual de ads); ${isCurrent ? 'hoy vas' : 'el mes fue'} en ${now}/día. Vas por encima.`;
    return `Necesitas vender ${need} por día para no perder (con tu ritmo actual de ads); ${isCurrent ? 'hoy vas' : 'el mes fue'} en ${now}/día. Faltan ${fmtMoney(be.gap_per_day)} por día.`;
  })();

  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
            {positive ? 'Utilidad neta del mes' : 'Pérdida neta del mes'}
            <Info text="Ventas netas menos costo de producto, inversión en ads, costos variables y la parte del mes de tus costos fijos." />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
            <span className={`text-[40px] sm:text-[52px] font-bold tracking-tight leading-none tabular-nums ${positive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
              {fmtMoney(profit)}
            </span>
            <DeltaPill delta={delta} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[13px] text-gray-500">
            <span>
              Margen <strong className={`tabular-nums ${positive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{fmtPct(t.margin, 1)}</strong>
              <Info text="Utilidad neta dividida por ventas netas: de cada $100 vendidos, cuánto queda." className="ml-1" />
            </span>
            {prev && (
              <span>
                {prevLabel} (mismos días): <strong className="text-[#17181A] tabular-nums">{fmtMoney(prev.net_profit)}</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
            <div>
              <div className="text-[11px] text-gray-400">Ventas netas</div>
              <div className="text-sm sm:text-base font-semibold text-[#17181A] tabular-nums mt-0.5">{fmtMoney(t.revenue)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-400">Costos totales</div>
              <div className="text-sm sm:text-base font-semibold text-[#17181A] tabular-nums mt-0.5">{fmtMoney(costsTotal)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">Proyección fin de mes <Info text="Si el mes sigue al ritmo promedio de los días transcurridos (ventas y costos por día), así cerraría la utilidad." /></div>
              <div className={`text-sm sm:text-base font-semibold tabular-nums mt-0.5 ${proj.net_profit_eom >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                {isCurrent ? fmtMoney(proj.net_profit_eom) : 'Mes cerrado'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#17181A] text-white p-5 flex flex-col">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-gray-300">
            <Target className="w-3.5 h-3.5 text-[#D7F653]" />
            Punto de equilibrio
            <Info text="Lo mínimo que debes vender al día para cubrir producto, variables, ads (a tu ritmo actual) y la parte diaria de los fijos." />
          </div>
          {be.reachable && t.revenue ? (
            <div className="mt-3 flex items-end gap-6">
              <div>
                <div className="text-[11px] text-gray-400">Necesitas / día</div>
                <div className="text-2xl font-bold tabular-nums text-white">{fmtMoney(be.revenue_per_day)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">{isCurrent ? 'Vas en / día' : 'Vendiste / día'}</div>
                <div className={`text-2xl font-bold tabular-nums ${be.gap_per_day <= 0 ? 'text-[#D7F653]' : 'text-[#FCA5A5]'}`}>{fmtMoney(be.current_revenue_per_day)}</div>
              </div>
            </div>
          ) : null}
          <p className="text-[13px] leading-relaxed text-gray-300 mt-3 flex items-start gap-2">
            {be.reachable && t.revenue ? (be.gap_per_day <= 0 ? <TrendingUp className="w-4 h-4 mt-0.5 text-[#D7F653] shrink-0" /> : <TrendingDown className="w-4 h-4 mt-0.5 text-[#FCA5A5] shrink-0" />) : null}
            <span>{beSentence}</span>
          </p>
          {be.reachable && t.revenue ? (
            <p className="text-[11px] text-gray-500 mt-auto pt-3">
              Sin contar ads, el punto de equilibrio sería {fmtMoney(be.revenue_per_day_without_ads)}/día. Margen de contribución {fmtPct(be.contribution_ratio, 0)}.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
