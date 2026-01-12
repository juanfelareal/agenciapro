import { useState, useEffect } from 'react';
import { tasksAPI, projectsAPI } from '../utils/api';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
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
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';

const Calendar = () => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month' or 'week'
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Project colors
  const projectColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-red-500',
    'bg-indigo-500',
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        tasksAPI.getAll(),
        projectsAPI.getAll(),
      ]);
      setTasks(tasksRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProjectColor = (projectId) => {
    const index = projects.findIndex((p) => p.id === projectId);
    return projectColors[index % projectColors.length] || 'bg-gray-500';
  };

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
  const getCalendarDays = () => {
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
  };

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

      // Update local state
      setTasks(tasks.map((t) =>
        t.id === draggedTask.id ? { ...t, due_date: newDueDate } : t
      ));
    } catch (error) {
      console.error('Error updating task:', error);
    }

    setDraggedTask(null);
  };

  // Status colors
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

  if (loading) {
    return <div className="text-center py-8">Cargando calendario...</div>;
  }

  const calendarDays = getCalendarDays();
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Calendario</h1>
          <p className="text-gray-600">Vista de tareas por fecha</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Calendar Navigation */}
      <div className="bg-white rounded-lg shadow mb-4 p-4 flex items-center justify-between">
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
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarIcon size={16} />
          <span>{tasks.filter((t) => t.due_date).length} tareas programadas</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow flex-1 overflow-hidden flex flex-col">
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
                }`}
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
                      onClick={() => setSelectedTask(task)}
                      className={`text-xs p-1.5 rounded cursor-pointer border-l-2 ${
                        statusColors[task.status]
                      } bg-white shadow-sm hover:shadow transition-shadow`}
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

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {selectedTask.title}
                </h3>
                {selectedTask.project_id && (
                  <p className="text-sm text-gray-500">
                    {getProjectName(selectedTask.project_id)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Estado:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedTask.status === 'done'
                    ? 'bg-green-100 text-green-700'
                    : selectedTask.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : selectedTask.status === 'review'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {selectedTask.status === 'done' ? 'Completada' :
                   selectedTask.status === 'in_progress' ? 'En Progreso' :
                   selectedTask.status === 'review' ? 'En Revisión' : 'Por Hacer'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Prioridad:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedTask.priority === 'urgent'
                    ? 'bg-red-100 text-red-700'
                    : selectedTask.priority === 'high'
                    ? 'bg-orange-100 text-orange-700'
                    : selectedTask.priority === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {selectedTask.priority === 'urgent' ? 'Urgente' :
                   selectedTask.priority === 'high' ? 'Alta' :
                   selectedTask.priority === 'medium' ? 'Media' : 'Baja'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Fecha:</span>
                <span className="text-sm">
                  {selectedTask.due_date
                    ? format(parseISO(selectedTask.due_date), "d 'de' MMMM, yyyy", { locale: es })
                    : 'Sin fecha'}
                </span>
              </div>

              {selectedTask.description && (
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Descripción:</span>
                  <p className="text-sm text-gray-700">{selectedTask.description}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 bg-white rounded-lg shadow p-4">
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
};

export default Calendar;
