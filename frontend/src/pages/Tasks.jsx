import { useEffect, useState, useMemo } from 'react';
import { tasksAPI, projectsAPI, teamAPI, tagsAPI, subtasksAPI } from '../utils/api';
import { Plus, X, ListChecks, Copy, Filter, Search } from 'lucide-react';
import SubtaskList from '../components/SubtaskList';
import TagSelector from '../components/TagSelector';
import TaskViewSwitcher from '../components/tasks/TaskViewSwitcher';
import TaskFilters from '../components/tasks/TaskFilters';
import KanbanView from '../components/tasks/KanbanView';
import ListView from '../components/tasks/ListView';
import CalendarView from '../components/tasks/CalendarView';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [taskTags, setTaskTags] = useState({}); // { taskId: [tags] }
  const [taskSubtaskProgress, setTaskSubtaskProgress] = useState({}); // { taskId: { total, completed, progress } }
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [subtaskProgress, setSubtaskProgress] = useState({ total: 0, completed: 0, progress: 0 });
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // View and filter state
  const [viewMode, setViewMode] = useState('kanban');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    assignees: [],
    priorities: [],
    dueDateFrom: '',
    dueDateTo: '',
    projects: [],
    tags: [],
    statuses: [],
    search: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    assigned_to: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    is_recurring: false,
    recurrence_pattern: {
      type: 'weekly',
      days: [],
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksRes, projectsRes, teamRes, tagsRes] = await Promise.all([
        tasksAPI.getAll(),
        projectsAPI.getAll(),
        teamAPI.getAll({ status: 'active' }),
        tagsAPI.getAll(),
      ]);
      setTasks(tasksRes.data || []);
      setProjects(projectsRes.data || []);
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
      console.error('Error loading data:', error);
      alert('Error al cargar datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          task.title?.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower) ||
          task.project_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Assignee filter
      if (filters.assignees.length > 0) {
        if (!filters.assignees.includes(task.assigned_to)) return false;
      }

      // Priority filter
      if (filters.priorities.length > 0) {
        if (!filters.priorities.includes(task.priority)) return false;
      }

      // Date range filter
      if (filters.dueDateFrom || filters.dueDateTo) {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        if (filters.dueDateFrom && taskDate < new Date(filters.dueDateFrom)) return false;
        if (filters.dueDateTo && taskDate > new Date(filters.dueDateTo)) return false;
      }

      // Project filter
      if (filters.projects.length > 0) {
        if (!filters.projects.includes(task.project_id)) return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const taskTagIds = (taskTags[task.id] || []).map(t => t.id);
        const hasMatchingTag = filters.tags.some(tagId => taskTagIds.includes(tagId));
        if (!hasMatchingTag) return false;
      }

      // Status filter (only applies in list/calendar views)
      if (filters.statuses.length > 0 && viewMode !== 'kanban') {
        if (!filters.statuses.includes(task.status)) return false;
      }

      return true;
    });
  }, [tasks, filters, taskTags, viewMode]);

  // Count active filters
  const activeFilterCount = [
    filters.assignees.length > 0,
    filters.priorities.length > 0,
    filters.dueDateFrom || filters.dueDateTo,
    filters.projects.length > 0,
    filters.tags.length > 0,
    filters.statuses.length > 0,
  ].filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let taskId;
      if (editingTask) {
        await tasksAPI.update(editingTask.id, formData);
        taskId = editingTask.id;
      } else {
        const response = await tasksAPI.create(formData);
        taskId = response.data.id;
      }

      // Save tags for the task
      if (taskId) {
        await tagsAPI.setTaskTags(taskId, selectedTagIds);
      }

      setShowModal(false);
      setEditingTask(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error al guardar tarea');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      project_id: '',
      assigned_to: '',
      status: 'todo',
      priority: 'medium',
      due_date: '',
      is_recurring: false,
      recurrence_pattern: {
        type: 'weekly',
        days: [],
      },
      timeline_start: null,
      timeline_end: null,
      progress: 0,
      color: null,
      estimated_hours: null,
    });
    setSelectedTagIds([]);
    setSubtaskProgress({ total: 0, completed: 0, progress: 0 });
    setShowNewProject(false);
    setNewProjectName('');
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setCreatingProject(true);
    try {
      const response = await projectsAPI.create({
        name: newProjectName.trim(),
        status: 'planning',
        budget: 0,
      });
      const newProject = response.data;

      // Add to projects list and select it
      setProjects([...projects, newProject]);
      setFormData({ ...formData, project_id: newProject.id });

      // Reset new project form
      setShowNewProject(false);
      setNewProjectName('');
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error al crear proyecto');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleNew = (status = 'todo') => {
    resetForm();
    setFormData(prev => ({ ...prev, status }));
    setEditingTask(null);
    setShowModal(true);
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await tasksAPI.update(task.id, { ...task, status: newStatus });
      loadData();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await tasksAPI.delete(taskId);
      loadData();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error al eliminar la tarea');
    }
  };

  const handleTaskClick = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id || '',
      assigned_to: task.assigned_to || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      is_recurring: task.is_recurring ? true : false,
      recurrence_pattern: task.recurrence_pattern
        ? JSON.parse(task.recurrence_pattern)
        : { type: 'weekly', days: [] },
      timeline_start: task.timeline_start || null,
      timeline_end: task.timeline_end || null,
      progress: task.progress || 0,
      color: task.color || null,
      estimated_hours: task.estimated_hours || null,
    });
    // Load task tags
    const tags = taskTags[task.id] || [];
    setSelectedTagIds(tags.map(t => t.id));
    // Load subtask progress
    setSubtaskProgress(taskSubtaskProgress[task.id] || { total: 0, completed: 0, progress: 0 });
    setShowModal(true);
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Tareas</h1>
            <p className="text-gray-600">Gestión de tareas del equipo</p>
          </div>
          <div className="flex items-center gap-3">
            <TaskViewSwitcher value={viewMode} onChange={setViewMode} />
            <button
              onClick={() => handleNew()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Nueva Tarea</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar tareas..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <TaskFilters
          filters={filters}
          onChange={setFilters}
          teamMembers={teamMembers}
          projects={projects}
          tags={allTags}
          showStatusFilter={viewMode !== 'kanban'}
        />
      )}

      {/* View Content */}
      <div className="flex-1">
        {viewMode === 'kanban' && (
          <KanbanView
            tasks={filteredTasks}
            taskTags={taskTags}
            taskSubtaskProgress={taskSubtaskProgress}
            onTaskClick={handleTaskClick}
            onAddTask={handleNew}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
          />
        )}
        {viewMode === 'list' && (
          <ListView
            tasks={filteredTasks}
            taskTags={taskTags}
            taskSubtaskProgress={taskSubtaskProgress}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
          />
        )}
        {viewMode === 'calendar' && (
          <CalendarView
            tasks={filteredTasks}
            projects={projects}
            onTaskClick={handleTaskClick}
            onTaskUpdate={loadData}
          />
        )}
      </div>

      {/* Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
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
                  <label className="block text-sm font-medium mb-1">Proyecto</label>
                  {showNewProject ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border rounded-lg px-3 py-2"
                        placeholder="Nombre del nuevo proyecto"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateProject();
                          } else if (e.key === 'Escape') {
                            setShowNewProject(false);
                            setNewProjectName('');
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={creatingProject || !newProjectName.trim()}
                        className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingProject ? '...' : 'Crear'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewProject(false);
                          setNewProjectName('');
                        }}
                        className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        className="flex-1 border rounded-lg px-3 py-2"
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
                      <button
                        type="button"
                        onClick={() => setShowNewProject(true)}
                        className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-primary-600 flex items-center gap-1"
                        title="Crear nuevo proyecto"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Asignado a</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <label className="block text-sm font-medium mb-1">Fecha Vencimiento</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Descripción</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Tags Section */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Etiquetas</label>
                  <TagSelector
                    taskId={editingTask?.id}
                    selectedTagIds={selectedTagIds}
                    onChange={setSelectedTagIds}
                  />
                </div>

                {/* Subtasks Section - Only for existing tasks */}
                {editingTask && (
                  <div className="col-span-2 border-t pt-4">
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                      <ListChecks size={16} />
                      Subtareas / Checklist
                    </label>
                    <SubtaskList
                      taskId={editingTask.id}
                      onProgressChange={setSubtaskProgress}
                    />
                  </div>
                )}

                {/* Recurrence Section */}
                <div className="col-span-2 border-t pt-4">
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={formData.is_recurring}
                      onChange={(e) =>
                        setFormData({ ...formData, is_recurring: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">🔄 Tarea Recurrente</span>
                  </label>

                  {formData.is_recurring && (
                    <div className="ml-6 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Repetir cada:</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 1, label: 'Lun' },
                          { value: 2, label: 'Mar' },
                          { value: 3, label: 'Mié' },
                          { value: 4, label: 'Jue' },
                          { value: 5, label: 'Vie' },
                          { value: 6, label: 'Sáb' },
                          { value: 0, label: 'Dom' },
                        ].map((day) => (
                          <label
                            key={day.value}
                            className={`px-3 py-2 rounded-lg cursor-pointer transition ${
                              formData.recurrence_pattern.days.includes(day.value)
                                ? 'bg-primary-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.recurrence_pattern.days.includes(day.value)}
                              onChange={(e) => {
                                const days = e.target.checked
                                  ? [...formData.recurrence_pattern.days, day.value]
                                  : formData.recurrence_pattern.days.filter((d) => d !== day.value);
                                setFormData({
                                  ...formData,
                                  recurrence_pattern: { ...formData.recurrence_pattern, days },
                                });
                              }}
                              className="hidden"
                            />
                            <span className="text-sm">{day.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Las tareas recurrentes se crearán automáticamente en los días seleccionados
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                {editingTask && (
                  <div className="flex gap-2 mr-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('¿Está seguro de eliminar esta tarea?')) {
                          await tasksAPI.delete(editingTask.id);
                          setShowModal(false);
                          loadData();
                        }
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Keep form data but switch to "create new" mode
                        setFormData({
                          ...formData,
                          title: `${formData.title} (Copia)`,
                        });
                        setEditingTask(null);
                        // Keep selectedTagIds so tags are copied too
                        setSubtaskProgress({ total: 0, completed: 0, progress: 0 });
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2"
                      title="Duplicar tarea"
                    >
                      <Copy size={16} />
                      Duplicar
                    </button>
                  </div>
                )}
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

export default Tasks;
