import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  RefreshCw,
  CheckSquare,
  Square,
  MinusSquare,
  Download,
  ArrowLeft,
  Building2,
  User,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Filter,
  X,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SiigoCustomers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  useEffect(() => {
    fetchAllCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, typeFilter]);

  const fetchAllCustomers = async () => {
    setIsLoading(true);
    try {
      let allCustomers = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(`${API_URL}/siigo/customers?page=${page}&page_size=100`);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          allCustomers = [...allCustomers, ...data.results];
          setPagination({ page, total: data.pagination?.total_results || 0 });

          if (allCustomers.length >= (data.pagination?.total_results || 0)) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // Sort by creation date (newest first)
      allCustomers.sort((a, b) => {
        const dateA = new Date(a.metadata?.created || 0);
        const dateB = new Date(b.metadata?.created || 0);
        return dateB - dateA;
      });

      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setMessage({ type: 'error', text: 'Error al cargar clientes de Siigo' });
    } finally {
      setIsLoading(false);
    }
  };

  const filterCustomers = () => {
    let filtered = [...customers];

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.type === typeFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => {
        const name = Array.isArray(c.name) ? c.name.join(' ') : c.name;
        return (
          name?.toLowerCase().includes(term) ||
          c.identification?.includes(term) ||
          c.commercial_name?.toLowerCase().includes(term) ||
          c.contacts?.[0]?.email?.toLowerCase().includes(term)
        );
      });
    }

    setFilteredCustomers(filtered);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
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
      setMessage({ type: 'error', text: 'Selecciona al menos un cliente para importar' });
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
      let imported = 0;
      let errors = 0;

      for (const customer of selectedCustomers) {
        try {
          const name = Array.isArray(customer.name) ? customer.name.join(' ') : customer.name;
          const contact = customer.contacts?.[0] || {};
          const contactName = contact.first_name && contact.last_name
            ? `${contact.first_name} ${contact.last_name}`.trim()
            : name;

          // Format created date as contract start date (YYYY-MM-DD)
          const createdDate = customer.metadata?.created
            ? new Date(customer.metadata.created).toISOString().split('T')[0]
            : null;

          const clientData = {
            name: contactName,
            company: customer.person_type === 'Company' ? name : contactName, // Company is required
            email: contact.email || '',
            phone: contact.phone?.number || customer.phones?.[0]?.number || '',
            nit: customer.identification || '',
            status: 'active',
            siigo_id: customer.id,
            contract_start_date: createdDate, // Use Siigo creation date as contract start
          };

          const res = await fetch(`${API_URL}/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData),
          });

          if (res.ok) {
            imported++;
          } else {
            errors++;
          }
        } catch (e) {
          errors++;
        }
      }

      setMessage({
        type: imported > 0 ? 'success' : 'error',
        text: `Importados: ${imported} cliente(s). ${errors > 0 ? `Errores: ${errors}` : ''}`
      });
      setSelectedIds(new Set());
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCustomerName = (customer) => {
    return Array.isArray(customer.name) ? customer.name.join(' ') : customer.name;
  };

  const isAllSelected = filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
        <p className="text-gray-500">Cargando clientes de Siigo... ({pagination.page} páginas)</p>
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
            <h1 className="text-2xl font-semibold text-[#1A1A2E]">Clientes en Siigo</h1>
            <p className="text-gray-500 text-sm mt-1">
              {customers.length} clientes encontrados - Selecciona los que deseas importar
            </p>
          </div>
        </div>
        <button
          onClick={fetchAllCustomers}
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, NIT o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="select"
            >
              <option value="all">Todos los tipos</option>
              <option value="Customer">Clientes</option>
              <option value="Supplier">Proveedores</option>
              <option value="Other">Otros</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Mostrando {filteredCustomers.length} de {customers.length}
          </div>
        </div>
      </div>

      {/* Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-gray-50 border border-primary-200 rounded-xl p-4 flex items-center gap-4">
          <CheckSquare className="text-[#1A1A2E]" size={20} />
          <span className="font-medium text-[#1A1A2E]">
            {selectedIds.size} cliente(s) seleccionado(s)
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

      {/* Customers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <button onClick={toggleSelectAll} className="text-gray-500 hover:text-[#1A1A2E]">
                    {isAllSelected ? (
                      <CheckSquare size={18} className="text-[#1A1A2E]" />
                    ) : isSomeSelected ? (
                      <MinusSquare size={18} className="text-[#1A1A2E]" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nombre / Empresa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  NIT / CC
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ciudad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Creado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No se encontraron clientes con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const name = getCustomerName(customer);
                  const contact = customer.contacts?.[0] || {};
                  const city = customer.address?.city?.city_name || '-';
                  const isSelected = selectedIds.has(customer.id);

                  return (
                    <tr
                      key={customer.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-gray-50' : ''}`}
                      onClick={() => toggleSelect(customer.id)}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(customer.id);
                          }}
                          className="text-gray-400 hover:text-[#1A1A2E]"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-[#1A1A2E]" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            customer.person_type === 'Company'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-purple-100 text-purple-600'
                          }`}>
                            {customer.person_type === 'Company' ? (
                              <Building2 size={16} />
                            ) : (
                              <User size={16} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-[#1A1A2E]">{name}</p>
                            {customer.commercial_name && customer.commercial_name !== name && (
                              <p className="text-xs text-gray-500">{customer.commercial_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                        {customer.identification || '-'}
                        {customer.check_digit && `-${customer.check_digit}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          customer.type === 'Customer'
                            ? 'bg-emerald-100 text-emerald-700'
                            : customer.type === 'Supplier'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {customer.type === 'Customer' ? 'Cliente' :
                           customer.type === 'Supplier' ? 'Proveedor' : 'Otro'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <MapPin size={14} className="text-gray-400" />
                          {city}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Mail size={12} className="text-gray-400" />
                              <span className="truncate max-w-[150px]">{contact.email}</span>
                            </div>
                          )}
                          {(contact.phone?.number || customer.phones?.[0]?.number) && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Phone size={12} className="text-gray-400" />
                              {contact.phone?.number || customer.phones?.[0]?.number}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar size={14} className="text-gray-400" />
                          {formatDate(customer.metadata?.created)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SiigoCustomers;
