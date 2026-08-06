/**
 * Payroll Section - Nómina
 * Uses platform's glass design system (light theme)
 */
import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart
} from 'recharts';
import { Users, Briefcase, TrendingUp, Percent } from 'lucide-react';
import KPICard from './shared/KPICard';
import FinancialCard from './shared/FinancialCard';
import { formatCurrency, formatPercent, formatMultiplier } from './shared/formatters';

const tooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
};

const COLORS = {
  payroll: '#818cf8',
  income: '#2dd4bf',
  salario: '#818cf8',
  prestaciones: '#2dd4bf',
  parafiscales: '#fbbf24',
  beneficios: '#c084fc',
};

const PayrollSection = ({ data, loading }) => {
  const [expandedEmployees, setExpandedEmployees] = useState({});

  const toggleEmployee = (empId) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [empId]: !prev[empId],
    }));
  };

  // Mock employee data (will be replaced with real API data)
  const employees = useMemo(() => [
    {
      id: 'emp1',
      name: 'Juan Felipe León',
      position: 'Director',
      monthly: [4235000, 4235000, 4520000, 4520000, 4850000, 5012000, 5228000],
      // Breakdown percentages: ~60% salario, ~22% prestaciones, ~9% parafiscales, ~9% beneficios
      breakdown: {
        salario: 0.60,
        prestaciones: 0.22,
        parafiscales: 0.09,
        beneficios: 0.09,
      },
    },
    {
      id: 'emp2',
      name: 'Mariana Sanín',
      position: 'Dir. Creativa',
      monthly: [4235000, 4235000, 4520000, 4520000, 4850000, 5012000, 5228000],
      breakdown: {
        salario: 0.60,
        prestaciones: 0.22,
        parafiscales: 0.09,
        beneficios: 0.09,
      },
    },
    {
      id: 'emp3',
      name: 'Carlos Rodríguez',
      position: 'Media Buyer',
      monthly: [3200000, 3200000, 3500000, 3500000, 3700000, 3900000, 4100000],
      breakdown: {
        salario: 0.60,
        prestaciones: 0.22,
        parafiscales: 0.09,
        beneficios: 0.09,
      },
    },
    {
      id: 'emp4',
      name: 'Ana García',
      position: 'Community Manager',
      monthly: [3330000, 3330000, 3460000, 3460000, 4400000, 5076000, 5244000],
      breakdown: {
        salario: 0.60,
        prestaciones: 0.22,
        parafiscales: 0.09,
        beneficios: 0.09,
      },
    },
  ], []);

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'];

  // Calculate totals
  const totals = useMemo(() => {
    const monthlyTotals = months.map((_, i) =>
      employees.reduce((sum, emp) => sum + emp.monthly[i], 0)
    );
    const yearTotal = monthlyTotals.reduce((a, b) => a + b, 0);
    const currentMonthTotal = monthlyTotals[monthlyTotals.length - 1];
    const prevMonthTotal = monthlyTotals[monthlyTotals.length - 2];

    return { monthlyTotals, yearTotal, currentMonthTotal, prevMonthTotal };
  }, [employees]);

  // Chart data
  const chartData = useMemo(() => {
    const income = [32300000, 60900000, 78200000, 57400000, 83100000, 68200000, 82400000];
    return months.map((month, i) => ({
      month,
      payroll: totals.monthlyTotals[i],
      income: income[i],
      productivity: income[i] / totals.monthlyTotals[i],
    }));
  }, [totals]);

  // Productivity trend
  const productivityData = useMemo(() => {
    return chartData.map((d) => ({
      month: d.month,
      productivity: d.productivity,
    }));
  }, [chartData]);

  // Cost groups data
  const costGroupData = useMemo(() => {
    return months.map((month, i) => {
      const total = totals.monthlyTotals[i];
      return {
        month,
        salario: total * 0.60,
        prestaciones: total * 0.22,
        parafiscales: total * 0.09,
        beneficios: total * 0.09,
      };
    });
  }, [totals]);

  // KPI calculations
  const kpis = useMemo(() => {
    const employeeCount = employees.length;
    const currentIncome = 82400000; // July income
    const productivity = currentIncome / totals.currentMonthTotal;
    const incomePercent = (totals.currentMonthTotal / currentIncome) * 100;
    const monthChange = ((totals.currentMonthTotal - totals.prevMonthTotal) / totals.prevMonthTotal) * 100;

    return {
      employeeCount,
      currentPayroll: totals.currentMonthTotal,
      productivity,
      incomePercent,
      monthChange,
    };
  }, [employees, totals]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 glass rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          title="Empleados"
          value={kpis.employeeCount}
          subtitle="Planta fija"
          iconColor="indigo"
        />
        <KPICard
          icon={Briefcase}
          title="Costo Nómina Jul"
          value={formatCurrency(kpis.currentPayroll)}
          change={kpis.monthChange}
          subtitle="vs mes anterior"
          iconColor="violet"
        />
        <KPICard
          icon={TrendingUp}
          title="Productividad"
          value={formatMultiplier(kpis.productivity)}
          subtitle="Ingresos/Nómina"
          iconColor="emerald"
        />
        <KPICard
          icon={Percent}
          title="% de Ingresos"
          value={formatPercent(kpis.incomePercent, 0)}
          change={-2}
          subtitle="vs mes anterior"
          iconColor="amber"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-12 gap-4">
        <FinancialCard
          title="Costo Nómina vs Ingresos"
          subtitle="Evolución mensual 2026"
          span={8}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
                  formatter={(value) => formatCurrency(value)}
                  labelStyle={{ color: '#17181A', fontWeight: 600 }}
                />
                <Bar dataKey="payroll" fill={COLORS.payroll} radius={[4, 4, 0, 0]} name="Nómina" />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke={COLORS.income}
                  strokeWidth={2}
                  dot={{ fill: COLORS.income, r: 4 }}
                  name="Ingresos"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>

        <FinancialCard
          title="Distribución Costos"
          subtitle="Nómina vs Terceros"
          span={4}
        >
          <div className="py-5">
            <div className="text-center mb-6">
              <div className="text-sm text-gray-500 mb-2">Costo Nómina</div>
              <div className="text-5xl font-extrabold text-indigo-500">45%</div>
              <div className="text-xs text-gray-400">de los gastos totales</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-2">Costo Terceros</div>
              <div className="text-5xl font-extrabold text-purple-500">55%</div>
              <div className="text-xs text-gray-400">de los gastos totales</div>
            </div>
          </div>
        </FinancialCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-12 gap-4">
        <FinancialCard
          title="Productividad de la Nómina"
          subtitle="Ingresos generados por peso de nómina"
          span={6}
        >
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productivityData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
                  tickFormatter={(v) => `${v.toFixed(1)}x`}
                  domain={[1, 6]}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => `${value.toFixed(2)}x`}
                  labelStyle={{ color: '#17181A', fontWeight: 600 }}
                />
                <Line
                  type="monotone"
                  dataKey="productivity"
                  stroke={COLORS.income}
                  strokeWidth={2}
                  dot={{ fill: COLORS.income, r: 4 }}
                  name="Productividad"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>

        <FinancialCard
          title="Costos por Agrupación"
          subtitle="Distribución mensual 2026"
          span={6}
        >
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={costGroupData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
                  formatter={(value) => formatCurrency(value)}
                  labelStyle={{ color: '#17181A', fontWeight: 600 }}
                />
                <Bar dataKey="salario" stackId="a" fill={COLORS.salario} name="Salario Base" />
                <Bar dataKey="prestaciones" stackId="a" fill={COLORS.prestaciones} name="Prestaciones" />
                <Bar dataKey="parafiscales" stackId="a" fill={COLORS.parafiscales} name="Parafiscales" />
                <Bar dataKey="beneficios" stackId="a" fill={COLORS.beneficios} name="Beneficios" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>
      </div>

      {/* Employee Cost Table with Expandable Rows */}
      <FinancialCard
        title="Costo Total por Empleado"
        subtitle="Incluye salario + prestaciones + parafiscales + beneficios"
        span={12}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[180px]">
                  Empleado
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Cargo
                </th>
                {months.map((m) => (
                  <th key={m} className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                    {m}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const isExpanded = expandedEmployees[emp.id];
                const empTotal = emp.monthly.reduce((a, b) => a + b, 0);

                return (
                  <tbody key={emp.id}>
                    {/* Main Employee Row */}
                    <tr
                      className="cursor-pointer group hover:bg-gray-50 transition-colors"
                      onClick={() => toggleEmployee(emp.id)}
                    >
                      <td className="px-4 py-3 border-b border-gray-100">
                        <span className="font-semibold text-[#17181A] group-hover:text-indigo-600 transition-colors">
                          {isExpanded ? '▾' : '▸'} {emp.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-500 whitespace-nowrap">
                        {emp.position}
                      </td>
                      {emp.monthly.map((v, i) => (
                        <td key={i} className="px-4 py-3 text-right border-b border-gray-100 whitespace-nowrap text-xs text-[#17181A]">
                          {formatCurrency(v)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right border-b border-gray-100 bg-gray-50 font-semibold whitespace-nowrap text-[#17181A]">
                        {formatCurrency(empTotal)}
                      </td>
                    </tr>

                    {/* Detail Rows - Shown when expanded */}
                    {isExpanded && (
                      <>
                        {/* Salario Base */}
                        <tr className="bg-indigo-50">
                          <td colSpan="2" className="px-4 py-2 pl-8 text-xs text-[#17181A]">
                            <span className="text-indigo-500">●</span> Salario base
                          </td>
                          {emp.monthly.map((v, i) => (
                            <td key={i} className="px-4 py-2 text-right text-xs whitespace-nowrap text-[#17181A]">
                              {formatCurrency(v * emp.breakdown.salario)}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right text-xs bg-gray-50 whitespace-nowrap text-[#17181A]">
                            {formatCurrency(empTotal * emp.breakdown.salario)}
                          </td>
                        </tr>

                        {/* Prestaciones */}
                        <tr className="bg-teal-50">
                          <td colSpan="2" className="px-4 py-2 pl-8 text-xs text-[#17181A]">
                            <span className="text-teal-500">●</span> Prestaciones
                          </td>
                          {emp.monthly.map((v, i) => (
                            <td key={i} className="px-4 py-2 text-right text-xs whitespace-nowrap text-[#17181A]">
                              {formatCurrency(v * emp.breakdown.prestaciones)}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right text-xs bg-gray-50 whitespace-nowrap text-[#17181A]">
                            {formatCurrency(empTotal * emp.breakdown.prestaciones)}
                          </td>
                        </tr>

                        {/* Parafiscales */}
                        <tr className="bg-amber-50">
                          <td colSpan="2" className="px-4 py-2 pl-8 text-xs text-[#17181A]">
                            <span className="text-amber-500">●</span> Parafiscales
                          </td>
                          {emp.monthly.map((v, i) => (
                            <td key={i} className="px-4 py-2 text-right text-xs whitespace-nowrap text-[#17181A]">
                              {formatCurrency(v * emp.breakdown.parafiscales)}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right text-xs bg-gray-50 whitespace-nowrap text-[#17181A]">
                            {formatCurrency(empTotal * emp.breakdown.parafiscales)}
                          </td>
                        </tr>

                        {/* Beneficios */}
                        <tr className="bg-purple-50">
                          <td colSpan="2" className="px-4 py-2 pl-8 text-xs border-b border-gray-100 text-[#17181A]">
                            <span className="text-purple-500">●</span> Beneficios
                          </td>
                          {emp.monthly.map((v, i) => (
                            <td key={i} className="px-4 py-2 text-right text-xs border-b border-gray-100 whitespace-nowrap text-[#17181A]">
                              {formatCurrency(v * emp.breakdown.beneficios)}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right text-xs bg-gray-50 border-b border-gray-100 whitespace-nowrap text-[#17181A]">
                            {formatCurrency(empTotal * emp.breakdown.beneficios)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                );
              })}

              {/* Totals Row */}
              <tr className="bg-gray-100 font-semibold">
                <td colSpan="2" className="px-4 py-3 border-t-2 border-gray-200 text-[#17181A]">
                  TOTAL NÓMINA
                </td>
                {totals.monthlyTotals.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-right border-t-2 border-gray-200 whitespace-nowrap text-[#17181A]">
                    {formatCurrency(v)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right bg-gray-100 border-t-2 border-gray-200 text-emerald-600 whitespace-nowrap">
                  {formatCurrency(totals.yearTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300" />
            Salario base (~60%)
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-teal-100 border border-teal-300" />
            Prestaciones (~22%)
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
            Parafiscales (~9%)
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300" />
            Beneficios (~9%)
          </div>
        </div>
      </FinancialCard>
    </div>
  );
};

export default PayrollSection;
