import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, clientsAPI, tasksAPI, teamAPI, projectTemplatesAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, FolderKanban, Copy, ListTodo, FileText } from 'lucide-react';

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
              assigned_to: task.assigned_to || null,
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
    planning: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    planning: 'Planeación',
    in_progress: 'En Progreso',
    on_hold: 'En Espera',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Proyectos</h1>
          <p className="text-gray-600">Gestión de proyectos y presupuestos</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-600"
        >
          <Plus size={20} />
          Nuevo Proyecto
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Proyecto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Presupuesto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Gastado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{project.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{project.client_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColors[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  ${project.budget?.toLocaleString('es-CO')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  ${project.spent?.toLocaleString('es-CO')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="text-primary-600 hover:text-primary-800 mr-3"
                    title="Ver tablero del proyecto"
                  >
                    <FolderKanban size={18} />
                  </button>
                  <button
                    onClick={() => handleEdit(project)}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={24} />
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
                      <div className="bg-blue-50 p-4 rounded-lg">
                        {/* Source Selector */}
                        <div className="flex gap-2 mb-4">
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateSource('template');
                              setTemplateProjectId('');
                              setTemplateTasks([]);
                            }}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              templateSource === 'template'
                                ? 'bg-primary-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
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
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              templateSource === 'project'
                                ? 'bg-primary-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
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
                              <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                                No hay plantillas disponibles. <a href="/plantillas-proyecto" className="text-primary-600 hover:underline">Crear una plantilla</a>
                              </p>
                            ) : (
                              <select
                                className="w-full border rounded-lg px-3 py-2 bg-white"
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
                              className="w-full border rounded-lg px-3 py-2 bg-white"
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
                                    className="bg-white p-2 rounded border text-sm"
                                  >
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="font-medium">{task.title}</span>
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                        task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                        task.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {task.priority}
                                      </span>
                                    </div>
                                    <input
                                      type="date"
                                      className="w-full border rounded px-2 py-1 text-sm"
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
              <div className="flex justify-end gap-3 mt-6">
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

export default Projects;
