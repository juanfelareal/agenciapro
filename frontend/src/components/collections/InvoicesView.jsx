import { useMemo } from 'react';
import { Send, CheckCircle, FileText, Search, X, Mail } from 'lucide-react';
import {
  AGING_BUCKETS, BUCKET_STYLES, COLLECTION_STATUSES, EMPTY_INVOICE_FILTERS, formatCurrency, formatDate, formatDateShort, formatMonth, statusMeta, daysLabel,
} from './collectionsUtils';

// Vista "Por factura": todas las facturas pendientes con filtros, edición inline de promesa/estado y acciones
const InvoicesView = ({
  invoices = [],
  loading = false,
  filters = EMPTY_INVOICE_FILTERS,
  onFiltersChange,
  onCollectInvoice,
  onMarkPaid,
  onUpdateInvoice,
  savingId = null,
}) => {
  const setFilter = (patch) => onFiltersChange({ ...filters, ...patch });

  const clientOptions = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) if (!map.has(inv.client_id)) map.set(inv.client_id, inv.client_name);
    return [...map.entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
  }, [invoices]);

  const rows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filters.bucket && inv.aging_bucket !== filters.bucket) return false;
      if (filters.client_id && String(inv.client_id) !== String(filters.client_id)) return false;
      if (filters.month && !(inv.issue_date || '').startsWith(filters.month)) return false;
      if (q && !(`${inv.invoice_number} ${inv.client_name}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [invoices, filters]);

  const total = rows.reduce((s, inv) => s + Number(inv.pending_amount ?? inv.amount ?? 0), 0);
  const hasFilters = filters.bucket || filters.client_id || filters.search || filters.month;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#17181A]">Facturas pendientes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Más antigua primero · {rows.length} de {invoices.length} facturas</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilter({ search: e.target.value })}
                placeholder="Factura o cliente…"
                className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
              />
            </div>
            <select
              value={filters.client_id}
              onChange={(e) => setFilter({ client_id: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
            >
              <option value="">Todos los clientes</option>
              {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        </div>

        {/* Chips de antigüedad + filtro de mes */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter({ bucket: '' })}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filters.bucket ? 'bg-[#17181A] text-white border-[#17181A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            Todas
          </button>
          {AGING_BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setFilter({ bucket: filters.bucket === b ? '' : b })}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filters.bucket === b ? 'bg-[#17181A] text-white border-[#17181A]' : `${BUCKET_STYLES[b].badge} hover:opacity-80`}`}
            >
              {BUCKET_STYLES[b].label}
            </button>
          ))}
          {filters.month && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#D7F653]/40 text-[#17181A] border border-[#D7F653]">
              Emitidas en {formatMonth(filters.month)}
              <button type="button" onClick={() => setFilter({ month: '' })} className="hover:text-red-600" title="Quitar filtro de mes"><X size={12} /></button>
            </span>
          )}
          {hasFilters && (
            <button type="button" onClick={() => onFiltersChange({ ...EMPTY_INVOICE_FILTERS })} className="text-xs text-gray-400 hover:text-[#17181A] underline ml-1">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17181A]"></div></div>
      ) : invoices.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-600">No hay facturas pendientes</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-gray-400">Ninguna factura coincide con los filtros</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead>
              <tr className="bg-gray-50/70 text-xs text-gray-500 uppercase tracking-wider text-left">
                <th className="px-5 py-3">Factura</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Emisión</th>
                <th className="px-3 py-3">Días</th>
                <th className="px-3 py-3">Vence</th>
                <th className="px-3 py-3">Promesa</th>
                <th className="px-3 py-3">Estado de cobro</th>
                <th className="px-3 py-3 text-right">Monto</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((inv) => {
                const bStyle = BUCKET_STYLES[inv.aging_bucket] || BUCKET_STYLES['0-30'];
                const status = statusMeta(inv.collection_status);
                const saving = savingId === inv.id;
                return (
                  <tr key={inv.id} className={`hover:bg-white/60 transition-colors ${saving ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-[#17181A] whitespace-nowrap">{inv.invoice_number}</p>
                      {inv.last_reminder_at && (
                        <p className="text-[11px] text-emerald-600 inline-flex items-center gap-1 mt-0.5"><Mail size={10} /> cobrado {formatDateShort(inv.last_reminder_at)}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 max-w-[180px] truncate" title={inv.client_name}>{inv.client_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(inv.issue_date)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${bStyle.badge}`}>{daysLabel(inv.days_outstanding)}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{inv.due_date ? formatDate(inv.due_date) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-3">
                      <input
                        type="date"
                        value={inv.promise_date || ''}
                        onChange={(e) => onUpdateInvoice(inv, { promise_date: e.target.value || null })}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D7F653] w-[130px]"
                        title="Promesa de pago"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={inv.collection_status || 'pending'}
                        onChange={(e) => onUpdateInvoice(inv, { collection_status: e.target.value })}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-[#D7F653] cursor-pointer ${status.className}`}
                      >
                        {COLLECTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-[#17181A] text-right whitespace-nowrap">
                      {formatCurrency(inv.pending_amount ?? inv.amount)}
                      {inv.siigo_total != null && Number(inv.pending_amount) < Number(inv.siigo_total) && (
                        <span className="block text-[10px] font-medium text-amber-600">pago parcial · total {formatCurrency(inv.siigo_total)}</span>
                      )}
                      {!inv.siigo_id && <span className="block text-[10px] font-medium text-gray-400">no está en Siigo</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onCollectInvoice(inv)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#17181A] text-[#D7F653] text-xs font-medium hover:bg-[#2D2D4E] transition-colors"
                          title="Cobrar esta factura"
                        >
                          <Send size={12} />
                          Cobrar
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkPaid(inv)}
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                          title="Marcar pagada"
                        >
                          <CheckCircle size={16} />
                        </button>
                        {inv.pdf_url ? (
                          <a
                            href={inv.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#17181A] hover:bg-gray-100 transition-colors"
                            title="Ver PDF (Siigo)"
                          >
                            <FileText size={16} />
                          </a>
                        ) : (
                          <span className="p-1.5 text-gray-200" title="Sin PDF en Siigo"><FileText size={16} /></span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50/70 text-sm">
                <td colSpan={7} className="px-5 py-3 font-semibold text-gray-600">
                  {rows.length} factura{rows.length !== 1 ? 's' : ''}{hasFilters ? ' (filtradas)' : ''}
                </td>
                <td className="px-3 py-3 text-right font-bold text-[#17181A] whitespace-nowrap">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvoicesView;
