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
    fetchInvoices();
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter, startDate, endDate]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/siigo/invoices?page=1&page_size=50`);
      const data = await res.json();

      if (data.results) {
        setInvoices(data.results);
        setPagination({ page: 1, total: data.pagination?.total_results || 0 });
      }
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
        const res = await fetch(`${API_URL}/siigo/customers?page=${page}&page_size=100`);
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

    // Filter by status (paid vs pending)
    if (statusFilter === 'paid') {
      filtered = filtered.filter(inv => inv.balance === 0);
    } else if (statusFilter === 'pending') {
      filtered = filtered.filter(inv => inv.balance > 0);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(inv => {
        if (!inv.date) return false;
        const invDate = new Date(inv.date);
        return invDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(inv => {
        if (!inv.date) return false;
        const invDate = new Date(inv.date);
        return invDate <= end;
      });
    }

    // Filter by search term
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
      let errors = 0;

      for (const invoice of selectedInvoices) {
        try {
          const customerInfo = customers[invoice.customer?.id] || {};

          // First, find or create the client in AgenciaPro
          let clientId = null;

          // Search for existing client by NIT
          const clientsRes = await fetch(`${API_URL}/clients`);
          const clients = await clientsRes.json();
          const existingClient = clients.find(c =>
            c.nit === invoice.customer?.identification ||
            c.siigo_id === invoice.customer?.id
          );

          if (existingClient) {
            clientId = existingClient.id;
          } else {
            // Create new client
            const newClientRes = await fetch(`${API_URL}/clients`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
            }
          }

          if (!clientId) {
            errors++;
            continue;
          }

          // Determine invoice type based on taxes
          const hasIva = invoice.items?.some(item =>
            item.taxes?.some(tax => tax.percentage > 0)
          );

          // Determine status based on balance
          const status = invoice.balance === 0 ? 'paid' : 'invoiced';

          // Create invoice in AgenciaPro
          const invoiceData = {
            client_id: clientId,
            amount: invoice.total || 0,
            invoice_type: hasIva ? 'con_iva' : 'sin_iva',
            status: status,
            issue_date: invoice.date,
            notes: `Siigo: ${invoice.name} - ${invoice.items?.[0]?.description || ''}`,
            siigo_id: invoice.id,
          };

          const res = await fetch(`${API_URL}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoiceData),
          });

          if (res.ok) {
            // Update the invoice with siigo_status
            const newInvoice = await res.json();
            await fetch(`${API_URL}/invoices/${newInvoice.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ siigo_status: 'sent', siigo_id: invoice.id }),
            });
            imported++;
          } else {
            errors++;
          }
        } catch (e) {
          console.error('Error importing invoice:', e);
          errors++;
        }
      }

      setMessage({
        type: imported > 0 ? 'success' : 'error',
        text: `Importadas: ${imported} factura(s). ${errors > 0 ? `Errores: ${errors}` : ''}`
      });
      setSelectedIds(new Set());
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
    return new Date(dateStr).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isAllSelected = filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin text-ink-400" size={32} />
        <p className="text-ink-500">Cargando facturas de Siigo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/siigo')}
            className="p-2 hover:bg-ink-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Facturas en Siigo</h1>
            <p className="text-ink-500 text-sm mt-1">
              {pagination.total} facturas encontradas - Mostrando últimas 50
            </p>
          </div>
        </div>
        <button
          onClick={fetchInvoices}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por número, cliente o NIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-ink-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-40"
              title="Fecha desde"
            />
            <span className="text-ink-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input w-40"
              title="Fecha hasta"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-2 hover:bg-ink-100 rounded-lg text-ink-500"
                title="Limpiar fechas"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-ink-400" />
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
          <div className="text-sm text-ink-500">
            Mostrando {filteredInvoices.length} de {invoices.length}
          </div>
        </div>
      </div>

      {/* Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-4">
          <CheckSquare className="text-primary-600" size={20} />
          <span className="font-medium text-primary-700">
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
            <thead className="bg-ink-50">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <button onClick={toggleSelectAll} className="text-ink-500 hover:text-primary-600">
                    {isAllSelected ? (
                      <CheckSquare size={18} className="text-primary-600" />
                    ) : isSomeSelected ? (
                      <MinusSquare size={18} className="text-primary-600" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                  Factura
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-500 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-500 uppercase">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-500 uppercase">
                  Saldo
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-500 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-500 uppercase">
                  Ver
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-ink-500">
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
                      className={`hover:bg-ink-50 cursor-pointer ${isSelected ? 'bg-primary-50' : ''}`}
                      onClick={() => toggleSelect(invoice.id)}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(invoice.id);
                          }}
                          className="text-ink-400 hover:text-primary-600"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-primary-600" />
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
                            <p className="font-medium text-ink-900">{invoice.name}</p>
                            <p className="text-xs text-ink-500">{invoice.prefix}-{invoice.number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-ink-400" />
                          <div>
                            <p className="text-sm text-ink-900">{customerInfo.name || 'Cliente'}</p>
                            <p className="text-xs text-ink-500">{invoice.customer?.identification}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-ink-600">
                          <Calendar size={14} className="text-ink-400" />
                          {formatDate(invoice.date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-ink-900">
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
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-ink-500">Total Facturas</p>
            <p className="text-xl font-bold text-ink-900">
              {formatCurrency(filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-500">Pagadas</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(filteredInvoices.filter(inv => inv.balance === 0).reduce((sum, inv) => sum + (inv.total || 0), 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-500">Pendiente por Cobrar</p>
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
