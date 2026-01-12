import { useEffect, useState } from 'react';
import { taskCommentsAPI, teamAPI } from '../utils/api';
import { Send, Trash2, Edit, MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TaskComments = ({ taskId, taskTitle }) => {
  const [comments, setComments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(1); // TODO: Get from user context

  useEffect(() => {
    if (taskId) {
      loadComments();
      loadTeamMembers();
    }
  }, [taskId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await taskCommentsAPI.getByTask(taskId);
      setComments(response.data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const response = await teamAPI.getAll({ status: 'active' });
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await taskCommentsAPI.create({
        task_id: taskId,
        user_id: currentUserId,
        comment: newComment.trim(),
      });
      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Error creating comment:', error);
      alert('Error al crear el comentario');
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;

    try {
      await taskCommentsAPI.update(commentId, {
        comment: editText.trim(),
      });
      setEditingComment(null);
      setEditText('');
      await loadComments();
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Error al actualizar el comentario');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('¿Está seguro de eliminar este comentario?')) return;

    try {
      await taskCommentsAPI.delete(commentId);
      await loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Error al eliminar el comentario');
    }
  };

  const startEditing = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.comment);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditText('');
  };

  const getUserInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (userId) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    return colors[userId % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2 text-gray-700">
          <MessageCircle size={20} />
          <h3 className="font-semibold">Comentarios</h3>
          <span className="text-sm text-gray-500">({comments.length})</span>
        </div>
        {taskTitle && (
          <p className="text-sm text-gray-600 mt-1 truncate">{taskTitle}</p>
        )}
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No hay comentarios aún</p>
            <p className="text-sm text-gray-400 mt-1">Sé el primero en comentar</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full ${getAvatarColor(comment.user_id)} flex items-center justify-center text-white font-semibold text-sm`}
              >
                {getUserInitials(comment.user_name)}
              </div>

              {/* Comment Content */}
              <div className="flex-1 min-w-0">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {comment.user_name || 'Usuario Desconocido'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(comment.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                      </p>
                    </div>
                    {comment.user_id === currentUserId && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing(comment)}
                          className="text-gray-400 hover:text-blue-600 p-1"
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editingComment === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        className="w-full border rounded px-2 py-1 text-sm"
                        rows="2"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleEditComment(comment.id)}
                          className="px-3 py-1 bg-primary-500 text-white text-sm rounded hover:bg-primary-600"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {comment.comment}
                    </p>
                  )}
                </div>

                {comment.updated_at !== comment.created_at && (
                  <p className="text-xs text-gray-400 mt-1 ml-3">
                    Editado {format(parseISO(comment.updated_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Comment Form */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmitComment} className="flex gap-2">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full ${getAvatarColor(currentUserId)} flex items-center justify-center text-white font-semibold text-sm`}
          >
            {getUserInitials(teamMembers.find((m) => m.id === currentUserId)?.name || 'Tú')}
          </div>
          <div className="flex-1">
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows="2"
              placeholder="Escribe un comentario..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmitComment(e);
                }
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-400">
                Ctrl + Enter para enviar
              </p>
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <Send size={16} />
                Comentar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskComments;
