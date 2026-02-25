import { useEffect, useState } from 'react';
import { teamAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Trash2, X, Copy, Check, Users, Key, Eye, EyeOff, Mail } from 'lucide-react';

// All available permissions organized by category
const ALL_PERMISSIONS = [
  // General
  { key: 'dashboard', label: 'Dashboard', icon: '📊', category: 'General' },
  { key: 'metricas', label: 'Métricas', icon: '📈', category: 'General' },
  { key: 'reportes', label: 'Reportes', icon: '📉', category: 'General' },
  // CRM & Projects
  { key: 'clients', label: 'Clientes', icon: '👥', category: 'CRM' },
  { key: 'crm', label: 'CRM', icon: '🎯', category: 'CRM' },
  { key: 'projects', label: 'Proyectos', icon: '📁', category: 'CRM' },
  { key: 'plantillas', label: 'Plantillas Proyecto', icon: '📋', category: 'CRM' },
  // Tasks & Time
  { key: 'tasks', label: 'Tareas', icon: '✅', category: 'Tareas' },
  { key: 'calendario', label: 'Calendario', icon: '📅', category: 'Tareas' },
  { key: 'timesheet', label: 'Timesheet', icon: '⏱️', category: 'Tareas' },
  { key: 'time_reports', label: 'Rep. Tiempo', icon: '⏰', category: 'Tareas' },
  // Finance
  { key: 'invoices', label: 'Facturas', icon: '📄', category: 'Finanzas' },
  { key: 'expenses', label: 'Gastos', icon: '💳', category: 'Finanzas' },
  { key: 'comisiones', label: 'Comisiones', icon: '💰', category: 'Finanzas' },
  { key: 'siigo', label: 'Siigo', icon: '🔗', category: 'Finanzas' },
  // Admin & Tools
  { key: 'team', label: 'Equipo', icon: '👨‍💼', category: 'Admin' },
  { key: 'automatizaciones', label: 'Automatizaciones', icon: '⚡', category: 'Admin' },
  { key: 'notas', label: 'Bloc de Notas', icon: '📝', category: 'Admin' },
  { key: 'sops', label: 'SOPs', icon: '📚', category: 'Admin' },
];

// Permission templates for quick assignment
const PERMISSION_TEMPLATES = [
  {
    name: 'Acceso Completo',
    description: 'Acceso a todos los módulos',
    icon: '🔓',
    permissions: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {}),
  },
  {
    name: 'Operaciones',
    description: 'Tareas, proyectos, clientes y tiempo',
    icon: '⚙️',
    permissions: {
      dashboard: true, metricas: true, clients: true, projects: true, plantillas: true,
      tasks: true, calendario: true, timesheet: true, time_reports: true,
      invoices: false, expenses: false, comisiones: false, siigo: false,
      team: false, automatizaciones: false, notas: true, sops: true, reportes: true,
    },
  },
  {
    name: 'Ventas',
    description: 'Clientes, proyectos y facturas',
    icon: '💼',
    permissions: {
      dashboard: true, metricas: true, clients: true, projects: true, plantillas: false,
      tasks: true, calendario: true, timesheet: false, time_reports: false,
      invoices: true, expenses: false, comisiones: true, siigo: false,
      team: false, automatizaciones: false, notas: true, sops: true, reportes: true,
    },
  },
  {
    name: 'Finanzas',
    description: 'Facturas, gastos y comisiones',
    icon: '💵',
    permissions: {
      dashboard: true, metricas: false, clients: true, projects: false, plantillas: false,
      tasks: false, calendario: false, timesheet: false, time_reports: false,
      invoices: true, expenses: true, comisiones: true, siigo: true,
      team: false, automatizaciones: false, notas: false, sops: false, reportes: true,
    },
  },
  {
    name: 'Solo Tareas',
    description: 'Solo acceso a tareas y calendario',
    icon: '📋',
    permissions: {
      dashboard: false, metricas: false, clients: false, projects: false, plantillas: false,
      tasks: true, calendario: true, timesheet: true, time_reports: false,
      invoices: false, expenses: false, comisiones: false, siigo: false,
      team: false, automatizaciones: false, notas: true, sops: true, reportes: false,
    },
  },
];

// Default permissions for new members
const DEFAULT_PERMISSIONS = {
  dashboard: true, metricas: false, clients: true, projects: true, plantillas: false,
  tasks: true, calendario: true, timesheet: false, time_reports: false,
  invoices: false, expenses: false, comisiones: false, siigo: false,
  team: false, automatizaciones: false, notas: true, sops: true, reportes: false,
};

