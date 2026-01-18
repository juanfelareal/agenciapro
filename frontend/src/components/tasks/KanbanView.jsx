import { useState } from 'react';
import { Plus, Trash2, ListChecks } from 'lucide-react';

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

export default function KanbanView({
  tasks,
  taskTags = {},
  taskSubtaskProgress = {},
  onTaskClick,
  onAddTask,
  onStatusChange,
  onDeleteTask,
}) {
  const [draggedTask, setDraggedTask] = useState(null);

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
      await onStatusChange(draggedTask, newStatus);
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDeleteClick = (e, taskId) => {
    e.stopPropagation();
    if (confirm('¿Está seguro de eliminar esta tarea?')) {
      onDeleteTask(taskId);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{column.title}</h3>
              <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full">
                {tasks.filter((task) => task.status === column.id).length}
              </span>
            </div>
            <button
              onClick={() => onAddTask(column.id)}
              className="text-gray-600 hover:text-gray-800 hover:bg-white/50 p-1 rounded"
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
                  onClick={() => onTaskClick(task)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold flex-1 pr-2">{task.title}</h4>
                    <div className="flex items-center gap-1">
                      {!!task.is_recurring && (
                        <span className="text-blue-600" title="Tarea Recurrente">🔄</span>
                      )}
                      <button
                        onClick={(e) => handleDeleteClick(e, task.id)}
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
  );
}
