import { useState } from 'react';
import { Plus, Trash2, ListChecks } from 'lucide-react';

const columns = [
  { id: 'todo', title: 'Por Hacer', color: 'bg-gray-50', borderColor: 'border-gray-200' },
  { id: 'in_progress', title: 'En Progreso', color: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'review', title: 'En Revisión', color: 'bg-amber-50', borderColor: 'border-amber-200' },
  { id: 'done', title: 'Completado', color: 'bg-[#10B981]/5', borderColor: 'border-[#10B981]/30' },
];

const priorityColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-[#1A1A2E]/10 text-[#1A1A2E]',
  high: 'bg-[#F97316]/10 text-[#F97316]',
  urgent: 'bg-red-100 text-red-600',
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
          className={`${column.color} rounded-2xl p-4 min-h-[500px] transition-all border ${column.borderColor} ${
            draggedTask && draggedTask.status !== column.id ? 'ring-2 ring-[#BFFF00] ring-opacity-50' : ''
          }`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#1A1A2E]">{column.title}</h3>
              <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                {tasks.filter((task) => task.status === column.id).length}
              </span>
            </div>
            <button
              onClick={() => onAddTask(column.id)}
              className="text-gray-500 hover:text-[#1A1A2E] hover:bg-white p-1.5 rounded-lg transition-colors"
            >
              <Plus size={18} />
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
                  className={`bg-white p-3 rounded-xl border border-gray-100 cursor-move hover:shadow-md transition-all group ${
                    draggedTask?.id === task.id ? 'opacity-50 scale-95' : 'opacity-100'
                  }`}
                  onClick={() => onTaskClick(task)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-[#1A1A2E] flex-1 pr-2">{task.title}</h4>
                    <div className="flex items-center gap-1">
                      {!!task.is_recurring && (
                        <span className="text-[#BFFF00]" title="Tarea Recurrente">🔄</span>
                      )}
                      <button
                        onClick={(e) => handleDeleteClick(e, task.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
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
                          className="px-1.5 py-0.5 rounded-md text-xs font-medium"
                          style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {taskTags[task.id].length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md text-xs bg-gray-100 text-gray-500">
                          +{taskTags[task.id].length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {task.project_name && (
                    <p className="text-xs text-gray-500 mb-2">{task.project_name}</p>
                  )}

                  {/* Task details */}
                  <div className="space-y-1 mb-2 text-xs">
                    {task.created_by_name && (
                      <p className="text-gray-500">
                        <span className="text-gray-400">Asignado por:</span> {task.created_by_name}
                      </p>
                    )}
                    {task.assigned_to_name && (
                      <p className="text-gray-500">
                        <span className="text-gray-400">Asignado a:</span> {task.assigned_to_name}
                      </p>
                    )}
                    {task.due_date && (
                      <p className="text-gray-500">
                        <span className="text-gray-400">Fecha de entrega:</span> {new Date(task.due_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    {/* Subtask progress indicator */}
                    {taskSubtaskProgress[task.id]?.total > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <ListChecks size={12} />
                        {taskSubtaskProgress[task.id].completed}/{taskSubtaskProgress[task.id].total}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
