import { useEffect, useState } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { tasksAPI, taskDependenciesAPI } from '../utils/api';
import { format, parseISO, addDays } from 'date-fns';

const GanttView = ({ projectId }) => {
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [viewMode, setViewMode] = useState(ViewMode.Day);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadGanttData();
    }
  }, [projectId]);

  const loadGanttData = async () => {
    try {
      setLoading(true);
      const [tasksRes, depsRes] = await Promise.all([
        tasksAPI.getAll({ project_id: projectId }),
        taskDependenciesAPI.getProjectChain(projectId)
      ]);

      // Transform tasks to Gantt format
      const ganttTasks = (tasksRes.data || [])
        .filter(task => task.timeline_start && task.timeline_end)
        .map(task => ({
          id: task.id.toString(),
          name: task.title,
          start: parseISO(task.timeline_start),
          end: parseISO(task.timeline_end),
          progress: task.progress || 0,
          type: 'task',
          dependencies: [],
          styles: {
            backgroundColor: task.color || getColorByStatus(task.status),
            backgroundSelectedColor: task.color || getColorByStatus(task.status),
            progressColor: '#4f46e5',
            progressSelectedColor: '#4338ca',
          },
          project: task.project_name,
          assignee: task.assignees?.length > 0
            ? task.assignees.map(a => a.name).join(', ')
            : task.assigned_to_name,
          priority: task.priority,
          status: task.status,
        }));

      // Add dependencies
      (depsRes.data || []).forEach(dep => {
        const task = ganttTasks.find(t => t.id === dep.task_id.toString());
        if (task) {
          task.dependencies = task.dependencies || [];
          task.dependencies.push(dep.depends_on_task_id.toString());
        }
      });

      setTasks(ganttTasks);
      setDependencies(depsRes.data || []);
    } catch (error) {
      console.error('Error loading Gantt data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColorByStatus = (status) => {
    const colors = {
      todo: '#94a3b8',
      in_progress: '#3b82f6',
      review: '#f59e0b',
      done: '#10b981',
    };
    return colors[status] || '#94a3b8';
  };

  const handleTaskChange = async (task) => {
    try {
      // Update task dates in backend
      await tasksAPI.update(parseInt(task.id), {
        timeline_start: format(task.start, 'yyyy-MM-dd'),
        timeline_end: format(task.end, 'yyyy-MM-dd'),
        progress: task.progress,
      });

      // Reload data to reflect changes and dependency updates
      await loadGanttData();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Error al actualizar la tarea');
    }
  };

  const handleProgressChange = async (task) => {
    try {
      await tasksAPI.update(parseInt(task.id), {
        progress: task.progress,
      });
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleExpanderClick = (task) => {
    console.log('Expander clicked:', task);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando Gantt...</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800 font-medium">No hay tareas con fechas definidas</p>
        <p className="text-yellow-600 text-sm mt-2">
          Agrega fechas de inicio y fin (timeline) a las tareas para verlas en el Gantt
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Gantt Controls */}
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Vista Gantt</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(ViewMode.Hour)}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === ViewMode.Hour
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hora
          </button>
          <button
            onClick={() => setViewMode(ViewMode.QuarterDay)}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === ViewMode.QuarterDay
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            6 Horas
          </button>
          <button
            onClick={() => setViewMode(ViewMode.HalfDay)}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === ViewMode.HalfDay
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            12 Horas
          </button>
          <button
            onClick={() => setViewMode(ViewMode.Day)}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === ViewMode.Day
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => setViewMode(ViewMode.Week)}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === ViewMode.Week
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode(ViewMode.Month)}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === ViewMode.Month
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="p-4 overflow-x-auto">
        <Gantt
          tasks={tasks}
          viewMode={viewMode}
          onDateChange={handleTaskChange}
          onProgressChange={handleProgressChange}
          onExpanderClick={handleExpanderClick}
          listCellWidth="155px"
          columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 60}
          ganttHeight={400}
          locale="es"
          todayColor="rgba(252, 248, 227, 0.5)"
          TooltipContent={({ task }) => (
            <div className="bg-gray-900 text-white p-3 rounded shadow-lg max-w-xs">
              <p className="font-semibold">{task.name}</p>
              <p className="text-sm mt-1">Inicio: {format(task.start, 'dd/MM/yyyy')}</p>
              <p className="text-sm">Fin: {format(task.end, 'dd/MM/yyyy')}</p>
              <p className="text-sm">Progreso: {task.progress}%</p>
              {task.assignee && <p className="text-sm mt-1">Asignado: {task.assignee}</p>}
              {task.priority && (
                <p className="text-sm">
                  Prioridad:{' '}
                  <span className={`font-medium ${
                    task.priority === 'urgent' ? 'text-red-400' :
                    task.priority === 'high' ? 'text-orange-400' :
                    task.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {task.priority}
                  </span>
                </p>
              )}
            </div>
          )}
        />
      </div>

      {/* Legend */}
      <div className="p-4 border-t bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-2">Estado de las tareas:</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#94a3b8' }}></div>
            <span className="text-sm text-gray-600">Por Hacer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
            <span className="text-sm text-gray-600">En Progreso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
            <span className="text-sm text-gray-600">En Revisión</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
            <span className="text-sm text-gray-600">Completado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttView;
