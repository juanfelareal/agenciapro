import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Calendar,
  Clock,
  Send,
  Edit3,
  Trash2,
  RefreshCw,
  Image,
  Video,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { zernioAPI } from '../../utils/api';

const STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'draft', label: 'Borradores' },
  { id: 'scheduled', label: 'Programados' },
  { id: 'published', label: 'Publicados' },
  { id: 'failed', label: 'Fallidos' },
];

const SocialPosts = ({ account }) => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    if (account?.id) {
      fetchPosts();
    }
  }, [account?.id, filter]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = { accountId: account.id, limit: 50 };
      if (filter !== 'all') params.status = filter;

      const res = await zernioAPI.getPosts(params);
      setPosts(res.data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('¿Eliminar esta publicacion?')) return;
    try {
      await zernioAPI.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handlePublishNow = async (postId) => {
    if (!window.confirm('¿Publicar ahora?')) return;
    try {
      await zernioAPI.publishPostNow(postId);
      fetchPosts();
    } catch (error) {
      console.error('Error publishing post:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      published: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };

    const labels = {
      draft: 'Borrador',
      scheduled: 'Programado',
      published: 'Publicado',
      failed: 'Fallido',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!account) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona una cuenta</h3>
        <p className="text-gray-500">
          Elige una cuenta para gestionar sus publicaciones
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Publicaciones
        </h2>
        <button
          onClick={() => setShowComposer(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva Publicacion
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={fetchPosts}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg ml-auto"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin publicaciones</h3>
          <p className="text-gray-500 mb-4">
            {filter === 'all'
              ? 'No hay publicaciones aun'
              : `No hay publicaciones con estado "${STATUS_FILTERS.find(f => f.id === filter)?.label}"`}
          </p>
          <button
            onClick={() => setShowComposer(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Crear primera publicacion
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Media preview */}
              {post.mediaItems && post.mediaItems.length > 0 ? (
                <div className="aspect-square bg-gray-100 relative">
                  {post.mediaItems[0].type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <Video className="w-12 h-12 text-white" />
                    </div>
                  ) : (
                    <img
                      src={post.mediaItems[0].url || post.mediaItems[0].thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                  {post.mediaItems.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      +{post.mediaItems.length - 1}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-gray-50 flex items-center justify-center">
                  <FileText className="w-12 h-12 text-gray-300" />
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                {/* Status & Date */}
                <div className="flex items-center justify-between mb-2">
                  {getStatusBadge(post.status)}
                  <span className="text-xs text-gray-500">
                    {formatDate(post.scheduledFor || post.publishedAt || post.createdAt)}
                  </span>
                </div>

                {/* Caption */}
                <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                  {post.content || post.caption || 'Sin descripcion'}
                </p>

                {/* Metrics (for published posts) */}
                {post.status === 'published' && (
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {post.likes?.toLocaleString() || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {post.comments?.toLocaleString() || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {post.reach?.toLocaleString() || 0}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  {post.status === 'draft' && (
                    <>
                      <button
                        onClick={() => setSelectedPost(post)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit3 className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Send className="w-4 h-4" />
                        Publicar
                      </button>
                    </>
                  )}
                  {post.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => setSelectedPost(post)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        <Calendar className="w-4 h-4" />
                        Reprogramar
                      </button>
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Send className="w-4 h-4" />
                        Publicar ahora
                      </button>
                    </>
                  )}
                  {post.status === 'published' && (
                    <button
                      onClick={() => setSelectedPost(post)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                      Ver detalles
                    </button>
                  )}
                  {post.status === 'failed' && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reintentar
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Composer Modal */}
      {showComposer && (
        <PostComposer
          account={account}
          onClose={() => setShowComposer(false)}
          onSuccess={() => {
            setShowComposer(false);
            fetchPosts();
          }}
        />
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdate={fetchPosts}
        />
      )}
    </div>
  );
};

// Post Composer Component
const PostComposer = ({ account, onClose, onSuccess }) => {
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [scheduledFor, setScheduledFor] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const postData = {
        content,
        platforms: [{ platform: account.platform, accountId: account.id }],
        isDraft,
      };

      if (mediaUrl) {
        postData.mediaItems = [{ type: mediaType, url: mediaUrl }];
      }

      if (scheduledFor && !isDraft) {
        postData.scheduledFor = new Date(scheduledFor).toISOString();
      } else if (!isDraft) {
        postData.publishNow = true;
      }

      await zernioAPI.createPost(postData);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Nueva Publicacion</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contenido
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu publicacion..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {content.length} caracteres
            </p>
          </div>

          {/* Media URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de Media (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="image">Imagen</option>
                <option value="video">Video</option>
              </select>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Programar para (opcional)
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          {/* Save as draft */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDraft}
              onChange={(e) => setIsDraft(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Guardar como borrador</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isDraft ? (
                <>
                  <FileText className="w-4 h-4" />
                  Guardar borrador
                </>
              ) : scheduledFor ? (
                <>
                  <Calendar className="w-4 h-4" />
                  Programar
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Publicar ahora
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Post Detail Component
const PostDetail = ({ post, onClose, onUpdate }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Detalle de Publicacion</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Media */}
          {post.mediaItems && post.mediaItems.length > 0 && (
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              {post.mediaItems[0].type === 'video' ? (
                <video
                  src={post.mediaItems[0].url}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={post.mediaItems[0].url}
                  alt=""
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          )}

          {/* Content */}
          <div>
            <p className="text-gray-900 whitespace-pre-wrap">{post.content || post.caption}</p>
          </div>

          {/* Metrics */}
          {post.status === 'published' && (
            <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{post.likes?.toLocaleString() || 0}</p>
                <p className="text-sm text-gray-500">Likes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{post.comments?.toLocaleString() || 0}</p>
                <p className="text-sm text-gray-500">Comentarios</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{post.shares?.toLocaleString() || 0}</p>
                <p className="text-sm text-gray-500">Compartidos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{post.reach?.toLocaleString() || 0}</p>
                <p className="text-sm text-gray-500">Alcance</p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Estado:</strong> {post.status}</p>
            {post.scheduledFor && <p><strong>Programado para:</strong> {new Date(post.scheduledFor).toLocaleString()}</p>}
            {post.publishedAt && <p><strong>Publicado:</strong> {new Date(post.publishedAt).toLocaleString()}</p>}
            {post.createdAt && <p><strong>Creado:</strong> {new Date(post.createdAt).toLocaleString()}</p>}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocialPosts;
