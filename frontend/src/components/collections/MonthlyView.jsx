import { AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { formatCurrency, formatMonth, formatDateShort } from './collectionsUtils';

const pctColor = (pct) => (pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400');

const forecastLabel = (f) => {
  if (f.kind === 'overdue') return { title: 'Atrasado', subtitle: `fecha pasada (antes del ${formatDateShort(f.week_end)})` };
  if (f.kind === 'no_date') return { title: 'Sin fecha', subtitle: 'sin promesa ni vencimiento' };
  return { title: `Semana del ${formatDateShort(f.week_start)}`, subtitle: `al ${formatDateShort(f.week_end)}` };
};

// Vista "Por mes": facturado vs cobrado por mes de emisión + proyección de caja por semana
const MonthlyView = ({ data, loading = false, onSelectMonth, onGoToInvoices }) => {
  if (loading || !data) {
    return (
      <div className="glass-card p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17181A]"></div></div>
    );
  }

  const { months = [], forecast = [], no_date_count = 0, no_date_amount = 0, today } = data;
  const currentMonth = (today || new Date().toISOString()).slice(0, 7);
  const totals = months.reduce((acc, m) => ({
    invoiced: acc.invoiced + m.invoiced,
    collected: acc.collected + m.collected,
    pending: acc.pending + m.pending,
    invoice_count: acc.invoice_count + m.invoice_count,
  }), { invoiced: 0, collected: 0, pending: 0, invoice_count: 0 });
  const totalPct = totals.invoiced > 0 ? Math.round((totals.collected / totals.invoiced) * 1000) / 10 : 0;
  const maxForecast = Math.max(1, ...forecast.map((f) => f.amount));
  const hasMonths = months.some((m) => m.invoice_count > 0);

  return (
    <div className="space-y-6">
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#17181A]">Cartera por mes de emisión</h2>
          <p className="text-xs text-gray-400 mt-0.5">Últimos 12 meses · clic en un mes para ver sus facturas pendientes</p>
        </div>

        {!hasMonths ? (
          <p className="p-10 text-center text-sm text-gray-400">No hay facturas emitidas en los últimos 12 meses</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="bg-gray-50/70 text-xs text-gray-500 uppercase tracking-wider text-left">
                  <th className="px-6 py-3">Mes</th>
                  <th className="px-3 py-3 text-center"># Fact.</th>
                  <th className="px-3 py-3 text-right">Facturado</th>
                  <th className="px-3 py-3 text-right">Cobrado</th>
                  <th className="px-3 py-3 text-right">Pendiente</th>
                  <th className="px-3 py-3 w-56">% cobrado</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {months.map((m) => {
                  const clickable = m.pending_count > 0;
                  const isCurrent = m.month === currentMonth;
                  return (
                    <tr
                      key={m.month}
                      onClick={() => clickable && onSelectMonth(m.month)}
                      className={`transition-colors ${clickable ? 'cursor-pointer hover:bg-white/60' : ''} ${isCurrent ? 'bg-[#D7F653]/10' : ''} ${m.invoice_count === 0 ? 'text-gray-300' : ''}`}
                      title={clickable ? 'Ver facturas pendientes de este mes' : undefined}
                    >
                      <td className="px-6 py-3 text-sm font-semibold capitalize text-[#17181A]">
                        {formatMonth(m.month)}
                        {isCurrent && <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400 font-medium">actual</span>}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 text-center">{m.invoice_count || '-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 text-right whitespace-nowrap">{m.invoiced ? formatCurrency(m.invoiced) : '-'}</td>
                      <td className="px-3 py-3 text-sm text-emerald-700 text-right whitespace-nowrap">{m.collected ? formatCurrency(m.collected) : '-'}</td>
                      <td className={`px-3 py-3 text-sm text-right whitespace-nowrap font-semibold ${m.pending > 0 ? 'text-[#17181A]' : 'text-gray-300'}`}>{m.pending ? formatCurrency(m.pending) : '-'}</td>
                      <td className="px-3 py-3">
                        {m.invoiced > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className={`h-full rounded-full ${pctColor(m.pct_collected)}`} style={{ width: `${Math.min(100, m.pct_collected)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-600 w-12 text-right">{m.pct_collected}%</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right">{clickable && <ChevronRight size={16} className="text-gray-300 inline" />}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/70 text-sm font-semibold">
                  <td className="px-6 py-3 text-gray-600">Total 12 meses</td>
                  <td className="px-3 py-3 text-center text-gray-600">{totals.invoice_count}</td>
                  <td className="px-3 py-3 text-right text-[#17181A] whitespace-nowrap">{formatCurrency(totals.invoiced)}</td>
                  <td className="px-3 py-3 text-right text-emerald-700 whitespace-nowrap">{formatCurrency(totals.collected)}</td>
                  <td className="px-3 py-3 text-right text-[#17181A] whitespace-nowrap">{formatCurrency(totals.pending)}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{totalPct}% cobrado</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Proyección de caja */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={18} className="text-[#4d7c0f]" />
          <div>
            <h2 className="text-lg font-bold text-[#17181A]">Proyección de caja</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pendiente por semana según promesa de pago; si no hay, por fecha de vencimiento</p>
          </div>
        </div>

        {forecast.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No hay facturas pendientes para proyectar</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {forecast.map((f) => {
              const { title, subtitle } = forecastLabel(f);
              const isOverdue = f.kind === 'overdue';
              const isNoDate = f.kind === 'no_date';
              return (
                <div key={`${f.kind}-${f.week_start || ''}`} className={`px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${isNoDate ? 'bg-gray-50/50' : ''}`}>
                  <div className="sm:w-56 shrink-0">
                    <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : isNoDate ? 'text-gray-500' : 'text-[#17181A]'}`}>{title}</p>
                    <p className="text-xs text-gray-400">{subtitle}</p>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isOverdue ? 'bg-red-400' : isNoDate ? 'bg-gray-300' : 'bg-[#D7F653]'}`}
                        style={{ width: `${Math.max(2, (f.amount / maxForecast) * 100)}%` }}
                      />
                    </div>
                    <div className="text-right w-36 shrink-0">
                      <p className="text-sm font-bold text-[#17181A] whitespace-nowrap">{formatCurrency(f.amount)}</p>
                      <p className="text-[11px] text-gray-400">
                        {f.count} fact.{f.kind === 'week' && f.with_promise > 0 ? ` · ${f.with_promise} con promesa` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {no_date_count > 0 && (
          <div className="mx-6 mb-5 mt-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              <strong>{no_date_count} factura{no_date_count !== 1 ? 's' : ''}</strong> ({formatCurrency(no_date_amount)}) no tienen fecha de promesa ni de vencimiento, así que no entran en la proyección.
            </p>
            {onGoToInvoices && (
              <button type="button" onClick={onGoToInvoices} className="text-sm font-medium text-amber-900 underline whitespace-nowrap">
                Asignar promesas →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyView;
