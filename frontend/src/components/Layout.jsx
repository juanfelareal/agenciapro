import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageCircle,
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
  Link2,
  LogOut,
  Wallet,
  Settings,
  Target,
  ClipboardList,
  Receipt,
  Bot,
  FileCode2,
  Megaphone,
  Video,
  FileSignature,
  Mail,
  Lightbulb,
  Menu,
  X,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgPlan } from '../hooks/useOrgPlan'; // [modules]
import { PlanChip, TrialBanner, UpgradeToast } from './plan/PlanWidgets'; // [modules]
import { orbitFeedbackAPI, newsAPI, whatsappAPI, tasksAPI } from '../utils/api';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import OrgSwitcher from './OrgSwitcher';
import OrbitLogo from './OrbitLogo';
import { useBranding } from '../branding/useBranding'; // [branding]
import useIsMobile from '../hooks/useIsMobile';
import Tour from './onboarding/Tour';
import { TOUR_MENU_EVENT } from './onboarding/onboardingApi';


const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, currentOrg, hasPermission, logout } = useAuth();
  const { isModuleEnabled, isPlatformAdmin } = useOrgPlan(); // [modules] módulos de la org = capa sobre los permisos
  const brandLogo = useBranding().logo('sidebar'); // [branding] logo claro u oscuro según barra/tema
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Móvil: el sidebar es un drawer (cerrado por defecto) y nunca se muestra colapsado
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsedUI = sidebarCollapsed && !isMobile;
  // [onboarding] El tour abre/cierra el drawer en móvil para enfocar ítems del menú
  useEffect(() => {
    const onTourMenu = (e) => setMobileOpen(!!e.detail?.open);
    window.addEventListener(TOUR_MENU_EVENT, onTourMenu);
    return () => window.removeEventListener(TOUR_MENU_EVENT, onTourMenu);
  }, []);
  const [finanzasExpanded, setFinanzasExpanded] = useState(false);
  // Chat oculto del sidebar — sin polling de no-leídos (módulo en pausa)
  const chatUnreadCount = 0;
  // Mejoras de Orbit: sugerencias en estado "nueva" (badge). Se carga una vez al montar.
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    orbitFeedbackAPI.summary()
      .then((res) => { if (!cancelled) setNewFeedbackCount(res.data?.nueva || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Novedades: no leídas por el usuario actual (badge rojo). Se refresca al montar,
  // cada 60 s, al volver a la pestaña y cuando la página de Novedades dispara
  // el evento `news:unread-changed` (al abrir una novedad o marcar todo como leído).
  // WhatsApp: mensajes entrantes sin leer por el equipo (badge verde). Igual que Novedades:
  // al montar, cada 60 s, al volver a la pestaña y con el evento `whatsapp:unread-changed`.
  const [waUnreadCount, setWaUnreadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      whatsappAPI.unreadCount()
        .then((res) => { if (!cancelled) setWaUnreadCount(res.data?.unread || 0); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onChanged = (e) => {
      if (typeof e?.detail?.unread === 'number') setWaUnreadCount(e.detail.unread);
      else refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('whatsapp:unread-changed', onChanged);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('whatsapp:unread-changed', onChanged);
    };
  }, []);

  // Tareas asignadas sin ver (badge azul). Mismo patrón: montar, 60 s, volver a la pestaña y evento `tasks:alerts-changed`.
  const [taskAlertCount, setTaskAlertCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      tasksAPI.assignedAlerts()
        .then((res) => { if (!cancelled) setTaskAlertCount(res.data?.count || 0); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onChanged = (e) => {
      if (typeof e?.detail?.count === 'number') setTaskAlertCount(e.detail.count);
      else refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('tasks:alerts-changed', onChanged);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('tasks:alerts-changed', onChanged);
    };
  }, []);

  const [newsUnreadCount, setNewsUnreadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      newsAPI.unreadCount()
        .then((res) => { if (!cancelled) setNewsUnreadCount(res.data?.unread || 0); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 60000);
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onChanged = (e) => {
      if (typeof e?.detail?.unread === 'number') setNewsUnreadCount(e.detail.unread);
      else refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('news:unread-changed', onChanged);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('news:unread-changed', onChanged);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Items principales (sin submenú)
  // [modules] `module` = clave del módulo de la organización; si está apagado, el ítem se oculta aunque haya permiso
  const mainNavigation = [
    { name: 'Dashboard', path: '/app', icon: LayoutDashboard, permission: 'dashboard', module: 'dashboard' },
    { name: 'Novedades', path: '/app/novedades', icon: Megaphone, permission: null, badge: 'news', module: 'novedades' },
    { name: 'Clientes', path: '/app/clients', icon: Users, permission: 'clients', module: 'clients' },
    { name: 'CRM', path: '/app/crm', icon: Target, permission: 'crm', module: 'crm' },
    { name: 'Email Marketing', path: '/app/email-marketing', icon: Mail, permission: 'clients', module: 'email_marketing' },
    { name: 'WhatsApp', path: '/app/whatsapp', icon: MessageCircle, permission: 'clients', badge: 'whatsapp', module: 'whatsapp' },
    { name: 'UGC', path: '/app/ugc', icon: Video, permission: 'ugc', module: 'ugc' },
    { name: 'Documentos', path: '/app/documentos', icon: FileSignature, permission: 'documentos', module: 'documentos' },
    { name: 'Proyectos', path: '/app/projects', icon: FolderKanban, permission: 'projects', module: 'projects' },
    { name: 'Plantillas', path: '/app/plantillas-proyecto', icon: Copy, permission: 'plantillas', module: 'plantillas' },
    { name: 'Tareas', path: '/app/tasks', icon: CheckSquare, permission: 'tasks', badge: 'tasks', module: 'tasks' },
    { name: 'Reuniones', path: '/app/reuniones', icon: ClipboardList, permission: 'tasks', module: 'reuniones' },
  ];

  // Submenú de Finanzas
  const finanzasSubItems = [
    { name: 'Dashboard', path: '/app/finanzas-dashboard', icon: BarChart3, permission: 'invoices', module: 'finanzas' },
    { name: 'Facturas', path: '/app/invoices', icon: FileText, permission: 'invoices', module: 'invoices' },
    { name: 'Cartera', path: '/app/cartera', icon: Receipt, permission: 'invoices', module: 'invoices' },
    { name: 'Gastos', path: '/app/expenses', icon: CreditCard, permission: 'expenses', module: 'expenses' },
    { name: 'Comisiones', path: '/app/comisiones', icon: Percent, permission: 'comisiones', module: 'comisiones' },
    { name: 'Siigo', path: '/app/siigo', icon: Link2, permission: 'siigo', module: 'siigo' },
  ];

  // Items después de Finanzas
  const bottomNavigation = [
    { name: 'Métricas', path: '/app/metricas', icon: BarChart3, permission: 'metricas', module: 'metricas' },
    { name: 'Reportes', path: '/app/reportes', icon: BarChart3, permission: 'reportes', module: 'reportes' },
    { name: 'Bloc de Notas', path: '/app/notas', icon: StickyNote, permission: 'notas', module: 'notas' },
    { name: 'Formularios', path: '/app/formularios', icon: ClipboardList, permission: 'formularios', module: 'formularios' },
    { name: 'Anuncios', path: '/app/anuncios', icon: Megaphone, permission: null },
    // Chat interno oculto del sidebar (2026-07-03): ~10 mensajes/mes — el equipo vive en WhatsApp.
    // La ruta /app/chat sigue funcionando por URL directa y los datos quedan intactos.
    { name: 'SOPs', path: '/app/sops', icon: BookOpen, permission: 'sops', module: 'sops' },
    { name: 'Briefs', path: '/app/briefs', icon: FileCode2, permission: null },
    { name: 'Equipo', path: '/app/team', icon: UsersRound, permission: 'team', module: 'team' },
    // [modules] Panel de plataforma: solo platform admins (LA REAL)
    ...(isPlatformAdmin ? [{ name: 'Plataforma', path: '/app/plataforma', icon: Building2, permission: null }] : []),
  ];

  // Filtrar por permisos y por módulos de la organización [modules]
  const visible = (item) => (!item.permission || hasPermission(item.permission)) && (!item.module || isModuleEnabled(item.module));
  const filteredMain = mainNavigation.filter(visible);
  const filteredFinanzas = finanzasSubItems.filter((item) => hasPermission(item.permission) && (!item.module || isModuleEnabled(item.module)));
  const filteredBottom = bottomNavigation.filter(visible);

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
          item.badge === 'news'
            ? (active
              ? 'bg-[var(--accent)] text-white font-semibold'
              : 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--ink)] font-semibold hover:bg-[rgb(var(--accent-rgb)/0.2)]')
            : (active
              ? 'bg-[var(--dark)] text-[var(--accent)]'
              : 'text-gray-500 hover:text-[var(--ink)] hover:bg-[rgb(var(--ink-rgb)/0.04)]')
        }`}
        title={collapsedUI ? item.name : ''}
        data-tour={item.path === '/app' ? 'dashboard' : item.path.replace('/app/', '')} /* [onboarding] */
      >
        <Icon size={20} className="flex-shrink-0" />
        {!collapsedUI && <span className="truncate flex-1">{item.name}</span>}
        {!collapsedUI && item.name === 'Chat' && chatUnreadCount > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
          </span>
        )}
        {collapsedUI && item.name === 'Chat' && chatUnreadCount > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
        )}
        {/* Novedades sin leer: badge rojo (expandido) o punto rojo (colapsado) */}
        {!collapsedUI && item.badge === 'news' && newsUnreadCount > 0 && (
          <span
            className="ml-auto bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
            title={`${newsUnreadCount} sin leer`}
          >
            {newsUnreadCount > 99 ? '99+' : newsUnreadCount}
          </span>
        )}
        {collapsedUI && item.badge === 'news' && newsUnreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 ring-2 ring-[var(--surface)] rounded-full" />
        )}
        {/* WhatsApp sin leer: badge verde (expandido) o punto verde (colapsado) */}
        {!collapsedUI && item.badge === 'whatsapp' && waUnreadCount > 0 && (
          <span
            className="ml-auto bg-emerald-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
            title={`${waUnreadCount} sin leer`}
          >
            {waUnreadCount > 99 ? '99+' : waUnreadCount}
          </span>
        )}
        {collapsedUI && item.badge === 'whatsapp' && waUnreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 ring-2 ring-[var(--surface)] rounded-full" />
        )}
        {/* Tareas asignadas sin ver: badge azul (expandido) o punto azul (colapsado) */}
        {!collapsedUI && item.badge === 'tasks' && taskAlertCount > 0 && (
          <span
            className="ml-auto bg-sky-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
            title={`${taskAlertCount} tarea${taskAlertCount === 1 ? '' : 's'} nueva${taskAlertCount === 1 ? '' : 's'}`}
          >
            {taskAlertCount > 99 ? '99+' : taskAlertCount}
          </span>
        )}
        {collapsedUI && item.badge === 'tasks' && taskAlertCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-sky-500 ring-2 ring-[var(--surface)] rounded-full" />
        )}

        {/* Tooltip for collapsed state */}
        {collapsedUI && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--dark)] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
            {item.name}{item.badge === 'news' && newsUnreadCount > 0 ? ` · ${newsUnreadCount} sin leer` : ''}{item.badge === 'whatsapp' && waUnreadCount > 0 ? ` · ${waUnreadCount} sin leer` : ''}{item.badge === 'tasks' && taskAlertCount > 0 ? ` · ${taskAlertCount} nueva${taskAlertCount === 1 ? '' : 's'}` : ''}
          </div>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen h-[100dvh] app-mist">
      {/* Sidebar — panel de vidrio flotante */}
      {/* Backdrop del drawer en móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <div
        className={`mobile-drawer fixed flex flex-col z-50 md:z-40 transition-all duration-300 ease-in-out glass overflow-hidden
          left-0 top-0 bottom-0 w-[272px] rounded-none md:left-4 md:top-4 md:bottom-4 md:rounded-3xl
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} md:translate-x-0 ${
          collapsedUI ? 'md:w-[72px]' : 'md:w-[220px]'
        }`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center px-3 border-b border-[rgb(var(--ink-rgb)/0.09)]">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden mr-2 p-2 -ml-1 rounded-lg text-gray-500 hover:bg-[rgb(var(--ink-rgb)/0.04)]"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
          {brandLogo ? ( // [branding]
            <img
              src={brandLogo}
              alt={currentOrg.name || 'Logo'}
              className={collapsedUI ? 'w-10 h-10 object-contain rounded-lg' : 'h-10 max-w-full object-contain object-left'}
            />
          ) : (
            <OrbitLogo size={collapsedUI ? 32 : 36} showText={!collapsedUI} />
          )}
        </div>

        {/* Organization Switcher */}
        {!collapsedUI && currentOrg && (
          <div className="px-3 py-2 border-b border-[rgb(var(--ink-rgb)/0.09)]">
            <OrgSwitcher />
          </div>
        )}

        {/* User Info */}
        {!collapsedUI && user && (
          <div className="p-3 border-b border-[rgb(var(--ink-rgb)/0.09)]">
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--accent)] font-semibold text-sm flex-shrink-0 bg-[var(--dark)]"
                >
                  {getUserInitials(user.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--ink)] truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.position || user.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin" onClick={(e) => { if (e.target.closest('a')) setMobileOpen(false); }}>
          <div className="space-y-1">
            {/* Main navigation items */}
            {filteredMain.map(renderNavItem)}

            {/* Finanzas con submenú */}
            {filteredFinanzas.length > 0 && (
              <div>
                <button
                  onClick={() => setFinanzasExpanded(!finanzasExpanded)}
                  data-tour="finanzas"
                  className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isFinanzasActive
                      ? 'bg-[var(--dark)] text-[var(--accent)]'
                      : 'text-gray-500 hover:text-[var(--ink)] hover:bg-[rgb(var(--ink-rgb)/0.04)]'
                  }`}
                  title={collapsedUI ? 'Finanzas' : ''}
                >
                  <Wallet size={20} className="flex-shrink-0" />
                  {!collapsedUI && (
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
                  {collapsedUI && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--dark)] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      Finanzas
                    </div>
                  )}
                </button>

                {/* Submenú */}
                {(finanzasExpanded || collapsedUI) && !collapsedUI && (
                  <div className="mt-1 ml-3 pl-3 border-l border-[rgb(var(--ink-rgb)/0.09)] space-y-1">
                    {filteredFinanzas.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                            active
                              ? 'bg-[rgb(var(--ink-rgb)/0.06)] text-[var(--ink)]'
                              : 'text-gray-500 hover:text-[var(--ink)] hover:bg-[rgb(var(--ink-rgb)/0.04)]'
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
                {collapsedUI && (
                  <div className="absolute left-full ml-2 top-0 glass-solid rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-2 min-w-[160px]">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Finanzas</div>
                    {filteredFinanzas.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center gap-2 px-3 py-2 text-sm ${
                            active ? 'text-[var(--ink)] bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
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

            {/* [modules] Chip de plan: "Prueba · 9 días" o nombre del plan → Suscripción */}
            <div className="pt-2">
              <PlanChip collapsed={collapsedUI} active={isActive('/app/suscripcion')} />
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 space-y-1 border-t border-[rgb(var(--ink-rgb)/0.09)]" onClick={(e) => { if (e.target.closest('a')) setMobileOpen(false); }}>
          {/* Mejoras de Orbit */}
          <Link
            to="/app/mejoras"
            className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isActive('/app/mejoras')
                ? 'bg-[var(--dark)] text-[var(--accent)]'
                : 'text-gray-500 hover:text-[var(--ink)] hover:bg-[rgb(var(--ink-rgb)/0.04)]'
            }`}
            title={collapsedUI ? 'Mejoras de Orbit' : ''}
          >
            <Lightbulb size={20} className="flex-shrink-0" />
            {!collapsedUI && <span className="truncate flex-1">Mejoras de Orbit</span>}
            {!collapsedUI && newFeedbackCount > 0 && (
              <span className={`ml-auto text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                isActive('/app/mejoras') ? 'bg-[var(--accent)] text-white' : 'bg-[var(--dark)] text-[var(--accent)]'
              }`}>
                {newFeedbackCount > 99 ? '99+' : newFeedbackCount}
              </span>
            )}
            {collapsedUI && newFeedbackCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent)] ring-2 ring-[var(--surface)] rounded-full" />
            )}
            {collapsedUI && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--dark)] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                Mejoras de Orbit{newFeedbackCount > 0 ? ` · ${newFeedbackCount} nuevas` : ''}
              </div>
            )}
          </Link>

          {/* Settings Link */}
          <Link
            to="/app/settings"
            className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isActive('/app/settings')
                ? 'bg-[var(--dark)] text-[var(--accent)]'
                : 'text-gray-500 hover:text-[var(--ink)] hover:bg-[rgb(var(--ink-rgb)/0.04)]'
            }`}
            title={collapsedUI ? 'Mi Cuenta' : ''}
            data-tour="settings"
          >
            <Settings size={20} className="flex-shrink-0" />
            {!collapsedUI && <span>Mi Cuenta</span>}
            {collapsedUI && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--dark)] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                Mi Cuenta
              </div>
            )}
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150"
            title={collapsedUI ? 'Cerrar Sesión' : ''}
          >
            <LogOut size={20} />
            {!collapsedUI && <span>Cerrar Sesión</span>}
          </button>

          {/* Collapse Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-[var(--ink)] hover:bg-gray-100 transition-all duration-150"
          >
            {collapsedUI ? (
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
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out min-w-0 ml-0 ${
          collapsedUI ? 'md:ml-[104px]' : 'md:ml-[252px]'
        }`}
      >
        {/* [modules] Banda: prueba terminada / pago pendiente / cancelado */}
        <TrialBanner />

        {/* Top Header Bar - Clean white.
            Altura h-16 para que coincida con el header del sidebar (también h-16);
            así las dos border-b se alinean en la misma línea horizontal. */}
        <header className="sticky top-0 z-30 h-14 md:h-16 px-3 md:px-6 flex items-center justify-between md:justify-end bg-transparent" style={{ background: 'linear-gradient(180deg, rgb(var(--bg-rgb) / 0.92) 0%, rgb(var(--bg-rgb) / 0.7) 70%, transparent 100%)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} /* [branding] */>
          {/* Móvil: botón de menú + logo */}
          <div className="flex items-center gap-2 md:hidden min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="relative p-2 rounded-xl text-[var(--ink)] hover:bg-[rgb(var(--ink-rgb)/0.04)] active:bg-[var(--surface)]"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
              {(newsUnreadCount > 0 || waUnreadCount > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" />
              )}
            </button>
            {brandLogo ? ( // [branding]
              <img src={brandLogo} alt={currentOrg.name || 'Logo'} className="h-8 max-w-[120px] object-contain" />
            ) : (
              <OrbitLogo size={28} showText />
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div data-tour="search" className="flex"><GlobalSearch /></div>
            <NotificationBell />

            {/* User Avatar */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-[var(--ink)]">
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
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-xl object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--accent)] font-semibold text-sm bg-[var(--dark)]">
                  {getUserInitials(user?.name || 'U')}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="page-container animate-fade-in">{children}</div>
        </main>
      </div>

      {/* [modules] Aviso global de 402 (límite del plan / prueba vencida) */}
      <UpgradeToast />
      <Tour />{/* [onboarding] tour guiado (?tour=1 / primera vez / Mi Cuenta) */}
    </div>
  );
};

export default Layout;
