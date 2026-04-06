import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsAPI, invoicesAPI, pdfAnalysisAPI, portalAdminAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, FileText, Settings, Upload, Loader2, CheckSquare, Square, MinusSquare, Check, Link2, Phone, FolderOpen, CalendarDays } from 'lucide-react';

const Clients = () => {
  const navigate = useNavigate();
  const pdfInputRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [analyzingPdf, setAnalyzingPdf] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    nit: '',
    check_digit: '',
    address: '',
    city: '',
    status: 'active',
    contract_value: 0,
    contract_start_date: '',
    contract_end_date: '',
    notes: '',
    is_recurring: false,
    billing_day: new Date().getDate(),
    recurring_amount: 0,
  });
  const [searchingNit, setSearchingNit] = useState(false);

  const [copiedPortalId, setCopiedPortalId] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  // Commercial dates
  const [commercialDates, setCommercialDates] = useState([]);
  const [showDateModal, setShowDateModal] = useState(false);
  const [newDateTitle, setNewDateTitle] = useState('');
  const [newDateDate, setNewDateDate] = useState('');
  const [newDateClientIds, setNewDateClientIds] = useState(new Set());
  const [newDateAllClients, setNewDateAllClients] = useState(true);

  // Resizable columns
  const tableRef = useRef(null);
  const [editingNickname, setEditingNickname] = useState(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const [columnWidths, setColumnWidths] = useState({
    checkbox: 48,
    nickname: 180,
    empresa: 300,
    contacto: 200,
    email: 220,
    estado: 80,
    valor: 130,
    acciones: 280,
  });
  const resizingRef = useRef(null);

  const handleResizeStart = (e, columnKey) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey];

    const handleMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizingRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    resizingRef.current = columnKey;
  };

  const ResizeHandle = ({ columnKey }) => (
    <div
      onMouseDown={(e) => handleResizeStart(e, columnKey)}
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 z-10"
      style={{ transform: 'translateX(50%)' }}
    />
  );

  useEffect(() => {
    loadClients();
    loadCommercialDates();
  }, []);

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      setClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommercialDates = async () => {
    try {
      const response = await portalAdminAPI.getAllCommercialDates();
      console.log('Commercial dates response:', response.data);
      setCommercialDates(response.data || []);
    } catch (error) {
      console.error('Error loading commercial dates:', error);
    }
  };

  const handleCreateCommercialDate = async () => {
    if (!newDateTitle.trim() || !newDateDate) return;
    const clientIds = newDateAllClients
      ? clients.filter(c => c.status === 'active').map(c => c.id)
      : Array.from(newDateClientIds);
    if (clientIds.length === 0) {
      alert('No hay clientes para asignar');
      return;
    }

    try {
      console.log('Sending commercial date:', { title: newDateTitle.trim(), date: newDateDate, client_ids: clientIds });
      const res = await portalAdminAPI.createCommercialDate({
        title: newDateTitle.trim(),
        date: newDateDate,
        client_ids: clientIds
      });
      console.log('Create response:', res.data);
      const msg = res.data?.message || 'Fecha comercial creada';
      const errs = res.data?.errors;
      alert(errs ? `${msg}\n\nErrores:\n${errs.join('\n')}` : msg);
      setNewDateTitle('');
      setNewDateDate('');
      setNewDateClientIds(new Set());
      setNewDateAllClients(true);
      setShowDateModal(false);
      await loadCommercialDates();
    } catch (error) {
      console.error('Error creating commercial date:', error);
      alert('Error al crear la fecha comercial: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteCommercialDateGroup = async (title, date) => {
    if (!confirm(`¿Eliminar "${title}" para todos los clientes?`)) return;
    try {
      await portalAdminAPI.deleteCommercialDateGroup(title, date);
      loadCommercialDates();
    } catch (error) {
      console.error('Error deleting commercial date:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await clientsAPI.update(editingClient.id, formData);
      } else {
        await clientsAPI.create(formData);
      }
      setShowModal(false);
      setEditingClient(null);
      resetForm();
      loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Error al guardar cliente');
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData(client);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;
    try {
      await clientsAPI.delete(id);
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const handleFacturar = async (client) => {
    // Validation: must have contract_value > 0
    if (!client.contract_value || client.contract_value <= 0) {
      alert('No se puede crear factura: El cliente no tiene un Valor Contrato definido.');
      return;
    }

    if (!confirm(`¿Crear factura por $${client.contract_value.toLocaleString('es-CO')} para ${client.company || client.name}?`)) {
      return;
    }

    try {
      // Generate invoice number: FAC-YYYYMMDD-CLIENTID
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const invoiceNumber = `FAC-${dateStr}-${client.id}`;
      const issueDate = today.toISOString().slice(0, 10);

      await invoicesAPI.create({
        invoice_number: invoiceNumber,
        client_id: client.id,
        amount: client.contract_value,
        issue_date: issueDate,
        status: 'draft',
        notes: `Factura generada desde módulo Clientes - Valor contrato`,
      });

      alert('Factura creada exitosamente. Puedes verla en el módulo de Facturas.');
    } catch (error) {
      console.error('Error creating invoice:', error);
      if (error.response?.data?.error?.includes('UNIQUE constraint')) {
        alert('Ya existe una factura con este número. Intente nuevamente.');
      } else {
        alert(error.response?.data?.error || 'Error al crear factura');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      nit: '',
      check_digit: '',
      address: '',
      city: '',
      status: 'active',
      contract_value: 0,
      contract_start_date: '',
      contract_end_date: '',
      notes: '',
      is_recurring: false,
      billing_day: new Date().getDate(),
      recurring_amount: 0,
    });
  };

  const handleSearchNit = async () => {
    if (!formData.nit || formData.nit.trim() === '') {
      alert('Por favor ingrese un NIT');
      return;
    }

    setSearchingNit(true);
    try {
      const response = await clientsAPI.searchNit(formData.nit);

      // If API is configured and returns data, autocomplete the fields
      if (response.data.name) {
        setFormData({
          ...formData,
          name: response.data.name || formData.name,
          company: response.data.company || formData.company,
          email: response.data.email || formData.email,
          phone: response.data.phone || formData.phone,
        });
        alert('Información del NIT encontrada y cargada');
      } else {
        alert(response.data.message || 'NIT recibido. Configure la API para autocompletar datos.');
      }
    } catch (error) {
      console.error('Error searching NIT:', error);
      alert(error.response?.data?.error || 'No se pudo buscar información del NIT');
    } finally {
      setSearchingNit(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor seleccione un archivo PDF');
      return;
    }

    setAnalyzingPdf(true);
    try {
      const formDataPdf = new FormData();
      formDataPdf.append('pdf', file);

      const response = await pdfAnalysisAPI.analyzeRut(formDataPdf);

      if (response.data.success) {
        const data = response.data.data;
        // Split NIT and check digit if format is "123456789-1"
        let nitValue = data.nit || formData.nit;
        let checkDigitValue = formData.check_digit;
        if (nitValue && nitValue.includes('-')) {
          const parts = nitValue.split('-');
          nitValue = parts[0].replace(/[^0-9]/g, '');
          checkDigitValue = parts[1]?.replace(/[^0-9]/g, '').slice(0, 1) || '';
        }
        setFormData({
          ...formData,
          nit: nitValue,
          check_digit: checkDigitValue,
          company: data.company || formData.company,
          name: data.name || formData.name,
          email: data.email || formData.email,
          phone: data.phone || formData.phone,
          notes: data.notes || formData.notes,
        });
        alert('RUT analizado exitosamente. Los datos han sido cargados al formulario.');
      } else {
        alert('No se pudo extraer la información del RUT');
      }
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      alert(error.response?.data?.error || 'Error al analizar el PDF');
    } finally {
      setAnalyzingPdf(false);
      // Reset file input
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    }
  };

  const handleNew = () => {
    resetForm();
    setEditingClient(null);
    setShowModal(true);
  };

  // Bulk selection helpers
  const filteredClients = activeTab === 'all' ? clients : clients.filter(c => c.status === 'active');
  const isAllSelected = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map(c => c.id)));
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

    const statusText = newStatus === 'active' ? 'Activo' : 'Inactivo';
    if (!confirm(`¿Cambiar ${selectedIds.size} cliente(s) a "${statusText}"?`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        clientsAPI.update(id, { status: newStatus })
      );
      await Promise.all(promises);
      clearSelection();
      loadClients();
    } catch (error) {
      console.error('Error updating clients:', error);
      alert('Error al actualizar algunos clientes');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Eliminar ${selectedIds.size} cliente(s)? Esta acción no se puede deshacer.`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => clientsAPI.delete(id));
      await Promise.all(promises);
      clearSelection();
      loadClients();
    } catch (error) {
      console.error('Error deleting clients:', error);
      alert('Error al eliminar algunos clientes');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkFacturar = async () => {
    if (selectedIds.size === 0) return;

    // Get selected clients with contract value > 0
    const selectedClients = clients.filter(c => selectedIds.has(c.id) && c.contract_value > 0);

    if (selectedClients.length === 0) {
      alert('Ninguno de los clientes seleccionados tiene un Valor Contrato definido.');
      return;
    }

    const total = selectedClients.reduce((sum, c) => sum + c.contract_value, 0);
    if (!confirm(`¿Crear ${selectedClients.length} factura(s) por un total de $${total.toLocaleString('es-CO')}?`)) return;

    setBulkUpdating(true);
    try {
      const today = new Date();
      const issueDate = today.toISOString().slice(0, 10);

      const promises = selectedClients.map(client =>
        invoicesAPI.create({
          client_id: client.id,
          amount: client.contract_value,
          issue_date: issueDate,
          status: 'draft',
          notes: `Factura generada en lote desde módulo Clientes`,
        })
      );
      await Promise.all(promises);
      clearSelection();
      alert(`${selectedClients.length} factura(s) creada(s) exitosamente.`);
    } catch (error) {
      console.error('Error creating invoices:', error);
      alert('Error al crear algunas facturas');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleNicknameEdit = (client) => {
    setEditingNickname(client.id);
    setNicknameValue(client.nickname || '');
  };

  const handleNicknameSave = async (clientId) => {
    try {
      await clientsAPI.update(clientId, { nickname: nicknameValue || null });
      setClients(clients.map(c => c.id === clientId ? { ...c, nickname: nicknameValue || null } : c));
    } catch (error) {
      console.error('Error saving nickname:', error);
    }
    setEditingNickname(null);
  };

  const handleToggleStatus = async (client) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    try {
      await clientsAPI.update(client.id, { status: newStatus });
      setClients(clients.map(c => c.id === client.id ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleQuickCopyPortalLink = async (client) => {
    try {
      const tokensRes = await portalAdminAPI.getAccess(client.id);
      const tokens = Array.isArray(tokensRes) ? tokensRes : (tokensRes.tokens || []);
      let activeInvite = tokens.find(t => t.token_type === 'invite' && t.status === 'active');

      // Auto-generate invite if none exists
      if (!activeInvite) {
        const response = await portalAdminAPI.generateInvite(client.id);
        activeInvite = { token: response.invite_code };
      }

      const link = `${window.location.origin}/portal/login?code=${activeInvite.token}`;
      await navigator.clipboard.writeText(link);
      setCopiedPortalId(client.id);
      setTimeout(() => setCopiedPortalId(null), 2000);
    } catch (error) {
      console.error('Error copying portal link:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de la base de datos de clientes</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
        >
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#BFFF00]/10 border border-[#BFFF00] rounded-xl p-3 mb-4 flex items-center gap-4 flex-wrap animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-[#1A1A2E]" />
            <span className="font-medium text-[#1A1A2E]">
              {selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-6 w-px bg-[#1A1A2E]/20" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[#1A1A2E]/70">Estado:</span>
            <button
              onClick={() => handleBulkStatusChange('active')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-[#10B981]/10 text-[#10B981] rounded-lg hover:bg-[#10B981]/20 disabled:opacity-50"
            >
              Activo
            </button>
            <button
              onClick={() => handleBulkStatusChange('inactive')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Inactivo
            </button>
          </div>
          <div className="h-6 w-px bg-[#1A1A2E]/20" />
          <button
            onClick={handleBulkFacturar}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-sm bg-[#1A1A2E]/10 text-[#1A1A2E] rounded-lg hover:bg-[#1A1A2E]/20 disabled:opacity-50 flex items-center gap-1"
          >
            <FileText size={14} />
            Facturar
          </button>
          <div className="h-6 w-px bg-[#1A1A2E]/20" />
          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 size={14} />
            Eliminar
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto px-3 py-1.5 text-sm text-[#1A1A2E] hover:bg-[#1A1A2E]/10 rounded-lg"
          >
            Cancelar selección
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'active'
              ? 'bg-white text-[#1A1A2E] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Activos
          <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
            activeTab === 'active' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-200 text-gray-500'
          }`}>
            {clients.filter(c => c.status === 'active').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'all'
              ? 'bg-white text-[#1A1A2E] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Todos
          <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
            activeTab === 'all' ? 'bg-gray-200 text-gray-700' : 'bg-gray-200 text-gray-500'
          }`}>
            {clients.length}
          </span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table ref={tableRef} className="min-w-[1300px]" style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}>
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 text-center relative" style={{ width: columnWidths.checkbox }}>
                <button
                  onClick={toggleSelectAll}
                  className="text-gray-500 hover:text-[#1A1A2E]"
                  title={isAllSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                >
                  {isAllSelected ? (
                    <CheckSquare size={18} className="text-[#1A1A2E]" />
                  ) : isSomeSelected ? (
                    <MinusSquare size={18} className="text-[#1A1A2E]" />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.nickname }}>
                Nombre Cliente
                <ResizeHandle columnKey="nickname" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.empresa }}>
                Empresa
                <ResizeHandle columnKey="empresa" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: columnWidths.acciones }}>
                Acciones
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.contacto }}>
                Contacto
                <ResizeHandle columnKey="contacto" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.estado }}>
                Estado
                <ResizeHandle columnKey="estado" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.valor }}>
                Valor Contrato
                <ResizeHandle columnKey="valor" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.email }}>
                Email
                <ResizeHandle columnKey="email" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredClients.map((client) => (
              <tr
                key={client.id}
                className={`hover:bg-gray-50 ${selectedIds.has(client.id) ? 'bg-[#BFFF00]/10' : ''}`}
              >
                <td className="px-3 py-4 text-center">
                  <button
                    onClick={() => toggleSelectOne(client.id)}
                    className="text-gray-400 hover:text-[#1A1A2E]"
                  >
                    {selectedIds.has(client.id) ? (
                      <CheckSquare size={18} className="text-[#1A1A2E]" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </td>
                <td className="px-4 py-4 text-sm">
                  {editingNickname === client.id ? (
                    <input
                      type="text"
                      className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={nicknameValue}
                      onChange={(e) => setNicknameValue(e.target.value)}
                      onBlur={() => handleNicknameSave(client.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNicknameSave(client.id);
                        if (e.key === 'Escape') setEditingNickname(null);
                      }}
                      autoFocus
                      placeholder="Nombre interno..."
                    />
                  ) : (
                    <span
                      onClick={() => handleNicknameEdit(client)}
                      className={`cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -mx-2 block truncate ${client.nickname ? 'text-gray-700' : 'text-gray-300 italic'}`}
                      title={client.nickname ? `${client.nickname} (clic para editar)` : 'Clic para agregar nombre'}
                    >
                      {client.nickname || 'Sin nombre'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 font-medium text-[#1A1A2E] truncate" title={client.company || client.name}>{client.company || client.name}</td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => navigate(`/app/clients/${client.id}/calls`)}
                    className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg mr-1 transition-colors"
                    title="Llamadas"
                  >
                    <Phone size={18} />
                  </button>
                  <button
                    onClick={() => navigate(`/app/clients/${client.id}/documentos`)}
                    className="text-gray-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg mr-1 transition-colors"
                    title="Documentos"
                  >
                    <FolderOpen size={18} />
                  </button>
                  <button
                    onClick={() => handleFacturar(client)}
                    className="text-gray-400 hover:text-[#10B981] hover:bg-[#10B981]/10 p-1.5 rounded-lg mr-1 transition-colors"
                    title="Facturar"
                  >
                    <FileText size={18} />
                  </button>
                  <button
                    onClick={() => handleQuickCopyPortalLink(client)}
                    className={`p-1.5 rounded-lg mr-1 transition-colors ${
                      copiedPortalId === client.id
                        ? 'text-green-600 bg-green-50'
                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                    title={copiedPortalId === client.id ? 'Link copiado!' : 'Copiar link del portal'}
                  >
                    {copiedPortalId === client.id ? <Check size={18} /> : <Link2 size={18} />}
                  </button>
                  <button
                    onClick={() => navigate(`/app/clients/${client.id}/plataformas`)}
                    className="text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 p-1.5 rounded-lg mr-1 transition-colors"
                    title="Configurar Plataformas (Facebook Ads / Shopify)"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={() => handleEdit(client)}
                    className="text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 p-1.5 rounded-lg mr-1 transition-colors"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
                <td className="px-4 py-4 text-sm text-gray-500 truncate" title={client.name}>{client.name || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleStatus(client)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      client.status === 'active'
                        ? 'bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={client.status === 'active' ? 'Clic para desactivar' : 'Clic para activar'}
                  >
                    {client.status === 'active' ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-bold text-[#10B981]">
                  ${client.contract_value?.toLocaleString('es-CO') || 0}
                </td>
                <td className="px-4 py-4 text-sm text-gray-500 truncate" title={client.email}>{client.email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Commercial Dates Section */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A2E]">Fechas Comerciales</h2>
              <p className="text-xs text-gray-500">Fechas clave que aparecen en el portal de cada cliente</p>
            </div>
          </div>
          <button
            onClick={() => setShowDateModal(true)}
            className="bg-[#1A1A2E] text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors text-sm"
          >
            <Plus size={16} />
            Nueva Fecha
          </button>
        </div>

        {commercialDates.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No hay fechas comerciales configuradas
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {commercialDates.map((cd, idx) => (
              <div key={idx} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-shrink-0 w-12">
                    {(() => {
                      const dateStr = typeof cd.date === 'string' ? cd.date.split('T')[0] : new Date(cd.date).toISOString().split('T')[0];
                      const d = new Date(dateStr + 'T12:00:00');
                      return (
                        <>
                          <p className="text-lg font-bold text-[#1A1A2E] leading-tight">{d.getDate()}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-medium">
                            {d.toLocaleDateString('es-CO', { month: 'short' })}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{cd.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cd.clients.length} cliente{cd.clients.length !== 1 ? 's' : ''}: {cd.clients.map(c => c.nickname || c.company || c.client_name).join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCommercialDateGroup(cd.title, cd.date)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commercial Date Modal */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#1A1A2E]">Nueva Fecha Comercial</h2>
              <button onClick={() => setShowDateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Título</label>
                <input
                  type="text"
                  value={newDateTitle}
                  onChange={e => setNewDateTitle(e.target.value)}
                  placeholder="Ej: Día de la Madre"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  value={newDateDate}
                  onChange={e => setNewDateDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Asignar a</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={newDateAllClients}
                      onChange={() => setNewDateAllClients(true)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Todos los clientes activos</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!newDateAllClients}
                      onChange={() => setNewDateAllClients(false)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Seleccionar clientes</span>
                  </label>
                </div>
                {!newDateAllClients && (
                  <div className="mt-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                    {clients.filter(c => c.status === 'active').map(c => (
                      <label key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newDateClientIds.has(c.id)}
                          onChange={() => {
                            const next = new Set(newDateClientIds);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            setNewDateClientIds(next);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{c.nickname || c.company || c.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleCreateCommercialDate}
                disabled={!newDateTitle.trim() || !newDateDate || (!newDateAllClients && newDateClientIds.size === 0)}
                className="w-full py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] disabled:opacity-50 transition-colors font-medium"
              >
                Crear Fecha Comercial
              </button>
            </div>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                {/* PDF Upload Section - Only show when creating new client */}
                {!editingClient && (
                  <div className="col-span-2 bg-[#1A1A2E]/5 border-2 border-dashed border-[#1A1A2E]/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-[#1A1A2E]">Cargar desde RUT (PDF)</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Sube el PDF del RUT y extraeremos automáticamente la información con IA
                        </p>
                      </div>
                      <input
                        type="file"
                        ref={pdfInputRef}
                        accept="application/pdf"
                        onChange={handlePdfUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={analyzingPdf}
                        className="flex items-center gap-2 bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl hover:bg-[#252542] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {analyzingPdf ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Analizando...
                          </>
                        ) : (
                          <>
                            <Upload size={18} />
                            Subir RUT
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">NIT o Cédula</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2"
                      value={formData.nit}
                      onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                      placeholder="Ingrese NIT o Cédula"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-lg font-bold">-</span>
                      <input
                        type="text"
                        className="w-14 border border-gray-200 rounded-lg px-2 py-2 text-center"
                        value={formData.check_digit}
                        onChange={(e) => setFormData({ ...formData, check_digit: e.target.value.replace(/[^0-9]/g, '').slice(0, 1) })}
                        placeholder="DV"
                        maxLength={1}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchNit}
                      disabled={searchingNit}
                      className="bg-[#10B981] text-white px-4 py-2 rounded-xl hover:bg-[#059669] disabled:bg-gray-400 transition-colors"
                    >
                      {searchingNit ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Ingrese el NIT y presione Buscar para autocompletar. DV = dígito de verificación (opcional para cédulas)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Empresa / Razón Social *</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Nombre de la empresa"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Nombre del contacto"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dirección</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Ej: CL 45 A 79 61 AP 301"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ciudad</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Ej: Medellín"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Contrato</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.contract_value}
                    onChange={(e) =>
                      setFormData({ ...formData, contract_value: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Inicio Contrato</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.contract_start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, contract_start_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Fin Contrato</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.contract_end_date}
                    onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                  />
                </div>
                {/* Recurring Billing Section */}
                <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                  <h3 className="text-base font-semibold text-[#1A1A2E] mb-3">Facturación Recurrente</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="is_recurring"
                      className="w-4 h-4"
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    />
                    <label htmlFor="is_recurring" className="text-sm font-medium">
                      Este cliente tiene facturación recurrente mensual
                    </label>
                  </div>

                  {formData.is_recurring && (
                    <div className="grid grid-cols-2 gap-4 bg-[#1A1A2E]/5 p-4 rounded-xl">
                      <div>
                        <label className="block text-sm font-medium mb-1">Día de Facturación *</label>
                        <select
                          required={formData.is_recurring}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
                          value={formData.billing_day}
                          onChange={(e) => setFormData({ ...formData, billing_day: parseInt(e.target.value) })}
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Día {day}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          La factura se generará automáticamente este día cada mes
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Monto Mensual *</label>
                        <input
                          type="number"
                          required={formData.is_recurring}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2"
                          value={formData.recurring_amount}
                          onChange={(e) =>
                            setFormData({ ...formData, recurring_amount: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="$0.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Monto que se facturará mensualmente
                        </p>
                      </div>
                      <div className="col-span-2 bg-[#BFFF00]/20 border border-[#BFFF00]/40 p-3 rounded-xl">
                        <p className="text-sm text-[#1A1A2E]">
                          ℹ️ <strong>Importante:</strong> La primera factura se creará automáticamente el día {formData.billing_day} de este mes.
                          Las siguientes facturas se generarán automáticamente cada mes mientras el cliente esté activo.
                        </p>
                      </div>
                    </div>
                  )}
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
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Clients;
