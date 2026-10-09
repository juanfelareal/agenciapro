import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import Info from './Info';
import { fmtMoney, fmtMoneyShort, dayShort, dayLong, COLORS } from './format';

const TICK = { fontSize: 11, fill: '#9CA3AF' };

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const DarkTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const projected = d.profit === null || d.profit === undefined;
  const v = projected ? d.projected : d.profit;
  return (
    <div className="bg-[#17181A] text-white rounded-lg shadow-xl px-3 py-2.5 text-xs min-w-[210px] max-w-[80vw] space-y-1">
      <div className="font-medium capitalize mb-1.5">{dayLong(d.date)}{projected ? ' · proyección' : ''}</div>
      <div className="flex justify-between gap-4"><span className="text-gray-300">Utilidad acumulada</span><span className="tabular-nums font-semibold" style={{ color: v >= 0 ? '#86EFAC' : '#FCA5A5' }}>{fmtMoney(v)}</span></div>
      {!projected && (
        <>
          <div className="flex justify-between gap-4"><span className="text-gray-300">Ventas acumuladas</span><span className="tabular-nums">{fmtMoney(d.revenue)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-300">Costos acumulados</span><span className="tabular-nums">{fmtMoney(d.costs)}</span></div>
        </>
      )}
    </div>
  );
};

/**
 * Utilidad acumulada del mes (área verde sobre cero / roja bajo cero) con la línea del punto de
 * equilibrio (utilidad = 0) y, en el mes en curso, la proyección punteada hasta fin de mes.
 */
export default function CumulativeProfitChart({ data, height = 260 }) {
  const series = useMemo(() => {
    const cum = data?.cumulative || [];
    const rows = cum.map((c) => ({
      date: c.date,
      label: dayShort(c.date),
      profit: c.net_profit,
      projected: null,
      revenue: c.revenue,
      costs: (c.cogs || 0) + (c.ad_spend || 0) + (c.variable_costs || 0) + (c.fixed_costs || 0),
    }));
    if (data?.is_current_month && rows.length && data.projection?.days_remaining > 0) {
      const last = rows[rows.length - 1];
      last.projected = last.profit;
      const perDay = data.projection.net_profit_per_day || 0;
      for (let i = 1; i <= data.projection.days_remaining; i++) {
        const date = addDays(last.date, i);
        rows.push({ date, label: dayShort(date), profit: null, projected: Math.round(last.profit + perDay * i), revenue: null, costs: null });
      }
    }
    return rows;
  }, [data]);

  const hasData = series.some((r) => r.profit);
  const last = data?.cumulative?.[data.cumulative.length - 1];
  const dense = series.length > 16;
  const gradientId = 'cumProfitGradient';

  // Offset del gradiente para pintar verde arriba de cero y rojo debajo
  const values = series.flatMap((r) => [r.profit, r.projected]).filter((v) => v !== null && v !== undefined);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const off = max === min ? 0.5 : max / (max - min);

  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-1.5">
        <h2 className="font-semibold text-sm text-[#17181A]">Utilidad acumulada del mes</h2>
        <Info text="Suma de la utilidad día a día. La línea gris es el punto de equilibrio: arriba de ella el mes ya es rentable. La parte punteada es la proyección al ritmo actual." />
      </div>
      <p className="text-xs text-gray-400 mt-0.5">
        {last ? <>Hoy acumula <strong className={`tabular-nums ${last.net_profit >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{fmtMoney(last.net_profit)}</strong>{data.is_current_month && data.projection ? <> · proyección a fin de mes <strong className="text-[#17181A] tabular-nums">{fmtMoney(data.projection.net_profit_eom)}</strong></> : null}</> : 'Sin datos'}
      </p>
      {!hasData ? (
        <p className="text-sm text-gray-400 py-12 text-center">Sin datos en este mes.</p>
      ) : (
        <>
          <div className="mt-4 -ml-2">
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={off} stopColor={COLORS.profit} stopOpacity={0.18} />
                    <stop offset={off} stopColor={COLORS.loss} stopOpacity={0.14} />
                  </linearGradient>
                  <linearGradient id={`${gradientId}Stroke`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={off} stopColor={COLORS.profit} />
                    <stop offset={off} stopColor={COLORS.loss} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#F0F1F3" />
                <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={dense ? 'preserveStartEnd' : 0} minTickGap={24} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtMoneyShort} width={56} />
                <Tooltip content={<DarkTooltip />} cursor={{ stroke: '#D1D5DB' }} />
                <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="4 3" label={{ value: 'Punto de equilibrio', position: 'insideTopLeft', fontSize: 10, fill: '#6B7280' }} />
                <Area type="monotone" dataKey="profit" stroke={`url(#${gradientId}Stroke)`} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 5, fill: '#fff', stroke: COLORS.profit, strokeWidth: 3 }} isAnimationActive={false} connectNulls={false} />
                <Line type="monotone" dataKey="projected" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, fill: '#fff', stroke: '#9CA3AF', strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[2px] rounded-full" style={{ background: COLORS.profit }} />Utilidad acumulada</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-dashed border-gray-400" />Proyección</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0 border-t border-dashed border-gray-500" />Punto de equilibrio</span>
          </div>
        </>
      )}
    </div>
  );
}
