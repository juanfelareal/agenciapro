import { PieChart } from 'lucide-react';

const ProjectsWidget = ({ widget, stats }) => {
  const isLarge = widget.size === 'large';

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <PieChart className="w-5 h-5 text-blue-600" />
        </div>
        <h2 className="text-lg font-semibold text-ink-900">Proyectos</h2>
      </div>
      <div className={`${isLarge ? 'grid grid-cols-2 gap-6' : 'space-y-4'}`}>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Total Proyectos</span>
          <span className="text-sm font-semibold text-ink-900">{stats?.projects?.total || 0}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">En Progreso</span>
          <span className="text-sm font-semibold text-blue-600">
            {stats?.projects?.in_progress || 0}
          </span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Completados</span>
          <span className="text-sm font-semibold text-green-600">
            {stats?.projects?.completed || 0}
          </span>
        </div>
        <div className={`${isLarge ? 'col-span-2' : ''} border-t border-ink-100 pt-4 mt-2`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-ink-500">Presupuesto Total</span>
            <span className="text-sm font-semibold text-ink-900">
              ${(stats?.projects?.total_budget || 0).toLocaleString('es-CO')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-ink-500">Gastado</span>
            <span className="text-sm font-semibold text-red-500">
              ${(stats?.projects?.total_spent || 0).toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsWidget;
