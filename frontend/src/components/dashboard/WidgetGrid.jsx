import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useDashboard } from '../../context/DashboardContext';
import WidgetWrapper from './WidgetWrapper';
import StatWidget from './widgets/StatWidget';
import FinancesWidget from './widgets/FinancesWidget';
import ProjectsWidget from './widgets/ProjectsWidget';
import TasksUpcomingWidget from './widgets/TasksUpcomingWidget';
import TasksPriorityWidget from './widgets/TasksPriorityWidget';
import IncomeTrendWidget from './widgets/IncomeTrendWidget';

// Map widget types to components
const WIDGET_COMPONENTS = {
  stat: StatWidget,
  finances: FinancesWidget,
  projects: ProjectsWidget,
  'tasks-upcoming': TasksUpcomingWidget,
  'tasks-priority': TasksPriorityWidget,
  'income-trend': IncomeTrendWidget,
};

const WidgetGrid = ({ stats, period }) => {
  const { widgets, updateWidgetOrder, isEditMode } = useDashboard();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex(w => w.id === active.id);
      const newIndex = widgets.findIndex(w => w.id === over.id);
      updateWidgetOrder(arrayMove(widgets, oldIndex, newIndex));
    }
  };

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedWidgets.map(w => w.id)}
        strategy={rectSortingStrategy}
        disabled={!isEditMode}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {sortedWidgets.map((widget) => {
            const WidgetComponent = WIDGET_COMPONENTS[widget.type];
            if (!WidgetComponent) return null;

            return (
              <WidgetWrapper key={widget.id} widget={widget}>
                <WidgetComponent widget={widget} stats={stats} period={period} />
              </WidgetWrapper>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default WidgetGrid;
