import { useState, useEffect } from 'react';
import { automationsAPI, projectsAPI, teamAPI, tagsAPI } from '../utils/api';
import {
  Plus,
  Edit2,
  Trash2,
  Zap,
  Play,
  Pause,
  ChevronRight,
  Settings,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

const Automations = () => {
  const [automations, setAutomations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    trigger_type: 'task_created',
    trigger_conditions: {},
    action_type: 'change_status',
    action_params: {},
    is_active: true,
  });

  const triggerTypes = [
    { value: 'task_created', label: 'Tarea creada', description: 'Cuando se crea una nueva tarea' },
    { value: 'status_change', label: 'Cambio de estado', description: 'Cuando el estado de una tarea cambia' },
    { value: 'task_assigned', label: 'Tarea asignada', description: 'Cuando se asigna una tarea a alguien' },
    { value: 'priority_change', label: 'Cambio de prioridad', description: 'Cuando cambia la prioridad de una tarea' },
    { value: 'due_date_approaching', label: 'Fecha límite próxima', description: 'X días antes de la fecha de vencimiento' },
  ];

  const actionTypes = [
    { value: 'change_status', label: 'Cambiar estado', description: 'Cambiar el estado de la tarea' },
    { value: 'assign_user', label: 'Asignar usuario', description: 'Asignar la tarea a un usuario' },
    { value: 'add_tag', label: 'Agregar etiqueta', description: 'Agregar una etiqueta a la tarea' },
    { value: 'send_notification', label: 'Enviar notificación', description: 'Crear una notificación' },
    { value: 'change_priority', label: 'Cambiar prioridad', description: 'Cambiar la prioridad de la tarea' },
  ];

  const statusOptions = [
    { value: 'todo', label: 'Por Hacer' },
    { value: 'in_progress', label: 'En Progreso' },
    { value: 'review', label: 'En Revisión' },
    { value: 'done', label: 'Completada' },
  ];

  const priorityOptions = [
    { value: 'low', label: 'Baja' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [automationsRes, projectsRes, teamRes, tagsRes] = await Promise.all([
        automationsAPI.getAll(),
        projectsAPI.getAll(),
        teamAPI.getAll(),
        tagsAPI.getAll(),
      ]);
      setAutomations(automationsRes.data);
      setProjects(projectsRes.data);
      setTeamMembers(teamRes.data);
      setTags(tagsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAutomation) {
        await automationsAPI.update(editingAutomation.id, formData);
      } else {
        await automationsAPI.create(formData);
      }
      loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving automation:', error);
    }
  };

  const handleEdit = (automation) => {
    setEditingAutomation(automation);
    setFormData({
      project_id: automation.project_id || '',
      name: automation.name,
      trigger_type: automation.trigger_type,
      trigger_conditions: automation.trigger_conditions
        ? JSON.parse(automation.trigger_conditions)
        : {},
      action_type: automation.action_type,
      action_params: automation.action_params
        ? JSON.parse(automation.action_params)
        : {},
      is_active: automation.is_active === 1,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta automatización?')) return;
    try {
      await automationsAPI.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting automation:', error);
    }
  };

  const handleToggle = async (id) => {
    try {
      await automationsAPI.toggle(id);
      loadData();
    } catch (error) {
      console.error('Error toggling automation:', error);
    }
  };

  const resetForm = () => {
    setEditingAutomation(null);
    setFormData({
      project_id: '',
      name: '',
      trigger_type: 'task_created',
      trigger_conditions: {},
      action_type: 'change_status',
      action_params: {},
      is_active: true,
    });
    setShowModal(false);
  };

  const updateTriggerCondition = (key, value) => {
    setFormData({
      ...formData,
      trigger_conditions: {
        ...formData.trigger_conditions,
        [key]: value,
      },
    });
  };

  const updateActionParam = (key, value) => {
    setFormData({
      ...formData,
      action_params: {
        ...formData.action_params,
        [key]: value,
      },
    });
  };

  const renderTriggerConditions = () => {
    switch (formData.trigger_type) {
      case 'status_change':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Desde estado (opcional)</label>
              <select
                className="select"
                value={formData.trigger_conditions.from_status || ''}
                onChange={(e) => updateTriggerCondition('from_status', e.target.value || undefined)}
              >
                <option value="">Cualquier estado</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hacia estado</label>
              <select
                className="select"
                value={formData.trigger_conditions.to_status || ''}
                onChange={(e) => updateTriggerCondition('to_status', e.target.value || undefined)}
              >
                <option value="">Cualquier estado</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'task_assigned':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Asignado a (opcional)</label>
            <select
              className="select"
              value={formData.trigger_conditions.assigned_to || ''}
              onChange={(e) => updateTriggerCondition('assigned_to', e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">Cualquier usuario</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
        );

      case 'priority_change':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Desde prioridad (opcional)</label>
              <select
                className="select"
                value={formData.trigger_conditions.from_priority || ''}
                onChange={(e) => updateTriggerCondition('from_priority', e.target.value || undefined)}
              >
                <option value="">Cualquier prioridad</option>
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hacia prioridad</label>
              <select
                className="select"
                value={formData.trigger_conditions.to_priority || ''}
                onChange={(e) => updateTriggerCondition('to_priority', e.target.value || undefined)}
              >
                <option value="">Cualquier prioridad</option>
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'due_date_approaching':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Días antes</label>
            <input
              type="number"
              className="input"
              min="1"
              value={formData.trigger_conditions.days_before || 1}
              onChange={(e) => updateTriggerCondition('days_before', parseInt(e.target.value))}
            />
          </div>
        );

      case 'task_created':
      default:
        return (
          <div className="text-sm text-gray-500 italic">
            Esta automatización se ejecutará cuando se cree cualquier tarea nueva.
          </div>
        );
    }
  };

  const renderActionParams = () => {
    switch (formData.action_type) {
      case 'change_status':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Nuevo estado *</label>
            <select
              className="select"
              value={formData.action_params.status || ''}
              onChange={(e) => updateActionParam('status', e.target.value)}
              required
            >
              <option value="">Seleccionar estado</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case 'assign_user':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Asignar a *</label>
            <select
              className="select"
              value={formData.action_params.user_id || ''}
              onChange={(e) => updateActionParam('user_id', parseInt(e.target.value))}
              required
            >
              <option value="">Seleccionar usuario</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
        );

      case 'add_tag':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Etiqueta *</label>
            <select
              className="select"
              value={formData.action_params.tag_id || ''}
              onChange={(e) => updateActionParam('tag_id', parseInt(e.target.value))}
              required
            >
              <option value="">Seleccionar etiqueta</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>
        );

      case 'send_notification':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mensaje *</label>
              <textarea
                className="input"
                rows="3"
                value={formData.action_params.message || ''}
                onChange={(e) => updateActionParam('message', e.target.value)}
                placeholder="Mensaje de la notificación..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Enviar a (opcional)</label>
              <select
                className="select"
                value={formData.action_params.user_id || ''}
                onChange={(e) => updateActionParam('user_id', e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">Usuario asignado a la tarea</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'change_priority':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Nueva prioridad *</label>
            <select
              className="select"
              value={formData.action_params.priority || ''}
              onChange={(e) => updateActionParam('priority', e.target.value)}
              required
            >
              <option value="">Seleccionar prioridad</option>
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  const getTriggerLabel = (type) => triggerTypes.find((t) => t.value === type)?.label || type;
  const getActionLabel = (type) => actionTypes.find((a) => a.value === type)?.label || type;

  if (loading) {
    return <div className="text-center py-8">Cargando automatizaciones...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Automatizaciones</h1>
          <p className="text-gray-600">Configura reglas para automatizar tu flujo de trabajo</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Nueva Automatización
        </button>
      </div>

      {/* Automations List */}
      {automations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Zap size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No hay automatizaciones</h3>
          <p className="text-gray-500 mb-6">
            Crea tu primera automatización para optimizar tu flujo de trabajo
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            Crear Automatización
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className={`bg-white rounded-lg shadow p-5 border-l-4 transition-all ${
                automation.is_active
                  ? 'border-l-primary-500'
                  : 'border-l-gray-300 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap
                      size={20}
                      className={automation.is_active ? 'text-primary-500' : 'text-gray-400'}
                    />
                    <h3 className="text-lg font-semibold text-gray-800">
                      {automation.name}
                    </h3>
                    {automation.project_name && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {automation.project_name}
                      </span>
                    )}
                    {automation.is_active ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        <CheckCircle size={12} />
                        Activa
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        <AlertCircle size={12} />
                        Inactiva
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      {getTriggerLabel(automation.trigger_type)}
                    </span>
                    <ChevronRight size={16} className="text-gray-400" />
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                      {getActionLabel(automation.action_type)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(automation.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      automation.is_active
                        ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                    title={automation.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {automation.is_active ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    onClick={() => handleEdit(automation)}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(automation.id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Settings size={24} />
                {editingAutomation ? 'Editar Automatización' : 'Nueva Automatización'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Auto-asignar tareas urgentes"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Proyecto (opcional)</label>
                  <select
                    className="select"
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Todas las tareas (global)</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Si no seleccionas un proyecto, la automatización se aplicará a todas las tareas.
                  </p>
                </div>
              </div>

              {/* Trigger Section */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Zap size={18} />
                  Cuando...
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de disparador *</label>
                    <select
                      className="select"
                      value={formData.trigger_type}
                      onChange={(e) => setFormData({
                        ...formData,
                        trigger_type: e.target.value,
                        trigger_conditions: {},
                      })}
                    >
                      {triggerTypes.map((trigger) => (
                        <option key={trigger.value} value={trigger.value}>
                          {trigger.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-600 mt-1">
                      {triggerTypes.find((t) => t.value === formData.trigger_type)?.description}
                    </p>
                  </div>

                  {/* Trigger Conditions */}
                  <div className="mt-4">
                    {renderTriggerConditions()}
                  </div>
                </div>
              </div>

              {/* Action Section */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <ChevronRight size={18} />
                  Entonces...
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de acción *</label>
                    <select
                      className="select"
                      value={formData.action_type}
                      onChange={(e) => setFormData({
                        ...formData,
                        action_type: e.target.value,
                        action_params: {},
                      })}
                    >
                      {actionTypes.map((action) => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-600 mt-1">
                      {actionTypes.find((a) => a.value === formData.action_type)?.description}
                    </p>
                  </div>

                  {/* Action Params */}
                  <div className="mt-4">
                    {renderActionParams()}
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  className="w-5 h-5 rounded text-primary-500"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Automatización activa
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAutomation ? 'Guardar Cambios' : 'Crear Automatización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automations;
