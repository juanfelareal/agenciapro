import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI, tasksAPI, teamAPI, tagsAPI, subtasksAPI, clientsAPI, formsAPI, projectTemplatesAPI } from '../utils/api';
import {
  ArrowLeft,
  Home,
  Building2,
  Edit,
  MoreVertical,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  LayoutGrid,
  Table,
  List,
  Plus,
  Eye,
  EyeOff,
  X,
  Copy,
  Search,
  Loader2,
  ChevronRight,
  Check,
} from 'lucide-react';
import KanbanView from '../components/tasks/KanbanView';
import ListView from '../components/tasks/ListView';
import TableView from '../components/TableView';
import SubtaskList from '../components/SubtaskList';
import TagSelector from '../components/TagSelector';
import TaskDescriptionEditor from '../components/TaskDescriptionEditor';

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

  // Project edit states
  const [showProjectEditModal, setShowProjectEditModal] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [clients, setClients] = useState([]);
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    start_date: '',
    end_date: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_ids: [],
    status: 'todo',
    priority: 'medium',
    due_date: '',
    delivery_url: '',
    linked_form_id: '',
  });
  const [availableForms, setAvailableForms] = useState([]);

  // Apply-template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  // Close open modals with the Escape key
  useEffect(() => {
    if (!showModal && !showProjectEditModal) return;
    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showModal) setShowModal(false);
      else if (showProjectEditModal) setShowProjectEditModal(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showModal, showProjectEditModal]);

  const loadData = async () => {
    try {
      const [projectRes, tasksRes, teamRes, tagsRes, formsRes] = await Promise.all([
        projectsAPI.getById(id),
        tasksAPI.getAll({ project_id: id }),
        teamAPI.getAll({ status: 'active' }),
        tagsAPI.getAll(),
        formsAPI.getAll({ status: 'published' }),
      ]);
      setAvailableForms(formsRes.data || []);

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
      linked_form_id: task.linked_form_id || '',
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
      linked_form_id: '',
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
        await tagsAPI.setTaskTags(editingTask.id, selectedTagIds);
      } else {
        const res = await tasksAPI.create(taskData);
        // Set tags for new task
        if (res.data?.id) {
          await tagsAPI.setTaskTags(res.data.id, selectedTagIds);
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

  const handleEditProject = async () => {
    setProjectFormData({
      name: project.name || '',
      description: project.description || '',
      client_id: project.client_id || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    });
    try {
      const clientsRes = await clientsAPI.getAll('active');
      setClients(clientsRes.data || []);
    } catch { /* ignore */ }
    setShowProjectEditModal(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    try {
      setSavingProject(true);
      await projectsAPI.update(parseInt(id), projectFormData);
      setShowProjectEditModal(false);
      await loadData();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Error al guardar el proyecto');
    } finally {
      setSavingProject(false);
    }
  };

  if (loading && !project) {
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
            <button
              onClick={handleEditProject}
              className="p-2 text-gray-400 hover:text-[#163B3B] hover:bg-gray-100 rounded-lg transition-colors"
              title="Editar proyecto"
            >
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
            <div className="flex items-center gap-3">
              <p className="text-gray-500">Cliente: {project.client_name}</p>
              <button
                onClick={async () => {
                  const allVisible = tasks.every(t => t.visible_to_client);
                  const newValue = !allVisible;
                  try {
                    await tasksAPI.bulkVisibility(project.id, newValue);
                    setTasks(tasks.map(t => ({ ...t, visible_to_client: newValue ? 1 : 0 })));
                  } catch (error) {
                    console.error('Error:', error);
                    alert('Error al actualizar visibilidad');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  tasks.length > 0 && tasks.every(t => t.visible_to_client)
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title={tasks.every(t => t.visible_to_client) ? 'Ocultar tareas del portal del cliente' : 'Mostrar tareas en el portal del cliente'}
              >
                {tasks.every(t => t.visible_to_client) ? <Eye size={14} /> : <EyeOff size={14} />}
                {tasks.every(t => t.visible_to_client) ? 'Visible al cliente' : 'Oculto al cliente'}
              </button>
            </div>
          )}
          {project.description && (
            <p className="text-gray-600 mt-2">{project.description}</p>
          )}
        </div>

        {/* Metrics cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                title="Cargar tareas desde una plantilla"
              >
                <Copy size={16} />
                Aplicar plantilla
              </button>
              <button
                onClick={() => handleAddTask()}
                className="flex items-center gap-2 px-4 py-2 bg-[#163B3B] text-white rounded-xl hover:bg-[#1e4d4d] transition-colors"
              >
                <Plus size={18} />
                Nueva tarea
              </button>
            </div>
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

      {/* Project Edit Modal */}
      {showProjectEditModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowProjectEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#163B3B]">Editar proyecto</h2>
              <button
                type="button"
                onClick={() => setShowProjectEditModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#163B3B] transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={projectFormData.description}
                  onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={projectFormData.client_id}
                  onChange={(e) => setProjectFormData({ ...projectFormData, client_id: e.target.value || null })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                >
                  <option value="">Sin cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company || c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={projectFormData.start_date}
                    onChange={(e) => setProjectFormData({ ...projectFormData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={projectFormData.end_date}
                    onChange={(e) => setProjectFormData({ ...projectFormData, end_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowProjectEditModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="px-4 py-2 bg-[#163B3B] text-white rounded-xl hover:bg-[#1e4d4d] transition-colors disabled:opacity-50"
                >
                  {savingProject ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#163B3B]">
                {editingTask ? 'Editar tarea' : 'Nueva tarea'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#163B3B] transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
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
                <TaskDescriptionEditor
                  value={formData.description}
                  onChange={(json) => setFormData({ ...formData, description: json })}
                  placeholder="Descripción de la tarea... (puedes pegar imágenes)"
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

              {availableForms.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formulario vinculado</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#163B3B] focus:border-transparent bg-white"
                    value={formData.linked_form_id || ''}
                    onChange={(e) => setFormData({ ...formData, linked_form_id: e.target.value ? parseInt(e.target.value) : '' })}
                  >
                    <option value="">Sin formulario</option>
                    {availableForms.map(f => (
                      <option key={f.id} value={f.id}>{f.title}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">El cliente verá un botón para llenar este formulario</p>
                </div>
              )}

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
                    onProgressChange={(progress) =>
                      setTaskSubtaskProgress((prev) => ({
                        ...prev,
                        [editingTask.id]: progress,
                      }))
                    }
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

      {/* Apply template modal */}
      {showTemplateModal && (
        <ApplyTemplateModal
          projectId={Number(id)}
          teamMembers={teamMembers}
          onClose={() => setShowTemplateModal(false)}
          onApplied={async () => {
            setShowTemplateModal(false);
            await loadData();
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// ApplyTemplateModal — selecciona plantilla, previsualiza tareas
// (con asignados por defecto), permite override por tarea, y aplica.
// ============================================================
function ApplyTemplateModal({ projectId, teamMembers, onClose, onApplied }) {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // template object with tasks
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assigneeOverrides, setAssigneeOverrides] = useState({}); // { template_task_id: assignee_id|null }
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    projectTemplatesAPI.getAll()
      .then((res) => { if (!cancelled) setTemplates(res.data || []); })
      .catch(() => { if (!cancelled) setTemplates([]); })
      .finally(() => { if (!cancelled) setLoadingTemplates(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return templates;
    const s = search.toLowerCase();
    return templates.filter((t) =>
      (t.name || '').toLowerCase().includes(s) ||
      (t.description || '').toLowerCase().includes(s) ||
      (t.category || '').toLowerCase().includes(s)
    );
  }, [templates, search]);

  const handleSelectTemplate = async (template) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await projectTemplatesAPI.getById(template.id);
      setSelected(res.data);
      // Initialize overrides to template defaults so the user can see them
      const init = {};
      for (const t of res.data.tasks || []) {
        init[t.id] = t.default_assignee_id || null;
      }
      setAssigneeOverrides(init);
    } catch (e) {
      setError(e?.response?.data?.error || 'Error al cargar la plantilla');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    setError(null);
    try {
      const res = await projectTemplatesAPI.apply(selected.id, projectId, assigneeOverrides);
      await onApplied(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo aplicar la plantilla');
      setApplying(false);
    }
  };

  const memberName = (id) => teamMembers.find((m) => m.id === id)?.name;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selected && (
              <button
                onClick={() => { setSelected(null); setAssigneeOverrides({}); }}
                className="text-gray-400 hover:text-gray-700 text-sm flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                Cambiar plantilla
              </button>
            )}
            <h2 className="text-lg font-semibold text-[#1A1A2E]">
              {selected ? selected.name : 'Aplicar plantilla'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {!selected ? (
          // ----- Step 1: pick a template -----
          <div className="p-6 overflow-y-auto flex-1">
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar plantilla por nombre, descripción o categoría..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                autoFocus
              />
            </div>

            {loadingTemplates ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Copy className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">
                  {templates.length === 0
                    ? 'Aún no hay plantillas. Crea una desde "Plantillas".'
                    : 'No hay resultados para esa búsqueda.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className="text-left p-4 rounded-xl border border-gray-200 hover:border-[#163B3B] hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-[#1A1A2E] text-sm">{t.name}</p>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-[#163B3B] flex-shrink-0" />
                    </div>
                    {t.category && (
                      <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 mb-2">
                        {t.category}
                      </span>
                    )}
                    {t.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{t.description}</p>
                    )}
                    <p className="text-[11px] text-gray-400">
                      {t.task_count ?? 0} tarea{(t.task_count ?? 0) === 1 ? '' : 's'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // ----- Step 2: preview tasks + customize assignees -----
          <div className="p-6 overflow-y-auto flex-1">
            {loadingDetail ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
            ) : (
              <>
                {selected.description && (
                  <p className="text-sm text-gray-600 mb-4">{selected.description}</p>
                )}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {selected.tasks?.length || 0} tarea{(selected.tasks?.length || 0) === 1 ? '' : 's'} se crearán en el proyecto
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Puedes cambiar el asignado por tarea antes de aplicar.
                  </p>
                </div>

                <div className="space-y-2">
                  {(selected.tasks || []).map((t, idx) => (
                    <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                      <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center flex-shrink-0 font-medium">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E]">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            t.priority === 'urgent' ? 'bg-red-100 text-red-700'
                              : t.priority === 'high' ? 'bg-orange-100 text-orange-700'
                              : t.priority === 'low' ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {t.priority || 'medium'}
                          </span>
                          {t.estimated_hours > 0 && (
                            <span className="text-[10px] text-gray-500">{t.estimated_hours}h estimadas</span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                      <select
                        value={assigneeOverrides[t.id] || ''}
                        onChange={(e) =>
                          setAssigneeOverrides((prev) => ({
                            ...prev,
                            [t.id]: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white flex-shrink-0 max-w-[180px]"
                      >
                        <option value="">Sin asignar</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {selected && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              Las tareas se agregarán al final del proyecto, en estado <strong>Por hacer</strong>.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-xl"
                disabled={applying}
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={applying || !selected?.tasks?.length}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#163B3B] hover:bg-[#1e4d4d] disabled:opacity-50 text-white text-sm font-medium rounded-xl"
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {applying ? 'Aplicando…' : `Aplicar ${selected.tasks?.length || 0} tareas`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectDetail;
