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
  RotateCcw
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
      const response = await portalTasksAPI.addComment(id, { comment: newComment.trim() });
      setComments([...comments, response.comment]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (action) => {
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    setSubmitting(true);
    try {
      await portalTasksAPI.approve(id, {
        action: approvalAction,
        notes: approvalNotes.trim()
      });
      await loadTask();
      setShowApprovalModal(false);
      setApprovalNotes('');
    } catch (error) {
      console.error('Error submitting approval:', error);
    } finally {
      setSubmitting(false);
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
        <Loader2 className="w-8 h-8 text-ink-400 animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-ink-900">Tarea no encontrada</h2>
        <p className="text-ink-500 mt-2 mb-4">Esta tarea no existe o no tienes acceso.</p>
        <Link to="/portal/tasks" className="text-violet-600 hover:underline">
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
        className="inline-flex items-center gap-2 text-ink-500 hover:text-ink-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a tareas</span>
      </Link>

      {/* Task Header */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            task.status === 'done' ? 'bg-green-100' : 'bg-ink-100'
          }`}>
            {task.status === 'done' ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <CheckSquare className="w-6 h-6 text-ink-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-ink-900">{task.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {getStatusBadge(task.status)}
              <span className="text-ink-500 flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4" />
                {task.project_name}
              </span>
            </div>
          </div>
        </div>

        {/* Task Description */}
        {task.description && (
          <div className="mt-6 pt-6 border-t border-ink-100">
            <h3 className="text-sm font-medium text-ink-700 mb-2">Descripción</h3>
            <p className="text-ink-600 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Task Meta */}
        <div className="mt-6 pt-6 border-t border-ink-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {task.assigned_to_name && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-ink-500">Asignado a</p>
                <p className="font-medium text-ink-900">{task.assigned_to_name}</p>
              </div>
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-ink-500">Fecha límite</p>
                <p className="font-medium text-ink-900">
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

      {/* Approval Section */}
      {task.requires_client_approval && hasPermission('can_approve_tasks') && (
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
                  <p className="text-sm text-ink-600">
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
        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-ink-100 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-ink-400" />
            <h2 className="font-semibold text-ink-900">Comentarios</h2>
            <span className="text-sm text-ink-500">({comments.length})</span>
          </div>

          {/* Comments List */}
          <div className="divide-y divide-ink-100">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      comment.is_client_comment ? 'bg-violet-100 text-violet-600' : 'bg-ink-100 text-ink-600'
                    }`}>
                      {(comment.author_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-900">{comment.author_name}</span>
                        {comment.is_client_comment && (
                          <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">
                            Cliente
                          </span>
                        )}
                        <span className="text-xs text-ink-400">
                          {new Date(comment.created_at).toLocaleDateString('es-CO', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-ink-600 mt-1">{comment.comment}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-ink-500">
                No hay comentarios aún. ¡Sé el primero en comentar!
              </div>
            )}
          </div>

          {/* Add Comment */}
          <div className="px-6 py-4 bg-cream-50 border-t border-ink-100">
            <form onSubmit={handleAddComment} className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                className="flex-1 px-4 py-2.5 bg-white border border-ink-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2.5 bg-ink-900 text-white rounded-xl hover:bg-ink-800
                         disabled:bg-ink-300 disabled:cursor-not-allowed transition-colors"
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
            <h3 className="text-xl font-bold text-ink-900 mb-2">
              {approvalAction === 'approved' ? 'Aprobar Tarea' :
               approvalAction === 'rejected' ? 'Rechazar Tarea' :
               'Solicitar Cambios'}
            </h3>
            <p className="text-ink-500 mb-4">
              {approvalAction === 'approved'
                ? 'Confirma que apruebas esta tarea.'
                : approvalAction === 'rejected'
                ? 'Indica el motivo del rechazo.'
                : 'Describe los cambios que necesitas.'}
            </p>

            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder={
                approvalAction === 'approved'
                  ? 'Notas adicionales (opcional)...'
                  : 'Describe el motivo o los cambios necesarios...'
              }
              rows={4}
              className="w-full px-4 py-3 bg-cream-50 border border-ink-200 rounded-xl
                       focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                       resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setApprovalNotes('');
                }}
                className="flex-1 px-4 py-2.5 border border-ink-200 text-ink-700 rounded-xl
                         hover:bg-ink-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={submitApproval}
                disabled={submitting || (approvalAction !== 'approved' && !approvalNotes.trim())}
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
      )}
    </div>
  );
}
