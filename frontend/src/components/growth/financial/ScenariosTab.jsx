/**
 * Pestaña "Escenarios" del dashboard financiero: "¿qué pasa si…?" guardados, privados o compartidos.
 *
 * Props: { clientId, period, data, api }
 *   api = { list({period}), create(body), update(id, body), remove(id), evaluate({period, params}), compare(ids, period) }
 *   Cada función devuelve directamente el JSON (sin `.data`), así el portal del cliente puede pasar su propio adaptador.
 *   El del equipo está en `./scenariosApi` (`teamScenariosApi(clientId)`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Lock, Users, Copy, Pencil, Trash2, Loader2, X, Check, AlertTriangle, SlidersHorizontal, GitCompare, Sparkles } from 'lucide-react';
import Info from './Info';
import { fmtMoney, fmtPct, fmtX, fmtInt, COLORS, monthLabel } from './format';

// ─── Utilidades ───
const parseMoney = (raw) => { const d = String(raw ?? '').replace(/\D/g, ''); return d ? Number(d) : ''; };
const fmtInput = (n) => (n === '' || n === null || n === undefined ? '' : Math.round(Number(n)).toLocaleString('es-CO'));
const parseDec = (raw) => { const s = String(raw ?? '').replace(',', '.').replace(/[^\d.]/g, ''); return s === '' || Number.isNaN(Number(s)) ? '' : Number(s); };
const errText = (err, fallback) => err?.response?.data?.error || err?.message || fallback;
const profitCls = (v) => (v > 0 ? 'text-[var(--accent-deep)]' : v < 0 ? 'text-[#dc2626]' : 'text-[var(--ink)]');
const signed = (v) => (v > 0 ? `+${fmtMoney(v)}` : fmtMoney(v));
let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

/** Campo de pesos: texto que acepta "1.500.000" (solo cuentan los dígitos). Nunca type="number". */
function MoneyInput({ value, onChange, placeholder, className = '', ...rest }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
      <input
        type="text" inputMode="numeric" value={fmtInput(value)} placeholder={placeholder}
        onChange={(e) => onChange(parseMoney(e.target.value))}
        className="input w-full pl-6 tabular-nums" {...rest}
      />
    </div>
  );
}

/** Campo decimal (ROAS, %): acepta coma o punto. Guarda el texto tal cual se escribe (solo lo cambia el usuario). */
function DecInput({ value, onChange, placeholder, suffix, className = '' }) {
  const [text, setText] = useState(value === '' || value === undefined ? '' : String(value));
  return (
    <div className={`relative ${className}`}>
      <input
        type="text" inputMode="decimal" value={text} placeholder={placeholder}
        onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ''); setText(v); onChange(parseDec(v)); }}
        className={`input w-full tabular-nums ${suffix ? 'pr-8' : ''}`}
      />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
    </div>
  );
}

const Field = ({ label, info, children, hint }) => (
  <label className="block min-w-0">
    <span className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">{label}{info && <Info text={info} />}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1 leading-snug">{hint}</span>}
  </label>
);

const chipCls = (active) => `px-2.5 py-1 rounded-full text-[11px] font-medium border transition whitespace-nowrap ${active ? 'bg-[var(--dark)] text-white border-[var(--ink)]' : 'bg-[var(--surface)] text-gray-600 border-gray-200 hover:border-gray-400'}`;

function VisibilityChip({ visibility, className = '' }) {
  const priv = visibility === 'private';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${priv ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'} ${className}`}>
      {priv ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}{priv ? 'Privado' : 'Compartido'}
    </span>
  );
}

