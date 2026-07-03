import { useEffect, useState, useMemo } from 'react';
import {
  notificationsAPI,
  getNotificationMeta,
  NOTIFICATION_CATEGORIES,
} from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Inbox = () => {
  const [notifications, setNotifications] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({
    client_action: 0, task: 0, comment: 0, finance: 0, system: 0
  });
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('client_action');
  const [showRead, setShowRead] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    loadAll();
  }, [user?.id, activeCategory, showRead]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Counts always for all categories
      const countsPromise = notificationsAPI.getCategoryCounts(user.id);
      const params = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      if (!showRead) params.unread_only = true;

      const [notifRes, countsRes] = await Promise.all([
        notificationsAPI.getByUser(user.id, params),
        countsPromise,
      ]);

      setNotifications(notifRes.data || []);
      if (countsRes.data?.counts) setCategoryCounts(countsRes.data.counts);
      if (typeof countsRes.data?.total === 'number') setTotalUnread(countsRes.data.total);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      loadAll();
    } catch (err) { console.error(err); }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await notificationsAPI.markAllAsRead(user.id);
      loadAll();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsAPI.delete(id);
      loadAll();
    } catch (err) { console.error(err); }
  };

  const handleOpen = async (n) => {
    if (!n.is_read) await notificationsAPI.markAsRead(n.id);
    // Navigate to the relevant entity
    if (n.related_task_id) navigate(`/app/tasks?task=${n.related_task_id}`);
    else if (n.entity_type === 'chat') navigate(`/app/chat/${n.entity_id}`);
    else if (n.entity_type === 'task') navigate(`/app/tasks`);
    else if (n.entity_type === 'invoice') navigate(`/app/invoices/${n.entity_id}`);
    else if (n.entity_type === 'commission') navigate(`/app/comisiones`);
    else if (n.entity_type === 'form') navigate(`/app/formularios`);
    loadAll();
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Ahora';
    if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
    if (diffSec < 604800) return `Hace ${Math.floor(diffSec / 86400)} d`;
    return date.toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Inject a synthetic "all" count
  const tabs = useMemo(() => {
    return NOTIFICATION_CATEGORIES.map(c => ({
      ...c,
      count: c.id === 'all' ? totalUnread : (categoryCounts[c.id] || 0),
    }));
  }, [categoryCounts, totalUnread]);

  if (!user) {
    return (
      <div className="text-center py-16">
        <Bell size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Selecciona un usuario para ver sus notificaciones</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17181A] flex items-center justify-center">
              <Bell size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#17181A] tracking-tight">Inbox</h1>
              <p className="text-sm text-gray-500">
                {totalUnread > 0
                  ? `${totalUnread} sin leer en total`
                  : 'Estás al día — sin notificaciones pendientes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showRead}
                onChange={(e) => setShowRead(e.target.checked)}
                className="rounded border-gray-300"
              />
              Mostrar leídas
            </label>
            {totalUnread > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-3 py-2 bg-[#17181A] text-white text-sm rounded-lg hover:bg-[#2a2a44] transition-colors"
              >
                <CheckCheck size={16} />
                Marcar todas
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => {
          const isActive = activeCategory === tab.id;
          const highlight = tab.id === 'client_action';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? `border-[#17181A] text-[#17181A]`
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  highlight ? 'bg-pink-500 text-white' : (isActive ? 'bg-[#17181A] text-white' : 'bg-gray-200 text-gray-700')
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Sin notificaciones en esta categoría</p>
          <p className="text-sm text-gray-500">
            {showRead ? 'Aún no hay actividad aquí.' : 'Activa "Mostrar leídas" para ver el historial.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const meta = getNotificationMeta(n.type);
            const isClientAction = meta.category === 'client_action';
            return (
              <div
                key={n.id}
                onClick={() => handleOpen(n)}
                className={`group bg-white rounded-xl border transition-all cursor-pointer hover:border-gray-300 hover:shadow-sm ${
                  !n.is_read
                    ? (isClientAction ? 'border-pink-200 bg-pink-50/30' : 'border-blue-200 bg-blue-50/30')
                    : 'border-gray-100'
                }`}
              >
                <div className="p-4 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${meta.color}`}>
                    {meta.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{n.title}</h3>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.color}`}>
                          {meta.label}
                        </span>
                        {!n.is_read && <span className="w-2 h-2 bg-pink-500 rounded-full flex-shrink-0"></span>}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{formatTimeAgo(n.created_at)}</span>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2">{n.message}</p>

                    <div className="flex items-center gap-3 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.is_read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkAsRead(n.id); }}
                          className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-[#17181A] font-medium"
                        >
                          <Check size={12} />
                          Marcar leída
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        <Trash2 size={12} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Inbox;
