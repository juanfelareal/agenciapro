import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';
import { useDashboard, WIDGET_CATALOG } from '../../context/DashboardContext';

const sizeClasses = {
  small: 'col-span-1',
  medium: 'col-span-1 lg:col-span-2',
  large: 'col-span-1 lg:col-span-2 xl:col-span-4',
};

const WidgetWrapper = ({ widget, children }) => {
  const { isEditMode, removeWidget, updateWidgetSize } = useDashboard();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const widgetInfo = WIDGET_CATALOG[widget.type];
  const availableSizes = widgetInfo?.sizes || ['medium'];
  const currentSizeIndex = availableSizes.indexOf(widget.size);
  const canResize = availableSizes.length > 1;

  const handleResize = () => {
    if (!canResize) return;
    const nextIndex = (currentSizeIndex + 1) % availableSizes.length;
    updateWidgetSize(widget.id, availableSizes[nextIndex]);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${sizeClasses[widget.size]} ${isEditMode ? 'ring-2 ring-primary-200 ring-offset-2' : ''} rounded-2xl transition-all`}
    >
      <div className={`card h-full ${isEditMode ? 'animate-wiggle' : ''}`}>
        {isEditMode && (
          <div className="absolute -top-2 -right-2 flex gap-1 z-10">
            {canResize && (
              <button
                onClick={handleResize}
                className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors"
                title={`Cambiar tamaño (${widget.size})`}
              >
                {widget.size === 'small' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
            )}
            <button
              onClick={() => removeWidget(widget.id)}
              className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {isEditMode && (
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-ink-100 transition-colors z-10"
          >
            <GripVertical size={18} className="text-ink-400" />
          </div>
        )}

        <div className={isEditMode ? 'pt-6' : ''}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default WidgetWrapper;
