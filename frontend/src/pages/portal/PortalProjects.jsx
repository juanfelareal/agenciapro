import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalProjectsAPI } from '../../utils/portalApi';
import {
  FolderKanban,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  Search,
  Filter,
  Loader2
} from 'lucide-react';

export default function PortalProjects() {
  const { hasPermission } = usePortal();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await portalProjectsAPI.getAll();
      setProjects(response.projects || []);
    } catch (error) {
      console.error('Error loading projects:', error);
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

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Mis Proyectos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Revisa el progreso de tus proyectos</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar proyectos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl appearance-none
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="planning">Planificación</option>
            <option value="in_progress">En Progreso</option>
            <option value="review">Revisión</option>
            <option value="completed">Completado</option>
            <option value="on_hold">Pausado</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/portal/projects/${project.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6
                       hover:shadow-md hover:border-gray-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <FolderKanban className="w-6 h-6 text-[#1A1A2E]" />
                </div>
                {getStatusBadge(project.status)}
              </div>

              <h3 className="font-semibold text-[#1A1A2E] mb-2 group-hover:text-[#1A1A2E] transition-colors">
                {project.name}
              </h3>

              {project.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                  {project.description}
                </p>
              )}

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">Progreso</span>
                  <span className="font-medium text-[#1A1A2E]">{project.progress || 0}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                    style={{ width: `${project.progress || 0}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{project.completed_tasks || 0}/{project.total_tasks || 0} tareas</span>
                </div>
                {project.due_date && (
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(project.due_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Ver detalles</span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#1A1A2E] group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">No hay proyectos</h3>
          <p className="text-gray-500">
            {search || statusFilter !== 'all'
              ? 'No se encontraron proyectos con los filtros aplicados.'
              : 'Aún no tienes proyectos asignados.'}
          </p>
        </div>
      )}
    </div>
  );
}
