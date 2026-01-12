import { useEffect, useState } from 'react';
import { comisionesAPI, teamAPI, clientsAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, DollarSign, TrendingUp, Clock, CheckCircle, UserPlus, Copy } from 'lucide-react';

const Comisiones = () => {
  const [commissions, setCommissions] = useState([]);
  const [totals, setTotals] = useState({
    total_net_sales: 0,
    total_commissions: 0,
    pending_amount: 0,
    approved_amount: 0,
    paid_amount: 0,
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [editingCommission, setEditingCommission] = useState(null);

  // Filter states
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [filterMember, setFilterMember] = useState('');
  const [filterClient, setFilterClient] = useState('');

  const [formData, setFormData] = useState({
    team_member_id: '',
    client_id: '',
    otros: '',
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    net_sales: '',
    percentage: '',
    commission_amount: '',
    notes: '',
  });

  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    nit: '',
  });

  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [commissionsRes, teamRes, clientsRes] = await Promise.all([
        comisionesAPI.getMonthlyReport(selectedMonth, selectedYear),
        teamAPI.getAll({ status: 'active' }),
        clientsAPI.getAll('active'),
      ]);
      setCommissions(commissionsRes.data.commissions);
      setTotals(commissionsRes.data.totals);
      setTeamMembers(teamRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        net_sales: parseFloat(formData.net_sales),
        commission_amount: parseFloat(formData.commission_amount),
        team_member_id: parseInt(formData.team_member_id),
        client_id: formData.client_id ? parseInt(formData.client_id) : null,
        otros: formData.client_id ? null : formData.otros || null,
      };

      if (editingCommission) {
        await comisionesAPI.update(editingCommission.id, data);
      } else {
        await comisionesAPI.create(data);
      }
      setShowModal(false);
      setEditingCommission(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving commission:', error);
      alert(error.response?.data?.error || 'Error al guardar comisión');
    }
  };

  const handleEdit = (commission) => {
    setEditingCommission(commission);
    // Calculate percentage from existing data
    const calculatedPercentage = commission.net_sales > 0
      ? ((commission.commission_amount / commission.net_sales) * 100).toFixed(2)
      : '';
    setFormData({
      team_member_id: commission.team_member_id.toString(),
      client_id: commission.client_id ? commission.client_id.toString() : '',
      otros: commission.otros || '',
      month: commission.month,
      year: commission.year,
      net_sales: commission.net_sales.toString(),
      percentage: calculatedPercentage,
      commission_amount: commission.commission_amount.toString(),
      notes: commission.notes || '',
    });
    setShowModal(true);
  };

  const handleDuplicate = (commission) => {
    // Don't set editingCommission so it creates a new record
    setEditingCommission(null);
    // Calculate percentage from existing data
    const calculatedPercentage = commission.net_sales > 0
      ? ((commission.commission_amount / commission.net_sales) * 100).toFixed(2)
      : '';
    setFormData({
      team_member_id: commission.team_member_id.toString(),
      client_id: commission.client_id ? commission.client_id.toString() : '',
      otros: commission.otros || '',
      month: commission.month,
      year: commission.year,
      net_sales: commission.net_sales.toString(),
      percentage: calculatedPercentage,
      commission_amount: commission.commission_amount.toString(),
      notes: commission.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta comisión?')) return;
    try {
      await comisionesAPI.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting commission:', error);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await comisionesAPI.updateStatus(id, newStatus);
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      team_member_id: '',
      client_id: '',
      otros: '',
      month: selectedMonth,
      year: selectedYear,
      net_sales: '',
      percentage: '',
      commission_amount: '',
      notes: '',
    });
  };

  // Auto-calculate commission when net_sales or percentage changes
  const handleNetSalesChange = (value) => {
    const netSales = parseFloat(value) || 0;
    const percentage = parseFloat(formData.percentage) || 0;
    const commission = (netSales * percentage) / 100;
    setFormData({
      ...formData,
      net_sales: value,
      commission_amount: commission > 0 ? commission.toFixed(0) : '',
    });
  };

  const handlePercentageChange = (value) => {
    const percentage = parseFloat(value) || 0;
    const netSales = parseFloat(formData.net_sales) || 0;
    const commission = (netSales * percentage) / 100;
    setFormData({
      ...formData,
      percentage: value,
      commission_amount: commission > 0 ? commission.toFixed(0) : '',
    });
  };

  const handleNew = () => {
    resetForm();
    setEditingCommission(null);
    setShowModal(true);
  };

  const handleClientChange = (value) => {
    if (value === 'new') {
      setShowNewClientModal(true);
    } else {
      setFormData({ ...formData, client_id: value, otros: value ? '' : formData.otros });
    }
  };

  const handleNewClientSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await clientsAPI.create(newClientData);
      const newClient = response.data;

      // Reload clients and select the new one
      const clientsRes = await clientsAPI.getAll('active');
      setClients(clientsRes.data);
      setFormData({ ...formData, client_id: newClient.id.toString(), otros: '' });

      setShowNewClientModal(false);
      setNewClientData({
        name: '',
        email: '',
        phone: '',
        company: '',
        nit: '',
      });
    } catch (error) {
      console.error('Error creating client:', error);
      alert(error.response?.data?.error || 'Error al crear cliente');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getClientDisplay = (commission) => {
    if (commission.client_name) {
      return commission.client_name;
    }
    if (commission.otros) {
      return `Otros: ${commission.otros}`;
    }
    return '-';
  };

  // Filter commissions based on selected filters
  const filteredCommissions = commissions.filter((commission) => {
    if (filterMember && commission.team_member_id.toString() !== filterMember) {
      return false;
    }
    if (filterClient) {
      if (filterClient === 'otros') {
        // Filter for "otros" (no client)
        if (commission.client_id) return false;
      } else {
        if (!commission.client_id || commission.client_id.toString() !== filterClient) {
          return false;
        }
      }
    }
    return true;
  });

  // Calculate filtered totals
  // For net_sales: only count once per unique client (to avoid duplicates when same sale is split between team members)
  const uniqueClientSales = new Map();
  filteredCommissions.forEach((c) => {
    const key = c.client_id ? `client_${c.client_id}` : `otros_${c.otros || 'empty'}_${c.team_member_id}`;
    // Only count net_sales once per client
    if (c.client_id && !uniqueClientSales.has(key)) {
      uniqueClientSales.set(key, c.net_sales);
    } else if (!c.client_id) {
      // For "otros" entries, each is unique (not a duplicate)
      uniqueClientSales.set(key, c.net_sales);
    }
  });

  const filteredTotals = {
    total_net_sales: Array.from(uniqueClientSales.values()).reduce((sum, val) => sum + val, 0),
    total_commissions: filteredCommissions.reduce((sum, c) => sum + c.commission_amount, 0),
    pending_amount: filteredCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0),
    paid_amount: filteredCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Comisiones</h1>
          <p className="text-gray-600">Gestión de comisiones del equipo</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={handleNew}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-600"
          >
            <Plus size={20} />
            Agregar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Miembro:</label>
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Cliente:</label>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
            <option value="otros">Otros (sin cliente)</option>
          </select>
        </div>
        {(filterMember || filterClient) && (
          <button
            onClick={() => {
              setFilterMember('');
              setFilterClient('');
            }}
            className="text-sm text-primary-600 hover:text-primary-700 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ventas Netas</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(filteredTotals.total_net_sales)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Comisiones Totales</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(filteredTotals.total_commissions)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendiente</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(filteredTotals.pending_amount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <CheckCircle className="text-emerald-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pagado</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(filteredTotals.paid_amount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Commissions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Miembro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ventas Netas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comisión
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    {commissions.length === 0
                      ? `No hay comisiones registradas para ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
                      : 'No hay comisiones que coincidan con los filtros seleccionados'}
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-800">{commission.team_member_name}</p>
                        <p className="text-sm text-gray-500">{commission.team_member_position || 'Sin cargo'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      {getClientDisplay(commission)}
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      {formatCurrency(commission.net_sales)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-green-600">
                      {formatCurrency(commission.commission_amount)}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={commission.status}
                        onChange={(e) => handleStatusChange(commission.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-3 py-1 border-0 cursor-pointer ${
                          commission.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : commission.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobado</option>
                        <option value="paid">Pagado</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(commission)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(commission)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Duplicar"
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(commission.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">
                {editingCommission ? 'Editar Comisión' : 'Nueva Comisión'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Miembro del Equipo *</label>
                    <select
                      required
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.team_member_id}
                      onChange={(e) => setFormData({ ...formData, team_member_id: e.target.value })}
                    >
                      <option value="">Seleccionar miembro...</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} {member.position ? `- ${member.position}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Cliente</label>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 border rounded-lg px-3 py-2"
                        value={formData.client_id}
                        onChange={(e) => handleClientChange(e.target.value)}
                      >
                        <option value="">Sin cliente (usar Otros)</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name} {client.company ? `- ${client.company}` : ''}
                          </option>
                        ))}
                        <option value="new">+ Nuevo Cliente</option>
                      </select>
                    </div>
                  </div>

                  {!formData.client_id && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Otros (descripción)</label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.otros}
                        onChange={(e) => setFormData({ ...formData, otros: e.target.value })}
                        placeholder="Ej: Comisión por proyecto especial"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Mes *</label>
                      <select
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.month}
                        onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                      >
                        {months.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Año *</label>
                      <select
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ventas Netas *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.net_sales}
                      onChange={(e) => handleNetSalesChange(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Porcentaje *</label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-full border rounded-lg px-3 py-2 pr-8"
                          value={formData.percentage}
                          onChange={(e) => handlePercentageChange(e.target.value)}
                          placeholder="10"
                        />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Comisión *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.commission_amount}
                        onChange={(e) => setFormData({ ...formData, commission_amount: e.target.value })}
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">Auto-calculado (editable)</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Notas</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2"
                      rows="3"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserPlus size={24} className="text-primary-500" />
                Nuevo Cliente
              </h2>
              <button onClick={() => setShowNewClientModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleNewClientSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      className="w-full border rounded-lg px-3 py-2"
                      value={newClientData.name}
                      onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                      placeholder="Nombre del cliente"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Empresa</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2"
                      value={newClientData.company}
                      onChange={(e) => setNewClientData({ ...newClientData, company: e.target.value })}
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">NIT</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2"
                      value={newClientData.nit}
                      onChange={(e) => setNewClientData({ ...newClientData, nit: e.target.value })}
                      placeholder="NIT de la empresa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full border rounded-lg px-3 py-2"
                      value={newClientData.email}
                      onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Teléfono</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2"
                      value={newClientData.phone}
                      onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                      placeholder="Número de teléfono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Comisiones;
