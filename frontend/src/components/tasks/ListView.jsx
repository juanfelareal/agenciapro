import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, ListChecks, Plus, Check, X, User } from 'lucide-react';

const statusLabels = {
  todo: 'Por Hacer',
  in_progress: 'En Progreso',
  review: 'En Revisión',
  done: 'Completado',
};

const statusColors = {
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-[#163B3B]/15 text-[#163B3B]',
  review: 'bg-[#C9A99D]/25 text-[#8B6B60]',
  done: 'bg-[#E8C4B8]/30 text-[#A67060]',
};

const priorityLabels = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-[#163B3B]/10 text-[#163B3B]',
  high: 'bg-[#F97316]/10 text-[#F97316]',
  urgent: 'bg-red-100 text-red-600',
};

export default function ListView({
  tasks,
  taskTags = {},
  taskSubtaskProgress = {},
  teamMembers = [],
  onTaskClick,
  onStatusChange,
  onDeleteTask,
  onCreateTask,
  onUpdateTask,
}) {
  const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });
  const [editingCell, setEditingCell] = useState(null); // { taskId, field }
  const [editValue, setEditValue] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [assigneeDropdownTaskId, setAssigneeDropdownTaskId] = useState(null);
  const newTaskInputRef = useRef(null);
  const editInputRef = useRef(null);
  const assigneeDropdownRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      if (editInputRef.current.select) {
        editInputRef.current.select();
      }
    }
  }, [editingCell]);

  // Focus new task input when adding mode is active
  useEffect(() => {
    if (isAddingTask && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isAddingTask]);

  // Close assignee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target)) {
        setAssigneeDropdownTaskId(null);
      }
    };
    if (assigneeDropdownTaskId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [assigneeDropdownTaskId]);

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'assigned_to_name') {
        aValue = a.assignees?.[0]?.name || a.assigned_to_name || '';
        bValue = b.assignees?.[0]?.name || b.assigned_to_name || '';
      }

      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      if (sortConfig.key === 'due_date') {
        aValue = aValue ? new Date(aValue).getTime() : Infinity;
        bValue = bValue ? new Date(bValue).getTime() : Infinity;
      }

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

  // Quick add task with Enter
  const handleNewTaskKeyDown = async (e) => {
    if (e.key === 'Enter' && newTaskTitle.trim()) {
      e.preventDefault();
      const titleToCreate = newTaskTitle.trim();
      // Clear input immediately for responsive feel
      setNewTaskTitle('');
      if (onCreateTask) {
        await onCreateTask({ title: titleToCreate });
      }
      // Keep focus for continuous adding - no need for timeout since we use optimistic updates
      newTaskInputRef.current?.focus();
    } else if (e.key === 'Escape') {
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  // Start editing a cell
  const startEditing = (taskId, field, currentValue) => {
    setEditingCell({ taskId, field });
    setEditValue(currentValue || '');
  };

  // Save inline edit
  const saveEdit = async (task) => {
    if (!editingCell || !onUpdateTask) return;

    const { field } = editingCell;
    const newValue = editValue;

    // Only save if value changed
    if (task[field] !== newValue) {
      await onUpdateTask(task.id, { [field]: newValue || null });
    }

    setEditingCell(null);
    setEditValue('');
  };

  // Handle keyboard in edit mode
  const handleEditKeyDown = (e, task) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(task);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      saveEdit(task);
      // Move to next editable field
      const fields = ['title', 'priority', 'due_date', 'status'];
      const currentIndex = fields.indexOf(editingCell.field);
      const nextField = fields[(currentIndex + 1) % fields.length];
      setTimeout(() => startEditing(task.id, nextField, task[nextField]), 50);
    }
  };

  // Delayed blur to allow picker interactions
  const handleDelayedBlur = (task) => {
    setTimeout(() => {
      // Only save if we're still editing this task (user didn't click elsewhere to edit another)
      if (editingCell?.taskId === task.id) {
        saveEdit(task);
      }
    }, 150);
  };

  // Render editable cell content
  const renderEditableCell = (task, field, displayContent) => {
    const isEditing = editingCell?.taskId === task.id && editingCell?.field === field;

    if (isEditing) {
      // Status select - save on change immediately
      if (field === 'status') {
        return (
          <select
            ref={editInputRef}
            value={editValue}
            onChange={async (e) => {
              const newValue = e.target.value;
              setEditValue(newValue);
              // Save immediately on selection
              if (onUpdateTask && task.status !== newValue) {
                await onUpdateTask(task.id, { status: newValue });
              }
              setEditingCell(null);
              setEditValue('');
            }}
            onBlur={() => {
              setEditingCell(null);
              setEditValue('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingCell(null);
                setEditValue('');
              }
            }}
            className="w-full px-2 py-1 text-sm border border-[#163B3B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163B3B]/20"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        );
      }

      // Priority select - save on change immediately
      if (field === 'priority') {
        return (
          <select
            ref={editInputRef}
            value={editValue}
            onChange={async (e) => {
              const newValue = e.target.value;
              setEditValue(newValue);
              // Save immediately on selection
              if (onUpdateTask && task.priority !== newValue) {
                await onUpdateTask(task.id, { priority: newValue });
              }
              setEditingCell(null);
              setEditValue('');
            }}
            onBlur={() => {
              setEditingCell(null);
              setEditValue('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingCell(null);
                setEditValue('');
              }
            }}
            className="w-full px-2 py-1 text-sm border border-[#163B3B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163B3B]/20"
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        );
      }

      // Date input - save on change immediately (when user picks a date)
      if (field === 'due_date') {
        return (
          <input
            ref={editInputRef}
            type="date"
            value={editValue}
            onChange={async (e) => {
              const newValue = e.target.value;
              setEditValue(newValue);
              // Save immediately when date is picked
              if (onUpdateTask) {
                await onUpdateTask(task.id, { due_date: newValue || null });
              }
              setEditingCell(null);
              setEditValue('');
            }}
            onBlur={() => handleDelayedBlur(task)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingCell(null);
                setEditValue('');
              } else if (e.key === 'Enter') {
                saveEdit(task);
              }
            }}
            className="w-full px-2 py-1 text-sm border border-[#163B3B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163B3B]/20"
          />
        );
      }

      // Default text input
      return (
        <input
          ref={editInputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleDelayedBlur(task)}
          onKeyDown={(e) => handleEditKeyDown(e, task)}
          className="w-full px-2 py-1 text-sm border border-[#163B3B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163B3B]/20"
        />
      );
    }

    // Non-editing state - clickable
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          startEditing(task.id, field, task[field]);
        }}
        className="cursor-text hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 transition-colors"
      >
        {displayContent}
      </div>
    );
  };

  const handleDeleteClick = (e, taskId) => {
    e.stopPropagation();
    if (confirm('¿Está seguro de eliminar esta tarea?')) {
      onDeleteTask(taskId);
    }
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
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">

              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedTasks.map((task) => (
              <tr
                key={task.id}
                className="hover:bg-gray-50 transition-colors group"
              >
                {/* Title - editable */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {renderEditableCell(
                        task,
                        'title',
                        <span className="font-medium text-[#163B3B]">{task.title}</span>
                      )}
                      {!!task.is_recurring && (
                        <span className="text-[#E8C4B8] text-sm" title="Tarea Recurrente">🔄</span>
                      )}
                      {taskSubtaskProgress[task.id]?.total > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <ListChecks size={12} />
                          {taskSubtaskProgress[task.id].completed}/{taskSubtaskProgress[task.id].total}
                        </span>
                      )}
                    </div>
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

                {/* Assignee - inline dropdown */}
                <td className="px-4 py-3 relative">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssigneeDropdownTaskId(assigneeDropdownTaskId === task.id ? null : task.id);
                    }}
                    className="cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 transition-colors"
                  >
                    {task.assignees?.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {task.assignees.slice(0, 3).map((a) => (
                            <div
                              key={a.id}
                              className="w-6 h-6 rounded-lg bg-[#163B3B] text-[#E8C4B8] flex items-center justify-center text-xs font-medium ring-1 ring-white"
                              title={a.name}
                            >
                              {a.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                        <span className="text-sm text-gray-600 truncate max-w-[100px]">
                          {task.assignees[0]?.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <User size={14} />
                        Asignar
                      </span>
                    )}
                  </div>

                  {/* Assignee dropdown */}
                  {assigneeDropdownTaskId === task.id && (
                    <div
                      ref={assigneeDropdownRef}
                      className="absolute z-20 mt-1 left-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto"
                    >
                      <div
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (onUpdateTask) {
                            await onUpdateTask(task.id, { assignee_ids: [] });
                          }
                          setAssigneeDropdownTaskId(null);
                        }}
                        className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer"
                      >
                        Sin asignar
                      </div>
                      {teamMembers.map((member) => {
                        const isSelected = task.assignees?.some(a => a.id === member.id);
                        return (
                          <div
                            key={member.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onUpdateTask) {
                                // Toggle: if already assigned, remove; otherwise add
                                const currentIds = task.assignees?.map(a => a.id) || [];
                                const newIds = isSelected
                                  ? currentIds.filter(id => id !== member.id)
                                  : [...currentIds, member.id];
                                await onUpdateTask(task.id, { assignee_ids: newIds });
                              }
                              setAssigneeDropdownTaskId(null);
                            }}
                            className={`px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2 ${isSelected ? 'bg-[#163B3B]/5' : ''}`}
                          >
                            <div className="w-6 h-6 rounded-lg bg-[#163B3B] text-[#E8C4B8] flex items-center justify-center text-xs font-medium">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{member.name}</span>
                            {isSelected && <Check size={14} className="ml-auto text-[#163B3B]" />}
                          </div>
                        );
                      })}
                      {teamMembers.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400">
                          No hay miembros del equipo
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {/* Priority - editable */}
                <td className="px-4 py-3">
                  {renderEditableCell(
                    task,
                    'priority',
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${priorityColors[task.priority]}`}>
                      {priorityLabels[task.priority]}
                    </span>
                  )}
                </td>

                {/* Due date - editable */}
                <td className="px-4 py-3">
                  {renderEditableCell(
                    task,
                    'due_date',
                    <span className="text-sm text-gray-500">{task.due_date || '+ Fecha'}</span>
                  )}
                </td>

                {/* Status - editable */}
                <td className="px-4 py-3">
                  {renderEditableCell(
                    task,
                    'status',
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[task.status]}`}>
                      {statusLabels[task.status]}
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => handleDeleteClick(e, task.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Quick add row */}
            <tr className="bg-gray-50/50">
              <td colSpan={6} className="px-4 py-2">
                {isAddingTask ? (
                  <div className="flex items-center gap-2">
                    <Plus size={16} className="text-gray-400" />
                    <input
                      ref={newTaskInputRef}
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={handleNewTaskKeyDown}
                      onBlur={() => {
                        if (!newTaskTitle.trim()) {
                          setIsAddingTask(false);
                        }
                      }}
                      placeholder="Nombre de la tarea... (Enter para crear, Esc para cancelar)"
                      className="flex-1 bg-transparent border-none outline-none text-sm text-[#163B3B] placeholder:text-gray-400"
                      autoFocus
                    />
                    {newTaskTitle.trim() && (
                      <button
                        onClick={async () => {
                          if (onCreateTask && newTaskTitle.trim()) {
                            const titleToCreate = newTaskTitle.trim();
                            setNewTaskTitle('');
                            await onCreateTask({ title: titleToCreate });
                            newTaskInputRef.current?.focus();
                          }
                        }}
                        className="p-1 text-[#163B3B] hover:bg-[#163B3B]/10 rounded"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setNewTaskTitle('');
                        setIsAddingTask(false);
                      }}
                      className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingTask(true)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#163B3B] transition-colors w-full py-1"
                  >
                    <Plus size={16} />
                    <span>Agregar tarea</span>
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
