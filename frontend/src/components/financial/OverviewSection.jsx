/**
 * Overview Section - Resumen
 * Uses platform's glass design system (light theme)
 */
import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart
} from 'recharts';
import { DollarSign, TrendingDown, Star, Percent, Clock } from 'lucide-react';
import KPICard from './shared/KPICard';
import FinancialCard from './shared/FinancialCard';
import { formatCurrency, formatPercent, getMonthShort } from './shared/formatters';

const COLORS = {
  income: '#10b981',
  expenses: '#f97316',
  profit: '#6366f1',
  payroll: '#6366f1',
  commissions: '#10b981',
  operations: '#f59e0b',
  other: '#a855f7',
};

const tooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
};

const OverviewSection = ({ data, loading }) => {
  // Calculate KPIs from data
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

  // Mock monthly data for charts (will be replaced with real API data)
  const monthlyData = useMemo(() => {
    return [
      { month: 'Ene', income: 32300000, expenses: 22100000, profit: 10200000 },
      { month: 'Feb', income: 60900000, expenses: 35200000, profit: 25700000 },
      { month: 'Mar', income: 78200000, expenses: 41800000, profit: 36400000 },
      { month: 'Abr', income: 57400000, expenses: 33900000, profit: 23500000 },
      { month: 'May', income: 83100000, expenses: 44700000, profit: 38400000 },
      { month: 'Jun', income: 68200000, expenses: 43200000, profit: 25000000 },
      { month: 'Jul', income: 82400000, expenses: 47200000, profit: 35200000 },
    ];
  }, []);

  // Expense breakdown for donut chart
  const expenseBreakdown = useMemo(() => {
    return [
      { name: 'Nómina', value: 42, color: COLORS.payroll },
      { name: 'Comisiones', value: 24, color: COLORS.commissions },
      { name: 'Operación', value: 18, color: COLORS.operations },
      { name: 'Otros', value: 16, color: COLORS.other },
    ];
  }, []);

  // P&L data
  const plData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'];
    return {
      ingresos: [32300000, 60900000, 78200000, 57400000, 83100000, 68200000, 82400000],
      gastos: [22100000, 35200000, 41800000, 33900000, 44700000, 43200000, 47200000],
      nomina: [15000000, 15000000, 16500000, 16500000, 18000000, 19000000, 19800000],
      comisiones: [3200000, 6100000, 7800000, 5700000, 8300000, 10200000, 11400000],
      operacion: [2400000, 8600000, 10500000, 6700000, 11400000, 8000000, 8500000],
      otros: [1500000, 5500000, 7000000, 5000000, 7000000, 6000000, 7500000],
      utilidad: [10200000, 25700000, 36400000, 23500000, 38400000, 25000000, 35200000],
      margen: [31.6, 42.2, 46.5, 40.9, 46.2, 36.9, 42.7],
      months,
    };
  }, []);

  // Margin trend data
  const marginTrend = useMemo(() => {
    return plData.months.map((month, i) => ({
      month,
      margin: plData.margen[i],
      target: 35,
    }));
  }, [plData]);

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

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon={DollarSign}
          title="Ingresos"
          value={formatCurrency(kpis.income)}
          change={21}
          subtitle="vs mes anterior"
          iconColor="emerald"
        />
        <KPICard
          icon={TrendingDown}
          title="Gastos"
          value={formatCurrency(kpis.expenses)}
          change={-8}
          subtitle="vs mes anterior"
          iconColor="orange"
        />
        <KPICard
          icon={Star}
          title="Utilidad"
          value={formatCurrency(kpis.profit)}
          change={41}
          subtitle="vs mes anterior"
          iconColor="indigo"
        />
        <KPICard
          icon={Percent}
          title="Margen"
          value={formatPercent(kpis.margin)}
          change={5.8}
          subtitle="vs mes anterior"
          iconColor="violet"
        />
        <KPICard
          icon={Clock}
          title="Cartera"
          value={formatCurrency(kpis.receivables)}
          subtitle="72% a 30 días"
          iconColor="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Profitability Chart */}
        <FinancialCard
          title="Rentabilidad Mensual 2026"
          subtitle="Ingresos vs Gastos vs Utilidad"
          span={8}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#17181A', marginBottom: '8px', fontWeight: 600 }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Bar dataKey="income" fill={COLORS.income} radius={[4, 4, 0, 0]} name="Ingresos" />
                <Bar dataKey="expenses" fill={COLORS.expenses} radius={[4, 4, 0, 0]} name="Gastos" />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke={COLORS.profit}
                  strokeWidth={2}
                  dot={{ fill: COLORS.profit, r: 4 }}
                  name="Utilidad"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>

        {/* Expense Breakdown Donut */}
        <FinancialCard
          title="Desglose de Gastos"
          subtitle="Julio 2026"
          span={4}
        >
          <div className="h-44 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <div className="text-2xl font-bold text-[#17181A]">{formatCurrency(kpis.expenses)}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            {expenseBreakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name} {item.value}%
              </div>
            ))}
          </div>
        </FinancialCard>
      </div>

      {/* P&L Table */}
      <FinancialCard
        title="Estado de Resultados (P&L)"
        subtitle="Comparativo mensual 2026"
        span={12}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Concepto
                </th>
                {plData.months.map((m) => (
                  <th key={m} className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    {m}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                  YTD
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Ingresos */}
              <tr>
                <td className="px-4 py-3 border-b border-gray-100 font-semibold text-[#17181A]">Ingresos</td>
                {plData.ingresos.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-right border-b border-gray-100 text-[#17181A]">{formatCurrency(v)}</td>
                ))}
                <td className="px-4 py-3 text-right border-b border-gray-100 bg-gray-50 font-semibold text-[#17181A]">
                  {formatCurrency(plData.ingresos.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {/* Gastos */}
              <tr className="bg-orange-50/50">
                <td className="px-4 py-3 border-b border-gray-100 font-semibold text-[#17181A]">Gastos</td>
                {plData.gastos.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-right border-b border-gray-100 text-[#17181A]">{formatCurrency(v)}</td>
                ))}
                <td className="px-4 py-3 text-right border-b border-gray-100 bg-gray-100 font-semibold text-[#17181A]">
                  {formatCurrency(plData.gastos.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {/* Nómina Fija */}
              <tr className="text-gray-500 text-xs">
                <td className="px-4 py-2 pl-8 border-b border-gray-100">Nómina Fija</td>
                {plData.nomina.map((v, i) => (
                  <td key={i} className="px-4 py-2 text-right border-b border-gray-100">{formatCurrency(v)}</td>
                ))}
                <td className="px-4 py-2 text-right border-b border-gray-100 bg-gray-50">
                  {formatCurrency(plData.nomina.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {/* Comisiones */}
              <tr className="text-gray-500 text-xs">
                <td className="px-4 py-2 pl-8 border-b border-gray-100">Comisiones</td>
                {plData.comisiones.map((v, i) => (
                  <td key={i} className="px-4 py-2 text-right border-b border-gray-100">{formatCurrency(v)}</td>
                ))}
                <td className="px-4 py-2 text-right border-b border-gray-100 bg-gray-50">
                  {formatCurrency(plData.comisiones.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {/* Operación */}
              <tr className="text-gray-500 text-xs">
                <td className="px-4 py-2 pl-8 border-b border-gray-100">Operación</td>
                {plData.operacion.map((v, i) => (
                  <td key={i} className="px-4 py-2 text-right border-b border-gray-100">{formatCurrency(v)}</td>
                ))}
                <td className="px-4 py-2 text-right border-b border-gray-100 bg-gray-50">
                  {formatCurrency(plData.operacion.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {/* Otros */}
              <tr className="text-gray-500 text-xs">
                <td className="px-4 py-2 pl-8 border-b border-gray-100">Otros</td>
                {plData.otros.map((v, i) => (
                  <td key={i} className="px-4 py-2 text-right border-b border-gray-100">{formatCurrency(v)}</td>
                ))}
                <td className="px-4 py-2 text-right border-b border-gray-100 bg-gray-50">
                  {formatCurrency(plData.otros.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {/* Utilidad */}
              <tr className="bg-emerald-50">
                <td className="px-4 py-3 border-b border-gray-100 font-semibold text-emerald-600">= Utilidad</td>
                {plData.utilidad.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-right border-b border-gray-100 text-emerald-600 font-medium">{formatCurrency(v)}</td>
                ))}
                <td className="px-4 py-3 text-right border-b border-gray-100 bg-emerald-100 font-semibold text-emerald-600">
                  {formatCurrency(plData.utilidad.reduce((a, b) => a + b, 0))}
                </td>
              </tr>

              {/* Margen */}
              <tr>
                <td className="px-4 py-3 text-[#17181A]">Margen %</td>
                {plData.margen.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-right text-emerald-600 font-medium">{formatPercent(v)}</td>
                ))}
                <td className="px-4 py-3 text-right bg-gray-50 font-semibold text-emerald-600">
                  {formatPercent(plData.margen.reduce((a, b) => a + b, 0) / plData.margen.length)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </FinancialCard>

      {/* Bottom Row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Margin Trend */}
        <FinancialCard
          title="Tendencia del Margen"
          subtitle="Meta: 35% | YTD: 42.0%"
          span={6}
        >
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginTrend} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  domain={[20, 50]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => `${value}%`}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#d1d5db"
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  dot={false}
                  name="Meta"
                />
                <Line
                  type="monotone"
                  dataKey="margin"
                  stroke={COLORS.income}
                  strokeWidth={2}
                  dot={{ fill: COLORS.income, r: 4 }}
                  name="Margen"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>

        {/* YoY Comparison */}
        <FinancialCard
          title="Comparativo YoY"
          subtitle="Ventas acumuladas a Julio"
          span={6}
        >
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 mb-2">2024</div>
              <div className="text-xl font-bold text-[#17181A]">{formatCurrency(186000000)}</div>
              <div className="text-xs text-gray-400 mt-1">Base</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 mb-2">2025</div>
              <div className="text-xl font-bold text-[#17181A]">{formatCurrency(312000000)}</div>
              <div className="text-xs text-emerald-600 mt-1">+68%</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
              <div className="text-xs text-gray-500 mb-2">2026</div>
              <div className="text-xl font-bold text-[#17181A]">{formatCurrency(462000000)}</div>
              <div className="text-xs text-emerald-600 mt-1">+48%</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between mb-2 text-sm text-[#17181A]">
              <span>Cumplimiento Presupuesto</span>
              <span className="font-semibold">{formatCurrency(462000000)} / {formatCurrency(720000000)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: '64%' }} />
            </div>
            <div className="text-xs text-gray-500 mt-2">64% ejecutado • Faltan {formatCurrency(258000000)}</div>
          </div>
        </FinancialCard>
      </div>
    </div>
  );
};

export default OverviewSection;
