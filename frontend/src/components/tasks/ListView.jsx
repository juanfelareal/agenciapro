import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, ListChecks, Plus, Check, X, User, CheckSquare, Square, MinusSquare } from 'lucide-react';

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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const newTaskInputRef = useRef(null);
  const editInputRef = useRef(null);
  const assigneeDropdownRef = useRef(null);

  // Resizable columns — widths persisted in localStorage
  const DEFAULT_WIDTHS = {
    checkbox: 40,
    title: 320,
    client: 180,
    assignee: 180,
    priority: 120,
    due_date: 130,
    status: 140,
    created_by: 160,
    actions: 80,
  };
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('tasks_listview_column_widths');
      return saved ? { ...DEFAULT_WIDTHS, ...JSON.parse(saved) } : DEFAULT_WIDTHS;
    } catch {
      return DEFAULT_WIDTHS;
    }
  });
  useEffect(() => {
    localStorage.setItem('tasks_listview_column_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);
  const totalWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0);

  const startResize = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[key];
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [key]: newWidth }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const ResizeHandle = ({ columnKey }) => (
    <div
      onMouseDown={(e) => startResize(e, columnKey)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setColumnWidths((prev) => ({ ...prev, [columnKey]: DEFAULT_WIDTHS[columnKey] }));
      }}
      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-[#163B3B]/40 active:bg-[#163B3B]/60 z-10"
      title="Arrastra para redimensionar (doble click para restablecer)"
    />
  );

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

      if (sortConfig.key === 'client_name') {
        aValue = (a.client_name || '').toLowerCase();
        bValue = (b.client_name || '').toLowerCase();
      }

      if (sortConfig.key === 'created_by_name') {
        aValue = (a.created_by_name || '').toLowerCase();
        bValue = (b.created_by_name || '').toLowerCase();
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
            ref={(el) => {
              editInputRef.current = el;
              if (el) el.focus();
            }}
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
            onBlur={() => {
              // Longer delay for date picker — the native calendar steals focus
              setTimeout(() => {
                if (editingCell?.taskId === task.id && editingCell?.field === 'due_date') {
                  saveEdit(task);
                }
              }, 300);
            }}
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

  // Bulk selection
  const isAllSelected = sortedTasks.length > 0 && sortedTasks.every(t => selectedIds.has(t.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedTasks.map(t => t.id)));
    }
  };

  const toggleSelectOne = (e, id) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => {
        const task = tasks.find(t => t.id === id);
        if (task && onUpdateTask) return onUpdateTask(id, { status: newStatus });
        return Promise.resolve();
      });
      await Promise.all(promises);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk updating:', error);
      alert('Error al actualizar algunas tareas');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkPriorityChange = async (newPriority) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => {
        if (onUpdateTask) return onUpdateTask(id, { priority: newPriority });
        return Promise.resolve();
      });
      await Promise.all(promises);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk updating:', error);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} tarea(s)? Esta acción no se puede deshacer.`)) return;
    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => onDeleteTask(id));
      await Promise.all(promises);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk deleting:', error);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkAssign = async (memberId) => {
    if (selectedIds.size === 0 || !onUpdateTask) return;
    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        onUpdateTask(id, { assignee_ids: memberId ? [memberId] : [] })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk assigning:', error);
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#163B3B]/5 border-b border-[#163B3B]/10 px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-[#163B3B]" />
            <span className="text-sm font-medium text-[#163B3B]">
              {selectedIds.size} tarea{selectedIds.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-5 w-px bg-[#163B3B]/20" />

          {/* Status change */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Estado:</span>
            {Object.entries(statusLabels).map(([val, label]) => (
              <button
                key={val}
                onClick={() => handleBulkStatusChange(val)}
                disabled={bulkUpdating}
                className={`px-2 py-1 text-xs rounded-lg font-medium disabled:opacity-50 transition-colors ${statusColors[val]} hover:opacity-80`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-[#163B3B]/20" />

          {/* Priority change */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Prioridad:</span>
            {Object.entries(priorityLabels).map(([val, label]) => (
              <button
                key={val}
                onClick={() => handleBulkPriorityChange(val)}
                disabled={bulkUpdating}
                className={`px-2 py-1 text-xs rounded-lg font-medium disabled:opacity-50 transition-colors ${priorityColors[val]} hover:opacity-80`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-[#163B3B]/20" />

          {/* Assign */}
          <div className="relative group/assign">
            <button className="px-2 py-1 text-xs rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1">
              <User size={12} />
              Asignar
            </button>
            <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48 max-h-48 overflow-y-auto hidden group-hover/assign:block">
              <button
                onClick={() => handleBulkAssign(null)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                Sin asignar
              </button>
              {teamMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleBulkAssign(m.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <div className="w-5 h-5 rounded-lg bg-[#163B3B] text-[#E8C4B8] flex items-center justify-center text-xs font-medium">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div className="h-5 w-px bg-[#163B3B]/20" />

          {/* Delete */}
          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="px-2 py-1 text-xs rounded-lg font-medium bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            <Trash2 size={12} />
            Eliminar
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-gray-500 hover:text-[#163B3B]"
          >
            Cancelar
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table style={{ tableLayout: 'fixed', width: totalWidth, minWidth: '100%' }}>
          <colgroup>
            <col style={{ width: columnWidths.checkbox }} />
            <col style={{ width: columnWidths.title }} />
            <col style={{ width: columnWidths.client }} />
            <col style={{ width: columnWidths.assignee }} />
            <col style={{ width: columnWidths.priority }} />
            <col style={{ width: columnWidths.due_date }} />
            <col style={{ width: columnWidths.status }} />
            <col style={{ width: columnWidths.created_by }} />
            <col style={{ width: columnWidths.actions }} />
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="relative px-3 py-3 text-center">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-[#163B3B]">
                  {isAllSelected ? <CheckSquare size={16} className="text-[#163B3B]" /> :
                   isSomeSelected ? <MinusSquare size={16} className="text-[#163B3B]" /> :
                   <Square size={16} />}
                </button>
                <ResizeHandle columnKey="checkbox" />
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-1">
                  Tarea
                  <SortIcon columnKey="title" />
                </div>
                <ResizeHandle columnKey="title" />
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('client_name')}
              >
                <div className="flex items-center gap-1">
                  Cliente
                  <SortIcon columnKey="client_name" />
                </div>
                <ResizeHandle columnKey="client" />
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('assigned_to_name')}
              >
                <div className="flex items-center gap-1">
                  Responsable
                  <SortIcon columnKey="assigned_to_name" />
                </div>
                <ResizeHandle columnKey="assignee" />
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center gap-1">
                  Prioridad
                  <SortIcon columnKey="priority" />
                </div>
                <ResizeHandle columnKey="priority" />
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('due_date')}
              >
                <div className="flex items-center gap-1">
                  Fecha
                  <SortIcon columnKey="due_date" />
                </div>
                <ResizeHandle columnKey="due_date" />
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Estado
                  <SortIcon columnKey="status" />
                </div>
                <ResizeHandle columnKey="status" />
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('created_by_name')}
              >
                <div className="flex items-center gap-1">
                  Creado por
                  <SortIcon columnKey="created_by_name" />
                </div>
                <ResizeHandle columnKey="created_by" />
              </th>
              <th className="relative px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">

              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedTasks.map((task) => (
              <tr
                key={task.id}
                className={`hover:bg-gray-50 transition-colors group ${selectedIds.has(task.id) ? 'bg-[#163B3B]/5' : ''}`}
              >
                {/* Checkbox */}
                <td className="px-3 py-3 text-center">
                  <button onClick={(e) => toggleSelectOne(e, task.id)} className="text-gray-400 hover:text-[#163B3B]">
                    {selectedIds.has(task.id) ? <CheckSquare size={16} className="text-[#163B3B]" /> : <Square size={16} />}
                  </button>
                </td>
                {/* Title - editable */}
                <td className="px-4 py-3 overflow-hidden">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {renderEditableCell(
                        task,
                        'title',
                        <span className="font-medium text-[#163B3B] truncate block" title={task.title}>{task.title}</span>
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

                {/* Client - read only (set via project) */}
                <td className="px-4 py-3">
                  {task.client_name ? (
                    <span className="text-sm text-gray-700 truncate block max-w-[160px]" title={task.client_name}>
                      {task.client_name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
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

                {/* Created by - read only */}
                <td className="px-4 py-3">
                  {task.created_by_name ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {task.created_by_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-600 truncate" title={task.created_by_name}>
                        {task.created_by_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
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
              <td colSpan={9} className="px-4 py-2">
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
