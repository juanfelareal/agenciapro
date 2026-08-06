/**
 * Clients Section - Clientes
 * Top clients, concentration analysis, sectors
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
} from 'recharts';
import { Users, Building2, TrendingUp, AlertTriangle, Star } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import DataTable from './shared/DataTable';
import { formatCurrency, formatPercent } from './shared/formatters';

// Mock data - will be replaced with API calls
const topClients = [
  { id: 1, name: 'TechCorp Colombia', revenue: 85000000, percentage: 19.3, sector: 'Tecnología', status: 'active', trend: 12.5 },
  { id: 2, name: 'Moda Express', revenue: 62000000, percentage: 14.1, sector: 'Retail', status: 'active', trend: 8.2 },
  { id: 3, name: 'Alimentos del Valle', revenue: 48000000, percentage: 10.9, sector: 'Alimentos', status: 'active', trend: -3.1 },
  { id: 4, name: 'Seguros Confianza', revenue: 42000000, percentage: 9.5, sector: 'Seguros', status: 'active', trend: 15.8 },
  { id: 5, name: 'EduOnline Pro', revenue: 38000000, percentage: 8.6, sector: 'Educación', status: 'active', trend: 22.4 },
  { id: 6, name: 'Fitness Life', revenue: 32000000, percentage: 7.3, sector: 'Salud', status: 'at_risk', trend: -8.5 },
  { id: 7, name: 'Casa & Deco', revenue: 28000000, percentage: 6.4, sector: 'Hogar', status: 'active', trend: 5.2 },
  { id: 8, name: 'Viajes Dorados', revenue: 25000000, percentage: 5.7, sector: 'Turismo', status: 'active', trend: 18.9 },
];

const sectorData = [
  { name: 'Tecnología', value: 125000000, color: '#2dd4bf' },
  { name: 'Retail', value: 98000000, color: '#818cf8' },
  { name: 'Alimentos', value: 72000000, color: '#f59e0b' },
  { name: 'Seguros', value: 58000000, color: '#ec4899' },
  { name: 'Educación', value: 45000000, color: '#10b981' },
  { name: 'Otros', value: 42000000, color: '#6b7280' },
];

const clientsBySize = [
  { name: 'Enterprise (>$50M)', count: 3, revenue: 195000000 },
  { name: 'Mid-Market ($20-50M)', count: 8, revenue: 245000000 },
  { name: 'SMB ($5-20M)', count: 15, revenue: 125000000 },
  { name: 'Starter (<$5M)', count: 12, revenue: 35000000 },
];

const concentrationData = [
  { label: 'Top 1', percentage: 19.3 },
  { label: 'Top 3', percentage: 44.3 },
  { label: 'Top 5', percentage: 62.4 },
  { label: 'Top 10', percentage: 85.2 },
];

const ClientsSection = () => {
  const totalRevenue = topClients.reduce((sum, c) => sum + c.revenue, 0);
  const totalClients = 38;
  const activeClients = 35;
  const atRiskClients = topClients.filter((c) => c.status === 'at_risk').length;
  const avgRevenuePerClient = totalRevenue / totalClients;

  // Top 5 concentration
  const top5Revenue = topClients.slice(0, 5).reduce((sum, c) => sum + c.revenue, 0);
  const top5Concentration = (top5Revenue / totalRevenue) * 100;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Clientes Activos"
          value={activeClients}
          subtitle={`de ${totalClients} totales`}
          icon={Users}
          iconColor="teal"
        />
        <KPICard
          title="Ingreso por Cliente"
          value={formatCurrency(avgRevenuePerClient)}
          subtitle="Promedio"
          icon={Building2}
          iconColor="indigo"
        />
        <KPICard
          title="Concentración Top 5"
          value={formatPercent(top5Concentration, 0)}
          subtitle="del ingreso total"
          icon={TrendingUp}
          iconColor={top5Concentration > 60 ? 'amber' : 'emerald'}
        />
        <KPICard
          title="Clientes en Riesgo"
          value={atRiskClients}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          iconColor="rose"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Top Clients Table */}
        <FinancialCard title="Top Clientes" subtitle="Por ingreso YTD" span={8}>
          <DataTable
            columns={[
              { key: 'rank', label: '#', minWidth: '40px' },
              { key: 'name', label: 'Cliente' },
              { key: 'sector', label: 'Sector' },
              { key: 'revenue', label: 'Ingresos', align: 'right' },
              { key: 'percentage', label: '% Total', align: 'right' },
              { key: 'trend', label: 'Tendencia', align: 'right' },
            ]}
            data={topClients.map((client, idx) => ({
              id: client.id,
              rank: idx + 1,
              name: client.name,
              sector: client.sector,
              revenue: formatCurrency(client.revenue),
              percentage: formatPercent(client.percentage),
              cells: {
                name: {
                  render: (
                    <div className="flex items-center gap-2">
                      {client.status === 'at_risk' && (
                        <span className="w-2 h-2 rounded-full bg-rose-400" title="En riesgo" />
                      )}
                      <span>{client.name}</span>
                    </div>
                  ),
                },
                trend: {
                  render: (
                    <span className={client.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {client.trend >= 0 ? '+' : ''}{formatPercent(client.trend)}
                    </span>
                  ),
                },
              },
            }))}
          />
        </FinancialCard>

        {/* Sector Distribution */}
        <FinancialCard title="Por Sector" subtitle="Distribución de ingresos" span={4}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {sectorData.map((entry, index) => (
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
          <div className="grid grid-cols-2 gap-2 mt-2">
            {sectorData.map((sector) => (
              <div key={sector.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: sector.color }}
                />
                <span className="text-[#a0a1a9] truncate">{sector.name}</span>
              </div>
            ))}
          </div>
        </FinancialCard>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Concentration Analysis */}
        <FinancialCard title="Análisis de Concentración" subtitle="Riesgo de dependencia" span={6}>
          <div className="space-y-4">
            {concentrationData.map((item) => {
              const riskLevel = item.percentage > 70 ? 'high' : item.percentage > 50 ? 'medium' : 'low';
              const colors = {
                high: 'bg-rose-500',
                medium: 'bg-amber-500',
                low: 'bg-emerald-500',
              };
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#a0a1a9]">{item.label}</span>
                    <span className="font-semibold">{formatPercent(item.percentage, 0)}</span>
                  </div>
                  <div className="h-3 bg-[#2a2b35] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[riskLevel]} rounded-full transition-all`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <strong>Alerta:</strong> El Top 5 representa más del 60% de los ingresos.
                  Considera diversificar la cartera de clientes.
                </div>
              </div>
            </div>
          </div>
        </FinancialCard>

        {/* Clients by Size */}
        <FinancialCard title="Clientes por Tamaño" subtitle="Segmentación por ingreso" span={6}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientsBySize} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2b35" />
                <XAxis
                  type="number"
                  stroke="#5c5d66"
                  fontSize={11}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#5c5d66"
                  fontSize={11}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1b23',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Bar dataKey="revenue" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {clientsBySize.map((segment) => (
              <div key={segment.name} className="text-center p-2 bg-[#22232d] rounded-lg">
                <div className="text-lg font-bold text-teal-400">{segment.count}</div>
                <div className="text-[10px] text-[#5c5d66]">clientes</div>
              </div>
            ))}
          </div>
        </FinancialCard>
      </div>

      {/* Star Clients */}
      <FinancialCard title="Clientes Estrella" subtitle="Mayor crecimiento YoY">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topClients
            .filter((c) => c.trend > 15)
            .slice(0, 3)
            .map((client, idx) => (
              <div
                key={client.id}
                className="p-4 bg-gradient-to-br from-teal-500/10 to-indigo-500/10 border border-teal-500/20 rounded-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-[#5c5d66]">#{idx + 1}</span>
                    </div>
                    <h4 className="font-semibold">{client.name}</h4>
                    <p className="text-xs text-[#5c5d66]">{client.sector}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">
                      +{formatPercent(client.trend)}
                    </div>
                    <div className="text-xs text-[#5c5d66]">crecimiento</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="text-sm font-semibold">{formatCurrency(client.revenue)}</div>
                  <div className="text-xs text-[#5c5d66]">ingresos YTD</div>
                </div>
              </div>
            ))}
        </div>
      </FinancialCard>
    </div>
  );
};

export default ClientsSection;
