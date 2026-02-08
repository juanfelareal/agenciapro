import { useEffect, useState } from 'react';
import { Clock, CheckSquare } from 'lucide-react';
import { tasksAPI } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';

const TasksUpcomingWidget = ({ widget }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await tasksAPI.getAll();
        const allTasks = response.data || [];

        // Filter tasks assigned to current user, not done, with due date
        const upcoming = allTasks
          .filter(t =>
            (t.assignees?.some(a => a.id === user?.id) || t.assigned_to === user?.id) &&
            t.status !== 'done' &&
            t.due_date
          )
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
          .slice(0, widget.size === 'large' ? 8 : 5);

        setTasks(upcoming);
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [user?.id, widget.size]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Mañana';
    }
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const isOverdue = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const priorityColors = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-blue-100 text-blue-700',
    low: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-ink-900">Tareas Próximas</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-ink-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-6">
          <CheckSquare className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-ink-500">No tienes tareas pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-ink-50 hover:bg-ink-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-900 truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                  {task.project_name && (
                    <span className="text-xs text-ink-400 truncate">{task.project_name}</span>
                  )}
                </div>
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${
                isOverdue(task.due_date) ? 'text-red-600' : 'text-ink-500'
              }`}>
                {formatDate(task.due_date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TasksUpcomingWidget;
