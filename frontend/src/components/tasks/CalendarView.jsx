import { useState, useMemo } from 'react';
import { tasksAPI } from '../../utils/api';
import {
  ChevronLeft,
  ChevronRight,
  List,
  Grid3X3,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors = {
  todo: 'border-l-gray-400',
  in_progress: 'border-l-blue-500',
  review: 'border-l-yellow-500',
  done: 'border-l-green-500',
};

const priorityDots = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export default function CalendarView({
  tasks,
  projects = [],
  onTaskClick,
  onTaskUpdate,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month' or 'week'
  const [draggedTask, setDraggedTask] = useState(null);

  const getProjectName = (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name || 'Sin proyecto';
  };

  const getTasksForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((task) => task.due_date === dateStr);
  };

  // Navigation
  const goToToday = () => setCurrentDate(new Date());
  const goToPrev = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };
  const goToNext = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  // Get calendar days
  const calendarDays = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, view]);

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, date) => {
    e.preventDefault();
    if (!draggedTask) return;

    const newDueDate = format(date, 'yyyy-MM-dd');

    try {
      await tasksAPI.update(draggedTask.id, {
        ...draggedTask,
        due_date: newDueDate,
      });
      // Notify parent to refresh data
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }

    setDraggedTask(null);
  };

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 mb-4 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToNext}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Hoy
          </button>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 capitalize">
          {format(currentDate, view === 'month' ? 'MMMM yyyy' : "'Semana del' d 'de' MMMM", { locale: es })}
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {tasks.filter((t) => t.due_date).length} tareas programadas
          </span>
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'month'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 size={16} className="inline mr-1" />
              Mes
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'week'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List size={16} className="inline mr-1" />
              Semana
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border border-gray-200 flex-1 overflow-hidden flex flex-col">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium text-gray-500 border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className={`grid grid-cols-7 flex-1 ${view === 'week' ? '' : 'auto-rows-fr'}`}>
          {calendarDays.map((day, index) => {
            const dayTasks = getTasksForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={index}
                className={`border-r border-b last:border-r-0 p-1 ${
                  view === 'week' ? 'min-h-[400px]' : 'min-h-[100px]'
                } ${!isCurrentMonth ? 'bg-gray-50' : ''} ${
                  isCurrentDay ? 'bg-primary-50' : ''
                } ${draggedTask ? 'hover:bg-blue-50' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    isCurrentDay
                      ? 'w-7 h-7 bg-primary-500 text-white rounded-full flex items-center justify-center mx-auto'
                      : isCurrentMonth
                      ? 'text-gray-700'
                      : 'text-gray-400'
                  }`}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[calc(100%-28px)]">
                  {dayTasks.slice(0, view === 'week' ? 10 : 3).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={() => onTaskClick(task)}
                      className={`text-xs p-1.5 rounded cursor-pointer border-l-2 ${
                        statusColors[task.status]
                      } bg-white shadow-sm hover:shadow transition-shadow ${
                        draggedTask?.id === task.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            priorityDots[task.priority]
                          }`}
                        />
                        <span className="truncate font-medium">{task.title}</span>
                      </div>
                      {view === 'week' && task.project_id && (
                        <div className="text-gray-500 truncate mt-0.5">
                          {getProjectName(task.project_id)}
                        </div>
                      )}
                      {view === 'week' && (task.assignees?.length > 0 || task.assigned_to_name) && (
                        <div className="text-gray-400 truncate text-[10px]">
                          👤 {task.assignees?.length > 0
                            ? task.assignees.map(a => a.name).join(', ')
                            : task.assigned_to_name}
                        </div>
                      )}
                    </div>
                  ))}
                  {dayTasks.length > (view === 'week' ? 10 : 3) && (
                    <div className="text-xs text-gray-500 text-center">
                      +{dayTasks.length - (view === 'week' ? 10 : 3)} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-500 font-medium">Leyenda:</span>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span>Urgente</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Alta</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Media</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span>Baja</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1">
            <span className="w-3 h-1 bg-gray-400" />
            <span>Por Hacer</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-1 bg-blue-500" />
            <span>En Progreso</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-1 bg-yellow-500" />
            <span>En Revisión</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-1 bg-green-500" />
            <span>Completada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
