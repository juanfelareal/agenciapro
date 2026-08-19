/**
 * Sales Section - Ventas
 * Uses platform's glass design system (light theme)
 * Shows only real data from API - no hardcoded/fake data
 */
import { useMemo } from 'react';
import { TrendingUp, FileText, DollarSign, Users } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import { formatCurrency } from './shared/formatters';

const SalesSection = ({ data, loading }) => {
  // Calculate sales metrics from real data
  const salesMetrics = useMemo(() => {
    if (!data?.finances) {
      return {
        totalSales: 0,
        paidSales: 0,
        pendingSales: 0,
        invoiceCount: 0,
      };
    }
    const f = data.finances;
    return {
      totalSales: f.total_invoiced_net || 0,
      paidSales: f.total_paid_net || 0,
      pendingSales: f.total_pending_gross || 0,
      invoiceCount: f.invoice_count || 0,
    };
  }, [data]);

  // Get invoices by client from real data
  const invoicesByClient = useMemo(() => {
    if (!data?.invoices?.by_client) return [];
    return data.invoices.by_client.map(client => ({
      name: client.client_name || 'Sin nombre',
      total: client.total_amount || 0,
      count: client.invoice_count || 0,
    })).sort((a, b) => b.total - a.total);
  }, [data]);

  // Recent invoices
  const recentInvoices = useMemo(() => {
    if (!data?.invoices?.recent) return [];
    return data.invoices.recent.slice(0, 10);
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 glass rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = salesMetrics.totalSales > 0 || salesMetrics.invoiceCount > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Empty KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={DollarSign} title="Ventas Totales" value="$0" subtitle="Sin datos" iconColor="emerald" />
          <KPICard icon={TrendingUp} title="Cobrado" value="$0" subtitle="Sin datos" iconColor="teal" />
          <KPICard icon={FileText} title="Por Cobrar" value="$0" subtitle="Sin datos" iconColor="amber" />
          <KPICard icon={Users} title="Facturas" value="0" subtitle="Sin datos" iconColor="indigo" />
        </div>

        {/* Empty state */}
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#17181A] mb-2">Sin datos de ventas</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Sincroniza con Siigo o crea facturas para ver las ventas aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Ventas Totales"
          value={formatCurrency(salesMetrics.totalSales)}
          subtitle="Período seleccionado"
          icon={DollarSign}
          iconColor="emerald"
        />
        <KPICard
          title="Cobrado"
          value={formatCurrency(salesMetrics.paidSales)}
          subtitle="Facturas pagadas"
          icon={TrendingUp}
          iconColor="teal"
        />
        <KPICard
          title="Por Cobrar"
          value={formatCurrency(salesMetrics.pendingSales)}
          subtitle="Pendiente de pago"
          icon={FileText}
          iconColor="amber"
        />
        <KPICard
          title="Facturas"
          value={salesMetrics.invoiceCount}
          subtitle="En el período"
          icon={Users}
          iconColor="indigo"
        />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sales by Client */}
        <FinancialCard title="Ventas por Cliente" subtitle="Ordenado por monto" span={6}>
          {invoicesByClient.length > 0 ? (
            <div className="space-y-3 mt-4">
              {invoicesByClient.slice(0, 8).map((client, idx) => {
                const maxTotal = invoicesByClient[0]?.total || 1;
                const percentage = (client.total / maxTotal) * 100;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 truncate max-w-[60%]">{client.name}</span>
                      <span className="font-semibold text-[#17181A]">{formatCurrency(client.total)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-0.5">
                      {client.count} factura{client.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
              {invoicesByClient.length > 8 && (
                <div className="text-xs text-gray-400 text-center pt-2">
                  +{invoicesByClient.length - 8} clientes más
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin datos por cliente</p>
            </div>
          )}
        </FinancialCard>

        {/* Recent Invoices */}
        <FinancialCard title="Facturas Recientes" subtitle="Últimas facturas emitidas" span={6}>
          {recentInvoices.length > 0 ? (
            <div className="space-y-2 mt-4">
              {recentInvoices.map((inv, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-[#17181A]">{inv.number || `FAC-${inv.id}`}</div>
                    <div className="text-xs text-gray-500">{inv.client_name || 'Sin cliente'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[#17181A]">{formatCurrency(inv.amount || 0)}</div>
                    <div className={`text-xs ${
                      inv.status === 'paid' ? 'text-emerald-600' :
                      inv.status === 'invoiced' ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      {inv.status === 'paid' ? 'Pagada' :
                       inv.status === 'invoiced' ? 'Pendiente' : inv.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin facturas recientes</p>
            </div>
          )}
        </FinancialCard>
      </div>

      {/* Summary Card */}
      <FinancialCard title="Resumen de Ventas" subtitle="Período seleccionado" span={12}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="bg-emerald-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-emerald-600">{formatCurrency(salesMetrics.totalSales)}</div>
            <div className="text-sm text-gray-600 mt-2">Total Facturado</div>
          </div>
          <div className="bg-teal-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-teal-600">{formatCurrency(salesMetrics.paidSales)}</div>
            <div className="text-sm text-gray-600 mt-2">Total Cobrado</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-amber-600">{formatCurrency(salesMetrics.pendingSales)}</div>
            <div className="text-sm text-gray-600 mt-2">Pendiente de Cobro</div>
          </div>
        </div>
      </FinancialCard>
    </div>
  );
};

export default SalesSection;