// ─── Formulario ↔ params ───
const emptyForm = () => ({
  name: '', description: '', visibility: 'shared',
  ads_per_day: '', roas: '', aov: '', cogs_pct: '', revenue_month: '',
  extra_variable_costs: [], extra_fixed_costs: [], exclude_variable_cost_ids: [], exclude_fixed_cost_ids: [],
});
const formFromScenario = (s, { duplicate = false } = {}) => {
  const p = s?.params || {};
  return {
    ...emptyForm(),
    name: duplicate ? `${s.name} (copia)` : (s?.name || ''),
    description: s?.description || '',
    visibility: s?.visibility || 'shared',
    ads_per_day: p.ads_per_day ?? '',
    roas: p.roas ?? '',
    aov: p.aov ?? '',
    cogs_pct: p.cogs_rate === undefined ? '' : Math.round(p.cogs_rate * 1000) / 10,
    revenue_month: p.revenue_month ?? '',
    extra_variable_costs: (p.extra_variable_costs || []).map((vc) => ({ key: nextKey(), name: vc.name || '', kind: vc.kind === 'percent' ? 'percent' : 'per_order', amount: vc.amount ?? '', percentage: vc.percentage ?? '', applies_to: vc.applies_to || 'revenue' })),
    extra_fixed_costs: (p.extra_fixed_costs || []).map((fc) => ({ key: nextKey(), name: fc.name || '', amount: fc.amount ?? '' })),
    exclude_variable_cost_ids: p.exclude_variable_cost_ids || [],
    exclude_fixed_cost_ids: p.exclude_fixed_cost_ids || [],
  };
};
const paramsFromForm = (f) => {
  const p = {};
  if (f.ads_per_day !== '') p.ads_per_day = Number(f.ads_per_day);
  if (f.roas !== '') p.roas = Number(f.roas);
  if (f.aov !== '' && Number(f.aov) > 0) p.aov = Number(f.aov);
  if (f.cogs_pct !== '') p.cogs_rate = Number(f.cogs_pct) / 100;
  if (f.revenue_month !== '' && Number(f.revenue_month) > 0) p.revenue_month = Number(f.revenue_month);
  const ev = f.extra_variable_costs
    .map((vc) => ({ name: vc.name, kind: vc.kind, amount: vc.kind === 'per_order' ? Number(vc.amount) || 0 : 0, percentage: vc.kind === 'percent' ? Number(vc.percentage) || 0 : 0, applies_to: vc.applies_to }))
    .filter((vc) => (vc.kind === 'percent' ? vc.percentage > 0 : vc.amount > 0));
  if (ev.length) p.extra_variable_costs = ev;
  const ef = f.extra_fixed_costs.map((fc) => ({ name: fc.name, amount: Number(fc.amount) || 0 })).filter((fc) => fc.amount > 0);
  if (ef.length) p.extra_fixed_costs = ef;
  if (f.exclude_variable_cost_ids.length) p.exclude_variable_cost_ids = f.exclude_variable_cost_ids;
  if (f.exclude_fixed_cost_ids.length) p.exclude_fixed_cost_ids = f.exclude_fixed_cost_ids;
  return p;
};

// ─── "A dónde va cada peso" (compacto) ───
function WherePesoGoes({ result }) {
  const r = result;
  const revenue = Math.max(r.revenue || 0, 0);
  const share = (v) => (revenue ? Math.max(0, v || 0) / revenue : 0);
  const parts = [
    { key: 'cogs', label: 'Producto', value: r.cogs, color: COLORS.cogs },
    { key: 'ads', label: 'Pauta', value: r.ads_month, color: COLORS.ads },
    { key: 'variable', label: 'Variables', value: r.variable_costs, color: COLORS.variable },
    { key: 'fixed', label: 'Fijos', value: r.fixed_costs, color: COLORS.fixed },
  ];
  const positive = (r.net_profit || 0) >= 0;
  const costShare = parts.reduce((a, p) => a + share(p.value), 0);
  const scale = costShare > 1 ? 1 / costShare : 1;
  if (!revenue) return <p className="text-xs text-gray-400">Sin venta proyectada no hay desglose.</p>;
  return (
    <div className="text-[12px]">
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex gap-[2px]">
        {parts.filter((p) => share(p.value) > 0).map((p) => (
          <span key={p.key} title={p.label} style={{ width: `${share(p.value) * scale * 100}%`, background: p.color }} className="h-full" />
        ))}
        {positive && share(r.net_profit) > 0 && <span style={{ width: `${share(r.net_profit) * 100}%`, background: COLORS.profit }} className="h-full" />}
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-2 text-gray-600">
            <span className="inline-flex items-center gap-2 min-w-0"><span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: p.color }} /><span className="truncate">{p.label}</span></span>
            <span className="tabular-nums whitespace-nowrap"><span className="text-[var(--ink)] font-medium">{fmtMoney(p.value)}</span><span className="text-gray-400 ml-2 inline-block w-11 text-right">{fmtPct(share(p.value), 0)}</span></span>
          </li>
        ))}
        <li className={`flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 font-semibold ${positive ? 'text-[var(--accent-deep)]' : 'text-[#dc2626]'}`}>
          <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-[2px]" style={{ background: positive ? COLORS.profit : COLORS.loss }} />{positive ? 'Utilidad' : 'Pérdida'}</span>
          <span className="tabular-nums whitespace-nowrap">{fmtMoney(r.net_profit)}<span className="ml-2 inline-block w-11 text-right opacity-80">{fmtPct(r.margin, 0)}</span></span>
        </li>
      </ul>
    </div>
  );
}

