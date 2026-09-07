import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layers, Calendar, Loader2, Rocket, ArrowLeft, User, CheckCircle2,
  Clock, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { portalStructuredBriefsAPI } from '../../utils/portalApi';

const formatMonth = (month) => {
  if (!month) return null;
  const [year, m] = month.split('-');
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${monthNames[parseInt(m, 10) - 1]} ${year}`;
};

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const TASK_STATUS_CONFIG = {
  todo: { label: 'Pendiente', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
  in_progress: { label: 'En progreso', color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
  done: { label: 'Completada', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
  blocked: { label: 'Bloqueada', color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
};

const PRIORITY_CONFIG = {
  low: { label: 'Baja', color: 'text-gray-500' },
  medium: { label: 'Media', color: 'text-yellow-600' },
  high: { label: 'Alta', color: 'text-red-600' },
};

export default function PortalStructuredBriefDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const data = await portalStructuredBriefsAPI.getById(id);
        setBrief(data.brief);
        // Expand all sections by default
        const expanded = {};
        data.brief?.sections?.forEach(s => { expanded[s.id] = true; });
        setExpandedSections(expanded);
      } catch (error) {
        console.error('Error loading structured brief:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="text-center py-16 text-ink-500">
        <Layers className="w-12 h-12 mx-auto text-ink-300 mb-3" />
        <p>Brief no encontrado.</p>
        <button
          onClick={() => navigate('/portal/briefs')}
          className="mt-4 text-emerald-600 hover:underline"
        >
          Volver a briefs
        </button>
      </div>
    );
  }

  // Calculate stats
  const totalTasks = brief.sections?.reduce((acc, s) => acc + (s.tasks?.length || 0), 0) || 0;
  const completedTasks = brief.sections?.reduce((acc, s) =>
    acc + (s.tasks?.filter(t => t.task_status === 'done').length || 0), 0) || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/portal/briefs')}
          className="w-10 h-10 rounded-xl border border-ink-100 flex items-center justify-center hover:bg-ink-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">{brief.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-ink-500">
            {brief.month && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                <Calendar size={14} />
                {formatMonth(brief.month)}
              </span>
            )}
            {brief.generated_project_id && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-600">
                <Rocket size={14} />
                Proyecto: {brief.project_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {brief.generated_project_id && totalTasks > 0 && (
        <div className="bg-white rounded-2xl border border-ink-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-900">Progreso del proyecto</span>
            <span className="text-sm text-ink-500">{completedTasks} de {totalTasks} tareas completadas</span>
          </div>
          <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {brief.sections?.map((section) => {
          const isExpanded = expandedSections[section.id];
          const sectionCompleted = section.tasks?.filter(t => t.task_status === 'done').length || 0;
          const sectionTotal = section.tasks?.length || 0;

          return (
            <div key={section.id} className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
              {/* Section header */}
              <div
                onClick={() => toggleSection(section.id)}
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-ink-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink-900">{section.area_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5 text-sm text-ink-500">
                      {section.responsible_name && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {section.responsible_name}
                        </span>
                      )}
                      {sectionTotal > 0 && (
                        <span className="text-ink-400">
                          · {sectionCompleted}/{sectionTotal} tareas
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sectionTotal > 0 && (
                    <div className="hidden sm:flex items-center gap-1.5">
                      <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${sectionTotal > 0 ? (sectionCompleted / sectionTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Section content */}
              {isExpanded && (
                <div className="px-5 pb-4 border-t border-ink-50">
                  {/* Context */}
                  {section.context_text && (
                    <div className="mt-4 p-4 bg-ink-50 rounded-xl">
                      <p className="text-sm text-ink-700 whitespace-pre-wrap">{section.context_text}</p>
                    </div>
                  )}

                  {/* Tasks */}
                  {section.tasks?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-xs font-medium text-ink-500 uppercase tracking-wide">Tareas</h4>
                      <div className="space-y-2">
                        {section.tasks.map((task) => {
                          const statusConfig = TASK_STATUS_CONFIG[task.task_status] || TASK_STATUS_CONFIG.todo;
                          const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                          const StatusIcon = statusConfig.icon;

                          return (
                            <div
                              key={task.id}
                              className={`p-3 rounded-xl border ${
                                task.task_status === 'done'
                                  ? 'bg-emerald-50/50 border-emerald-100'
                                  : 'bg-white border-ink-100'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-6 h-6 rounded-lg ${statusConfig.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                  <StatusIcon size={14} className={statusConfig.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium ${task.task_status === 'done' ? 'text-ink-500 line-through' : 'text-ink-900'}`}>
                                    {task.title}
                                  </p>
                                  {task.description && (
                                    <p className="text-sm text-ink-500 mt-1">{task.description}</p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                                      {statusConfig.label}
                                    </span>
                                    {task.priority && task.priority !== 'medium' && (
                                      <span className={`${priorityConfig.color}`}>
                                        Prioridad {priorityConfig.label.toLowerCase()}
                                      </span>
                                    )}
                                    {task.due_date && (
                                      <span className="text-ink-400 flex items-center gap-1">
                                        <Calendar size={10} />
                                        {formatDate(task.due_date)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!section.context_text && (!section.tasks || section.tasks.length === 0) && (
                    <p className="mt-4 text-sm text-ink-400 italic">Sin contenido en esta área</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(!brief.sections || brief.sections.length === 0) && (
        <div className="text-center py-12 text-ink-500">
          <p>Este brief no tiene áreas definidas.</p>
        </div>
      )}
    </div>
  );
}
