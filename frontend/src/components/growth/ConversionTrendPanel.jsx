import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { Loader2, AlertTriangle, Mail, Globe } from 'lucide-react';
import { growthAPI } from '../../utils/api';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const GREEN = '#16a34a';
const GREEN_LIGHT = '#86efac';

const fmtPct = (v) => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${Number(v).toFixed(1)}%`);
const fmtInt = (v) => new Intl.NumberFormat('es-CO').format(v || 0);
const fmtDelta = (v) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)} pp`);

const monthShort = (key) => {
  const [y, m] = key.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${String(y).slice(2)}`;
};
const monthLong = (key) => {
  const [y, m] = key.split('-');
  return `${MONTHS_FULL[parseInt(m, 10) - 1]} ${y}`;
};
const dayShort = (iso) => {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`;
};
const prevMonthKey = (key) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().substring(0, 7);
};

const DarkTooltip = ({ title, rows }) => (
  <div className="bg-[#17181A] text-white rounded-lg shadow-lg px-3 py-2 text-xs">
    <div className="font-medium mb-1">{title}</div>
    {rows.map(([label, value]) => (
      <div key={label} className="text-gray-300">
        {label}: <span className="font-medium text-white">{value}</span>
      </div>
    ))}
  </div>
);

const WeekTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <DarkTooltip
      title={`Semana ${dayShort(d.week_start)} – ${dayShort(d.week_end)}${d.days < 7 ? ` · ${d.days} ${d.days === 1 ? 'día' : 'días'}` : ''}`}
      rows={[
        ['Conversión', fmtPct(d.conversion_rate)],
        ['Sesiones', fmtInt(d.sessions)],
        ['Pedidos', fmtInt(d.orders)],
      ]}
    />
  );
};

const EmailTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <DarkTooltip
      title={monthLong(d.month)}
      rows={d.email_has_data
        ? [
          ['Conversión email', fmtPct(d.email_conversion_rate)],
          ['Entregas', fmtInt(d.email_deliveries)],
          ['Conversiones', fmtInt(d.email_conversions)],
        ]
        : [['Conversión email', 'Sin métricas registradas']]}
    />
  );
};

function MiniStat({ label, value, delta, deltaSuffix }) {
  const deltaColor = delta === null || delta === undefined ? 'text-gray-400' : delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500';
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">{label}</p>
      <p className="text-lg font-bold text-[#17181A] mt-0.5">{value}</p>
      {delta !== undefined && (
        <p className={`text-[11px] font-medium ${deltaColor}`}>{fmtDelta(delta)}{deltaSuffix ? ` ${deltaSuffix}` : ''}</p>
      )}
    </div>
  );
}

