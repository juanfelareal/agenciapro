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

  const chip = (active) => `px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${active ? 'bg-[#17181A] text-white border-[#17181A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`;
  const profitCls = (v) => (v >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]');

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
            className="w-14 px-1.5 py-0.5 border border-gray-200 rounded-md text-[12px] text-[#17181A] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
          />
          <Info text={`Por defecto es el ROAS ${isCurrent ? 'actual' : 'del mes'}. Cámbialo para simular qué pasaría si la pauta rinde más o menos al subir la inversión (normalmente, a más inversión el ROAS baja).`} />
        </label>
      </div>

      <div className="mt-3 space-y-1.5">
        <p>
          Para que la pauta empate (ROAS {fmtX(sc.roasMin)}) necesitas vender <strong className="text-[#17181A] tabular-nums">{fmtMoney(sc.revenueBreakAds)}</strong> en el mes
          <Info text="Inversión del mes ÷ margen de contribución: con esa venta la pauta recupera lo que cuesta, después de producto y variables. No depende del ROAS actual, sino de cuánto inviertes." className="ml-1" />
        </p>
        <p>
          Para no perder contando los fijos (ROAS {fmtX(sc.roasTarget)}) necesitas <strong className="text-[#17181A] tabular-nums">{fmtMoney(sc.revenueNoLoss)}</strong> en el mes
          <Info text="(Inversión del mes + costos fijos) ÷ margen de contribución. A más inversión, el ROAS objetivo baja porque los fijos se reparten entre más pauta, pero la venta necesaria sube." className="ml-1" />
        </p>
        <p>
          Con ROAS {fmtX(roasExpected)} venderías <strong className="text-[#17181A] tabular-nums">{fmtMoney(sc.revenueExpected)}</strong> y {sc.profitExpected >= 0 ? 'ganarías' : 'perderías'} <strong className={`tabular-nums ${profitCls(sc.profitExpected)}`}>{fmtMoney(Math.abs(sc.profitExpected))}</strong> en el mes
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
              <tr key={r.key} onClick={() => setSelected(r.key)} className={`cursor-pointer border-t border-gray-100 ${selected === r.key ? 'bg-[#D7F653]/20' : 'hover:bg-gray-50'}`}>
                <td className="py-1.5 pr-2 font-medium text-[#17181A]">{r.label} <span className="text-gray-400 font-normal">({fmtMoney(r.ads)}/día)</span></td>
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
 */
export default function GoalAndRoas({ clientId, period, data, goal, onGoalSaved }) {
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
      await growthAPI.createObjective(clientId, {
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
            <Flag className="w-3.5 h-3.5 text-[#17181A]" /> Meta de venta del mes
            <Info text="La meta base que definieron para este mes (es la misma del Dashboard de Growth). Se compara contra la venta neta acumulada." />
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-[#17181A] inline-flex items-center gap-1">
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
                  <input type="number" min="0" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D7F653]" placeholder="$" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-lg hover:bg-gray-100 inline-flex items-center gap-1"><X className="w-3 h-3" /> Cancelar</button>
              <button type="button" onClick={save} disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-[#17181A] text-white inline-flex items-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Guardar
              </button>
            </div>
          </div>
        ) : base > 0 ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-[#17181A]">{fmtMoney(t.revenue)}</span>
              <span className="text-sm text-gray-500">de {fmtMoney(base)}</span>
              <span className={`text-sm font-semibold tabular-nums ${pct >= 100 ? 'text-[#16a34a]' : 'text-[#17181A]'}`}>{fmtPctNum(pct, 0)}</span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-[#16a34a]' : onTrack ? 'bg-[#D7F653]' : 'bg-[#F59E0B]'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-[13px]">
              <div>
                <div className="text-[11px] text-gray-400">Falta</div>
                <div className="font-semibold tabular-nums text-[#17181A]">{fmtMoney(missing)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">{isCurrent ? `Necesitas / día (${daysRemaining} días)` : 'Cierre'}</div>
                <div className="font-semibold tabular-nums text-[#17181A]">{isCurrent ? (daysRemaining > 0 ? fmtMoney(neededPerDay) : '—') : (pct >= 100 ? 'Meta cumplida' : 'No se alcanzó')}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">Proyección <Info text="Al ritmo promedio de los días transcurridos, así cerraría la venta del mes." /></div>
                <div className={`font-semibold tabular-nums ${onTrack ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{isCurrent ? fmtMoney(data.projection?.revenue_eom) : fmtMoney(t.revenue)}</div>
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

      {/* ROAS de equilibrio */}
      <div className="glass-solid rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
          <Target className="w-3.5 h-3.5 text-[#17181A]" /> ROAS de equilibrio
          <Info text="Calculado con el margen real de tus productos: de cada $100 vendidos, lo que queda después del costo de producto y los costos variables es lo que puede pagar la pauta." />
        </div>
        {be.reachable && be.roas_min ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">ROAS mínimo <Info text="Con este ROAS la pauta empata: cada peso invertido trae justo lo necesario para cubrir producto y variables. Por debajo, cada venta pagada pierde plata." /></div>
                <div className="text-2xl font-bold tabular-nums text-[#17181A]">{fmtX(be.roas_min)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">ROAS objetivo <Info text="El ROAS que necesitas al ritmo de inversión actual para cubrir además los costos fijos del mes, es decir, para no perder." /></div>
                <div className="text-2xl font-bold tabular-nums text-[#17181A]">{fmtX(be.roas_target)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">{isCurrent ? 'ROAS actual' : 'ROAS del mes'}</div>
                <div className={`text-2xl font-bold tabular-nums ${be.current_roas >= be.roas_target ? 'text-[#16a34a]' : be.current_roas >= be.roas_min ? 'text-[#F59E0B]' : 'text-[#dc2626]'}`}>{fmtX(be.current_roas)}</div>
              </div>
            </div>
            <ScenarioPlanner be={be} daysInMonth={data.days_in_month || 30} isCurrent={isCurrent} />
          </>
        ) : (
          <p className="text-sm text-gray-500 mt-2">{t.revenue ? 'Con el costo de producto y los costos variables actuales no hay ROAS que alcance: cada venta deja menos de lo que cuesta. Revisa precios o costos.' : 'Cuando haya ventas calculamos el ROAS que necesitas.'}</p>
        )}
      </div>
    </div>
  );
}
