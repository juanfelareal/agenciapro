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
  Loader2
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

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-[#1A1A2E] to-gray-800 rounded-3xl p-8 text-white">
        <h1 className="text-2xl sm:text-3xl font-bold">
          ¡Hola, {client?.name?.split(' ')[0]}! 👋
        </h1>
        {welcomeMessage ? (
          <p className="mt-2 text-gray-200">{welcomeMessage}</p>
        ) : (
          <p className="mt-2 text-gray-200">
            Bienvenido a tu portal. Aquí puedes ver el progreso de tus proyectos y más.
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Projects */}
        {hasPermission('can_view_projects') && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-[#1A1A2E]" />
              </div>
              <span className="text-2xl font-bold text-[#1A1A2E]">{data?.projects?.total || 0}</span>
            </div>
            <h3 className="mt-4 font-medium text-[#1A1A2E]">Proyectos</h3>
            <p className="text-sm text-gray-500">
              {data?.projects?.in_progress || 0} en progreso
            </p>
          </div>
        )}

        {/* Tasks */}
        {hasPermission('can_view_tasks') && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-[#1A1A2E]">{data?.tasks?.total || 0}</span>
            </div>
            <h3 className="mt-4 font-medium text-[#1A1A2E]">Tareas</h3>
            <p className="text-sm text-gray-500">
              {data?.tasks?.completed || 0} completadas
            </p>
          </div>
        )}

        {/* Pending Approval */}
        {hasPermission('can_approve_tasks') && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <span className="text-2xl font-bold text-[#1A1A2E]">{data?.tasks?.pending_approval || 0}</span>
            </div>
            <h3 className="mt-4 font-medium text-[#1A1A2E]">Por Aprobar</h3>
            <p className="text-sm text-gray-500">
              Tareas esperando tu revisión
            </p>
          </div>
        )}

        {/* Invoices */}
        {hasPermission('can_view_invoices') && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-[#1A1A2E]">{formatCurrency(data?.invoices?.paid_amount)}</span>
            </div>
            <h3 className="mt-4 font-medium text-[#1A1A2E]">Pagado</h3>
            <p className="text-sm text-gray-500">
              {formatCurrency(data?.invoices?.pending_amount)} pendiente
            </p>
          </div>
        )}
      </div>

      {/* Pending Approvals Section */}
      {hasPermission('can_approve_tasks') && data?.pending_approval?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-[#1A1A2E]">Esperando tu Aprobación</h2>
                <p className="text-sm text-gray-500">Tareas que necesitan tu revisión</p>
              </div>
            </div>
            <Link
              to="/portal/tasks?requires_approval=1"
              className="text-sm text-gray-600 hover:text-[#1A1A2E] flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.pending_approval.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                to={`/portal/tasks/${task.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-[#1A1A2E]">{task.title}</p>
                  <p className="text-sm text-gray-500">{task.project_name}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Tasks */}
      {hasPermission('can_view_tasks') && data?.recent_tasks?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-[#1A1A2E]">Actividad Reciente</h2>
                <p className="text-sm text-gray-500">Últimas actualizaciones en tus tareas</p>
              </div>
            </div>
            <Link
              to="/portal/tasks"
              className="text-sm text-gray-600 hover:text-[#1A1A2E] flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recent_tasks.map((task) => (
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
                    <p className="text-sm text-gray-500">{task.project_name}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  task.status === 'done'
                    ? 'bg-green-100 text-green-700'
                    : task.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {task.status === 'done' ? 'Completada' :
                   task.status === 'in_progress' ? 'En progreso' :
                   task.status === 'review' ? 'En revisión' : 'Pendiente'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
