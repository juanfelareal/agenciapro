/**
 * Overview Section - Resumen
 * Uses platform's glass design system (light theme)
 * Shows only real data from API - no hardcoded/fake data
 */
import { useMemo } from 'react';
import { DollarSign, TrendingDown, Star, Percent, Clock, FileText } from 'lucide-react';
import KPICard from './shared/KPICard';
import FinancialCard from './shared/FinancialCard';
import { formatCurrency, formatPercent } from './shared/formatters';

const OverviewSection = ({ data, loading }) => {
  // Calculate KPIs from real API data
  const kpis = useMemo(() => {
    if (!data?.finances) {
      return {
        income: 0,
        expenses: 0,
        profit: 0,
        margin: 0,
        receivables: 0,
      };
    }
    const f = data.finances;
    const income = f.total_invoiced_net || 0;
    const expenses = f.total_expenses_amount || 0;
    const profit = f.net_income || income - expenses;
    const margin = income > 0 ? (profit / income) * 100 : 0;
    const receivables = f.total_pending_gross || 0;

    return { income, expenses, profit, margin, receivables };
  }, [data]);

  // Real expense breakdown from API
  const expensesByCategory = useMemo(() => {
    if (!data?.expenses?.by_category) return [];
    return data.expenses.by_category.map(cat => ({
      name: cat.category || 'Sin categoría',
      value: cat.total || 0,
    }));
  }, [data]);

  // Real invoices summary
  const invoicesSummary = useMemo(() => {
    if (!data?.invoices) return null;
    return {
      total: data.invoices.count || 0,
      paid: data.invoices.paid_count || 0,
      pending: data.invoices.pending_count || 0,
      totalAmount: data.invoices.total_amount || 0,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 glass rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state when no data
  const hasData = kpis.income > 0 || kpis.expenses > 0 || kpis.receivables > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Empty KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard icon={DollarSign} title="Ingresos" value="$0" subtitle="Sin datos" iconColor="emerald" />
          <KPICard icon={TrendingDown} title="Gastos" value="$0" subtitle="Sin datos" iconColor="orange" />
          <KPICard icon={Star} title="Utilidad" value="$0" subtitle="Sin datos" iconColor="indigo" />
          <KPICard icon={Percent} title="Margen" value="0%" subtitle="Sin datos" iconColor="violet" />
          <KPICard icon={Clock} title="Cartera" value="$0" subtitle="Sin datos" iconColor="amber" />
        </div>

        {/* Empty state message */}
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#17181A] mb-2">Sin datos financieros</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Importa facturas desde Siigo o registra gastos para ver el resumen financiero aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs - Real data only, no fake percentages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon={DollarSign}
          title="Ingresos"
          value={formatCurrency(kpis.income)}
          subtitle="Período seleccionado"
          iconColor="emerald"
        />
        <KPICard
          icon={TrendingDown}
          title="Gastos"
          value={formatCurrency(kpis.expenses)}
          subtitle="Período seleccionado"
          iconColor="orange"
        />
        <KPICard
          icon={Star}
          title="Utilidad"
          value={formatCurrency(kpis.profit)}
          subtitle="Ingresos - Gastos"
          iconColor="indigo"
        />
        <KPICard
          icon={Percent}
          title="Margen"
          value={formatPercent(kpis.margin)}
          subtitle="Utilidad / Ingresos"
          iconColor="violet"
        />
        <KPICard
          icon={Clock}
          title="Cartera"
          value={formatCurrency(kpis.receivables)}
          subtitle="Pendiente de cobro"
          iconColor="amber"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-12 gap-4">
        {/* P&L Summary */}
        <FinancialCard
          title="Resumen del Período"
          subtitle="Estado de resultados"
          span={6}
        >
          <div className="space-y-4 mt-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Ingresos</span>
              <span className="font-semibold text-[#17181A]">{formatCurrency(kpis.income)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Gastos</span>
              <span className="font-semibold text-orange-600">-{formatCurrency(kpis.expenses)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-emerald-50 rounded-xl px-4 -mx-4">
              <span className="font-semibold text-emerald-700">Utilidad Neta</span>
              <span className="font-bold text-emerald-600 text-lg">{formatCurrency(kpis.profit)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500 text-sm">Margen de utilidad</span>
              <span className="font-semibold text-emerald-600">{formatPercent(kpis.margin)}</span>
            </div>
          </div>
        </FinancialCard>

        {/* Expenses by Category */}
        <FinancialCard
          title="Gastos por Categoría"
          subtitle="Desglose del período"
          span={6}
        >
          {expensesByCategory.length > 0 ? (
            <div className="space-y-3 mt-4">
              {expensesByCategory.slice(0, 6).map((cat, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-600 text-sm">{cat.name}</span>
                  <span className="font-medium text-[#17181A]">{formatCurrency(cat.value)}</span>
                </div>
              ))}
              {expensesByCategory.length > 6 && (
                <div className="text-xs text-gray-400 text-center pt-2">
                  +{expensesByCategory.length - 6} categorías más
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin gastos registrados</p>
            </div>
          )}
        </FinancialCard>
      </div>

      {/* Invoices & Receivables */}
      <div className="grid grid-cols-12 gap-4">
        <FinancialCard
          title="Estado de Facturas"
          subtitle="Resumen de facturación"
          span={6}
        >
          {invoicesSummary ? (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[#17181A]">{invoicesSummary.total}</div>
                <div className="text-xs text-gray-500 mt-1">Total Facturas</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{invoicesSummary.paid}</div>
                <div className="text-xs text-gray-500 mt-1">Pagadas</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{invoicesSummary.pending}</div>
                <div className="text-xs text-gray-500 mt-1">Pendientes</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin facturas registradas</p>
            </div>
          )}
        </FinancialCard>

        <FinancialCard
          title="Cartera por Cobrar"
          subtitle="Cuentas pendientes"
          span={6}
        >
          <div className="mt-4">
            <div className="bg-amber-50 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-amber-600">{formatCurrency(kpis.receivables)}</div>
              <div className="text-sm text-gray-500 mt-2">Total pendiente de cobro</div>
            </div>
            {kpis.income > 0 && (
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-500">
                  Representa el {formatPercent((kpis.receivables / kpis.income) * 100)} de los ingresos
                </span>
              </div>
            )}
          </div>
        </FinancialCard>
      </div>
    </div>
  );
};

export default OverviewSection;
