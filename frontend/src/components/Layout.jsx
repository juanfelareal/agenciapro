import { useState, useEffect } from 'react';
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
  ChevronDown,
  BarChart3,
  StickyNote,
  BookOpen,
  Copy,
  Clock,
  Link2,
  LogOut,
  Wallet,
  Settings,
  Target,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import TimeTracker from './TimeTracker';
import OrgSwitcher from './OrgSwitcher';
import OrbitLogo from './OrbitLogo';


const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, currentOrg, hasPermission, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [finanzasExpanded, setFinanzasExpanded] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Items principales (sin submenú)
  const mainNavigation = [
    { name: 'Dashboard', path: '/app', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Clientes', path: '/app/clients', icon: Users, permission: 'clients' },
    { name: 'CRM', path: '/app/crm', icon: Target, permission: 'crm' },
    { name: 'Proyectos', path: '/app/projects', icon: FolderKanban, permission: 'projects' },
    { name: 'Plantillas', path: '/app/plantillas-proyecto', icon: Copy, permission: 'plantillas' },
    { name: 'Tareas', path: '/app/tasks', icon: CheckSquare, permission: 'tasks' },
    { name: 'Timesheet', path: '/app/timesheet', icon: Clock, permission: 'timesheet' },
  ];

  // Submenú de Finanzas
  const finanzasSubItems = [
    { name: 'Facturas', path: '/app/invoices', icon: FileText, permission: 'invoices' },
    { name: 'Gastos', path: '/app/expenses', icon: CreditCard, permission: 'expenses' },
    { name: 'Comisiones', path: '/app/comisiones', icon: Percent, permission: 'comisiones' },
    { name: 'Siigo', path: '/app/siigo', icon: Link2, permission: 'siigo' },
  ];

  // Items después de Finanzas
  const bottomNavigation = [
    { name: 'Métricas', path: '/app/metricas', icon: BarChart3, permission: 'metricas' },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart3, permission: 'reportes' },
    { name: 'Bloc de Notas', path: '/app/notas', icon: StickyNote, permission: 'notas' },
    { name: 'Formularios', path: '/app/formularios', icon: ClipboardList, permission: 'formularios' },
    { name: 'SOPs', path: '/app/sops', icon: BookOpen, permission: 'sops' },
    { name: 'Equipo', path: '/app/team', icon: UsersRound, permission: 'team' },
  ];

  // Filtrar por permisos
  const filteredMain = mainNavigation.filter((item) => hasPermission(item.permission));
  const filteredFinanzas = finanzasSubItems.filter((item) => hasPermission(item.permission));
  const filteredBottom = bottomNavigation.filter((item) => hasPermission(item.permission));

  const isActive = (path) => {
    if (path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/';
    }
    return location.pathname.startsWith(path);
  };

  // Verificar si algún item de Finanzas está activo
  const isFinanzasActive = finanzasSubItems.some((item) => isActive(item.path));

  // Auto-expandir Finanzas si alguna subpágina está activa
  useEffect(() => {
    if (isFinanzasActive) {
      setFinanzasExpanded(true);
    }
  }, [location.pathname]);

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

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-[#1A1A2E] text-[#BFFF00]'
            : 'text-gray-500 hover:text-[#1A1A2E] hover:bg-gray-100'
        }`}
        title={sidebarCollapsed ? item.name : ''}
      >
        <Icon size={20} className="flex-shrink-0" />
        {!sidebarCollapsed && <span className="truncate">{item.name}</span>}

        {/* Tooltip for collapsed state */}
        {sidebarCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-[#1A1A2E] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
            {item.name}
          </div>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA]">
      {/* Sidebar - Clean white */}
      <div
        className={`fixed left-0 top-0 h-full flex flex-col z-40 transition-all duration-300 ease-in-out bg-white border-r border-gray-100 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[220px]'
        }`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center px-3 border-b border-gray-100">
          {currentOrg?.logo_url ? (
            <img
              src={currentOrg.logo_url}
              alt={currentOrg.name || 'Logo'}
              className={sidebarCollapsed ? 'w-10 h-10 object-contain rounded-lg' : 'h-10 max-w-full object-contain object-left'}
            />
          ) : (
            <OrbitLogo size={sidebarCollapsed ? 32 : 36} showText={!sidebarCollapsed} />
          )}
        </div>

        {/* Organization Switcher */}
        {!sidebarCollapsed && currentOrg && (
          <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
            <OrgSwitcher />
          </div>
        )}

        {/* User Info */}
        {!sidebarCollapsed && user && (
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#BFFF00] font-semibold text-sm flex-shrink-0 bg-[#1A1A2E]"
              >
                {getUserInitials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#1A1A2E] truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.position || user.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          <div className="space-y-1">
            {/* Main navigation items */}
            {filteredMain.map(renderNavItem)}

            {/* Finanzas con submenú */}
            {filteredFinanzas.length > 0 && (
              <div>
                <button
                  onClick={() => setFinanzasExpanded(!finanzasExpanded)}
                  className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isFinanzasActive
                      ? 'bg-[#1A1A2E] text-[#BFFF00]'
                      : 'text-gray-500 hover:text-[#1A1A2E] hover:bg-gray-100'
                  }`}
                  title={sidebarCollapsed ? 'Finanzas' : ''}
                >
                  <Wallet size={20} className="flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="truncate flex-1 text-left">Finanzas</span>
                      <ChevronDown
                        size={16}
                        className={`flex-shrink-0 transition-transform duration-200 ${
                          finanzasExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </>
                  )}

                  {/* Tooltip for collapsed state */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[#1A1A2E] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      Finanzas
                    </div>
                  )}
                </button>

                {/* Submenú */}
                {(finanzasExpanded || sidebarCollapsed) && !sidebarCollapsed && (
                  <div className="mt-1 ml-3 pl-3 border-l border-gray-200 space-y-1">
                    {filteredFinanzas.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                            active
                              ? 'bg-gray-100 text-[#1A1A2E]'
                              : 'text-gray-500 hover:text-[#1A1A2E] hover:bg-gray-50'
                          }`}
                        >
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Popup menú para estado colapsado */}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 top-0 bg-white border border-gray-100 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-2 min-w-[160px]">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Finanzas</div>
                    {filteredFinanzas.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-2 px-3 py-2 text-sm ${
                            active ? 'text-[#1A1A2E] bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Bottom navigation items */}
            {filteredBottom.map(renderNavItem)}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 space-y-1 border-t border-gray-100">
          {/* Settings Link */}
          <Link
            to="/app/settings"
            className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isActive('/app/settings')
                ? 'bg-[#1A1A2E] text-[#BFFF00]'
                : 'text-gray-500 hover:text-[#1A1A2E] hover:bg-gray-100'
            }`}
            title={sidebarCollapsed ? 'Mi Cuenta' : ''}
          >
            <Settings size={20} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>Mi Cuenta</span>}
            {sidebarCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#1A1A2E] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                Mi Cuenta
              </div>
            )}
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150"
            title={sidebarCollapsed ? 'Cerrar Sesión' : ''}
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Cerrar Sesión</span>}
          </button>

          {/* Collapse Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-[#1A1A2E] hover:bg-gray-100 transition-all duration-150"
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
        {/* Top Header Bar - Clean white */}
        <header className="sticky top-0 z-30 h-14 px-6 flex items-center justify-end bg-white border-b border-gray-100">
          <div className="flex items-center gap-4">
            <TimeTracker />
            <GlobalSearch />
            <NotificationBell />

            {/* User Avatar */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-[#1A1A2E]">
                  {user?.name || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'admin'
                    ? 'Administrador'
                    : user?.role === 'manager'
                    ? 'Manager'
                    : 'Miembro'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#BFFF00] font-semibold text-sm bg-[#1A1A2E]">
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
