/**
 * Expenses Section - Gastos
 * Uses platform's glass design system (light theme)
 * Shows only real data from API - no hardcoded/fake data
 */
import { useMemo } from 'react';
import { CreditCard, TrendingDown, FileText } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import { formatCurrency } from './shared/formatters';

const ExpensesSection = ({ data, loading }) => {
  // Calculate expense metrics from real data
  const expenseMetrics = useMemo(() => {
    if (!data?.finances) {
      return {
        totalExpenses: 0,
        expenseCount: 0,
      };
    }
    return {
      totalExpenses: data.finances.total_expenses_amount || 0,
      expenseCount: data.expenses?.count || 0,
    };
  }, [data]);

  // Get expenses by category from real data
  const expensesByCategory = useMemo(() => {
    if (!data?.expenses?.by_category) return [];
    const total = data.expenses.by_category.reduce((sum, cat) => sum + (cat.total || 0), 0);
    return data.expenses.by_category.map(cat => ({
      name: cat.category || 'Sin categoría',
      value: cat.total || 0,
      count: cat.count || 0,
      percentage: total > 0 ? ((cat.total || 0) / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  // Recent expenses
  const recentExpenses = useMemo(() => {
    if (!data?.expenses?.recent) return [];
    return data.expenses.recent.slice(0, 10);
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

  const hasData = expenseMetrics.totalExpenses > 0 || expenseMetrics.expenseCount > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Empty KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={CreditCard} title="Total Gastos" value="$0" subtitle="Sin datos" iconColor="orange" />
          <KPICard icon={TrendingDown} title="Mes Actual" value="$0" subtitle="Sin datos" iconColor="rose" />
          <KPICard icon={FileText} title="Registros" value="0" subtitle="Sin datos" iconColor="indigo" />
          <KPICard icon={CreditCard} title="Promedio" value="$0" subtitle="Sin datos" iconColor="amber" />
        </div>

        {/* Empty state */}
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#17181A] mb-2">Sin gastos registrados</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Registra gastos o sincroniza con Siigo para verlos aquí.
          </p>
        </div>
      </div>
    );
  }

  const avgExpense = expenseMetrics.expenseCount > 0
    ? expenseMetrics.totalExpenses / expenseMetrics.expenseCount
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Gastos"
          value={formatCurrency(expenseMetrics.totalExpenses)}
          subtitle="Período seleccionado"
          icon={CreditCard}
          iconColor="orange"
        />
        <KPICard
          title="Registros"
          value={expenseMetrics.expenseCount}
          subtitle="Gastos registrados"
          icon={FileText}
          iconColor="indigo"
        />
        <KPICard
          title="Promedio por Gasto"
          value={formatCurrency(avgExpense)}
          subtitle="Por registro"
          icon={TrendingDown}
          iconColor="amber"
        />
        <KPICard
          title="Categorías"
          value={expensesByCategory.length}
          subtitle="Con gastos"
          icon={CreditCard}
          iconColor="violet"
        />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Expenses by Category */}
        <FinancialCard title="Gastos por Categoría" subtitle="Ordenado por monto" span={6}>
          {expensesByCategory.length > 0 ? (
            <div className="space-y-3 mt-4">
              {expensesByCategory.slice(0, 8).map((cat, idx) => {
                const maxValue = expensesByCategory[0]?.value || 1;
                const percentage = (cat.value / maxValue) * 100;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 truncate max-w-[60%]">{cat.name}</span>
                      <span className="font-semibold text-[#17181A]">{formatCurrency(cat.value)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-0.5">
                      {cat.count} registro{cat.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
              {expensesByCategory.length > 8 && (
                <div className="text-xs text-gray-400 text-center pt-2">
                  +{expensesByCategory.length - 8} categorías más
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Sin datos por categoría</p>
            </div>
          )}
        </FinancialCard>

        {/* Recent Expenses */}
        <FinancialCard title="Gastos Recientes" subtitle="Últimos registros" span={6}>
          {recentExpenses.length > 0 ? (
            <div className="space-y-2 mt-4">
              {recentExpenses.map((exp, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-[#17181A]">{exp.description || 'Sin descripción'}</div>
                    <div className="text-xs text-gray-500">{exp.category || 'Sin categoría'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-orange-600">-{formatCurrency(exp.amount || 0)}</div>
                    <div className="text-xs text-gray-500">
                      {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('es-CO', {
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
              <p className="text-sm">Sin gastos recientes</p>
            </div>
          )}
        </FinancialCard>
      </div>

      {/* Summary Card */}
      <FinancialCard title="Resumen de Gastos" subtitle="Período seleccionado" span={12}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="bg-orange-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-orange-600">{formatCurrency(expenseMetrics.totalExpenses)}</div>
            <div className="text-sm text-gray-600 mt-2">Total Gastado</div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-indigo-600">{expenseMetrics.expenseCount}</div>
            <div className="text-sm text-gray-600 mt-2">Registros</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-amber-600">{formatCurrency(avgExpense)}</div>
            <div className="text-sm text-gray-600 mt-2">Promedio por Gasto</div>
          </div>
        </div>
      </FinancialCard>
    </div>
  );
};

export default ExpensesSection;
