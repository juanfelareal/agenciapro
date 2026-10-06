import { DollarSign, Users, CalendarCheck } from 'lucide-react';
import { AGING_BUCKETS, BUCKET_STYLES, formatCurrency } from './collectionsUtils';

// Tarjetas de resumen: total pendiente, clientes, esperado este mes + antigüedad por bucket
const AgingStats = ({ stats = {}, clientsCount = 0, activeBucket = null, onBucketClick }) => {
  const aging = stats.aging || {};
  const totalInvoices = Number(stats.total_invoices || 0);

  return (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17181A] flex items-center justify-center shrink-0">
              <DollarSign size={20} className="text-[#D7F653]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total pendiente</p>
              <p className="text-xl font-bold text-[#17181A] truncate">{formatCurrency(stats.total_amount)}</p>
              <p className="text-xs text-gray-400">{totalInvoices} factura{totalInvoices !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Users size={20} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Clientes por cobrar</p>
              <p className="text-xl font-bold text-[#17181A]">{clientsCount}</p>
              <p className="text-xs text-gray-400">con saldo pendiente</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D7F653]/30 flex items-center justify-center shrink-0">
              <CalendarCheck size={20} className="text-[#4d7c0f]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Esperado este mes</p>
              <p className="text-xl font-bold text-[#17181A] truncate">{formatCurrency(stats.expected_this_month)}</p>
              <p className="text-xs text-gray-400">
                {Number(stats.expected_this_month_count || 0)} factura{Number(stats.expected_this_month_count || 0) !== 1 ? 's' : ''} con promesa o vencimiento este mes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Antigüedad (días desde emisión) */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">Antigüedad de la cartera (días desde emisión)</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {AGING_BUCKETS.map((bucket) => {
            const data = aging[bucket] || { count: 0, amount: 0 };
            const style = BUCKET_STYLES[bucket];
            const isRed = bucket === '90+';
            const isActive = activeBucket === bucket;
            return (
              <button
                key={bucket}
                type="button"
                onClick={() => onBucketClick && onBucketClick(bucket)}
                className={`glass-card p-4 text-left transition-all hover:-translate-y-0.5 ${isActive ? 'ring-2 ring-[#17181A]' : ''} ${isRed && data.count > 0 ? 'border-red-200' : ''}`}
                title={`Ver facturas de ${style.label}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>{style.label}</span>
                  <span className="text-xs text-gray-400">{data.count} fact.</span>
                </div>
                <p className={`text-lg font-bold mt-2 ${isRed ? 'text-red-600' : 'text-[#17181A]'}`}>{formatCurrency(data.amount)}</p>
                <div className="h-1.5 rounded-full bg-gray-100 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${style.bar}`}
                    style={{ width: `${stats.total_amount > 0 ? Math.min(100, (data.amount / stats.total_amount) * 100) : 0}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AgingStats;
