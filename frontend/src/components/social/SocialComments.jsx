import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Heart,
  Send,
  EyeOff,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  User,
  Clock,
  ThumbsUp,
  MoreHorizontal,
} from 'lucide-react';
import { zernioAPI } from '../../utils/api';

const SocialComments = ({ account }) => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (account?.id) {
      fetchCommentedPosts();
    }
  }, [account?.id]);

  const fetchCommentedPosts = async () => {
    setLoading(true);
    try {
      const res = await zernioAPI.getCommentedPosts({
        accountId: account.id,
        sortBy: 'recent',
        limit: 20,
      });
      setPosts(res.data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (post) => {
    setLoadingComments(true);
    setSelectedPost(post);
    try {
      const res = await zernioAPI.getPostComments(post.id, account.id);
      setComments(res.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleReply = async (commentId) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await zernioAPI.replyToComment(commentId, account.id, replyText);
      setReplyText('');
      setReplyingTo(null);
      // Refresh comments
      fetchComments(selectedPost);
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  const handleLike = async (commentId) => {
    setActionLoading(commentId);
    try {
      await zernioAPI.likeComment(commentId, account.id);
      // Update local state
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, isLiked: !c.isLiked } : c
      ));
    } catch (error) {
      console.error('Error liking comment:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHide = async (commentId) => {
    if (!window.confirm('¿Ocultar este comentario?')) return;
    setActionLoading(commentId);
    try {
      await zernioAPI.hideComment(commentId, account.id);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Error hiding comment:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('¿Eliminar este comentario permanentemente?')) return;
    setActionLoading(commentId);
    try {
      await zernioAPI.deleteComment(commentId, account.id);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now - then) / 1000);

    if (diff < 60) return 'ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return then.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  if (!account) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona una cuenta</h3>
        <p className="text-gray-500">
          Elige una cuenta para ver y responder comentarios
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Show comment thread view
  if (selectedPost) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => {
            setSelectedPost(null);
            setComments([]);
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Volver a publicaciones</span>
        </button>

        {/* Post preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex gap-4">
            {selectedPost.thumbnailUrl && (
              <img
                src={selectedPost.thumbnailUrl}
                alt=""
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 line-clamp-2">{selectedPost.caption || selectedPost.content}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  {selectedPost.likes?.toLocaleString() || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  {selectedPost.comments?.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Comments list */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">
              Comentarios ({comments.length})
            </h3>
          </div>

          {loadingComments ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay comentarios en esta publicacion
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {comments.map((comment) => (
                <div key={comment.id} className="p-4 hover:bg-gray-50">
                  <div className="flex gap-3">
                    {/* Avatar */}
                    {comment.authorAvatar ? (
                      <img
                        src={comment.authorAvatar}
                        alt={comment.authorName}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">
                          {comment.authorName || comment.authorUsername}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(comment.createdAt || comment.timestamp)}
                        </span>
                      </div>

                      {/* Comment text */}
                      <p className="text-sm text-gray-700 mb-2">{comment.text || comment.message}</p>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleLike(comment.id)}
                          disabled={actionLoading === comment.id}
                          className={`flex items-center gap-1 text-xs ${
                            comment.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          {comment.likes || 0}
                        </button>

                        <button
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-500"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Responder
                        </button>

                        <button
                          onClick={() => handleHide(comment.id)}
                          disabled={actionLoading === comment.id}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-500"
                        >
                          <EyeOff className="w-4 h-4" />
                          Ocultar
                        </button>

                        <button
                          onClick={() => handleDelete(comment.id)}
                          disabled={actionLoading === comment.id}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>

                      {/* Reply input */}
                      {replyingTo === comment.id && (
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleReply(comment.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleReply(comment.id)}
                            disabled={!replyText.trim() || sending}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {sending ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Nested replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-3">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex gap-2">
                              {reply.authorAvatar ? (
                                <img
                                  src={reply.authorAvatar}
                                  alt={reply.authorName}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-gray-900 text-sm">
                                  {reply.authorName}
                                </span>
                                <span className="text-xs text-gray-400 ml-2">
                                  {formatTimeAgo(reply.createdAt)}
                                </span>
                                <p className="text-sm text-gray-700">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Posts list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Publicaciones con Comentarios
        </h2>
        <button
          onClick={fetchCommentedPosts}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin comentarios</h3>
          <p className="text-gray-500">
            No hay publicaciones con comentarios recientes
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => fetchComments(post)}
              className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 text-left transition-colors"
            >
              {/* Thumbnail */}
              {post.thumbnailUrl ? (
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6 text-gray-400" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 line-clamp-2 mb-2">
                  {post.caption || post.content || 'Sin descripcion'}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {post.likes?.toLocaleString() || 0}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-blue-600">
                    <MessageCircle className="w-4 h-4" />
                    {post.comments?.toLocaleString() || post.commentCount?.toLocaleString() || 0}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(post.createdAt || post.publishedAt)}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SocialComments;
