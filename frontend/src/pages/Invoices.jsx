import { useEffect, useState } from 'react';
import { invoicesAPI, clientsAPI, projectsAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, Send, Upload, History, Clock, Filter, RotateCcw, Repeat, CheckSquare, Square, MinusSquare, Link2, ExternalLink, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [statusHistory, setStatusHistory] = useState([]);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [sendingToSiigo, setSendingToSiigo] = useState(null);
  const [siigoConnected, setSiigoConnected] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null);
  const [tipoDropdownOpen, setTipoDropdownOpen] = useState(null);
  const [dateEditOpen, setDateEditOpen] = useState(null);
  const [bulkDateValue, setBulkDateValue] = useState('');
  const [amountEditOpen, setAmountEditOpen] = useState(null);
  const [bulkAmountValue, setBulkAmountValue] = useState('');
  const [filters, setFilters] = useState({
    client_id: '',
    status: '',
    invoice_type: '',
    date_from: '',
    date_to: '',
  });
  const [formData, setFormData] = useState({
    client_id: '',
    project_id: '',
    amount: 0,
    invoice_type: 'con_iva',
    status: 'draft',
    issue_date: '',
    notes: '',
    payment_proof: '',
    is_recurring: false,
    recurrence_frequency: 'monthly',
    recurrence_status: 'draft',
    next_recurrence_date: '',
  });

  useEffect(() => {
    loadData();
    checkSiigoConnection();
  }, []);

  const checkSiigoConnection = async () => {
    try {
      const res = await fetch(`${API_URL}/siigo/settings`);
      const data = await res.json();
      setSiigoConnected(data?.has_token === 1);
    } catch (error) {
      console.error('Error checking Siigo connection:', error);
      setSiigoConnected(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let result = [...invoices];

    if (filters.client_id) {
      result = result.filter((inv) => inv.client_id === parseInt(filters.client_id));
    }

    if (filters.status) {
      result = result.filter((inv) => inv.status === filters.status);
    }

    if (filters.invoice_type) {
      result = result.filter((inv) => inv.invoice_type === filters.invoice_type);
    }

    if (filters.date_from) {
      result = result.filter((inv) => inv.issue_date >= filters.date_from);
    }

    if (filters.date_to) {
      result = result.filter((inv) => inv.issue_date <= filters.date_to);
    }

    setFilteredInvoices(result);
  }, [invoices, filters]);

  const resetFilters = () => {
    setFilters({
      client_id: '',
      status: '',
      invoice_type: '',
      date_from: '',
      date_to: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const loadData = async () => {
    try {
      const [invoicesRes, clientsRes, projectsRes] = await Promise.all([
        invoicesAPI.getAll(),
        clientsAPI.getAll(),
        projectsAPI.getAll(),
      ]);
      setInvoices(invoicesRes.data);
      setClients(clientsRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Convert empty strings to null for optional fields
      const dataToSend = {
        ...formData,
        project_id: formData.project_id || null,
      };

      if (editingInvoice) {
        await invoicesAPI.update(editingInvoice.id, dataToSend);
      } else {
        await invoicesAPI.create(dataToSend);
      }
      setShowModal(false);
      setEditingInvoice(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert(error.response?.data?.error || 'Error al guardar factura');
    }
  };

  const handleEdit = async (invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      client_id: invoice.client_id,
      project_id: invoice.project_id || '',
      amount: invoice.amount,
      invoice_type: invoice.invoice_type || 'con_iva',
      status: invoice.status,
      issue_date: invoice.issue_date,
      notes: invoice.notes || '',
      payment_proof: invoice.payment_proof || '',
      is_recurring: invoice.is_recurring === 1,
      recurrence_frequency: invoice.recurrence_frequency || 'monthly',
      recurrence_status: invoice.recurrence_status || 'draft',
      next_recurrence_date: invoice.next_recurrence_date || '',
    });
    // Load status history
    try {
      const historyRes = await invoicesAPI.getHistory(invoice.id);
      setStatusHistory(historyRes.data || []);
    } catch (error) {
      console.error('Error loading history:', error);
      setStatusHistory([]);
    }
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta factura?')) return;
    try {
      await invoicesAPI.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const handleSendEmail = async (invoice) => {
    if (!confirm(`¿Enviar factura #${invoice.invoice_number} a ${invoice.client_email}?`)) return;
    try {
      await invoicesAPI.send(invoice.id);
      alert('Factura enviada exitosamente');
      loadData();
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert(error.response?.data?.error || 'Error al enviar factura');
    }
  };

  // Helper function to calculate next recurrence date
  const calculateNextDate = (fromDate, frequency) => {
    if (!fromDate) return '';
    const date = new Date(fromDate);
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return '';
    }
    return date.toISOString().split('T')[0];
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      project_id: '',
      amount: 0,
      invoice_type: 'con_iva',
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      notes: '',
      payment_proof: '',
      is_recurring: false,
      recurrence_frequency: 'monthly',
      recurrence_status: 'draft',
      next_recurrence_date: '',
    });
    setShowNewClient(false);
    setNewClientName('');
    setStatusHistory([]);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Convert to base64 for simple storage
    setUploadingProof(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, payment_proof: reader.result });
        setUploadingProof(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir imagen');
      setUploadingProof(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;

    setCreatingClient(true);
    try {
      const response = await clientsAPI.create({
        company: newClientName.trim(),
        name: '',
        status: 'active',
      });
      const newClient = response.data;

      // Add to clients list and select it
      setClients([newClient, ...clients]);
      setFormData({ ...formData, client_id: newClient.id });

      // Reset new client form
      setShowNewClient(false);
      setNewClientName('');
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Error al crear cliente');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleNew = () => {
    resetForm();
    setEditingInvoice(null);
    setShowModal(true);
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    approved: 'bg-blue-100 text-blue-800',
    invoiced: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
  };

  const statusLabels = {
    draft: 'Borrador',
    approved: 'Aprobado - Facturar',
    invoiced: 'Facturado - Pendiente',
    paid: 'Facturado - Pagado',
  };

  // Bulk selection helpers
  const isAllSelected = filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedIds.has(inv.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk actions
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIds.size === 0) return;

    const statusText = statusLabels[newStatus];
    if (!confirm(`¿Cambiar ${selectedIds.size} factura(s) a "${statusText}"?`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        invoicesAPI.update(id, { status: newStatus })
      );
      await Promise.all(promises);
      clearSelection();
      loadData();
    } catch (error) {
      console.error('Error updating invoices:', error);
      alert('Error al actualizar algunas facturas');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Eliminar ${selectedIds.size} factura(s)? Esta acción no se puede deshacer.`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => invoicesAPI.delete(id));
      await Promise.all(promises);
      clearSelection();
      loadData();
    } catch (error) {
      console.error('Error deleting invoices:', error);
      alert('Error al eliminar algunas facturas');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkTypeChange = async (newType) => {
    if (selectedIds.size === 0) return;

    const typeText = newType === 'con_iva' ? '+IVA' : 'Sin IVA';
    if (!confirm(`¿Cambiar ${selectedIds.size} factura(s) a tipo "${typeText}"?`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        invoicesAPI.update(id, { invoice_type: newType })
      );
      await Promise.all(promises);
      clearSelection();
      loadData();
    } catch (error) {
      console.error('Error updating invoices:', error);
      alert('Error al actualizar algunas facturas');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Siigo integration handlers
  const handleSendToSiigo = async (invoice) => {
    if (!siigoConnected) {
      alert('Siigo no está conectado. Ve a Configuración → Siigo para configurar las credenciales.');
      return;
    }

    if (!confirm(`¿Enviar factura de ${invoice.client_name} a Siigo para facturación electrónica?`)) return;

    setSendingToSiigo(invoice.id);
    try {
      const res = await fetch(`${API_URL}/siigo/invoices/sync/${invoice.id}`, {
        method: 'POST'
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar a Siigo');
      }

      alert(`Factura enviada exitosamente a Siigo. ID: ${data.siigo_id}`);
      loadData();
    } catch (error) {
      console.error('Error sending to Siigo:', error);
      alert(error.message || 'Error al enviar factura a Siigo');
    } finally {
      setSendingToSiigo(null);
    }
  };

  const handleBulkSendToSiigo = async () => {
    if (selectedIds.size === 0) return;
    if (!siigoConnected) {
      alert('Siigo no está conectado. Ve a Configuración → Siigo para configurar las credenciales.');
      return;
    }

    if (!confirm(`¿Enviar ${selectedIds.size} factura(s) a Siigo para facturación electrónica?`)) return;

    setBulkUpdating(true);
    try {
      const res = await fetch(`${API_URL}/siigo/invoices/sync-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: Array.from(selectedIds) })
      });
      const data = await res.json();

      if (data.results) {
        const successful = data.results.filter(r => r.success).length;
        const failed = data.results.filter(r => !r.success).length;
        alert(`Resultado: ${successful} factura(s) enviada(s) exitosamente, ${failed} error(es)`);
      }

      clearSelection();
      loadData();
    } catch (error) {
      console.error('Error bulk sending to Siigo:', error);
      alert('Error al enviar facturas a Siigo');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Siigo status colors and labels
  const siigoStatusColors = {
    pending: 'bg-gray-100 text-gray-600',
    sent: 'bg-emerald-100 text-emerald-700',
    error: 'bg-red-100 text-red-700'
  };

  const siigoStatusLabels = {
    pending: 'Pendiente',
    sent: 'Enviada',
    error: 'Error'
  };

  // Handle inline status change from table
  const handleInlineStatusChange = async (invoiceId, newStatus) => {
    try {
      await invoicesAPI.update(invoiceId, { status: newStatus });
      setStatusDropdownOpen(null);
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar estado');
    }
  };

  // Handle inline tipo change from table
  const handleInlineTipoChange = async (invoiceId, newTipo) => {
    try {
      await invoicesAPI.update(invoiceId, { invoice_type: newTipo });
      setTipoDropdownOpen(null);
      loadData();
    } catch (error) {
      console.error('Error updating tipo:', error);
      alert('Error al actualizar tipo');
    }
  };

  // Handle inline date change from table
  const handleInlineDateChange = async (invoiceId, newDate) => {
    try {
      await invoicesAPI.update(invoiceId, { issue_date: newDate });
      setDateEditOpen(null);
      loadData();
    } catch (error) {
      console.error('Error updating date:', error);
      alert('Error al actualizar fecha');
    }
  };

  // Handle bulk date change
  const handleBulkDateChange = async () => {
    if (selectedIds.size === 0 || !bulkDateValue) return;

    if (!confirm(`¿Cambiar la fecha de ${selectedIds.size} factura(s) a ${bulkDateValue}?`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        invoicesAPI.update(id, { issue_date: bulkDateValue })
      );
      await Promise.all(promises);
      clearSelection();
      setBulkDateValue('');
      loadData();
    } catch (error) {
      console.error('Error updating dates:', error);
      alert('Error al actualizar algunas fechas');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Handle inline amount change from table
  const handleInlineAmountChange = async (invoiceId, newAmount) => {
    try {
      await invoicesAPI.update(invoiceId, { amount: parseFloat(newAmount) || 0 });
      setAmountEditOpen(null);
      loadData();
    } catch (error) {
      console.error('Error updating amount:', error);
      alert('Error al actualizar monto');
    }
  };

  // Handle bulk amount change
  const handleBulkAmountChange = async () => {
    if (selectedIds.size === 0 || !bulkAmountValue) return;

    const amount = parseFloat(bulkAmountValue);
    if (isNaN(amount)) return;

    if (!confirm(`¿Cambiar el monto de ${selectedIds.size} factura(s) a $${amount.toLocaleString('es-CO')}?`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        invoicesAPI.update(id, { amount: amount })
      );
      await Promise.all(promises);
      clearSelection();
      setBulkAmountValue('');
      loadData();
    } catch (error) {
      console.error('Error updating amounts:', error);
      alert('Error al actualizar algunos montos');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusDropdownOpen && !e.target.closest('.status-dropdown-container')) {
        setStatusDropdownOpen(null);
      }
      if (tipoDropdownOpen && !e.target.closest('.tipo-dropdown-container')) {
        setTipoDropdownOpen(null);
      }
      if (dateEditOpen && !e.target.closest('.date-edit-container')) {
        setDateEditOpen(null);
      }
      if (amountEditOpen && !e.target.closest('.amount-edit-container')) {
        setAmountEditOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [statusDropdownOpen, tipoDropdownOpen, dateEditOpen, amountEditOpen]);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Facturas</h1>
          <p className="text-gray-600">Gestión de facturas e ingresos</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-600"
        >
          <Plus size={20} />
          Nueva Factura
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-gray-500" />
          <span className="font-medium text-gray-700">Filtros</span>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <RotateCcw size={14} />
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filters.client_id}
              onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
            >
              <option value="">Todos</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company || client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="approved">Aprobado - Facturar</option>
              <option value="invoiced">Facturado - Pendiente</option>
              <option value="paid">Facturado - Pagado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filters.invoice_type}
              onChange={(e) => setFilters({ ...filters, invoice_type: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="con_iva">+IVA</option>
              <option value="sin_iva">Sin IVA</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha desde</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha hasta</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 text-sm text-gray-500">
            Mostrando {filteredInvoices.length} de {invoices.length} facturas
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4 flex items-center gap-4 flex-wrap animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-primary-600" />
            <span className="font-medium text-primary-700">
              {selectedIds.size} factura{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-6 w-px bg-primary-200" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-primary-600">Cambiar estado:</span>
            <button
              onClick={() => handleBulkStatusChange('draft')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Borrador
            </button>
            <button
              onClick={() => handleBulkStatusChange('approved')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
            >
              Aprobado
            </button>
            <button
              onClick={() => handleBulkStatusChange('invoiced')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
            >
              Facturado
            </button>
            <button
              onClick={() => handleBulkStatusChange('paid')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
            >
              Pagado
            </button>
          </div>
          <div className="h-6 w-px bg-primary-200" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary-600">Tipo:</span>
            <button
              onClick={() => handleBulkTypeChange('con_iva')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
            >
              +IVA
            </button>
            <button
              onClick={() => handleBulkTypeChange('sin_iva')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Sin IVA
            </button>
          </div>
          <div className="h-6 w-px bg-primary-200" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary-600">Fecha:</span>
            <input
              type="date"
              value={bulkDateValue}
              onChange={(e) => setBulkDateValue(e.target.value)}
              className="border rounded-lg px-2 py-1 text-sm"
            />
            <button
              onClick={handleBulkDateChange}
              disabled={bulkUpdating || !bulkDateValue}
              className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
          <div className="h-6 w-px bg-primary-200" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary-600">Monto:</span>
            <div className="flex items-center">
              <span className="text-gray-500 text-sm mr-1">$</span>
              <input
                type="number"
                value={bulkAmountValue}
                onChange={(e) => setBulkAmountValue(e.target.value)}
                placeholder="0"
                className="border rounded-lg px-2 py-1 text-sm w-28"
              />
            </div>
            <button
              onClick={handleBulkAmountChange}
              disabled={bulkUpdating || !bulkAmountValue}
              className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
          <div className="h-6 w-px bg-primary-200" />
          {siigoConnected && (
            <button
              onClick={handleBulkSendToSiigo}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 flex items-center gap-1"
            >
              <Link2 size={14} />
              Enviar a Siigo
            </button>
          )}
          <div className="h-6 w-px bg-primary-200" />
          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 size={14} />
            Eliminar
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-100 rounded-lg"
          >
            Cancelar selección
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-center w-12">
                <button
                  onClick={toggleSelectAll}
                  className="text-gray-500 hover:text-primary-600"
                  title={isAllSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                >
                  {isAllSelected ? (
                    <CheckSquare size={18} className="text-primary-600" />
                  ) : isSomeSelected ? (
                    <MinusSquare size={18} className="text-primary-600" />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">
                Notas
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">
                Siigo
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-32">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                  {hasActiveFilters
                    ? 'No se encontraron facturas con los filtros seleccionados'
                    : 'No hay facturas registradas'}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
              <tr
                key={invoice.id}
                className={`hover:bg-gray-50 ${selectedIds.has(invoice.id) ? 'bg-primary-50' : ''}`}
              >
                <td className="px-3 py-4 text-center">
                  <button
                    onClick={() => toggleSelectOne(invoice.id)}
                    className="text-gray-400 hover:text-primary-600"
                  >
                    {selectedIds.has(invoice.id) ? (
                      <CheckSquare size={18} className="text-primary-600" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-medium">
                  <div className="flex items-center gap-2">
                    {invoice.client_name}
                    {invoice.is_recurring === 1 && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs" title={`Recurrente: ${invoice.recurrence_frequency === 'weekly' ? 'Semanal' : invoice.recurrence_frequency === 'biweekly' ? 'Quincenal' : invoice.recurrence_frequency === 'monthly' ? 'Mensual' : invoice.recurrence_frequency === 'quarterly' ? 'Trimestral' : 'Anual'}`}>
                        <Repeat size={12} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-semibold">
                  <div className="relative amount-edit-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAmountEditOpen(amountEditOpen === invoice.id ? null : invoice.id);
                      }}
                      className="px-2 py-1 rounded cursor-pointer hover:bg-gray-100 transition-all"
                    >
                      ${invoice.amount?.toLocaleString('es-CO')}
                    </button>
                    {amountEditOpen === invoice.id && (
                      <div className="absolute z-50 mt-1 left-0 bg-white border rounded-lg shadow-lg p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">$</span>
                          <input
                            type="number"
                            defaultValue={invoice.amount}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target.value) {
                                handleInlineAmountChange(invoice.id, e.target.value);
                              }
                            }}
                            className="border rounded px-2 py-1 text-sm w-32"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              const input = e.target.parentElement.querySelector('input');
                              if (input.value) {
                                handleInlineAmountChange(invoice.id, input.value);
                              }
                            }}
                            className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="relative status-dropdown-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusDropdownOpen(statusDropdownOpen === invoice.id ? null : invoice.id);
                      }}
                      className={`px-2 py-1 rounded-full text-xs cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-all ${statusColors[invoice.status]}`}
                    >
                      {statusLabels[invoice.status]}
                    </button>
                    {statusDropdownOpen === invoice.id && (
                      <div className="absolute z-50 mt-1 left-0 bg-white border rounded-lg shadow-lg py-1 min-w-[160px]">
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <button
                            key={key}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (key !== invoice.status) {
                                handleInlineStatusChange(invoice.id, key);
                              } else {
                                setStatusDropdownOpen(null);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${key === invoice.status ? 'bg-gray-50' : ''}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${statusColors[key].replace('text-', 'bg-').split(' ')[0]}`}></span>
                            {label}
                            {key === invoice.status && <span className="ml-auto text-gray-400">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div className="relative date-edit-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDateEditOpen(dateEditOpen === invoice.id ? null : invoice.id);
                      }}
                      className="px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-100 transition-all"
                    >
                      {invoice.issue_date}
                    </button>
                    {dateEditOpen === invoice.id && (
                      <div className="absolute z-50 mt-1 left-0 bg-white border rounded-lg shadow-lg p-2">
                        <input
                          type="date"
                          defaultValue={invoice.issue_date}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleInlineDateChange(invoice.id, e.target.value);
                            }
                          }}
                          className="border rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="relative tipo-dropdown-container">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTipoDropdownOpen(tipoDropdownOpen === invoice.id ? null : invoice.id);
                      }}
                      className={`px-2 py-1 rounded text-xs cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-all ${invoice.invoice_type === 'con_iva' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {invoice.invoice_type === 'con_iva' ? '+IVA' : 'Sin IVA'}
                    </button>
                    {tipoDropdownOpen === invoice.id && (
                      <div className="absolute z-50 mt-1 left-0 bg-white border rounded-lg shadow-lg py-1 min-w-[100px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (invoice.invoice_type !== 'con_iva') {
                              handleInlineTipoChange(invoice.id, 'con_iva');
                            } else {
                              setTipoDropdownOpen(null);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${invoice.invoice_type === 'con_iva' ? 'bg-gray-50' : ''}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-purple-100"></span>
                          +IVA
                          {invoice.invoice_type === 'con_iva' && <span className="ml-auto text-gray-400">✓</span>}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (invoice.invoice_type !== 'sin_iva') {
                              handleInlineTipoChange(invoice.id, 'sin_iva');
                            } else {
                              setTipoDropdownOpen(null);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${invoice.invoice_type === 'sin_iva' ? 'bg-gray-50' : ''}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-gray-200"></span>
                          Sin IVA
                          {invoice.invoice_type === 'sin_iva' && <span className="ml-auto text-gray-400">✓</span>}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 max-w-xs text-sm text-gray-500">
                  <div className="whitespace-pre-wrap break-words">
                    {invoice.notes || '-'}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  {invoice.siigo_status === 'sent' ? (
                    <span className="flex items-center justify-center gap-1 text-emerald-600" title={`ID: ${invoice.siigo_id}`}>
                      <CheckCircle size={16} />
                      <span className="text-xs">Enviada</span>
                    </span>
                  ) : invoice.siigo_status === 'error' ? (
                    <span className="flex items-center justify-center gap-1 text-red-600" title="Error al enviar">
                      <AlertCircle size={16} />
                      <span className="text-xs">Error</span>
                    </span>
                  ) : siigoConnected ? (
                    <button
                      onClick={() => handleSendToSiigo(invoice)}
                      disabled={sendingToSiigo === invoice.id}
                      className="flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg disabled:opacity-50"
                      title="Enviar a Siigo"
                    >
                      {sendingToSiigo === invoice.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Link2 size={14} />
                      )}
                      <span>{sendingToSiigo === invoice.id ? '...' : 'Enviar'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  {invoice.status === 'draft' && (
                    <button
                      onClick={() => handleSendEmail(invoice)}
                      className="text-green-600 hover:text-green-800 mr-3"
                      title="Enviar por email"
                    >
                      <Send size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(invoice)}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td className="px-3 py-3"></td>
              <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 font-bold text-lg text-gray-900">
                ${filteredInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0).toLocaleString('es-CO')}
              </td>
              <td colSpan="6" className="px-4 py-3 text-sm text-gray-500">
                {filteredInvoices.length} factura{filteredInvoices.length !== 1 ? 's' : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 pb-4 border-b">
              <h2 className="text-2xl font-bold">
                {editingInvoice ? 'Editar Factura' : 'Nueva Factura'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cliente *</label>
                  {showNewClient ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border rounded-lg px-3 py-2"
                        placeholder="Nombre del cliente"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateClient();
                          } else if (e.key === 'Escape') {
                            setShowNewClient(false);
                            setNewClientName('');
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateClient}
                        disabled={creatingClient || !newClientName.trim()}
                        className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingClient ? '...' : 'Crear'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewClient(false);
                          setNewClientName('');
                        }}
                        className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        required={!showNewClient}
                        className="flex-1 border rounded-lg px-3 py-2"
                        value={formData.client_id}
                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      >
                        <option value="">Seleccione...</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.company || client.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewClient(true)}
                        className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-primary-600 flex items-center gap-1"
                        title="Crear nuevo cliente"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Factura *</label>
                  <select
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.invoice_type}
                    onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                  >
                    <option value="con_iva">+IVA</option>
                    <option value="sin_iva">Sin IVA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Proyecto</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Sin proyecto</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monto *</label>
                  <input
                    type="number"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="draft">Borrador</option>
                    <option value="approved">Aprobado - Facturar</option>
                    <option value="invoiced">Facturado - Pendiente</option>
                    <option value="paid">Facturado - Pagado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Emisión *</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.issue_date}
                    onChange={(e) => {
                      const newIssueDate = e.target.value;
                      if (formData.is_recurring && newIssueDate) {
                        const nextDate = calculateNextDate(newIssueDate, formData.recurrence_frequency);
                        setFormData({ ...formData, issue_date: newIssueDate, next_recurrence_date: nextDate });
                      } else {
                        setFormData({ ...formData, issue_date: newIssueDate });
                      }
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Notas</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2"
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                {/* Recurring Invoice Section */}
                <div className="col-span-2 border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_recurring}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        if (isChecked && formData.issue_date) {
                          // Auto-calculate next date when enabling recurring
                          const nextDate = calculateNextDate(formData.issue_date, formData.recurrence_frequency);
                          setFormData({ ...formData, is_recurring: isChecked, next_recurrence_date: nextDate });
                        } else {
                          setFormData({ ...formData, is_recurring: isChecked, next_recurrence_date: '' });
                        }
                      }}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <Repeat size={16} className="text-gray-500" />
                    <span className="text-sm font-medium">Factura Recurrente</span>
                  </label>

                  {formData.is_recurring && (
                    <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium mb-1">Frecuencia</label>
                        <select
                          className="w-full border rounded-lg px-3 py-2"
                          value={formData.recurrence_frequency}
                          onChange={(e) => {
                            const newFrequency = e.target.value;
                            const newNextDate = calculateNextDate(formData.issue_date, newFrequency);
                            setFormData({
                              ...formData,
                              recurrence_frequency: newFrequency,
                              next_recurrence_date: newNextDate
                            });
                          }}
                        >
                          <option value="weekly">Semanal</option>
                          <option value="biweekly">Quincenal</option>
                          <option value="monthly">Mensual</option>
                          <option value="quarterly">Trimestral</option>
                          <option value="yearly">Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Estado al duplicar</label>
                        <select
                          className="w-full border rounded-lg px-3 py-2"
                          value={formData.recurrence_status}
                          onChange={(e) => setFormData({ ...formData, recurrence_status: e.target.value })}
                        >
                          <option value="draft">Borrador</option>
                          <option value="approved">Aprobado - Facturar</option>
                          <option value="invoiced">Facturado - Pendiente</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Próxima facturación</label>
                        <input
                          type="date"
                          className="w-full border rounded-lg px-3 py-2"
                          value={formData.next_recurrence_date}
                          onChange={(e) => setFormData({ ...formData, next_recurrence_date: e.target.value })}
                        />
                      </div>
                      <div className="col-span-3 text-sm text-gray-500">
                        La factura se duplicará automáticamente en la fecha indicada con el estado seleccionado.
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Proof - Only show when status is 'paid' */}
                {formData.status === 'paid' && (
                  <div className="col-span-2 border-t pt-4">
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <Upload size={16} />
                      Soporte de Pago
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload size={16} />
                        <span>{uploadingProof ? 'Subiendo...' : 'Subir imagen'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploadingProof}
                        />
                      </label>
                      {formData.payment_proof && (
                        <div className="flex items-center gap-2">
                          <img
                            src={formData.payment_proof}
                            alt="Soporte de pago"
                            className="h-16 w-16 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, payment_proof: '' })}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status History - Only show when editing */}
                {editingInvoice && statusHistory.length > 0 && (
                  <div className="col-span-2 border-t pt-4">
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <History size={16} />
                      Historial de Cambios
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {statusHistory.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded">
                          <Clock size={14} className="text-gray-400" />
                          <span className="text-gray-600">
                            {new Date(entry.changed_at).toLocaleString('es-CO')}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${statusColors[entry.from_status] || 'bg-gray-100'}`}>
                            {statusLabels[entry.from_status] || entry.from_status}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${statusColors[entry.to_status] || 'bg-gray-100'}`}>
                            {statusLabels[entry.to_status] || entry.to_status}
                          </span>
                          {entry.changed_by_name && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-500">{entry.changed_by_name}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 pt-4 border-t bg-white">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Invoices;
