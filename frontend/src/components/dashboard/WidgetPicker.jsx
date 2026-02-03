import { useState } from 'react';
import { X, Plus, Users, FolderKanban, CheckSquare, DollarSign, AlertCircle, Wallet, PieChart, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { useDashboard, WIDGET_CATALOG } from '../../context/DashboardContext';

const ICONS = {
  Users,
  FolderKanban,
  CheckSquare,
  DollarSign,
  AlertCircle,
  Wallet,
  PieChart,
  TrendingUp,
  Clock,
  BarChart3,
};

const CATEGORY_ICONS = {
  'Estadísticas': BarChart3,
  'Finanzas': Wallet,
  'Proyectos': FolderKanban,
  'Tareas': CheckSquare,
  'Equipo': Users,
};

const WidgetPicker = ({ isOpen, onClose }) => {
  const { addWidget, widgets } = useDashboard();
  const [selectedCategory, setSelectedCategory] = useState('Estadísticas');

  if (!isOpen) return null;

  // Group widgets by category
  const categories = {};
  Object.entries(WIDGET_CATALOG).forEach(([type, widget]) => {
    if (!categories[widget.category]) {
      categories[widget.category] = [];
    }
    categories[widget.category].push({ type, ...widget });
  });

  const handleAddWidget = (type, config = {}) => {
    const widgetInfo = WIDGET_CATALOG[type];
    const defaultSize = widgetInfo.sizes[0];
    addWidget(type, config, defaultSize);
    onClose();
  };

  // Check if a stat metric is already added
  const isStatMetricAdded = (metric) => {
    return widgets.some(w => w.type === 'stat' && w.config?.metric === metric);
  };

  // Check if a widget type is already added (for non-stat widgets)
  const isWidgetAdded = (type) => {
    if (type === 'stat') return false; // Stats can have multiple with different metrics
    return widgets.some(w => w.type === type);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <h2 className="text-xl font-semibold text-ink-900">Agregar Widget</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-ink-100 transition-colors"
          >
            <X size={20} className="text-ink-500" />
          </button>
        </div>

        <div className="flex h-[60vh]">
          {/* Categories Sidebar */}
          <div className="w-48 border-r border-ink-100 p-3 space-y-1">
            {Object.keys(categories).map((category) => {
              const Icon = CATEGORY_ICONS[category] || BarChart3;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <Icon size={18} />
                  {category}
                </button>
              );
            })}
          </div>

          {/* Widgets Grid */}
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {categories[selectedCategory]?.map((widget) => {
                // For stat widgets, show each metric as a separate option
                if (widget.type === 'stat') {
                  return Object.entries(widget.metrics).map(([metricKey, metric]) => {
                    const isAdded = isStatMetricAdded(metricKey);
                    const Icon = ICONS[metric.icon] || BarChart3;
                    return (
                      <button
                        key={`stat-${metricKey}`}
                        onClick={() => !isAdded && handleAddWidget('stat', { metric: metricKey })}
                        disabled={isAdded}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isAdded
                            ? 'border-ink-100 bg-ink-50 opacity-50 cursor-not-allowed'
                            : 'border-ink-200 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center mb-3">
                          <Icon size={20} className="text-primary-600" />
                        </div>
                        <p className="font-medium text-ink-900">{metric.label}</p>
                        <p className="text-xs text-ink-500 mt-1">Tamaño: Pequeño</p>
                        {isAdded && (
                          <p className="text-xs text-green-600 mt-2">Ya agregado</p>
                        )}
                      </button>
                    );
                  });
                }

                // For other widgets
                const isAdded = isWidgetAdded(widget.type);
                return (
                  <button
                    key={widget.type}
                    onClick={() => !isAdded && handleAddWidget(widget.type)}
                    disabled={isAdded}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isAdded
                        ? 'border-ink-100 bg-ink-50 opacity-50 cursor-not-allowed'
                        : 'border-ink-200 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center mb-3">
                      <Plus size={20} className="text-primary-600" />
                    </div>
                    <p className="font-medium text-ink-900">{widget.name}</p>
                    <p className="text-xs text-ink-500 mt-1">
                      Tamaños: {widget.sizes.map(s => s === 'small' ? 'S' : s === 'medium' ? 'M' : 'L').join(', ')}
                    </p>
                    {isAdded && (
                      <p className="text-xs text-green-600 mt-2">Ya agregado</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetPicker;
