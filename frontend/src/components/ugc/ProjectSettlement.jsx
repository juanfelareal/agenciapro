import { useEffect, useState } from 'react';
import { Lock, Loader2, Plus, Trash2, CheckCircle2, RotateCcw, Save, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { ugcAPI } from '../../utils/api';

const cop = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const pct = (v) => `${(v || 0).toFixed(1)}%`;
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const CREATOR_STATUS = {
  presented: 'Presentado', brand_approved: 'Aprobado por marca', negotiating: 'Negociando', confirmed: 'Confirmado',
  contract_signed: 'Contrato firmado', rejected: 'Rechazado', producing: 'Produciendo', delivered_approved: 'Entregado',
  delivered_changes: 'Con cambios', paid: 'Pagado',
};

/**
 * Liquidación privada de un proyecto UGC.
 * Ingreso (lo cobrado a la marca) − costo de creadores (tarifa × videos) − producto − otros = utilidad.
 * Solo vive en el panel interno; el portal del cliente no consume este endpoint.
 */
export default function ProjectSettlement({ projectId, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ client_total: '', product_cost: '', extra_items: [], notes: '' });
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    try {
      const res = await ugcAPI.getProjectSettlement(projectId);
      setData(res.data);
      const s = res.data.settlement;
      setForm({
        client_total: s.client_total ?? '',
        product_cost: s.product_cost ?? '',
        extra_items: s.extra_items || [],
        notes: s.notes || '',
      });
      setDirty(false);
    } catch (e) {
      console.error('Error loading settlement:', e);
      setError('No se pudo cargar la liquidación');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [projectId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => { setForm(f => ({ ...f, ...patch })); setDirty(true); };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const res = await ugcAPI.saveProjectSettlement(projectId, form);
      setData(res.data); setDirty(false);
    } catch (e) { setError(e.response?.data?.error || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const settle = async () => {
    if (dirty) { await save(); }
    if (!confirm('¿Liquidar este proyecto?\n\nSe congelan los números actuales (ingreso, costos y utilidad). Podrás reabrirlo si algo cambia.')) return;
    setSaving(true); setError(null);
    try { const res = await ugcAPI.settleProject(projectId); setData(res.data); setDirty(false); }
    catch (e) { setError(e.response?.data?.error || 'No se pudo liquidar'); }
    finally { setSaving(false); }
  };

  const reopen = async () => {
    if (!confirm('¿Reabrir la liquidación? Los números volverán a calcularse en vivo.')) return;
    setSaving(true);
    try { const res = await ugcAPI.reopenProjectSettlement(projectId); setData(res.data); setDirty(false); }
    catch (e) { setError(e.response?.data?.error || 'No se pudo reabrir'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  if (!data) return error ? <p className="text-sm text-red-600">{error}</p> : null;

  const settled = data.settlement.status === 'settled';
  // When settled, show the frozen snapshot
  const t = settled && data.settlement.snapshot?.totals ? data.settlement.snapshot.totals : data.totals;
  const creators = settled && data.settlement.snapshot?.creators ? data.settlement.snapshot.creators : data.creators;
  const p = data.project;

  // Live preview of the form while editing (draft only)
  const preview = (() => {
    if (settled) return t;
    const revenue = form.client_total === '' ? data.totals.revenue_auto : (parseFloat(form.client_total) || 0);
    const productCost = form.product_cost === '' ? data.totals.product_cost_auto : (parseFloat(form.product_cost) || 0);
    const extra = form.extra_items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const totalCost = data.totals.creator_cost + productCost + extra;
    const profit = revenue - totalCost;
    return { ...data.totals, revenue, product_cost: productCost, extra_total: extra, total_cost: totalCost, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0 };
  })();

  const positive = preview.profit >= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5" /> Liquidación del proyecto
          </h2>
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <Lock className="w-3 h-3" /> Solo visible para el equipo. El cliente nunca ve esta sección ni lo que se paga a cada creador. Cuentan únicamente los creadores en estado "Pagado".
          </p>
        </div>
        <div className="flex items-center gap-2">
          {settled ? (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Liquidado {fmtDateTime(data.settlement.settled_at)}{data.settlement.settled_by_name ? ` · ${data.settlement.settled_by_name}` : ''}
              </span>
              <button onClick={reopen} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
                <RotateCcw className="w-3.5 h-3.5" /> Reabrir
              </button>
            </>
          ) : (
            <>
              {dirty && (
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
                </button>
              )}
              <button onClick={settle} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#17181A] text-white hover:bg-black disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Liquidar proyecto
              </button>
            </>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Ingreso (marca)</p>
          <p className="text-lg font-semibold text-gray-900">{cop(preview.revenue)}</p>
          <p className="text-[11px] text-gray-400">{p.video_count > 0 && p.price_per_video > 0 ? `${p.video_count} videos × ${cop(p.price_per_video)}` : 'Presupuesto del proyecto'}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Costo creadores</p>
          <p className="text-lg font-semibold text-gray-900">{cop(preview.creator_cost)}</p>
          <p className="text-[11px] text-gray-400">{preview.active_creators} pagados · {preview.videos_assigned} videos</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Otros costos</p>
          <p className="text-lg font-semibold text-gray-900">{cop(preview.product_cost + preview.extra_total)}</p>
          <p className="text-[11px] text-gray-400">Producto {cop(preview.product_cost)} · Extras {cop(preview.extra_total)}</p>
        </div>
        <div className={`rounded-xl p-3 ${positive ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className={`text-[11px] uppercase tracking-wider ${positive ? 'text-emerald-600' : 'text-red-600'}`}>Utilidad</p>
          <p className={`text-lg font-semibold inline-flex items-center gap-1 ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
            {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} {cop(preview.profit)}
          </p>
          <p className={`text-[11px] ${positive ? 'text-emerald-600' : 'text-red-600'}`}>Margen {pct(preview.margin)}</p>
        </div>
      </div>

      {/* Creators cost table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-2 text-left font-medium">Creador</th>
              <th className="px-3 py-2 text-left font-medium">Estado</th>
              <th className="px-3 py-2 text-right font-medium">Videos</th>
              <th className="px-3 py-2 text-right font-medium">Tarifa / video</th>
              <th className="px-3 py-2 text-right font-medium">Subtotal</th>
              <th className="px-3 py-2 text-center font-medium">Pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {creators.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">Sin creadores asignados</td></tr>
            )}
            {creators.map(c => (
              <tr key={c.id} className={c.excluded ? 'opacity-50' : ''}>
                <td className="px-3 py-2 font-medium text-gray-900">{c.full_name}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{CREATOR_STATUS[c.status] || c.status}{c.excluded ? (c.status === 'rejected' ? ' · no cuenta' : ' · sin pagar, no cuenta') : ''}</td>
                <td className="px-3 py-2 text-right text-gray-700">{c.video_count}</td>
                <td className="px-3 py-2 text-right text-gray-700">{c.agreed_rate > 0 ? cop(c.agreed_rate) : <span className="text-amber-600 text-xs">Sin tarifa</span>}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{cop(c.subtotal)}</td>
                <td className="px-3 py-2 text-center">
                  {c.excluded ? '—' : c.is_paid
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Pagado</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendiente</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {creators.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 text-xs font-medium text-gray-700 border-t border-gray-100">
                <td className="px-3 py-2" colSpan={2}>Total creadores</td>
                <td className="px-3 py-2 text-right">{preview.videos_assigned}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-gray-900">{cop(preview.creator_cost)}</td>
                <td className="px-3 py-2 text-center text-[10px] text-gray-500">Solo creadores pagados</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {p.video_count > 0 && preview.videos_assigned !== p.video_count && !settled && (
        <p className="text-xs text-amber-600 mb-4">
          Ojo: la marca compró {p.video_count} videos y solo {preview.videos_assigned} corresponden a creadores ya pagados. Marca como "Pagado" a cada creador cuando le pagues para que entre en la liquidación.
        </p>
      )}

      {/* Adjustments (draft only) */}
      {!settled && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block text-xs text-gray-500">
              Ingreso total cobrado a la marca
              <input
                type="number" min="0" value={form.client_total}
                onChange={(e) => set({ client_total: e.target.value })}
                placeholder={`Automático: ${cop(data.totals.revenue_auto)}`}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <span className="text-[11px] text-gray-400">Déjalo vacío para usar videos × precio por video (o el presupuesto).</span>
            </label>
            <label className="block text-xs text-gray-500">
              Costo de producto enviado a creadores
              <input
                type="number" min="0" value={form.product_cost}
                onChange={(e) => set({ product_cost: e.target.value })}
                placeholder={`Automático: ${cop(data.totals.product_cost_auto)}`}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <span className="text-[11px] text-gray-400">Automático = valor del producto × creadores activos. Pon 0 si el producto lo pone la marca.</span>
            </label>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Otros costos (envíos, edición, etc.)</span>
                <button onClick={() => set({ extra_items: [...form.extra_items, { label: '', amount: '' }] })} className="text-xs text-gray-600 hover:text-[#17181A] inline-flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>
              <div className="space-y-1.5">
                {form.extra_items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={it.label} onChange={(e) => set({ extra_items: form.extra_items.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder="Concepto" className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg" />
                    <input type="number" min="0" value={it.amount} onChange={(e) => set({ extra_items: form.extra_items.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })} placeholder="Valor" className="w-32 px-3 py-1.5 text-sm border border-gray-200 rounded-lg" />
                    <button onClick={() => set({ extra_items: form.extra_items.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                {form.extra_items.length === 0 && <p className="text-[11px] text-gray-400">Sin costos adicionales</p>}
              </div>
            </div>
            <label className="block text-xs text-gray-500">
              Notas internas
              <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y" placeholder="Acuerdos, descuentos, aclaraciones…" />
            </label>
          </div>
        </div>
      )}
      {settled && data.settlement.notes && (
        <p className="text-sm text-gray-600 whitespace-pre-wrap"><span className="text-xs text-gray-400">Notas: </span>{data.settlement.notes}</p>
      )}
      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
    </div>
  );
}
