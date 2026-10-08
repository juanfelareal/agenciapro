import React, { useState } from 'react';
import { Flag, Pencil, Check, X, Loader2, Target } from 'lucide-react';
import Info from './Info';
import { fmtMoney, fmtPct, fmtPctNum } from './format';
import { growthAPI } from '../../../utils/api';

const fmtX = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toFixed(2)}×`);

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
            <div className="grid grid-cols-3 gap-2">
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
            <div className="grid grid-cols-3 gap-3 mt-4 text-[13px]">
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
            <div className="grid grid-cols-3 gap-3 mt-3">
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
            <div className="mt-4 pt-4 border-t border-gray-100 text-[13px] text-gray-600 space-y-1.5">
              <p className="text-[11px] text-gray-400">Si mantienes la inversión actual ({fmtMoney(be.ads_per_day)}/día, unos {fmtMoney((be.ads_per_day || 0) * (data.days_in_month || 0))} en el mes):</p>
              <p>
                Para que la pauta empate (ROAS {fmtX(be.roas_min)}) necesitas vender <strong className="text-[#17181A] tabular-nums">{fmtMoney(be.revenue_for_roas_min)}</strong> en el mes
                <Info text="Inversión del mes ÷ margen de contribución: con esa venta la pauta recupera lo que cuesta, después de producto y variables. No depende del ROAS actual, sino de cuánto inviertes." className="ml-1" />
              </p>
              <p>
                Para no perder contando los fijos (ROAS {fmtX(be.roas_target)}) necesitas <strong className="text-[#17181A] tabular-nums">{fmtMoney(be.revenue_month)}</strong> en el mes
                <Info text="(Inversión del mes + costos fijos) ÷ margen de contribución. Si la inversión sube o baja, esta cifra cambia." className="ml-1" />
              </p>
              <p className="text-[11px] text-gray-400">Margen de contribución {fmtPct(be.contribution_ratio, 0)} (lo que queda de cada venta después de producto y variables).</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 mt-2">{t.revenue ? 'Con el costo de producto y los costos variables actuales no hay ROAS que alcance: cada venta deja menos de lo que cuesta. Revisa precios o costos.' : 'Cuando haya ventas calculamos el ROAS que necesitas.'}</p>
        )}
      </div>
    </div>
  );
}
