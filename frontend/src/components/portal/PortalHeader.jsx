import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalNotificationsAPI } from '../../utils/portalApi';
import {
  Building2,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X
} from 'lucide-react';

export default function PortalHeader() {
  const { client, permissions, logout, hasPermission, isAuthenticated } = usePortal();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Fetch notification count
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    try {
      const response = await portalNotificationsAPI.getAll({ unread_only: '1' });
      setNotificationCount(response.unread_count);
      setNotifications(response.notifications.slice(0, 5));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { path: '/portal', icon: LayoutDashboard, label: 'Dashboard', permission: null },
    { path: '/portal/projects', icon: FolderKanban, label: 'Proyectos', permission: 'can_view_projects' },
    { path: '/portal/tasks', icon: CheckSquare, label: 'Tareas', permission: 'can_view_tasks' },
    { path: '/portal/invoices', icon: FileText, label: 'Facturas', permission: 'can_view_invoices' },
    { path: '/portal/metrics', icon: BarChart3, label: 'Métricas', permission: 'can_view_metrics' },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-ink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/portal" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ink-900 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-ink-900">{client?.company || client?.name}</p>
              <p className="text-xs text-ink-500">Portal de Cliente</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg hover:bg-ink-100 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-ink-600" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-ink-100 overflow-hidden">
                  <div className="p-3 border-b border-ink-100">
                    <h3 className="font-semibold text-ink-900">Notificaciones</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-3 border-b border-ink-50 hover:bg-ink-50 ${
                            !notification.is_read ? 'bg-green-50/50' : ''
                          }`}
                        >
                          <p className="text-sm font-medium text-ink-900">{notification.title}</p>
                          <p className="text-xs text-ink-500 mt-1">{notification.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-ink-500 text-sm">
                        No hay notificaciones
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-ink-600 hover:bg-ink-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Salir</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-ink-100"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-ink-600" />
              ) : (
                <Menu className="w-5 h-5 text-ink-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-ink-100">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-ink-900 text-white'
                      : 'text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg mt-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
