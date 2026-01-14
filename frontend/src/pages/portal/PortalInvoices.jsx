import { useState, useEffect } from 'react';
import { usePortal } from '../../context/PortalContext';
import { portalInvoicesAPI } from '../../utils/portalApi';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  Loader2,
  Download,
  Calendar,
  DollarSign,
  ExternalLink
} from 'lucide-react';

export default function PortalInvoices() {
  const { hasPermission } = usePortal();
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await portalInvoicesAPI.getAll();
      setInvoices(response.invoices || []);
      setSummary(response.summary || { total: 0, paid: 0, pending: 0, overdue: 0 });
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: { bg: 'bg-ink-100', text: 'text-ink-600', icon: FileText, label: 'Borrador' },
      sent: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Enviada' },
      paid: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Pagada' },
      overdue: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: 'Vencida' },
      cancelled: { bg: 'bg-ink-100', text: 'text-ink-500', icon: XCircle, label: 'Cancelada' }
    };
    const style = styles[status] || styles.draft;
    const Icon = style.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {style.label}
      </span>
    );
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
                         invoice.concept?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-ink-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Mis Facturas</h1>
        <p className="text-ink-500 mt-1">Historial de facturación y pagos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-xl font-bold text-ink-900">{formatCurrency(summary.total)}</span>
          </div>
          <p className="mt-3 text-sm text-ink-500">Total Facturado</p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xl font-bold text-green-600">{formatCurrency(summary.paid)}</span>
          </div>
          <p className="mt-3 text-sm text-ink-500">Pagado</p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xl font-bold text-amber-600">{formatCurrency(summary.pending)}</span>
          </div>
          <p className="mt-3 text-sm text-ink-500">Pendiente</p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-xl font-bold text-red-600">{formatCurrency(summary.overdue)}</span>
          </div>
          <p className="mt-3 text-sm text-ink-500">Vencido</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
          <input
            type="text"
            placeholder="Buscar por número o concepto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-ink-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-ink-200 rounded-xl appearance-none
                   focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">Todos los estados</option>
          <option value="sent">Enviadas</option>
          <option value="paid">Pagadas</option>
          <option value="overdue">Vencidas</option>
        </select>
      </div>

      {/* Invoices List */}
      {filteredInvoices.length > 0 ? (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-50 border-b border-ink-100">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">
                    Factura
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">
                    Concepto
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-medium text-ink-900">
                        {invoice.invoice_number || `#${invoice.id}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-ink-900 line-clamp-1">{invoice.concept || 'Sin concepto'}</p>
                      {invoice.project_name && (
                        <p className="text-sm text-ink-500">{invoice.project_name}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-ink-600">
                      {invoice.issue_date
                        ? new Date(invoice.issue_date).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-ink-900">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-ink-100">
            {filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono font-medium text-ink-900">
                      {invoice.invoice_number || `#${invoice.id}`}
                    </p>
                    <p className="text-sm text-ink-500 mt-0.5">
                      {invoice.issue_date
                        ? new Date(invoice.issue_date).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : '-'}
                    </p>
                  </div>
                  {getStatusBadge(invoice.status)}
                </div>
                <p className="text-ink-700 mb-2">{invoice.concept || 'Sin concepto'}</p>
                <p className="text-lg font-bold text-ink-900">{formatCurrency(invoice.total)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 p-12 text-center">
          <div className="w-16 h-16 bg-ink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-ink-400" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">No hay facturas</h3>
          <p className="text-ink-500">
            {search || statusFilter !== 'all'
              ? 'No se encontraron facturas con los filtros aplicados.'
              : 'Aún no tienes facturas registradas.'}
          </p>
        </div>
      )}
    </div>
  );
}
