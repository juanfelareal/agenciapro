import React, { useMemo, useState } from 'react';
import { fmtMoney, fmtMoneyShort, fmtPct, fmtX, fmtInt, dayShort } from './format';
import { useLedgerQuery } from './useLedgerQuery';
import { LedgerCard, PillGroup, LedgerLoading, LedgerBuilding, LedgerEmpty, LedgerError, UpdatingPill } from './LedgerStates';

// Semana de lunes a domingo (el backend usa 0 = domingo … 6 = sábado)
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAY_PLURAL = ['los domingos', 'los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados'];
const HOUR_TICKS = [0, 6, 12, 18];
const DAYS_OPTIONS = [{ value: 30, label: '30 d' }, { value: 60, label: '60 d' }, { value: 90, label: '90 d' }];
const MODE_OPTIONS = [{ value: 'revenue', label: 'Venta' }, { value: 'orders', label: 'Pedidos' }];

const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const hourRange = (h) => `${hh(h)}–${hh((h + 1) % 24)}`;

/** "de viernes a domingo" si los mejores días son consecutivos (también sáb-dom-lun); si no, "los sábados, domingos y martes". */
function daysPhrase(days = []) {
  if (!days.length) return '';
  const pos = [...new Set(days.map((d) => WEEK.indexOf(d)))].sort((a, b) => a - b);
  if (pos.length >= 2) {
    for (const startPos of pos) {
      const consecutive = pos.every((p) => ((p - startPos + 7) % 7) < pos.length);
      if (consecutive) return `de ${DAY_LONG[WEEK[startPos]]} a ${DAY_LONG[WEEK[(startPos + pos.length - 1) % 7]]}`;
    }
  }
  const names = days.map((d) => DAY_PLURAL[d].replace('los ', ''));
  return `los ${names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0]}`;
}

/** Frase de resumen para decidir presupuesto de pauta y contenido. */
function buildSummary(data) {
  const w = data.weekend_vs_weekday || {};
  const best = data.best_days || [];
  const bestDay = best[0];
  const bestRow = bestDay !== undefined ? data.by_weekday?.[bestDay] : null;
  if (!data.totals?.orders) return null;
  const ratio = w.ratio;
  const tail = data.peak_hour ? ` Hora pico: ${hourRange(data.peak_hour.hour)} (${fmtPct(data.peak_hour.share, 0)} de los pedidos).` : '';
  if (ratio && ratio >= 1.25) {
    return `Los fines de semana venden ${fmtX(ratio)} más por día que entre semana. Sube presupuesto de pauta y contenido ${daysPhrase(best)}.${tail}`;
  }
  if (ratio && ratio <= 0.8) {
    return `Entre semana vende ${fmtX(1 / ratio)} más por día que el fin de semana. Concentra presupuesto ${daysPhrase(best)}.${tail}`;
  }
  if (bestRow) {
    return `La venta se reparte parejo entre semana y fin de semana. El mejor día es ${DAY_LONG[bestDay]} (${fmtPct(bestRow.share, 0)} de la venta); no hace falta mover presupuesto por día.${tail}`;
  }
  return null;
}

