import { Wallet } from 'lucide-react';

const FinancesWidget = ({ widget, stats }) => {
  const isLarge = widget.size === 'large';

  const f = stats?.finances || {};
  const fmt = (v) => `$${(v || 0).toLocaleString('es-CO')}`;

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
          <span className="text-sm text-ink-500">Total Neto Facturado</span>
          <span className="text-sm font-semibold text-ink-900">{fmt(f.total_invoiced_net)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">IVA</span>
          <span className="text-sm font-semibold text-blue-600">{fmt(f.total_invoiced_iva)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Total Facturado (con IVA)</span>
          <span className="text-sm font-semibold text-ink-900">{fmt(f.total_invoiced_gross)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Pagado</span>
          <span className="text-sm font-semibold text-green-600">{fmt(f.total_paid_gross)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Pendiente de Pago</span>
          <span className="text-sm font-semibold text-amber-600">{fmt(f.total_pending_gross)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-ink-500">Total Gastos</span>
          <span className="text-sm font-semibold text-red-500">{fmt(f.total_expenses_amount)}</span>
        </div>
        <div className={`${isLarge ? 'col-span-2' : ''} border-t border-ink-100 pt-4 mt-2`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-ink-700">Ingreso Neto</span>
            <span className="text-xl font-bold text-accent">{fmt(f.net_income)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancesWidget;
