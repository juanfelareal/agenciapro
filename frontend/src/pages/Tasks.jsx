import { useEffect, useState } from 'react';
import { tasksAPI, projectsAPI, teamAPI, tagsAPI, subtasksAPI } from '../utils/api';
import { Plus, X, ListChecks, Copy, Trash2 } from 'lucide-react';
import SubtaskList from '../components/SubtaskList';
import TagSelector, { TagBadge } from '../components/TagSelector';

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
  const [draggedTask, setDraggedTask] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [subtaskProgress, setSubtaskProgress] = useState({ total: 0, completed: 0, progress: 0 });
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
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
      days: [], // 0=Domingo, 1=Lunes, 2=Martes, etc.
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
    setFormData({ ...formData, status });
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

  // Drag & Drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      await handleStatusChange(draggedTask, newStatus);
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDeleteTask = async (e, taskId) => {
    e.stopPropagation(); // Prevent opening the modal
    if (confirm('¿Está seguro de eliminar esta tarea?')) {
      try {
        await tasksAPI.delete(taskId);
        loadData();
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Error al eliminar la tarea');
      }
    }
  };

  const columns = [
    { id: 'todo', title: 'Por Hacer', color: 'bg-gray-100' },
    { id: 'in_progress', title: 'En Progreso', color: 'bg-blue-100' },
    { id: 'review', title: 'En Revisión', color: 'bg-yellow-100' },
    { id: 'done', title: 'Completado', color: 'bg-green-100' },
  ];

  const priorityColors = {
    low: 'bg-gray-200 text-gray-700',
    medium: 'bg-blue-200 text-blue-700',
    high: 'bg-orange-200 text-orange-700',
    urgent: 'bg-red-200 text-red-700',
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Tareas</h1>
        <p className="text-gray-600">Gestión de tareas del equipo - Vista Kanban</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className={`${column.color} rounded-lg p-4 min-h-[500px] transition-all ${
              draggedTask && draggedTask.status !== column.id ? 'ring-2 ring-primary-400 ring-opacity-50' : ''
            }`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{column.title}</h3>
              <button
                onClick={() => handleNew(column.id)}
                className="text-gray-600 hover:text-gray-800"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {tasks
                .filter((task) => task.status === column.id)
                .map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white p-3 rounded shadow cursor-move hover:shadow-md transition-all group ${
                      draggedTask?.id === task.id ? 'opacity-50 scale-95' : 'opacity-100'
                    }`}
                    onClick={() => {
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
                      });
                      // Load task tags
                      const tags = taskTags[task.id] || [];
                      setSelectedTagIds(tags.map(t => t.id));
                      // Load subtask progress
                      setSubtaskProgress(taskSubtaskProgress[task.id] || { total: 0, completed: 0, progress: 0 });
                      setShowModal(true);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold flex-1 pr-2">{task.title}</h4>
                      <div className="flex items-center gap-1">
                        {!!task.is_recurring && (
                          <span className="text-blue-600" title="Tarea Recurrente">🔄</span>
                        )}
                        <button
                          onClick={(e) => handleDeleteTask(e, task.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar tarea"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Tags */}
                    {taskTags[task.id]?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {taskTags[task.id].slice(0, 3).map(tag => (
                          <span
                            key={tag.id}
                            className="px-1.5 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {taskTags[task.id].length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-500">
                            +{taskTags[task.id].length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {task.project_name && (
                      <p className="text-xs text-gray-600 mb-1">{task.project_name}</p>
                    )}
                    {task.assigned_to_name && (
                      <p className="text-xs text-gray-600 mb-1">👤 {task.assigned_to_name}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </span>
                      {/* Subtask progress indicator */}
                      {taskSubtaskProgress[task.id]?.total > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <ListChecks size={12} />
                          {taskSubtaskProgress[task.id].completed}/{taskSubtaskProgress[task.id].total}
                        </span>
                      )}
                    </div>
                    {task.due_date && (
                      <p className="text-xs text-gray-500 mt-2">📅 {task.due_date}</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

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
