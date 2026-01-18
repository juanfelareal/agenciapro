import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  UsersRound,
  FileText,
  CreditCard,
  Percent,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Zap,
  BarChart3,
  StickyNote,
  TrendingUp,
  BookOpen,
  Copy,
  Clock,
  Timer,
  Link2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import TimeTracker from './TimeTracker';

// Orbit Logo Component
const OrbitLogoIcon = ({ size = 40 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="20" cy="20" r="16" stroke="#1A1A1A" strokeWidth="1.5" strokeOpacity="0.2" fill="none" />
    <ellipse cx="20" cy="20" rx="12" ry="16" transform="rotate(-30 20 20)" stroke="#1A1A1A" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
    <ellipse cx="20" cy="20" rx="8" ry="14" transform="rotate(30 20 20)" stroke="#22C55E" strokeWidth="2" fill="none" />
    <circle cx="20" cy="20" r="4" fill="#1A1A1A" />
    <circle cx="32" cy="14" r="2.5" fill="#22C55E" />
  </svg>
);

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const allNavigation = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Métricas', path: '/metricas', icon: TrendingUp, permission: 'metricas' },
    { name: 'Clientes', path: '/clients', icon: Users, permission: 'clients' },
    { name: 'Proyectos', path: '/projects', icon: FolderKanban, permission: 'projects' },
    { name: 'Plantillas', path: '/plantillas-proyecto', icon: Copy, permission: 'plantillas' },
    { name: 'Tareas', path: '/tasks', icon: CheckSquare, permission: 'tasks' },
    { name: 'Calendario', path: '/calendario', icon: CalendarDays, permission: 'calendario' },
    { name: 'Timesheet', path: '/timesheet', icon: Clock, permission: 'timesheet' },
    { name: 'Rep. Tiempo', path: '/time-reports', icon: Timer, permission: 'time_reports' },
    { name: 'Equipo', path: '/team', icon: UsersRound, permission: 'team' },
    { name: 'Facturas', path: '/invoices', icon: FileText, permission: 'invoices' },
    { name: 'Gastos', path: '/expenses', icon: CreditCard, permission: 'expenses' },
    { name: 'Comisiones', path: '/comisiones', icon: Percent, permission: 'comisiones' },
    { name: 'Automatizaciones', path: '/automatizaciones', icon: Zap, permission: 'automatizaciones' },
    { name: 'Reportes', path: '/reportes', icon: BarChart3, permission: 'reportes' },
    { name: 'Bloc de Notas', path: '/notas', icon: StickyNote, permission: 'notas' },
    { name: 'SOPs', path: '/sops', icon: BookOpen, permission: 'sops' },
    { name: 'Siigo', path: '/siigo', icon: Link2, permission: 'siigo' },
  ];

  // Filter navigation based on permissions
  const navigation = allNavigation.filter((item) => hasPermission(item.permission));

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Get current page info for header
  const currentPage = allNavigation.find((item) => isActive(item.path)) || allNavigation[0];

  // Get user initials for avatar
  const getUserInitials = (name) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-gradient-warm">
      {/* Sidebar - Glassmorphism */}
      <div
        className={`fixed left-0 top-0 h-full flex flex-col z-40 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[220px]'
        }`}
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center px-4" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
          <OrbitLogoIcon size={40} />
          {!sidebarCollapsed && (
            <div className="ml-3 overflow-hidden">
              <h1 className="text-lg font-semibold tracking-tight text-ink-900 truncate">Orbit</h1>
            </div>
          )}
        </div>

        {/* User Info */}
        {!sidebarCollapsed && user && (
          <div className="p-3" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #404040 100%)' }}
              >
                {getUserInitials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900 truncate">{user.name}</p>
                <p className="text-xs text-ink-500 truncate">{user.position || user.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'text-white'
                      : 'text-ink-500 hover:text-ink-900'
                  }`}
                  style={active ? {
                    background: '#1A1A1A',
                    boxShadow: '0 2px 8px rgba(26, 26, 26, 0.15)'
                  } : {}}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.name}</span>}

                  {/* Tooltip for collapsed state */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-ink-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 space-y-1" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.06)' }}>
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-500 hover:text-red-600 transition-all duration-150"
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title={sidebarCollapsed ? 'Cerrar Sesión' : ''}
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Cerrar Sesión</span>}
          </button>

          {/* Collapse Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-ink-500 hover:text-ink-900 transition-all duration-150"
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <>
                <ChevronLeft size={20} />
                <span>Colapsar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[220px]'
        }`}
      >
        {/* Top Header Bar - Glassmorphism */}
        <header
          className="sticky top-0 z-30 h-16 px-6 flex items-center justify-between"
          style={{
            background: 'rgba(255, 253, 249, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
          }}
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink-900">{currentPage?.name || 'Dashboard'}</h2>
            <p className="text-xs text-ink-500">
              {user?.position || (user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Manager' : 'Miembro')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <TimeTracker />
            <GlobalSearch />
            <NotificationBell />

            {/* User Avatar */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-ink-900">
                  {user?.name || 'Usuario'}
                </p>
                <p className="text-xs text-ink-500">
                  {user?.role === 'admin'
                    ? 'Administrador'
                    : user?.role === 'manager'
                    ? 'Manager'
                    : 'Miembro'}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #1A1A1A 0%, #404040 100%)',
                  boxShadow: '0 2px 8px rgba(26, 26, 26, 0.15)'
                }}
              >
                {getUserInitials(user?.name || 'U')}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="page-container animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
