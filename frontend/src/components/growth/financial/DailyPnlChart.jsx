import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import Info from './Info';
import { fmtMoney, fmtMoneyShort, dayShort, dayLong, COLORS } from './format';

const TICK = { fontSize: 11, fill: '#9CA3AF' };

const Row = ({ label, value, color, strong }) => (
  <div className="flex justify-between gap-4">
    <span className="text-gray-300 inline-flex items-center gap-1.5">
      {color && <span className="w-2 h-2 rounded-[2px]" style={{ background: color }} />}{label}
    </span>
    <span className={`tabular-nums ${strong ? 'font-semibold' : ''}`} style={strong ? { color: value >= 0 ? '#86EFAC' : '#FCA5A5' } : undefined}>{fmtMoney(value)}</span>
  </div>
);

const DarkTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#17181A] text-white rounded-lg shadow-xl px-3 py-2.5 text-xs min-w-[220px] space-y-1">
      <div className="font-medium capitalize mb-1.5">{dayLong(d.date)}{d.orders ? ` · ${d.orders} pedidos` : ''}</div>
      <Row label="Ventas netas" value={d.revenue} color={COLORS.revenue} />
      <Row label="Costos" value={d.costs} color={COLORS.costs} />
      <div className="pl-3.5 space-y-0.5 text-[11px]">
        <Row label="Producto" value={d.cogs} />
        <Row label="Ads" value={d.ad_spend} />
        <Row label="Variables" value={d.variable_costs} />
        <Row label="Fijos (día)" value={d.fixed_costs} />
      </div>
      <div className="pt-1.5 mt-1 border-t border-white/10"><Row label="Utilidad" value={d.profit} color={COLORS.profit} strong /></div>
    </div>
  );
};

/** Barras de ventas y costos totales + línea de utilidad por día. Un solo eje, todo en pesos. */
export default function DailyPnlChart({ daily = [], height = 260 }) {
  const data = useMemo(() => daily.map((d) => ({
    ...d,
    label: dayShort(d.date),
    costs: (d.cogs || 0) + (d.ad_spend || 0) + (d.variable_costs || 0) + (d.fixed_costs || 0),
    profit: d.net_profit || 0,
  })), [daily]);
  const dense = data.length > 16;
  const hasData = data.some((d) => d.revenue || d.costs);

  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-1.5">
        <h2 className="font-semibold text-sm text-[#17181A]">Ventas, costos y utilidad por día</h2>
        <Info text="Barras: ventas netas y costos totales del día (producto + ads + variables + la parte diaria de los fijos). Línea: utilidad del día." />
      </div>
      <p className="text-xs text-gray-400 mt-0.5">Un día en rojo es un día que costó más de lo que vendió.</p>
      {!hasData ? (
        <p className="text-sm text-gray-400 py-12 text-center">Sin datos en este mes.</p>
      ) : (
        <>
          <div className="mt-4 -ml-2">
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={dense ? '24%' : '32%'} barGap={2}>
                <CartesianGrid vertical={false} stroke="#F0F1F3" />
                <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={dense ? 'preserveStartEnd' : 0} minTickGap={24} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtMoneyShort} width={56} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(23,24,26,0.04)' }} />
                <ReferenceLine y={0} stroke="#D1D5DB" />
                <Bar dataKey="revenue" fill={COLORS.revenue} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar dataKey="costs" fill={COLORS.costs} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke={COLORS.profit}
                  strokeWidth={2}
                  dot={dense ? false : { r: 3.5, fill: '#fff', stroke: COLORS.profit, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#fff', stroke: COLORS.profit, strokeWidth: 3 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: COLORS.revenue }} />Ventas netas</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: COLORS.costs }} />Costos totales</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[2px] rounded-full" style={{ background: COLORS.profit }} />Utilidad</span>
          </div>
        </>
      )}
    </div>
  );
}
