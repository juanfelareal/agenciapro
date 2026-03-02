import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoicesAPI } from '../utils/api';
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Send,
  Mail,
  Copy,
  Trash2,
  Edit,
  Link2,
  Repeat,
  X,
  ExternalLink,
  Briefcase,
  Package,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  invoiced: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

const statusLabels = {
  draft: 'Borrador',
  approved: 'Aprobado - Facturar',
  invoiced: 'Facturado - Pendiente',
  paid: 'Facturado - Pagado',
};

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [siigoData, setSiigoData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingToSiigo, setSendingToSiigo] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const [detailRes, historyRes] = await Promise.all([
        invoicesAPI.getSiigoDetail(id),
        invoicesAPI.getHistory(id),
      ]);
      setInvoice(detailRes.data.local);
      setSiigoData(detailRes.data.siigo);
      setHistory(historyRes.data || []);
    } catch (error) {
      console.error('Error loading invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToSiigo = async () => {
    setSendingToSiigo(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/siigo/invoices/sync/${id}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar a Siigo');
      setMessage({ type: 'success', text: 'Factura enviada a Siigo y DIAN exitosamente' });
      loadInvoice();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSendingToSiigo(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailValue) return;
    setSendingEmail(true);
    try {
      await invoicesAPI.sendSiigoEmail(id, emailValue);
      setMessage({ type: 'success', text: `Factura electrónica enviada a ${emailValue}` });
      setEmailModal(false);
      setEmailValue('');
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Error al enviar email' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await invoicesAPI.duplicate(id);
      navigate(`/app/invoices/${res.data.id}`);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al duplicar factura' });
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta factura?')) return;
    try {
      await invoicesAPI.delete(id);
      navigate('/app/invoices');
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar factura' });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={48} className="text-gray-300" />
        <p className="text-gray-500">Factura no encontrada</p>
        <button onClick={() => navigate('/app/invoices')} className="btn-secondary">
          Volver a Facturas
        </button>
      </div>
    );
  }

  const siigoNumber = siigoData?.name || siigoData?.prefix ? `${siigoData.prefix || ''}${siigoData.number || ''}` : null;
  const siigoStampStatus = siigoData?.stamp?.status;
  const siigoMailStatus = siigoData?.mail?.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/invoices')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#1A1A2E]">
                Factura {invoice.invoice_number}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status] || 'bg-gray-100'}`}>
                {statusLabels[invoice.status] || invoice.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {invoice.client_name} {siigoNumber ? `· Siigo: ${siigoNumber}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDuplicate} className="btn-secondary flex items-center gap-2" title="Duplicar">
            <Copy size={16} />
            Duplicar
          </button>
          <button onClick={handleDelete} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign size={16} />
            Monto
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">
            ${invoice.amount?.toLocaleString('es-CO')}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {invoice.invoice_type === 'con_iva' ? '+IVA (19%)' : 'Sin IVA'}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <User size={16} />
            Cliente
          </div>
          <p className="font-semibold text-[#1A1A2E]">{invoice.client_name}</p>
          {invoice.client_email && (
            <p className="text-xs text-gray-400 mt-1">{invoice.client_email}</p>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Calendar size={16} />
            Fecha emisión
          </div>
          <p className="font-semibold text-[#1A1A2E]">{formatDate(invoice.issue_date)}</p>
          {invoice.paid_date && (
            <p className="text-xs text-emerald-600 mt-1">Pagada: {formatDate(invoice.paid_date)}</p>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <FileText size={16} />
            Tipo
          </div>
          <p className="font-semibold text-[#1A1A2E]">
            {invoice.invoice_type === 'con_iva' ? 'Con IVA' : 'Sin IVA'}
          </p>
          {invoice.is_recurring === 1 && (
            <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
              <Repeat size={12} />
              {invoice.recurrence_frequency === 'monthly' ? 'Mensual' :
               invoice.recurrence_frequency === 'weekly' ? 'Semanal' :
               invoice.recurrence_frequency === 'biweekly' ? 'Quincenal' :
               invoice.recurrence_frequency === 'quarterly' ? 'Trimestral' : 'Anual'}
            </p>
          )}
        </div>
      </div>

      {/* Siigo / DIAN Status */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2 mb-4">
          <Link2 size={20} />
          Estado Siigo / DIAN
        </h2>

        {invoice.siigo_status === 'sent' && siigoData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Estado Siigo</p>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mt-1">
                  <CheckCircle size={14} />
                  Enviada
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Número Siigo</p>
                <p className="font-semibold text-[#1A1A2E] mt-1">{siigoNumber || invoice.siigo_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado DIAN</p>
                {siigoStampStatus === 'Stamped' || siigoStampStatus === 'stamped' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mt-1">
                    <CheckCircle size={14} />
                    Aprobada por DIAN
                  </span>
                ) : siigoStampStatus ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mt-1">
                    <Clock size={14} />
                    {siigoStampStatus}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mt-1">
                    <CheckCircle size={14} />
                    Procesada
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Email enviado</p>
                {siigoMailStatus === 'sent' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mt-1">
                    <Mail size={14} />
                    Enviado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium mt-1">
                    <Mail size={14} />
                    No enviado
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setEmailModal(true);
                  setEmailValue(invoice.client_email || '');
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Mail size={16} />
                Enviar por email
              </button>
              {siigoData?.id && (
                <a
                  href={`https://siigonube.siigo.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2"
                >
                  <ExternalLink size={16} />
                  Ver en Siigo
                </a>
              )}
            </div>
          </div>
        ) : invoice.siigo_status === 'error' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
              <AlertCircle size={24} className="text-red-500" />
              <div>
                <p className="font-medium text-red-700">Error al enviar a Siigo</p>
                <p className="text-sm text-red-600">La factura no pudo ser procesada. Intenta nuevamente.</p>
              </div>
            </div>
            <button
              onClick={handleSendToSiigo}
              disabled={sendingToSiigo}
              className="btn-primary flex items-center gap-2"
            >
              {sendingToSiigo ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Reintentar envío a Siigo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <Clock size={24} className="text-gray-400" />
              <div>
                <p className="font-medium text-gray-700">Pendiente de envío</p>
                <p className="text-sm text-gray-500">Esta factura aún no ha sido enviada a Siigo para facturación electrónica.</p>
              </div>
            </div>
            <button
              onClick={handleSendToSiigo}
              disabled={sendingToSiigo}
              className="btn-primary flex items-center gap-2"
            >
              {sendingToSiigo ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {sendingToSiigo ? 'Enviando...' : 'Enviar a Siigo'}
            </button>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[#1A1A2E] mb-4">Detalles</h2>
          <dl className="space-y-3">
            {invoice.project_name && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1"><Briefcase size={14} /> Proyecto</dt>
                <dd className="text-sm font-medium">{invoice.project_name}</dd>
              </div>
            )}
            {invoice.siigo_product_code && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1"><Package size={14} /> Producto Siigo</dt>
                <dd className="text-sm font-medium font-mono">{invoice.siigo_product_code}</dd>
              </div>
            )}
            {invoice.client_nit && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">NIT</dt>
                <dd className="text-sm font-medium font-mono">{invoice.client_nit}</dd>
              </div>
            )}
            {invoice.client_phone && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Teléfono</dt>
                <dd className="text-sm font-medium">{invoice.client_phone}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Creada</dt>
              <dd className="text-sm font-medium">{formatDateTime(invoice.created_at)}</dd>
            </div>
            {invoice.updated_at && invoice.updated_at !== invoice.created_at && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Última actualización</dt>
                <dd className="text-sm font-medium">{formatDateTime(invoice.updated_at)}</dd>
              </div>
            )}
            {invoice.is_recurring === 1 && (
              <>
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm font-medium text-indigo-700 flex items-center gap-1 mb-2">
                    <Repeat size={14} /> Factura Recurrente
                  </p>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Frecuencia</dt>
                  <dd className="text-sm font-medium">
                    {invoice.recurrence_frequency === 'monthly' ? 'Mensual' :
                     invoice.recurrence_frequency === 'weekly' ? 'Semanal' :
                     invoice.recurrence_frequency === 'biweekly' ? 'Quincenal' :
                     invoice.recurrence_frequency === 'quarterly' ? 'Trimestral' : 'Anual'}
                  </dd>
                </div>
                {invoice.next_recurrence_date && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Próxima facturación</dt>
                    <dd className="text-sm font-medium">{formatDate(invoice.next_recurrence_date)}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>

        {/* Notes & Proof */}
        <div className="space-y-6">
          {invoice.notes && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-[#1A1A2E] mb-3">Notas</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {invoice.payment_proof && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-[#1A1A2E] mb-3">Comprobante de pago</h2>
              <img
                src={invoice.payment_proof}
                alt="Comprobante de pago"
                className="max-w-full rounded-lg border"
              />
            </div>
          )}
        </div>
      </div>

      {/* Status History */}
      {history.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2 mb-4">
            <Clock size={20} />
            Historial de cambios
          </h2>
          <div className="space-y-3">
            {history.map((entry, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-500">{formatDateTime(entry.changed_at)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[entry.from_status] || 'bg-gray-100'}`}>
                    {statusLabels[entry.from_status] || entry.from_status}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[entry.to_status] || 'bg-gray-100'}`}>
                    {statusLabels[entry.to_status] || entry.to_status}
                  </span>
                  {entry.changed_by_name && (
                    <span className="text-xs text-gray-400">por {entry.changed_by_name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
            <h3 className="text-lg font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <Mail size={20} />
              Enviar factura electrónica
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Email del destinatario</label>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="email@ejemplo.com"
              />
              <p className="text-xs text-gray-400 mt-1">Se enviará la factura electrónica generada por Siigo</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setEmailModal(false); setEmailValue(''); }}
                className="px-4 py-2 border rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailValue}
                className="px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendingEmail ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                {sendingEmail ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetail;
