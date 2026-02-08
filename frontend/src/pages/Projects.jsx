import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, clientsAPI, tasksAPI, teamAPI, projectTemplatesAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, FolderKanban, Copy, ListTodo, FileText, CheckSquare, Square, MinusSquare, Loader2 } from 'lucide-react';

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
    budget: 0,
    start_date: '',
    end_date: '',
  });

  // Template feature state
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateSource, setTemplateSource] = useState('template'); // 'template' or 'project'
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateProjectId, setTemplateProjectId] = useState('');
  const [templateTasks, setTemplateTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateTasksDueDates, setTemplateTasksDueDates] = useState({}); // { taskId: 'date' }

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, clientsRes, teamRes, templatesRes] = await Promise.all([
        projectsAPI.getAll(),
        clientsAPI.getAll('active'),
        teamAPI.getAll({ status: 'active' }),
        projectTemplatesAPI.getAll(),
      ]);
      setProjects(projectsRes.data);
      setClients(clientsRes.data);
      setTeamMembers(teamRes.data);
      setTemplates(templatesRes.data);
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
      setTemplateTasks(response.data.tasks || []);
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
          for (const task of templateTasks) {
            const taskKey = task.id || task.title;
            await tasksAPI.create({
              title: task.title,
              description: task.description || '',
              project_id: newProjectId,
              assignee_ids: task.assignees?.length > 0
                ? task.assignees.map(a => a.id)
                : (task.assigned_to ? [task.assigned_to] : []),
              status: 'todo', // Reset status for new project
              priority: task.priority || 'medium',
              due_date: templateTasksDueDates[taskKey] || null, // Use individual due date
              is_recurring: task.is_recurring || false,
              recurrence_pattern: task.recurrence_pattern || null,
              estimated_hours: task.estimated_hours || null,
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
      budget: project.budget,
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este proyecto?')) return;
    try {
      await projectsAPI.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      client_id: '',
      status: 'planning',
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
  };

  const handleNew = () => {
    resetForm();
    setEditingProject(null);
    setShowModal(true);
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
        <button
          onClick={handleNew}
          className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
        >
          <Plus size={20} />
          Nuevo Proyecto
        </button>
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
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Presupuesto
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
            {projects.map((project) => (
              <tr
                key={project.id}
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
                <td className="px-6 py-4 whitespace-nowrap font-medium text-[#1A1A2E]">{project.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{project.client_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-[#1A1A2E]">
                  ${project.budget?.toLocaleString('es-CO')}
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
                    onClick={() => handleDelete(project.id)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
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
                        {client.company || client.name}
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
                                    <input
                                      type="date"
                                      className="w-full border border-gray-100 rounded-lg px-2 py-1 text-sm"
                                      placeholder="Fecha de vencimiento"
                                      value={templateTasksDueDates[taskKey] || ''}
                                      onChange={(e) => setTemplateTasksDueDates({
                                        ...templateTasksDueDates,
                                        [taskKey]: e.target.value
                                      })}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Asigna una fecha de vencimiento a cada tarea (opcional)
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
