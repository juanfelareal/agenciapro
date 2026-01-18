import { useEffect, useState } from 'react';
import { notificationsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, CheckCheck, X, Trash2, Filter } from 'lucide-react';

const Inbox = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const { user } = useAuth();

  useEffect(() => {
    loadNotifications();
  }, [user, filter]);

  const loadNotifications = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await notificationsAPI.getByUser(
        user.id,
        filter === 'unread'
      );
      let filtered = response.data;

      if (filter === 'read') {
        filtered = response.data.filter(n => n.is_read === 1);
      }

      setNotifications(filtered);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      loadNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await notificationsAPI.markAllAsRead(user.id);
      loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsAPI.delete(id);
      loadNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      task_assigned: '📋',
      comment: '💬',
      mention: '@',
      task_updated: '🔄',
      task_due: '⏰',
      task_completed: '✅'
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type) => {
    const colors = {
      task_assigned: 'bg-blue-100 text-blue-800',
      comment: 'bg-green-100 text-green-800',
      mention: 'bg-purple-100 text-purple-800',
      task_updated: 'bg-yellow-100 text-yellow-800',
      task_due: 'bg-orange-100 text-orange-800',
      task_completed: 'bg-emerald-100 text-emerald-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getNotificationTypeLabel = (type) => {
    const labels = {
      task_assigned: 'Tarea Asignada',
      comment: 'Comentario',
      mention: 'Mención',
      task_updated: 'Actualización',
      task_due: 'Próxima a Vencer',
      task_completed: 'Completada'
    };
    return labels[type] || type;
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Ahora';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    if (diffInSeconds < 604800) return `Hace ${Math.floor(diffInSeconds / 86400)} días`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return (
      <div className="text-center py-16">
        <Bell size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Selecciona un usuario para ver sus notificaciones</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell size={32} className="text-primary-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Inbox</h1>
              <p className="text-gray-600">
                {unreadCount > 0
                  ? `Tienes ${unreadCount} notificación${unreadCount !== 1 ? 'es' : ''} sin leer`
                  : 'No tienes notificaciones sin leer'}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <CheckCheck size={20} />
              Marcar todas como leídas
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas {notifications.length > 0 && `(${notifications.length})`}
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            No leídas {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'read'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Leídas
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-16">
          <p className="text-gray-500">Cargando notificaciones...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <Bell size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg mb-2">
            {filter === 'unread'
              ? 'No tienes notificaciones sin leer'
              : filter === 'read'
              ? 'No tienes notificaciones leídas'
              : 'No tienes notificaciones'}
          </p>
          <p className="text-gray-500 text-sm">
            Las notificaciones aparecerán aquí cuando haya actividad en tus tareas
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow border-l-4 ${
                !notification.is_read
                  ? 'border-primary-500'
                  : 'border-gray-300'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {notification.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getNotificationColor(notification.type)}`}>
                          {getNotificationTypeLabel(notification.type)}
                        </span>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>

                    <p className="text-gray-700 mb-4">
                      {notification.message}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <Check size={16} />
                          Marcar como leída
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inbox;
