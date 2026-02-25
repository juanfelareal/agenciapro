import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsAPI, invoicesAPI, pdfAnalysisAPI, portalAdminAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, FileText, Settings, Upload, Loader2, CheckSquare, Square, MinusSquare, Users, Copy, Check, Key, RefreshCw, Shield } from 'lucide-react';

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

  // Portal configuration state
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalClient, setPortalClient] = useState(null);
  const [portalSettings, setPortalSettings] = useState({
    can_view_projects: true,
    can_view_tasks: true,
    can_view_invoices: true,
    can_view_metrics: false,
    can_approve_tasks: true,
    can_comment_tasks: true,
    can_view_team: false,
    can_download_files: true,
    welcome_message: ''
  });
  const [portalTokens, setPortalTokens] = useState([]);
  const [newInviteCode, setNewInviteCode] = useState(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Resizable columns
  const tableRef = useRef(null);
  const [columnWidths, setColumnWidths] = useState({
    checkbox: 48,
    empresa: 320,
    nit: 130,
    contacto: 200,
    email: 200,
    estado: 80,
    valor: 130,
    acciones: 140,
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
        setFormData({
          ...formData,
          nit: data.nit || formData.nit,
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
  const isAllSelected = clients.length > 0 && clients.every(c => selectedIds.has(c.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map(c => c.id)));
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

  // Portal configuration functions
  const handleOpenPortalConfig = async (client) => {
    setPortalClient(client);
    setShowPortalModal(true);
    setNewInviteCode(null);
    setCopiedCode(false);
    setLoadingPortal(true);

    try {
      // Load settings and tokens in parallel
      const [settingsRes, tokensRes] = await Promise.all([
        portalAdminAPI.getSettings(client.id),
        portalAdminAPI.getAccess(client.id)
      ]);

      setPortalSettings(settingsRes.settings || {
        can_view_projects: true,
        can_view_tasks: true,
        can_view_invoices: true,
        can_view_metrics: false,
        can_approve_tasks: true,
        can_comment_tasks: true,
        can_view_team: false,
        can_download_files: true,
        welcome_message: ''
      });
      // tokensRes is an array directly, not { tokens: [] }
      setPortalTokens(Array.isArray(tokensRes) ? tokensRes : (tokensRes.tokens || []));
    } catch (error) {
      console.error('Error loading portal config:', error);
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleSavePortalSettings = async () => {
    if (!portalClient) return;
    setLoadingPortal(true);
    try {
      await portalAdminAPI.updateSettings(portalClient.id, portalSettings);
      alert('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving portal settings:', error);
      alert('Error al guardar configuración');
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!portalClient) return;
    setLoadingPortal(true);
    try {
      const response = await portalAdminAPI.generateInvite(portalClient.id);
      // response is { invite_code, client_name, expires_at, portal_url }
      setNewInviteCode(response.invite_code);
      // Reload tokens - tokensRes is an array directly
      const tokensRes = await portalAdminAPI.getAccess(portalClient.id);
      setPortalTokens(Array.isArray(tokensRes) ? tokensRes : (tokensRes.tokens || []));
    } catch (error) {
      console.error('Error generating invite:', error);
      alert('Error al generar código de invitación');
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleRevokeAccess = async (tokenId) => {
    if (!confirm('¿Revocar este acceso? El cliente no podrá entrar más con este token.')) return;
    setLoadingPortal(true);
    try {
      await portalAdminAPI.revokeAccess(portalClient.id, tokenId);
      const tokensRes = await portalAdminAPI.getAccess(portalClient.id);
      setPortalTokens(Array.isArray(tokensRes) ? tokensRes : (tokensRes.tokens || []));
    } catch (error) {
      console.error('Error revoking access:', error);
      alert('Error al revocar acceso');
    } finally {
      setLoadingPortal(false);
    }
  };

  const copyInviteLink = () => {
    if (!newInviteCode) return;
    const link = `${window.location.origin}/portal/login?code=${newInviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table ref={tableRef} className="min-w-[1100px]" style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0) }}>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.empresa }}>
                Empresa
                <ResizeHandle columnKey="empresa" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.nit }}>
                NIT/Cédula
                <ResizeHandle columnKey="nit" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.contacto }}>
                Contacto
                <ResizeHandle columnKey="contacto" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.email }}>
                Email
                <ResizeHandle columnKey="email" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.estado }}>
                Estado
                <ResizeHandle columnKey="estado" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative" style={{ width: columnWidths.valor }}>
                Valor Contrato
                <ResizeHandle columnKey="valor" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: columnWidths.acciones }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((client) => (
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
                <td className="px-4 py-4 font-medium text-[#1A1A2E] truncate" title={client.company || client.name}>{client.company || client.name}</td>
                <td className="px-4 py-4 text-sm text-gray-500 truncate">{client.nit || '-'}</td>
                <td className="px-4 py-4 text-sm text-gray-500 truncate" title={client.name}>{client.name || '-'}</td>
                <td className="px-4 py-4 text-sm text-gray-500 truncate" title={client.email}>{client.email || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      client.status === 'active'
                        ? 'bg-[#10B981]/10 text-[#10B981]'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {client.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-bold text-[#10B981]">
                  ${client.contract_value?.toLocaleString('es-CO') || 0}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => handleFacturar(client)}
                    className="text-gray-400 hover:text-[#10B981] hover:bg-[#10B981]/10 p-1.5 rounded-lg mr-1 transition-colors"
                    title="Facturar"
                  >
                    <FileText size={18} />
                  </button>
                  <button
                    onClick={() => handleOpenPortalConfig(client)}
                    className="text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 p-1.5 rounded-lg mr-1 transition-colors"
                    title="Configurar Portal de Cliente"
                  >
                    <Users size={18} />
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                    Ingrese el NIT y presione Buscar para autocompletar los datos
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

      {/* Portal Configuration Modal */}
      {showPortalModal && portalClient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1A1A2E] rounded-xl flex items-center justify-center">
                  <Shield size={20} className="text-[#BFFF00]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#1A1A2E]">Portal de Cliente</h2>
                  <p className="text-sm text-gray-500">{portalClient.company || portalClient.name}</p>
                </div>
              </div>
              <button onClick={() => setShowPortalModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {loadingPortal ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#1A1A2E]" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Invite Code Section */}
                <div className="bg-[#1A1A2E]/5 border border-[#1A1A2E]/10 rounded-xl p-4">
                  <h3 className="font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                    <Key size={18} />
                    Código de Invitación
                  </h3>

                  {newInviteCode ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-gray-100">
                        <code className="flex-1 text-lg font-mono font-bold text-[#1A1A2E]">
                          {newInviteCode}
                        </code>
                        <button
                          onClick={copyInviteLink}
                          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors"
                        >
                          {copiedCode ? (
                            <>
                              <Check size={16} />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy size={16} />
                              Copiar Link
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        Comparte este link con tu cliente para que acceda al portal:
                      </p>
                      <code className="block text-xs bg-white p-2 rounded-lg border border-gray-100 text-[#1A1A2E] break-all">
                        {window.location.origin}/portal/login?code={newInviteCode}
                      </code>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Genera un código único para que tu cliente acceda al portal.
                      </p>
                      <button
                        onClick={handleGenerateInvite}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors"
                      >
                        <RefreshCw size={16} />
                        Generar Código
                      </button>
                    </div>
                  )}
                </div>

                {/* Permissions Section */}
                <div>
                  <h3 className="font-semibold text-[#1A1A2E] mb-3">Permisos del Portal</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_view_projects}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_view_projects: e.target.checked })}
                      />
                      <span className="text-sm">Ver Proyectos</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_view_tasks}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_view_tasks: e.target.checked })}
                      />
                      <span className="text-sm">Ver Tareas</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_view_invoices}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_view_invoices: e.target.checked })}
                      />
                      <span className="text-sm">Ver Facturas</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_view_metrics}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_view_metrics: e.target.checked })}
                      />
                      <span className="text-sm">Ver Métricas</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_approve_tasks}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_approve_tasks: e.target.checked })}
                      />
                      <span className="text-sm">Aprobar Tareas</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_comment_tasks}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_comment_tasks: e.target.checked })}
                      />
                      <span className="text-sm">Comentar en Tareas</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_view_team}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_view_team: e.target.checked })}
                      />
                      <span className="text-sm">Ver Equipo</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#1A1A2E]"
                        checked={portalSettings.can_download_files}
                        onChange={(e) => setPortalSettings({ ...portalSettings, can_download_files: e.target.checked })}
                      />
                      <span className="text-sm">Descargar Archivos</span>
                    </label>
                  </div>
                </div>

                {/* Welcome Message */}
                <div>
                  <label className="block text-sm font-medium mb-2">Mensaje de Bienvenida (opcional)</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2"
                    rows="2"
                    placeholder="Ej: ¡Bienvenido al portal! Aquí puedes ver el progreso de tu proyecto."
                    value={portalSettings.welcome_message || ''}
                    onChange={(e) => setPortalSettings({ ...portalSettings, welcome_message: e.target.value })}
                  />
                </div>

                {/* Save Settings Button */}
                <button
                  onClick={handleSavePortalSettings}
                  className="w-full py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] font-medium transition-colors"
                >
                  Guardar Configuración
                </button>

                {/* Active Tokens */}
                {portalTokens.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-[#1A1A2E] mb-3">Accesos Activos</h3>
                    <div className="space-y-2">
                      {portalTokens.map((token) => (
                        <div
                          key={token.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                        >
                          <div>
                            <p className="font-mono text-sm text-[#1A1A2E]">
                              {token.token_type === 'invite' ? 'Invitación' : 'Sesión'}: {token.token}
                            </p>
                            <p className="text-xs text-gray-500">
                              {token.status === 'active' ? 'Activo' : token.status === 'pending' ? 'Pendiente' : token.status}
                              {token.last_used_at && ` · Último uso: ${new Date(token.last_used_at).toLocaleDateString('es-CO')}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRevokeAccess(token.id)}
                            className="text-red-500 hover:text-red-600 text-sm font-medium"
                          >
                            Revocar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
