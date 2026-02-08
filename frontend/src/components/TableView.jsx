import { useEffect, useState } from 'react';
import { tasksAPI, boardColumnsAPI, teamAPI } from '../utils/api';
import { Plus, Edit, Trash2, Settings, GripVertical, MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import TaskComments from './TaskComments';

const TableView = ({ projectId }) => {
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee_ids: [],
    timeline_start: '',
    timeline_end: '',
    progress: 0,
    estimated_hours: 0,
  });

  // Default columns that are always visible
  const defaultColumns = [
    { id: 'title', name: 'Tarea', type: 'text', fixed: true },
    { id: 'status', name: 'Estado', type: 'status', fixed: true },
    { id: 'priority', name: 'Prioridad', type: 'priority', fixed: true },
    { id: 'assigned_to', name: 'Asignado a', type: 'people', fixed: true },
    { id: 'timeline', name: 'Timeline', type: 'timeline', fixed: false },
    { id: 'progress', name: 'Progreso', type: 'progress', fixed: false },
    { id: 'estimated_hours', name: 'Horas Est.', type: 'number', fixed: false },
  ];

  useEffect(() => {
    if (projectId) {
      loadTableData();
    }
  }, [projectId]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      const [tasksRes, columnsRes, teamRes] = await Promise.all([
        tasksAPI.getAll({ project_id: projectId }),
        boardColumnsAPI.getByProject(projectId),
        teamAPI.getAll({ status: 'active' }),
      ]);

      setTasks(tasksRes.data || []);
      setColumns(columnsRes.data || []);
      setTeamMembers(teamRes.data || []);
    } catch (error) {
      console.error('Error loading table data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = async (taskId, field, value) => {
    try {
      await tasksAPI.update(taskId, { [field]: value });
      await loadTableData();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Error al actualizar la tarea');
    }
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assignee_ids: [],
      timeline_start: '',
      timeline_end: '',
      progress: 0,
      estimated_hours: 0,
    });
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignee_ids: (task.assignees || []).map(a => a.id),
      timeline_start: task.timeline_start || '',
      timeline_end: task.timeline_end || '',
      progress: task.progress || 0,
      estimated_hours: task.estimated_hours || 0,
    });
    setShowTaskModal(true);
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    try {
      const taskData = {
        ...formData,
        assignee_ids: formData.assignee_ids.map(Number),
        project_id: projectId,
      };

      if (editingTask) {
        await tasksAPI.update(editingTask.id, taskData);
      } else {
        await tasksAPI.create(taskData);
      }

      setShowTaskModal(false);
      await loadTableData();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error al guardar la tarea');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('¿Está seguro de eliminar esta tarea?')) return;
    try {
      await tasksAPI.delete(taskId);
      await loadTableData();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleOpenComments = (task) => {
    setSelectedTaskForComments(task);
    setShowCommentsModal(true);
  };

  const handleCloseComments = () => {
    setShowCommentsModal(false);
    setSelectedTaskForComments(null);
  };

  const renderCellValue = (task, column) => {
    switch (column.type) {
      case 'text':
        return (
          <div className="font-medium text-gray-900">
            {task[column.id] || '-'}
          </div>
        );

      case 'status':
        return (
          <select
            value={task.status}
            onChange={(e) => handleTaskUpdate(task.id, 'status', e.target.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${getStatusColor(task.status)}`}
          >
            <option value="todo">Por Hacer</option>
            <option value="in_progress">En Progreso</option>
            <option value="review">En Revisión</option>
            <option value="done">Completado</option>
          </select>
        );

      case 'priority':
        return (
          <select
            value={task.priority}
            onChange={(e) => handleTaskUpdate(task.id, 'priority', e.target.value)}
            className={`px-3 py-1 rounded text-sm font-medium border cursor-pointer ${getPriorityColor(task.priority)}`}
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        );

      case 'people':
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {task.assignees?.length > 0 ? (
              <>
                <div className="flex -space-x-1.5">
                  {task.assignees.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className="w-5 h-5 rounded-full bg-[#1A1A2E] text-[#BFFF00] flex items-center justify-center text-[9px] font-medium ring-1 ring-white"
                      title={a.name}
                    >
                      {a.name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                  {task.assignees.length > 3 && (
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[9px] ring-1 ring-white">
                      +{task.assignees.length - 3}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-600 truncate max-w-[100px]">
                  {task.assignees.map(a => a.name).join(', ')}
                </span>
              </>
            ) : task.assigned_to_name ? (
              <span className="text-sm text-gray-600">{task.assigned_to_name}</span>
            ) : (
              <span className="text-sm text-gray-400">Sin asignar</span>
            )}
          </div>
        );

      case 'timeline':
        return (
          <div className="flex gap-2 items-center text-sm">
            <input
              type="date"
              value={task.timeline_start || ''}
              onChange={(e) => handleTaskUpdate(task.id, 'timeline_start', e.target.value)}
              className="border rounded px-2 py-1 text-xs w-32"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={task.timeline_end || ''}
              onChange={(e) => handleTaskUpdate(task.id, 'timeline_end', e.target.value)}
              className="border rounded px-2 py-1 text-xs w-32"
            />
          </div>
        );

      case 'progress':
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{ width: `${task.progress || 0}%` }}
              />
            </div>
            <input
              type="number"
              min="0"
              max="100"
              value={task.progress || 0}
              onChange={(e) => handleTaskUpdate(task.id, 'progress', parseInt(e.target.value) || 0)}
              className="w-14 border rounded px-2 py-1 text-xs text-right"
            />
            <span className="text-xs text-gray-500">%</span>
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={task[column.id] || 0}
            onChange={(e) => handleTaskUpdate(task.id, column.id, parseFloat(e.target.value) || 0)}
            className="w-20 border rounded px-2 py-1 text-sm text-right"
          />
        );

      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      review: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-50 text-green-700 border-green-200',
      medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      high: 'bg-orange-50 text-orange-700 border-orange-200',
      urgent: 'bg-red-50 text-red-700 border-red-200',
    };
    return colors[priority] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando tabla...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Table Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Vista de Tabla</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowColumnSettings(true)}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Settings size={16} />
            Columnas
          </button>
          <button
            onClick={handleNewTask}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2"
          >
            <Plus size={16} />
            Nueva Tarea
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {defaultColumns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.name}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={defaultColumns.length + 1} className="px-4 py-12 text-center text-gray-500">
                  <p className="text-lg font-medium">No hay tareas en este proyecto</p>
                  <p className="text-sm mt-1">Crea la primera tarea para comenzar</p>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  {defaultColumns.map((column) => (
                    <td key={column.id} className="px-4 py-3">
                      {renderCellValue(task, column)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenComments(task)}
                      className="text-primary-600 hover:text-primary-800 mr-3"
                      title="Ver comentarios"
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button
                      onClick={() => handleEditTask(task)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Comments Modal */}
      {showCommentsModal && selectedTaskForComments && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">Comentarios - {selectedTaskForComments.title}</h2>
              <button onClick={handleCloseComments}>
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TaskComments
                taskId={selectedTaskForComments.id}
                taskTitle={selectedTaskForComments.title}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">
                {editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
              </h2>
              <button onClick={() => setShowTaskModal(false)}>
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Título *</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Descripción</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Estado</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="todo">Por Hacer</option>
                      <option value="in_progress">En Progreso</option>
                      <option value="review">En Revisión</option>
                      <option value="done">Completado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Prioridad</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Asignado a</label>
                    <div className="border rounded-lg px-2 py-1.5 flex flex-wrap gap-1 min-h-[38px]">
                      {formData.assignee_ids.map((id) => {
                        const member = teamMembers.find(m => m.id === Number(id));
                        if (!member) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-gray-100 text-sm px-2 py-0.5 rounded">
                            {member.name}
                            <button type="button" onClick={() => setFormData({ ...formData, assignee_ids: formData.assignee_ids.filter(a => a !== id) })} className="text-gray-400 hover:text-red-500">&times;</button>
                          </span>
                        );
                      })}
                      <select
                        className="flex-1 min-w-[100px] border-0 outline-none text-sm"
                        value=""
                        onChange={(e) => {
                          if (e.target.value && !formData.assignee_ids.includes(Number(e.target.value))) {
                            setFormData({ ...formData, assignee_ids: [...formData.assignee_ids, Number(e.target.value)] });
                          }
                          e.target.value = '';
                        }}
                      >
                        <option value="">Agregar persona...</option>
                        {teamMembers.filter(m => !formData.assignee_ids.includes(m.id)).map(member => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Horas Estimadas</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.estimated_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha Inicio</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.timeline_start}
                      onChange={(e) => setFormData({ ...formData, timeline_start: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha Fin</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.timeline_end}
                      onChange={(e) => setFormData({ ...formData, timeline_end: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Progreso: {formData.progress}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="w-full"
                      value={formData.progress}
                      onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  {editingTask ? 'Guardar Cambios' : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableView;