function Notice({ icon, children, action }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 text-xs text-amber-800">
      {icon}
      <div>
        {children}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

/**
 * Tasa de conversión en el tiempo para un cliente de Growth.
 * - Conversión web por semana (lunes–domingo) desde sesiones/pedidos de Shopify.
 * - Conversión de email por mes desde métricas mensuales de email marketing.
 * `period` (YYYY-MM) es el mes seleccionado en el dashboard; el rango termina en ese mes.
 */
export default function ConversionTrendPanel({ clientId, period, months = 6 }) {
  // Una sola pieza de estado con la llave de la petición: loading = la llave actual aún no llegó
  const requestKey = `${clientId}|${period}|${months}`;
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    growthAPI.getConversion(clientId, { months, period })
      .then((res) => { if (!cancelled) setResult({ key: requestKey, data: res.data, error: null }); })
      .catch((e) => {
        if (!cancelled) setResult({ key: requestKey, data: null, error: e?.response?.data?.error || e.message || 'Error cargando conversión' });
      });
    return () => { cancelled = true; };
  }, [clientId, period, months, requestKey]);

  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;

  const stats = useMemo(() => {
    if (!data) return null;
    const byMonth = Object.fromEntries((data.months || []).map((m) => [m.month, m]));
    const curKey = data.period || period;
    const prevKey = prevMonthKey(curKey);
    const cur = byMonth[curKey];
    const prev = byMonth[prevKey];
    const delta = (a, b) => (a === null || a === undefined || b === null || b === undefined ? null : Math.round((a - b) * 10) / 10);
    return {
      curLabel: monthShort(curKey),
      prevLabel: monthShort(prevKey),
      web: {
        cur: cur?.conversion_rate ?? null,
        prev: prev?.conversion_rate ?? null,
        delta: delta(cur?.conversion_rate, prev?.conversion_rate),
      },
      email: {
        cur: cur?.email_conversion_rate ?? null,
        prev: prev?.email_conversion_rate ?? null,
        delta: delta(cur?.email_conversion_rate, prev?.email_conversion_rate),
      },
    };
  }, [data, period]);

  const weeks = useMemo(() => (data?.weeks || []).map((w) => ({ ...w, label: dayShort(w.week_start) })), [data]);
  const monthsSeries = useMemo(() => (data?.months || []).map((m) => ({
    ...m,
    label: monthShort(m.month),
    bar: m.email_conversion_rate ?? 0,
    isCurrent: m.month === (data?.period || period),
  })), [data, period]);

  const emailLink = `/app/clients/${clientId}/email-marketing`;

  return (
    <div className="glass-solid rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold text-sm text-[#17181A]">Tasa de conversión en el tiempo</p>
          <p className="text-xs text-gray-400 mt-0.5">Web (Shopify) y email · últimos {months} meses hasta {stats ? monthLong(data?.period || period).toLowerCase() : '…'}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <Notice icon={<AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}>No pudimos cargar la conversión: {error}</Notice>
      ) : (
        <div className="space-y-6">
          {/* Resumen del mes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label={`Web · ${stats.curLabel}`} value={fmtPct(stats.web.cur)} delta={stats.web.delta} deltaSuffix={`vs ${stats.prevLabel}`} />
            <MiniStat label={`Web · ${stats.prevLabel}`} value={fmtPct(stats.web.prev)} />
            <MiniStat label={`Email · ${stats.curLabel}`} value={fmtPct(stats.email.cur)} delta={stats.email.delta} deltaSuffix={`vs ${stats.prevLabel}`} />
            <MiniStat label={`Email · ${stats.prevLabel}`} value={fmtPct(stats.email.prev)} />
          </div>

          {/* Conversión web por semana */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Conversión web por semana</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {data.has_sessions ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeks} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} width={56} domain={[0, 'auto']} />
                    <Tooltip content={<WeekTooltip />} cursor={{ stroke: '#e5e7eb' }} />
                    <Line
                      type="monotone"
                      dataKey="conversion_rate"
                      stroke={GREEN}
                      strokeWidth={2}
                      dot={{ r: 3, fill: GREEN, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: GREEN, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Notice icon={<AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}>
                No tenemos sesiones de Shopify de esta tienda; la conversión web requiere el permiso <code className="font-mono">read_reports</code>/analytics.
              </Notice>
            )}
          </div>

          {/* Conversión de email por mes */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Conversión de email por mes</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {data.has_email ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthsSeries} margin={{ top: 10, right: 12, left: -10, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} width={56} domain={[0, 'auto']} />
                    <Tooltip content={<EmailTooltip />} cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="bar" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {monthsSeries.map((m) => (
                        <Cell key={m.month} fill={m.isCurrent ? GREEN_LIGHT : GREEN} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-gray-400 mt-1">Conversiones ÷ entregas (campañas + flows). Meses sin métricas aparecen en 0.</p>
              </div>
            ) : (
              <Notice
                icon={<Mail className="w-4 h-4 mt-0.5 shrink-0" />}
                action={<Link to={emailLink} className="font-medium underline text-amber-900">Registrar métricas de email</Link>}
              >
                Sin métricas de email registradas en los últimos {months} meses.
              </Notice>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
