import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Plus, Trash2, Check } from 'lucide-react';
import { portalWhatsappSalesAPI } from '../../utils/portalApi';

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const fmtDate = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

/**
 * Portal del cliente: registrar lo que vendió por WhatsApp (no pasa por la tienda).
 * Se suma a las ventas totales y permite medir el ROAS de las campañas de WhatsApp.
 */
export default function PortalWhatsappSales({ startDate, endDate, summary, onChanged }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('day');
  const [form, setForm] = useState({ date: todayISO(), revenue: '', orders: '', start: startDate, end: endDate });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try { setData(await portalWhatsappSalesAPI.list({ start_date: startDate, end_date: endDate })); } catch { setData({ sales: [], summary: {} }); }
  }, [startDate, endDate]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setForm((f) => ({ ...f, start: startDate, end: endDate })); }, [startDate, endDate]);

  const total = useMemo(() => (data?.sales || []).reduce((t, r) => t + (Number(r.revenue) || 0), 0), [data]);

  const save = async () => {
    try {
      setSaving(true); setMsg(null);
      const clean = (v) => Number(String(v).replace(/[^\d]/g, ''));
      if (mode === 'day') await portalWhatsappSalesAPI.save({ date: form.date, revenue: clean(form.revenue), orders: Number(form.orders) || 0 });
      else await portalWhatsappSalesAPI.save({ start_date: form.start, end_date: form.end, revenue: clean(form.revenue), orders: Number(form.orders) || 0 });
      setForm((f) => ({ ...f, revenue: '', orders: '' }));
      setMsg({ ok: true, text: 'Registrado. Ya cuenta en tus ventas totales.' });
      await load(); onChanged?.();
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'No se pudo guardar' });
    } finally { setSaving(false); }
  };

  const remove = async (d) => {
    if (!confirm(`¿Borrar el registro del ${fmtDate(d)}?`)) return;
    try { await portalWhatsappSalesAPI.remove(d); await load(); onChanged?.(); } catch (e) { alert(e.response?.data?.error || 'No se pudo borrar'); }
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-gray-100 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-emerald-700" /></div>
          <div>
            <h3 className="font-semibold text-[var(--ink)]">Ventas por WhatsApp</h3>
            <p className="text-xs text-gray-500">Registra aquí lo que cierras por chat para que sume en tus reportes y mida el retorno de la pauta de WhatsApp.</p>
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--dark)] text-[var(--accent)] text-sm font-medium">
          <Plus className="w-4 h-4" /> Registrar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Venta WhatsApp del periodo</p>
          <p className="text-xl font-bold text-[var(--ink)] tabular-nums">{money(summary?.revenue ?? total)}</p>
          <p className="text-[11px] text-gray-500">{summary?.orders ?? (data?.sales || []).reduce((t, r) => t + (Number(r.orders) || 0), 0)} pedidos</p>
        </div>
        {summary && (
          <>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Pauta de WhatsApp</p>
              <p className="text-xl font-bold text-[var(--ink)] tabular-nums">{money(summary.ad_spend)}</p>
              <p className="text-[11px] text-gray-500">ROAS WhatsApp {summary.roas ? `${summary.roas.toFixed(2).replace('.', ',')}x` : '—'}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Venta total (web + WhatsApp)</p>
              <p className="text-xl font-bold text-[var(--ink)] tabular-nums">{money(summary.total_revenue)}</p>
              <p className="text-[11px] text-gray-500">ROAS total {summary.roas_total ? `${summary.roas_total.toFixed(2).replace('.', ',')}x` : '—'} · web {summary.roas_web ? `${summary.roas_web.toFixed(2).replace('.', ',')}x` : '—'}</p>
            </div>
          </>
        )}
      </div>

      {open && (
        <div className="mt-4 border border-gray-100 rounded-xl p-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3 w-full sm:w-fit">
            <button onClick={() => setMode('day')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'day' ? 'bg-[var(--surface)] shadow-sm text-gray-900' : 'text-gray-500'}`}>Un día</button>
            <button onClick={() => setMode('bulk')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'bulk' ? 'bg-[var(--surface)] shadow-sm text-gray-900' : 'text-gray-500'}`}>Semana o mes completo</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {mode === 'day' ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input type="date" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                  <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                  <input type="date" value={form.end} max={todayISO()} onChange={(e) => setForm({ ...form, end: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{mode === 'day' ? 'Venta ($)' : 'Venta total ($)'}</label>
              <input type="text" inputMode="numeric" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} placeholder="1.250.000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pedidos</label>
              <input type="number" min="0" value={form.orders} onChange={(e) => setForm({ ...form, orders: e.target.value })} placeholder="8" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
            {msg ? <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p> : <p className="text-xs text-gray-400">{mode === 'bulk' ? 'El total se reparte parejo entre los días.' : 'Si ya existe un registro para esa fecha, se reemplaza.'}</p>}
            <button onClick={save} disabled={saving || !form.revenue} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--dark)] text-[var(--accent)] text-sm font-medium disabled:opacity-50">
              <Check className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {(data?.sales || []).length > 0 && (
        <div className="mt-4 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {data.sales.slice(0, 31).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <p className="font-medium text-gray-900 capitalize">{fmtDate(r.date)} <span className="text-gray-400 font-normal">· {r.orders || 0} ped.</span></p>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{money(r.revenue)}</span>
                <button onClick={() => remove(r.date)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg" title="Borrar"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
