import { Wallet } from 'lucide-react';

const FinancesWidget = ({ widget, stats }) => {
  const isLarge = widget.size === 'large';

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-ink-900">Finanzas</h2>
      </div>
      <div className={`${isLarge ? 'grid grid-cols-2 gap-6' : 'space-y-4'}`}>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Total Facturado</span>
          <span className="text-sm font-semibold text-ink-900">
            ${(stats?.finances?.total_invoiced || 0).toLocaleString('es-CO')}
          </span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Total Pagado</span>
          <span className="text-sm font-semibold text-green-600">
            ${(stats?.finances?.total_paid || 0).toLocaleString('es-CO')}
          </span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Pendiente de Pago</span>
          <span className="text-sm font-semibold text-amber-600">
            ${(stats?.finances?.total_pending || 0).toLocaleString('es-CO')}
          </span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Total Gastos</span>
          <span className="text-sm font-semibold text-red-500">
            ${(stats?.finances?.total_expenses_amount || 0).toLocaleString('es-CO')}
          </span>
        </div>
        <div className={`${isLarge ? 'col-span-2' : ''} border-t border-ink-100 pt-4 mt-2`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-ink-700">Ingreso Neto</span>
            <span className="text-xl font-bold text-accent">
              ${(stats?.finances?.net_income || 0).toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancesWidget;
