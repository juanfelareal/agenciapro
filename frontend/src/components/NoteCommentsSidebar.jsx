import { useState } from 'react';
import {
  MessageSquare,
  Send,
  Check,
  RotateCcw,
  X,
  User,
  Clock,
  Reply,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

/**
 * NoteCommentsSidebar - Google Docs style comment sidebar with replies
 */
const NoteCommentsSidebar = ({
  comments = [],
  onAddComment,
  onResolveComment,
  onUnresolveComment,
  onReplyComment,
  selectedText = null,
  authorName = '',
  onAuthorNameChange,
  isPublicView = false,
  isTeamMember = false,
  allowComments = true,
}) => {
  const [newComment, setNewComment] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [expandedReplies, setExpandedReplies] = useState({});

  // Organize comments into threads (parent comments with their replies)
  const organizeComments = (allComments) => {
    const parentComments = allComments.filter(c => !c.parent_id);
    const replies = allComments.filter(c => c.parent_id);

    return parentComments.map(parent => ({
      ...parent,
      replies: replies.filter(r => r.parent_id === parent.id).sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      )
    }));
  };

  const threads = organizeComments(comments);
  const unresolvedThreads = threads.filter(c => !c.is_resolved);
  const resolvedThreads = threads.filter(c => c.is_resolved);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (isPublicView && !authorName.trim()) return;

    onAddComment({
      content: newComment,
      author_name: isPublicView ? authorName : undefined,
      selection_from: selectedText?.from,
      selection_to: selectedText?.to,
      quoted_text: selectedText?.text,
    });

    setNewComment('');
  };

  const handleReplySubmit = (parentId) => {
    if (!replyContent.trim()) return;
    if (isPublicView && !authorName.trim()) return;

    if (onReplyComment) {
      onReplyComment({
        parent_id: parentId,
        content: replyContent,
        author_name: isPublicView ? authorName : undefined,
      });
    } else if (onAddComment) {
      // Fallback: use onAddComment with parent_id
      onAddComment({
        parent_id: parentId,
        content: replyContent,
        author_name: isPublicView ? authorName : undefined,
      });
    }

    setReplyContent('');
    setReplyingTo(null);
  };

  const toggleReplies = (commentId) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const SingleComment = ({ comment, isReply = false }) => (
    <div className={`${isReply ? 'ml-6 pl-3 border-l-2 border-slate-200' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`${isReply ? 'w-5 h-5' : 'w-6 h-6'} rounded-full bg-slate-200 flex items-center justify-center`}>
            <User size={isReply ? 12 : 14} className="text-slate-500" />
          </div>
          <span className={`${isReply ? 'text-xs' : 'text-sm'} font-medium text-slate-700`}>
            {comment.author_name}
          </span>
          {comment.author_type === 'client' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              Cliente
            </span>
          )}
          {comment.author_type === 'team' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">
              Equipo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock size={10} />
          {formatTime(comment.created_at)}
        </div>
      </div>

      <p className={`${isReply ? 'text-xs' : 'text-sm'} text-slate-600 whitespace-pre-wrap`}>
        {comment.content}
      </p>
    </div>
  );

  const CommentCard = ({ comment }) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies[comment.id] !== false; // Default to expanded

    return (
      <div
        className={`p-3 rounded-lg border transition-all ${
          comment.is_resolved
            ? 'bg-slate-50 border-slate-200 opacity-60'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Main comment */}
        <SingleComment comment={comment} />

        {/* Quoted text */}
        {comment.quoted_text && (
          <div className="mt-2 pl-2 border-l-2 border-amber-400 bg-amber-50 py-1 px-2 rounded-r text-xs text-slate-600 italic">
            "{comment.quoted_text.length > 100
              ? comment.quoted_text.substring(0, 100) + '...'
              : comment.quoted_text}"
          </div>
        )}

        {/* Replies section */}
        {hasReplies && (
          <div className="mt-3">
            <button
              onClick={() => toggleReplies(comment.id)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-2"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {comment.replies.length} {comment.replies.length === 1 ? 'respuesta' : 'respuestas'}
            </button>

            {isExpanded && (
              <div className="space-y-2">
                {comment.replies.map((reply) => (
                  <SingleComment key={reply.id} comment={reply} isReply />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reply form */}
        {replyingTo === comment.id ? (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {isPublicView && !authorName && (
              <input
                type="text"
                value={authorName}
                onChange={(e) => onAuthorNameChange?.(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-2 py-1.5 mb-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Escribe tu respuesta..."
                className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReplySubmit(comment.id);
                  }
                }}
              />
              <button
                onClick={() => handleReplySubmit(comment.id)}
                disabled={!replyContent.trim() || (isPublicView && !authorName.trim())}
                className="px-2 py-1.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2a2a3e] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={12} />
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
                className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          /* Actions */
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
            {allowComments && (
              <button
                onClick={() => setReplyingTo(comment.id)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <Reply size={12} />
                Responder
              </button>
            )}

            {isTeamMember && !isPublicView && (
              <>
                {comment.is_resolved ? (
                  <button
                    onClick={() => onUnresolveComment?.(comment.id)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 ml-auto"
                  >
                    <RotateCcw size={12} />
                    Reabrir
                  </button>
                ) : (
                  <button
                    onClick={() => onResolveComment?.(comment.id)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 ml-auto"
                  >
                    <Check size={12} />
                    Resolver
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {comment.resolved_by_name && (
          <p className="text-xs text-slate-400 mt-1">
            Resuelto por {comment.resolved_by_name}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-800">Comentarios</h3>
          {unresolvedThreads.length > 0 && (
            <span className="ml-auto text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              {unresolvedThreads.length} pendientes
            </span>
          )}
        </div>
      </div>

      {/* Comment form */}
      {allowComments && (
        <div className="p-4 border-b border-slate-200 bg-white">
          {isPublicView && (
            <input
              type="text"
              value={authorName}
              onChange={(e) => onAuthorNameChange?.(e.target.value)}
              placeholder="Tu nombre"
              className="w-full px-3 py-2 mb-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}

          {selectedText && (
            <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium mb-1">Comentando sobre:</p>
              <p className="text-xs text-slate-600 italic line-clamp-2">
                "{selectedText.text}"
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={selectedText ? "Escribe tu comentario..." : "Selecciona texto para comentar..."}
              rows={2}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || (isPublicView && !authorName.trim())}
              className="px-3 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2a2a3e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {unresolvedThreads.length === 0 && resolvedThreads.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay comentarios aún</p>
            {allowComments && (
              <p className="text-xs mt-1">Selecciona texto y agrega un comentario</p>
            )}
          </div>
        )}

        {/* Unresolved comments */}
        {unresolvedThreads.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}

        {/* Toggle for resolved */}
        {resolvedThreads.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
          >
            {showResolved ? (
              <>
                <X size={12} />
                Ocultar resueltos ({resolvedThreads.length})
              </>
            ) : (
              <>
                <Check size={12} />
                Mostrar resueltos ({resolvedThreads.length})
              </>
            )}
          </button>
        )}

        {/* Resolved comments */}
        {showResolved && resolvedThreads.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
};

export default NoteCommentsSidebar;
