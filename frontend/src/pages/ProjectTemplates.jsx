import { useEffect, useState } from 'react';
import { projectTemplatesAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, FileText, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

const ProjectTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await projectTemplatesAPI.getAll();
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setFormData({ name: '', description: '' });
    setTasks([]);
    setNewTaskTitle('');
    setShowModal(true);
  };

  const handleEdit = async (template) => {
    try {
      const response = await projectTemplatesAPI.getById(template.id);
      setEditingTemplate(response.data);
      setFormData({
        name: response.data.name,
        description: response.data.description || '',
      });
      setTasks(response.data.tasks || []);
      setNewTaskTitle('');
      setShowModal(true);
    } catch (error) {
      console.error('Error loading template:', error);
      alert('Error al cargar la plantilla');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar esta plantilla?')) return;
    try {
      await projectTemplatesAPI.delete(id);
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error al eliminar la plantilla');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        // Update template
        await projectTemplatesAPI.update(editingTemplate.id, formData);
      } else {
        // Create template with tasks
        await projectTemplatesAPI.create({
          ...formData,
          tasks: tasks.map((t, index) => ({
            title: t.title,
            description: t.description || '',
            order_index: index,
          })),
        });
      }
      setShowModal(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  // Task management for editing mode
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    if (editingTemplate) {
      try {
        const response = await projectTemplatesAPI.addTask(editingTemplate.id, {
          title: newTaskTitle.trim(),
          description: '',
        });
        setTasks([...tasks, response.data]);
        setNewTaskTitle('');
      } catch (error) {
        console.error('Error adding task:', error);
        alert('Error al agregar tarea');
      }
    } else {
      // For new templates, just add to local state
      setTasks([
        ...tasks,
        {
          id: Date.now(), // Temp ID
          title: newTaskTitle.trim(),
          description: '',
          order_index: tasks.length,
        },
      ]);
      setNewTaskTitle('');
    }
  };

  const handleUpdateTask = async (index, field, value) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);

    if (editingTemplate) {
      try {
        await projectTemplatesAPI.updateTask(editingTemplate.id, updatedTasks[index].id, {
          [field]: value,
        });
      } catch (error) {
        console.error('Error updating task:', error);
      }
    }
  };

  const handleDeleteTask = async (index) => {
    const task = tasks[index];

    if (editingTemplate && task.id) {
      try {
        await projectTemplatesAPI.deleteTask(editingTemplate.id, task.id);
      } catch (error) {
        console.error('Error deleting task:', error);
        return;
      }
    }

    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleMoveTask = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tasks.length) return;

    const newTasks = [...tasks];
    [newTasks[index], newTasks[newIndex]] = [newTasks[newIndex], newTasks[index]];
    setTasks(newTasks);

    if (editingTemplate) {
      try {
        await projectTemplatesAPI.reorderTasks(
          editingTemplate.id,
          newTasks.map((t) => t.id)
        );
      } catch (error) {
        console.error('Error reordering tasks:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Plantillas de Proyecto</h1>
          <p className="text-gray-600">Crea plantillas con tareas predefinidas para nuevos proyectos</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-600"
        >
          <Plus size={20} />
          Nueva Plantilla
        </button>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No hay plantillas</h3>
          <p className="text-gray-500 mb-4">Crea tu primera plantilla para agilizar la creación de proyectos</p>
          <button
            onClick={handleNew}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600"
          >
            Crear Plantilla
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{template.name}</h3>
                    <span className="text-sm text-gray-500">
                      {template.task_count || 0} tarea{(template.task_count || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {template.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Ej: Seguimiento Tráfico"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">Descripción</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2"
                    rows="2"
                    placeholder="Descripción de la plantilla..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Tasks Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800">Tareas de la Plantilla</h3>
                    <span className="text-sm text-gray-500">{tasks.length} tarea{tasks.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Add Task Input */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder="Agregar nueva tarea..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                    />
                    <button
                      type="button"
                      onClick={handleAddTask}
                      className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600"
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  {/* Tasks List */}
                  {tasks.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                      No hay tareas. Agrega tareas que se crearán automáticamente con cada proyecto.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {tasks.map((task, index) => (
                        <div
                          key={task.id || index}
                          className="bg-gray-50 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-3">
                            {/* Reorder Buttons */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveTask(index, -1)}
                                disabled={index === 0}
                                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveTask(index, 1)}
                                disabled={index === tasks.length - 1}
                                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>

                            {/* Task Index */}
                            <span className="text-sm text-gray-400 w-6">{index + 1}.</span>

                            {/* Task Title */}
                            <input
                              type="text"
                              className="flex-1 bg-transparent border-0 focus:ring-0 text-sm font-medium"
                              value={task.title}
                              onChange={(e) => handleUpdateTask(index, 'title', e.target.value)}
                              placeholder="Título de la tarea"
                            />

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(index)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Task Description */}
                          <div className="mt-2 ml-14">
                            <input
                              type="text"
                              className="w-full bg-white border rounded px-2 py-1.5 text-sm text-gray-600"
                              value={task.description || ''}
                              onChange={(e) => handleUpdateTask(index, 'description', e.target.value)}
                              placeholder="Descripción de la tarea (opcional)"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-400"
              >
                {saving ? 'Guardando...' : editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectTemplates;
