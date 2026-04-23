import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, clientsAPI, tasksAPI, teamAPI, projectTemplatesAPI, projectStagesAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, FolderKanban, Copy, ListTodo, FileText, CheckSquare, Square, MinusSquare, Loader2, ChevronRight, ChevronDown } from 'lucide-react';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    status: 'planning',
    stage_id: '',
    budget: 0,
    start_date: '',
    end_date: '',
  });

  // Project stages
  const [stages, setStages] = useState([]);

  // Template feature state
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateSource, setTemplateSource] = useState('template'); // 'template' or 'project'
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateProjectId, setTemplateProjectId] = useState('');
  const [templateTasks, setTemplateTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateTasksDueDates, setTemplateTasksDueDates] = useState({}); // { taskKey: 'date' }
  const [templateTasksAssignees, setTemplateTasksAssignees] = useState({}); // { taskKey: memberId }

  // Filter state
  const [clientFilter, setClientFilter] = useState('');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Expandable rows state — show tasks for each project
  const [tasksByProject, setTasksByProject] = useState({});
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Delete project modal state
  const [deletingProject, setDeletingProject] = useState(null);
  const [deleteAction, setDeleteAction] = useState('delete'); // 'delete' | 'move'
  const [moveTargetId, setMoveTargetId] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Quick add-task modal state (scoped to a specific project)
  const [quickTaskProject, setQuickTaskProject] = useState(null);
  const [quickTaskForm, setQuickTaskForm] = useState({
    title: '',
    due_date: '',
    status: 'todo',
    priority: 'medium',
    assignee_ids: [],
  });
  const [creatingTask, setCreatingTask] = useState(false);

  const openQuickTask = (project) => {
    setQuickTaskProject(project);
    setQuickTaskForm({
      title: '',
      due_date: '',
      status: 'todo',
      priority: 'medium',
      assignee_ids: [],
    });
  };

  const closeQuickTask = () => {
    setQuickTaskProject(null);
  };

  const submitQuickTask = async (e) => {
    e.preventDefault();
    if (!quickTaskProject || !quickTaskForm.title.trim()) return;
    setCreatingTask(true);
    try {
      await tasksAPI.create({
        title: quickTaskForm.title.trim(),
        project_id: quickTaskProject.id,
        status: quickTaskForm.status,
        priority: quickTaskForm.priority,
        due_date: quickTaskForm.due_date || null,
        assignee_ids: quickTaskForm.assignee_ids,
      });
      // Keep the row expanded so the user sees the new task
      setExpandedIds((prev) => new Set(prev).add(quickTaskProject.id));
      closeQuickTask();
      loadData();
    } catch (error) {
      console.error('Error creating task:', error);
      alert(error.response?.data?.error || 'Error al crear la tarea');
    } finally {
      setCreatingTask(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, clientsRes, teamRes, templatesRes, tasksRes, stagesRes] = await Promise.all([
        projectsAPI.getAll(),
        clientsAPI.getAll('active'),
        teamAPI.getAll({ status: 'active' }),
        projectTemplatesAPI.getAll(),
        tasksAPI.getAll(),
        projectStagesAPI.getAll(),
      ]);
      setProjects(projectsRes.data);
      setClients(clientsRes.data);
      setTeamMembers(teamRes.data);
      setTemplates(templatesRes.data);
      setStages(stagesRes.data || []);

      const grouped = {};
      for (const t of tasksRes.data || []) {
        if (!t.project_id) continue;
        (grouped[t.project_id] ||= []).push(t);
      }
      setTasksByProject(grouped);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load tasks from project template
  const loadTemplateTasksFromTemplate = async (templateId) => {
    if (!templateId) {
      setTemplateTasks([]);
      return;
    }
    setLoadingTasks(true);
    try {
      const response = await projectTemplatesAPI.getById(templateId);
      const loadedTasks = response.data.tasks || [];
      setTemplateTasks(loadedTasks);
      // Pre-fill assignees from template defaults
      const assigneeDefaults = {};
      for (const task of loadedTasks) {
        const key = task.id || task.title;
        if (task.default_assignee_id) assigneeDefaults[key] = task.default_assignee_id;
      }
      setTemplateTasksAssignees(assigneeDefaults);
    } catch (error) {
      console.error('Error loading template tasks:', error);
      setTemplateTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Load tasks when template project is selected
  const loadTemplateTasks = async (projectId) => {
    if (!projectId) {
      setTemplateTasks([]);
      return;
    }
    setLoadingTasks(true);
    try {
      const response = await tasksAPI.getAll({ project_id: projectId });
      setTemplateTasks(response.data || []);
    } catch (error) {
      console.error('Error loading template tasks:', error);
      setTemplateTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    setTemplateProjectId('');
    loadTemplateTasksFromTemplate(templateId);
  };

  const handleTemplateProjectChange = (projectId) => {
    setTemplateProjectId(projectId);
    setSelectedTemplateId('');
    loadTemplateTasks(projectId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await projectsAPI.update(editingProject.id, formData);
      } else {
        // Create the project first
        const projectRes = await projectsAPI.create(formData);
        const newProjectId = projectRes.data.id;

        // If using template, copy tasks to new project
        if (useTemplate && templateTasks.length > 0) {
          for (let i = 0; i < templateTasks.length; i++) {
            const task = templateTasks[i];
            const taskKey = task.id || task.title;
            const assigneeId = templateTasksAssignees[taskKey];
            await tasksAPI.create({
              title: task.title,
              description: task.description || '',
              project_id: newProjectId,
              assignee_ids: assigneeId
                ? [Number(assigneeId)]
                : (task.assignees?.length > 0
                  ? task.assignees.map(a => a.id)
                  : (task.assigned_to ? [task.assigned_to] : [])),
              status: 'todo',
              priority: task.priority || 'medium',
              due_date: templateTasksDueDates[taskKey] || null,
              is_recurring: task.is_recurring || false,
              recurrence_pattern: task.recurrence_pattern || null,
              estimated_hours: task.estimated_hours || null,
              order_index: task.order_index != null ? task.order_index : i,
            });
          }
        }
      }
      setShowModal(false);
      setEditingProject(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Error al guardar proyecto');
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      client_id: project.client_id || '',
      status: project.status,
      stage_id: project.stage_id || '',
      budget: project.budget,
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    });
    setShowModal(true);
  };

  const handleDelete = (project) => {
    const taskCount = (tasksByProject[project.id] || []).length;
    setDeletingProject(project);
    setDeleteAction(taskCount > 0 ? 'move' : 'delete');
    setMoveTargetId('');
  };

  const closeDeleteModal = () => {
    setDeletingProject(null);
    setDeleteAction('delete');
    setMoveTargetId('');
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    if (deleteAction === 'move' && !moveTargetId) {
      alert('Selecciona el proyecto destino para las tareas');
      return;
    }
    setDeleting(true);
    try {
      await projectsAPI.delete(
        deletingProject.id,
        deleteAction === 'move' ? { moveTasksTo: moveTargetId } : {}
      );
      closeDeleteModal();
      loadData();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(error.response?.data?.error || 'Error al eliminar el proyecto');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      client_id: '',
      status: 'planning',
      stage_id: '',
      budget: 0,
      start_date: '',
      end_date: '',
    });
    // Reset template state
    setUseTemplate(false);
    setTemplateSource('template');
    setSelectedTemplateId('');
    setTemplateProjectId('');
    setTemplateTasks([]);
    setTemplateTasksDueDates({});
    setTemplateTasksAssignees({});
  };

  const handleNew = () => {
    resetForm();
    setEditingProject(null);
    setShowModal(true);
  };

  const handleCreateStage = async () => {
    const name = window.prompt('Nombre de la nueva etapa');
    if (!name || !name.trim()) return;
    try {
      const response = await projectStagesAPI.create({ name: name.trim() });
      const newStage = response.data;
      setStages((prev) => [...prev, newStage]);
      setFormData((prev) => ({ ...prev, stage_id: newStage.id }));
    } catch (error) {
      console.error('Error creating stage:', error);
      alert(error.response?.data?.error || 'Error al crear la etapa');
    }
  };

  const statusColors = {
    planning: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-amber-100 text-amber-700',
    completed: 'bg-[#10B981]/10 text-[#10B981]',
    cancelled: 'bg-red-100 text-red-600',
  };

  const statusLabels = {
    planning: 'Planeación',
    in_progress: 'En Progreso',
    on_hold: 'En Espera',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };

  const taskStatusLabels = {
    todo: 'Por hacer',
    in_progress: 'En progreso',
    review: 'En revisión',
    done: 'Completado',
  };

  const taskStatusColors = {
    todo: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    review: 'bg-amber-100 text-amber-700',
    done: 'bg-[#10B981]/10 text-[#10B981]',
  };

  // Bulk selection helpers
  const isAllSelected = projects.length > 0 && projects.every(p => selectedIds.has(p.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk actions
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIds.size === 0) return;

    const statusText = statusLabels[newStatus];
    if (!confirm(`¿Cambiar ${selectedIds.size} proyecto(s) a "${statusText}"?`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        projectsAPI.update(id, { status: newStatus })
      );
      await Promise.all(promises);
      clearSelection();
      loadData();
    } catch (error) {
      console.error('Error updating projects:', error);
      alert('Error al actualizar algunos proyectos');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`¿Eliminar ${selectedIds.size} proyecto(s)? Esta acción no se puede deshacer y eliminará todas las tareas asociadas.`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => projectsAPI.delete(id));
      await Promise.all(promises);
      clearSelection();
      loadData();
    } catch (error) {
      console.error('Error deleting projects:', error);
      alert('Error al eliminar algunos proyectos');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkClientChange = async (clientId) => {
    if (selectedIds.size === 0) return;

    const clientName = clientId ? clients.find(c => c.id == clientId)?.company || clients.find(c => c.id == clientId)?.name : 'Sin asignar';
    if (!confirm(`¿Asignar ${selectedIds.size} proyecto(s) al cliente "${clientName}"?`)) return;

    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        projectsAPI.update(id, { client_id: clientId || null })
      );
      await Promise.all(promises);
      clearSelection();
      loadData();
    } catch (error) {
      console.error('Error updating projects:', error);
      alert('Error al actualizar algunos proyectos');
    } finally {
      setBulkUpdating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Proyectos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de proyectos y presupuestos</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="border border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#BFFF00] bg-white"
          >
            <option value="">Todos los clientes</option>
            <option value="none">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.nickname || c.company || c.name}</option>
            ))}
          </select>
          <button
            onClick={handleNew}
            className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
          >
            <Plus size={20} />
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#BFFF00]/10 border border-[#BFFF00] rounded-xl p-3 mb-4 flex items-center gap-4 flex-wrap animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-[#1A1A2E]" />
            <span className="font-medium text-[#1A1A2E]">
              {selectedIds.size} proyecto{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-6 w-px bg-[#1A1A2E]/20" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[#1A1A2E]/70">Estado:</span>
            <button
              onClick={() => handleBulkStatusChange('planning')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Planeación
            </button>
            <button
              onClick={() => handleBulkStatusChange('in_progress')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
            >
              En Progreso
            </button>
            <button
              onClick={() => handleBulkStatusChange('completed')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-[#10B981]/10 text-[#10B981] rounded-lg hover:bg-[#10B981]/20 disabled:opacity-50"
            >
              Completado
            </button>
            <button
              onClick={() => handleBulkStatusChange('on_hold')}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50"
            >
              En Espera
            </button>
          </div>
          <div className="h-6 w-px bg-[#1A1A2E]/20" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#1A1A2E]/70">Cliente:</span>
            <select
              onChange={(e) => handleBulkClientChange(e.target.value)}
              disabled={bulkUpdating}
              className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50"
              defaultValue=""
            >
              <option value="" disabled>Seleccionar...</option>
              <option value="">Sin asignar</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company || client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="h-6 w-px bg-[#1A1A2E]/20" />
          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
          >
            {bulkUpdating ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Eliminar
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto px-3 py-1.5 text-sm text-[#1A1A2E] hover:bg-[#1A1A2E]/10 rounded-lg"
          >
            Cancelar selección
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 text-center w-12">
                <button
                  onClick={toggleSelectAll}
                  className="text-gray-500 hover:text-[#1A1A2E]"
                  title={isAllSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                >
                  {isAllSelected ? (
                    <CheckSquare size={18} className="text-[#1A1A2E]" />
                  ) : isSomeSelected ? (
                    <MinusSquare size={18} className="text-[#1A1A2E]" />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proyecto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Etapa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tareas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gastado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {projects.filter(p => {
              if (!clientFilter) return true;
              if (clientFilter === 'none') return !p.client_id;
              return p.client_id === Number(clientFilter);
            }).map((project) => {
              const projectTasks = tasksByProject[project.id] || [];
              const isExpanded = expandedIds.has(project.id);
              return (
              <Fragment key={project.id}>
              <tr
                className={`hover:bg-gray-50 ${selectedIds.has(project.id) ? 'bg-[#BFFF00]/10' : ''}`}
              >
                <td className="px-3 py-4 text-center">
                  <button
                    onClick={() => toggleSelectOne(project.id)}
                    className="text-gray-400 hover:text-[#1A1A2E]"
                  >
                    {selectedIds.has(project.id) ? (
                      <CheckSquare size={18} className="text-[#1A1A2E]" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-[#1A1A2E]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(project.id)}
                      className="text-gray-400 hover:text-[#1A1A2E] p-0.5 rounded transition-colors"
                      title={isExpanded ? 'Colapsar' : 'Desglosar tareas'}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <span
                      className="cursor-pointer hover:text-[#F97316] transition-colors"
                      onClick={() => navigate(`/app/projects/${project.id}`)}
                    >
                      {project.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{project.client_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {project.stage_name ? (
                    <span
                      className="px-2 py-1 rounded-lg text-xs font-medium"
                      style={{
                        backgroundColor: `${project.stage_color || '#6366F1'}1A`,
                        color: project.stage_color || '#6366F1',
                      }}
                    >
                      {project.stage_name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-[#1A1A2E]">
                  <button
                    onClick={() => toggleExpand(project.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Ver tareas"
                  >
                    <ListTodo size={14} className="text-gray-500" />
                    <span className="text-sm">{projectTasks.length}</span>
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-bold text-[#F97316]">
                  ${project.spent?.toLocaleString('es-CO')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => navigate(`/app/projects/${project.id}`)}
                    className="text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 p-1.5 rounded-lg mr-2 transition-colors"
                    title="Ver tablero del proyecto"
                  >
                    <FolderKanban size={18} />
                  </button>
                  <button
                    onClick={() => handleEdit(project)}
                    className="text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 p-1.5 rounded-lg mr-2 transition-colors"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(project)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
              {isExpanded && (
                <tr className="bg-gray-50/50">
                  <td colSpan={8} className="px-6 py-4">
                    <div className="pl-8 pr-2">
                      {projectTasks.length === 0 ? (
                        <p className="text-sm text-gray-400 mb-3">Sin tareas en este proyecto.</p>
                      ) : (
                        <table className="w-full text-sm mb-3">
                          <thead>
                            <tr className="text-xs text-gray-400 uppercase tracking-wider">
                              <th className="text-left py-2 font-medium">Tarea</th>
                              <th className="text-left py-2 font-medium w-40">Fecha de entrega</th>
                              <th className="text-left py-2 font-medium w-36">Estado</th>
                              <th className="text-left py-2 font-medium w-64">Responsable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectTasks.map((task) => (
                              <tr
                                key={task.id}
                                className="border-t border-gray-100 hover:bg-white cursor-pointer"
                                onClick={() => navigate(`/app/projects/${project.id}`)}
                              >
                                <td className="py-2 text-[#1A1A2E]">{task.title}</td>
                                <td className="py-2 text-gray-500">
                                  {task.due_date
                                    ? new Date(task.due_date).toLocaleDateString('es-CO', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                    : '-'}
                                </td>
                                <td className="py-2">
                                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${taskStatusColors[task.status] || 'bg-gray-100 text-gray-600'}`}>
                                    {taskStatusLabels[task.status] || task.status}
                                  </span>
                                </td>
                                <td className="py-2 text-gray-600">
                                  {task.assignees && task.assignees.length > 0
                                    ? task.assignees.map((a) => a.name).join(', ')
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <button
                        onClick={() => openQuickTask(project)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#1A1A2E] bg-white border border-gray-200 rounded-lg hover:border-[#1A1A2E] hover:bg-gray-50 transition-colors"
                      >
                        <Plus size={14} />
                        Nueva tarea
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            );
            })}
          </tbody>
        </table>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>

      {deletingProject && (() => {
        const taskCount = (tasksByProject[deletingProject.id] || []).length;
        const otherProjects = projects.filter(p => p.id !== deletingProject.id);
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-[#1A1A2E]">Eliminar proyecto</h2>
                <button onClick={closeDeleteModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Vas a eliminar <span className="font-semibold text-[#1A1A2E]">{deletingProject.name}</span>.
                {taskCount > 0
                  ? ` Tiene ${taskCount} tarea${taskCount === 1 ? '' : 's'}. ¿Qué quieres hacer con ${taskCount === 1 ? 'ella' : 'ellas'}?`
                  : ' Este proyecto no tiene tareas asociadas.'}
              </p>

              {taskCount > 0 && (
                <div className="space-y-3 mb-6">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="deleteAction"
                      value="move"
                      checked={deleteAction === 'move'}
                      onChange={() => setDeleteAction('move')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[#1A1A2E]">Mover las tareas a otro proyecto</div>
                      <div className="text-xs text-gray-500 mb-2">Se conservan todas las tareas, solo cambian de proyecto.</div>
                      {deleteAction === 'move' && (
                        <select
                          value={moveTargetId}
                          onChange={(e) => setMoveTargetId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                        >
                          <option value="">Selecciona un proyecto destino…</option>
                          {otherProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}{p.client_name ? ` — ${p.client_name}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="deleteAction"
                      value="delete"
                      checked={deleteAction === 'delete'}
                      onChange={() => setDeleteAction('delete')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-red-600">Eliminar las tareas también</div>
                      <div className="text-xs text-gray-500">Esta acción no se puede deshacer.</div>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting || (deleteAction === 'move' && !moveTargetId)}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {deleting && <Loader2 size={16} className="animate-spin" />}
                  Eliminar proyecto
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {quickTaskProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">Nueva tarea</h2>
              <button onClick={closeQuickTask} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              {quickTaskProject.client_name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-medium">{quickTaskProject.client_name}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1A1A2E]/5 text-[#1A1A2E] rounded-full">
                <span className="text-[#1A1A2E]/60">Proyecto:</span>
                <span className="font-medium">{quickTaskProject.name}</span>
              </span>
            </div>

            <form onSubmit={submitQuickTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={quickTaskForm.title}
                  onChange={(e) => setQuickTaskForm({ ...quickTaskForm, title: e.target.value })}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                  placeholder="Ej. Diseñar landing"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de entrega</label>
                  <input
                    type="date"
                    value={quickTaskForm.due_date}
                    onChange={(e) => setQuickTaskForm({ ...quickTaskForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select
                    value={quickTaskForm.priority}
                    onChange={(e) => setQuickTaskForm({ ...quickTaskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={quickTaskForm.status}
                    onChange={(e) => setQuickTaskForm({ ...quickTaskForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                  >
                    <option value="todo">Por hacer</option>
                    <option value="in_progress">En progreso</option>
                    <option value="review">En revisión</option>
                    <option value="done">Completado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <select
                    value={quickTaskForm.assignee_ids[0] || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQuickTaskForm({
                        ...quickTaskForm,
                        assignee_ids: v ? [Number(v)] : [],
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                  >
                    <option value="">Sin asignar</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeQuickTask}
                  disabled={creatingTask}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingTask || !quickTaskForm.title.trim()}
                  className="px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#1A1A2E]/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {creatingTask && <Loader2 size={16} className="animate-spin" />}
                  Crear tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
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
                  <label className="block text-sm font-medium mb-1">Cliente</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nickname || client.company || client.name}
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
                    <option value="planning">Planeación</option>
                    <option value="in_progress">En Progreso</option>
                    <option value="on_hold">En Espera</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">Etapa</label>
                    <button
                      type="button"
                      onClick={handleCreateStage}
                      className="text-xs text-[#1A1A2E] hover:underline"
                    >
                      + Nueva etapa
                    </button>
                  </div>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.stage_id}
                    onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                  >
                    <option value="">Sin etapa</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Presupuesto</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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

                {/* Template Tasks Section - Only for new projects */}
                {!editingProject && (
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id="useTemplate"
                        className="w-4 h-4"
                        checked={useTemplate}
                        onChange={(e) => {
                          setUseTemplate(e.target.checked);
                          if (!e.target.checked) {
                            setSelectedTemplateId('');
                            setTemplateProjectId('');
                            setTemplateTasks([]);
                          }
                        }}
                      />
                      <label htmlFor="useTemplate" className="text-sm font-medium flex items-center gap-2">
                        <FileText size={16} />
                        Usar plantilla o copiar tareas
                      </label>
                    </div>

                    {useTemplate && (
                      <div className="bg-[#1A1A2E]/5 p-4 rounded-xl">
                        {/* Source Selector */}
                        <div className="flex gap-2 mb-4">
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateSource('template');
                              setTemplateProjectId('');
                              setTemplateTasks([]);
                            }}
                            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                              templateSource === 'template'
                                ? 'bg-[#1A1A2E] text-white'
                                : 'bg-white border border-gray-100 hover:bg-gray-50'
                            }`}
                          >
                            <FileText size={16} className="inline mr-2" />
                            Plantilla
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateSource('project');
                              setSelectedTemplateId('');
                              setTemplateTasks([]);
                            }}
                            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                              templateSource === 'project'
                                ? 'bg-[#1A1A2E] text-white'
                                : 'bg-white border border-gray-100 hover:bg-gray-50'
                            }`}
                          >
                            <Copy size={16} className="inline mr-2" />
                            Copiar de Proyecto
                          </button>
                        </div>

                        {/* Template Selector */}
                        {templateSource === 'template' && (
                          <div className="mb-3">
                            <label className="block text-sm font-medium mb-1">Seleccionar plantilla</label>
                            {templates.length === 0 ? (
                              <p className="text-sm text-gray-600 bg-white p-3 rounded-xl border border-gray-100">
                                No hay plantillas disponibles. <a href="/plantillas-proyecto" className="text-[#1A1A2E] font-medium hover:underline">Crear una plantilla</a>
                              </p>
                            ) : (
                              <select
                                className="w-full border border-gray-100 rounded-xl px-3 py-2 bg-white"
                                value={selectedTemplateId}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                              >
                                <option value="">Seleccione una plantilla...</option>
                                {templates.map((template) => (
                                  <option key={template.id} value={template.id}>
                                    {template.name} ({template.task_count || 0} tareas)
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                        {/* Project Selector */}
                        {templateSource === 'project' && (
                          <div className="mb-3">
                            <label className="block text-sm font-medium mb-1">Seleccionar proyecto base</label>
                            <select
                              className="w-full border border-gray-100 rounded-xl px-3 py-2 bg-white"
                              value={templateProjectId}
                              onChange={(e) => handleTemplateProjectChange(e.target.value)}
                            >
                              <option value="">Seleccione un proyecto...</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {loadingTasks && (
                          <p className="text-sm text-gray-600">Cargando tareas...</p>
                        )}

                        {!loadingTasks && (selectedTemplateId || templateProjectId) && templateTasks.length === 0 && (
                          <p className="text-sm text-gray-600">No hay tareas disponibles.</p>
                        )}

                        {templateTasks.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                              <ListTodo size={16} />
                              Tareas que se crearán ({templateTasks.length}):
                            </p>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                              {templateTasks.map((task, index) => {
                                const taskKey = task.id || task.title;
                                return (
                                  <div
                                    key={taskKey}
                                    className="bg-white p-2 rounded-xl border border-gray-100 text-sm"
                                  >
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="font-medium text-[#1A1A2E]">{task.title}</span>
                                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                                        task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                                        task.priority === 'high' ? 'bg-[#F97316]/10 text-[#F97316]' :
                                        task.priority === 'medium' ? 'bg-[#1A1A2E]/10 text-[#1A1A2E]' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {task.priority}
                                      </span>
                                    </div>
                                    <div className="flex gap-2">
                                      <select
                                        className="flex-1 border border-gray-100 rounded-lg px-2 py-1 text-sm text-gray-600"
                                        value={templateTasksAssignees[taskKey] || ''}
                                        onChange={(e) => setTemplateTasksAssignees({
                                          ...templateTasksAssignees,
                                          [taskKey]: e.target.value ? Number(e.target.value) : ''
                                        })}
                                      >
                                        <option value="">Sin asignar</option>
                                        {teamMembers.map((m) => (
                                          <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="date"
                                        className="border border-gray-100 rounded-lg px-2 py-1 text-sm"
                                        placeholder="Fecha de vencimiento"
                                        value={templateTasksDueDates[taskKey] || ''}
                                        onChange={(e) => setTemplateTasksDueDates({
                                          ...templateTasksDueDates,
                                          [taskKey]: e.target.value
                                        })}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Asigna un responsable y fecha de entrega a cada tarea (opcional)
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
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

export default Projects;
