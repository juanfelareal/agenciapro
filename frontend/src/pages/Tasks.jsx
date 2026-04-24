import { useEffect, useState, useMemo, useRef } from 'react';
import { tasksAPI, projectsAPI, teamAPI, tagsAPI, subtasksAPI, clientsAPI, formsAPI, taskFilesAPI } from '../utils/api';
import { Plus, X, ListChecks, Copy, Filter, Search, ExternalLink, Link, Users, Maximize2, Minimize2, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { getEmbed } from '../utils/embedUrl';
import { useAuth } from '../context/AuthContext';
import SubtaskList from '../components/SubtaskList';
import TaskDescriptionEditor from '../components/TaskDescriptionEditor';
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
  const [modalExpanded, setModalExpanded] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [subtaskProgress, setSubtaskProgress] = useState({ total: 0, completed: 0, progress: 0 });
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Confirmación al marcar tarea como Completada: ¿necesita aprobación del cliente?
  const [doneApprovalPrompt, setDoneApprovalPrompt] = useState(false);
  const pendingSubmitRef = useRef(null);

  // Segundo paso: pedir entregable (link o archivo) tras confirmar aprobación
  const [deliverablePrompt, setDeliverablePrompt] = useState(false);
  const [deliverableLink, setDeliverableLink] = useState('');
  const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

  // Entregables (links/embeds) de la tarea, visibles para el cliente desde su portal.
  // Reusan la tabla task_files con file_path = URL absoluta.
  const [taskFilesList, setTaskFilesList] = useState([]);
  const [loadingTaskFiles, setLoadingTaskFiles] = useState(false);
  const [newDeliverableUrl, setNewDeliverableUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  // Si la tarea requiere aprobación del cliente y no hay archivos ni link,
  // exigir que el usuario marque conscientemente "Sin archivos" antes de guardar.
  const [noFilesIntended, setNoFilesIntended] = useState(false);

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
    client_id: '',
    project_id: '',
    assignee_ids: [],
    status: 'todo',
    priority: 'medium',
    due_date: '',
    delivery_url: '',
    linked_form_id: '',
    visible_to_client: false,
    requires_client_approval: false,
    is_recurring: false,
    recurrence_pattern: {
      type: 'weekly',
      days: [],
    },
  });
  const [availableForms, setAvailableForms] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  // Persist showMyTasks preference
  useEffect(() => {
    localStorage.setItem('tasks_showMyTasks', JSON.stringify(showMyTasks));
  }, [showMyTasks]);

  const loadData = async () => {
    try {
      const [tasksRes, projectsRes, teamRes, tagsRes, clientsRes, formsRes] = await Promise.all([
        tasksAPI.getAll(),
        projectsAPI.getAll(),
        teamAPI.getAll({ status: 'active' }),
        tagsAPI.getAll(),
        clientsAPI.getAll(),
        formsAPI.getAll({ status: 'published' }),
      ]);
      setTasks(tasksRes.data || []);
      setProjects(projectsRes.data || []);
      setTeamMembers(teamRes.data || []);
      setAllTags(tagsRes.data || []);
      setClients(clientsRes.data || []);
      setAvailableForms(formsRes.data || []);

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
    // Bloquea guardar si la tarea pide aprobación pero no hay entregable ni override explícito.
    if (!validateApprovalDeliverable()) return;
    // Si la tarea acaba de pasar a Completada y aún no se está pidiendo aprobación,
    // y la tarea está vinculada a un cliente, pregunta si necesita aprobación.
    const justMarkedDone =
      formData.status === 'done' &&
      (!editingTask || editingTask.status !== 'done');
    if (
      justMarkedDone &&
      !formData.requires_client_approval &&
      formData.client_id
    ) {
      pendingSubmitRef.current = formData;
      setDoneApprovalPrompt(true);
      return;
    }
    await persistTask(formData);
  };

  const persistTask = async (data) => {
    try {
      let taskId;
      const { assignee_ids, ...restFormData } = data;
      const apiData = {
        ...restFormData,
        assignee_ids: assignee_ids.map(Number),
        project_id: data.project_id || null,
        due_date: data.due_date || null,
        delivery_url: data.delivery_url || null,
        timeline_start: data.timeline_start || null,
        timeline_end: data.timeline_end || null,
        color: data.color || null,
        estimated_hours: data.estimated_hours || null,
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

  const confirmDoneWithApproval = () => {
    setDoneApprovalPrompt(false);
    setDeliverableLink('');
    setDeliverablePrompt(true);
  };

  const confirmDoneWithoutApproval = async () => {
    setDoneApprovalPrompt(false);
    const base = pendingSubmitRef.current || formData;
    pendingSubmitRef.current = null;
    await persistTask(base);
  };

  const cancelDeliverablePrompt = () => {
    setDeliverablePrompt(false);
    setDeliverableLink('');
    pendingSubmitRef.current = null;
  };

  const submitDeliverableAndApprove = async () => {
    const link = deliverableLink.trim();
    if (!link) {
      alert('Pega un link (Drive, Figma, Loom, etc.) para que el cliente lo revise.');
      return;
    }
    try { new URL(link); } catch {
      alert('El link no parece válido. Asegúrate de incluir https://');
      return;
    }
    setSubmittingDeliverable(true);
    try {
      const base = pendingSubmitRef.current || formData;
      const updated = {
        ...base,
        visible_to_client: true,
        requires_client_approval: true,
      };
      const { assignee_ids, ...rest } = updated;
      const apiData = {
        ...rest,
        assignee_ids: assignee_ids.map(Number),
        project_id: updated.project_id || null,
        due_date: updated.due_date || null,
        delivery_url: updated.delivery_url || null,
        timeline_start: updated.timeline_start || null,
        timeline_end: updated.timeline_end || null,
        color: updated.color || null,
        estimated_hours: updated.estimated_hours || null,
      };
      let taskId;
      if (editingTask) {
        await tasksAPI.update(editingTask.id, apiData);
        taskId = editingTask.id;
      } else {
        const response = await tasksAPI.create(apiData);
        taskId = response.data.id;
      }
      if (taskId) {
        await taskFilesAPI.addLink(taskId, link, user?.id);
        await tagsAPI.setTaskTags(taskId, selectedTagIds);
      }

      setShowModal(false);
      setEditingTask(null);
      resetForm();
      cancelDeliverablePrompt();
      loadData();
    } catch (error) {
      console.error('Error sending deliverable:', error);
      alert(error.response?.data?.error || 'Error al guardar el entregable');
    } finally {
      setSubmittingDeliverable(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      client_id: '',
      project_id: '',
      assignee_ids: [],
      status: 'todo',
      priority: 'medium',
      due_date: '',
      delivery_url: '',
      linked_form_id: '',
      visible_to_client: false,
      requires_client_approval: false,
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
    setTaskFilesList([]);
    setNoFilesIntended(false);
  };

  const validateApprovalDeliverable = () => {
    if (!formData.requires_client_approval) return true;
    const hasFile = taskFilesList.length > 0;
    const hasLink = (formData.delivery_url || '').trim().length > 0;
    if (hasFile || hasLink || noFilesIntended) return true;
    alert(
      'Esta tarea requiere aprobación del cliente.\n\nAntes de guardar, sube al menos un archivo, agrega un link de entrega, o marca "Sin archivos" para confirmar que el cliente revisará por otro medio.'
    );
    return false;
  };

  const loadTaskFiles = async (taskId) => {
    if (!taskId) return;
    setLoadingTaskFiles(true);
    try {
      const res = await taskFilesAPI.getByTask(taskId);
      setTaskFilesList(res.data || []);
    } catch (error) {
      console.error('Error loading task files:', error);
      setTaskFilesList([]);
    } finally {
      setLoadingTaskFiles(false);
    }
  };

  const handleAddDeliverableLink = async () => {
    const url = newDeliverableUrl.trim();
    if (!url || !editingTask?.id) return;
    try {
      new URL(url);
    } catch {
      alert('El link no parece válido. Asegúrate de incluir https://');
      return;
    }
    setAddingLink(true);
    try {
      await taskFilesAPI.addLink(editingTask.id, url, user?.id);
      setNewDeliverableUrl('');
      await loadTaskFiles(editingTask.id);
    } catch (error) {
      console.error('Error adding link:', error);
      alert(error.response?.data?.error || 'Error al agregar el link');
    } finally {
      setAddingLink(false);
    }
  };

  const handleDeleteTaskFile = async (fileId) => {
    if (!fileId) return;
    if (!confirm('¿Eliminar este archivo? El cliente dejará de verlo.')) return;
    try {
      await taskFilesAPI.delete(fileId);
      await loadTaskFiles(editingTask.id);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert(error.response?.data?.error || 'Error al eliminar el archivo');
    }
  };

  // Projects filtered by selected client
  const filteredProjects = useMemo(() => {
    if (!formData.client_id) return [];
    return projects.filter(p => p.client_id === Number(formData.client_id));
  }, [projects, formData.client_id]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setCreatingProject(true);
    try {
      const response = await projectsAPI.create({
        name: newProjectName.trim(),
        status: 'planning',
        budget: 0,
        client_id: formData.client_id ? Number(formData.client_id) : null,
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
    // Si la tarea requiere aprobación del cliente y no tiene entregable,
    // forzar al usuario a abrir la tarea y subir archivos/link primero.
    if (task.requires_client_approval) {
      const hasFile = (task.files?.length || 0) > 0;
      const hasLink = (task.delivery_url || '').trim().length > 0;
      if (!hasFile && !hasLink) {
        alert(
          'Esta tarea requiere aprobación del cliente y no tiene entregable.\n\nÁbrela y sube los archivos o agrega un link antes de cambiar el estado.'
        );
        handleTaskClick(task);
        return;
      }
    }
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
        visible_to_client: task.visible_to_client,
      };
      await tasksAPI.update(task.id, updateData);
      loadData();
    } catch (error) {
      console.error('Error updating task status:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert('Error al actualizar estado: ' + errorMsg);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      await tasksAPI.update(taskId, updates);
      loadData();
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      return false;
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
      client_id: task.client_id || '',
      project_id: task.project_id || '',
      assignee_ids: (task.assignees || []).map(a => a.id),
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
      is_recurring: task.is_recurring ? true : false,
      recurrence_pattern: (() => {
        try {
          const rp = task.recurrence_pattern
            ? (typeof task.recurrence_pattern === 'string' ? JSON.parse(task.recurrence_pattern) : task.recurrence_pattern)
            : null;
          return rp && rp.days ? rp : { type: rp?.type || 'weekly', days: rp?.days || [] };
        } catch { return { type: 'weekly', days: [] }; }
      })(),
      timeline_start: task.timeline_start || null,
      timeline_end: task.timeline_end || null,
      progress: task.progress || 0,
      color: task.color || null,
      estimated_hours: task.estimated_hours || null,
      delivery_url: task.delivery_url || '',
      linked_form_id: task.linked_form_id || '',
      visible_to_client: task.visible_to_client ? true : false,
      requires_client_approval: !!task.requires_client_approval,
    });
    // Load task tags
    const tags = taskTags[task.id] || [];
    setSelectedTagIds(tags.map(t => t.id));
    // Load subtask progress
    setSubtaskProgress(taskSubtaskProgress[task.id] || { total: 0, completed: 0, progress: 0 });
    setShowModal(true);
    loadTaskFiles(task.id);
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
            onUpdateTask={handleUpdateTask}
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
        <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 ${modalExpanded ? 'p-0' : 'p-4'}`}>
          <div className={`bg-white shadow-xl flex flex-col ${
            modalExpanded
              ? 'w-full h-full'
              : 'rounded-2xl w-full max-w-2xl max-h-[90vh]'
          }`}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
              </h2>
              <div className="flex items-center gap-1">
                <button onClick={() => setModalExpanded(!modalExpanded)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  {modalExpanded ? <Minimize2 size={20} className="text-gray-500" /> : <Maximize2 size={20} className="text-gray-500" />}
                </button>
                <button onClick={() => { setShowModal(false); setModalExpanded(false); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className={`flex-1 min-h-0 flex ${modalExpanded ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto'}`}>
              {/* When expanded: left sidebar with fields, right side with description */}
              <div className={`${modalExpanded ? 'w-[400px] flex-shrink-0 border-r border-gray-100 overflow-y-auto p-6' : 'p-6'}`}>
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
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Cliente *</label>
                  <select
                    className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00]"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value, project_id: '' })}
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nickname || client.company || client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Proyecto</label>
                  {!formData.client_id ? (
                    <p className="text-sm text-gray-400 py-2.5">Selecciona un cliente primero</p>
                  ) : showNewProject ? (
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
                        <option value="">{filteredProjects.length === 0 ? 'Sin proyectos para este cliente' : 'Seleccionar proyecto...'}</option>
                        {filteredProjects.map((project) => (
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
                {/* Description - inline when collapsed */}
                {!modalExpanded && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Descripción</label>
                    <TaskDescriptionEditor
                      value={formData.description}
                      onChange={(json) => setFormData({ ...formData, description: json })}
                      placeholder="Descripción de la tarea... (puedes pegar imágenes)"
                    />
                  </div>
                )}

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

                {/* Linked Form - Formulario vinculado */}
                {availableForms.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-2">
                      <ListChecks size={14} />
                      Formulario vinculado
                    </label>
                    <select
                      className="w-full border border-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#BFFF00] bg-white"
                      value={formData.linked_form_id || ''}
                      onChange={(e) => setFormData({ ...formData, linked_form_id: e.target.value ? parseInt(e.target.value) : '' })}
                    >
                      <option value="">Sin formulario</option>
                      {availableForms.map(f => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">El cliente verá un botón para llenar este formulario dentro de la tarea</p>
                  </div>
                )}

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

                {/* Entregables — links/embeds (Drive, Loom, Figma, etc.). Solo al editar (requiere taskId). */}
                {editingTask && (
                  <div className="col-span-2 border-t border-gray-100 pt-4">
                    <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                      <Paperclip size={14} />
                      Entregables para el cliente
                    </label>
                    {loadingTaskFiles ? (
                      <p className="text-xs text-gray-400">Cargando…</p>
                    ) : taskFilesList.length === 0 ? (
                      <p className="text-xs text-gray-400 mb-2">Aún no hay entregables. Pega un link de Drive, Figma, Loom o cualquier URL pública.</p>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {taskFilesList.map((f) => {
                          const isLegacyFile = !f.file_path?.startsWith('http');
                          const embed = isLegacyFile ? null : getEmbed(f.file_path);
                          return (
                            <div key={f.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white">
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                                <Link className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                {isLegacyFile ? (
                                  <p className="text-sm text-amber-700 font-medium">Archivo no disponible</p>
                                ) : (
                                  <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">{embed?.label || 'Link'}</p>
                                )}
                                <a
                                  href={isLegacyFile ? '#' : f.file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => isLegacyFile && e.preventDefault()}
                                  className={`block text-sm truncate ${isLegacyFile ? 'text-gray-400 cursor-not-allowed' : 'text-[#1A1A2E] hover:underline'}`}
                                  title={f.file_path}
                                >
                                  {f.file_name || f.file_path}
                                </a>
                              </div>
                              {!isLegacyFile && (
                                <a
                                  href={f.file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                  title="Abrir"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteTaskFile(f.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={newDeliverableUrl}
                        onChange={(e) => setNewDeliverableUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDeliverableLink();
                          }
                        }}
                        placeholder="https://drive.google.com/file/d/... o link de Figma, Loom, YouTube…"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                        disabled={addingLink}
                      />
                      <button
                        type="button"
                        onClick={handleAddDeliverableLink}
                        disabled={addingLink || !newDeliverableUrl.trim()}
                        className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-xl hover:bg-[#1A1A2E]/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {addingLink ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Agregar
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">El cliente verá la previsualización embebida (Drive, Figma, Loom, YouTube, etc.). Para Drive, deja "cualquier persona con el enlace puede ver".</p>
                  </div>
                )}

                {/* Visible to Client Toggle + Client Approval */}
                {formData.client_id && (
                  <div className="col-span-2 border-t pt-4 space-y-3">
                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.visible_to_client}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              visible_to_client: e.target.checked,
                              // Si se oculta, también desactiva la aprobación
                              requires_client_approval: e.target.checked ? formData.requires_client_approval : false,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">👁 Visible en el portal del cliente</span>
                      </label>
                      <p className="text-xs text-gray-400 mt-1 ml-6">Si está activo, el cliente podrá ver esta tarea en su dashboard</p>
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.requires_client_approval}
                          disabled={!formData.visible_to_client}
                          onChange={(e) => {
                            setFormData({ ...formData, requires_client_approval: e.target.checked });
                            if (!e.target.checked) setNoFilesIntended(false);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">✋ Pedir aprobación al cliente</span>
                      </label>
                      <p className="text-xs text-gray-400 mt-1 ml-6">El cliente verá botones para Aprobar / Solicitar cambios / Rechazar.</p>

                      {/* Bloqueador: si pide aprobación pero no hay entregable, exigir override */}
                      {formData.requires_client_approval &&
                        taskFilesList.length === 0 &&
                        !(formData.delivery_url || '').trim() && (
                          <div className="mt-2 ml-6 border border-amber-200 bg-amber-50 rounded-xl p-3">
                            <p className="text-sm font-medium text-amber-800">⚠️ Falta el entregable</p>
                            <p className="text-xs text-amber-700 mt-1">
                              Sube un archivo en la sección <strong>Archivos para el cliente</strong>, agrega un <strong>Link de entrega</strong> arriba, o marca abajo que no requiere archivos.
                            </p>
                            <label className="flex items-center gap-2 mt-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={noFilesIntended}
                                onChange={(e) => setNoFilesIntended(e.target.checked)}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-amber-800">
                                Sin archivos — el cliente revisará por otro medio
                              </span>
                            </label>
                          </div>
                        )}
                    </div>

                    {/* Approval status banner — read-only when client has acted */}
                    {editingTask?.requires_client_approval && editingTask?.client_approval_status && (() => {
                      const status = editingTask.client_approval_status;
                      const cfg =
                        status === 'approved' ? { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Cliente aprobó' } :
                        status === 'rejected' ? { bg: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Cliente rechazó' } :
                        status === 'changes_requested' ? { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', label: 'Cliente solicitó cambios' } :
                        { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'Esperando aprobación del cliente' };
                      return (
                        <div className={`border rounded-xl p-3 ${cfg.bg}`}>
                          <p className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</p>
                          {editingTask.client_approval_date && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(editingTask.client_approval_date).toLocaleDateString('es-CO', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          )}
                          {editingTask.client_approval_notes && (
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                              <span className="font-medium">Notas: </span>{editingTask.client_approval_notes}
                            </p>
                          )}
                        </div>
                      );
                    })()}
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
                              (formData.recurrence_pattern?.days || []).includes(day.value)
                                ? 'bg-[#1A1A2E] text-[#BFFF00]'
                                : 'bg-white border border-gray-100 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={(formData.recurrence_pattern?.days || []).includes(day.value)}
                              onChange={(e) => {
                                const days = e.target.checked
                                  ? [...(formData.recurrence_pattern?.days || []), day.value]
                                  : (formData.recurrence_pattern?.days || []).filter((d) => d !== day.value);
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
              {/* Action buttons - inside sidebar when expanded */}
              <div className={`flex justify-end gap-3 ${modalExpanded ? 'mt-4 pt-4' : 'mt-6 pt-4'} border-t border-gray-100`}>
                {editingTask && (
                  <div className="flex gap-2 mr-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('¿Está seguro de eliminar esta tarea?')) {
                          await tasksAPI.delete(editingTask.id);
                          setShowModal(false);
                          setModalExpanded(false);
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
                        setFormData({
                          ...formData,
                          title: `${formData.title} (Copia)`,
                        });
                        setEditingTask(null);
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
                  onClick={() => { setShowModal(false); setModalExpanded(false); }}
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
              </div>{/* close sidebar/fields wrapper */}

              {/* Expanded description panel - takes up remaining space */}
              {modalExpanded && (
                <div className="flex-1 flex flex-col min-h-0 p-6">
                  <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2 flex-shrink-0">Descripción</label>
                  <div className="expanded-desc-panel flex-1 min-h-0">
                    <TaskDescriptionEditor
                      value={formData.description}
                      onChange={(json) => setFormData({ ...formData, description: json })}
                      placeholder="Descripción de la tarea... (puedes pegar imágenes)"
                    />
                  </div>
                  <style>{`
                    .expanded-desc-panel { display: flex; flex-direction: column; }
                    .expanded-desc-panel .task-desc-editor { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
                    .expanded-desc-panel .task-desc-editor > .prose { flex: 1; min-height: 0; overflow-y: auto; }
                    .expanded-desc-panel .task-desc-editor .ProseMirror { max-height: none !important; min-height: 100% !important; }
                  `}</style>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Deliverable prompt — second step after confirming approval */}
      {deliverablePrompt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#1A1A2E] mb-1">
              Entregable para el cliente
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Pega el link del entregable (Drive, Figma, Loom, YouTube, etc.). El cliente verá la previsualización embebida en su portal.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Link del entregable</label>
              <input
                type="url"
                value={deliverableLink}
                onChange={(e) => setDeliverableLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent text-sm"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1.5">Tip: en Drive, asegúrate de poner "cualquier persona con el enlace puede ver".</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-6">
              <button
                type="button"
                onClick={cancelDeliverablePrompt}
                disabled={submittingDeliverable}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitDeliverableAndApprove}
                disabled={submittingDeliverable || !deliverableLink.trim()}
                className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-xl hover:bg-[#1A1A2E]/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submittingDeliverable && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar al cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval prompt — shown when marking a client task as Completada */}
      {doneApprovalPrompt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">
              ¿Necesita aprobación del cliente?
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              Estás marcando esta tarea como <span className="font-medium">Completada</span>. Si el cliente debe revisarla y aprobarla antes de cerrar, activamos la aprobación y la dejamos visible en su portal.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={confirmDoneWithoutApproval}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                No, marcar completada
              </button>
              <button
                type="button"
                onClick={confirmDoneWithApproval}
                className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-xl hover:bg-[#1A1A2E]/90 transition-colors"
              >
                Sí, pedir aprobación al cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
