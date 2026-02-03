import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalProjectsAPI } from '../../utils/portalApi';
import {
  FolderKanban,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Loader2,
  ExternalLink
} from 'lucide-react';

export default function PortalProjectDetail() {
  const { id } = useParams();
  const { hasPermission } = usePortal();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const response = await portalProjectsAPI.getById(id);
      setProject(response.project);
      setTasks(response.tasks || []);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      planning: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Planificación' },
      in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'En Progreso' },
      review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Revisión' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completado' },
      on_hold: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Pausado' }
    };
    const style = styles[status] || styles.planning;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const getTaskStatusBadge = (status) => {
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
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendiente Aprobación' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aprobado' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rechazado' },
      changes_requested: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Cambios Solicitados' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-[#1A1A2E]">Proyecto no encontrado</h2>
        <p className="text-gray-500 mt-2 mb-4">Este proyecto no existe o no tienes acceso.</p>
        <Link to="/portal/projects" className="text-[#1A1A2E] hover:underline">
          Volver a proyectos
        </Link>
      </div>
    );
  }

  const pendingApproval = tasks.filter(t => t.requires_client_approval && t.client_approval_status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'done');
  const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/portal/projects"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-[#1A1A2E] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a proyectos</span>
      </Link>

      {/* Project Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FolderKanban className="w-7 h-7 text-[#1A1A2E]" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">{project.name}</h1>
                {getStatusBadge(project.status)}
              </div>
              {project.description && (
                <p className="text-gray-500 mt-2">{project.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Progress & Stats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Progress */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Progreso</span>
              <span className="text-lg font-bold text-[#1A1A2E]">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#1A1A2E]">
                {completedTasks.length}/{tasks.length}
              </p>
              <p className="text-sm text-gray-500">Tareas completadas</p>
            </div>
          </div>

          {/* Due Date */}
          {project.due_date && (
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#1A1A2E]">
                  {new Date(project.due_date).toLocaleDateString('es-CO', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-sm text-gray-500">Fecha límite</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {pendingApproval.length > 0 && hasPermission('can_approve_tasks') && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">
              {pendingApproval.length} tarea{pendingApproval.length > 1 ? 's' : ''} esperando tu aprobación
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Revisa las tareas marcadas para aprobar o solicitar cambios.
            </p>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#1A1A2E]">Tareas del Proyecto</h2>
          <p className="text-sm text-gray-500">{tasks.length} tareas en total</p>
        </div>

        {tasks.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <Link
                key={task.id}
                to={`/portal/tasks/${task.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    task.status === 'done' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A2E]">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getTaskStatusBadge(task.status)}
                      {task.requires_client_approval && getApprovalBadge(task.client_approval_status)}
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No hay tareas visibles en este proyecto.
          </div>
        )}
      </div>
    </div>
  );
}
