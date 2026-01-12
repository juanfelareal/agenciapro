import { useState, useEffect, useRef } from 'react';
import { tagsAPI } from '../utils/api';
import { Tag, Plus, X, Check } from 'lucide-react';

const TagSelector = ({ taskId, selectedTagIds = [], onChange, compact = false }) => {
  const [allTags, setAllTags] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366F1');
  const [showNewTag, setShowNewTag] = useState(false);
  const dropdownRef = useRef(null);

  const colorOptions = [
    '#6366F1', // Indigo
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#22C55E', // Green
    '#14B8A6', // Teal
    '#0EA5E9', // Sky
    '#64748B', // Slate
  ];

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowNewTag(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTags = async () => {
    try {
      const response = await tagsAPI.getAll();
      setAllTags(response.data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleToggleTag = (tagId) => {
    const newSelected = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId];
    onChange(newSelected);
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      const response = await tagsAPI.create({
        name: newTagName.trim(),
        color: newTagColor
      });
      setAllTags([...allTags, response.data]);
      onChange([...selectedTagIds, response.data.id]);
      setNewTagName('');
      setShowNewTag(false);
    } catch (error) {
      console.error('Error creating tag:', error);
      if (error.response?.data?.error === 'Tag name already exists') {
        alert('Ya existe una etiqueta con ese nombre');
      }
    }
  };

  const selectedTags = allTags.filter(tag => selectedTagIds.includes(tag.id));

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <Tag size={14} />
          {selectedTags.length > 0 && (
            <span className="text-xs">{selectedTags.length}</span>
          )}
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
            <div className="max-h-48 overflow-y-auto">
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-left"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-slate-700 flex-1">{tag.name}</span>
                  {selectedTagIds.includes(tag.id) && (
                    <Check size={14} className="text-primary-500" />
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowNewTag(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-left border-t border-slate-100"
            >
              <Plus size={14} className="text-slate-400" />
              <span className="text-sm text-slate-500">Nueva etiqueta</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {/* Selected tags display */}
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color
            }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleToggleTag(tag.id)}
              className="hover:opacity-70"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          <Plus size={12} />
          Etiqueta
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 py-1">
          {!showNewTag ? (
            <>
              <div className="max-h-48 overflow-y-auto">
                {allTags.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">No hay etiquetas</p>
                ) : (
                  allTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-slate-700 flex-1">{tag.name}</span>
                      {selectedTagIds.includes(tag.id) && (
                        <Check size={14} className="text-primary-500" />
                      )}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowNewTag(true)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left border-t border-slate-100"
              >
                <Plus size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500">Crear nueva etiqueta</span>
              </button>
            </>
          ) : (
            <form onSubmit={handleCreateTag} className="p-3 space-y-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nombre de la etiqueta"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      newTagColor === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {newTagColor === color && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTag(false);
                    setNewTagName('');
                  }}
                  className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Crear
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

// Simple badge component for displaying tags
export const TagBadge = ({ tag, onRemove }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
    style={{
      backgroundColor: `${tag.color}20`,
      color: tag.color
    }}
  >
    {tag.name}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="hover:opacity-70"
      >
        <X size={12} />
      </button>
    )}
  </span>
);

export default TagSelector;
