import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsAPI, emailMarketingAPI } from '../utils/api';
import {
  ArrowLeft, Plus, Mail, Loader2, Edit, Trash2, X, Save, TrendingUp,
} from 'lucide-react';

const fmtCurrency = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
};
const rate = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;
// Prefer the rate the user typed (matches Shopify exactly); fall back to a derived value
const pickRate = (directRate, num, denom) => (directRate > 0 ? directRate : rate(num, denom));

const blankCampaign = {
  campaign_name: '',
  subject: '',
  sent_date: new Date().toISOString().split('T')[0],
  // Capacidad de entrega
  recipients: 0,
  delivery_rate: 0,
  bounce_rate: 0,
  open_rate: 0,
  unsubscribe_rate: 0,
  spam_rate: 0,
  // Rendimiento
  click_rate: 0,
  sessions: 0,
  conversion_rate: 0,
  revenue: 0,
  orders: 0,
  // Tipo de cliente que compró (breakdown de orders)
  new_customer_orders: 0,
  returning_customer_orders: 0,
  // Embudo de conversión
  opens: 0,
  unique_visitors: 0,
  added_to_cart: 0,
  // Derivados (mantener compatibilidad)
  delivered: 0,
  clicks: 0,
  unsubscribes: 0,
  notes: '',
};

