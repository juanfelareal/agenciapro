import { useState, useEffect } from 'react';
import { sopsAPI } from '../utils/api';
import NoteEditor from '../components/NoteEditor';
import StepBuilder, { VideoPreview, getVideoEmbed } from '../components/StepBuilder';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Edit3,
  X,
  FolderOpen,
  FileText,
  Eye,
  Clock,
  User,
  ChevronRight,
  BookOpen,
  Archive,
  CheckCircle,
  Circle,
  ListOrdered,
  FileEdit
} from 'lucide-react';

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: Circle },
  published: { label: 'Publicado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  archived: { label: 'Archivado', color: 'bg-amber-100 text-amber-700', icon: Archive },
};

const CATEGORY_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6'
];

const SOPs = () => {
  const [sops, setSOPs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('published');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingSOP, setEditingSOP] = useState(null);
  const [viewingSOP, setViewingSOP] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: null,
    steps: [],
    editor_mode: 'freeform', // 'freeform' or 'steps'
    category_id: null,
    status: 'draft',
    is_pinned: false
  });

  // Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#6366F1' });
  const [editingCategory, setEditingCategory] = useState(null);

  // Inline category creation in dropdown
  const [showInlineCategoryForm, setShowInlineCategoryForm] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const [inlineCategoryColor, setInlineCategoryColor] = useState('#6366F1');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadSOPs();
  }, [searchQuery, selectedCategory, selectedStatus]);

  const loadCategories = async () => {
    try {
      const response = await sopsAPI.getCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSOPs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedCategory) params.category_id = selectedCategory;
      if (selectedStatus && selectedStatus !== 'all') params.status = selectedStatus;

      const response = await sopsAPI.getAll(params);
      setSOPs(response.data || []);
    } catch (error) {
      console.error('Error loading SOPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (sop = null) => {
    if (sop) {
      setEditingSOP(sop);
      setFormData({
        title: sop.title,
        description: sop.description || '',
        content: sop.content ? JSON.parse(sop.content) : null,
        steps: sop.steps ? JSON.parse(sop.steps) : [],
        editor_mode: sop.editor_mode || 'freeform',
        category_id: sop.category_id,
        status: sop.status,
        is_pinned: sop.is_pinned
      });
    } else {
      setEditingSOP(null);
      setFormData({
        title: '',
        description: '',
        content: null,
        steps: [],
        editor_mode: 'freeform',
        category_id: null,
        status: 'draft',
        is_pinned: false
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSOP(null);
  };

  const handleViewSOP = async (sop) => {
    try {
      const response = await sopsAPI.getById(sop.id);
      setViewingSOP(response.data);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error loading SOP:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;

    try {
      const data = {
        ...formData,
        content: formData.content ? JSON.stringify(formData.content) : null,
        steps: formData.steps && formData.steps.length > 0 ? JSON.stringify(formData.steps) : null,
        editor_mode: formData.editor_mode
      };

      if (editingSOP) {
        await sopsAPI.update(editingSOP.id, data);
      } else {
        await sopsAPI.create(data);
      }
      handleCloseModal();
      loadSOPs();
    } catch (error) {
      console.error('Error saving SOP:', error);
      alert(error.response?.data?.error || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este SOP? Esta acción no se puede deshacer.')) return;
    try {
      await sopsAPI.delete(id);
      loadSOPs();
    } catch (error) {
      console.error('Error deleting SOP:', error);
    }
  };

  const handleTogglePin = async (sop) => {
    try {
      await sopsAPI.togglePin(sop.id);
      loadSOPs();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Category management
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;
    try {
      if (editingCategory) {
        await sopsAPI.updateCategory(editingCategory.id, categoryForm);
      } else {
        await sopsAPI.createCategory(categoryForm);
      }
      setShowCategoryModal(false);
      setCategoryForm({ name: '', description: '', color: '#6366F1' });
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert(error.response?.data?.error || 'Error al guardar');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await sopsAPI.deleteCategory(id);
      if (selectedCategory === id) setSelectedCategory(null);
      loadCategories();
    } catch (error) {
      console.error('Error:', error);
      alert(error.response?.data?.error || 'Error al eliminar');
    }
  };

  // Handle inline category creation from dropdown
  const handleInlineCategoryCreate = async () => {
    if (!inlineCategoryName.trim()) return;
    try {
      const response = await sopsAPI.createCategory({
        name: inlineCategoryName.trim(),
        color: inlineCategoryColor
      });
      // Select the newly created category
      setFormData(prev => ({ ...prev, category_id: response.data.id }));
      // Reset and close inline form
      setInlineCategoryName('');
      setInlineCategoryColor('#6366F1');
      setShowInlineCategoryForm(false);
      // Reload categories
      loadCategories();
    } catch (error) {
      console.error('Error creating category:', error);
      alert(error.response?.data?.error || 'Error al crear categoría');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Parse content to plain text for preview
  const getContentPreview = (content) => {
    if (!content) return 'Sin contenido';
    try {
      const parsed = JSON.parse(content);
      const extractText = (node) => {
        if (node.text) return node.text;
        if (node.content) return node.content.map(extractText).join(' ');
        return '';
      };
      return extractText(parsed).slice(0, 150) + '...';
    } catch {
      return 'Sin contenido';
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen size={20} />
            SOPs
          </h2>
          <p className="text-xs text-slate-500 mt-1">Procedimientos Operativos</p>
        </div>

        {/* Status filters */}
        <div className="p-3 space-y-1">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedStatus === 'all' ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setSelectedStatus('published')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
              selectedStatus === 'published' ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <CheckCircle size={16} />
            Publicados
          </button>
          <button
            onClick={() => setSelectedStatus('draft')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
              selectedStatus === 'draft' ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <Circle size={16} />
            Borradores
          </button>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Categorías</span>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="p-1 hover:bg-slate-100 rounded text-slate-500"
              title="Gestionar categorías"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="px-3 space-y-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedCategory ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              Todas las categorías
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  selectedCategory === cat.id ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate">{cat.name}</span>
                </div>
                <span className="text-xs text-slate-400">{cat.sop_count || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar SOPs..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E] transition-colors ml-4"
            >
              <Plus size={20} />
              Nuevo SOP
            </button>
          </div>
        </div>

        {/* SOPs list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Cargando SOPs...</div>
          ) : sops.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">No hay SOPs aún</p>
              <button
                onClick={() => handleOpenModal()}
                className="text-[#1A1A2E] hover:text-[#1A1A2E]"
              >
                Crear tu primer SOP
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sops.map(sop => {
                const StatusIcon = STATUS_CONFIG[sop.status]?.icon || Circle;
                return (
                  <div
                    key={sop.id}
                    className="bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {sop.is_pinned === 1 && (
                              <Pin size={14} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                            )}
                            <h3
                              className="font-semibold text-slate-800 cursor-pointer hover:text-[#1A1A2E] truncate"
                              onClick={() => handleViewSOP(sop)}
                            >
                              {sop.title}
                            </h3>
                          </div>
                          {sop.description && (
                            <p className="text-sm text-slate-500 line-clamp-1 mb-2">
                              {sop.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${STATUS_CONFIG[sop.status]?.color}`}>
                              <StatusIcon size={12} />
                              {STATUS_CONFIG[sop.status]?.label}
                            </span>
                            {sop.category_name && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${sop.category_color}20`,
                                  color: sop.category_color
                                }}
                              >
                                <FolderOpen size={12} />
                                {sop.category_name}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Eye size={12} />
                              {sop.view_count || 0} vistas
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {formatDate(sop.updated_at)}
                            </span>
                            {sop.author_name && (
                              <span className="inline-flex items-center gap-1">
                                <User size={12} />
                                {sop.author_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={() => handleViewSOP(sop)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1A1A2E]"
                            title="Ver"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenModal(sop)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#1A1A2E]"
                            title="Editar"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={() => handleTogglePin(sop)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                            title={sop.is_pinned ? 'Desfijar' : 'Fijar'}
                          >
                            {sop.is_pinned ? <PinOff size={18} /> : <Pin size={18} />}
                          </button>
                          <button
                            onClick={() => handleDelete(sop.id)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-xl font-semibold">
                {editingSOP ? 'Editar SOP' : 'Nuevo SOP'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Cómo crear una campaña en Facebook Ads"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción breve
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Un resumen corto del procedimiento"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {/* Options Row */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Category with inline create */}
                <div className="flex items-center gap-2 relative">
                  <FolderOpen size={16} className="text-slate-500" />
                  {showInlineCategoryForm ? (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1.5 border border-slate-200">
                      <input
                        type="color"
                        value={inlineCategoryColor}
                        onChange={(e) => setInlineCategoryColor(e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={inlineCategoryName}
                        onChange={(e) => setInlineCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineCategoryCreate();
                          if (e.key === 'Escape') {
                            setShowInlineCategoryForm(false);
                            setInlineCategoryName('');
                          }
                        }}
                        placeholder="Nueva categoría..."
                        className="w-32 px-2 py-1 text-sm border-0 bg-transparent focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleInlineCategoryCreate}
                        disabled={!inlineCategoryName.trim()}
                        className="px-2 py-1 text-xs bg-[#1A1A2E] text-white rounded hover:bg-[#1A1A2E] disabled:opacity-50"
                      >
                        Crear
                      </button>
                      <button
                        onClick={() => {
                          setShowInlineCategoryForm(false);
                          setInlineCategoryName('');
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.category_id || ''}
                      onChange={(e) => {
                        if (e.target.value === 'new') {
                          setShowInlineCategoryForm(true);
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            category_id: e.target.value ? parseInt(e.target.value) : null
                          }));
                        }
                      }}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                      <option value="new">+ Nueva categoría...</option>
                    </select>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <Circle size={16} className="text-slate-500" />
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                    <option value="archived">Archivado</option>
                  </select>
                </div>

                {/* Pin toggle */}
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, is_pinned: !prev.is_pinned }))}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    formData.is_pinned
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Pin size={14} />
                  {formData.is_pinned ? 'Fijado' : 'Fijar'}
                </button>
              </div>

              {/* Editor Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de contenido
                </label>
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, editor_mode: 'freeform' }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      formData.editor_mode === 'freeform'
                        ? 'bg-white shadow-sm text-[#1A1A2E]'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <FileEdit size={16} />
                    Editor Libre
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, editor_mode: 'steps' }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      formData.editor_mode === 'steps'
                        ? 'bg-white shadow-sm text-[#1A1A2E]'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <ListOrdered size={16} />
                    Paso a Paso
                  </button>
                </div>
              </div>

              {/* Content Editor (conditional based on mode) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formData.editor_mode === 'steps' ? 'Pasos del procedimiento' : 'Contenido'}
                </label>
                {formData.editor_mode === 'steps' ? (
                  <StepBuilder
                    steps={formData.steps || []}
                    onChange={(steps) => setFormData(prev => ({ ...prev, steps }))}
                  />
                ) : (
                  <NoteEditor
                    content={formData.content}
                    onChange={({ json }) => setFormData(prev => ({ ...prev, content: json }))}
                    placeholder="Escribe los pasos del procedimiento aquí..."
                    minHeight="300px"
                  />
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.title.trim()}
                className="px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingSOP ? 'Guardar' : 'Crear SOP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingSOP && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  {viewingSOP.is_pinned === 1 && (
                    <Pin size={16} className="text-amber-500 fill-amber-500" />
                  )}
                  <h2 className="text-xl font-semibold">{viewingSOP.title}</h2>
                </div>
                {viewingSOP.description && (
                  <p className="text-sm text-slate-500 mt-1">{viewingSOP.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleOpenModal(viewingSOP);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                  title="Editar"
                >
                  <Edit3 size={20} />
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Meta info */}
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${STATUS_CONFIG[viewingSOP.status]?.color}`}>
                {STATUS_CONFIG[viewingSOP.status]?.label}
              </span>
              {viewingSOP.category_name && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${viewingSOP.category_color}20`,
                    color: viewingSOP.category_color
                  }}
                >
                  <FolderOpen size={12} />
                  {viewingSOP.category_name}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Eye size={12} />
                {viewingSOP.view_count} vistas
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                Actualizado: {formatDate(viewingSOP.updated_at)}
              </span>
              {viewingSOP.author_name && (
                <span className="inline-flex items-center gap-1">
                  <User size={12} />
                  {viewingSOP.author_name}
                </span>
              )}
              <span className="text-slate-400">v{viewingSOP.version}</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {viewingSOP.editor_mode === 'steps' && viewingSOP.steps ? (
                // Step-by-step view
                <div className="space-y-6">
                  {JSON.parse(viewingSOP.steps).map((step, index) => (
                    <div key={step.id || index} className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1A1A2E] text-white flex items-center justify-center font-bold text-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-slate-800 mb-3">
                            {step.title || `Paso ${index + 1}`}
                          </h3>
                          {step.content && (
                            <div className="mb-4">
                              <NoteEditor
                                content={step.content}
                                readOnly={true}
                                minHeight="auto"
                              />
                            </div>
                          )}
                          {step.video_url && (
                            <div className="mt-4">
                              <VideoPreview url={step.video_url} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewingSOP.content ? (
                // Freeform content view
                <NoteEditor
                  content={JSON.parse(viewingSOP.content)}
                  readOnly={true}
                  minHeight="auto"
                />
              ) : (
                <p className="text-slate-500 text-center py-8">Sin contenido</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">Gestionar Categorías</h2>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setCategoryForm({ name: '', description: '', color: '#6366F1' });
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Category form */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                  </div>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre de categoría"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción (opcional)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
                <button
                  onClick={handleSaveCategory}
                  disabled={!categoryForm.name.trim()}
                  className="w-full px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E] disabled:opacity-50"
                >
                  {editingCategory ? 'Actualizar' : 'Agregar Categoría'}
                </button>
              </div>

              {/* Preset colors */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Colores:</span>
                <div className="flex gap-1">
                  {CATEGORY_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        categoryForm.color === color ? 'border-slate-600' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Categories list */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <span className="font-medium">{cat.name}</span>
                        {cat.description && (
                          <p className="text-xs text-slate-500">{cat.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 ml-2">
                        ({cat.sop_count || 0})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCategoryForm({
                            name: cat.name,
                            description: cat.description || '',
                            color: cat.color
                          });
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 hover:bg-slate-200 rounded text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-center text-slate-500 py-4">
                    No hay categorías creadas
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SOPs;
