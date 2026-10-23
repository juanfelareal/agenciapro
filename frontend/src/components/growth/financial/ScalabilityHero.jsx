import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';
import { ArrowRight, ArrowLeft, HelpCircle, Loader2, AlertTriangle, X } from 'lucide-react';
import { growthAPI } from '../../../utils/api';
import { fmtMoney, fmtX, fmtInt, dayShort, dayLong, monthLabel } from './format';

const TICK = { fontSize: 11, fill: '#7A7772' };
const INK = '#121212';
const GREEN = '#44BF47';
const GREEN_SOFT = 'rgba(68,191,71,0.22)';
const RED_SOFT = 'rgba(220,38,38,0.16)';
const GREY_DOT = '#C9C6C0';

const MONO = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };

const BENCH = {
  bueno: { label: 'Bueno', range: '1,2–1,5', cls: 'bg-[rgb(var(--accent-rgb)/0.15)] text-[var(--accent-deep)]' },
  decente: { label: 'Decente', range: '1,5–1,8', cls: 'bg-amber-100 text-amber-800' },
  alto: { label: 'Alto', range: '1,8+', cls: 'bg-red-100 text-red-700' },
};
const STATUS = {
  escalar: { label: 'Escalar', tone: 'text-[var(--accent-deep)]', chip: 'bg-[var(--accent)] text-white' },
  sostener: { label: 'Sostener', tone: 'text-amber-600', chip: 'bg-[#F59E0B] text-white' },
  frenar: { label: 'Frenar', tone: 'text-[#dc2626]', chip: 'bg-[#dc2626] text-white' },
};

const Label = ({ children, className = '' }) => (
  <div className={`text-[10px] uppercase tracking-[0.14em] text-gray-500 ${className}`} style={MONO}>{children}</div>
);

const Row = ({ label, value, color, strong }) => (
  <div className="flex justify-between gap-4">
    <span className="text-gray-300 inline-flex items-center gap-1.5">
      {color && <span className="w-2 h-2 rounded-[2px]" style={{ background: color }} />}{label}
    </span>
    <span className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</span>
  </div>
);

const DarkTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const above = d.blended_7d !== null && d.ber !== null ? d.blended_7d >= d.ber : null;
  return (
    <div className="bg-[var(--dark)] text-white rounded-lg shadow-xl px-3 py-2.5 text-xs min-w-[230px] max-w-[80vw] space-y-1">
      <div className="font-medium capitalize mb-1.5">{dayLong(d.date)}{d.orders ? ` · ${fmtInt(d.orders)} pedidos` : ''}</div>
      <Row label="BER (90 días)" value={fmtX(d.ber, 2)} color={INK} />
      <Row label="Blended 7 días" value={fmtX(d.blended_7d, 2)} color={GREEN} strong />
      <Row label="Blended del día" value={fmtX(d.blended_day, 2)} color={GREY_DOT} />
      <div className="pt-1.5 mt-1 border-t border-white/10 space-y-0.5 text-[11px]">
        <Row label="Facturación" value={fmtMoney(d.revenue_total)} />
        <Row label="Ads" value={fmtMoney(d.ad_spend)} />
      </div>
      {above !== null && (
        <div className={`pt-1 text-[11px] font-medium ${above ? 'text-[#86EFAC]' : 'text-[#FCA5A5]'}`}>
          {above ? `+${fmtX(d.blended_7d - d.ber, 2)} sobre el BER` : `${fmtX(d.blended_7d - d.ber, 2)} bajo el BER`}
        </div>
      )}
    </div>
  );
};

function MethodPopover({ method, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div ref={ref} role="dialog" className="fixed inset-x-4 top-24 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 z-40 sm:w-[400px] max-h-[70vh] overflow-y-auto bg-[var(--dark)] text-white rounded-xl shadow-2xl p-4 text-[12px] leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <Label className="!text-gray-400">Cómo se calcula</Label>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
      <p className="mt-2"><strong className="text-[var(--accent)]">BER · Break even ROAS:</strong> el ROAS mínimo para no perder dinero en cada venta.</p>
      <ul className="mt-2 space-y-1.5 text-gray-200">
        <li><span className="text-gray-400">Ticket promedio</span> — lo sacas de Shopify: {method?.ticket}.</li>
        <li><span className="text-gray-400">Costo promedio por pedido</span> — {method?.cost_per_order}. Mercancía últimos 90 días + logística últimos 90 días, dividido por el número de ventas de los últimos 90 días.</li>
        <li><span className="text-gray-400">BER</span> — <span className="tabular-nums" style={MONO}>{method?.ber}</span>. No consideres otros factores.</li>
        <li><span className="text-gray-400">Blended ROAS</span> — {method?.blended} (todas las plataformas).</li>
        <li><span className="text-gray-400">Escalabilidad</span> — la distancia entre tu BER y tu Blended ROAS.</li>
      </ul>
      <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-gray-300">
        BER <strong className="text-white">bueno 1,2–1,5</strong> · decente 1,5–1,8 · alto 1,8+. Escalar cuando el Blended va 15 % o más por encima del BER.
      </div>
      <p className="mt-3 pt-3 border-t border-white/10 text-[11px] text-gray-200">
        <strong className="text-white">El IVA no es ingreso:</strong> de cada $119 facturados, $19 son de la DIAN. Por eso el BER y el Blended se calculan sin IVA por defecto; la opción "con IVA" reproduce la fórmula del curso para comparar.
      </p>
      {method?.basis && <div className="mt-2 text-[10px] text-gray-400" style={MONO}>Base actual: {method.basis}</div>}
      <div className="mt-2 text-[10px] text-gray-500" style={MONO}>Fuente: {method?.source}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Calculando el Break even ROAS…</div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100/70 animate-pulse" />)}
      </div>
      <div className="mt-4 h-56 rounded-xl bg-gray-100/50 animate-pulse" />
    </div>
  );
}

