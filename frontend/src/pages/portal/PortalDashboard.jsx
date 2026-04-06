import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalDashboardAPI } from '../../utils/portalApi';
import {
  FolderKanban,
  CheckSquare,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Loader2,
  Calendar,
  Target,
  DollarSign,
  Activity,
  ClipboardList,
  ExternalLink,
  Send
} from 'lucide-react';

export default function PortalDashboard() {
  const { client, welcomeMessage, hasPermission } = usePortal();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await portalDashboardAPI.get();
      setData(response);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const timeAgo = (date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHrs < 24) return `hace ${diffHrs}h`;
    if (diffDays < 7) return `hace ${diffDays}d`;
    return d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
  };

  const daysUntil = (date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d - now) / 86400000);
  };

  const statusColors = {
    todo: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Pendiente' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'En progreso' },
    review: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'En revisión' },
    done: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Completada' }
  };

  const taskTotal = data?.tasks?.total || 0;
  const taskCompleted = data?.tasks?.completed || 0;
  const taskProgress = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#1A1A2E] via-[#16213e] to-[#0f3460] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.1),transparent_60%)]" />
        <div className="relative">
          <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">Panel de Control</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
            Hola, {client?.name?.split(' ')[0]}
          </h1>
          {welcomeMessage ? (
            <p className="mt-2 text-gray-300 max-w-xl">{welcomeMessage}</p>
          ) : (
            <p className="mt-2 text-gray-300 max-w-xl">
              Aquí tienes un resumen ejecutivo de todos tus proyectos y actividad.
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Projects */}
        {hasPermission('can_view_projects') && (
          <Link to="/portal/projects" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-indigo-600" />
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E]">{data?.projects?.total || 0}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Proyectos <span className="text-indigo-600 font-medium">{data?.projects?.in_progress || 0} activos</span>
            </p>
          </Link>
        )}

        {/* Tasks Progress */}
        {hasPermission('can_view_tasks') && (
          <Link to="/portal/tasks" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-green-600" />
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E]">{taskCompleted}/{taskTotal}</p>
            <div className="mt-1.5">
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${taskProgress}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{taskProgress}% completadas</p>
            </div>
          </Link>
        )}

        {/* Pending Approval */}
        {hasPermission('can_approve_tasks') && (
          <Link to="/portal/tasks?requires_approval=1" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              {(data?.tasks?.pending_approval || 0) > 0 && (
                <span className="w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {data.tasks.pending_approval}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E]">{data?.tasks?.pending_approval || 0}</p>
            <p className="text-sm text-gray-500 mt-0.5">Por aprobar</p>
          </Link>
        )}

        {/* Billing */}
        {hasPermission('can_view_invoices') && (
          <Link to="/portal/invoices" className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(data?.invoices?.paid_amount)}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatCurrency(data?.invoices?.pending_amount)} pendiente
            </p>
          </Link>
        )}
      </div>

      {/* Main Content: 2 column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Progress */}
          {hasPermission('can_view_projects') && data?.project_details?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#1A1A2E]">Progreso de Proyectos</h2>
                    <p className="text-sm text-gray-500">Proyectos activos y su avance</p>
                  </div>
                </div>
                <Link to="/portal/projects" className="text-sm text-gray-500 hover:text-[#1A1A2E] flex items-center gap-1">
                  Ver todos <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {data.project_details.map((project) => (
                  <Link
                    key={project.id}
                    to={`/portal/projects/${project.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-[#1A1A2E] truncate">{project.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          project.status === 'planning' ? 'bg-gray-100 text-gray-600' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {project.status === 'in_progress' ? 'Activo' : project.status === 'planning' ? 'Planeando' : project.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              project.progress >= 75 ? 'bg-green-500' : project.progress >= 40 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 w-16 text-right">
                          {project.completed_count}/{project.task_count}
                        </span>
                      </div>
                      {project.due_date && (
                        <p className="text-xs text-gray-400 mt-1">
                          Entrega: {new Date(project.due_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {hasPermission('can_view_tasks') && data?.recent_tasks?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#1A1A2E]">Actividad Reciente</h2>
                    <p className="text-sm text-gray-500">Últimas actualizaciones</p>
                  </div>
                </div>
                <Link to="/portal/tasks" className="text-sm text-gray-500 hover:text-[#1A1A2E] flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {data.recent_tasks.map((task) => {
                  const sc = statusColors[task.status] || statusColors.todo;
                  return (
                    <Link
                      key={task.id}
                      to={`/portal/tasks/${task.id}`}
                      className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] truncate">{task.title}</p>
                        <p className="text-xs text-gray-400">{task.project_name}{task.assigned_to_name ? ` · ${task.assigned_to_name}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                        <span className="text-xs text-gray-400 hidden sm:block">{timeAgo(task.updated_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          {data?.upcoming_deadlines?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-[#1A1A2E] text-sm">Entregas Cercanas</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.upcoming_deadlines.map((task) => {
                  const days = daysUntil(task.due_date);
                  return (
                    <Link
                      key={task.id}
                      to={`/portal/tasks/${task.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] truncate">{task.title}</p>
                        <p className="text-xs text-gray-400">{task.project_name}{task.assigned_to_name ? ` · ${task.assigned_to_name}` : ''}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${
                        days <= 2 ? 'bg-red-100 text-red-700' :
                        days <= 5 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${days} días`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invoice Summary */}
          {hasPermission('can_view_invoices') && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-[#1A1A2E] text-sm">Facturación</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-emerald-50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-700 font-medium">Pagado</span>
                    <span className="text-xs text-emerald-600">{data?.invoices?.paid_count || 0} facturas</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">{formatCurrency(data?.invoices?.paid_amount)}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700 font-medium">Pendiente</span>
                    <span className="text-xs text-amber-600">{data?.invoices?.pending_count || 0} facturas</span>
                  </div>
                  <p className="text-lg font-bold text-amber-700 mt-0.5">{formatCurrency(data?.invoices?.pending_amount)}</p>
                </div>
                {/* Ratio bar */}
                {(data?.invoices?.paid_amount || 0) + (data?.invoices?.pending_amount || 0) > 0 && (
                  <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${Math.round(((data?.invoices?.paid_amount || 0) / ((data?.invoices?.paid_amount || 0) + (data?.invoices?.pending_amount || 0))) * 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assigned Forms */}
      {data?.assigned_forms?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A2E]">Formularios</h2>
              <p className="text-sm text-gray-500">Formularios asignados para completar</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.assigned_forms.map((form) => {
              const isSubmitted = form.status === 'submitted';
              const isDraft = form.status === 'draft';
              return (
                <div key={form.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A1A2E]">{form.form_title}</p>
                    {form.form_description && (
                      <p className="text-sm text-gray-400 truncate mt-0.5">{form.form_description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isSubmitted ? 'bg-green-100 text-green-700' :
                        isDraft ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {isSubmitted ? 'Enviado' : isDraft ? 'En borrador' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  {isSubmitted ? (
                    <div className="flex items-center gap-2 text-green-600 flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <a
                      href={`/fa/${form.share_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-xl text-sm font-medium hover:bg-[#2a2a3e] transition-colors flex-shrink-0"
                    >
                      {isDraft ? 'Continuar' : 'Responder'}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Approvals (full width, only if there are items) */}
      {hasPermission('can_approve_tasks') && data?.pending_approval?.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-amber-900">Esperando tu Aprobación</h2>
                <p className="text-sm text-amber-700">{data.pending_approval.length} tarea{data.pending_approval.length > 1 ? 's' : ''} necesitan tu revisión</p>
              </div>
            </div>
            <Link
              to="/portal/tasks?requires_approval=1"
              className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-amber-100">
            {data.pending_approval.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                to={`/portal/tasks/${task.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-amber-100/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-amber-900">{task.title}</p>
                  <p className="text-sm text-amber-700">{task.project_name}{task.assigned_to_name ? ` · ${task.assigned_to_name}` : ''}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
