import { useEffect, useState, useMemo } from 'react';
import { tasksAPI, projectsAPI, teamAPI, tagsAPI, subtasksAPI, clientsAPI } from '../utils/api';
import { Plus, X, ListChecks, Copy, Filter, Search, ExternalLink, Link, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SubtaskList from '../components/SubtaskList';
import TagSelector from '../components/TagSelector';
import TaskViewSwitcher from '../components/tasks/TaskViewSwitcher';
import TaskFilters from '../components/tasks/TaskFilters';
import KanbanView from '../components/tasks/KanbanView';
import ListView from '../components/tasks/ListView';
import CalendarView from '../components/tasks/CalendarView';

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [clients, setClients] = useState([]);
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
  // Default: filter by current user's tasks (showMyTasks = true), persisted in localStorage
  const [showMyTasks, setShowMyTasks] = useState(() => {
    const saved = localStorage.getItem('tasks_showMyTasks');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [filters, setFilters] = useState({
    assignees: [],
    priorities: [],
    dueDateFrom: '',
    dueDateTo: '',
    projects: [],
    tags: [],
    statuses: [],
    clients: [],
    search: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    assignee_ids: [],
    status: 'todo',
    priority: 'medium',
    due_date: '',
    delivery_url: '',
    is_recurring: false,
    recurrence_pattern: {
      type: 'weekly',
      days: [],
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  // Persist showMyTasks preference
  useEffect(() => {
    localStorage.setItem('tasks_showMyTasks', JSON.stringify(showMyTasks));
  }, [showMyTasks]);

  const loadData = async () => {
    try {
      const [tasksRes, projectsRes, teamRes, tagsRes, clientsRes] = await Promise.all([
        tasksAPI.getAll(),
        projectsAPI.getAll(),
        teamAPI.getAll({ status: 'active' }),
        tagsAPI.getAll(),
        clientsAPI.getAll(),
      ]);
      setTasks(tasksRes.data || []);
      setProjects(projectsRes.data || []);
      setTeamMembers(teamRes.data || []);
      setAllTags(tagsRes.data || []);
      setClients(clientsRes.data || []);

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
      // "My Tasks" filter - if active, only show tasks assigned to current user
      if (showMyTasks && user?.id) {
        const isAssigned = task.assignees?.some(a => a.id === user.id) || task.assigned_to === user.id;
        if (!isAssigned) return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          task.title?.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower) ||
          task.project_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Assignee filter (only applies when showMyTasks is off)
      if (!showMyTasks && filters.assignees.length > 0) {
        const hasMatchingAssignee = task.assignees?.some(a => filters.assignees.includes(a.id)) || filters.assignees.includes(task.assigned_to);
        if (!hasMatchingAssignee) return false;
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

      // Client filter
      if (filters.clients.length > 0) {
        if (!task.client_id || !filters.clients.includes(task.client_id)) return false;
      }

      return true;
    });
  }, [tasks, filters, taskTags, viewMode, showMyTasks, user]);

  // Count active filters
  const activeFilterCount = [
    filters.assignees.length > 0,
    filters.priorities.length > 0,
    filters.dueDateFrom || filters.dueDateTo,
    filters.projects.length > 0,
    filters.tags.length > 0,
    filters.statuses.length > 0,
    filters.clients.length > 0,
  ].filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let taskId;
      // Prepare data for API - ensure proper types
      const { assignee_ids, ...restFormData } = formData;
      const apiData = {
        ...restFormData,
        assignee_ids: assignee_ids.map(Number),
        project_id: formData.project_id || null,
        due_date: formData.due_date || null,
        delivery_url: formData.delivery_url || null,
        timeline_start: formData.timeline_start || null,
        timeline_end: formData.timeline_end || null,
        color: formData.color || null,
        estimated_hours: formData.estimated_hours || null,
      };

      if (editingTask) {
        await tasksAPI.update(editingTask.id, apiData);
        taskId = editingTask.id;
      } else {
        const response = await tasksAPI.create(apiData);
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
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
      alert('Error al guardar tarea: ' + errorMsg);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      project_id: '',
      assignee_ids: [],
      status: 'todo',
      priority: 'medium',
      due_date: '',
      delivery_url: '',
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
      // Only send necessary fields, not computed ones like project_name, assigned_to_name
      const updateData = {
        title: task.title,
        description: task.description,
        project_id: task.project_id,
        assignee_ids: (task.assignees || []).map(a => a.id),
        status: newStatus,
        priority: task.priority,
        due_date: task.due_date,
        is_recurring: task.is_recurring,
        recurrence_pattern: task.recurrence_pattern,
        timeline_start: task.timeline_start,
        timeline_end: task.timeline_end,
        progress: task.progress,
        color: task.color,
        estimated_hours: task.estimated_hours,
        delivery_url: task.delivery_url,
      };
      await tasksAPI.update(task.id, updateData);
      loadData();
    } catch (error) {
      console.error('Error updating task status:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert('Error al actualizar estado: ' + errorMsg);
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
      assignee_ids: (task.assignees || []).map(a => a.id),
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
      delivery_url: task.delivery_url || '',
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
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Tareas</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestión de tareas del equipo</p>
          </div>
          <div className="flex items-center gap-3">
            <TaskViewSwitcher value={viewMode} onChange={setViewMode} />
            <button
              onClick={() => handleNew()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-all"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Nueva Tarea</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          {/* My Tasks / All Tasks Toggle */}
          <div className="flex rounded-xl border border-gray-100 overflow-hidden bg-white">
            <button
              onClick={() => setShowMyTasks(true)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                showMyTasks
                  ? 'bg-[#1A1A2E] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Mis Tareas
            </button>
            <button
              onClick={() => setShowMyTasks(false)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                !showMyTasks
                  ? 'bg-[#1A1A2E] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users size={16} />
              Todas
            </button>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar tareas..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#BFFF00] focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-[#BFFF00] bg-[#BFFF00]/10 text-[#1A1A2E]'
                : 'border-gray-100 bg-white hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#1A1A2E] text-[#BFFF00] text-xs px-1.5 py-0.5 rounded-full">
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
          clients={clients}
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Título *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Proyecto</label>
                  {showNewProject ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
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
                        className="px-3 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingProject ? '...' : 'Crear'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewProject(false);
                          setNewProjectName('');
                        }}
                        className="px-3 py-2.5 border border-gray-100 rounded-xl hover:bg-gray-50"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        className="flex-1 border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
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
                        className="px-3 py-2.5 border border-gray-100 rounded-xl hover:bg-gray-50 text-[#1A1A2E] flex items-center gap-1"
                        title="Crear nuevo proyecto"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Asignado a</label>
                  <select
                    className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                    value=""
                    onChange={(e) => {
                      const memberId = Number(e.target.value);
                      if (memberId && !formData.assignee_ids.includes(memberId)) {
                        setFormData({ ...formData, assignee_ids: [...formData.assignee_ids, memberId] });
                      }
                    }}
                  >
                    <option value="">
                      {formData.assignee_ids.length === 0 ? 'Seleccionar persona...' : '+ Agregar otra persona'}
                    </option>
                    {teamMembers
                      .filter((m) => !formData.assignee_ids.includes(m.id))
                      .map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                  </select>
                  {/* Selected assignee chips */}
                  {formData.assignee_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.assignee_ids.map((id) => {
                        const member = teamMembers.find((m) => m.id === Number(id));
                        if (!member) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 bg-[#1A1A2E] text-white text-xs pl-1.5 pr-1 py-1 rounded-lg"
                          >
                            <span className="w-5 h-5 rounded-md bg-[#BFFF00] text-[#1A1A2E] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                            <span>{member.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  assignee_ids: formData.assignee_ids.filter((aid) => aid !== id),
                                })
                              }
                              className="ml-0.5 p-0.5 rounded hover:bg-white/20 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Estado</label>
                  <select
                    className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
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
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Prioridad</label>
                  <select
                    className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
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
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Fecha Vencimiento</label>
                  <input
                    type="date"
                    className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Descripción</label>
                  <textarea
                    className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Delivery URL - Link de entrega */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-2">
                    <Link size={14} />
                    Link de Entrega
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      className="flex-1 border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                      placeholder="https://drive.google.com/... o cualquier link donde quedó la tarea"
                      value={formData.delivery_url}
                      onChange={(e) => setFormData({ ...formData, delivery_url: e.target.value })}
                    />
                    {formData.delivery_url && (
                      <a
                        href={formData.delivery_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-2.5 bg-[#BFFF00]/10 text-[#65A30D] border border-[#BFFF00]/30 rounded-xl hover:bg-[#BFFF00]/20 transition-colors"
                        title="Abrir link"
                      >
                        <ExternalLink size={16} />
                        Abrir
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Drive, Figma, Canva, o cualquier URL donde se entregó el trabajo</p>
                </div>

                {/* Tags Section */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Etiquetas</label>
                  <TagSelector
                    taskId={editingTask?.id}
                    selectedTagIds={selectedTagIds}
                    onChange={setSelectedTagIds}
                  />
                </div>

                {/* Subtasks Section - Only for existing tasks */}
                {editingTask && (
                  <div className="col-span-2 border-t border-gray-100 pt-4">
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                      <ListChecks size={14} />
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
                    <div className="ml-6 p-4 bg-[#BFFF00]/10 rounded-xl">
                      <p className="text-sm font-medium mb-2 text-[#1A1A2E]">Repetir cada:</p>
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
                                ? 'bg-[#1A1A2E] text-[#BFFF00]'
                                : 'bg-white border border-gray-100 hover:bg-gray-50'
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
                      <p className="text-xs text-gray-500 mt-2">
                        Las tareas recurrentes se crearán automáticamente en los días seleccionados
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
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
                      className="px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
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
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-colors"
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

export default Tasks;
