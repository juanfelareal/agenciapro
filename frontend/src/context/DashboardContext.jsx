import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const DashboardContext = createContext();

// Default widget configuration for new users
const DEFAULT_WIDGETS = [
  { id: 'stat-clients', type: 'stat', config: { metric: 'clients' }, size: 'small', order: 0 },
  { id: 'stat-projects', type: 'stat', config: { metric: 'projects' }, size: 'small', order: 1 },
  { id: 'stat-tasks', type: 'stat', config: { metric: 'tasks' }, size: 'small', order: 2 },
  { id: 'stat-income', type: 'stat', config: { metric: 'income' }, size: 'small', order: 3 },
  { id: 'finances', type: 'finances', size: 'medium', order: 4 },
  { id: 'projects-summary', type: 'projects', size: 'medium', order: 5 },
];

// Widget catalog - all available widgets
export const WIDGET_CATALOG = {
  stat: {
    name: 'Estadística',
    category: 'Estadísticas',
    sizes: ['small'],
    metrics: {
      clients: { label: 'Clientes Activos', icon: 'Users' },
      projects: { label: 'Proyectos Activos', icon: 'FolderKanban' },
      tasks: { label: 'Tareas Pendientes', icon: 'CheckSquare' },
      income: { label: 'Ingresos Netos', icon: 'DollarSign' },
      invoices_overdue: { label: 'Facturas Vencidas', icon: 'AlertCircle' },
    },
  },
  finances: {
    name: 'Resumen Financiero',
    category: 'Finanzas',
    sizes: ['medium', 'large'],
  },
  'income-trend': {
    name: 'Tendencia de Ingresos',
    category: 'Finanzas',
    sizes: ['medium', 'large'],
  },
  'expenses-chart': {
    name: 'Gastos por Categoría',
    category: 'Finanzas',
    sizes: ['medium'],
  },
  projects: {
    name: 'Resumen de Proyectos',
    category: 'Proyectos',
    sizes: ['medium', 'large'],
  },
  'budget-vs-spent': {
    name: 'Presupuesto vs Gastado',
    category: 'Proyectos',
    sizes: ['medium'],
  },
  'tasks-upcoming': {
    name: 'Tareas Próximas',
    category: 'Tareas',
    sizes: ['medium', 'large'],
  },
  'tasks-priority': {
    name: 'Tareas por Prioridad',
    category: 'Tareas',
    sizes: ['medium'],
  },
  'team-hours': {
    name: 'Horas por Miembro',
    category: 'Equipo',
    sizes: ['medium'],
  },
  'team-commissions': {
    name: 'Comisiones del Mes',
    category: 'Equipo',
    sizes: ['medium'],
  },
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export const DashboardProvider = ({ children }) => {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load widgets from localStorage on mount
  useEffect(() => {
    const loadWidgets = () => {
      const storageKey = user?.id ? `dashboard_widgets_${user.id}` : 'dashboard_widgets_guest';
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        try {
          setWidgets(JSON.parse(saved));
        } catch {
          setWidgets(DEFAULT_WIDGETS);
        }
      } else {
        setWidgets(DEFAULT_WIDGETS);
      }
      setIsLoading(false);
    };

    loadWidgets();
  }, [user?.id]);

  // Save widgets to localStorage whenever they change
  useEffect(() => {
    if (!isLoading && widgets.length > 0) {
      const storageKey = user?.id ? `dashboard_widgets_${user.id}` : 'dashboard_widgets_guest';
      localStorage.setItem(storageKey, JSON.stringify(widgets));
    }
  }, [widgets, user?.id, isLoading]);

  const addWidget = useCallback((type, config = {}, size = 'medium') => {
    const newWidget = {
      id: `${type}-${Date.now()}`,
      type,
      config,
      size,
      order: widgets.length,
    };
    setWidgets(prev => [...prev, newWidget]);
  }, [widgets.length]);

  const removeWidget = useCallback((widgetId) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  const updateWidgetOrder = useCallback((newOrder) => {
    setWidgets(newOrder.map((widget, index) => ({
      ...widget,
      order: index,
    })));
  }, []);

  const updateWidgetSize = useCallback((widgetId, size) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, size } : w
    ));
  }, []);

  const updateWidgetConfig = useCallback((widgetId, config) => {
    setWidgets(prev => prev.map(w =>
      w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
    ));
  }, []);

  const resetToDefault = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        widgets,
        isEditMode,
        isLoading,
        addWidget,
        removeWidget,
        updateWidgetOrder,
        updateWidgetSize,
        updateWidgetConfig,
        resetToDefault,
        toggleEditMode,
        setIsEditMode,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};
