import { LayoutGrid, List, Calendar } from 'lucide-react';

const views = [
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'calendar', label: 'Calendario', icon: Calendar },
];

export default function TaskViewSwitcher({ value, onChange }) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = value === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onChange(view.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}