const Team = () => {
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // PIN Modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMember, setPinMember] = useState(null);
  const [pinValue, setPinValue] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');

  // New member PIN + email invite state
  const [newMemberPin, setNewMemberPin] = useState('');
  const [showNewMemberPin, setShowNewMemberPin] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'member',
    position: '',
    status: 'active',
    hire_date: '',
    birthday: '',
    permissions: { ...DEFAULT_PERMISSIONS },
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const response = await teamAPI.getAll();
      setMembers(response.data);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await teamAPI.update(editingMember.id, formData);
      } else {
        const createData = { ...formData };
        if (newMemberPin) {
          createData.pin = newMemberPin;
          createData.send_email = sendWelcomeEmail;
        }
        await teamAPI.create(createData);
      }
      setShowModal(false);
      setEditingMember(null);
      resetForm();
      loadMembers();
    } catch (error) {
      console.error('Error saving team member:', error);
      alert(error.response?.data?.error || 'Error al guardar miembro');
    }
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    const existingPermissions = member.permissions ? JSON.parse(member.permissions) : {};
    // Merge existing permissions with defaults for any new permission keys
    const mergedPermissions = { ...DEFAULT_PERMISSIONS, ...existingPermissions };
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      position: member.position || '',
      status: member.status,
      hire_date: member.hire_date || '',
      birthday: member.birthday || '',
      permissions: mergedPermissions,
    });
    setSelectedTemplate(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este miembro?')) return;
    try {
      await teamAPI.delete(id);
      loadMembers();
    } catch (error) {
      console.error('Error deleting team member:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'member',
      position: '',
      status: 'active',
      hire_date: '',
      birthday: '',
      permissions: { ...DEFAULT_PERMISSIONS },
    });
    setSelectedTemplate(null);
    setNewMemberPin('');
    setShowNewMemberPin(false);
    setSendWelcomeEmail(true);
  };

  const handleNew = () => {
    resetForm();
    setEditingMember(null);
    setShowModal(true);
  };

  // Apply a permission template
  const applyTemplate = (template) => {
    setSelectedTemplate(template.name);
    setFormData({
      ...formData,
      permissions: { ...template.permissions },
    });
  };

  // Toggle all permissions
  const toggleAllPermissions = (enabled) => {
    const newPermissions = {};
    ALL_PERMISSIONS.forEach(p => {
      newPermissions[p.key] = enabled;
    });
    setFormData({ ...formData, permissions: newPermissions });
    setSelectedTemplate(null);
  };

  // Copy permissions from another member
  const copyPermissionsFromMember = (memberId) => {
    if (!memberId) return;
    const sourceMember = members.find(m => m.id === parseInt(memberId));
    if (sourceMember) {
      const sourcePermissions = sourceMember.permissions ? JSON.parse(sourceMember.permissions) : {};
      const mergedPermissions = { ...DEFAULT_PERMISSIONS, ...sourcePermissions };
      setFormData({ ...formData, permissions: mergedPermissions });
      setSelectedTemplate(null);
    }
  };

  // Get members available for copying permissions (exclude current member being edited)
  const getAvailableMembersForCopy = () => {
    return members.filter(m => !editingMember || m.id !== editingMember.id);
  };

  // PIN Management
  const openPinModal = (member) => {
    setPinMember(member);
    setPinValue('');
    setPinError('');
    setShowPin(false);
    setShowPinModal(true);
  };

  const handleSetPin = async () => {
    if (pinValue.length < 4) {
      setPinError('El PIN debe tener al menos 4 caracteres');
      return;
    }

    setPinLoading(true);
    setPinError('');

    try {
      await teamAPI.setPin(pinMember.id, pinValue);
      setShowPinModal(false);
      setPinMember(null);
      setPinValue('');
      alert('PIN establecido correctamente');
    } catch (error) {
      setPinError(error.response?.data?.error || 'Error al establecer el PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const roleLabels = {
    admin: 'Administrador',
    manager: 'Manager',
    member: 'Miembro',
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1,2,3].map(i => (
          <div key={i} className="h-48 bg-white/50 rounded-2xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Equipo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de miembros del equipo</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
        >
          <Plus size={18} />
          Nuevo Miembro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {members.map((member) => (
          <div key={member.id} className="bg-white rounded-2xl border border-gray-100 p-5 group hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#1A1A2E] flex items-center justify-center text-[#BFFF00] font-semibold text-lg">
                  {member.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1A2E]">{member.name}</h3>
                  <p className="text-xs text-gray-500">{member.position || 'Sin cargo'}</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  member.status === 'active'
                    ? 'bg-[#10B981]/10 text-[#10B981]'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {member.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="space-y-2 mb-4 text-sm text-gray-500">
              <p>📧 {member.email}</p>
              <p>👤 {roleLabels[member.role]}</p>
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => handleEdit(member)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Edit size={14} />
                Editar
              </button>
              {isAdmin && (
                <button
                  onClick={() => openPinModal(member)}
                  className="px-3 py-2 border border-gray-100 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Establecer PIN de acceso"
                >
                  <Key size={14} />
                </button>
              )}
              <button
                onClick={() => handleDelete(member.id)}
                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingMember ? 'Editar Miembro' : 'Nuevo Miembro'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cargo</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rol</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="member">Miembro</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrador</option>
                  </select>
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
                  <label className="block text-sm font-medium mb-1">Fecha de Contratación</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cumpleaños</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  />
                </div>

                {/* PIN + Welcome Email (only for new members) */}
                {!editingMember && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-semibold mb-3">Acceso</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">PIN de acceso *</label>
                        <div className="relative">
                          <input
                            type={showNewMemberPin ? 'text' : 'password'}
                            required
                            minLength={4}
                            value={newMemberPin}
                            onChange={(e) => setNewMemberPin(e.target.value)}
                            placeholder="Mínimo 4 caracteres"
                            className="w-full px-3 py-2 border rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]/30 focus:border-[#BFFF00]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewMemberPin(!showNewMemberPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showNewMemberPin ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          El miembro usará este PIN para iniciar sesión
                        </p>
                      </div>
                      <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendWelcomeEmail}
                          onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                          className="w-4 h-4 accent-[#1A1A2E]"
                        />
                        <Mail size={18} className="text-blue-600" />
                        <div>
                          <span className="text-sm font-medium text-[#1A1A2E]">Enviar email de bienvenida</span>
                          <p className="text-xs text-gray-500">Se enviarán las credenciales de acceso al email del miembro</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Permissions Section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-3">Permisos de Acceso</h3>

                  {/* Permission Templates */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">
                      Plantillas de permisos (aplicar configuración rápida):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSION_TEMPLATES.map((template) => (
                        <button
                          key={template.name}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className={`px-3 py-1.5 text-sm rounded-xl border-2 flex items-center gap-1.5 transition ${
                            selectedTemplate === template.name
                              ? 'border-[#BFFF00] bg-[#BFFF00]/10 text-[#1A1A2E]'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                          title={template.description}
                        >
                          <span>{template.icon}</span>
                          <span>{template.name}</span>
                          {selectedTemplate === template.name && <Check size={14} className="text-[#1A1A2E]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Copy Permissions from Another Member */}
                  {getAvailableMembersForCopy().length > 0 && (
                    <div className="mb-4 p-3 bg-[#1A1A2E]/5 rounded-xl border border-[#1A1A2E]/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={16} className="text-[#1A1A2E]" />
                        <p className="text-sm font-medium text-[#1A1A2E]">
                          Mismos permisos que:
                        </p>
                      </div>
                      <select
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                        onChange={(e) => copyPermissionsFromMember(e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Seleccionar miembro para copiar permisos...
                        </option>
                        {getAvailableMembersForCopy().map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} ({member.position || roleLabels[member.role]})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Los permisos del miembro seleccionado se copiarán automáticamente
                      </p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => toggleAllPermissions(true)}
                      className="text-xs px-2 py-1 bg-[#10B981]/10 text-[#10B981] rounded-lg hover:bg-[#10B981]/20"
                    >
                      Activar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllPermissions(false)}
                      className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      Desactivar todos
                    </button>
                  </div>

                  {/* Permissions Grid by Category */}
                  {['General', 'CRM', 'Tareas', 'Finanzas', 'Admin'].map((category) => (
                    <div key={category} className="mb-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">{category}</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ALL_PERMISSIONS.filter(p => p.category === category).map((permission) => (
                          <label
                            key={permission.key}
                            className={`flex items-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition text-sm ${
                              formData.permissions[permission.key]
                                ? 'border-[#BFFF00] bg-[#BFFF00]/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions[permission.key] || false}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  permissions: {
                                    ...formData.permissions,
                                    [permission.key]: e.target.checked,
                                  },
                                });
                                setSelectedTemplate(null);
                              }}
                              className="w-4 h-4 accent-[#1A1A2E]"
                            />
                            <span>{permission.icon}</span>
                            <span className="font-medium truncate">{permission.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
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

      {/* PIN Modal */}
      {showPinModal && pinMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-[#1A1A2E]">Establecer PIN</h2>
                <p className="text-sm text-gray-500">{pinMember.name}</p>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {pinError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                  {pinError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-2">
                  Nuevo PIN de acceso
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BFFF00]/30 focus:border-[#BFFF00]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  El PIN puede ser una palabra clave memorable (ej: "mipin123")
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2.5 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSetPin}
                disabled={pinLoading || pinValue.length < 4}
                className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {pinLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    Establecer PIN
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