function Heatmap({ heatmap, mode, selected, onSelect }) {
  const grid = useMemo(() => {
    const byKey = new Map(heatmap.map((c) => [`${c.weekday}-${c.hour}`, c]));
    let max = 0; let best = null;
    for (const c of heatmap) { const v = c[mode] || 0; if (v > max) { max = v; best = c; } }
    return { byKey, max, best };
  }, [heatmap, mode]);

  const cellStyle = (c) => {
    const v = c?.[mode] || 0;
    if (!v || !grid.max) return { background: '#F1F2F4' };
    const alpha = 0.1 + 0.9 * Math.pow(v / grid.max, 0.6);
    return { background: `rgba(23,24,26,${alpha.toFixed(3)})` };
  };

  return (
    <div className="mt-4 select-none">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: '26px repeat(24, minmax(0, 1fr))' }}>
        {WEEK.map((wd) => (
          <React.Fragment key={wd}>
            <div className="text-[10px] text-gray-400 leading-none self-center pr-1">{DAY_SHORT[wd]}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const c = grid.byKey.get(`${wd}-${h}`);
              const isBest = grid.best && grid.best.weekday === wd && grid.best.hour === h && (grid.best[mode] || 0) > 0;
              const isSel = selected && selected.weekday === wd && selected.hour === h;
              return (
                <button
                  key={h}
                  type="button"
                  aria-label={`${DAY_LONG[wd]} ${hourRange(h)}: ${fmtInt(c?.orders || 0)} pedidos, ${fmtMoney(c?.revenue || 0)}`}
                  title={`${DAY_SHORT[wd]} ${hourRange(h)} · ${fmtInt(c?.orders || 0)} pedidos · ${fmtMoney(c?.revenue || 0)}`}
                  onClick={() => onSelect(isSel ? null : { weekday: wd, hour: h })}
                  className="rounded-[2px] aspect-square min-h-[10px] w-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    ...cellStyle(c),
                    boxShadow: isSel ? 'inset 0 0 0 2px #44BF47' : isBest ? 'inset 0 0 0 2px #44BF47' : undefined,
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[9px] sm:text-[10px] text-gray-400 leading-none mt-0.5 text-left whitespace-nowrap">
            {HOUR_TICKS.includes(h) ? `${h}h` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekdayRanking({ byWeekday, bestDays }) {
  const max = Math.max(...byWeekday.map((w) => w.avg_revenue_per_day || 0), 0);
  const top = new Set((bestDays || []).slice(0, 2));
  return (
    <div className="mt-5 space-y-1.5">
      {WEEK.map((wd) => {
        const w = byWeekday[wd] || {};
        const pct = max > 0 ? Math.max(2, ((w.avg_revenue_per_day || 0) / max) * 100) : 0;
        const strong = top.has(wd);
        return (
          <div key={wd} className="grid items-center gap-2 text-[11px]" style={{ gridTemplateColumns: '26px 1fr auto' }}>
            <span className={`leading-none ${strong ? 'text-[#121314] font-semibold' : 'text-gray-400'}`}>{DAY_SHORT[wd]}</span>
            <div className="h-[18px] bg-gray-100 rounded-md overflow-hidden">
              <div className="h-full rounded-md transition-[width] duration-500" style={{ width: `${pct}%`, background: strong ? '#121314' : '#C9C6C0' }} />
            </div>
            <span className="tabular-nums text-right whitespace-nowrap">
              <span className={`font-semibold ${strong ? 'text-[#121314]' : 'text-gray-600'}`}>
                <span className="sm:hidden">{fmtMoneyShort(w.avg_revenue_per_day)}</span>
                <span className="hidden sm:inline">{fmtMoney(w.avg_revenue_per_day)}</span>
              </span>
              <span className="text-gray-400"> / día · {fmtPct(w.share, 0)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * "Cuándo compran": mapa de calor día × hora, ranking de días y una frase para decidir presupuesto.
 * `api` es el adaptador { patterns, customerMix, backfill } (ver ledgerApi.js).
 */
export default function PurchasePatterns({ clientId, api }) {
  const [days, setDays] = useState(90);
  const [mode, setMode] = useState('revenue');
  const [selected, setSelected] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const { data, loading, error, reload, pollsExhausted } = useLedgerQuery(`${clientId}|${days}`, () => api.patterns(clientId, days));

  const summary = useMemo(() => (data && !data.empty && data.heatmap ? buildSummary(data) : null), [data]);
  const selectedCell = useMemo(() => {
    if (!data?.heatmap) return null;
    const pick = selected || (data.heatmap.length ? [...data.heatmap].sort((a, b) => (b[mode] || 0) - (a[mode] || 0))[0] : null);
    return pick && (pick.orders || pick.revenue) ? pick : null;
  }, [data, selected, mode]);

  const handleBackfill = async () => {
    setBackfilling(true);
    try { await api.backfill(clientId, 180); reload(); } catch { /* el estado de error lo muestra la tarjeta */ } finally { setBackfilling(false); }
  };

  const right = (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {data?.building && data?.heatmap && <UpdatingPill />}
      <PillGroup ariaLabel="Intensidad" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      <PillGroup ariaLabel="Rango" options={DAYS_OPTIONS} value={days} onChange={setDays} />
    </div>
  );

  let body;
  if (loading && !data) body = <LedgerLoading />;
  else if (error && !data) body = <LedgerError error={error} onRetry={reload} />;
  else if (data?.building && !data?.heatmap) body = <LedgerBuilding exhausted={pollsExhausted} onRetry={reload} />;
  else if (!data?.heatmap || !data?.totals?.orders) {
    body = (
      <LedgerEmpty
        noStore={Boolean(data?.no_store)}
        onBackfill={handleBackfill}
        backfilling={backfilling}
        text={data?.heatmap ? `No hay pedidos pagados en los últimos ${days} días.` : undefined}
      />
    );
  } else {
    const p = data.period || {};
    body = (
      <>
        {summary && <p className="text-[13px] text-[#121314] leading-relaxed mt-3">{summary}</p>}
        <Heatmap heatmap={data.heatmap} mode={mode} selected={selected} onSelect={setSelected} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-gray-500">
          {selectedCell ? (
            <span>
              <span className="font-medium text-[#121314]">{DAY_SHORT[selectedCell.weekday]} {hourRange(selectedCell.hour)}</span>
              {' · '}{fmtInt(selectedCell.orders)} pedidos · {fmtMoney(selectedCell.revenue)}
              {!selected && <span className="text-gray-400"> (celda pico)</span>}
            </span>
          ) : <span />}
          <span className="text-gray-400">
            {fmtInt(data.totals.orders)} pedidos · {fmtMoney(data.totals.revenue)}
            {p.effective_start && p.start && p.effective_start > p.start ? ` · datos desde ${dayShort(p.effective_start)}` : ''}
          </span>
        </div>
        <WeekdayRanking byWeekday={data.by_weekday} bestDays={data.best_days} />
        <p className="text-[10px] text-gray-400 mt-3">Venta neta promedio por día de la semana (sin IVA ni envío) y % de la venta del período. Hora Colombia.</p>
      </>
    );
  }

  return (
    <LedgerCard
      title="Cuándo compran"
      info="Pedidos pagados por día de la semana y hora (Colombia). La intensidad del mapa es la venta neta o el número de pedidos. Úsalo para subir presupuesto de pauta y publicar contenido cuando la marca más vende."
      right={right}
    >
      {body}
    </LedgerCard>
  );
}
