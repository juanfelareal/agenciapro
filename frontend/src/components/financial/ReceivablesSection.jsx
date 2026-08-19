/**
 * Receivables Section - Cartera
 * Uses platform's glass design system (light theme)
 * Shows only real data from API - no hardcoded/fake data
 */
import { useMemo } from 'react';
import { Wallet, Clock, AlertTriangle, FileText } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import { formatCurrency, formatPercent } from './shared/formatters';

const ReceivablesSection = ({ data, loading }) => {
  // Calculate receivables metrics from real data
  const receivablesMetrics = useMemo(() => {
    if (!data?.finances) {
      return {
        totalReceivables: 0,
        pendingCount: 0,
      };
    }
    return {
      totalReceivables: data.finances.total_pending_gross || 0,
      pendingCount: data.invoices?.pending_count || 0,
    };
  }, [data]);

  // Get pending invoices from real data
  const pendingInvoices = useMemo(() => {
    if (!data?.invoices?.recent) return [];
    return data.invoices.recent
      .filter(inv => inv.status === 'invoiced' || inv.status === 'pending' || inv.status === 'draft')
      .slice(0, 10);
  }, [data]);

  // Get receivables by client
  const receivablesByClient = useMemo(() => {
    if (!data?.invoices?.by_client) return [];
    return data.invoices.by_client
      .filter(client => {
        // Only clients with pending amounts
        const hasPending = client.pending_amount > 0;
        return hasPending;
      })
      .map(client => ({
        name: client.client_name || 'Sin nombre',
        total: client.pending_amount || 0,
        count: client.pending_count || 0,
      }))
      .sort((a, b) => b.total - a.total);
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

  const hasData = receivablesMetrics.totalReceivables > 0 || receivablesMetrics.pendingCount > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Empty KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Wallet} title="Cartera Total" value="$0" subtitle="Sin datos" iconColor="teal" />
          <KPICard icon={AlertTriangle} title="Por Cobrar" value="$0" subtitle="Sin datos" iconColor="amber" />
          <KPICard icon={FileText} title="Facturas Pendientes" value="0" subtitle="Sin datos" iconColor="indigo" />
          <KPICard icon={Clock} title="Clientes con Saldo" value="0" subtitle="Sin datos" iconColor="violet" />
        </div>

        {/* Empty state */}
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-teal-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#17181A] mb-2">Sin cartera pendiente</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Las facturas pendientes de cobro aparecerán aquí.
          </p>
        </div>
      </div>
    );
  }

  const avgPerInvoice = receivablesMetrics.pendingCount > 0
    ? receivablesMetrics.totalReceivables / receivablesMetrics.pendingCount
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Cartera Total"
          value={formatCurrency(receivablesMetrics.totalReceivables)}
          subtitle="Pendiente de cobro"
          icon={Wallet}
          iconColor="teal"
        />
        <KPICard
          title="Facturas Pendientes"
          value={receivablesMetrics.pendingCount}
          subtitle="Por cobrar"
          icon={FileText}
          iconColor="amber"
        />
        <KPICard
          title="Promedio por Factura"
          value={formatCurrency(avgPerInvoice)}
          subtitle="Monto promedio"
          icon={Clock}
          iconColor="indigo"
        />
        <KPICard
          title="Clientes con Saldo"
          value={receivablesByClient.length}
          subtitle="Con facturas pendientes"
          icon={AlertTriangle}
          iconColor="violet"
        />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Receivables by Client */}
        <FinancialCard title="Cartera por Cliente" subtitle="Ordenado por saldo" span={6}>
          {receivablesByClient.length > 0 ? (
            <div className="space-y-3 mt-4">
              {receivablesByClient.slice(0, 8).map((client, idx) => {
                const maxTotal = receivablesByClient[0]?.total || 1;
                const percentage = (client.total / maxTotal) * 100;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 truncate max-w-[60%]">{client.name}</span>
                      <span className="font-semibold text-[#17181A]">{formatCurrency(client.total)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-0.5">
                      {client.count} factura{client.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
              {receivablesByClient.length > 8 && (
                <div className="text-xs text-gray-400 text-center pt-2">
                  +{receivablesByClient.length - 8} clientes más
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin datos por cliente</p>
            </div>
          )}
        </FinancialCard>

        {/* Pending Invoices */}
        <FinancialCard title="Facturas Pendientes" subtitle="Por cobrar" span={6}>
          {pendingInvoices.length > 0 ? (
            <div className="space-y-2 mt-4">
              {pendingInvoices.map((inv, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-[#17181A]">{inv.number || `FAC-${inv.id}`}</div>
                    <div className="text-xs text-gray-500">{inv.client_name || 'Sin cliente'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-amber-600">{formatCurrency(inv.amount || 0)}</div>
                    <div className="text-xs text-gray-500">
                      {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                      }) : '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin facturas pendientes</p>
            </div>
          )}
        </FinancialCard>
      </div>

      {/* Summary Card */}
      <FinancialCard title="Resumen de Cartera" subtitle="Estado actual" span={12}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="bg-amber-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-amber-600">{formatCurrency(receivablesMetrics.totalReceivables)}</div>
            <div className="text-sm text-gray-600 mt-2">Total Por Cobrar</div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-indigo-600">{receivablesMetrics.pendingCount}</div>
            <div className="text-sm text-gray-600 mt-2">Facturas Pendientes</div>
          </div>
          <div className="bg-teal-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-teal-600">{receivablesByClient.length}</div>
            <div className="text-sm text-gray-600 mt-2">Clientes con Saldo</div>
          </div>
        </div>
      </FinancialCard>
    </div>
  );
};

export default ReceivablesSection;
