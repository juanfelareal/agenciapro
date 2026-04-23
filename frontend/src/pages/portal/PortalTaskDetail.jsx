import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalTasksAPI } from '../../utils/portalApi';
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MessageSquare,
  Send,
  Loader2,
  FolderKanban,
  User,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ClipboardList,
  ExternalLink,
  Paperclip,
  Download,
  Plus,
  X
} from 'lucide-react';

export default function PortalTaskDetail() {
  const { id } = useParams();
  const { client, hasPermission } = usePortal();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);
  const [stagedChanges, setStagedChanges] = useState([]); // change requests acumuladas antes de enviar

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      const response = await portalTasksAPI.getById(id);
      setTask(response.task);
      setComments(response.comments || []);
    } catch (error) {
      console.error('Error loading task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await portalTasksAPI.addComment(id, newComment.trim());
      setComments([...comments, response]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (action) => {
    setApprovalAction(action);
    setStagedChanges([]);
    setApprovalNotes('');
    setShowApprovalModal(true);
  };

  const closeApprovalModal = () => {
    setShowApprovalModal(false);
    setApprovalNotes('');
    setStagedChanges([]);
  };

  const stageAnotherChange = () => {
    const trimmed = approvalNotes.trim();
    if (!trimmed) return;
    setStagedChanges((prev) => [...prev, trimmed]);
    setApprovalNotes('');
  };

  const removeStagedChange = (index) => {
    setStagedChanges((prev) => prev.filter((_, i) => i !== index));
  };

  const submitApproval = async () => {
    setSubmitting(true);
    try {
      let notes = approvalNotes.trim();
      if (approvalAction === 'changes_requested') {
        const all = [...stagedChanges];
        if (notes) all.push(notes);
        notes = all.length > 1
          ? all.map((c, i) => `${i + 1}. ${c}`).join('\n')
          : (all[0] || '');
      }
      await portalTasksAPI.submitApproval(id, {
        action: approvalAction,
        notes,
      });
      await loadTask();
      closeApprovalModal();
    } catch (error) {
      console.error('Error submitting approval:', error);
    } finally {
      setSubmitting(false);
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const getApprovalInfo = (status) => {
    const info = {
      pending: { icon: Clock, color: 'amber', label: 'Pendiente de Aprobación', desc: 'Esta tarea requiere tu aprobación' },
      approved: { icon: CheckCircle2, color: 'green', label: 'Aprobado', desc: 'Has aprobado esta tarea' },
      rejected: { icon: XCircle, color: 'red', label: 'Rechazado', desc: 'Has rechazado esta tarea' },
      changes_requested: { icon: RotateCcw, color: 'orange', label: 'Cambios Solicitados', desc: 'Has solicitado cambios en esta tarea' }
    };
    return info[status] || info.pending;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-[#1A1A2E]">Tarea no encontrada</h2>
        <p className="text-gray-500 mt-2 mb-4">Esta tarea no existe o no tienes acceso.</p>
        <Link to="/portal/tasks" className="text-[#1A1A2E] hover:underline">
          Volver a tareas
        </Link>
      </div>
    );
  }

  const approvalInfo = task.requires_client_approval ? getApprovalInfo(task.client_approval_status) : null;
  const ApprovalIcon = approvalInfo?.icon;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/portal/tasks"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-[#1A1A2E] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a tareas</span>
      </Link>

      {/* Task Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            task.status === 'done' ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {task.status === 'done' ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <CheckSquare className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">{task.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {getStatusBadge(task.status)}
              <span className="text-gray-500 flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4" />
                {task.project_name}
              </span>
            </div>
          </div>
        </div>

        {/* Task Meta */}
        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {task.assigned_to_name && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-[#1A1A2E]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Asignado a</p>
                <p className="font-medium text-[#1A1A2E]">{task.assigned_to_name}</p>
              </div>
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Fecha límite</p>
                <p className="font-medium text-[#1A1A2E]">
                  {new Date(task.due_date).toLocaleDateString('es-CO', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linked Form Section */}
      {task.linked_form && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-indigo-800">{task.linked_form.form_title}</h3>
                <p className="text-sm text-indigo-600">
                  {task.linked_form.form_status === 'submitted'
                    ? 'Formulario enviado'
                    : task.linked_form.form_status === 'draft'
                      ? 'Formulario en progreso'
                      : 'Formulario pendiente por llenar'}
                </p>
              </div>
            </div>
            <Link
              to={`/portal/formularios/${task.linked_form.assignment_id}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                task.linked_form.form_status === 'submitted'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {task.linked_form.form_status === 'submitted' ? (
                <><CheckCircle2 size={16} /> Ver respuestas</>
              ) : (
                <><ExternalLink size={16} /> Llenar formulario</>
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Deliverable Section — what the team delivered for the client to review */}
      {(task.delivery_url || (task.files && task.files.length > 0)) && (() => {
        const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
        const fileUrl = (fp) => (fp?.startsWith('http') ? fp : `${apiBase}${fp?.startsWith('/') ? '' : '/'}${fp}`);
        const isImage = (type) => type?.startsWith('image/');
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <Paperclip className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-[#1A1A2E]">Entregable</h2>
              <span className="text-sm text-gray-500">
                {(task.files?.length || 0) + (task.delivery_url ? 1 : 0)}
              </span>
            </div>
            <div className="p-6 space-y-4">
              {task.delivery_url && (
                <a
                  href={task.delivery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-4 border border-gray-200 rounded-xl hover:border-[#1A1A2E] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <ExternalLink className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E] truncate">Link de entrega</p>
                      <p className="text-xs text-gray-500 truncate">{task.delivery_url}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </a>
              )}

              {task.files && task.files.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {task.files.map((f) => (
                    <div key={f.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      {isImage(f.file_type) ? (
                        <a href={fileUrl(f.file_path)} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={fileUrl(f.file_path)}
                            alt={f.file_name}
                            className="w-full h-40 object-cover bg-gray-100"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <div className="h-40 bg-gray-50 flex items-center justify-center">
                          <Paperclip className="w-10 h-10 text-gray-300" />
                        </div>
                      )}
                      <div className="p-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[#1A1A2E] truncate flex-1" title={f.file_name}>
                          {f.file_name}
                        </p>
                        <a
                          href={fileUrl(f.file_path)}
                          download={f.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                          title="Descargar"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Approval Section */}
      {!!task.requires_client_approval && hasPermission('can_approve_tasks') && (
        <div className={`rounded-2xl border p-6 ${
          task.client_approval_status === 'pending' ? 'bg-amber-50 border-amber-200' :
          task.client_approval_status === 'approved' ? 'bg-green-50 border-green-200' :
          task.client_approval_status === 'rejected' ? 'bg-red-50 border-red-200' :
          'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              task.client_approval_status === 'pending' ? 'bg-amber-100' :
              task.client_approval_status === 'approved' ? 'bg-green-100' :
              task.client_approval_status === 'rejected' ? 'bg-red-100' :
              'bg-orange-100'
            }`}>
              <ApprovalIcon className={`w-6 h-6 ${
                task.client_approval_status === 'pending' ? 'text-amber-600' :
                task.client_approval_status === 'approved' ? 'text-green-600' :
                task.client_approval_status === 'rejected' ? 'text-red-600' :
                'text-orange-600'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${
                task.client_approval_status === 'pending' ? 'text-amber-800' :
                task.client_approval_status === 'approved' ? 'text-green-800' :
                task.client_approval_status === 'rejected' ? 'text-red-800' :
                'text-orange-800'
              }`}>
                {approvalInfo.label}
              </h3>
              <p className={`text-sm mt-1 ${
                task.client_approval_status === 'pending' ? 'text-amber-700' :
                task.client_approval_status === 'approved' ? 'text-green-700' :
                task.client_approval_status === 'rejected' ? 'text-red-700' :
                'text-orange-700'
              }`}>
                {approvalInfo.desc}
              </p>

              {task.client_approval_notes && (
                <div className="mt-3 p-3 bg-white/50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Tus notas:</span> {task.client_approval_notes}
                  </p>
                </div>
              )}

              {task.client_approval_status === 'pending' && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleApproval('approved')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                             hover:bg-green-700 transition-colors font-medium"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleApproval('changes_requested')}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg
                             hover:bg-orange-600 transition-colors font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Solicitar Cambios
                  </button>
                  <button
                    onClick={() => handleApproval('rejected')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg
                             hover:bg-red-600 transition-colors font-medium"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {hasPermission('can_comment_tasks') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-[#1A1A2E]">Comentarios</h2>
            <span className="text-sm text-gray-500">({comments.length})</span>
          </div>

          {/* Comments List */}
          <div className="divide-y divide-gray-100">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      comment.is_client_comment ? 'bg-gray-100 text-[#1A1A2E]' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {(comment.author_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1A1A2E]">{comment.author_name}</span>
                        {comment.is_client_comment && (
                          <span className="text-xs bg-gray-100 text-[#1A1A2E] px-2 py-0.5 rounded-full">
                            Cliente
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString('es-CO', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">{comment.comment}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No hay comentarios aún. ¡Sé el primero en comentar!
              </div>
            )}
          </div>

          {/* Add Comment */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <form onSubmit={handleAddComment} className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-gray-800
                         disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#1A1A2E] mb-2">
              {approvalAction === 'approved' ? 'Aprobar Tarea' :
               approvalAction === 'rejected' ? 'Rechazar Tarea' :
               'Solicitar Cambios'}
            </h3>
            <p className="text-gray-500 mb-4">
              {approvalAction === 'approved'
                ? 'Confirma que apruebas esta tarea.'
                : approvalAction === 'rejected'
                ? 'Indica el motivo del rechazo.'
                : 'Describe los cambios que necesitas.'}
            </p>

            {/* Staged changes — only when action is changes_requested and there are some */}
            {approvalAction === 'changes_requested' && stagedChanges.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Cambios solicitados ({stagedChanges.length})
                </p>
                <ol className="space-y-2">
                  {stagedChanges.map((change, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl"
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="flex-1 text-sm text-gray-700 whitespace-pre-line">{change}</p>
                      <button
                        type="button"
                        onClick={() => removeStagedChange(i)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder={
                approvalAction === 'approved'
                  ? 'Notas adicionales (opcional)...'
                  : approvalAction === 'changes_requested'
                  ? (stagedChanges.length > 0
                      ? `Describe el cambio #${stagedChanges.length + 1}...`
                      : 'Describe el motivo o los cambios necesarios...')
                  : 'Describe el motivo o los cambios necesarios...'
              }
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                       focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                       resize-none"
            />

            {/* Action buttons */}
            <div className="flex flex-col gap-2 mt-4">
              {approvalAction === 'changes_requested' && (
                <button
                  onClick={stageAnotherChange}
                  disabled={submitting || !approvalNotes.trim()}
                  className="w-full px-4 py-2.5 border border-orange-300 text-orange-700 rounded-xl
                           hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors font-medium inline-flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Agregar este cambio y escribir otro
                </button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={closeApprovalModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl
                           hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitApproval}
                  disabled={
                    submitting ||
                    (approvalAction === 'rejected' && !approvalNotes.trim()) ||
                    (approvalAction === 'changes_requested' && stagedChanges.length === 0 && !approvalNotes.trim())
                  }
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    approvalAction === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                    approvalAction === 'rejected' ? 'bg-red-500 hover:bg-red-600' :
                    'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {submitting ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
