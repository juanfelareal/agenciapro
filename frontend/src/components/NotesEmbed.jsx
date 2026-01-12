import { useState, useEffect } from 'react';
import { notesAPI, noteCategoriesAPI } from '../utils/api';
import NoteEditor from './NoteEditor';
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  X,
  Edit3,
  StickyNote,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const NOTE_COLORS = [
  { name: 'Blanco', value: '#FFFFFF' },
  { name: 'Coral', value: '#FAAFA8' },
  { name: 'Melocotón', value: '#F39F76' },
  { name: 'Arena', value: '#FFF8B8' },
  { name: 'Menta', value: '#E2F6D3' },
  { name: 'Salvia', value: '#B4DDD3' },
  { name: 'Niebla', value: '#D4E4ED' },
  { name: 'Tormenta', value: '#AECCDC' },
  { name: 'Atardecer', value: '#D3BFDB' },
  { name: 'Flor', value: '#F6E2DD' },
];

const NotesEmbed = ({ entityType, entityId, entityName }) => {
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: null,
    content_plain: '',
    color: '#FFFFFF',
    category_id: null,
    is_pinned: false
  });

  useEffect(() => {
    if (entityId) {
      loadNotes();
      loadCategories();
    }
  }, [entityId, entityType]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      let response;
      switch (entityType) {
        case 'client':
          response = await notesAPI.getByClient(entityId);
          break;
        case 'project':
          response = await notesAPI.getByProject(entityId);
          break;
        case 'team':
          response = await notesAPI.getByTeamMember(entityId);
          break;
        default:
          response = { data: [] };
      }
      setNotes(response.data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await noteCategoriesAPI.getAll();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleOpenModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title,
        content: note.content ? JSON.parse(note.content) : null,
        content_plain: note.content_plain || '',
        color: note.color || '#FFFFFF',
        category_id: note.category_id,
        is_pinned: note.is_pinned
      });
    } else {
      setEditingNote(null);
      setFormData({
        title: '',
        content: null,
        content_plain: '',
        color: '#FFFFFF',
        category_id: null,
        is_pinned: false
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingNote(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;

    try {
      const linkData = {
        client_id: entityType === 'client' ? entityId : null,
        project_id: entityType === 'project' ? entityId : null,
        team_member_id: entityType === 'team' ? entityId : null
      };

      if (editingNote) {
        await notesAPI.update(editingNote.id, {
          ...formData,
          links: [linkData]
        });
      } else {
        await notesAPI.create({
          ...formData,
          links: [linkData]
        });
      }
      handleCloseModal();
      loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await notesAPI.delete(id);
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleTogglePin = async (note) => {
    try {
      await notesAPI.togglePin(note.id);
      loadNotes();
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <StickyNote size={18} className="text-amber-500" />
          <h3 className="font-semibold text-slate-800">Notas</h3>
          <span className="text-sm text-slate-500">({notes.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal();
            }}
            className="p-1.5 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus size={18} />
          </button>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="p-4 text-center text-slate-500">Cargando...</div>
          ) : notes.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-slate-500 mb-3">No hay notas para {entityName}</p>
              <button
                onClick={() => handleOpenModal()}
                className="text-sm text-primary-500 hover:text-primary-600"
              >
                + Crear primera nota
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notes.map(note => (
                <div
                  key={note.id}
                  className="p-4 hover:bg-slate-50 transition-colors group"
                  style={{ borderLeftWidth: 3, borderLeftColor: note.color || '#e2e8f0' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {note.is_pinned === 1 && (
                          <Pin size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                        <h4 className="font-medium text-slate-800 truncate">{note.title}</h4>
                        {note.category_name && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${note.category_color}20`,
                              color: note.category_color
                            }}
                          >
                            {note.category_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {note.content_plain || 'Sin contenido'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(note)}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <Edit3 size={14} className="text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleTogglePin(note)}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        {note.is_pinned ? (
                          <PinOff size={14} className="text-amber-500" />
                        ) : (
                          <Pin size={14} className="text-slate-500" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <Trash2 size={14} className="text-slate-500 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: formData.color }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/50">
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título de la nota"
                className="text-lg font-semibold bg-transparent border-none outline-none flex-1 placeholder:text-slate-400"
              />
              <button onClick={handleCloseModal} className="p-2 hover:bg-black/5 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Rich Text Editor */}
              <NoteEditor
                content={formData.content}
                onChange={({ json, text }) => setFormData(prev => ({
                  ...prev,
                  content: json,
                  content_plain: text
                }))}
                placeholder="Escribe tu nota aquí..."
                minHeight="200px"
              />

              {/* Options */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Color picker */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Color:</span>
                  <div className="flex gap-1">
                    {NOTE_COLORS.slice(0, 6).map(color => (
                      <button
                        key={color.value}
                        onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                        className={`w-5 h-5 rounded-full border-2 ${
                          formData.color === color.value ? 'border-primary-500' : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Category */}
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    category_id: e.target.value || null
                  }))}
                  className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white/80"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* Pin */}
                <button
                  onClick={() => setFormData(prev => ({ ...prev, is_pinned: !prev.is_pinned }))}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm ${
                    formData.is_pinned
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Pin size={14} />
                  {formData.is_pinned ? 'Fijada' : 'Fijar'}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200/50">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.title.trim()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {editingNote ? 'Guardar' : 'Crear Nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesEmbed;
