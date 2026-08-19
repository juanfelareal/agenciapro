/**
 * Clients Section - Clientes
 * Uses platform's glass design system (light theme)
 * Shows only real data from API - no hardcoded/fake data
 */
import { useMemo } from 'react';
import { Users, Building2, TrendingUp, FileText } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import { formatCurrency, formatPercent } from './shared/formatters';

const ClientsSection = ({ data, loading }) => {
  // Get clients from real data
  const clientsData = useMemo(() => {
    if (!data?.invoices?.by_client) return [];
    return data.invoices.by_client.map(client => ({
      name: client.client_name || 'Sin nombre',
      revenue: client.total_amount || 0,
      invoiceCount: client.invoice_count || 0,
      paidAmount: client.paid_amount || 0,
      pendingAmount: client.pending_amount || 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  // Calculate metrics from real data
  const clientMetrics = useMemo(() => {
    const totalClients = clientsData.length;
    const totalRevenue = clientsData.reduce((sum, c) => sum + c.revenue, 0);
    const avgRevenuePerClient = totalClients > 0 ? totalRevenue / totalClients : 0;

    // Top 5 concentration
    const top5Revenue = clientsData.slice(0, 5).reduce((sum, c) => sum + c.revenue, 0);
    const top5Concentration = totalRevenue > 0 ? (top5Revenue / totalRevenue) * 100 : 0;

    return {
      totalClients,
      totalRevenue,
      avgRevenuePerClient,
      top5Concentration,
    };
  }, [clientsData]);

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

  const hasData = clientsData.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Empty KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Users} title="Clientes" value="0" subtitle="Sin datos" iconColor="teal" />
          <KPICard icon={Building2} title="Ingreso por Cliente" value="$0" subtitle="Sin datos" iconColor="indigo" />
          <KPICard icon={TrendingUp} title="Total Facturado" value="$0" subtitle="Sin datos" iconColor="emerald" />
          <KPICard icon={FileText} title="Facturas" value="0" subtitle="Sin datos" iconColor="violet" />
        </div>

        {/* Empty state */}
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-teal-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#17181A] mb-2">Sin datos de clientes</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Crea facturas o sincroniza con Siigo para ver información de clientes.
          </p>
        </div>
      </div>
    );
  }

  const totalInvoices = clientsData.reduce((sum, c) => sum + c.invoiceCount, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Clientes"
          value={clientMetrics.totalClients}
          subtitle="Con facturas"
          icon={Users}
          iconColor="teal"
        />
        <KPICard
          title="Ingreso por Cliente"
          value={formatCurrency(clientMetrics.avgRevenuePerClient)}
          subtitle="Promedio"
          icon={Building2}
          iconColor="indigo"
        />
        <KPICard
          title="Total Facturado"
          value={formatCurrency(clientMetrics.totalRevenue)}
          subtitle="Período seleccionado"
          icon={TrendingUp}
          iconColor="emerald"
        />
        <KPICard
          title="Facturas"
          value={totalInvoices}
          subtitle="Total emitidas"
          icon={FileText}
          iconColor="violet"
        />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Top Clients */}
        <FinancialCard title="Top Clientes" subtitle="Por ingresos" span={8}>
          {clientsData.length > 0 ? (
            <div className="space-y-3 mt-4">
              {clientsData.slice(0, 10).map((client, idx) => {
                const maxRevenue = clientsData[0]?.revenue || 1;
                const percentage = (client.revenue / maxRevenue) * 100;
                const shareOfTotal = clientMetrics.totalRevenue > 0
                  ? (client.revenue / clientMetrics.totalRevenue) * 100
                  : 0;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs w-5">#{idx + 1}</span>
                        <span className="text-gray-700 truncate max-w-[300px]">{client.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">{formatPercent(shareOfTotal)} del total</span>
                        <span className="font-semibold text-[#17181A]">{formatCurrency(client.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-0.5">
                      {client.invoiceCount} factura{client.invoiceCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
              {clientsData.length > 10 && (
                <div className="text-xs text-gray-400 text-center pt-2">
                  +{clientsData.length - 10} clientes más
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin datos de clientes</p>
            </div>
          )}
        </FinancialCard>

        {/* Client Stats */}
        <FinancialCard title="Estadísticas" subtitle="Resumen de clientes" span={4}>
          <div className="space-y-4 mt-4">
            <div className="bg-teal-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">{clientMetrics.totalClients}</div>
              <div className="text-xs text-gray-500 mt-1">Clientes Activos</div>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{formatCurrency(clientMetrics.avgRevenuePerClient)}</div>
              <div className="text-xs text-gray-500 mt-1">Ingreso Promedio</div>
            </div>
            {clientMetrics.totalClients >= 5 && (
              <div className={`rounded-xl p-4 text-center ${
                clientMetrics.top5Concentration > 70 ? 'bg-amber-50' : 'bg-emerald-50'
              }`}>
                <div className={`text-2xl font-bold ${
                  clientMetrics.top5Concentration > 70 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {formatPercent(clientMetrics.top5Concentration)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Concentración Top 5</div>
              </div>
            )}
          </div>
        </FinancialCard>
      </div>

      {/* Summary Card */}
      <FinancialCard title="Resumen de Clientes" subtitle="Período seleccionado" span={12}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
          <div className="bg-teal-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-teal-600">{clientMetrics.totalClients}</div>
            <div className="text-sm text-gray-600 mt-2">Total Clientes</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-emerald-600">{formatCurrency(clientMetrics.totalRevenue)}</div>
            <div className="text-sm text-gray-600 mt-2">Total Facturado</div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-indigo-600">{totalInvoices}</div>
            <div className="text-sm text-gray-600 mt-2">Total Facturas</div>
          </div>
          <div className="bg-violet-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-violet-600">{formatCurrency(clientMetrics.avgRevenuePerClient)}</div>
            <div className="text-sm text-gray-600 mt-2">Promedio por Cliente</div>
          </div>
        </div>
      </FinancialCard>
    </div>
  );
};

export default ClientsSection;
