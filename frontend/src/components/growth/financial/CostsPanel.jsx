import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Building2, Percent } from 'lucide-react';
import Info from './Info';
import { fmtMoney, fmtPctNum, categoryColor } from './format';

const FIXED_CATEGORIES = ['Fee agencia', 'Apps Shopify', 'Email marketing', 'Bodegaje', 'Nómina', 'Arriendo', 'Software', 'Otro'];
const VARIABLE_CATEGORIES = ['Pasarela de pago', 'Envío', 'Empaque', 'Comisión marketplace', 'Otro'];

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
  </label>
);

/** Modal para crear/editar un costo fijo o variable. */
export function CostModal({ type, item, onSave, onClose }) {
  const isFixed = type === 'fixed';
  const [form, setForm] = useState(() => ({
    category: item?.category || '',
    name: item?.name || '',
    amount: item?.amount ?? '',
    start_date: item?.start_date ? String(item.start_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    end_date: item?.end_date ? String(item.end_date).slice(0, 10) : '',
    kind: item?.kind || 'percent',
    percentage: item?.percentage ?? '',
    amount_per_order: item?.amount_per_order ?? '',
    applies_to: item?.applies_to || 'revenue',
    notes: item?.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (isFixed) {
        await onSave({ id: item?.id, category: form.category, name: form.name, amount: Number(form.amount), start_date: form.start_date, end_date: form.end_date || null, notes: form.notes || null });
      } else {
        await onSave({
          id: item?.id, category: form.category, name: form.name, kind: form.kind,
          percentage: form.kind === 'percent' ? Number(form.percentage) : 0,
          amount: form.kind === 'per_order' ? Number(form.amount_per_order) : null,
          applies_to: form.applies_to, notes: form.notes || null, is_active: item?.is_active === false ? 0 : 1,
        });
      }
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'No pudimos guardar.');
    } finally {
      setSaving(false);
    }
  };

  const categories = isFixed ? FIXED_CATEGORIES : VARIABLE_CATEGORIES;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[#17181A]">{item ? 'Editar' : 'Agregar'} costo {isFixed ? 'fijo' : 'variable'}</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Cerrar"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <select className="input" value={form.category} onChange={set('category')} required>
                <option value="">Seleccionar…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.category && !categories.includes(form.category) && <option value={form.category}>{form.category}</option>}
              </select>
            </Field>
            <Field label="Nombre">
              <input className="input" value={form.name} onChange={set('name')} placeholder={isFixed ? 'Ej: Klaviyo' : 'Ej: Wompi'} required />
            </Field>
          </div>

          {isFixed ? (
            <>
              <Field label="Monto mensual (COP, sin IVA)" hint="Se reparte entre los días del mes para calcular la utilidad diaria.">
                <input type="number" min="0" className="input tabular-nums" value={form.amount} onChange={set('amount')} placeholder="500000" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desde"><input type="date" className="input" value={form.start_date} onChange={set('start_date')} required /></Field>
                <Field label="Hasta (opcional)"><input type="date" className="input" value={form.end_date} onChange={set('end_date')} /></Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Cómo se cobra">
                <div className="inline-flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium w-full">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, kind: 'percent' }))} className={`flex-1 px-3 py-1.5 rounded-md transition ${form.kind === 'percent' ? 'bg-white text-[#17181A] shadow-sm' : 'text-gray-500'}`}>% de la venta</button>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, kind: 'per_order' }))} className={`flex-1 px-3 py-1.5 rounded-md transition ${form.kind === 'per_order' ? 'bg-white text-[#17181A] shadow-sm' : 'text-gray-500'}`}>$ por pedido</button>
                </div>
              </Field>
              {form.kind === 'percent' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Porcentaje" hint="Ej: 3,5 para una pasarela.">
                    <input type="number" step="0.01" min="0" className="input tabular-nums" value={form.percentage} onChange={set('percentage')} placeholder="3.5" required />
                  </Field>
                  <Field label="Aplica sobre">
                    <select className="input" value={form.applies_to} onChange={set('applies_to')}>
                      <option value="revenue">Venta neta</option>
                      <option value="net_revenue">Venta neta − costo de producto</option>
                    </select>
                  </Field>
                </div>
              ) : (
                <Field label="Valor por pedido (COP)" hint="Ej: 12.000 de envío o 2.500 de empaque por cada pedido.">
                  <input type="number" min="0" className="input tabular-nums" value={form.amount_per_order} onChange={set('amount_per_order')} placeholder="12000" required />
                </Field>
              )}
            </>
          )}

          <Field label="Notas (opcional)"><input className="input" value={form.notes} onChange={set('notes')} placeholder="Algo que ayude a recordar de dónde sale" /></Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost !py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary !py-2 text-sm">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ItemRow = ({ color, title, subtitle, right, rightSub, onEdit, onDelete, inactive }) => (
  <div className={`flex items-center gap-3 py-2.5 group ${inactive ? 'opacity-50' : ''}`}>
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-medium text-[#17181A] truncate">{title}</div>
      <div className="text-[11px] text-gray-400 truncate">{subtitle}</div>
    </div>
    <div className="text-right shrink-0">
      <div className="text-[13px] font-semibold text-[#17181A] tabular-nums">{right}</div>
      {rightSub && <div className="text-[11px] text-gray-400 tabular-nums">{rightSub}</div>}
    </div>
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
      <button type="button" onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Editar"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
      <button type="button" onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50" aria-label="Eliminar"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
    </div>
  </div>
);

