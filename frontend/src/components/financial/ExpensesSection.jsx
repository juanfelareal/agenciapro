/**
 * Expenses Section - Gastos
 * Expenses by vendor, category, accounts payable
 */
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { CreditCard, Building2, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import DataTable from './shared/DataTable';
import { formatCurrency, formatPercent, getMonthShort } from './shared/formatters';

// Mock data - will be replaced with API calls
const expensesByCategory = [
  { name: 'Nómina', value: 145000000, color: '#818cf8', percentage: 48.3 },
  { name: 'Software & Tools', value: 42000000, color: '#2dd4bf', percentage: 14.0 },
  { name: 'Marketing', value: 35000000, color: '#f59e0b', percentage: 11.7 },
  { name: 'Oficina', value: 28000000, color: '#ec4899', percentage: 9.3 },
  { name: 'Servicios Prof.', value: 25000000, color: '#10b981', percentage: 8.3 },
  { name: 'Otros', value: 25000000, color: '#6b7280', percentage: 8.3 },
];

const expensesByVendor = [
  { vendor: 'Meta Ads', category: 'Marketing', amount: 18500000, trend: 12.5 },
  { vendor: 'Google Ads', category: 'Marketing', amount: 12000000, trend: 8.2 },
  { vendor: 'AWS', category: 'Software', amount: 8500000, trend: -5.3 },
  { vendor: 'Slack', category: 'Software', amount: 4200000, trend: 0 },
  { vendor: 'Figma', category: 'Software', amount: 3800000, trend: 15.0 },
  { vendor: 'WeWork', category: 'Oficina', amount: 12500000, trend: 0 },
  { vendor: 'Contador Externo', category: 'Servicios Prof.', amount: 8000000, trend: -10.0 },
  { vendor: 'Seguros', category: 'Otros', amount: 5500000, trend: 5.0 },
];

const monthlyExpenses = [
  { month: 1, gastos: 32000000, presupuesto: 35000000 },
  { month: 2, gastos: 35000000, presupuesto: 35000000 },
  { month: 3, gastos: 38000000, presupuesto: 36000000 },
  { month: 4, gastos: 34000000, presupuesto: 36000000 },
  { month: 5, gastos: 42000000, presupuesto: 38000000 },
  { month: 6, gastos: 39000000, presupuesto: 38000000 },
  { month: 7, gastos: 41000000, presupuesto: 40000000 },
  { month: 8, gastos: 39000000, presupuesto: 40000000 },
];

const accountsPayable = [
  { id: 'CXP-001', vendor: 'Meta Ads', amount: 18500000, dueDate: '2024-08-15', status: 'pending' },
  { id: 'CXP-002', vendor: 'WeWork', amount: 12500000, dueDate: '2024-08-20', status: 'pending' },
  { id: 'CXP-003', vendor: 'AWS', amount: 8500000, dueDate: '2024-08-25', status: 'pending' },
  { id: 'CXP-004', vendor: 'Google Ads', amount: 12000000, dueDate: '2024-08-10', status: 'overdue' },
  { id: 'CXP-005', vendor: 'Contador Externo', amount: 8000000, dueDate: '2024-08-30', status: 'scheduled' },
];

const ExpensesSection = () => {
  const totalExpenses = expensesByCategory.reduce((sum, c) => sum + c.value, 0);
  const totalBudget = monthlyExpenses.reduce((sum, m) => sum + m.presupuesto, 0);
  const actualSpend = monthlyExpenses.reduce((sum, m) => sum + m.gastos, 0);
  const budgetVariance = ((actualSpend - totalBudget) / totalBudget) * 100;

  const currentMonth = monthlyExpenses[monthlyExpenses.length - 1];
  const previousMonth = monthlyExpenses[monthlyExpenses.length - 2];
  const momChange = ((currentMonth.gastos - previousMonth.gastos) / previousMonth.gastos) * 100;

  const pendingPayables = accountsPayable
    .filter((ap) => ap.status !== 'paid')
    .reduce((sum, ap) => sum + ap.amount, 0);

  const chartData = monthlyExpenses.map((m) => ({
    ...m,
    name: getMonthShort(m.month),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Gastos YTD"
          value={formatCurrency(actualSpend)}
          change={budgetVariance}
          subtitle="vs presupuesto"
          icon={CreditCard}
          iconColor={budgetVariance > 0 ? 'rose' : 'emerald'}
        />
        <KPICard
          title="Mes Actual"
          value={formatCurrency(currentMonth.gastos)}
          change={momChange}
          subtitle="vs mes anterior"
          icon={Calendar}
          iconColor={momChange > 0 ? 'rose' : 'emerald'}
        />
        <KPICard
          title="Cuentas por Pagar"
          value={formatCurrency(pendingPayables)}
          subtitle="próximos 30 días"
          icon={Building2}
          iconColor="amber"
        />
        <KPICard
          title="Gasto/Ingreso"
          value={formatPercent(68.5)}
          change={-2.3}
          subtitle="ratio operativo"
          icon={TrendingDown}
          iconColor="indigo"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Expenses by Category Donut */}
        <FinancialCard title="Gastos por Categoría" subtitle="Distribución YTD" span={4}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1b23',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {expensesByCategory.slice(0, 5).map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-[#a0a1a9]">{cat.name}</span>
                </div>
                <span className="font-semibold">{formatPercent(cat.percentage, 0)}</span>
              </div>
            ))}
          </div>
        </FinancialCard>

        {/* Monthly Expenses vs Budget */}
        <FinancialCard title="Gastos vs Presupuesto" subtitle="Tendencia mensual" span={8}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2b35" />
                <XAxis dataKey="name" stroke="#5c5d66" fontSize={11} />
                <YAxis
                  stroke="#5c5d66"
                  fontSize={11}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1b23',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Bar
                  dataKey="gastos"
                  name="Gastos"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="presupuesto"
                  name="Presupuesto"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  fillOpacity={0.4}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>
      </div>

      {/* Vendors and Payables Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Top Vendors */}
        <FinancialCard title="Top Proveedores" subtitle="Por monto de gasto" span={6}>
          <DataTable
            columns={[
              { key: 'vendor', label: 'Proveedor' },
              { key: 'category', label: 'Categoría' },
              { key: 'amount', label: 'Monto', align: 'right' },
              { key: 'trend', label: 'vs Anterior', align: 'right' },
            ]}
            data={expensesByVendor.map((v) => ({
              id: v.vendor,
              vendor: v.vendor,
              category: v.category,
              amount: formatCurrency(v.amount),
              cells: {
                category: {
                  render: (
                    <span className="px-2 py-0.5 bg-[#2a2b35] rounded text-xs text-[#a0a1a9]">
                      {v.category}
                    </span>
                  ),
                },
                trend: {
                  render: v.trend !== 0 ? (
                    <span className={`flex items-center justify-end gap-1 ${
                      v.trend > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {v.trend > 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {formatPercent(Math.abs(v.trend))}
                    </span>
                  ) : (
                    <span className="text-[#5c5d66]">—</span>
                  ),
                },
              },
            }))}
          />
        </FinancialCard>

        {/* Accounts Payable */}
        <FinancialCard title="Cuentas por Pagar" subtitle="Próximos vencimientos" span={6}>
          <DataTable
            columns={[
              { key: 'vendor', label: 'Proveedor' },
              { key: 'amount', label: 'Monto', align: 'right' },
              { key: 'dueDate', label: 'Vencimiento' },
              { key: 'status', label: 'Estado', align: 'center' },
            ]}
            data={accountsPayable.map((ap) => ({
              id: ap.id,
              vendor: ap.vendor,
              amount: formatCurrency(ap.amount),
              dueDate: new Date(ap.dueDate).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
              }),
              cells: {
                status: {
                  render: (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      ap.status === 'overdue'
                        ? 'bg-rose-500/20 text-rose-400'
                        : ap.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {ap.status === 'overdue' && 'Vencido'}
                      {ap.status === 'pending' && 'Pendiente'}
                      {ap.status === 'scheduled' && 'Programado'}
                    </span>
                  ),
                },
              },
            }))}
          />
        </FinancialCard>
      </div>

      {/* Category Breakdown Cards */}
      <FinancialCard title="Desglose por Categoría" subtitle="Detalle de gastos operativos">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {expensesByCategory.map((cat) => (
            <div
              key={cat.name}
              className="p-4 rounded-xl text-center"
              style={{
                backgroundColor: `${cat.color}10`,
                borderColor: `${cat.color}30`,
                borderWidth: 1,
              }}
            >
              <div
                className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <CreditCard className="w-5 h-5" style={{ color: cat.color }} />
              </div>
              <div className="text-xs text-[#5c5d66] mb-1">{cat.name}</div>
              <div className="font-bold" style={{ color: cat.color }}>
                {formatCurrency(cat.value)}
              </div>
              <div className="text-xs text-[#5c5d66] mt-1">
                {formatPercent(cat.percentage, 0)} del total
              </div>
            </div>
          ))}
        </div>
      </FinancialCard>
    </div>
  );
};

export default ExpensesSection;
