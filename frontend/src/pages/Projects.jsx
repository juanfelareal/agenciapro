import { useEffect, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, clientsAPI, tasksAPI, teamAPI, projectTemplatesAPI, projectStagesAPI, taskCommentsAPI, taskFilesAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Trash2, X, FolderKanban, Copy, ListTodo, FileText, CheckSquare, Square, MinusSquare, Loader2, ChevronRight, ChevronDown, Paperclip, ExternalLink, Link as LinkIcon, Edit2, Check } from 'lucide-react';
import { getEmbed } from '../utils/embedUrl';

const Projects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    stage_id: '',
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

  // Task quick modal state (create or edit), scoped to a specific project
  const [quickTaskProject, setQuickTaskProject] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [quickTaskForm, setQuickTaskForm] = useState({
    title: '',
    project_id: '',
    due_date: '',
    status: 'todo',
    priority: 'medium',
    assignee_ids: [],
    visible_to_client: true,
    requires_client_approval: false,
    delivery_url: '',
  });
  // Si la tarea requiere aprobación y no hay entregable, exigir override consciente.
  const [noFilesIntended, setNoFilesIntended] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [deletingTaskInline, setDeletingTaskInline] = useState(false);

  // Confirmación al marcar tarea como Completada: ¿necesita aprobación del cliente?
  const [doneApprovalPrompt, setDoneApprovalPrompt] = useState(false);
  const [deliverablePrompt, setDeliverablePrompt] = useState(false);
  const [deliverableLink, setDeliverableLink] = useState('');
  const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

  // Aprobación + comentarios para el modal de tarea editable
  const [editingTaskFull, setEditingTaskFull] = useState(null); // datos crudos del task (incluye client_approval_status, _notes, _date)
  const [taskComments, setTaskComments] = useState([]);
  const [loadingTaskComments, setLoadingTaskComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Entregables (links/embeds) de la tarea, modal de edición rápida.
  const [taskFilesList, setTaskFilesList] = useState([]);
  const [loadingTaskFiles, setLoadingTaskFiles] = useState(false);
  const [newDeliverableUrl, setNewDeliverableUrl] = useState('');
  const [newDeliverableTitle, setNewDeliverableTitle] = useState('');
  const [newDeliverableDescription, setNewDeliverableDescription] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [editingFileId, setEditingFileId] = useState(null);
  const [editingFileTitle, setEditingFileTitle] = useState('');
  const [editingFileDescription, setEditingFileDescription] = useState('');
  const [savingFileEdit, setSavingFileEdit] = useState(false);

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
    if (!url || !editingTaskId) return;
    try {
      new URL(url);
    } catch {
      alert('El link no parece válido. Asegúrate de incluir https://');
      return;
    }
    setAddingLink(true);
    try {
      await taskFilesAPI.addLink(editingTaskId, url, user?.id, {
        title: newDeliverableTitle.trim() || undefined,
        description: newDeliverableDescription.trim() || undefined,
      });
      setNewDeliverableUrl('');
      setNewDeliverableTitle('');
      setNewDeliverableDescription('');
      await loadTaskFiles(editingTaskId);
    } catch (error) {
      console.error('Error adding link:', error);
      alert(error.response?.data?.error || 'Error al agregar el link');
    } finally {
      setAddingLink(false);
    }
  };

  const startEditFile = (f) => {
    setEditingFileId(f.id);
    setEditingFileTitle(f.file_name && f.file_name !== f.file_path ? f.file_name : '');
    setEditingFileDescription(f.description || '');
  };

  const cancelEditFile = () => {
    setEditingFileId(null);
    setEditingFileTitle('');
    setEditingFileDescription('');
  };

  const saveEditFile = async () => {
    if (!editingFileId) return;
    setSavingFileEdit(true);
    try {
      await taskFilesAPI.update(editingFileId, {
        title: editingFileTitle.trim() || null,
        description: editingFileDescription.trim() || null,
      });
      await loadTaskFiles(editingTaskId);
      cancelEditFile();
    } catch (error) {
      console.error('Error updating file:', error);
      alert(error.response?.data?.error || 'Error al guardar');
    } finally {
      setSavingFileEdit(false);
    }
  };

  const handleDeleteTaskFile = async (fileId) => {
    if (!fileId || !editingTaskId) return;
    if (!confirm('¿Eliminar este archivo? El cliente dejará de verlo.')) return;
    try {
      await taskFilesAPI.delete(fileId);
      await loadTaskFiles(editingTaskId);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert(error.response?.data?.error || 'Error al eliminar el archivo');
    }
  };

  const openQuickTask = (project) => {
    setQuickTaskProject(project);
    setEditingTaskId(null);
    setEditingTaskFull(null);
    setTaskComments([]);
    setNewCommentText('');
    setNoFilesIntended(false);
    setQuickTaskForm({
      title: '',
      project_id: project.id,
      due_date: '',
      status: 'todo',
      priority: 'medium',
      assignee_ids: [],
      visible_to_client: true,
      requires_client_approval: false,
      delivery_url: '',
    });
  };

  const openEditTask = async (project, task) => {
    setQuickTaskProject(project);
    setEditingTaskId(task.id);
    setEditingTaskFull(task);
    setNewCommentText('');
    setTaskFilesList([]);
    setNoFilesIntended(false);
    setQuickTaskForm({
      title: task.title || '',
      project_id: task.project_id || project.id,
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      assignee_ids: (task.assignees || []).map((a) => a.id),
      visible_to_client: task.visible_to_client === undefined ? true : !!task.visible_to_client,
      requires_client_approval: !!task.requires_client_approval,
      delivery_url: task.delivery_url || '',
    });
    // Fetch full task (for fresh approval state) + comments + files
    setLoadingTaskComments(true);
    try {
      const [fullRes, commentsRes] = await Promise.all([
        tasksAPI.getById(task.id),
        taskCommentsAPI.getByTask(task.id),
        loadTaskFiles(task.id),
      ]);
      setEditingTaskFull(fullRes.data);
      setTaskComments(commentsRes.data || []);
    } catch (error) {
      console.error('Error loading task detail:', error);
    } finally {
      setLoadingTaskComments(false);
    }
  };

  const closeQuickTask = () => {
    setQuickTaskProject(null);
    setEditingTaskId(null);
    setEditingTaskFull(null);
    setTaskComments([]);
    setNewCommentText('');
    setTaskFilesList([]);
    setNoFilesIntended(false);
    setNewDeliverableUrl('');
    setNewDeliverableTitle('');
    setNewDeliverableDescription('');
    setEditingFileId(null);
  };

  const validateApprovalDeliverable = () => {
    if (!quickTaskForm.requires_client_approval) return true;
    const hasFile = taskFilesList.length > 0;
    const hasLink = (quickTaskForm.delivery_url || '').trim().length > 0;
    if (hasFile || hasLink || noFilesIntended) return true;
    alert(
      'Esta tarea requiere aprobación del cliente.\n\nAntes de guardar, sube al menos un archivo, agrega un link de entrega, o marca "Sin archivos" para confirmar que el cliente revisará por otro medio.'
    );
    return false;
  };

  const submitTaskComment = async (e) => {
    e.preventDefault();
    if (!editingTaskId || !newCommentText.trim() || !user?.id) return;
    setPostingComment(true);
    try {
      await taskCommentsAPI.create({
        task_id: editingTaskId,
        user_id: user.id,
        comment: newCommentText.trim(),
      });
      const refreshed = await taskCommentsAPI.getByTask(editingTaskId);
      setTaskComments(refreshed.data || []);
      setNewCommentText('');
    } catch (error) {
      console.error('Error posting comment:', error);
      alert(error.response?.data?.error || 'Error al publicar el comentario');
    } finally {
      setPostingComment(false);
    }
  };

  const submitQuickTask = async (e) => {
    e.preventDefault();
    if (!quickTaskProject || !quickTaskForm.title.trim()) return;
    if (!validateApprovalDeliverable()) return;
    // Si pasa a Completada y no se está pidiendo aprobación, preguntar.
    const justMarkedDone =
      quickTaskForm.status === 'done' &&
      (!editingTaskFull || editingTaskFull.status !== 'done');
    if (justMarkedDone && !quickTaskForm.requires_client_approval) {
      setDoneApprovalPrompt(true);
      return;
    }
    await persistQuickTask(quickTaskForm);
  };

  const persistQuickTask = async (data) => {
    setCreatingTask(true);
    try {
      const targetProjectId = data.project_id
        ? Number(data.project_id)
        : quickTaskProject.id;
      const payload = {
        title: data.title.trim(),
        project_id: targetProjectId,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assignee_ids: data.assignee_ids,
        visible_to_client: data.visible_to_client,
        requires_client_approval: data.requires_client_approval,
        delivery_url: (data.delivery_url || '').trim() || null,
      };
      if (editingTaskId) {
        await tasksAPI.update(editingTaskId, payload);
      } else {
        await tasksAPI.create(payload);
      }
      setExpandedIds((prev) => new Set(prev).add(targetProjectId));
      closeQuickTask();
      loadData();
    } catch (error) {
      console.error('Error saving task:', error);
      alert(error.response?.data?.error || 'Error al guardar la tarea');
    } finally {
      setCreatingTask(false);
    }
  };

  const confirmDoneWithApproval = () => {
    setDoneApprovalPrompt(false);
    setDeliverableLink('');
    setDeliverableFile(null);
    setDeliverablePrompt(true);
  };

  const confirmDoneWithoutApproval = async () => {
    setDoneApprovalPrompt(false);
    await persistQuickTask(quickTaskForm);
  };

  const cancelDeliverablePrompt = () => {
    setDeliverablePrompt(false);
    setDeliverableLink('');
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
      const targetProjectId = quickTaskForm.project_id
        ? Number(quickTaskForm.project_id)
        : quickTaskProject.id;
      const payload = {
        title: quickTaskForm.title.trim(),
        project_id: targetProjectId,
        status: quickTaskForm.status,
        priority: quickTaskForm.priority,
        due_date: quickTaskForm.due_date || null,
        assignee_ids: quickTaskForm.assignee_ids,
        visible_to_client: true,
        requires_client_approval: true,
      };
      let taskId;
      if (editingTaskId) {
        await tasksAPI.update(editingTaskId, payload);
        taskId = editingTaskId;
      } else {
        const res = await tasksAPI.create(payload);
        taskId = res.data?.id;
      }
      if (taskId) {
        await taskFilesAPI.addLink(taskId, link, user?.id);
      }
      setExpandedIds((prev) => new Set(prev).add(targetProjectId));
      cancelDeliverablePrompt();
      closeQuickTask();
      loadData();
    } catch (error) {
      console.error('Error sending deliverable:', error);
      alert(error.response?.data?.error || 'Error al guardar el entregable');
    } finally {
      setSubmittingDeliverable(false);
    }
  };

  const deleteTaskInline = async () => {
    if (!editingTaskId) return;
    if (!confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return;
    setDeletingTaskInline(true);
    try {
      await tasksAPI.delete(editingTaskId);
      closeQuickTask();
      loadData();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert(error.response?.data?.error || 'Error al eliminar la tarea');
    } finally {
      setDeletingTaskInline(false);
    }
  };

  // Close the quick task modal with Escape
  useEffect(() => {
    if (!quickTaskProject) return;
    const handler = (e) => { if (e.key === 'Escape') closeQuickTask(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [quickTaskProject]);

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
      stage_id: project.stage_id || '',
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
      stage_id: '',
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
                Tareas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progreso
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
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const total = projectTasks.length;
                    const done = projectTasks.filter((t) => t.status === 'done').length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#10B981] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 tabular-nums w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })()}
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
                  <td colSpan={7} className="px-6 py-4">
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
                                onClick={() => openEditTask(project, task)}
                                title="Editar tarea"
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
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeQuickTask}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#1A1A2E]">
                {editingTaskId ? 'Editar tarea' : 'Nueva tarea'}
              </h2>
              <button onClick={closeQuickTask} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
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

              {(() => {
                const selectedProject = projects.find((p) => p.id === Number(quickTaskForm.project_id));
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                    <select
                      value={quickTaskForm.project_id || ''}
                      onChange={(e) => setQuickTaskForm({ ...quickTaskForm, project_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.client_name ? ` — ${p.client_name}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Cliente: <span className="font-medium text-gray-700">{selectedProject?.client_name || 'Sin cliente'}</span>
                    </p>
                  </div>
                );
              })()}

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

              {/* Visibility + approval toggles */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!quickTaskForm.visible_to_client}
                    onChange={(e) => setQuickTaskForm({ ...quickTaskForm, visible_to_client: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  Visible para el cliente
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!quickTaskForm.requires_client_approval}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setQuickTaskForm({ ...quickTaskForm, requires_client_approval: v });
                      if (!v) setNoFilesIntended(false);
                    }}
                    disabled={!quickTaskForm.visible_to_client}
                    className="w-4 h-4 rounded"
                  />
                  Pedir aprobación al cliente
                </label>
                {quickTaskForm.requires_client_approval && !quickTaskForm.visible_to_client && (
                  <p className="text-xs text-amber-600 pl-6">
                    Para pedir aprobación, la tarea debe ser visible para el cliente.
                  </p>
                )}

                {/* Warning panel + delivery URL when approval is required */}
                {quickTaskForm.requires_client_approval && quickTaskForm.visible_to_client && (
                  <div className="ml-6 space-y-2">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                        Link de entrega (Drive, Figma, etc.)
                      </label>
                      <input
                        type="url"
                        value={quickTaskForm.delivery_url}
                        onChange={(e) => setQuickTaskForm({ ...quickTaskForm, delivery_url: e.target.value })}
                        placeholder="https://drive.google.com/..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                      />
                    </div>
                    {taskFilesList.length === 0 && !(quickTaskForm.delivery_url || '').trim() && (
                      <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                        <p className="text-sm font-medium text-amber-800">⚠️ Falta el entregable</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Sube un archivo en la sección <strong>Archivos para el cliente</strong>, agrega un link arriba, o marca abajo que no requiere archivos.
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
                )}
              </div>

              {/* Approval status banner — only when editing and client has acted */}
              {editingTaskId && editingTaskFull?.requires_client_approval && editingTaskFull?.client_approval_status && (() => {
                const status = editingTaskFull.client_approval_status;
                const cfg =
                  status === 'approved' ? { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Cliente aprobó' } :
                  status === 'rejected' ? { bg: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Cliente rechazó' } :
                  status === 'changes_requested' ? { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', label: 'Cliente solicitó cambios' } :
                  { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'Esperando aprobación del cliente' };
                return (
                  <div className={`border rounded-xl p-3 ${cfg.bg}`}>
                    <p className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</p>
                    {editingTaskFull.client_approval_date && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(editingTaskFull.client_approval_date).toLocaleDateString('es-CO', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                    {editingTaskFull.client_approval_notes && (
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                        <span className="font-medium">Notas: </span>{editingTaskFull.client_approval_notes}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Entregables — links/embeds. Solo al editar. */}
              {editingTaskId && (
                <div className="border-t border-gray-100 pt-4">
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
                        const isEditing = editingFileId === f.id;
                        const customTitle = f.file_name && f.file_name !== f.file_path ? f.file_name : null;
                        if (isEditing) {
                          return (
                            <div key={f.id} className="p-3 border border-[#1A1A2E] rounded-xl bg-white space-y-2">
                              <input
                                type="text"
                                value={editingFileTitle}
                                onChange={(e) => setEditingFileTitle(e.target.value)}
                                placeholder="Título"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                                autoFocus
                              />
                              <textarea
                                value={editingFileDescription}
                                onChange={(e) => setEditingFileDescription(e.target.value)}
                                placeholder="Descripción para el cliente (opcional)"
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEditFile}
                                  disabled={savingFileEdit}
                                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={saveEditFile}
                                  disabled={savingFileEdit}
                                  className="px-3 py-1.5 text-xs bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E]/90 disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  {savingFileEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  Guardar
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={f.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl bg-white">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center mt-0.5">
                              <LinkIcon className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {isLegacyFile ? (
                                <p className="text-sm text-amber-700 font-medium">Archivo no disponible</p>
                              ) : (
                                <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">{embed?.label || 'Link'}</p>
                              )}
                              <p className={`text-sm font-medium ${isLegacyFile ? 'text-gray-400' : 'text-[#1A1A2E]'}`}>
                                {customTitle || (isLegacyFile ? f.file_name : (embed?.label || 'Link'))}
                              </p>
                              {f.description && (
                                <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{f.description}</p>
                              )}
                              {!isLegacyFile && (
                                <a
                                  href={f.file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-gray-400 hover:underline truncate block mt-0.5"
                                  title={f.file_path}
                                >
                                  {f.file_path}
                                </a>
                              )}
                            </div>
                            {!isLegacyFile && (
                              <button
                                type="button"
                                onClick={() => startEditFile(f)}
                                className="p-1.5 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                title="Editar título y descripción"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
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
                  <div className="space-y-2 p-3 border border-dashed border-gray-300 rounded-xl">
                    <input
                      type="text"
                      value={newDeliverableTitle}
                      onChange={(e) => setNewDeliverableTitle(e.target.value)}
                      placeholder="Título (ej: Pieza para correo de bienvenida)"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                      disabled={addingLink}
                    />
                    <textarea
                      value={newDeliverableDescription}
                      onChange={(e) => setNewDeliverableDescription(e.target.value)}
                      placeholder="Descripción para el cliente (opcional)"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent resize-none"
                      disabled={addingLink}
                    />
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
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">El cliente verá la previsualización embebida (Drive, Figma, Loom, YouTube, etc.). Para Drive, deja "cualquier persona con el enlace puede ver".</p>
                </div>
              )}

              {/* Comments section — only when editing */}
              {editingTaskId && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1A1A2E]">Comentarios</h3>
                    <span className="text-xs text-gray-400">{taskComments.length}</span>
                  </div>
                  {loadingTaskComments ? (
                    <p className="text-xs text-gray-400">Cargando…</p>
                  ) : taskComments.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin comentarios todavía.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {taskComments.map((c) => (
                        <div
                          key={`${c.author_type}-${c.id}`}
                          className={`p-3 rounded-xl border text-sm ${
                            c.author_type === 'client'
                              ? 'bg-blue-50 border-blue-100'
                              : 'bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-[#1A1A2E] text-xs">{c.user_name || 'Anónimo'}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              c.author_type === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {c.author_type === 'client' ? 'Cliente' : 'Equipo'}
                            </span>
                            <span className="text-[10px] text-gray-400 ml-auto">
                              {new Date(c.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-line">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={submitTaskComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Escribe un comentario para el cliente o el equipo…"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={postingComment || !newCommentText.trim()}
                      className="px-3 py-2 text-sm bg-[#1A1A2E] text-white rounded-xl hover:bg-[#1A1A2E]/90 transition-colors disabled:opacity-50"
                    >
                      {postingComment ? '…' : 'Enviar'}
                    </button>
                  </form>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                {editingTaskId && (
                  <button
                    type="button"
                    onClick={deleteTaskInline}
                    disabled={creatingTask || deletingTaskInline}
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {deletingTaskInline ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Eliminar
                  </button>
                )}
                <div className="flex justify-end gap-3 ml-auto">
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
                    {editingTaskId ? 'Guardar cambios' : 'Crear tarea'}
                  </button>
                </div>
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

      {/* Deliverable prompt — second step after confirming approval */}
      {deliverablePrompt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#1A1A2E] mb-1">Entregable para el cliente</h3>
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

      {/* Approval prompt — shown when marking a task as Completada from quick modal */}
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

export default Projects;
