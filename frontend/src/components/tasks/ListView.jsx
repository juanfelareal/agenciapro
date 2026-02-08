import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, MoreVertical, Trash2, Edit, ListChecks } from 'lucide-react';

const statusLabels = {
  todo: 'Por Hacer',
  in_progress: 'En Progreso',
  review: 'En Revisión',
  done: 'Completado',
};

const statusColors = {
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  done: 'bg-[#10B981]/10 text-[#10B981]',
};

const priorityLabels = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-[#1A1A2E]/10 text-[#1A1A2E]',
  high: 'bg-[#F97316]/10 text-[#F97316]',
  urgent: 'bg-red-100 text-red-600',
};

export default function ListView({
  tasks,
  taskTags = {},
  taskSubtaskProgress = {},
  onTaskClick,
  onStatusChange,
  onDeleteTask,
}) {
  const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });
  const [openMenuId, setOpenMenuId] = useState(null);

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // For assignee column, sort by first assignee name
      if (sortConfig.key === 'assigned_to_name') {
        aValue = a.assignees?.[0]?.name || a.assigned_to_name || '';
        bValue = b.assignees?.[0]?.name || b.assigned_to_name || '';
      }

      // Handle null/undefined
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Handle dates
      if (sortConfig.key === 'due_date') {
        aValue = aValue ? new Date(aValue).getTime() : Infinity;
        bValue = bValue ? new Date(bValue).getTime() : Infinity;
      }

      // Handle priority (custom order)
      if (sortConfig.key === 'priority') {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        aValue = order[aValue] ?? 4;
        bValue = order[bValue] ?? 4;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tasks, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp size={14} className="text-gray-300" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={14} className="text-[#65A30D]" />
    ) : (
      <ChevronDown size={14} className="text-[#65A30D]" />
    );
  };

  const handleStatusSelect = async (task, newStatus) => {
    if (task.status !== newStatus) {
      await onStatusChange(task, newStatus);
    }
    setOpenMenuId(null);
  };

  const handleDeleteClick = (e, taskId) => {
    e.stopPropagation();
    if (confirm('¿Está seguro de eliminar esta tarea?')) {
      onDeleteTask(taskId);
    }
    setOpenMenuId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-1">
                  Tarea
                  <SortIcon columnKey="title" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('project_name')}
              >
                <div className="flex items-center gap-1">
                  Proyecto
                  <SortIcon columnKey="project_name" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('assigned_to_name')}
              >
                <div className="flex items-center gap-1">
                  Responsable
                  <SortIcon columnKey="assigned_to_name" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center gap-1">
                  Prioridad
                  <SortIcon columnKey="priority" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('due_date')}
              >
                <div className="flex items-center gap-1">
                  Fecha
                  <SortIcon columnKey="due_date" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Estado
                  <SortIcon columnKey="status" />
                </div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No hay tareas que coincidan con los filtros
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onTaskClick(task)}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1A1A2E]">{task.title}</span>
                        {!!task.is_recurring && (
                          <span className="text-[#BFFF00] text-sm" title="Tarea Recurrente">🔄</span>
                        )}
                        {taskSubtaskProgress[task.id]?.total > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <ListChecks size={12} />
                            {taskSubtaskProgress[task.id].completed}/{taskSubtaskProgress[task.id].total}
                          </span>
                        )}
                      </div>
                      {/* Tags */}
                      {taskTags[task.id]?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
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
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {task.project_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {task.assignees?.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {task.assignees.slice(0, 3).map((a) => (
                            <div
                              key={a.id}
                              className="w-6 h-6 rounded-lg bg-[#1A1A2E] text-[#BFFF00] flex items-center justify-center text-xs font-medium ring-1 ring-white"
                              title={a.name}
                            >
                              {a.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {task.assignees.length > 3 && (
                            <div className="w-6 h-6 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium ring-1 ring-white">
                              +{task.assignees.length - 3}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-gray-600 truncate max-w-[120px]">
                          {task.assignees.map(a => a.name).join(', ')}
                        </span>
                      </div>
                    ) : task.assigned_to_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#1A1A2E] text-[#BFFF00] flex items-center justify-center text-xs font-medium">
                          {task.assigned_to_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-600">{task.assigned_to_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${priorityColors[task.priority]}`}>
                      {priorityLabels[task.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {task.due_date || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === task.id ? null : task.id);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[task.status]} hover:opacity-80 transition-opacity`}
                      >
                        {statusLabels[task.status]}
                      </button>
                      {openMenuId === task.id && (
                        <div className="absolute z-10 mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-lg py-1">
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <button
                              key={value}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusSelect(task, value);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                task.status === value ? 'bg-gray-50 font-medium' : ''
                              }`}
                            >
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${statusColors[value].split(' ')[0]}`} />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(task);
                        }}
                        className="p-1.5 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, task.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
