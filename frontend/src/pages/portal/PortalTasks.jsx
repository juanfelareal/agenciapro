import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalTasksAPI } from '../../utils/portalApi';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  FolderKanban
} from 'lucide-react';

export default function PortalTasks() {
  const { hasPermission } = usePortal();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState(searchParams.get('requires_approval') === '1' ? 'pending' : 'all');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await portalTasksAPI.getAll();
      setTasks(response.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      todo: { bg: 'bg-ink-100', text: 'text-ink-600', label: 'Pendiente' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En Progreso' },
      review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En Revisión' },
      done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completada' }
    };
    const style = styles[status] || styles.todo;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const getApprovalBadge = (status) => {
    if (!status) return null;
    const styles = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Pendiente Aprobación' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Aprobado' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle, label: 'Rechazado' },
      changes_requested: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertCircle, label: 'Cambios Solicitados' }
    };
    const style = styles[status] || styles.pending;
    const Icon = style.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="w-3 h-3" />
        {style.label}
      </span>
    );
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) ||
                         (task.project_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesApproval = approvalFilter === 'all' ||
                           (approvalFilter === 'pending' && task.requires_client_approval && task.client_approval_status === 'pending');
    return matchesSearch && matchesStatus && matchesApproval;
  });

  const pendingApprovalCount = tasks.filter(t => t.requires_client_approval && t.client_approval_status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-ink-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Mis Tareas</h1>
        <p className="text-ink-500 mt-1">Revisa el estado de todas tus tareas</p>
      </div>

      {/* Pending Approval Alert */}
      {pendingApprovalCount > 0 && hasPermission('can_approve_tasks') && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">
                {pendingApprovalCount} tarea{pendingApprovalCount > 1 ? 's' : ''} esperando aprobación
              </p>
              <p className="text-sm text-amber-700">Revisa y aprueba los entregables</p>
            </div>
          </div>
          <button
            onClick={() => setApprovalFilter('pending')}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Ver pendientes
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
          <input
            type="text"
            placeholder="Buscar tareas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-ink-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-ink-200 rounded-xl appearance-none
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="todo">Pendiente</option>
            <option value="in_progress">En Progreso</option>
            <option value="review">En Revisión</option>
            <option value="done">Completada</option>
          </select>
          {hasPermission('can_approve_tasks') && (
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-ink-200 rounded-xl appearance-none
                       focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">Todas las tareas</option>
              <option value="pending">Por aprobar</option>
            </select>
          )}
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length > 0 ? (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
          <div className="divide-y divide-ink-100">
            {filteredTasks.map((task) => (
              <Link
                key={task.id}
                to={`/portal/tasks/${task.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-ink-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    task.status === 'done' ? 'bg-green-100' :
                    task.requires_client_approval && task.client_approval_status === 'pending' ? 'bg-amber-100' :
                    'bg-ink-100'
                  }`}>
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : task.requires_client_approval && task.client_approval_status === 'pending' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <CheckSquare className="w-5 h-5 text-ink-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-ink-900">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-ink-500 flex items-center gap-1">
                        <FolderKanban className="w-3.5 h-3.5" />
                        {task.project_name}
                      </span>
                      {getStatusBadge(task.status)}
                      {task.requires_client_approval && getApprovalBadge(task.client_approval_status)}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-ink-400" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 p-12 text-center">
          <div className="w-16 h-16 bg-ink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 text-ink-400" />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">No hay tareas</h3>
          <p className="text-ink-500">
            {search || statusFilter !== 'all' || approvalFilter !== 'all'
              ? 'No se encontraron tareas con los filtros aplicados.'
              : 'Aún no tienes tareas asignadas.'}
          </p>
        </div>
      )}
    </div>
  );
}