const describeVariable = (vc) => {
  if (vc.kind === 'per_order') return `${fmtMoney(vc.amount_per_order)} por pedido`;
  return `${fmtPctNum(vc.percentage, vc.percentage % 1 ? 1 : 0)} ${vc.applies_to === 'net_revenue' ? 'de la venta neta − producto' : 'de la venta neta'}`;
};

/**
 * Costos fijos del mes (total mensual y por día) y costos variables (% o $ por pedido),
 * con lo que cada uno sumó en el mes. CRUD vía modal.
 */
export default function CostsPanel({ data, onAdd, onEdit, onDelete }) {
  const fixed = data?.fixed_costs || { items: [], all_items: [] };
  const variable = data?.variable_costs || { items: [] };
  const activeIds = new Set((fixed.items || []).map((i) => i.id));
  const fixedAll = fixed.all_items || fixed.items || [];
  const daysInMonth = data?.days_in_month || 30;
  const orders = data?.totals?.orders || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div className="glass-solid rounded-2xl p-5 sm:p-6 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-sm text-[#17181A]">Costos fijos</h2>
              <Info text="Lo que la marca paga cada mes venda o no venda: fee de agencia, apps, nómina, arriendo. Se prorratean por día." />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Mensuales, sin IVA. Vigentes según su fecha de inicio y fin.</p>
          </div>
          <button type="button" onClick={() => onAdd('fixed')} className="btn-primary !py-2 !px-3 text-xs shrink-0"><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-gray-50 px-3 py-2.5"><div className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Al mes</div><div className="text-base font-bold text-[#17181A] tabular-nums mt-0.5">{fmtMoney(fixed.monthly_total)}</div></div>
          <div className="rounded-xl bg-gray-50 px-3 py-2.5"><div className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Por día</div><div className="text-base font-bold text-[#17181A] tabular-nums mt-0.5">{fmtMoney(fixed.per_day)}</div></div>
          <div className="rounded-xl bg-gray-50 px-3 py-2.5"><div className="text-[10px] uppercase tracking-widest text-gray-400 font-medium inline-flex items-center gap-1">Este mes <Info text={`Por día × los ${data?.days_elapsed || 0} días transcurridos. Es lo que se resta en el P&L.`} /></div><div className="text-base font-bold text-[#17181A] tabular-nums mt-0.5">{fmtMoney(fixed.prorated)}</div></div>
        </div>
        <div className="mt-3 divide-y divide-gray-100">
          {fixedAll.length ? fixedAll.map((fc) => (
            <ItemRow
              key={fc.id}
              color={categoryColor(fc.category)}
              title={fc.name}
              subtitle={`${fc.category}${fc.end_date ? ` · hasta ${String(fc.end_date).slice(0, 10)}` : ''}${!activeIds.has(fc.id) ? ' · no aplica este mes' : ''}`}
              right={`${fmtMoney(fc.amount)} / mes`}
              rightSub={`${fmtMoney((fc.amount || 0) / daysInMonth)} / día`}
              inactive={!activeIds.has(fc.id)}
              onEdit={() => onEdit('fixed', fc)}
              onDelete={() => onDelete('fixed', fc)}
            />
          )) : (
            <p className="text-sm text-gray-400 text-center py-8">Sin costos fijos. Agrega el fee de agencia, apps y nómina para que la utilidad sea real.</p>
          )}
        </div>
      </div>

      <div className="glass-solid rounded-2xl p-5 sm:p-6 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-sm text-[#17181A]">Costos variables</h2>
              <Info text="Costos que crecen con cada venta o pedido: pasarela de pagos, envío, empaque. Se calculan sobre la venta neta y los pedidos del mes." />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Ejemplos: 3,5 % de pasarela, envío $12.000 por pedido.</p>
          </div>
          <button type="button" onClick={() => onAdd('variable')} className="btn-primary !py-2 !px-3 text-xs shrink-0"><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-gray-50 px-3 py-2.5"><div className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Este mes</div><div className="text-base font-bold text-[#17181A] tabular-nums mt-0.5">{fmtMoney(variable.total)}</div></div>
          <div className="rounded-xl bg-gray-50 px-3 py-2.5"><div className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Por pedido</div><div className="text-base font-bold text-[#17181A] tabular-nums mt-0.5">{orders ? fmtMoney((variable.total || 0) / orders) : '—'}</div></div>
        </div>
        <div className="mt-3 divide-y divide-gray-100">
          {variable.items?.length ? variable.items.map((vc) => (
            <ItemRow
              key={vc.id}
              color={categoryColor(vc.category)}
              title={vc.name}
              subtitle={`${vc.category} · ${describeVariable(vc)}${vc.is_active === false ? ' · inactivo' : ''}`}
              right={fmtMoney(vc.amount)}
              rightSub="este mes"
              inactive={vc.is_active === false}
              onEdit={() => onEdit('variable', vc)}
              onDelete={() => onDelete('variable', vc)}
            />
          )) : (
            <p className="text-sm text-gray-400 text-center py-8">Sin costos variables. La pasarela de pagos (≈ 3,5 %) y el envío por pedido son los más comunes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