// ─── Constructor ───
function Builder({ mode, scenario, baseline, data, period, api, onSaved, onCancel }) {
  const [form, setForm] = useState(() => (scenario ? formFromScenario(scenario, { duplicate: mode === 'duplicate' }) : emptyForm()));
  const [result, setResult] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const params = useMemo(() => paramsFromForm(form), [form]);
  const paramsKey = JSON.stringify(params);

  // Evaluación en vivo con debounce
  const reqSeq = useRef(0);
  useEffect(() => {
    const seq = ++reqSeq.current;
    setEvaluating(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.evaluate({ period, params: JSON.parse(paramsKey) });
        if (seq === reqSeq.current) { setResult(r.scenario); setEvalError(null); }
      } catch (err) {
        if (seq === reqSeq.current) setEvalError(errText(err, 'No pudimos calcular el escenario.'));
      } finally {
        if (seq === reqSeq.current) setEvaluating(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [paramsKey, period, api]);

  const base = baseline || {};
  const baseAds = base.assumptions?.ads_per_day || 0;
  const adsBase = baseAds > 0 ? baseAds : 50000;
  const adsChips = [
    { label: baseAds > 0 ? 'Actual' : 'Sin cambio', value: '' },
    { label: '+50 %', value: Math.round(adsBase * 1.5) },
    { label: '×2', value: Math.round(adsBase * 2) },
    { label: '×3', value: Math.round(adsBase * 3) },
  ];
  const activeVariable = (data?.variable_costs?.items || []).filter((vc) => vc.is_active !== false);
  const fixedItems = data?.fixed_costs?.items || [];
  const toggleId = (k, id) => setForm((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }));

  const addVariable = () => setForm((f) => ({ ...f, extra_variable_costs: [...f.extra_variable_costs, { key: nextKey(), name: '', kind: 'per_order', amount: '', percentage: '', applies_to: 'revenue' }] }));
  const addFixed = () => setForm((f) => ({ ...f, extra_fixed_costs: [...f.extra_fixed_costs, { key: nextKey(), name: '', amount: '' }] }));
  const updateRow = (k, key, patch) => setForm((f) => ({ ...f, [k]: f[k].map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const removeRow = (k, key) => setForm((f) => ({ ...f, [k]: f[k].filter((r) => r.key !== key) }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setSaveError('Ponle un nombre al escenario.'); return; }
    setSaving(true); setSaveError(null);
    try {
      const body = { name: form.name.trim(), description: form.description.trim() || null, visibility: form.visibility, params, period };
      const saved = mode === 'edit' && scenario?.id ? await api.update(scenario.id, body) : await api.create(body);
      onSaved(saved, mode);
    } catch (err) {
      setSaveError(errText(err, 'No pudimos guardar el escenario.'));
    } finally {
      setSaving(false);
    }
  };

  const r = result;
  const diff = r && base.net_profit !== undefined ? r.net_profit - base.net_profit : null;
  const canChangeVisibility = mode !== 'edit' || scenario?.is_mine !== false;

  return (
    <form onSubmit={save} className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm text-[var(--ink)] inline-flex items-center gap-1.5"><SlidersHorizontal className="w-4 h-4" />{mode === 'edit' ? 'Editar escenario' : 'Nuevo escenario'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Lo que dejes vacío toma el valor real de {monthLabel(period)}. Todo sin IVA, sobre venta neta.</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg shrink-0" aria-label="Cerrar"><X className="w-4 h-4 text-gray-500" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-5">
        {/* Supuestos */}
        <div className="lg:col-span-3 space-y-5 min-w-0">
          <div>
            <Field label="Inversión en pauta por día" info="Lo que invertirías cada día del mes en Meta, Google y TikTok. Hoy el real es lo que ves como 'Actual'.">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {adsChips.map((c) => (
                  <button key={c.label} type="button" onClick={() => set('ads_per_day')(c.value)} className={chipCls(form.ads_per_day === c.value)} title={c.value === '' ? `${fmtMoney(baseAds)}/día` : `${fmtMoney(c.value)}/día`}>{c.label}</button>
                ))}
              </div>
              <MoneyInput value={form.ads_per_day} onChange={set('ads_per_day')} placeholder={baseAds > 0 ? `${fmtInput(baseAds)} (actual)` : 'Ej: 1.500.000'} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="ROAS esperado" info="Pesos vendidos por cada peso de pauta. Por defecto, el ROAS real del mes. A más inversión normalmente baja.">
              <DecInput value={form.roas} onChange={set('roas')} placeholder={base.assumptions?.roas ? `${Number(base.assumptions.roas).toFixed(2)} (actual)` : '3.0'} suffix="×" />
            </Field>
            <Field label="Ticket promedio" info="Venta neta por pedido. Sirve para derivar los pedidos (venta ÷ ticket) y con ellos los costos por pedido.">
              <MoneyInput value={form.aov} onChange={set('aov')} placeholder={base.assumptions?.aov ? `${fmtInput(base.assumptions.aov)} (actual)` : '150.000'} />
            </Field>
            <Field label="% costo de producto" info="Qué parte de cada peso vendido se va en la mercancía. Por defecto, el % real del mes. Bájalo para simular mejor margen.">
              <DecInput value={form.cogs_pct} onChange={set('cogs_pct')} placeholder={base.assumptions?.cogs_rate !== undefined ? `${(base.assumptions.cogs_rate * 100).toFixed(1)} (actual)` : '35'} suffix="%" />
            </Field>
          </div>

          <Field label="Meta de venta del mes (opcional)" info="Si la defines, manda sobre pauta × ROAS: el escenario responde '¿cómo queda el P&L si vendo esto?'." hint={form.revenue_month !== '' ? 'Con meta de venta, el ROAS se recalcula como venta ÷ pauta.' : null}>
            <MoneyInput value={form.revenue_month} onChange={set('revenue_month')} placeholder="Ej: 80.000.000" />
          </Field>

          {/* Costos variables */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="flex items-center gap-1 text-xs font-medium text-gray-600">Costos variables <Info text="Lo que se paga por cada venta o pedido: pasarela, envío, empaque. Desmarca los actuales para quitarlos del escenario o agrega nuevos." /></span>
              <button type="button" onClick={addVariable} className="text-xs text-gray-500 hover:text-[var(--ink)] inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
            </div>
            {activeVariable.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {activeVariable.map((vc) => {
                  const on = !form.exclude_variable_cost_ids.includes(vc.id);
                  const desc = vc.kind === 'per_order' ? `${fmtMoney(vc.amount_per_order)}/pedido` : vc.kind === 'per_unit' ? `${fmtMoney(vc.amount_per_order)}/unidad` : vc.kind === 'monthly_fixed' ? `${fmtMoney(vc.amount_per_order)}/mes` : `${String(vc.percentage).replace('.', ',')} %`;
                  return (
                    <button key={vc.id} type="button" onClick={() => toggleId('exclude_variable_cost_ids', vc.id)} className={`${chipCls(on)} ${on ? '' : 'line-through opacity-70'} inline-flex items-center gap-1`} title={on ? 'Clic para quitar del escenario' : 'Clic para volver a incluir'}>
                      {on && <Check className="w-3 h-3" />}{vc.name} <span className="opacity-70">{desc}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="space-y-2">
              {form.extra_variable_costs.map((vc) => (
                <div key={vc.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_1fr_auto] gap-2 items-center">
                  <input className="input w-full" placeholder="Ej: Envío" value={vc.name} onChange={(e) => updateRow('extra_variable_costs', vc.key, { name: e.target.value })} />
                  <button type="button" onClick={() => removeRow('extra_variable_costs', vc.key)} className="p-2 text-gray-400 hover:text-red-600 sm:order-last" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
                  <select className="input w-full" value={vc.kind} onChange={(e) => updateRow('extra_variable_costs', vc.key, { kind: e.target.value })}>
                    <option value="per_order">$ por pedido</option>
                    <option value="percent">% de la venta</option>
                  </select>
                  {vc.kind === 'per_order'
                    ? <MoneyInput value={vc.amount} onChange={(v) => updateRow('extra_variable_costs', vc.key, { amount: v })} placeholder="3.500" />
                    : (
                      <div className="flex gap-2">
                        <DecInput value={vc.percentage} onChange={(v) => updateRow('extra_variable_costs', vc.key, { percentage: v })} placeholder="2,9" suffix="%" className="flex-1" />
                        <select className="input w-auto" value={vc.applies_to} onChange={(e) => updateRow('extra_variable_costs', vc.key, { applies_to: e.target.value })} title="Sobre qué base">
                          <option value="revenue">de la venta neta</option>
                          <option value="gross_revenue">de la venta total pagada</option>
                          <option value="net_revenue">de venta − producto</option>
                        </select>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>

          {/* Costos fijos */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="flex items-center gap-1 text-xs font-medium text-gray-600">Costos fijos del mes <Info text="Fee, apps, nómina, arriendo: lo que se paga así no se venda nada. Desmarca los actuales o agrega nuevos (p. ej. un salario con prestaciones)." /></span>
              <button type="button" onClick={addFixed} className="text-xs text-gray-500 hover:text-[var(--ink)] inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
            </div>
            {fixedItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fixedItems.map((fc) => {
                  const on = !form.exclude_fixed_cost_ids.includes(fc.id);
                  return (
                    <button key={fc.id} type="button" onClick={() => toggleId('exclude_fixed_cost_ids', fc.id)} className={`${chipCls(on)} ${on ? '' : 'line-through opacity-70'} inline-flex items-center gap-1`} title={on ? 'Clic para quitar del escenario' : 'Clic para volver a incluir'}>
                      {on && <Check className="w-3 h-3" />}{fc.name} <span className="opacity-70">{fmtMoney(fc.amount)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="space-y-2">
              {form.extra_fixed_costs.map((fc) => (
                <div key={fc.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input className="input w-full" placeholder="Ej: Salario con prestaciones" value={fc.name} onChange={(e) => updateRow('extra_fixed_costs', fc.key, { name: e.target.value })} />
                  <button type="button" onClick={() => removeRow('extra_fixed_costs', fc.key)} className="p-2 text-gray-400 hover:text-red-600 sm:order-last" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
                  <MoneyInput value={fc.amount} onChange={(v) => updateRow('extra_fixed_costs', fc.key, { amount: v })} placeholder="3.000.000" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado en vivo */}
        <div className="lg:col-span-2 min-w-0">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-gray-500 inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Mes completo proyectado</span>
              {evaluating && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>
            {evalError ? (
              <p className="text-xs text-red-600 mt-3 inline-flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{evalError}</p>
            ) : !r ? (
              <div className="py-10 text-center text-xs text-gray-400">Calculando…</div>
            ) : (
              <>
                <div className="mt-2">
                  <div className="text-[11px] text-gray-400">{r.net_profit >= 0 ? 'Utilidad neta' : 'Pérdida neta'}</div>
                  <div className={`text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${profitCls(r.net_profit)}`}>{fmtMoney(r.net_profit)}</div>
                  <div className="text-[12px] text-gray-500 mt-1 tabular-nums">
                    Margen {fmtPct(r.margin, 1)}
                    {diff !== null && <> · <span className={profitCls(diff)}>{signed(diff)}</span> vs hoy</>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-4 text-[12px]">
                  <div><div className="text-[10px] text-gray-400">Pauta del mes</div><div className="font-semibold tabular-nums text-[var(--ink)]">{fmtMoney(r.ads_month)}</div></div>
                  <div><div className="text-[10px] text-gray-400">Venta neta</div><div className="font-semibold tabular-nums text-[var(--ink)]">{fmtMoney(r.revenue)}</div></div>
                  <div><div className="text-[10px] text-gray-400">Pedidos</div><div className="font-semibold tabular-nums text-[var(--ink)]">{fmtInt(Math.round(r.orders))}</div></div>
                  <div><div className="text-[10px] text-gray-400">ROAS</div><div className="font-semibold tabular-nums text-[var(--ink)]">{fmtX(r.roas)}</div></div>
                  <div><div className="text-[10px] text-gray-400 inline-flex items-center gap-1">BE ROAS <Info text="ROAS a partir del cual la pauta deja plata (1 ÷ margen de contribución). Depende del margen, no de cuánto inviertes." align="left" /></div><div className="font-semibold tabular-nums text-[var(--ink)]">{fmtX(r.be_roas)}</div></div>
                  <div><div className="text-[10px] text-gray-400 inline-flex items-center gap-1">ROAS necesario <Info text="El ROAS que necesitas para quedar en cero contando los fijos, con esa inversión." align="right" /></div><div className="font-semibold tabular-nums text-[var(--ink)]">{fmtX(r.roas_target)}</div></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 text-[12px] text-gray-600">
                  Para quedar en cero necesitas vender <strong className="text-[var(--ink)] tabular-nums">{fmtMoney(r.revenue_break_even)}</strong> en el mes
                  {r.reachable && r.revenue > 0 && <span className="text-gray-400"> ({r.revenue >= r.revenue_break_even ? 'lo superas' : `te faltan ${fmtMoney(r.revenue_break_even - r.revenue)}`})</span>}
                  <Info text="(Pauta del mes + costos fijos) ÷ margen de contribución." className="ml-1" />
                </div>
                {!r.reachable && <p className="mt-2 text-[11px] text-red-600">Con ese costo de producto y esos variables no hay ROAS que alcance: cada venta cuesta más de lo que deja.</p>}

                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="text-[11px] font-medium text-gray-500 mb-2">A dónde va cada peso</div>
                  <WherePesoGoes result={r} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guardar */}
      <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nombre">
          <input className="input w-full" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="Ej: Pauta 1,5M/día con envío 3.500" required />
        </Field>
        <Field label="Descripción (opcional)">
          <input className="input w-full" value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="Qué pregunta responde este escenario" />
        </Field>
        <div className="sm:col-span-2">
          <span className="block text-xs font-medium text-gray-600 mb-1">Quién lo ve</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!canChangeVisibility} onClick={() => set('visibility')('shared')} className={`${chipCls(form.visibility === 'shared')} inline-flex items-center gap-1 disabled:opacity-50`}><Users className="w-3 h-3" /> Compartido</button>
            <button type="button" disabled={!canChangeVisibility} onClick={() => set('visibility')('private')} className={`${chipCls(form.visibility === 'private')} inline-flex items-center gap-1 disabled:opacity-50`}><Lock className="w-3 h-3" /> Privado</button>
            <span className="text-[11px] text-gray-400">{form.visibility === 'private' ? 'Privado = solo tú lo ves; ni la agencia ni nadie más.' : 'Compartido = lo ve todo el que tenga acceso a esta marca.'}</span>
          </div>
        </div>
        {saveError && <p className="sm:col-span-2 text-xs text-red-600">{saveError}</p>}
        <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost text-sm">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {mode === 'edit' ? 'Guardar cambios' : 'Guardar escenario'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Tarjetas ───
function ScenarioCard({ s, baseline, selected, selectable, onToggle, onEdit, onDuplicate, onDelete, deleting }) {
  const r = s.result || {};
  const diff = baseline ? r.net_profit - baseline.net_profit : null;
  return (
    <div className={`glass-solid rounded-2xl p-5 flex flex-col gap-3 transition ${selected ? 'ring-2 ring-[var(--accent)]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-[var(--ink)] truncate">{s.name}</h3>
          {s.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>}
        </div>
        <VisibilityChip visibility={s.visibility} className="shrink-0" />
      </div>
      <div>
        <div className="text-[11px] text-gray-400">Utilidad neta proyectada</div>
        <div className={`text-2xl font-bold tracking-tight tabular-nums ${profitCls(r.net_profit)}`}>{fmtMoney(r.net_profit)}</div>
        {diff !== null && <div className={`text-[11px] tabular-nums ${profitCls(diff)}`}>{signed(diff)} vs hoy</div>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div><div className="text-[10px] text-gray-400">Pauta / mes</div><div className="font-semibold tabular-nums text-[var(--ink)] truncate">{fmtMoney(r.ads_month)}</div></div>
        <div><div className="text-[10px] text-gray-400">ROAS</div><div className="font-semibold tabular-nums text-[var(--ink)]">{fmtX(r.roas)}</div></div>
        <div><div className="text-[10px] text-gray-400">Venta</div><div className="font-semibold tabular-nums text-[var(--ink)] truncate">{fmtMoney(r.revenue)}</div></div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 mt-auto">
        <label className={`inline-flex items-center gap-1.5 text-[11px] ${selectable || selected ? 'text-gray-600 cursor-pointer' : 'text-gray-300'}`}>
          <input type="checkbox" checked={selected} disabled={!selectable && !selected} onChange={onToggle} className="accent-[var(--ink)]" /> Comparar
        </label>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-[var(--ink)] rounded-lg hover:bg-gray-100" title="Duplicar" aria-label="Duplicar"><Copy className="w-4 h-4" /></button>
          {s.can_edit !== false && <button type="button" onClick={onEdit} className="p-1.5 text-gray-400 hover:text-[var(--ink)] rounded-lg hover:bg-gray-100" title="Editar" aria-label="Editar"><Pencil className="w-4 h-4" /></button>}
          {s.can_edit !== false && <button type="button" onClick={onDelete} disabled={deleting} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50" title="Borrar" aria-label="Borrar">{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>}
        </div>
      </div>
      {s.owner_name && <div className="text-[10px] text-gray-400 -mt-1">por {s.owner_name}</div>}
    </div>
  );
}

function BaselineCard({ baseline, period }) {
  const r = baseline || {};
  return (
    <div className="rounded-2xl p-5 bg-[var(--dark)] text-white flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Hoy (real)</h3>
          <p className="text-[11px] text-white/50 mt-0.5">{monthLabel(period)} al ritmo actual{r.days_elapsed ? ` · ${r.days_elapsed} de ${r.days_in_month} días` : ''}</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[var(--accent)] text-white">Base</span>
      </div>
      <div>
        <div className="text-[11px] text-white/50">Utilidad neta proyectada</div>
        <div className={`text-2xl font-bold tracking-tight tabular-nums ${r.net_profit < 0 ? 'text-red-400' : 'text-[var(--accent)]'}`}>{fmtMoney(r.net_profit)}</div>
        <div className="text-[11px] text-white/50 tabular-nums">Margen {fmtPct(r.margin, 1)}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div><div className="text-[10px] text-white/50">Pauta / mes</div><div className="font-semibold tabular-nums truncate">{fmtMoney(r.ads_month)}</div></div>
        <div><div className="text-[10px] text-white/50">ROAS</div><div className="font-semibold tabular-nums">{fmtX(r.roas)}</div></div>
        <div><div className="text-[10px] text-white/50">Venta</div><div className="font-semibold tabular-nums truncate">{fmtMoney(r.revenue)}</div></div>
      </div>
      <div className="text-[11px] text-white/50 pt-2 border-t border-white/10 mt-auto">BE ROAS {fmtX(r.be_roas)} · ROAS necesario {fmtX(r.roas_target)}</div>
    </div>
  );
}

// ─── Comparación ───
const COMPARE_ROWS = [
  { key: 'ads_month', label: 'Inversión en pauta', fmt: fmtMoney, good: 'none' },
  { key: 'revenue', label: 'Venta neta', fmt: fmtMoney, good: 'up' },
  { key: 'orders', label: 'Pedidos', fmt: (v) => fmtInt(Math.round(v)), good: 'up' },
  { key: 'cogs', label: 'Costo de producto', fmt: fmtMoney, good: 'down' },
  { key: 'variable_costs', label: 'Costos variables', fmt: fmtMoney, good: 'down' },
  { key: 'fixed_costs', label: 'Costos fijos', fmt: fmtMoney, good: 'down' },
  { key: 'net_profit', label: 'Utilidad neta', fmt: fmtMoney, good: 'up', bold: true },
  { key: 'margin', label: 'Margen neto', fmt: (v) => fmtPct(v, 1), good: 'up', pct: true },
  { key: 'be_roas', label: 'BE ROAS', fmt: fmtX, good: 'down', x: true },
  { key: 'roas_target', label: 'ROAS necesario', fmt: fmtX, good: 'down', x: true },
];
const fmtDiff = (row, a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const d = a - b;
  if (Math.abs(d) < (row.pct ? 0.0005 : row.x ? 0.005 : 0.5)) return { text: '=', cls: 'text-gray-400' };
  const text = row.pct ? `${d > 0 ? '+' : '−'}${(Math.abs(d) * 100).toFixed(1).replace('.', ',')} pp` : row.x ? `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2).replace('.', ',')}` : signed(Math.round(d));
  const cls = row.good === 'none' ? 'text-gray-400' : (row.good === 'up' ? d > 0 : d < 0) ? 'text-[var(--accent-deep)]' : 'text-[#dc2626]';
  return { text, cls };
};

function CompareTable({ baseline, scenarios, loading, onClear }) {
  const cols = scenarios || [];
  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm text-[var(--ink)] inline-flex items-center gap-1.5"><GitCompare className="w-4 h-4" /> Comparación</h2>
          <p className="text-xs text-gray-400 mt-0.5">Mes completo proyectado. Las diferencias son contra "Hoy (real)".</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button type="button" onClick={onClear} className="text-xs text-gray-500 hover:text-[var(--ink)]">Limpiar</button>
        </div>
      </div>
      <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0 mt-4">
        <table className="w-full text-[12px] min-w-[560px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-400">
              <th className="text-left font-medium py-2 pr-3 sticky left-0 bg-[rgb(var(--surface-rgb)/0.95)] backdrop-blur">Concepto</th>
              <th className="text-right font-medium py-2 px-3">Hoy (real)</th>
              {cols.map((s) => (
                <th key={s.id} className="text-right font-medium py-2 px-3 max-w-[180px]">
                  <span className="block truncate normal-case tracking-normal text-[var(--ink)] text-[12px]">{s.name}</span>
                  <VisibilityChip visibility={s.visibility} className="mt-0.5" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const b = baseline?.[row.key];
              return (
                <tr key={row.key} className={`border-t border-gray-100 ${row.bold ? 'font-semibold' : ''}`}>
                  <td className={`py-2.5 pr-3 sticky left-0 bg-[rgb(var(--surface-rgb)/0.95)] backdrop-blur ${row.bold ? 'text-[var(--ink)]' : 'text-gray-600'}`}>{row.label}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap ${row.key === 'net_profit' ? profitCls(b) : 'text-[var(--ink)]'}`}>{row.fmt(b)}</td>
                  {cols.map((s) => {
                    const v = s.result?.[row.key];
                    const d = fmtDiff(row, v, b);
                    return (
                      <td key={s.id} className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className={row.key === 'net_profit' ? profitCls(v) : 'text-[var(--ink)]'}>{row.fmt(v)}</div>
                        {d && <div className={`text-[10px] font-normal ${d.cls}`}>{d.text}</div>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pestaña ───
export default function ScenariosTab({ clientId, period, data, api }) {
  const [list, setList] = useState(null); // { period, baseline, scenarios }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [builder, setBuilder] = useState(null); // { mode: 'create'|'edit'|'duplicate', scenario? }
  const [compareIds, setCompareIds] = useState([]);
  const [compare, setCompare] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const topRef = useRef(null);

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice(null), 3500); };

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const r = await api.list({ period });
      setList(r);
    } catch (err) {
      setError(errText(err, 'No pudimos cargar los escenarios.'));
    } finally {
      setLoading(false);
    }
  }, [api, period]);

  useEffect(() => { setCompareIds([]); setCompare(null); setBuilder(null); load(); }, [load, clientId]);

  // Comparación: hasta 3 escenarios contra "Hoy (real)"
  useEffect(() => {
    if (!compareIds.length) { setCompare(null); return undefined; }
    let cancelled = false;
    setComparing(true);
    api.compare(compareIds, period)
      .then((r) => { if (!cancelled) setCompare(r); })
      .catch((err) => { if (!cancelled) flash(errText(err, 'No pudimos comparar.')); })
      .finally(() => { if (!cancelled) setComparing(false); });
    return () => { cancelled = true; };
  }, [compareIds, period, api]);

  const toggleCompare = (id) => setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 3 ? ids : [...ids, id]));

  const openBuilder = (mode, scenario = null) => {
    setBuilder({ mode, scenario });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const handleSaved = async (saved, mode) => {
    setBuilder(null);
    flash(mode === 'edit' ? 'Escenario actualizado.' : `Escenario "${saved?.name || ''}" guardado.`);
    await load({ silent: true });
  };
  const handleDelete = async (s) => {
    if (!window.confirm(`¿Borrar el escenario "${s.name}"?`)) return;
    setDeletingId(s.id);
    try {
      await api.remove(s.id);
      setCompareIds((ids) => ids.filter((x) => x !== s.id));
      flash('Escenario borrado.');
      await load({ silent: true });
    } catch (err) {
      flash(errText(err, 'No pudimos borrar el escenario.'));
    } finally {
      setDeletingId(null);
    }
  };

  const baseline = list?.baseline || null;
  const scenarios = list?.scenarios || [];

  if (loading && !list) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>;
  }
  if (error && !list) {
    return (
      <div className="glass-solid rounded-2xl p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-gray-600">{error}</p>
        <button type="button" onClick={() => load()} className="btn-primary text-sm mt-4">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" ref={topRef}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base text-[var(--ink)] inline-flex items-center gap-1.5">
            Escenarios
            <Info text="Simula el mes completo cambiando pauta, ROAS, ticket, margen o costos, y guárdalo con nombre para compararlo después. Nada de esto cambia los datos reales." />
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">¿Y si invierto 1,5M vs 4M? ¿Y si pago 3.500 por envío? ¿Cuánto tengo que vender para quedar en cero? · {monthLabel(period)}</p>
        </div>
        {!builder && (
          <button type="button" onClick={() => openBuilder('create')} className="btn-primary text-sm inline-flex items-center justify-center gap-1.5 shrink-0"><Plus className="w-4 h-4" /> Nuevo escenario</button>
        )}
      </div>

      {notice && <div className="text-xs rounded-xl bg-[var(--dark)] text-white px-4 py-2.5 inline-flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[var(--accent)]" />{notice}</div>}

      {builder && (
        <Builder
          key={`${builder.mode}-${builder.scenario?.id || 'new'}`}
          mode={builder.mode} scenario={builder.scenario} baseline={baseline} data={data} period={period} api={api}
          onSaved={handleSaved} onCancel={() => setBuilder(null)}
        />
      )}

      {compareIds.length > 0 && (
        <CompareTable baseline={compare?.baseline || baseline} scenarios={compare?.scenarios || scenarios.filter((s) => compareIds.includes(s.id))} loading={comparing} onClear={() => setCompareIds([])} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <BaselineCard baseline={baseline} period={period} />
        {scenarios.map((s) => (
          <ScenarioCard
            key={s.id} s={s} baseline={baseline}
            selected={compareIds.includes(s.id)} selectable={compareIds.length < 3}
            onToggle={() => toggleCompare(s.id)}
            onEdit={() => openBuilder('edit', s)}
            onDuplicate={() => openBuilder('duplicate', s)}
            onDelete={() => handleDelete(s)}
            deleting={deletingId === s.id}
          />
        ))}
        {!scenarios.length && !builder && (
          <button type="button" onClick={() => openBuilder('create')} className="glass-solid rounded-2xl p-5 text-left border-2 border-dashed border-gray-200 hover:border-gray-400 transition flex flex-col justify-center gap-2 min-h-[180px]">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]"><Plus className="w-4 h-4" /> Crea tu primer escenario</span>
            <span className="text-xs text-gray-500">Por ejemplo: "Pauta 1,5M/día con envío a 3.500" o "Mejorar el margen al 60 %". Guárdalo compartido para que todos lo vean, o privado solo para ti.</span>
          </button>
        )}
      </div>
      {scenarios.length > 0 && <p className="text-[11px] text-gray-400">Marca "Comparar" en hasta 3 escenarios para verlos lado a lado contra "Hoy (real)".</p>}
    </div>
  );
}
