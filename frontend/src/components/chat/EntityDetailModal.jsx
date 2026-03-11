import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X, CheckSquare, FolderKanban, StickyNote, User, Calendar, Flag, Clock,
  ExternalLink, MessageSquare, Loader2, Folder
} from 'lucide-react';
import { tasksAPI, projectsAPI, subtasksAPI, taskCommentsAPI, notesAPI } from '../../utils/api';

const STATUS_CONFIG = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En progreso' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completada' },
  done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completada' },
  active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Activo' },
  blocked: { bg: 'bg-red-100', text: 'text-red-700', label: 'Bloqueada' },
  review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En revisión' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelada' },
};

const PRIORITY_CONFIG = {
  urgent: { color: 'text-red-600', bg: 'bg-red-50', label: 'Urgente' },
  high: { color: 'text-red-500', bg: 'bg-red-50', label: 'Alta' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Media' },
  low: { color: 'text-green-600', bg: 'bg-green-50', label: 'Baja' },
};

const EntityDetailModal = ({ type, id, onClose }) => {
  const [data, setData] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (type === 'task') {
          const [taskRes, subtasksRes, commentsRes] = await Promise.all([
            tasksAPI.getById(id),
            subtasksAPI.getByTask(id).catch(() => ({ data: [] })),
            taskCommentsAPI.getByTask(id).catch(() => ({ data: [] })),
          ]);
          setData(taskRes.data);
          setSubtasks(subtasksRes.data || []);
          setComments(commentsRes.data || []);
        } else if (type === 'note') {
          const res = await notesAPI.getById(id);
          setData(res.data);
        } else {
          const res = await projectsAPI.getById(id);
          setData(res.data);
        }
      } catch (err) {
        console.error('Error loading entity:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type, id]);

  const status = STATUS_CONFIG[data?.status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: data?.status };
  const priority = PRIORITY_CONFIG[data?.priority];

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const linkPath = type === 'task' ? '/app/tasks' : type === 'note' ? '/app/notas' : `/app/projects/${id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${type === 'task' ? 'bg-blue-50' : type === 'note' ? 'bg-amber-50' : 'bg-purple-50'}`}>
              {type === 'task' ? <CheckSquare size={16} className="text-blue-600" /> : type === 'note' ? <StickyNote size={16} className="text-amber-600" /> : <FolderKanban size={16} className="text-purple-600" />}
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase">
              {type === 'task' ? `Tarea #T-${id}` : type === 'note' ? `Nota #N-${id}` : `Proyecto #P-${id}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to={linkPath}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Abrir completo"
              onClick={onClose}
            >
              <ExternalLink size={16} />
            </Link>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : !data ? (
            <p className="text-center text-gray-400 py-8">No se encontró la entidad</p>
          ) : type === 'note' ? (
            /* Note Detail */
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800">{data.title}</h2>

              <div className="flex flex-wrap gap-2">
                {data.category_name && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    {data.category_name}
                  </span>
                )}
                {data.is_pinned === 1 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    Fijada
                  </span>
                )}
              </div>

              {data.content_plain && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">Contenido</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-[12]">{data.content_plain}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {data.folder_name && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <Folder size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Carpeta</p>
                      <p className="text-xs font-medium text-gray-700">{data.folder_name}</p>
                    </div>
                  </div>
                )}
                {data.created_by_name && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <User size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Creada por</p>
                      <p className="text-xs font-medium text-gray-700">{data.created_by_name}</p>
                    </div>
                  </div>
                )}
                {data.updated_at && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <Clock size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Última edición</p>
                      <p className="text-xs font-medium text-gray-700">{formatDate(data.updated_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : type === 'task' ? (
            /* Task Detail */
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800">{data.title}</h2>

              {/* Status + Priority row */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                  {status.label}
                </span>
                {priority && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${priority.bg} ${priority.color}`}>
                    <Flag size={12} /> {priority.label}
                  </span>
                )}
              </div>

              {/* Description */}
              {data.description && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">Descripción</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.description}</p>
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3">
                {data.project_name && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <FolderKanban size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Proyecto</p>
                      <p className="text-xs font-medium text-gray-700">{data.project_name}</p>
                    </div>
                  </div>
                )}
                {(data.assigned_to_name || (data.assignees?.length > 0)) && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <User size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Asignado a</p>
                      <p className="text-xs font-medium text-gray-700">
                        {data.assignees?.length > 0
                          ? data.assignees.map(a => a.name).join(', ')
                          : data.assigned_to_name}
                      </p>
                    </div>
                  </div>
                )}
                {data.due_date && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <Calendar size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Fecha límite</p>
                      <p className="text-xs font-medium text-gray-700">{formatDate(data.due_date)}</p>
                    </div>
                  </div>
                )}
                {data.created_by_name && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <User size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Creada por</p>
                      <p className="text-xs font-medium text-gray-700">{data.created_by_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtasks */}
              {subtasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">Subtareas ({subtasks.filter(s => s.is_completed).length}/{subtasks.length})</p>
                  <div className="space-y-1">
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${st.is_completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                          {st.is_completed && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <span className={st.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}>{st.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments preview */}
              {comments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                    <MessageSquare size={12} /> {comments.length} comentario{comments.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2">
                    {comments.slice(-3).map((c) => (
                      <div key={c.id} className="p-2.5 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-medium text-gray-700">{c.author_name || 'Usuario'}</span>
                          <span className="text-[10px] text-gray-400">{formatDate(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Project Detail */
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-800">{data.name}</h2>

              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                  {status.label}
                </span>
              </div>

              {data.description && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">Descripción</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {data.client_name && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <User size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Cliente</p>
                      <p className="text-xs font-medium text-gray-700">{data.client_name}</p>
                    </div>
                  </div>
                )}
                {data.deadline && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <Calendar size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Deadline</p>
                      <p className="text-xs font-medium text-gray-700">{formatDate(data.deadline)}</p>
                    </div>
                  </div>
                )}
                {data.start_date && (
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <Clock size={14} className="text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400">Inicio</p>
                      <p className="text-xs font-medium text-gray-700">{formatDate(data.start_date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 rounded-b-2xl">
          <Link
            to={linkPath}
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ExternalLink size={14} />
            Abrir {type === 'task' ? 'tarea' : type === 'note' ? 'nota' : 'proyecto'} completo
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EntityDetailModal;
