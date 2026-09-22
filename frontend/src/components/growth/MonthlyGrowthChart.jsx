import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const fmtCOP = (v) => {
  if (!v) return '$0';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
};
const fmtCOPFull = (v) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(v || 0);
const fmtPct = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`;

// Sales bars: one hue. The month in progress is lighter because it is incomplete.
const BAR = '#16a34a';
const BAR_CURRENT = '#86efac';
const LINE = '#17181A';

/**
 * Builds the monthly series: revenue, ROAS and month-over-month growth.
 * `months` = [{ month: 'YYYY-MM', revenue, orders, spend }] sorted ascending.
 */
const buildSeries = (months, currentPeriod) =>
  months.map((m, i) => {
    const prev = i > 0 ? months[i - 1] : null;
    const [y, mm] = m.month.split('-');
    return {
      key: m.month,
      label: `${MONTHS[parseInt(mm, 10) - 1]} ${String(y).slice(2)}`,
      fullLabel: `${MONTHS[parseInt(mm, 10) - 1]} ${y}`,
      revenue: m.revenue || 0,
      spend: m.spend || 0,
      orders: m.orders || 0,
      roas: m.spend > 0 ? m.revenue / m.spend : 0,
      growth: prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue) * 100 : null,
      isCurrent: m.month === currentPeriod,
    };
  });

const GrowthLabel = ({ x, y, width, value }) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const color = value > 0 ? '#16a34a' : value < 0 ? '#dc2626' : '#6b7280';
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={color}>
      {fmtPct(value)}
    </text>
  );
};

const RoasLabel = ({ x, y, value }) => {
  if (!value) return null;
  return (
    <text x={x} y={y - 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="#374151">
      {`${value.toFixed(1)}×`}
    </text>
  );
};

const TooltipBox = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-medium text-gray-900 mb-1">
        {d.fullLabel}{d.isCurrent ? ' · En curso' : ''}
      </div>
      <div className="text-gray-600">Ventas: <span className="font-medium text-gray-900">{fmtCOPFull(d.revenue)}</span></div>
      <div className="text-gray-600">Inversión: <span className="font-medium text-gray-900">{fmtCOPFull(d.spend)}</span></div>
      <div className="text-gray-600">ROAS: <span className="font-medium text-gray-900">{d.roas > 0 ? `${d.roas.toFixed(2)}×` : '—'}</span></div>
      <div className="text-gray-600">Pedidos: <span className="font-medium text-gray-900">{d.orders}</span></div>
      {d.growth !== null && (
        <div className="text-gray-600 mt-1 pt-1 border-t border-gray-100">
          vs mes anterior: <span className={`font-medium ${d.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(d.growth)}</span>
        </div>
      )}
    </div>
  );
};

const axisTick = { fontSize: 11, fill: '#9CA3AF' };

/**
 * Growth chart for a client's last months: sales (bars + MoM growth) and ROAS (line).
 * Two single-series charts side by side; never a dual axis.
 */
export default function MonthlyGrowthChart({ months = [], currentPeriod }) {
  if (months.length < 2) return null;
  const data = buildSeries(months, currentPeriod);

  // Headline: latest month vs the one before it
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const headline = last.growth;
  const HeadIcon = headline === null ? Minus : headline > 0 ? TrendingUp : headline < 0 ? TrendingDown : Minus;
  const headColor = headline === null ? 'text-gray-400' : headline > 0 ? 'text-green-600' : headline < 0 ? 'text-red-600' : 'text-gray-500';

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-600">Crecimiento</span>
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${headColor}`}>
          <HeadIcon className="w-3.5 h-3.5" />
          {headline === null
            ? `${last.label} sin comparación`
            : `${last.label} vs ${prev.label}: ${fmtPct(headline)}`}
          {last.isCurrent && <span className="text-[10px] font-normal text-gray-400 ml-1">(mes en curso)</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Sales per month */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[11px] font-medium text-gray-500 mb-1">Ventas por mes · variación vs mes anterior</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={fmtCOP} width={48} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {data.map((d) => (
                  <Cell key={d.key} fill={d.isCurrent ? BAR_CURRENT : BAR} />
                ))}
                <LabelList dataKey="growth" content={<GrowthLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ROAS per month */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[11px] font-medium text-gray-500 mb-1">ROAS por mes</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}×`} width={44} domain={[0, 'auto']} />
              <Tooltip content={<TooltipBox />} cursor={{ stroke: '#d1d5db' }} />
              <Line
                type="monotone"
                dataKey="roas"
                stroke={LINE}
                strokeWidth={2}
                dot={{ r: 4, fill: '#fff', stroke: LINE, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: LINE, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              >
                <LabelList dataKey="roas" content={<RoasLabel />} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
