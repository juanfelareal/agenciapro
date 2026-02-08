import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { tasksAPI } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';

const TasksPriorityWidget = ({ widget }) => {
  const { user } = useAuth();
  const [priorityCounts, setPriorityCounts] = useState({
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await tasksAPI.getAll();
        const allTasks = response.data || [];

        // Filter tasks assigned to current user and not done
        const myTasks = allTasks.filter(t =>
          (t.assignees?.some(a => a.id === user?.id) || t.assigned_to === user?.id) && t.status !== 'done'
        );

        // Count by priority
        const counts = { urgent: 0, high: 0, medium: 0, low: 0 };
        myTasks.forEach(t => {
          if (counts[t.priority] !== undefined) {
            counts[t.priority]++;
          }
        });

        setPriorityCounts(counts);
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [user?.id]);

  const priorities = [
    { key: 'urgent', label: 'Urgente', color: 'bg-red-500', lightColor: 'bg-red-100' },
    { key: 'high', label: 'Alta', color: 'bg-orange-500', lightColor: 'bg-orange-100' },
    { key: 'medium', label: 'Media', color: 'bg-blue-500', lightColor: 'bg-blue-100' },
    { key: 'low', label: 'Baja', color: 'bg-gray-400', lightColor: 'bg-gray-100' },
  ];

  const total = Object.values(priorityCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-ink-900">Por Prioridad</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 bg-ink-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {priorities.map((priority) => {
            const count = priorityCounts[priority.key];
            const percentage = total > 0 ? (count / total) * 100 : 0;

            return (
              <div key={priority.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-ink-600">{priority.label}</span>
                  <span className="text-sm font-semibold text-ink-900">{count}</span>
                </div>
                <div className={`h-2 rounded-full ${priority.lightColor}`}>
                  <div
                    className={`h-full rounded-full ${priority.color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className="pt-3 border-t border-ink-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-500">Total pendientes</span>
              <span className="text-lg font-bold text-ink-900">{total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPriorityWidget;
