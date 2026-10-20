import React, { useMemo, useState } from 'react';
import { Flag, Pencil, Check, X, Loader2, Target, SlidersHorizontal } from 'lucide-react';
import Info from './Info';
import { fmtMoney, fmtPct, fmtPctNum } from './format';
import { growthAPI } from '../../../utils/api';

const fmtX = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toFixed(2)}×`);


const parseMoney = (raw) => { const d = String(raw || '').replace(/\D/g, ''); return d ? Number(d) : 0; };
const fmtInput = (n) => (n ? Math.round(n).toLocaleString('es-CO') : '');

/**
 * Escenarios de inversión: ¿qué pasa si invierto más (o menos) en pauta?
 * Todo sale del margen de contribución (cr), los fijos por día y los días del mes:
 *   ROAS mínimo       = 1 / cr                               (no depende de la inversión)
 *   ROAS objetivo     = (fijos/día + inversión/día) / (cr × inversión/día)
 *   Venta para empatar la pauta = inversión del mes × ROAS mínimo
 *   Venta para no perder        = (inversión del mes + fijos del mes) / cr
 *   Con un ROAS esperado R: venta = inversión × R; utilidad = venta × cr − inversión − fijos
 */
function ScenarioPlanner({ be, daysInMonth, isCurrent }) {
  const cr = Number(be.contribution_ratio) || 0;
  const fixedPerDay = Number(be.fixed_per_day) || 0;
  const currentAds = Number(be.ads_per_day) || 0;
  const baseAds = currentAds > 0 ? currentAds : 50000;
  const presets = [
    { key: 'actual', label: currentAds > 0 ? 'Actual' : 'Base', ads: baseAds },
    { key: 'x1.5', label: '+50 %', ads: baseAds * 1.5 },
    { key: 'x2', label: '×2', ads: baseAds * 2 },
    { key: 'x3', label: '×3', ads: baseAds * 3 },
  ];
  const [selected, setSelected] = useState('actual');
  const [customAds, setCustomAds] = useState('');
  const [roasInput, setRoasInput] = useState('');

  const adsPerDay = selected === 'custom' ? parseMoney(customAds) : (presets.find((p) => p.key === selected)?.ads || baseAds);
  const roasExpected = roasInput !== '' ? Number(String(roasInput).replace(',', '.')) : (Number(be.current_roas) || 0);

  const sc = useMemo(() => {
    const adsMonth = adsPerDay * daysInMonth;
    const fixedMonth = fixedPerDay * daysInMonth;
    const roasMin = cr > 0 ? 1 / cr : null;
    const roasTarget = cr > 0 && adsPerDay > 0 ? (fixedPerDay + adsPerDay) / (cr * adsPerDay) : null;
    const revenueBreakAds = roasMin ? adsMonth * roasMin : null;
    const revenueNoLoss = cr > 0 ? (adsMonth + fixedMonth) / cr : null;
    const revenueExpected = adsMonth * (roasExpected || 0);
    const profitExpected = revenueExpected * cr - adsMonth - fixedMonth;
    return { adsMonth, fixedMonth, roasMin, roasTarget, revenueBreakAds, revenueNoLoss, revenueExpected, profitExpected };
  }, [adsPerDay, daysInMonth, fixedPerDay, cr, roasExpected]);

  const rows = useMemo(() => {
    const list = presets.map((p) => ({ ...p }));
    if (selected === 'custom' && adsPerDay > 0) list.push({ key: 'custom', label: 'Tu escenario', ads: adsPerDay });
    return list.map((p) => {
      const adsMonth = p.ads * daysInMonth;
      const fixedMonth = fixedPerDay * daysInMonth;
      const roasTarget = cr > 0 && p.ads > 0 ? (fixedPerDay + p.ads) / (cr * p.ads) : null;
      const revenueNoLoss = cr > 0 ? (adsMonth + fixedMonth) / cr : null;
      const profit = adsMonth * (roasExpected || 0) * cr - adsMonth - fixedMonth;
      return { ...p, adsMonth, roasTarget, revenueNoLoss, profit };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, adsPerDay, daysInMonth, fixedPerDay, cr, roasExpected, baseAds]);

  const chip = (active) => `px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${active ? 'bg-[#121314] text-white border-[#121314]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`;
  const profitCls = (v) => (v >= 0 ? 'text-[#1E7A30]' : 'text-[#dc2626]');

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 text-[13px] text-gray-600">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500"><SlidersHorizontal className="w-3.5 h-3.5" /> Escenario de inversión</span>
        {presets.map((p) => (
          <button key={p.key} type="button" onClick={() => setSelected(p.key)} className={chip(selected === p.key)} title={`${fmtMoney(p.ads)}/día`}>{p.label}</button>
        ))}
        <label className={`inline-flex items-center gap-1 ${chip(selected === 'custom')} cursor-text`} onClick={() => setSelected('custom')}>
          $
          <input
            type="text" inputMode="numeric" placeholder="otro / día"
            value={selected === 'custom' ? fmtInput(parseMoney(customAds)) : ''}
            onFocus={() => setSelected('custom')}
            onChange={(e) => { setSelected('custom'); setCustomAds(e.target.value); }}
            className="w-20 bg-transparent focus:outline-none tabular-nums placeholder:text-gray-400"
          />
          /día
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
        <span>Inversión {fmtMoney(adsPerDay)}/día · {fmtMoney(sc.adsMonth)} en el mes{currentAds > 0 && selected !== 'actual' && adsPerDay > 0 ? ` (${adsPerDay >= currentAds ? '+' : ''}${Math.round(((adsPerDay - currentAds) / currentAds) * 100)} % vs. actual)` : ''}</span>
        <label className="inline-flex items-center gap-1">
          ROAS esperado
          <input
            type="text" inputMode="decimal"
            value={roasInput}
            placeholder={be.current_roas ? Number(be.current_roas).toFixed(2) : '3.00'}
            onChange={(e) => setRoasInput(e.target.value.replace(/[^\d.,]/g, ''))}
            className="w-14 px-1.5 py-0.5 border border-gray-200 rounded-md text-[12px] text-[#121314] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#44BF47]/40"
          />
          <Info text={`Por defecto es el ROAS ${isCurrent ? 'actual' : 'del mes'}. Cámbialo para simular qué pasaría si la pauta rinde más o menos al subir la inversión (normalmente, a más inversión el ROAS baja).`} />
        </label>
      </div>

      <div className="mt-3 space-y-1.5">
        <p>
          Para que la pauta empate (ROAS {fmtX(sc.roasMin)}) necesitas vender <strong className="text-[#121314] tabular-nums">{fmtMoney(sc.revenueBreakAds)}</strong> en el mes
          <Info text="Inversión del mes ÷ margen de contribución: con esa venta la pauta recupera lo que cuesta, después de producto y variables. No depende del ROAS actual, sino de cuánto inviertes." className="ml-1" />
        </p>
        <p>
          Para no perder contando los fijos (ROAS {fmtX(sc.roasTarget)}) necesitas <strong className="text-[#121314] tabular-nums">{fmtMoney(sc.revenueNoLoss)}</strong> en el mes
          <Info text="(Inversión del mes + costos fijos) ÷ margen de contribución. A más inversión, el ROAS objetivo baja porque los fijos se reparten entre más pauta, pero la venta necesaria sube." className="ml-1" />
        </p>
        <p>
          Con ROAS {fmtX(roasExpected)} venderías <strong className="text-[#121314] tabular-nums">{fmtMoney(sc.revenueExpected)}</strong> y {sc.profitExpected >= 0 ? 'ganarías' : 'perderías'} <strong className={`tabular-nums ${profitCls(sc.profitExpected)}`}>{fmtMoney(Math.abs(sc.profitExpected))}</strong> en el mes
          <Info text="Venta esperada × margen de contribución − inversión − costos fijos del mes. Si da negativo, subir la inversión a ese ROAS solo hace el hueco más grande." className="ml-1" />
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-400">
              <th className="text-left font-medium py-1 pr-2">Escenario</th>
              <th className="text-right font-medium py-1 px-2">Inversión / mes</th>
              <th className="text-right font-medium py-1 px-2">ROAS objetivo</th>
              <th className="text-right font-medium py-1 px-2">Venta para no perder</th>
              <th className="text-right font-medium py-1 pl-2">Utilidad a {fmtX(roasExpected)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} onClick={() => setSelected(r.key)} className={`cursor-pointer border-t border-gray-100 ${selected === r.key ? 'bg-[#44BF47]/12' : 'hover:bg-gray-50'}`}>
                <td className="py-1.5 pr-2 font-medium text-[#121314]">{r.label} <span className="text-gray-400 font-normal">({fmtMoney(r.ads)}/día)</span></td>
                <td className="py-1.5 px-2 text-right tabular-nums">{fmtMoney(r.adsMonth)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{fmtX(r.roasTarget)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{fmtMoney(r.revenueNoLoss)}</td>
                <td className={`py-1.5 pl-2 text-right tabular-nums font-semibold ${profitCls(r.profit)}`}>{r.profit < 0 ? '−' : ''}{fmtMoney(Math.abs(r.profit))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">Margen de contribución {fmtPct(cr, 0)} (lo que queda de cada venta después de producto y variables) · fijos {fmtMoney(sc.fixedMonth)}/mes.</p>
    </div>
  );
}

/**
 * Meta de venta del mes (objetivo "revenue" de Growth) + ROAS de equilibrio según el margen real.
 * Props: clientId, period (YYYY-MM), data (financials), goal ({id, conservador, base, optimista} | null), onGoalSaved()
 *        api (opcional): adaptador con la misma firma de growthAPI (p. ej. el portal del cliente)
 */
export default function GoalAndRoas({ clientId, period, data, goal, onGoalSaved, api }) {
  const t = data.totals || {};
  const be = data.break_even || {};
  const isCurrent = data.is_current_month;
  const daysRemaining = Math.max(0, (data.days_in_month || 0) - (data.days_elapsed || 0));

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ conservador: goal?.conservador || '', base: goal?.base || '', optimista: goal?.optimista || '' });

  const base = Number(goal?.base) || 0;
  const pct = base > 0 ? Math.min(100, (t.revenue / base) * 100) : 0;
  const missing = Math.max(0, base - (t.revenue || 0));
  const neededPerDay = daysRemaining > 0 ? missing / daysRemaining : 0;
  const onTrack = base > 0 && (data.projection?.revenue_eom || 0) >= base;

  const save = async () => {
    setSaving(true);
    try {
      await (api?.createObjective ?? growthAPI.createObjective)(clientId, {
        period, metric: 'revenue',
        conservador: Number(form.conservador) || 0, base: Number(form.base) || 0, optimista: Number(form.optimista) || 0,
      });
      setEditing(false);
      onGoalSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Meta del mes */}
      <div className="glass-solid rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
            <Flag className="w-3.5 h-3.5 text-[#121314]" /> Meta de venta del mes
            <Info text="La meta base que definieron para este mes (es la misma del Dashboard de Growth). Se compara contra la venta neta acumulada." />
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-[#121314] inline-flex items-center gap-1">
              <Pencil className="w-3 h-3" /> {base > 0 ? 'Editar' : 'Definir meta'}
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['conservador', 'base', 'optimista'].map((k) => (
                <label key={k} className="text-[11px] text-gray-500 capitalize">
                  {k}
                  <input type="number" min="0" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#44BF47]/40" placeholder="$" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-lg hover:bg-gray-100 inline-flex items-center gap-1"><X className="w-3 h-3" /> Cancelar</button>
              <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-[#121314] text-white inline-flex items-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Guardar
              </button>
            </div>
          </div>
        ) : base > 0 ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-[#121314]">{fmtMoney(t.revenue)}</span>
              <span className="text-sm text-gray-500">de {fmtMoney(base)}</span>
              <span className={`text-sm font-semibold tabular-nums ${pct >= 100 ? 'text-[#1E7A30]' : 'text-[#121314]'}`}>{fmtPctNum(pct, 0)}</span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-[#44BF47]' : onTrack ? 'bg-[#44BF47]' : 'bg-[#F59E0B]'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-[13px]">
              <div>
                <div className="text-[11px] text-gray-400">Falta</div>
                <div className="font-semibold tabular-nums text-[#121314]">{fmtMoney(missing)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">{isCurrent ? `Necesitas / día (${daysRemaining} días)` : 'Cierre'}</div>
                <div className="font-semibold tabular-nums text-[#121314]">{isCurrent ? (daysRemaining > 0 ? fmtMoney(neededPerDay) : '—') : (pct >= 100 ? 'Meta cumplida' : 'No se alcanzó')}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">Proyección <Info text="Al ritmo promedio de los días transcurridos, así cerraría la venta del mes." /></div>
                <div className={`font-semibold tabular-nums ${onTrack ? 'text-[#1E7A30]' : 'text-[#dc2626]'}`}>{isCurrent ? fmtMoney(data.projection?.revenue_eom) : fmtMoney(t.revenue)}</div>
              </div>
            </div>
            {(Number(goal?.conservador) > 0 || Number(goal?.optimista) > 0) && (
              <p className="text-[11px] text-gray-400 mt-3">Conservador {fmtMoney(goal.conservador)} · Optimista {fmtMoney(goal.optimista)}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 mt-2">Este mes no tiene meta definida. Defínela aquí o en el Dashboard de Growth para seguirla día a día.</p>
        )}
      </div>

      {/* BE ROAS (break-even ROAS) */}
      <div className="glass-solid rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
          <Target className="w-3.5 h-3.5 text-[#121314]" /> BE ROAS · ROAS de equilibrio
          <Info text="Break-even ROAS: el ROAS a partir del cual la pauta deja plata. Se calcula con el ticket promedio y lo que cuesta cada pedido (producto + variables). Por encima de este número, escalas; por debajo, cada venta pagada pierde." />
        </div>
        {be.reachable && be.roas_min ? (
          <>
            {(() => {
              const orders = Number(t.orders) || 0;
              const aov = orders > 0 ? t.revenue / orders : null;
              const cogsPo = orders > 0 ? t.cogs / orders : null;
              const varPo = orders > 0 ? t.variable_costs / orders : null;
              const marginPo = aov !== null ? aov - cogsPo - varPo : null;
              const cur = Number(be.current_roas) || 0;
              const verdict = !cur ? null : cur >= be.roas_min * 1.15 ? 'scale' : cur >= be.roas_min ? 'hold' : 'stop';
              const vTone = verdict === 'scale' ? 'bg-[#44BF47] text-white' : verdict === 'hold' ? 'bg-[#F59E0B] text-white' : verdict === 'stop' ? 'bg-[#dc2626] text-white' : 'bg-gray-200 text-gray-600';
              const vLabel = verdict === 'scale' ? 'Escalar' : verdict === 'hold' ? 'Sostener' : verdict === 'stop' ? 'No escalar' : 'Sin pauta';
              return (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-3 mt-3">
                    <div>
                      <div className="text-[11px] text-gray-400">BE ROAS de la marca</div>
                      <div className="text-4xl font-bold tabular-nums tracking-tight text-[#121314]">{fmtX(be.roas_min)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-gray-400">{isCurrent ? 'ROAS actual' : 'ROAS del mes'}</div>
                      <div className={`text-3xl font-bold tabular-nums ${verdict === 'scale' ? 'text-[#1E7A30]' : verdict === 'hold' ? 'text-[#F59E0B]' : verdict === 'stop' ? 'text-[#dc2626]' : 'text-gray-400'}`}>{fmtX(be.current_roas)}</div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${vTone}`}>{vLabel}</span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-2">
                    {verdict === 'scale' && <>Vas {fmtX(cur - be.roas_min)} por encima del BE ROAS: cada peso de pauta deja plata. Puedes subir inversión mientras el ROAS se mantenga sobre {fmtX(be.roas_min)}.</>}
                    {verdict === 'hold' && <>Estás justo sobre el BE ROAS: la pauta empata o deja muy poco. Sostén la inversión y mejora creativos o margen antes de escalar.</>}
                    {verdict === 'stop' && <>Estás {fmtX(be.roas_min - cur)} por debajo del BE ROAS: cada venta pagada pierde plata. No escales; primero sube el ROAS o el margen por pedido.</>}
                    {!verdict && <>Este mes no hay inversión en pauta registrada.</>}
                  </p>

                  {aov !== null && (
                    <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[12px] text-gray-600">
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">Cómo sale el BE ROAS</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5">
                        <div><div className="text-[10px] text-gray-400">Ticket promedio</div><div className="font-semibold tabular-nums text-[#121314]">{fmtMoney(aov)}</div></div>
                        <div><div className="text-[10px] text-gray-400">− Producto / pedido</div><div className="font-semibold tabular-nums text-[#121314]">{fmtMoney(cogsPo)}</div></div>
                        <div><div className="text-[10px] text-gray-400">− Variables / pedido</div><div className="font-semibold tabular-nums text-[#121314]">{fmtMoney(varPo)}</div></div>
                        <div><div className="text-[10px] text-gray-400">= Margen / pedido</div><div className={`font-semibold tabular-nums ${marginPo > 0 ? 'text-[#1E7A30]' : 'text-[#dc2626]'}`}>{fmtMoney(marginPo)}</div></div>
                      </div>
                      <div className="mt-2 text-[11px] text-gray-500">
                        BE ROAS = {fmtMoney(aov)} ÷ {fmtMoney(marginPo)} = <strong className="text-[#121314]">{fmtX(be.roas_min)}</strong>
                        <span className="text-gray-400"> · margen de contribución {fmtPct(be.contribution_ratio, 0)}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">ROAS objetivo (cubre fijos) <Info text="Al ritmo de inversión actual, el ROAS que necesitas para que además queden cubiertos los costos fijos del mes. Es el ROAS para no perder." /></div>
                      <div className="text-xl font-bold tabular-nums text-[#121314]">{fmtX(be.roas_target)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">Regla de escala <Info text="Verde: ROAS 15 % o más por encima del BE ROAS. Amarillo: entre el BE ROAS y ese colchón. Rojo: por debajo del BE ROAS." /></div>
                      <div className="text-[13px] font-medium text-[#121314] mt-1">Escalar desde <span className="tabular-nums">{fmtX(be.roas_min * 1.15)}</span></div>
                    </div>
                  </div>
                </>
              );
            })()}
            <ScenarioPlanner be={be} daysInMonth={data.days_in_month || 30} isCurrent={isCurrent} />
          </>
        ) : (
          <p className="text-sm text-gray-500 mt-2">{t.revenue ? 'Con el costo de producto y los costos variables actuales no hay ROAS que alcance: cada venta deja menos de lo que cuesta. Revisa precios o costos.' : 'Cuando haya ventas calculamos el ROAS que necesitas.'}</p>
        )}
      </div>
    </div>
  );
}
