import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalTasksAPI, portalProjectsAPI } from '../../utils/portalApi';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  FolderKanban,
  Plus,
  X
} from 'lucide-react';

export default function PortalTasks() {
  const { hasPermission } = usePortal();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState(searchParams.get('requires_approval') === '1' ? 'pending' : 'all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', project_id: '', priority: 'medium' });
  const [createError, setCreateError] = useState('');

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

  const handleOpenCreateModal = async () => {
    setCreateError('');
    try {
      const response = await portalProjectsAPI.getAll();
      setProjects(response.projects || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
    setNewTask({ title: '', description: '', project_id: '', priority: 'medium' });
    setShowCreateModal(true);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.project_id || creating) return;

    setCreating(true);
    setCreateError('');
    try {
      await portalTasksAPI.create({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        project_id: parseInt(newTask.project_id),
        priority: newTask.priority
      });
      setShowCreateModal(false);
      setLoading(true);
      await loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      const errorMessage = error.response?.data?.error || 'Error al crear la tarea. Intenta de nuevo.';
      setCreateError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      todo: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pendiente' },
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
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Mis Tareas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revisa el estado de todas tus tareas</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl
                   hover:bg-gray-800 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva Tarea
        </button>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar tareas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl appearance-none
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
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl appearance-none
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredTasks.map((task) => (
              <Link
                key={task.id}
                to={`/portal/tasks/${task.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    task.status === 'done' ? 'bg-green-100' :
                    task.requires_client_approval && task.client_approval_status === 'pending' ? 'bg-amber-100' :
                    'bg-gray-100'
                  }`}>
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : task.requires_client_approval && task.client_approval_status === 'pending' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <CheckSquare className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A2E]">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <FolderKanban className="w-3.5 h-3.5" />
                        {task.project_name}
                      </span>
                      {getStatusBadge(task.status)}
                      {task.requires_client_approval && getApprovalBadge(task.client_approval_status)}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">No hay tareas</h3>
          <p className="text-gray-500">
            {search || statusFilter !== 'all' || approvalFilter !== 'all'
              ? 'No se encontraron tareas con los filtros aplicados.'
              : 'Aún no tienes tareas asignadas.'}
          </p>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#1A1A2E]">Nueva Tarea</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {createError}
              </div>
            )}

            {projects.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FolderKanban className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No tienes proyectos asignados</p>
                <p className="text-sm text-gray-500 mt-1">Contacta al equipo para que te asignen un proyecto.</p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="mt-4 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl
                           hover:bg-gray-50 transition-colors font-medium"
                >
                  Cerrar
                </button>
              </div>
            ) : (
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Describe brevemente la tarea..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Agrega detalles o instrucciones..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto *</label>
                <select
                  value={newTask.project_id}
                  onChange={(e) => setNewTask({ ...newTask, project_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
                >
                  <option value="">Selecciona un proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl
                           hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTask.title.trim() || !newTask.project_id || creating}
                  className="flex-1 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl font-medium
                           hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creando...' : 'Crear Tarea'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