/**
 * Lo más importante del laboratorio: Break even ROAS (método Ramsés, 90 días) a un lado, Blended ROAS al otro,
 * y en el medio el espacio para escalar. Debajo, la línea de tiempo de los últimos 90 días.
 * Solo se muestra cuando el cliente tiene `lab_enabled`.
 */
export default function ScalabilityHero({ clientId, period, onGoTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('90');
  const [basis, setBasis] = useState('net'); // 'net' = sin IVA (por defecto) · 'gross' = con IVA, como en el curso
  const [showMethod, setShowMethod] = useState(false);
  const polls = useRef(0);

  useEffect(() => {
    let alive = true;
    polls.current = 0;
    setLoading(true); setError(null);
    const fetch = async (silent = false) => {
      try {
        const r = await growthAPI.getScalability(clientId, period, basis);
        if (!alive) return;
        setData(r.data);
        if (r.data?.cogs_refreshing && polls.current < 4) {
          polls.current += 1;
          setTimeout(() => alive && fetch(true), 6000);
        }
      } catch (err) {
        if (alive && !silent) setError(err?.response?.data?.error || err?.message || 'No pudimos calcular el BER.');
      } finally {
        if (alive && !silent) setLoading(false);
      }
    };
    fetch();
    return () => { alive = false; };
  }, [clientId, period, basis]);

  const chart = useMemo(() => {
    const rows = (data?.series || []).filter((p) => range === '90' || p.in_period);
    return rows.map((p) => {
      const has = p.ber !== null && p.blended_7d !== null;
      const base = has ? Math.min(p.ber, p.blended_7d) : null;
      return {
        ...p,
        base,
        gain: has && p.blended_7d > p.ber ? p.blended_7d - p.ber : has ? 0 : null,
        loss: has && p.blended_7d < p.ber ? p.ber - p.blended_7d : has ? 0 : null,
      };
    });
  }, [data, range]);

  const yDomain = useMemo(() => {
    const vals = chart.flatMap((p) => [p.ber, p.blended_7d, p.blended_day]).filter((v) => v !== null && v !== undefined && Number.isFinite(v));
    if (!vals.length) return [0, 4];
    const lo = Math.min(...vals); const hi = Math.max(...vals);
    const cap = Math.min(hi, Math.max(lo, 1) * 4); // puntos diarios extremos no aplastan la escala
    return [Math.max(0, Math.floor((lo - 0.3) * 2) / 2), Math.ceil((cap + 0.4) * 2) / 2];
  }, [chart]);

  if (loading && !data) return <Skeleton />;
  if (error && !data) {
    return (
      <div className="glass-solid rounded-2xl p-5 text-sm text-gray-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> {error}</div>
    );
  }
  if (!data) return null;

  const { ber, blended, gap, warnings = [], method } = data;
  const bench = BENCH[ber.benchmark] || null;
  const st = STATUS[gap.status] || null;
  const gapPositive = gap.value !== null && gap.value >= 0;
  const inPeriod = data.series.filter((p) => p.in_period);
  const shadeFrom = inPeriod[0]?.date; const shadeTo = inPeriod[inPeriod.length - 1]?.date;
  const periodName = monthLabel(data.period);
  const ticks = chart.length ? chart.filter((_, i) => i % Math.max(1, Math.round(chart.length / 6)) === 0).map((p) => p.date) : [];

  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <Label>Laboratorio · Escalabilidad</Label>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
        </div>
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 max-w-full">
          <div className="flex gap-0.5 bg-gray-100/80 rounded-lg p-0.5 text-[11px] font-medium" role="group" aria-label="Base de cálculo">
            {[['net', 'Sin IVA', 'Sin IVA'], ['gross', 'Con IVA (como en el curso)', 'Con IVA']].map(([k, label, short]) => (
              <button key={k} type="button" onClick={() => setBasis(k)} disabled={loading} className={`px-2.5 py-1 rounded-md transition whitespace-nowrap ${basis === k ? 'bg-[var(--dark)] text-[var(--accent)]' : 'text-gray-500 hover:text-[var(--ink)]'}`}>
                <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowMethod((o) => !o)} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-[var(--ink)] whitespace-nowrap">
            <HelpCircle className="w-3.5 h-3.5" /> ¿Cómo se calcula?
          </button>
          {showMethod && <MethodPopover method={method} onClose={() => setShowMethod(false)} />}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-5 md:gap-4 items-stretch">
        {/* Izquierda: BER */}
        <div className="min-w-0">
          <Label>BER · Break even ROAS</Label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5">
            <span className="text-[44px] sm:text-[56px] font-light tracking-tight leading-none tabular-nums text-[var(--ink)]">{fmtX(ber.value, 2)}</span>
            {bench && <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${bench.cls}`}>{bench.label} <span className="font-normal opacity-80">· {bench.range}</span></span>}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-gray-500" style={MONO}>{data.basis_label}</div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
            {ber.orders_90d > 0 ? (
              <>
                ticket <strong className="text-[var(--ink)] tabular-nums font-semibold">{fmtMoney(ber.ticket)}</strong> · costo por pedido <strong className="text-[var(--ink)] tabular-nums font-semibold">{fmtMoney(ber.cost_per_order)}</strong>
                <br />
                <span className="text-gray-400">(mercancía {fmtMoney(ber.merchandise_90d)} + logística {fmtMoney(ber.logistics_90d)} ÷ {fmtInt(ber.orders_90d)} pedidos, 90 días)</span>
              </>
            ) : 'Sin pedidos en los últimos 90 días.'}
          </p>
        </div>

        {/* Centro: espacio para escalar */}
        <div className="min-w-0 flex flex-col justify-center rounded-xl border border-dashed border-gray-200 px-4 py-3 md:py-2">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-gray-500" style={MONO}>
            <span className="inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> BER</span>
            <span className="text-center leading-tight">espacio para escalar</span>
            <span className="inline-flex items-center gap-1">Blended <ArrowRight className="w-3 h-3" /></span>
          </div>
          <div className="relative mt-2 h-[2px] bg-gray-200 rounded-full">
            <div className={`absolute inset-y-0 left-0 rounded-full ${gapPositive ? 'bg-[var(--accent)]' : 'bg-[#dc2626]'}`} style={{ width: gap.pct !== null ? `${Math.min(100, Math.max(6, Math.abs(gap.pct) * 100))}%` : '0%' }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <span className={`text-[34px] sm:text-[40px] font-light tracking-tight leading-none tabular-nums ${gap.value === null ? 'text-gray-300' : gapPositive ? 'text-[var(--accent-deep)]' : 'text-[#dc2626]'}`}>
              {gap.value === null ? '—' : `${gapPositive ? '+' : '−'}${fmtX(Math.abs(gap.value), 2)}`}
            </span>
            {st ? <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${st.chip}`}>{st.label}</span> : <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">Sin dato</span>}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500 leading-snug">
            {gap.status === 'escalar' && <>El Blended va {fmtX(gap.value, 2)} por encima del BER ({gap.pct !== null ? `${Math.round(gap.pct * 100)} %` : ''}). Hay espacio: sube inversión mientras se mantenga sobre {fmtX(gap.scale_from, 2)}.</>}
            {gap.status === 'sostener' && <>Estás sobre el BER pero con menos del 15 % de colchón. Sostén la inversión; escalar empieza en {fmtX(gap.scale_from, 2)}.</>}
            {gap.status === 'frenar' && <>El Blended está {fmtX(Math.abs(gap.value), 2)} por debajo del BER: cada venta pierde plata. Frena la escala hasta pasar {fmtX(ber.value, 2)}.</>}
            {!gap.status && <>Cuando haya BER y pauta en el mes, aquí ves cuánto puedes escalar.</>}
          </p>
        </div>

        {/* Derecha: Blended */}
        <div className="min-w-0 md:text-right">
          <Label>Blended ROAS · {periodName}</Label>
          <div className="flex flex-wrap items-center md:justify-end gap-x-3 gap-y-1.5 mt-1.5">
            <span className={`text-[44px] sm:text-[56px] font-light tracking-tight leading-none tabular-nums ${blended.mtd === null ? 'text-gray-300' : gapPositive ? 'text-[var(--accent-deep)]' : 'text-[#dc2626]'}`}>{fmtX(blended.mtd, 2)}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            facturación <strong className="text-[var(--ink)] tabular-nums font-semibold">{fmtMoney(blended.revenue_total_mtd)}</strong> ÷ ads <strong className="text-[var(--ink)] tabular-nums font-semibold">{fmtMoney(blended.ad_spend_mtd)}</strong>
            <br />
            <span className="text-gray-400">últimos 7 días <span className="tabular-nums text-gray-500">{fmtX(blended.last7, 2)}</span> · últimos 30 días <span className="tabular-nums text-gray-500">{fmtX(blended.last30, 2)}</span></span>
          </p>
        </div>
      </div>

      {/* Avisos */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {warnings.map((w) => {
            const isLog = /log[ií]st/i.test(w);
            const isCogs = /mercanc[ií]a|producto/i.test(w) && !isLog;
            return (
              <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-3 py-1.5 max-w-full">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="leading-snug">{w}</span>
                {isLog && onGoTab && <button type="button" onClick={() => onGoTab('reservas')} className="underline underline-offset-2 font-semibold whitespace-nowrap">Ir a Reservas</button>}
                {isCogs && <a href="#productos" className="underline underline-offset-2 font-semibold whitespace-nowrap">Cargar costos</a>}
              </span>
            );
          })}
        </div>
      )}

      {/* Línea de tiempo */}
      <div className="mt-5 pt-5 border-t border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm text-[var(--ink)]">BER vs Blended ROAS, día a día</h3>
            <p className="text-xs text-gray-400 mt-0.5">Verde: el Blended (7 días) va por encima del BER, hay espacio para escalar. Rojo: va por debajo.</p>
          </div>
          <div className="flex gap-1 bg-gray-100/80 rounded-lg p-0.5 text-[11px] font-medium">
            {[['90', '90 días'], ['mes', 'Este mes']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setRange(k)} className={`px-2.5 py-1 rounded-md transition ${range === k ? 'bg-[var(--dark)] text-[var(--accent)]' : 'text-gray-500 hover:text-[var(--ink)]'}`}>{label}</button>
            ))}
          </div>
        </div>

        {chart.length === 0 || !chart.some((p) => p.ber !== null || p.blended_7d !== null) ? (
          <p className="text-sm text-gray-400 py-12 text-center">Todavía no hay datos suficientes para la línea de tiempo.</p>
        ) : (
          <>
            <div className="mt-4 -ml-2">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F0F1F3" />
                  <XAxis dataKey="date" tick={TICK} tickLine={false} axisLine={false} ticks={ticks} tickFormatter={dayShort} minTickGap={24} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} domain={yDomain} tickFormatter={(v) => fmtX(v, 1)} width={46} allowDataOverflow />
                  <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'rgba(23,24,26,0.15)' }} />
                  {range === '90' && shadeFrom && shadeTo && shadeFrom !== shadeTo && (
                    <ReferenceArea x1={shadeFrom} x2={shadeTo} fill="rgba(18,18,18,0.045)" stroke="none" ifOverflow="hidden" />
                  )}
                  {/* Área entre las dos líneas: base invisible + ganancia verde / pérdida roja apiladas */}
                  <Area type="linear" dataKey="base" stackId="gap" stroke="none" fill="transparent" isAnimationActive={false} connectNulls={false} activeDot={false} />
                  <Area type="linear" dataKey="gain" stackId="gap" stroke="none" fill={GREEN_SOFT} isAnimationActive={false} connectNulls={false} activeDot={false} />
                  <Area type="linear" dataKey="loss" stackId="gap" stroke="none" fill={RED_SOFT} isAnimationActive={false} connectNulls={false} activeDot={false} />
                  <Line type="linear" dataKey="blended_day" stroke="none" dot={{ r: 1.6, fill: GREY_DOT, stroke: 'none' }} activeDot={{ r: 3, fill: GREY_DOT, stroke: 'none' }} isAnimationActive={false} connectNulls={false} />
                  <Line type="linear" dataKey="ber" stroke={INK} strokeWidth={1.6} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, fill: '#fff', stroke: INK, strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
                  <Line type="linear" dataKey="blended_7d" stroke={GREEN} strokeWidth={2.2} dot={false} activeDot={{ r: 5, fill: '#fff', stroke: GREEN, strokeWidth: 3 }} isAnimationActive={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-gray-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0 border-t-[2px] border-dashed" style={{ borderColor: INK }} />BER (90 días)</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[2px] rounded-full" style={{ background: GREEN }} />Blended 7d</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: GREY_DOT }} />Blended del día</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: GREEN_SOFT }} />Espacio para escalar</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: RED_SOFT }} />Bajo el BER</span>
              {range === '90' && shadeFrom && <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'rgba(18,18,18,0.08)' }} />{periodName}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
