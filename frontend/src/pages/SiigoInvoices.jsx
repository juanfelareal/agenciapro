import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  RefreshCw,
  CheckSquare,
  Square,
  MinusSquare,
  Download,
  ArrowLeft,
  Calendar,
  DollarSign,
  User,
  ExternalLink,
  Filter,
  X,
  CheckCircle,
  Clock,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const SiigoInvoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [customers, setCustomers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  useEffect(() => {
    fetchInvoices(startDate || null, endDate || null);
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter]);

  const fetchInvoices = async (dateFrom = null, dateTo = null) => {
    setIsLoading(true);
    try {
      let allInvoices = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        let url = `${API_URL}/siigo/invoices?page=${page}&page_size=100`;
        if (dateFrom) url += `&date_start=${dateFrom}`;
        if (dateTo) url += `&date_end=${dateTo}`;

        const res = await fetch(url, { headers: authHeaders() });
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          allInvoices = [...allInvoices, ...data.results];
          const totalResults = data.pagination?.total_results || 0;
          if (allInvoices.length >= totalResults) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setInvoices(allInvoices);
      setPagination({ page: 1, total: allInvoices.length });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setMessage({ type: 'error', text: 'Error al cargar facturas de Siigo' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      // Fetch all customers to map IDs to names
      let allCustomers = {};
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(`${API_URL}/siigo/customers?page=${page}&page_size=100`, { headers: authHeaders() });
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          data.results.forEach(c => {
            allCustomers[c.id] = {
              name: Array.isArray(c.name) ? c.name.join(' ') : c.name,
              identification: c.identification
            };
          });

          if (Object.keys(allCustomers).length >= (data.pagination?.total_results || 0)) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (statusFilter === 'paid') {
      filtered = filtered.filter(inv => inv.balance === 0);
    } else if (statusFilter === 'pending') {
      filtered = filtered.filter(inv => inv.balance > 0);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv => {
        const customerName = customers[inv.customer?.id]?.name || '';
        return (
          inv.name?.toLowerCase().includes(term) ||
          inv.number?.toString().includes(term) ||
          customerName.toLowerCase().includes(term) ||
          inv.customer?.identification?.includes(term)
        );
      });
    }

    setFilteredInvoices(filtered);
  };

  const handleDateSearch = () => {
    fetchInvoices(startDate || null, endDate || null);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      setMessage({ type: 'error', text: 'Selecciona al menos una factura para importar' });
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id));
      let imported = 0;
      let skipped = 0;
      let errors = 0;

      // Fetch existing clients once instead of per-invoice
      const clientsRes = await fetch(`${API_URL}/clients`, { headers: authHeaders() });
      const existingClients = await clientsRes.json();

      for (const invoice of selectedInvoices) {
        try {
          const customerInfo = customers[invoice.customer?.id] || {};

          let clientId = null;
          const existingClient = existingClients.find(c =>
            c.nit === invoice.customer?.identification ||
            c.siigo_id === invoice.customer?.id
          );

          if (existingClient) {
            clientId = existingClient.id;
          } else {
            const newClientRes = await fetch(`${API_URL}/clients`, {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({
                name: customerInfo.name || 'Cliente Siigo',
                company: customerInfo.name || 'Cliente Siigo',
                nit: invoice.customer?.identification || '',
                status: 'active',
                siigo_id: invoice.customer?.id,
              }),
            });
            if (newClientRes.ok) {
              const newClient = await newClientRes.json();
              clientId = newClient.id;
              existingClients.push(newClient);
            }
          }

          if (!clientId) {
            errors++;
            continue;
          }

          const hasIva = invoice.items?.some(item =>
            item.taxes?.some(tax => tax.percentage > 0)
          );

          const status = invoice.balance === 0 ? 'paid' : 'invoiced';

          // amount must be the subtotal (without IVA) — the system computes IVA from it.
          const subtotal = invoiceSubtotal(invoice);
          const invoiceData = {
            client_id: clientId,
            amount: subtotal,
            invoice_type: hasIva ? 'con_iva' : 'sin_iva',
            status: status,
            issue_date: invoice.date ? invoice.date.split('T')[0] : null,
            notes: `Siigo: ${invoice.name} - ${invoice.items?.[0]?.description || ''}`,
            siigo_id: invoice.id,
            siigo_status: 'normalized',
          };

          const res = await fetch(`${API_URL}/invoices`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(invoiceData),
          });

          if (res.ok) {
            const body = await res.json();
            if (body.existing) skipped++;
            else imported++;
          } else {
            errors++;
          }
        } catch (e) {
          console.error('Error importing invoice:', e);
          errors++;
        }
      }

      const parts = [`Importadas: ${imported}`];
      if (skipped > 0) parts.push(`Ya existían: ${skipped}`);
      if (errors > 0) parts.push(`Errores: ${errors}`);
      setMessage({
        type: imported > 0 || skipped > 0 ? 'success' : 'error',
        text: parts.join(' · '),
      });
      setSelectedIds(new Set());
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleRefreshAmounts = async () => {
    setImporting(true);
    setMessage(null);
    try {
      // Build exact subtotals from the Siigo listing we already have loaded.
      const payload = invoices.map((inv) => ({
        siigo_id: inv.id,
        amount: invoiceSubtotal(inv),
      }));
      const res = await fetch(`${API_URL}/siigo/invoices/refresh-amounts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ invoices: payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `${data.updated} factura(s) actualizada(s) con subtotal exacto de Siigo.`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al recalcular montos' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleSyncCreditNotes = async () => {
    setImporting(true);
    setMessage(null);
    try {
      const body = {};
      if (startDate) body.dateStart = startDate;
      if (endDate) body.dateEnd = endDate;
      const res = await fetch(`${API_URL}/siigo/sync-credit-notes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const parts = [];
        if (data.cancelled > 0) parts.push(`${data.cancelled} anuladas`);
        if (data.partial > 0) parts.push(`${data.partial} con NC parcial`);
        if (data.notFound > 0) parts.push(`${data.notFound} factura(s) no encontrada(s)`);
        setMessage({
          type: data.total === 0 ? 'success' : 'success',
          text: data.total === 0
            ? 'No se encontraron notas crédito en el rango.'
            : `Procesadas ${data.total} NC${parts.length ? ': ' + parts.join(', ') : ''}.`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al aplicar notas crédito' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleNormalizeAmounts = async () => {
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/siigo/invoices/normalize-amounts`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: data.updated > 0
            ? `${data.updated} factura(s) ajustada(s): amount ahora es subtotal sin IVA.`
            : 'Todos los montos ya están normalizados.',
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al normalizar montos' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/siigo/invoices/cleanup-duplicates`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.deleted > 0) {
          const detail = [];
          if (data.bySiigoId > 0) detail.push(`${data.bySiigoId} por siigo_id`);
          if (data.byNotes > 0) detail.push(`${data.byNotes} por notas`);
          setMessage({
            type: 'success',
            text: `Limpieza completada: ${data.deleted} duplicado(s) eliminado(s)${detail.length ? ` (${detail.join(', ')})` : ''}.`,
          });
        } else {
          setMessage({ type: 'success', text: 'No se encontraron duplicados.' });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al limpiar duplicados' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const invoiceTaxes = (invoice) => {
    let sum = 0;
    invoice.items?.forEach((item) => {
      item.taxes?.forEach((tax) => {
        sum += tax.value || 0;
      });
    });
    return sum;
  };

  const invoiceSubtotal = (invoice) => (invoice.total || 0) - invoiceTaxes(invoice);

  const isAllSelected = filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
        <p className="text-gray-500">Cargando facturas de Siigo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/siigo')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[#17181A]">Facturas en Siigo</h1>
            <p className="text-gray-500 text-sm mt-1">
              {invoices.length} facturas cargadas de Siigo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAmounts}
            disabled={importing}
            className="btn-secondary flex items-center gap-2"
            title="Recalcula el amount de las facturas con el subtotal exacto de Siigo (usa los items.taxes del rango filtrado)"
          >
            <RefreshCw size={16} />
            Recalcular montos
          </button>
          <button
            onClick={handleSyncCreditNotes}
            disabled={importing}
            className="btn-secondary flex items-center gap-2"
            title="Trae notas crédito de Siigo y anula las facturas correspondientes en el rango filtrado"
          >
            <RefreshCw size={16} />
            Aplicar notas crédito
          </button>
          <button
            onClick={handleNormalizeAmounts}
            disabled={importing}
            className="btn-secondary flex items-center gap-2"
            title="(Legacy) Divide entre 1.19 — usa Recalcular montos en su lugar"
          >
            <RefreshCw size={16} />
            Normalizar montos
          </button>
          <button
            onClick={handleCleanupDuplicates}
            disabled={importing}
            className="btn-secondary flex items-center gap-2"
            title="Elimina facturas duplicadas (conserva la más nueva)"
          >
            <X size={16} />
            Limpiar duplicados
          </button>
          <button
            onClick={() => fetchInvoices(startDate || null, endDate || null)}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por número, cliente o NIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-40"
              title="Fecha desde"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input w-40"
              title="Fecha hasta"
            />
            <button
              onClick={handleDateSearch}
              className="px-3 py-2 bg-[#17181A] text-white text-sm rounded-lg hover:bg-[#26282C] transition-colors"
            >
              Buscar
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); fetchInvoices(); }}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                title="Limpiar fechas"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select"
            >
              <option value="all">Todos</option>
              <option value="paid">Pagadas</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Mostrando {filteredInvoices.length} de {invoices.length}
          </div>
        </div>
      </div>

      {/* Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-gray-50 border border-primary-200 rounded-xl p-4 flex items-center gap-4">
          <CheckSquare className="text-[#17181A]" size={20} />
          <span className="font-medium text-[#17181A]">
            {selectedIds.size} factura(s) seleccionada(s)
          </span>
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-primary flex items-center gap-2 ml-auto"
          >
            {importing ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            {importing ? 'Importando...' : 'Importar a AgenciaPro'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn-secondary"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Invoices Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <button onClick={toggleSelectAll} className="text-gray-500 hover:text-[#17181A]">
                    {isAllSelected ? (
                      <CheckSquare size={18} className="text-[#17181A]" />
                    ) : isSomeSelected ? (
                      <MinusSquare size={18} className="text-[#17181A]" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Factura
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Saldo
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ver
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No se encontraron facturas con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => {
                  const customerInfo = customers[invoice.customer?.id] || {};
                  const isSelected = selectedIds.has(invoice.id);
                  const isPaid = invoice.balance === 0;

                  return (
                    <tr
                      key={invoice.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-gray-50' : ''}`}
                      onClick={() => toggleSelect(invoice.id)}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(invoice.id);
                          }}
                          className="text-gray-400 hover:text-[#17181A]"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-[#17181A]" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                            <FileText size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-[#17181A]">{invoice.name}</p>
                            <p className="text-xs text-gray-500">{invoice.prefix}-{invoice.number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <div>
                            <p className="text-sm text-[#17181A]">{customerInfo.name || 'Cliente'}</p>
                            <p className="text-xs text-gray-500">{invoice.customer?.identification}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar size={14} className="text-gray-400" />
                          {formatDate(invoice.date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-[#17181A]">
                          {formatCurrency(invoice.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {formatCurrency(invoice.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isPaid ? (
                            <>
                              <CheckCircle size={12} />
                              Pagada
                            </>
                          ) : (
                            <>
                              <Clock size={12} />
                              Pendiente
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {invoice.public_url && (
                          <a
                            href={invoice.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="card p-4">
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Total con IVA</p>
            <p className="text-xl font-bold text-[#17181A]">
              {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ventas netas (sin IVA)</p>
            <p className="text-xl font-bold text-[#17181A]">
              {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + invoiceSubtotal(inv), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">IVA</p>
            <p className="text-xl font-bold text-blue-600">
              {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + invoiceTaxes(inv), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Pagadas</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(filteredInvoices.filter(inv => inv.balance === 0).reduce((sum, inv) => sum + (inv.total || 0), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Pendiente por Cobrar</p>
            <p className="text-xl font-bold text-amber-600">
              {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiigoInvoices;
