import { useCallback, useEffect, useState } from 'react';
import { PiggyBank, Plus, Trash2, Truck, Warehouse, Check, X, Settings2, Pencil } from 'lucide-react';
import { growthAPI } from '../../../utils/api';
import { fmtMoney, fmtInt } from './format';

const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—');
const KIND_LABEL = { per_order: 'por pedido', per_unit: 'por unidad vendida', percent: '% de la venta', monthly_fixed: 'fijo al mes' };
const ruleLabel = (r) => (r.kind === 'percent' ? `${r.percentage}% de la venta` : `${fmtMoney(r.amount)} ${KIND_LABEL[r.kind] || ''}`);
const providerIcon = (name) => (/coordinadora|transport|env[ií]o|servientrega|interrapid/i.test(name) ? Truck : Warehouse);

/**
 * Pestaña Reservas: cuánto ir guardando cada mes para proveedores que se pagan después
 * (transportadora, 3PL…). Las tarifas son costos variables marcados con el proveedor.
 */
export default function ReservesTab({ clientId, period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payForm, setPayForm] = useState(null); // { provider, amount, paid_at, notes }
  const [ruleForm, setRuleForm] = useState(null); // { provider, name, kind, amount, percentage, id? }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await growthAPI.getReserves(clientId, period);
      setData(res.data); setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudieron cargar las reservas');
    } finally { setLoading(false); }
  }, [clientId, period]);
  useEffect(() => { load(); }, [load]);

  const savePayment = async () => {
    try {
      setSaving(true);
      await growthAPI.addReservePayment(clientId, { provider: payForm.provider, period, amount: Number(String(payForm.amount).replace(/[^\d]/g, '')), paid_at: payForm.paid_at, notes: payForm.notes || undefined });
      setPayForm(null); await load({ silent: true });
    } catch (e) { alert(e.response?.data?.error || 'No se pudo registrar el pago'); } finally { setSaving(false); }
  };
  const removePayment = async (p) => {
    if (!confirm(`¿Borrar el pago de ${fmtMoney(p.amount)} a ${p.provider}?`)) return;
    try { await growthAPI.deleteReservePayment(clientId, p.id); await load({ silent: true }); } catch (e) { alert(e.response?.data?.error || 'No se pudo borrar'); }
  };
  const saveRule = async () => {
    try {
      setSaving(true);
      const body = {
        category: 'Logística', name: ruleForm.name || ruleForm.provider, kind: ruleForm.kind,
        percentage: ruleForm.kind === 'percent' ? Number(ruleForm.percentage) : 0,
        amount: ruleForm.kind === 'percent' ? null : Number(String(ruleForm.amount).replace(/[^\d.]/g, '')),
        applies_to: 'revenue', reserve_provider: ruleForm.provider.trim(),
      };
      if (ruleForm.id) await growthAPI.updateVariableCost(clientId, ruleForm.id, body);
      else await growthAPI.createVariableCost(clientId, body);
      setRuleForm(null); await load({ silent: true });
    } catch (e) { alert(e.response?.data?.error || 'No se pudo guardar la tarifa'); } finally { setSaving(false); }
  };
  const renameProvider = async (p) => {
    const name = prompt('Nuevo nombre del proveedor (por ejemplo Servientrega, Interrapidísimo, TCC…):', p.provider);
    if (!name || name.trim() === p.provider) return;
    try { await growthAPI.renameReserveProvider(clientId, p.provider, name.trim()); await load({ silent: true }); } catch (e) { alert(e.response?.data?.error || 'No se pudo renombrar'); }
  };

  const removeRule = async (r) => {
    if (!confirm(`¿Quitar la tarifa "${r.name}"? Dejará de contarse en el P&L y en la reserva.`)) return;
    try { await growthAPI.deleteVariableCost(clientId, r.id); await load({ silent: true }); } catch (e) { alert(e.response?.data?.error || 'No se pudo borrar'); }
  };

  const t = data?.totals;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#121314] flex items-center gap-2"><PiggyBank className="w-4 h-4" /> Reservas para proveedores</h2>
          <p className="text-xs text-gray-500">Lo que se va acumulando este mes para pagar transportadora, 3PL y otros que cobran después. Las tarifas también cuentan como costos variables en el P&L.</p>
        </div>
        <button type="button" onClick={() => setRuleForm({ provider: '', name: '', kind: 'per_order', amount: '', percentage: '' })} className="btn-primary text-sm inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nueva tarifa</button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

      {t && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="glass-solid rounded-2xl p-4 ring-1 ring-sky-100"><p className="text-[11px] uppercase tracking-wide text-gray-500">Recaudado por envíos</p><p className="text-2xl font-bold text-[#121314] tabular-nums">{fmtMoney(data.base.shipping_collected)}</p><p className="text-xs text-gray-500 mt-1">{fmtMoney(data.base.shipping_per_order)} por pedido · lo que pagan los clientes de envío</p></div>
          <div className="glass-solid rounded-2xl p-4"><p className="text-[11px] uppercase tracking-wide text-gray-500">Acumulado del mes</p><p className="text-2xl font-bold text-[#121314] tabular-nums">{fmtMoney(t.accrued)}</p><p className="text-xs text-gray-500 mt-1">{data.days_elapsed} de {data.days_in_month} días · {fmtInt(data.base.orders)} pedidos · {fmtInt(data.base.units)} und.</p></div>
          <div className="glass-solid rounded-2xl p-4"><p className="text-[11px] uppercase tracking-wide text-gray-500">Proyección fin de mes</p><p className="text-2xl font-bold text-[#121314] tabular-nums">{fmtMoney(t.projected)}</p><p className="text-xs text-gray-500 mt-1">Al ritmo actual</p></div>
          <div className="glass-solid rounded-2xl p-4"><p className="text-[11px] uppercase tracking-wide text-gray-500">Ya pagado</p><p className="text-2xl font-bold text-[#121314] tabular-nums">{fmtMoney(t.paid)}</p><p className="text-xs text-gray-500 mt-1">{data.payments.length} pago{data.payments.length === 1 ? '' : 's'} registrados</p></div>
          <div className={`glass-solid rounded-2xl p-4 ${t.pending > 0 ? 'ring-1 ring-amber-200' : ''}`}><p className="text-[11px] uppercase tracking-wide text-gray-500">Pendiente por guardar</p><p className={`text-2xl font-bold tabular-nums ${t.pending > 0 ? 'text-amber-700' : 'text-[#121314]'}`}>{fmtMoney(t.pending)}</p><p className="text-xs text-gray-500 mt-1">Acumulado menos pagado</p></div>
        </div>
      )}

      {loading && !data ? <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p> : (data?.providers || []).length === 0 ? (
        <div className="glass-solid rounded-2xl p-8 text-center">
          <PiggyBank className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">Aún no hay tarifas de proveedores</p>
          <p className="text-xs text-gray-500 mt-1">Crea una tarifa por proveedor: por ejemplo Coordinadora $X por pedido, o Simplistics $Y por pedido + $Z fijo al mes por almacenamiento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {data.providers.map((p) => {
            const Icon = providerIcon(p.provider);
            const pays = data.payments.filter((x) => x.provider === p.provider);
            return (
              <div key={p.provider} className="glass-solid rounded-2xl p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#121314] text-[#44BF47] flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#121314] truncate">{p.provider}</p>
                      <p className="text-[11px] text-gray-500">{fmtMoney(p.per_day)} / día · proyección {fmtMoney(p.projected)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => renameProvider(p)} className="p-1.5 text-gray-400 hover:text-[#121314] rounded-lg" title="Cambiar nombre del proveedor"><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setPayForm({ provider: p.provider, amount: '', paid_at: todayISO(), notes: '' })} className="btn-ghost text-xs inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Registrar pago</button>
                  </div>
                </div>
                {p.is_carrier && (
                  <div className={`mt-3 rounded-xl p-3 text-xs ${p.shipping_net >= 0 ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800'}`}>
                    Recaudado por envíos este mes: <strong>{fmtMoney(p.shipping_collected)}</strong>
                    {p.accrued > 0 ? <> · cubre el <strong>{Math.round((p.shipping_coverage || 0) * 100)}%</strong> de la reserva ({p.shipping_net >= 0 ? `sobran ${fmtMoney(p.shipping_net)}` : `faltan ${fmtMoney(-p.shipping_net)}`})</> : ' · define la tarifa para comparar contra la reserva'}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="rounded-xl bg-gray-50 p-2"><p className="text-[10px] uppercase text-gray-500">Acumulado</p><p className="font-bold tabular-nums text-sm">{fmtMoney(p.accrued)}</p></div>
                  <div className="rounded-xl bg-gray-50 p-2"><p className="text-[10px] uppercase text-gray-500">Pagado</p><p className="font-bold tabular-nums text-sm">{fmtMoney(p.paid)}</p></div>
                  <div className={`rounded-xl p-2 ${p.pending > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}><p className="text-[10px] uppercase text-gray-500">Por guardar</p><p className={`font-bold tabular-nums text-sm ${p.pending > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtMoney(p.pending)}</p></div>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Tarifas</p>
                  {p.rules.length === 0 ? <p className="text-xs text-gray-400">Sin tarifas (solo pagos registrados)</p> : (
                    <ul className="space-y-1">
                      {p.rules.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{r.name} <span className="text-gray-400">· {ruleLabel(r)}</span>{!r.is_active && <span className="text-gray-400"> · inactiva</span>}</span>
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <span className="tabular-nums text-gray-700">{fmtMoney(r.accrued)}</span>
                            <button type="button" onClick={() => setRuleForm({ id: r.id, provider: p.provider, name: r.name, kind: r.kind, amount: r.amount ?? '', percentage: r.percentage ?? '' })} className="p-1 text-gray-400 hover:text-[#121314]" title="Editar"><Settings2 className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => removeRule(r)} className="p-1 text-gray-400 hover:text-red-600" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {pays.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Pagos del mes</p>
                    <ul className="divide-y divide-gray-100">
                      {pays.map((x) => (
                        <li key={x.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="text-gray-600">{fmtDate(x.paid_at)}{x.notes ? ` · ${x.notes}` : ''}</span>
                          <span className="flex items-center gap-1"><span className="tabular-nums font-medium">{fmtMoney(x.amount)}</span><button type="button" onClick={() => removePayment(x)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {payForm && (
        <Modal title={`Registrar pago a ${payForm.provider}`} onClose={() => setPayForm(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label><input type="date" className="input w-full" value={payForm.paid_at} max={todayISO()} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Monto ($)</label><input type="text" inputMode="numeric" className="input w-full" placeholder="850.000" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nota</label><input type="text" className="input w-full" placeholder="Factura #…" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => setPayForm(null)} className="btn-ghost text-sm">Cancelar</button>
            <button type="button" onClick={savePayment} disabled={saving || !payForm.amount} className="btn-primary text-sm inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Guardar</button>
          </div>
        </Modal>
      )}

      {ruleForm && (
        <Modal title={ruleForm.id ? 'Editar tarifa' : 'Nueva tarifa de proveedor'} onClose={() => setRuleForm(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label><input list="reserve-providers" type="text" className="input w-full" placeholder="Coordinadora / Simplistics" value={ruleForm.provider} onChange={(e) => setRuleForm({ ...ruleForm, provider: e.target.value })} /><datalist id="reserve-providers">{(data?.providers || []).map((p) => <option key={p.provider} value={p.provider} />)}<option value="Coordinadora" /><option value="Simplistics" /></datalist></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre de la tarifa</label><input type="text" className="input w-full" placeholder="Envío por pedido / Picking / Almacenamiento" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} /></div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cómo cobra</label>
              <select className="input w-full" value={ruleForm.kind} onChange={(e) => setRuleForm({ ...ruleForm, kind: e.target.value })}>
                <option value="per_order">$ por pedido</option>
                <option value="per_unit">$ por unidad vendida</option>
                <option value="monthly_fixed">$ fijo al mes (almacenamiento)</option>
                <option value="percent">% de la venta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{ruleForm.kind === 'percent' ? 'Porcentaje' : 'Valor ($)'}</label>
              {ruleForm.kind === 'percent'
                ? <input type="number" min="0" step="0.1" className="input w-full" value={ruleForm.percentage} onChange={(e) => setRuleForm({ ...ruleForm, percentage: e.target.value })} />
                : <input type="text" inputMode="numeric" className="input w-full" placeholder="12.000" value={ruleForm.amount} onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })} />}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">La tarifa se guarda como costo variable del cliente (categoría Logística) y aparece también en el P&L.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => setRuleForm(null)} className="btn-ghost text-sm">Cancelar</button>
            <button type="button" onClick={saveRule} disabled={saving || !ruleForm.provider.trim() || (ruleForm.kind === 'percent' ? ruleForm.percentage === '' : ruleForm.amount === '')} className="btn-primary text-sm inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-[#121314]">{title}</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
