import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI, tasksAPI, teamAPI, tagsAPI, subtasksAPI } from '../utils/api';
import {
  ArrowLeft,
  Home,
  Building2,
  Edit,
  MoreVertical,
  CheckCircle2,
  Clock,
  Users,
  DollarSign,
  Calendar,
  LayoutGrid,
  Table,
  List,
  Plus
} from 'lucide-react';
import KanbanView from '../components/tasks/KanbanView';
import ListView from '../components/tasks/ListView';
import TableView from '../components/TableView';
import SubtaskList from '../components/SubtaskList';
import TagSelector from '../components/TagSelector';

const statusLabels = {
  layout: 'Layout',
  diseno_3d: 'Diseño 3D',
  materializacion: 'Materialización',
  presupuesto: 'Presupuesto',
  cierre: 'Cierre',
  postventas: 'Postventas',
};

const statusColors = {
  layout: 'bg-teal-100 text-teal-700',
  diseno_3d: 'bg-cyan-100 text-cyan-700',
  materializacion: 'bg-blue-100 text-blue-700',
  presupuesto: 'bg-indigo-100 text-indigo-700',
  cierre: 'bg-purple-100 text-purple-700',
  postventas: 'bg-pink-100 text-pink-700',
};

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data states
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [taskTags, setTaskTags] = useState({});
  const [taskSubtaskProgress, setTaskSubtaskProgress] = useState({});
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table' | 'list'

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_ids: [],
    status: 'todo',
    priority: 'medium',
    due_date: '',
    delivery_url: '',
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectRes, tasksRes, teamRes, tagsRes] = await Promise.all([
        projectsAPI.getById(id),
        tasksAPI.getAll({ project_id: id }),
        teamAPI.getAll({ status: 'active' }),
        tagsAPI.getAll(),
      ]);

      setProject(projectRes.data);
      setTasks(tasksRes.data || []);
      setTeamMembers(teamRes.data || []);
      setAllTags(tagsRes.data || []);

      // Load tags and subtask progress for each task
      const tasksList = tasksRes.data || [];
      const tagsMap = {};
      const progressMap = {};

      await Promise.all(tasksList.map(async (task) => {
        try {
          const [taskTagsRes, progressRes] = await Promise.all([
            tagsAPI.getByTask(task.id),
            subtasksAPI.getProgress(task.id),
          ]);
          tagsMap[task.id] = taskTagsRes.data || [];
          progressMap[task.id] = progressRes.data || { total: 0, completed: 0, progress: 0 };
        } catch {
          tagsMap[task.id] = [];
          progressMap[task.id] = { total: 0, completed: 0, progress: 0 };
        }
      }));

      setTaskTags(tagsMap);
      setTaskSubtaskProgress(progressMap);
    } catch (error) {
      console.error('Error loading project:', error);
      alert('Error al cargar el proyecto');
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

    // Get unique team members from all tasks
    const uniqueMembers = new Set();
    tasks.forEach(t => {
      if (t.assignees) {
        t.assignees.forEach(a => uniqueMembers.add(a.id));
      }
    });

    // Tasks by status
    const byStatus = {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: completedTasks,
    };

    return {
      totalTasks,
      completedTasks,
      progress,
      totalHours,
      teamCount: uniqueMembers.size,
      byStatus,
    };
  }, [tasks]);

  // Task handlers
  const handleTaskClick = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assignee_ids: (task.assignees || []).map(a => a.id),
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      delivery_url: task.delivery_url || '',
    });
    setSelectedTagIds((taskTags[task.id] || []).map(t => t.id));
    setShowModal(true);
  };

  const handleAddTask = (status = 'todo') => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      assignee_ids: [],
      status,
      priority: 'medium',
      due_date: '',
      delivery_url: '',
    });
    setSelectedTagIds([]);
    setShowModal(true);
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await tasksAPI.update(task.id, { status: newStatus });
      await loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await tasksAPI.delete(taskId);
      await loadData();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error al eliminar la tarea');
    }
  };

  // Quick create task (from ListView inline add)
  const handleCreateTask = async (taskData) => {
    try {
      const response = await tasksAPI.create({
        ...taskData,
        project_id: parseInt(id),
        status: 'todo',
        priority: 'medium',
      });
      // Add task to local state immediately (optimistic update)
      const newTask = response.data;
      setTasks(prev => [...prev, { ...newTask, assignees: [] }]);
      // Return success so ListView knows to keep input active
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error al crear la tarea');
      return false;
    }
  };

  // Inline update task (from ListView)
  const handleUpdateTask = async (taskId, updates) => {
    try {
      await tasksAPI.update(taskId, updates);
      // Update local state immediately (optimistic update)
      setTasks(prev => prev.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      ));
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Error al actualizar la tarea');
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const taskData = {
        ...formData,
        project_id: parseInt(id),
      };

      if (editingTask) {
        await tasksAPI.update(editingTask.id, taskData);
        // Update tags
        await tagsAPI.setForTask(editingTask.id, selectedTagIds);
      } else {
        const res = await tasksAPI.create(taskData);
        // Set tags for new task
        if (res.data?.id) {
          await tagsAPI.setForTask(res.data.id, selectedTagIds);
        }
      }

      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error al guardar la tarea');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#163B3B]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Proyecto no encontrado</p>
        <button
          onClick={() => navigate('/app/projects')}
          className="mt-4 text-[#163B3B] hover:underline"
        >
          Volver a proyectos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/app/projects')}
            className="flex items-center gap-2 text-gray-500 hover:text-[#163B3B] transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver a proyectos</span>
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-[#163B3B] hover:bg-gray-100 rounded-lg transition-colors">
              <Edit size={18} />
            </button>
            <button className="p-2 text-gray-400 hover:text-[#163B3B] hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Project info */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${project.project_type === 'comercial' ? 'bg-purple-100' : 'bg-teal-100'}`}>
              {project.project_type === 'comercial' ? (
                <Building2 size={20} className="text-purple-600" />
              ) : (
                <Home size={20} className="text-teal-600" />
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[project.status]}`}>
              {statusLabels[project.status]}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#163B3B] mb-1">{project.name}</h1>
          {project.client_name && (
            <p className="text-gray-500">Cliente: {project.client_name}</p>
          )}
          {project.description && (
            <p className="text-gray-600 mt-2">{project.description}</p>
          )}
        </div>

        {/* Metrics cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <CheckCircle2 size={16} />
              <span className="text-xs uppercase tracking-wide">Progreso</span>
            </div>
            <p className="text-2xl font-bold text-[#163B3B]">{metrics.progress}%</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <List size={16} />
              <span className="text-xs uppercase tracking-wide">Tareas</span>
            </div>
            <p className="text-2xl font-bold text-[#163B3B]">
              {metrics.completedTasks}/{metrics.totalTasks}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Clock size={16} />
              <span className="text-xs uppercase tracking-wide">Horas Est.</span>
            </div>
            <p className="text-2xl font-bold text-[#163B3B]">{metrics.totalHours}h</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users size={16} />
              <span className="text-xs uppercase tracking-wide">Equipo</span>
            </div>
            <p className="text-2xl font-bold text-[#163B3B]">{metrics.teamCount}</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <DollarSign size={16} />
              <span className="text-xs uppercase tracking-wide">Presupuesto</span>
            </div>
            <p className="text-xl font-bold text-[#163B3B]">{formatCurrency(project.budget)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Progreso del proyecto</span>
            <span>{metrics.progress}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#163B3B] to-[#E8C4B8] rounded-full transition-all duration-500"
              style={{ width: `${metrics.progress}%` }}
            />
          </div>
        </div>

        {/* Dates and status breakdown */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-4 text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>Inicio: {formatDate(project.start_date)}</span>
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>Fin: {formatDate(project.end_date)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-400">Tareas:</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{metrics.byStatus.todo} por hacer</span>
            <span className="px-2 py-0.5 bg-[#163B3B]/10 text-[#163B3B] rounded-full text-xs">{metrics.byStatus.in_progress} en progreso</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">{metrics.byStatus.review} en revisión</span>
            <span className="px-2 py-0.5 bg-[#E8C4B8]/30 text-[#A67060] rounded-full text-xs">{metrics.byStatus.done} completadas</span>
          </div>
        </div>
      </div>

      {/* Tasks section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        {/* View tabs and actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-white text-[#163B3B] shadow-sm' : 'text-gray-500 hover:text-[#163B3B]'
              }`}
            >
              <LayoutGrid size={16} />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-white text-[#163B3B] shadow-sm' : 'text-gray-500 hover:text-[#163B3B]'
              }`}
            >
              <Table size={16} />
              Tabla
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-[#163B3B] shadow-sm' : 'text-gray-500 hover:text-[#163B3B]'
              }`}
            >
              <List size={16} />
              Lista
            </button>
          </div>

          {viewMode !== 'table' && (
            <button
              onClick={() => handleAddTask()}
              className="flex items-center gap-2 px-4 py-2 bg-[#163B3B] text-white rounded-xl hover:bg-[#1e4d4d] transition-colors"
            >
              <Plus size={18} />
              Nueva tarea
            </button>
          )}
        </div>

        {/* Task views */}
        {viewMode === 'kanban' && (
          <KanbanView
            tasks={tasks}
            taskTags={taskTags}
            taskSubtaskProgress={taskSubtaskProgress}
            onTaskClick={handleTaskClick}
            onAddTask={handleAddTask}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {viewMode === 'table' && (
          <TableView projectId={parseInt(id)} />
        )}

        {viewMode === 'list' && (
          <ListView
            tasks={tasks}
            taskTags={taskTags}
            taskSubtaskProgress={taskSubtaskProgress}
            teamMembers={teamMembers}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
          />
        )}
      </div>

      {/* Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-[#163B3B]">
                {editingTask ? 'Editar tarea' : 'Nueva tarea'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  >
                    <option value="todo">Por hacer</option>
                    <option value="in_progress">En progreso</option>
                    <option value="review">En revisión</option>
                    <option value="done">Completado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsables</label>
                <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl min-h-[44px]">
                  {formData.assignee_ids.map((memberId) => {
                    const member = teamMembers.find(m => m.id === memberId);
                    return member ? (
                      <span
                        key={memberId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[#163B3B]/10 text-[#163B3B] rounded-lg text-sm"
                      >
                        {member.name}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            assignee_ids: formData.assignee_ids.filter(id => id !== memberId)
                          })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                  <select
                    value=""
                    onChange={(e) => {
                      const memberId = parseInt(e.target.value);
                      if (memberId && !formData.assignee_ids.includes(memberId)) {
                        setFormData({
                          ...formData,
                          assignee_ids: [...formData.assignee_ids, memberId]
                        });
                      }
                    }}
                    className="flex-1 min-w-[120px] border-none focus:ring-0 text-sm text-gray-500"
                  >
                    <option value="">+ Agregar responsable</option>
                    {teamMembers
                      .filter(m => !formData.assignee_ids.includes(m.id))
                      .map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de entrega</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link de entrega</label>
                  <input
                    type="url"
                    value={formData.delivery_url}
                    onChange={(e) => setFormData({ ...formData, delivery_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                <TagSelector
                  taskId={editingTask?.id}
                  selectedTagIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                />
              </div>

              {/* Subtasks for existing tasks */}
              {editingTask && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtareas</label>
                  <SubtaskList
                    taskId={editingTask.id}
                    onProgressChange={() => loadData()}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#163B3B] text-white rounded-xl hover:bg-[#1e4d4d] transition-colors"
                >
                  {editingTask ? 'Guardar cambios' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
