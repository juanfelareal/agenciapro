import { useState, useEffect } from 'react';
import { subtasksAPI } from '../utils/api';
import { Plus, Trash2, GripVertical, CheckCircle, Circle } from 'lucide-react';

const SubtaskList = ({ taskId, onProgressChange }) => {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSubtask, setNewSubtask] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    if (taskId) {
      loadSubtasks();
    }
  }, [taskId]);

  const loadSubtasks = async () => {
    try {
      const response = await subtasksAPI.getByTask(taskId);
      setSubtasks(response.data || []);
      updateProgress(response.data || []);
    } catch (error) {
      console.error('Error loading subtasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = (items) => {
    if (onProgressChange) {
      const total = items.length;
      const completed = items.filter(s => s.is_completed).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      onProgressChange({ total, completed, progress });
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;

    try {
      const response = await subtasksAPI.create({
        task_id: taskId,
        title: newSubtask.trim()
      });
      const updated = [...subtasks, response.data];
      setSubtasks(updated);
      setNewSubtask('');
      updateProgress(updated);
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  };

  const handleToggle = async (subtask) => {
    try {
      const response = await subtasksAPI.toggle(subtask.id);
      const updated = subtasks.map(s =>
        s.id === subtask.id ? response.data : s
      );
      setSubtasks(updated);
      updateProgress(updated);
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await subtasksAPI.delete(id);
      const updated = subtasks.filter(s => s.id !== id);
      setSubtasks(updated);
      updateProgress(updated);
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const items = [...subtasks];
    const draggedItemContent = items[draggedItem];
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedItemContent);

    setDraggedItem(index);
    setSubtasks(items);
  };

  const handleDragEnd = async () => {
    if (draggedItem !== null) {
      try {
        const subtaskIds = subtasks.map(s => s.id);
        await subtasksAPI.reorder(taskId, subtaskIds);
      } catch (error) {
        console.error('Error reordering subtasks:', error);
        loadSubtasks(); // Reload on error
      }
    }
    setDraggedItem(null);
  };

  const completedCount = subtasks.filter(s => s.is_completed).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return <div className="text-sm text-slate-500">Cargando subtareas...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-slate-600 whitespace-nowrap">
            {completedCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Subtasks list */}
      <div className="space-y-1">
        {subtasks.map((subtask, index) => (
          <div
            key={subtask.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-2 rounded-lg group hover:bg-slate-50 transition-colors ${
              draggedItem === index ? 'opacity-50 bg-slate-100' : ''
            }`}
          >
            <GripVertical
              size={14}
              className="text-slate-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <button
              onClick={() => handleToggle(subtask)}
              className="flex-shrink-0"
            >
              {subtask.is_completed ? (
                <CheckCircle size={18} className="text-green-500" />
              ) : (
                <Circle size={18} className="text-slate-300 hover:text-slate-400" />
              )}
            </button>
            <span
              className={`flex-1 text-sm ${
                subtask.is_completed ? 'text-slate-400 line-through' : 'text-slate-700'
              }`}
            >
              {subtask.title}
            </span>
            <button
              onClick={() => handleDelete(subtask.id)}
              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new subtask */}
      <div className="flex items-center gap-2">
        <Circle size={18} className="text-slate-200 flex-shrink-0" />
        <input
          type="text"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleAdd(e);
            }
          }}
          placeholder="Agregar subtarea..."
          className="flex-1 text-sm px-2 py-1.5 border-0 border-b border-transparent focus:border-primary-300 focus:outline-none bg-transparent placeholder:text-slate-400"
        />
        {newSubtask.trim() && (
          <button
            type="button"
            onClick={handleAdd}
            className="text-primary-500 hover:text-primary-600"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SubtaskList;
