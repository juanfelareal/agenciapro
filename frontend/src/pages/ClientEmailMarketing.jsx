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

const blankCampaign = {
  campaign_name: '',
  subject: '',
  sent_date: new Date().toISOString().split('T')[0],
  recipients: 0,
  delivered: 0,
  opens: 0,
  clicks: 0,
  unsubscribes: 0,
  orders: 0,
  revenue: 0,
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
      delivered: c.delivered || 0,
      opens: c.opens || 0,
      clicks: c.clicks || 0,
      unsubscribes: c.unsubscribes || 0,
      orders: c.orders || 0,
      revenue: c.revenue || 0,
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
    revenue: acc.revenue + (c.revenue || 0),
  }), { recipients: 0, delivered: 0, opens: 0, clicks: 0, unsubscribes: 0, orders: 0, revenue: 0 });

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

      {/* Resumen */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Campañas', value: fmtInt(campaigns.length) },
            { label: 'Enviados', value: fmtInt(totals.recipients) },
            { label: 'Aperturas', value: `${fmtInt(totals.opens)} (${fmtPct(rate(totals.opens, totals.delivered))})` },
            { label: 'Clicks', value: `${fmtInt(totals.clicks)} (${fmtPct(rate(totals.clicks, totals.delivered))})` },
            { label: 'Bajas', value: fmtInt(totals.unsubscribes) },
            { label: 'Pedidos', value: fmtInt(totals.orders) },
            { label: 'Revenue', value: fmtCurrency(totals.revenue) },
            { label: 'CTR sobre apertura', value: fmtPct(rate(totals.clicks, totals.opens)) },
          ].map((m, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-lg font-bold text-[#1A1A2E] mt-1">{m.value}</p>
            </div>
          ))}
        </div>
      )}

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
                  <th className="text-right py-3 px-3 font-medium">Aperturas</th>
                  <th className="text-right py-3 px-3 font-medium">Clicks</th>
                  <th className="text-right py-3 px-3 font-medium">Pedidos</th>
                  <th className="text-right py-3 px-3 font-medium">Revenue</th>
                  <th className="text-right py-3 px-3 font-medium w-24">Acciones</th>
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
                    <td className="py-3 px-3 text-right">
                      <p>{fmtInt(c.opens)}</p>
                      <p className="text-xs text-gray-400">{fmtPct(rate(c.opens, c.delivered))}</p>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <p>{fmtInt(c.clicks)}</p>
                      <p className="text-xs text-gray-400">{fmtPct(rate(c.clicks, c.delivered))}</p>
                    </td>
                    <td className="py-3 px-3 text-right">{fmtInt(c.orders)}</td>
                    <td className="py-3 px-3 text-right font-semibold">{fmtCurrency(c.revenue)}</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-500 p-1.5 rounded">
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
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1A1A2E]">
                {editingId ? 'Editar campaña' : 'Registrar campaña'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de campaña *</label>
                  <input
                    type="text"
                    value={form.campaign_name}
                    onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
                    placeholder="Ej: Newsletter Día de la Madre"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de envío *</label>
                  <input
                    type="date"
                    value={form.sent_date}
                    onChange={(e) => setForm({ ...form, sent_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Asunto del email</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Ej: 🎁 -20% solo este fin de semana"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Métricas de envío</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ['recipients', 'Enviados'],
                    ['delivered', 'Entregados'],
                    ['opens', 'Aperturas'],
                    ['clicks', 'Clicks'],
                    ['unsubscribes', 'Bajas'],
                    ['orders', 'Pedidos'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type="number"
                        min="0"
                        value={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) || 0 })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                  <div className="col-span-2 md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Revenue atribuido (COP)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.revenue}
                      onChange={(e) => setForm({ ...form, revenue: Number(e.target.value) || 0 })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
