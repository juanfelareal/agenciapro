import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalProjectsAPI } from '../../utils/portalApi';
import {
  FolderKanban,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Search,
  Loader2
} from 'lucide-react';

export default function PortalProjects() {
  const { hasPermission } = usePortal();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(search.toLowerCase())
  );

  const isCompleted = (p) =>
    (p.task_count || 0) > 0 && (p.progress || 0) === 100;

  const inProgressProjects = filteredProjects.filter((p) => !isCompleted(p));
  const completedProjects = filteredProjects.filter(isCompleted);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const renderCard = (project) => (
    <Link
      key={project.id}
      to={`/portal/projects/${project.id}`}
      className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6
               hover:shadow-md hover:border-gray-200 transition-all group"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
          <FolderKanban className="w-6 h-6 text-[#1A1A2E]" />
        </div>
        {project.stage_name && (
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${project.stage_color || '#6366F1'}1A`,
              color: project.stage_color || '#6366F1',
            }}
          >
            {project.stage_name}
          </span>
        )}
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
          <span>{project.completed_task_count || 0}/{project.task_count || 0} tareas</span>
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
  );

  const renderSection = (title, items, emptyText) => (
    <section className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold text-[#1A1A2E]">{title}</h2>
        <span className="text-sm text-gray-400">({items.length})</span>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(renderCard)}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{emptyText}</p>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Mis Proyectos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Revisa el progreso de tus proyectos</p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
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

      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">No hay proyectos</h3>
          <p className="text-gray-500">
            {search
              ? 'No se encontraron proyectos con la búsqueda aplicada.'
              : 'Aún no tienes proyectos asignados.'}
          </p>
        </div>
      ) : (
        <>
          {renderSection('En curso', inProgressProjects, 'No hay proyectos en curso.')}
          {renderSection('Completados', completedProjects, 'Aún no hay proyectos completados.')}
        </>
      )}
    </div>
  );
}
