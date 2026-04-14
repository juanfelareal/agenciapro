import { useEffect, useState, useMemo } from 'react';
import { projectTemplatesAPI, teamAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, FileText, ChevronUp, ChevronDown, Tag, Check, Layers } from 'lucide-react';

const ProjectTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [standaloneCategories, setStandaloneCategories] = useState([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    subcategory: '',
  });
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  // Derive categories from templates + standalone
  const categories = useMemo(() => {
    const fromTemplates = templates.map(t => t.category).filter(Boolean);
    const cats = [...new Set([...fromTemplates, ...standaloneCategories])].sort();
    return cats;
  }, [templates, standaloneCategories]);

  // Derive subcategories for the selected category in the form
  const subcategoriesForFormCategory = useMemo(() => {
    const cat = showNewCategory ? newCategoryName.trim() : formData.category;
    if (!cat) return [];
    return [...new Set(templates.filter(t => t.category === cat && t.subcategory).map(t => t.subcategory))].sort();
  }, [templates, formData.category, showNewCategory, newCategoryName]);

  const filteredTemplates = activeCategory === 'all'
    ? templates
    : activeCategory === 'uncategorized'
      ? templates.filter(t => !t.category)
      : templates.filter(t => t.category === activeCategory);

  // Group filtered templates by subcategory
  const groupedTemplates = useMemo(() => {
    const hasSubcategories = filteredTemplates.some(t => t.subcategory);
    if (!hasSubcategories) return [{ subcategory: null, templates: filteredTemplates }];

    const groups = {};
    filteredTemplates.forEach(t => {
      const key = t.subcategory || '__none__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    // Sort: named subcategories first (sorted), then ungrouped at the end
    const sorted = Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return a.localeCompare(b);
      })
      .map(([key, temps]) => ({
        subcategory: key === '__none__' ? null : key,
        templates: temps,
      }));

    return sorted;
  }, [filteredTemplates]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const [templatesRes, teamRes] = await Promise.all([
        projectTemplatesAPI.getAll(),
        teamAPI.getAll({ status: 'active' }),
      ]);
      setTemplates(templatesRes.data);
      setTeamMembers(teamRes.data);
      try {
        const catsRes = await projectTemplatesAPI.getCategories();
        setStandaloneCategories(catsRes.data || []);
      } catch { /* table may not exist yet */ }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: activeCategory !== 'all' && activeCategory !== 'uncategorized' ? activeCategory : '',
      subcategory: '',
    });
    setTasks([]);
    setNewTaskTitle('');
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowNewSubcategory(false);
    setNewSubcategoryName('');
    setShowModal(true);
  };

  const handleEdit = async (template) => {
    try {
      const response = await projectTemplatesAPI.getById(template.id);
      setEditingTemplate(response.data);
      setFormData({
        name: response.data.name,
        description: response.data.description || '',
        category: response.data.category || '',
        subcategory: response.data.subcategory || '',
      });
      setTasks(response.data.tasks || []);
      setNewTaskTitle('');
      setShowNewCategory(false);
      setNewCategoryName('');
      setShowNewSubcategory(false);
      setNewSubcategoryName('');
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

    const categoryToSave = showNewCategory ? newCategoryName.trim() : formData.category;
    const subcategoryToSave = showNewSubcategory ? newSubcategoryName.trim() : formData.subcategory;

    setSaving(true);
    try {
      const payload = { ...formData, category: categoryToSave || null, subcategory: subcategoryToSave || null };
      if (editingTemplate) {
        await projectTemplatesAPI.update(editingTemplate.id, payload);
      } else {
        await projectTemplatesAPI.create({
          ...payload,
          tasks: tasks.map((t, index) => ({
            title: t.title,
            description: t.description || '',
            default_assignee_id: t.default_assignee_id || null,
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

  // Task management
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
      setTasks([
        ...tasks,
        {
          id: Date.now(),
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

  const handleAddCategory = async () => {
    const name = newCatInput.trim();
    if (!name) return;
    if (categories.includes(name)) {
      setAddingCategory(false);
      setNewCatInput('');
      return;
    }
    try {
      await projectTemplatesAPI.createCategory(name);
      setStandaloneCategories(prev => [...new Set([...prev, name])]);
      setNewCatInput('');
      setAddingCategory(false);
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const handleDeleteCategory = async (catName) => {
    const templatesInCat = templates.filter(t => t.category === catName);
    const msg1 = templatesInCat.length > 0
      ? `¿Eliminar la categoría "${catName}"? ${templatesInCat.length} plantilla(s) quedarán sin categoría.`
      : `¿Eliminar la categoría "${catName}"?`;
    if (!confirm(msg1)) return;
    if (!confirm(`¿Estás seguro? Esta acción no se puede deshacer.`)) return;
    const typed = prompt(`Para confirmar, escribe el nombre de la categoría: "${catName}"`);
    if (typed === null || typed.trim() !== catName) {
      alert('El nombre no coincide. No se eliminó la categoría.');
      return;
    }
    try {
      await projectTemplatesAPI.deleteCategory(catName);
      if (activeCategory === catName) setActiveCategory('all');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  // Render a template card
  const renderTemplateCard = (template) => (
    <div
      key={template.id}
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <FileText size={20} className="text-[#1A1A2E]" />
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
      <div className="flex flex-wrap gap-1.5 mb-2">
        {template.category && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1A1A2E]/5 text-[#1A1A2E]">
            <Tag size={11} />
            {template.category}
          </span>
        )}
        {template.subcategory && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#10B981]/10 text-[#10B981]">
            <Layers size={11} />
            {template.subcategory}
          </span>
        )}
      </div>
      {template.description && (
        <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Plantillas de Proyecto</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crea plantillas con tareas predefinidas para nuevos proyectos</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-[#1A1A2E] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#252542] transition-colors"
        >
          <Plus size={20} />
          Nueva Plantilla
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap items-center">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeCategory === 'all'
              ? 'bg-white text-[#1A1A2E] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Todas
          <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
            activeCategory === 'all' ? 'bg-gray-200 text-gray-700' : 'bg-gray-200 text-gray-500'
          }`}>
            {templates.length}
          </span>
        </button>
        {categories.map((cat) => (
          <div key={cat} className="group relative flex items-center">
            <button
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === cat
                  ? 'bg-white text-[#1A1A2E] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
                activeCategory === cat ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-200 text-gray-500'
              }`}>
                {templates.filter(t => t.category === cat).length}
              </span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title={`Eliminar categoría "${cat}"`}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {templates.some(t => !t.category) && (
          <button
            onClick={() => setActiveCategory('uncategorized')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeCategory === 'uncategorized'
                ? 'bg-white text-[#1A1A2E] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sin categoría
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
              activeCategory === 'uncategorized' ? 'bg-gray-200 text-gray-700' : 'bg-gray-200 text-gray-500'
            }`}>
              {templates.filter(t => !t.category).length}
            </span>
          </button>
        )}
        {/* Add category inline */}
        {addingCategory ? (
          <div className="flex items-center gap-1 ml-1">
            <input
              type="text"
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
              placeholder="Nueva categoría..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
                if (e.key === 'Escape') { setAddingCategory(false); setNewCatInput(''); }
              }}
              autoFocus
            />
            <button
              onClick={handleAddCategory}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => { setAddingCategory(false); setNewCatInput(''); }}
              className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCategory(true)}
            className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-white rounded-lg transition-colors ml-1"
            title="Agregar categoría"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Templates Grid — grouped by subcategory */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {templates.length === 0 ? 'No hay plantillas' : 'No hay plantillas en esta categoría'}
          </h3>
          <p className="text-gray-500 mb-4">
            {templates.length === 0
              ? 'Crea tu primera plantilla para agilizar la creación de proyectos'
              : 'Crea una plantilla o cambia de categoría'}
          </p>
          <button
            onClick={handleNew}
            className="bg-[#1A1A2E] text-white px-4 py-2 rounded-lg hover:bg-[#252542]"
          >
            Crear Plantilla
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTemplates.map((group) => (
            <div key={group.subcategory || '__none__'}>
              {/* Subcategory header — only show if there are subcategories in the view */}
              {groupedTemplates.length > 1 || group.subcategory ? (
                <div className="flex items-center gap-3 mb-3">
                  {group.subcategory ? (
                    <>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#10B981]/10 rounded-lg">
                        <Layers size={14} className="text-[#10B981]" />
                        <span className="text-sm font-semibold text-[#10B981]">{group.subcategory}</span>
                      </div>
                      <div className="flex-1 h-px bg-[#10B981]/20" />
                      <span className="text-xs text-gray-400">{group.templates.length} plantilla{group.templates.length !== 1 ? 's' : ''}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-gray-400">Sin etapa</span>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{group.templates.length}</span>
                    </>
                  )}
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.templates.map(renderTemplateCard)}
              </div>
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

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-1">Categoría</label>
                  {!showNewCategory ? (
                    <div className="flex gap-2">
                      <select
                        className="flex-1 border rounded-lg px-3 py-2"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                      >
                        <option value="">Sin categoría</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewCategory(true)}
                        className="px-3 py-2 border rounded-lg text-sm text-[#1A1A2E] hover:bg-gray-50 whitespace-nowrap"
                      >
                        + Nueva
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 border rounded-lg px-3 py-2"
                        placeholder="Ej: Email Marketing, Tráfico, CRO..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                        className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* Subcategory / Etapa */}
                {(formData.category || showNewCategory) && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Etapa <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    {!showNewSubcategory ? (
                      <div className="flex gap-2">
                        <select
                          className="flex-1 border rounded-lg px-3 py-2"
                          value={formData.subcategory}
                          onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        >
                          <option value="">Sin etapa</option>
                          {subcategoriesForFormCategory.map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowNewSubcategory(true)}
                          className="px-3 py-2 border rounded-lg text-sm text-[#10B981] hover:bg-green-50 whitespace-nowrap"
                        >
                          + Nueva etapa
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 border rounded-lg px-3 py-2"
                          placeholder="Ej: Etapa 1 - Puesta a punto, Etapa 2 - Gestión mensual..."
                          value={newSubcategoryName}
                          onChange={(e) => setNewSubcategoryName(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => { setShowNewSubcategory(false); setNewSubcategoryName(''); }}
                          className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}

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
                      className="bg-[#1A1A2E] text-white px-4 py-2 rounded-lg hover:bg-[#252542]"
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
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
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

                          {/* Task Description + Assignee */}
                          <div className="mt-2 ml-14 flex gap-2 items-start">
                            <textarea
                              className="flex-1 bg-white border rounded px-2 py-1.5 text-sm text-gray-600"
                              rows={4}
                              value={task.description || ''}
                              onChange={(e) => handleUpdateTask(index, 'description', e.target.value)}
                              placeholder="Descripción (opcional)"
                            />
                            <select
                              className="bg-white border rounded px-2 py-1.5 text-sm text-gray-600 min-w-[140px]"
                              value={task.default_assignee_id || ''}
                              onChange={(e) => handleUpdateTask(index, 'default_assignee_id', e.target.value ? Number(e.target.value) : null)}
                            >
                              <option value="">Sin asignar</option>
                              {teamMembers.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
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
                className="px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#252542] disabled:bg-gray-400"
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
