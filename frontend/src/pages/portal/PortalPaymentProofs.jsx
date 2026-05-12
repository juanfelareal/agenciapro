import { useEffect, useState } from 'react';
import { Receipt, Upload, Loader2, FileText, Trash2, Download, CheckCircle2 } from 'lucide-react';
import { portalPaymentProofsAPI } from '../../utils/portalApi';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

const fmtCurrency = (v) => `$${(v || 0).toLocaleString('es-CO')}`;
const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
};
const fmtSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export default function PortalPaymentProofs() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await portalPaymentProofsAPI.list();
      setInvoices(data.invoices || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'No pudimos cargar tus facturas.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (invoiceId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingFor(invoiceId);
    setMessage(null);
    try {
      await portalPaymentProofsAPI.upload(invoiceId, file);
      setMessage({ type: 'success', text: 'Soporte subido correctamente.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.error || 'No se pudo subir el soporte.' });
    } finally {
      setUploadingFor(null);
    }
  };

  const handleDelete = async (proofId) => {
    if (!confirm('¿Eliminar este soporte de pago?')) return;
    setDeletingId(proofId);
    try {
      await portalPaymentProofsAPI.delete(proofId);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: 'No se pudo eliminar el soporte.' });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Receipt className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Soportes de pago</h1>
          <p className="text-sm text-ink-500 mt-0.5">Sube el comprobante de pago de cada factura</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' && <CheckCircle2 size={18} />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-ink-500">
          <Receipt className="w-12 h-12 mx-auto text-ink-300 mb-3" />
          <p>No tienes facturas todavía.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => {
            const isPaid = inv.status === 'paid';
            const hasProofs = inv.proofs?.length > 0;
            return (
              <div key={inv.id} className="bg-white border border-ink-100 rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink-900">{inv.invoice_number}</h3>
                      {isPaid && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          Pagada
                        </span>
                      )}
                      {!isPaid && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Pendiente
                        </span>
                      )}
                    </div>
                    {inv.project_name && (
                      <p className="text-sm text-ink-500 mt-1">{inv.project_name}</p>
                    )}
                    <p className="text-xs text-ink-400 mt-1">Emitida: {fmtDate(inv.issue_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-ink-900">{fmtCurrency(inv.amount)}</p>
                    <p className="text-xs text-ink-400">{inv.invoice_type === 'con_iva' ? '+IVA' : 'Sin IVA'}</p>
                  </div>
                </div>

                {hasProofs && (
                  <div className="mt-4 pt-4 border-t border-ink-100 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-ink-500 font-medium">Soportes</p>
                    {inv.proofs.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ink-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-4 h-4 text-ink-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-900 truncate">{p.file_name}</p>
                            <p className="text-xs text-ink-400">
                              {fmtDate(p.created_at)} · {fmtSize(p.file_size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={`${API_ORIGIN}${p.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-white text-ink-500 hover:text-ink-900"
                            title="Descargar / ver"
                          >
                            <Download size={16} />
                          </a>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                            title="Eliminar"
                          >
                            {deletingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
                    uploadingFor === inv.id
                      ? 'bg-ink-100 text-ink-400 cursor-wait'
                      : 'bg-[#1A1A2E] text-white hover:bg-[#252542]'
                  }`}>
                    {uploadingFor === inv.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {uploadingFor === inv.id ? 'Subiendo…' : hasProofs ? 'Subir otro soporte' : 'Subir soporte de pago'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      disabled={uploadingFor === inv.id}
                      onChange={(e) => handleUpload(inv.id, e)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
