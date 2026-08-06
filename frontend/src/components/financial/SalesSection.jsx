/**
 * Sales Section - Ventas
 * Uses platform's glass design system (light theme)
 */
import { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Target, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import DataTable from './shared/DataTable';
import { formatCurrency, formatPercent, getMonthShort } from './shared/formatters';

const tooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
};

// Mock data - will be replaced with API calls
const monthlyData = [
  { month: 1, ventas: 45000000, presupuesto: 42000000, year: 2024 },
  { month: 2, ventas: 52000000, presupuesto: 48000000, year: 2024 },
  { month: 3, ventas: 48000000, presupuesto: 50000000, year: 2024 },
  { month: 4, ventas: 61000000, presupuesto: 55000000, year: 2024 },
  { month: 5, ventas: 55000000, presupuesto: 52000000, year: 2024 },
  { month: 6, ventas: 67000000, presupuesto: 60000000, year: 2024 },
  { month: 7, ventas: 72000000, presupuesto: 65000000, year: 2024 },
  { month: 8, ventas: 68000000, presupuesto: 68000000, year: 2024 },
];

const salesByService = [
  { servicio: 'Gestión de Pauta', ventas: 185000000, porcentaje: 42 },
  { servicio: 'Social Media', ventas: 120000000, porcentaje: 27 },
  { servicio: 'Producción UGC', ventas: 85000000, porcentaje: 19 },
  { servicio: 'Consultoría', ventas: 52000000, porcentaje: 12 },
];

const momComparison = [
  { metric: 'Ventas Totales', current: 68000000, previous: 72000000, change: -5.6 },
  { metric: 'Nuevos Contratos', current: 12500000, previous: 8000000, change: 56.3 },
  { metric: 'Renovaciones', current: 45000000, previous: 52000000, change: -13.5 },
  { metric: 'Upsells', current: 10500000, previous: 12000000, change: -12.5 },
];

const yearlyComparison = [
  { month: 1, actual: 45000000, lastYear: 38000000 },
  { month: 2, actual: 52000000, lastYear: 42000000 },
  { month: 3, actual: 48000000, lastYear: 45000000 },
  { month: 4, actual: 61000000, lastYear: 48000000 },
  { month: 5, actual: 55000000, lastYear: 52000000 },
  { month: 6, actual: 67000000, lastYear: 58000000 },
  { month: 7, actual: 72000000, lastYear: 62000000 },
  { month: 8, actual: 68000000, lastYear: 65000000 },
];

const SalesSection = () => {
  const totalSales = monthlyData.reduce((sum, m) => sum + m.ventas, 0);
  const totalBudget = monthlyData.reduce((sum, m) => sum + m.presupuesto, 0);
  const budgetVariance = ((totalSales - totalBudget) / totalBudget) * 100;
  const avgMonthlySales = totalSales / monthlyData.length;

  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];
  const momChange = ((currentMonth.ventas - previousMonth.ventas) / previousMonth.ventas) * 100;

  const chartData = monthlyData.map((m) => ({
    ...m,
    name: getMonthShort(m.month),
    cumplimiento: ((m.ventas / m.presupuesto) * 100).toFixed(1),
  }));

  const yoyData = yearlyComparison.map((m) => ({
    ...m,
    name: getMonthShort(m.month),
    growth: (((m.actual - m.lastYear) / m.lastYear) * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Ventas YTD"
          value={formatCurrency(totalSales)}
          change={budgetVariance}
          subtitle="vs presupuesto"
          icon={TrendingUp}
          iconColor="teal"
        />
        <KPICard
          title="Presupuesto YTD"
          value={formatCurrency(totalBudget)}
          subtitle="Meta del año"
          icon={Target}
          iconColor="indigo"
        />
        <KPICard
          title="Promedio Mensual"
          value={formatCurrency(avgMonthlySales)}
          subtitle="Este año"
          icon={Calendar}
          iconColor="amber"
        />
        <KPICard
          title="Mes Actual"
          value={formatCurrency(currentMonth.ventas)}
          change={momChange}
          subtitle="vs mes anterior"
          icon={momChange >= 0 ? TrendingUp : TrendingDown}
          iconColor={momChange >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Budget vs Actual Chart */}
        <FinancialCard title="Ventas vs Presupuesto" subtitle="Comparación mensual" span={8}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                <YAxis
                  stroke="#6b7280"
                  fontSize={11}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatCurrency(value)}
                  labelStyle={{ color: '#17181A', fontWeight: 600 }}
                />
                <Legend />
                <Bar
                  dataKey="ventas"
                  name="Ventas"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="presupuesto"
                  name="Presupuesto"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>

        {/* Sales by Service */}
        <FinancialCard title="Ventas por Servicio" subtitle="Distribución YTD" span={4}>
          <div className="space-y-4">
            {salesByService.map((service) => (
              <div key={service.servicio}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{service.servicio}</span>
                  <span className="font-semibold text-[#17181A]">{formatCurrency(service.ventas)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                    style={{ width: `${service.porcentaje}%` }}
                  />
                </div>
                <div className="text-right text-xs text-gray-500 mt-0.5">
                  {service.porcentaje}%
                </div>
              </div>
            ))}
          </div>
        </FinancialCard>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* YoY Comparison */}
        <FinancialCard title="Comparación Año vs Año" subtitle="2024 vs 2023" span={8}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yoyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
                <YAxis
                  stroke="#6b7280"
                  fontSize={11}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatCurrency(value)}
                  labelStyle={{ color: '#17181A', fontWeight: 600 }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="2024"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="lastYear"
                  name="2023"
                  stroke="#9ca3af"
                  fill="#9ca3af"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>

        {/* MoM Comparison Table */}
        <FinancialCard title="Comparación MoM" subtitle="Agosto vs Julio" span={4}>
          <div className="space-y-3">
            {momComparison.map((item) => (
              <div
                key={item.metric}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="text-xs text-gray-500">{item.metric}</div>
                  <div className="font-semibold text-[#17181A]">{formatCurrency(item.current)}</div>
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  item.change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {item.change >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {formatPercent(Math.abs(item.change))}
                </div>
              </div>
            ))}
          </div>
        </FinancialCard>
      </div>

      {/* Monthly Detail Table */}
      <FinancialCard title="Detalle Mensual" subtitle="Ventas y cumplimiento de presupuesto">
        <DataTable
          columns={[
            { key: 'month', label: 'Mes' },
            { key: 'ventas', label: 'Ventas', align: 'right' },
            { key: 'presupuesto', label: 'Presupuesto', align: 'right' },
            { key: 'variacion', label: 'Variación', align: 'right' },
            { key: 'cumplimiento', label: 'Cumplimiento', align: 'right' },
          ]}
          data={monthlyData.map((m) => {
            const variacion = m.ventas - m.presupuesto;
            const cumplimiento = (m.ventas / m.presupuesto) * 100;
            return {
              id: m.month,
              month: getMonthShort(m.month),
              ventas: formatCurrency(m.ventas),
              presupuesto: formatCurrency(m.presupuesto),
              cells: {
                variacion: {
                  render: (
                    <span className={variacion >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {variacion >= 0 ? '+' : ''}{formatCurrency(variacion)}
                    </span>
                  ),
                },
                cumplimiento: {
                  render: (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      cumplimiento >= 100
                        ? 'bg-emerald-100 text-emerald-700'
                        : cumplimiento >= 90
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {formatPercent(cumplimiento, 0)}
                    </span>
                  ),
                },
              },
            };
          })}
        />
      </FinancialCard>
    </div>
  );
};

export default SalesSection;
