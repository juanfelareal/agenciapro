import { useEffect, useState } from 'react';
import { teamAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, Copy, Check, Users } from 'lucide-react';

// All available permissions organized by category
const ALL_PERMISSIONS = [
  // General
  { key: 'dashboard', label: 'Dashboard', icon: '📊', category: 'General' },
  { key: 'metricas', label: 'Métricas', icon: '📈', category: 'General' },
  { key: 'reportes', label: 'Reportes', icon: '📉', category: 'General' },
  // CRM & Projects
  { key: 'clients', label: 'Clientes', icon: '👥', category: 'CRM' },
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
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
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
        await teamAPI.create(formData);
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

  const roleLabels = {
    admin: 'Administrador',
    manager: 'Manager',
    member: 'Miembro',
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Equipo</h1>
          <p className="text-gray-600">Gestión de miembros del equipo</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-600"
        >
          <Plus size={20} />
          Nuevo Miembro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.map((member) => (
          <div key={member.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{member.name}</h3>
                <p className="text-sm text-gray-600">{member.position || 'Sin cargo'}</p>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  member.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {member.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600">📧 {member.email}</p>
              <p className="text-sm text-gray-600">👤 {roleLabels[member.role]}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(member)}
                className="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 flex items-center justify-center gap-1"
              >
                <Edit size={16} />
                Editar
              </button>
              <button
                onClick={() => handleDelete(member.id)}
                className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">
                {editingMember ? 'Editar Miembro' : 'Nuevo Miembro'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
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

                {/* Permissions Section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-3">Permisos de Acceso</h3>

                  {/* Permission Templates */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Plantillas de permisos (aplicar configuración rápida):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSION_TEMPLATES.map((template) => (
                        <button
                          key={template.name}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className={`px-3 py-1.5 text-sm rounded-lg border-2 flex items-center gap-1.5 transition ${
                            selectedTemplate === template.name
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                          title={template.description}
                        >
                          <span>{template.icon}</span>
                          <span>{template.name}</span>
                          {selectedTemplate === template.name && <Check size={14} className="text-primary-600" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Copy Permissions from Another Member */}
                  {getAvailableMembersForCopy().length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={16} className="text-blue-600" />
                        <p className="text-sm font-medium text-blue-800">
                          Mismos permisos que:
                        </p>
                      </div>
                      <select
                        className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
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
                      <p className="text-xs text-blue-600 mt-1">
                        Los permisos del miembro seleccionado se copiarán automáticamente
                      </p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => toggleAllPermissions(true)}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Activar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllPermissions(false)}
                      className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
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
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition text-sm ${
                              formData.permissions[permission.key]
                                ? 'border-primary-500 bg-primary-50'
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
                              className="w-4 h-4"
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
    </div>
  );
};

export default Team;
