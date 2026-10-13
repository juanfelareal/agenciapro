import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Plus, Trash2, RefreshCw, X, Check, Globe, SlidersHorizontal, Info } from 'lucide-react';
import { whatsappSalesAPI } from '../../utils/api';

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const roas = (v) => (v ? `${Number(v).toFixed(2).replace('.', ',')}x` : '—');
const pct = (v) => `${Math.round((Number(v) || 0) * 100)}%`;
const fmtDate = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
};
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const Stat = ({ label, value, sub, tone = 'default' }) => (
  <div className={`rounded-xl border p-3 ${tone === 'wa' ? 'border-emerald-200 bg-emerald-50/60' : tone === 'web' ? 'border-sky-200 bg-sky-50/60' : 'border-gray-200 bg-white'}`}>
    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-lg sm:text-xl font-bold text-[#17181A] tabular-nums break-words mt-0.5">{value}</p>
    {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

/**
 * Canal WhatsApp vs Web para un cliente: resumen, registro de ventas por WhatsApp
 * y clasificación de campañas de Meta (cuáles son de WhatsApp).
 */
export default function WhatsappChannelPanel({ clientId, startDate, endDate, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSales, setShowSales] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);

  const load = useCallback(async () => {
    if (!clientId || !startDate || !endDate) return;
    try {
      setLoading(true);
      const res = await whatsappSalesAPI.get(clientId, startDate, endDate);
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cargar el canal WhatsApp');
    } finally {
      setLoading(false);
    }
  }, [clientId, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const changed = () => { load(); onChanged?.(); };

  return (
    <div className="glass rounded-xl p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#17181A]">Canales de venta: Web y WhatsApp</h2>
            <p className="text-xs text-gray-500">Ventas de la tienda + ventas cerradas por WhatsApp, con la pauta separada por canal</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowCampaigns(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
            <SlidersHorizontal className="w-4 h-4" /> Campañas por canal
          </button>
          <button onClick={() => setShowSales(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#26282C]">
            <Plus className="w-4 h-4" /> Registrar ventas WhatsApp
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading && !data ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : s ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Venta web (tienda)" value={money(s.web_revenue)} sub={`${s.web_orders || 0} pedidos · pauta ${money(s.web_ad_spend)}`} tone="web" />
            <Stat label="Venta WhatsApp" value={money(s.whatsapp_revenue)} sub={`${s.whatsapp_orders || 0} pedidos · pauta ${money(s.whatsapp_ad_spend)}`} tone="wa" />
            <Stat label="Venta total (todos los canales)" value={money(s.total_revenue)} sub={`${pct(s.total_revenue ? s.whatsapp_revenue / s.total_revenue : 0)} viene de WhatsApp · pauta ${money(s.total_ad_spend)}`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Stat label="ROAS web" value={roas(s.roas_web)} sub="Venta tienda ÷ pauta sin campañas de WhatsApp" tone="web" />
            <Stat label="ROAS WhatsApp" value={roas(s.roas_whatsapp)} sub="Venta WhatsApp ÷ pauta de campañas de WhatsApp" tone="wa" />
            <Stat label="ROAS total" value={roas(s.roas_total)} sub="Todas las ventas ÷ toda la pauta" />
          </div>
          {!s.has_whatsapp && (
            <p className="mt-3 text-xs text-gray-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              Aún no hay ventas por WhatsApp ni campañas de WhatsApp en este periodo. Regístralas aquí, desde el portal del cliente, o pídele al cliente que escriba al número de LA REAL: «Ventas WhatsApp hoy: $1.250.000, 8 pedidos».
            </p>
          )}
        </>
      ) : null}

      {showSales && (
        <SalesModal clientId={clientId} startDate={startDate} endDate={endDate} sales={data?.sales || []} onClose={() => setShowSales(false)} onChanged={changed} />
      )}
      {showCampaigns && (
        <CampaignsModal clientId={clientId} startDate={startDate} endDate={endDate} onClose={() => setShowCampaigns(false)} onChanged={changed} />
      )}
    </div>
  );
}

const Modal = ({ title, subtitle, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90dvh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-[#17181A]">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
    </div>
  </div>
);

function SalesModal({ clientId, startDate, endDate, sales, onClose, onChanged }) {
  const [mode, setMode] = useState('day'); // day | bulk
  const [date, setDate] = useState(todayISO());
  const [revenue, setRevenue] = useState('');
  const [orders, setOrders] = useState('');
  const [notes, setNotes] = useState('');
  const [bulk, setBulk] = useState({ start: startDate, end: endDate, revenue: '', orders: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const total = useMemo(() => sales.reduce((t, r) => t + (Number(r.revenue) || 0), 0), [sales]);

  const save = async () => {
    try {
      setSaving(true); setMsg(null);
      if (mode === 'day') {
        await whatsappSalesAPI.save(clientId, { date, revenue: Number(String(revenue).replace(/[^\d.]/g, '')), orders: Number(orders) || 0, notes: notes || undefined });
        setRevenue(''); setOrders(''); setNotes('');
        setMsg({ ok: true, text: `Guardado ${fmtDate(date)}` });
      } else {
        const r = await whatsappSalesAPI.bulk(clientId, { start_date: bulk.start, end_date: bulk.end, revenue: Number(String(bulk.revenue).replace(/[^\d.]/g, '')), orders: Number(bulk.orders) || 0 });
        setMsg({ ok: true, text: `Total repartido en ${r.data.days} días` });
      }
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'No se pudo guardar' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d) => {
    if (!confirm(`¿Borrar las ventas por WhatsApp del ${fmtDate(d)}?`)) return;
    try { await whatsappSalesAPI.remove(clientId, d); onChanged(); } catch (e) { alert(e.response?.data?.error || 'No se pudo borrar'); }
  };

  return (
    <Modal title="Ventas por WhatsApp" subtitle="Lo que el cliente cierra por chat y no pasa por la tienda. Se suma a la venta total y se cruza con la pauta de WhatsApp." onClose={onClose} wide>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-full sm:w-fit">
        <button onClick={() => setMode('day')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'day' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Un día</button>
        <button onClick={() => setMode('bulk')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'bulk' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Repartir un total</button>
      </div>

      {mode === 'day' ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Venta ($)</label>
            <input type="text" inputMode="numeric" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="1.250.000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pedidos</label>
            <input type="number" min="0" value={orders} onChange={(e) => setOrders(e.target.value)} placeholder="8" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reporte del cliente" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input type="date" value={bulk.start} onChange={(e) => setBulk({ ...bulk, start: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input type="date" value={bulk.end} max={todayISO()} onChange={(e) => setBulk({ ...bulk, end: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Venta total ($)</label>
            <input type="text" inputMode="numeric" value={bulk.revenue} onChange={(e) => setBulk({ ...bulk, revenue: e.target.value })} placeholder="18.500.000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pedidos (total)</label>
            <input type="number" min="0" value={bulk.orders} onChange={(e) => setBulk({ ...bulk, orders: e.target.value })} placeholder="120" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <p className="sm:col-span-4 text-xs text-gray-500">El total se reparte parejo entre los días del rango (útil cuando el cliente reporta la semana o el mes completo). Reemplaza lo que haya en esas fechas.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        {msg ? <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p> : <span />}
        <button onClick={save} disabled={saving || (mode === 'day' ? !revenue : !bulk.revenue)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium disabled:opacity-50">
          <Check className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-800">Registradas en el periodo</h4>
          <span className="text-sm text-gray-500">Total {money(total)}</span>
        </div>
        {sales.length === 0 ? (
          <p className="text-sm text-gray-400">Sin registros entre {fmtDate(startDate)} y {fmtDate(endDate)}.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {sales.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 capitalize">{fmtDate(r.date)} <span className="text-gray-400 font-normal">· {r.orders || 0} ped.</span></p>
                  <p className="text-[11px] text-gray-400 truncate">{r.source === 'portal' ? 'Portal del cliente' : r.source === 'whatsapp' ? 'Mensaje de WhatsApp' : (r.created_by_name || 'Orbit')}{r.notes ? ` · ${r.notes}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-semibold tabular-nums">{money(r.revenue)}</span>
                  <button onClick={() => remove(r.date)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg" title="Borrar"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CampaignsModal({ clientId, startDate, endDate, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [recalc, setRecalc] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await whatsappSalesAPI.campaigns(clientId, startDate, endDate);
      setData(res.data); setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudieron cargar las campañas');
    } finally { setLoading(false); }
  }, [clientId, startDate, endDate]);
  useEffect(() => { load(); }, [load]);

  const setChannel = async (c, channel) => {
    try {
      setSaving(c.campaign_id);
      await whatsappSalesAPI.setCampaignChannel(clientId, c.campaign_id, { channel, campaign_name: c.campaign_name });
      await load();
    } catch (e) { alert(e.response?.data?.error || 'No se pudo guardar'); } finally { setSaving(null); }
  };

  const recalculate = async () => {
    try {
      setRecalc(true);
      await whatsappSalesAPI.recalculate(clientId, startDate, endDate);
      onChanged();
      alert('Pauta por canal recalculada para el periodo');
    } catch (e) { alert(e.response?.data?.error || 'No se pudo recalcular'); } finally { setRecalc(false); }
  };

  return (
    <Modal title="Campañas de Meta por canal" subtitle="Marca cuáles campañas son de WhatsApp. Orbit las detecta por nombre u objetivo; aquí puedes corregirlo. Luego recalcula el periodo." onClose={onClose} wide>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? <p className="text-sm text-gray-400">Cargando campañas…</p> : !data?.connected ? (
        <p className="text-sm text-gray-500">Este cliente no tiene Meta Ads conectado.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Stat label="Pauta web" value={money(data.web_spend)} tone="web" />
            <Stat label="Pauta WhatsApp" value={money(data.whatsapp_spend)} tone="wa" />
            <Stat label="Pauta total" value={money(data.total_spend)} />
          </div>
          {data.campaigns.length === 0 ? <p className="text-sm text-gray-400">Sin campañas con gasto en el periodo.</p> : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {data.campaigns.map((c) => (
                <div key={c.campaign_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate" title={c.campaign_name}>{c.campaign_name}</p>
                    <p className="text-[11px] text-gray-400">{money(c.spend)} · {c.objective || '—'}{c.messaging_conversations ? ` · ${c.messaging_conversations} conversaciones` : ''} · <span className={c.is_override ? 'text-[#17181A]' : ''}>{c.is_override ? 'manual' : `auto (${c.reason})`}</span></p>
                  </div>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                    {[{ k: 'web', label: 'Web', Icon: Globe }, { k: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle }].map((opt) => (
                      <button
                        key={opt.k}
                        disabled={saving === c.campaign_id}
                        onClick={() => setChannel(c, opt.k)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${c.channel === opt.k ? (opt.k === 'whatsapp' ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white') : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        <opt.Icon className="w-3 h-3" /> {opt.label}
                      </button>
                    ))}
                    {c.is_override && (
                      <button onClick={() => setChannel(c, 'auto')} className="px-2 text-[11px] text-gray-400 hover:text-gray-700" title="Volver a detección automática">auto</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
            <p className="text-xs text-gray-500">Las fechas futuras se calculan solas en cada sincronización. Para aplicar cambios a este periodo, recalcula.</p>
            <button onClick={recalculate} disabled={recalc} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${recalc ? 'animate-spin' : ''}`} /> Recalcular periodo
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