export default function ClientEmailMarketing() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankCampaign);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [clientId]);

  const load = async () => {
    setLoading(true);
    try {
      const [c, list] = await Promise.all([
        clientsAPI.getById(clientId),
        emailMarketingAPI.list(clientId),
      ]);
      setClient(c.data);
      setCampaigns(list.data || []);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(blankCampaign);
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      campaign_name: c.campaign_name || '',
      subject: c.subject || '',
      sent_date: (c.sent_date || '').split('T')[0],
      recipients: c.recipients || 0,
      delivery_rate: c.delivery_rate || 0,
      bounce_rate: c.bounce_rate || 0,
      open_rate: c.open_rate || 0,
      unsubscribe_rate: c.unsubscribe_rate || 0,
      spam_rate: c.spam_rate || 0,
      click_rate: c.click_rate || 0,
      sessions: c.sessions || 0,
      conversion_rate: c.conversion_rate || 0,
      revenue: c.revenue || 0,
      orders: c.orders || 0,
      new_customer_orders: c.new_customer_orders || 0,
      returning_customer_orders: c.returning_customer_orders || 0,
      opens: c.opens || 0,
      unique_visitors: c.unique_visitors || 0,
      added_to_cart: c.added_to_cart || 0,
      delivered: c.delivered || 0,
      clicks: c.clicks || 0,
      unsubscribes: c.unsubscribes || 0,
      notes: c.notes || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.campaign_name || !form.sent_date) {
      alert('Nombre y fecha son obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await emailMarketingAPI.update(clientId, editingId, form);
      } else {
        await emailMarketingAPI.create(clientId, form);
      }
      setShowModal(false);
      await load();
    } catch (e) {
      alert('Error: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!confirm(`¿Eliminar la campaña "${c.campaign_name}"?`)) return;
    try {
      await emailMarketingAPI.delete(clientId, c.id);
      await load();
    } catch (e) {
      alert('No se pudo eliminar');
    }
  };

  // Period totals
  const totals = campaigns.reduce((acc, c) => ({
    recipients: acc.recipients + (c.recipients || 0),
    delivered: acc.delivered + (c.delivered || 0),
    opens: acc.opens + (c.opens || 0),
    clicks: acc.clicks + (c.clicks || 0),
    unsubscribes: acc.unsubscribes + (c.unsubscribes || 0),
    orders: acc.orders + (c.orders || 0),
    new_customer_orders: acc.new_customer_orders + (c.new_customer_orders || 0),
    returning_customer_orders: acc.returning_customer_orders + (c.returning_customer_orders || 0),
    revenue: acc.revenue + (c.revenue || 0),
  }), { recipients: 0, delivered: 0, opens: 0, clicks: 0, unsubscribes: 0, orders: 0, new_customer_orders: 0, returning_customer_orders: 0, revenue: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/clients')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Email Marketing</h1>
            <p className="text-sm text-gray-500">{client?.company || client?.name}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] text-sm font-medium"
        >
          <Plus size={16} />
          Registrar campaña
        </button>
      </div>

      {/* Resumen — promedios ponderados por enviados / aperturas */}
      {campaigns.length > 0 && (() => {
        const weighted = (key, denomKey) => {
          let num = 0, denom = 0;
          for (const c of campaigns) {
            const d = c[denomKey] || 0;
            const r = c[key] || 0;
            num += r * d;
            denom += d;
          }
          return denom > 0 ? num / denom : 0;
        };
        const avgOpen = weighted('open_rate', 'recipients');
        const avgClick = weighted('click_rate', 'recipients');
        const avgConv = weighted('conversion_rate', 'sessions');
        const avgBounce = weighted('bounce_rate', 'recipients');
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Campañas', value: fmtInt(campaigns.length) },
              { label: 'Correos enviados', value: fmtInt(totals.recipients) },
              { label: 'Tasa de apertura', value: fmtPct(avgOpen) },
              { label: 'Tasa de clics', value: fmtPct(avgClick) },
              { label: 'Tasa de conversión', value: fmtPct(avgConv) },
              { label: 'Tasa de rebote', value: fmtPct(avgBounce) },
              { label: 'Ventas totales', value: fmtCurrency(totals.revenue) },
              { label: 'Pedidos', value: fmtInt(totals.orders), sub: totals.orders > 0
                ? `${fmtInt(totals.new_customer_orders)} nuevos · ${fmtInt(totals.returning_customer_orders)} recurrentes`
                : null
              },
            ].map((m, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-lg font-bold text-[#1A1A2E] mt-1">{m.value}</p>
                {m.sub && <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Tabla */}
      {campaigns.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center text-gray-500">
          <Mail className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm">Aún no hay campañas registradas para este cliente.</p>
          <p className="text-xs text-gray-400 mt-1">Registra tus campañas de Shopify Email para verlas reflejadas en el portal y en los reportes PDF.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Campaña</th>
                  <th className="text-left py-3 px-3 font-medium">Fecha</th>
                  <th className="text-right py-3 px-3 font-medium">Enviados</th>
                  <th className="text-right py-3 px-3 font-medium">Apertura</th>
                  <th className="text-right py-3 px-3 font-medium">Clics</th>
                  <th className="text-right py-3 px-3 font-medium">Sesiones</th>
                  <th className="text-right py-3 px-3 font-medium">Conv.</th>
                  <th className="text-right py-3 px-3 font-medium">Pedidos</th>
                  <th className="text-right py-3 px-3 font-medium">Ventas</th>
                  <th className="text-right py-3 px-3 font-medium w-20">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#1A1A2E]">{c.campaign_name}</p>
                      {c.subject && <p className="text-xs text-gray-500 mt-0.5">{c.subject}</p>}
                    </td>
                    <td className="py-3 px-3 text-gray-600">{fmtDate(c.sent_date)}</td>
                    <td className="py-3 px-3 text-right">{fmtInt(c.recipients)}</td>
                    <td className="py-3 px-3 text-right">{fmtPct(pickRate(c.open_rate, c.opens, c.delivered))}</td>
                    <td className="py-3 px-3 text-right">{fmtPct(pickRate(c.click_rate, c.clicks, c.delivered))}</td>
                    <td className="py-3 px-3 text-right">{fmtInt(c.sessions)}</td>
                    <td className="py-3 px-3 text-right">{fmtPct(c.conversion_rate)}</td>
                    <td className="py-3 px-3 text-right">
                      {fmtInt(c.orders)}
                      {(c.new_customer_orders > 0 || c.returning_customer_orders > 0) && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {fmtInt(c.new_customer_orders)} nuevos / {fmtInt(c.returning_customer_orders)} recurr.
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">{fmtCurrency(c.revenue)}</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-600 p-1 rounded">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-500 p-1 rounded">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && <CampaignModal form={form} setForm={setForm} editingId={editingId} saving={saving} onSave={save} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ====== Modal: registrar / editar campaña (sigue el formato exacto de Shopify Email) ======
function CampaignModal({ form, setForm, editingId, saving, onSave, onClose }) {
  const setField = (key, value) => setForm({ ...form, [key]: value });
  const setNumeric = (key, value) => setForm({ ...form, [key]: Number(value) || 0 });

  // Derived helper: valor medio del pedido = revenue / orders
  const avgOrder = form.orders > 0 ? form.revenue / form.orders : 0;

  // Validación visual: si el usuario llena nuevos + recurrentes pero no cuadran con orders,
  // se lo señalamos en gris (no bloquea guardar — los datos pueden traerse en momentos distintos)
  const breakdownTotal = (form.new_customer_orders || 0) + (form.returning_customer_orders || 0);
  const breakdownMismatch =
    breakdownTotal > 0 && form.orders > 0 && breakdownTotal !== form.orders;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A2E]">
              {editingId ? 'Editar campaña' : 'Registrar campaña'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Mismas métricas que muestra Shopify Email</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Identificación */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Identificación</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Nombre de campaña *</label>
                <input
                  type="text"
                  value={form.campaign_name}
                  onChange={(e) => setField('campaign_name', e.target.value)}
                  placeholder="Ej: Para la mujer que siempre está presente"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fecha de envío *</label>
                <input
                  type="date"
                  value={form.sent_date}
                  onChange={(e) => setField('sent_date', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Asunto del email</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setField('subject', e.target.value)}
                  placeholder="Ej: Hasta 30% OFF y 2x1 en maquillaje"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Capacidad de entrega */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Capacidad de entrega</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <NumField label="Correos enviados" value={form.recipients} onChange={(v) => setNumeric('recipients', v)} />
              <PctField label="Tasa de entrega" value={form.delivery_rate} onChange={(v) => setNumeric('delivery_rate', v)} />
              <PctField label="Tasa de rebote" value={form.bounce_rate} onChange={(v) => setNumeric('bounce_rate', v)} />
              <PctField label="Tasa de apertura" value={form.open_rate} onChange={(v) => setNumeric('open_rate', v)} />
              <PctField label="Tasa de cancelación" value={form.unsubscribe_rate} onChange={(v) => setNumeric('unsubscribe_rate', v)} />
              <PctField label="Tasa de spam" value={form.spam_rate} onChange={(v) => setNumeric('spam_rate', v)} />
            </div>
          </div>

          {/* Rendimiento */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rendimiento</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <PctField label="Tasa de clics" value={form.click_rate} onChange={(v) => setNumeric('click_rate', v)} />
              <NumField label="Sesiones" value={form.sessions} onChange={(v) => setNumeric('sessions', v)} />
              <PctField label="Tasa de conversión" value={form.conversion_rate} onChange={(v) => setNumeric('conversion_rate', v)} />
              <NumField label="Ventas totales (COP)" value={form.revenue} onChange={(v) => setNumeric('revenue', v)} />
              <NumField label="Total de pedidos" value={form.orders} onChange={(v) => setNumeric('orders', v)} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valor medio del pedido</label>
                <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                  ${Math.round(avgOrder).toLocaleString('es-CO')}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Calculado: ventas / pedidos</p>
              </div>
            </div>
          </div>

          {/* Tipo de cliente que compró */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de cliente que compró</p>
              {form.orders > 0 && (
                <p className="text-[11px] text-gray-400">
                  Total de pedidos: {form.orders.toLocaleString('es-CO')}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <NumField label="Pedidos de clientes nuevos" value={form.new_customer_orders} onChange={(v) => setNumeric('new_customer_orders', v)} />
              <NumField label="Pedidos de clientes recurrentes" value={form.returning_customer_orders} onChange={(v) => setNumeric('returning_customer_orders', v)} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">% de clientes nuevos</label>
                <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                  {breakdownTotal > 0
                    ? `${((form.new_customer_orders / breakdownTotal) * 100).toFixed(1)}%`
                    : '—'}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Calculado: nuevos / (nuevos + recurrentes)</p>
              </div>
            </div>
            {breakdownMismatch && (
              <p className="text-[11px] text-amber-600 mt-2">
                ⚠ Nuevos + recurrentes ({breakdownTotal.toLocaleString('es-CO')}) no cuadra con total de pedidos ({form.orders.toLocaleString('es-CO')}). Revisa que sumen igual.
              </p>
            )}
          </div>

          {/* Embudo de conversión */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Embudo de conversión</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumField label="Aperturas (únicas)" value={form.opens} onChange={(v) => setNumeric('opens', v)} />
              <NumField label="Visitantes únicos" value={form.unique_visitors} onChange={(v) => setNumeric('unique_visitors', v)} />
              <NumField label="Añadidos al carrito" value={form.added_to_cart} onChange={(v) => setNumeric('added_to_cart', v)} />
              <NumField label="Pedidos" value={form.orders} onChange={(v) => setNumeric('orders', v)} />
            </div>
          </div>

          {/* Notas */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs text-gray-600 mb-1">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Atomic field components
function NumField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}

function PctField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
      </div>
    </div>
  );
}
