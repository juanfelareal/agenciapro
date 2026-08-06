/**
 * Receivables Section - Cartera
 * Accounts receivable, aging analysis, overdue invoices
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Wallet, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import FinancialCard from './shared/FinancialCard';
import KPICard from './shared/KPICard';
import DataTable from './shared/DataTable';
import { formatCurrency, formatPercent } from './shared/formatters';

// Mock data - will be replaced with API calls
const agingData = [
  { range: 'Vigente', amount: 125000000, count: 18, color: '#10b981' },
  { range: '1-30 días', amount: 45000000, count: 8, color: '#f59e0b' },
  { range: '31-60 días', amount: 28000000, count: 5, color: '#f97316' },
  { range: '61-90 días', amount: 15000000, count: 3, color: '#ef4444' },
  { range: '+90 días', amount: 12000000, count: 2, color: '#991b1b' },
];

const overdueInvoices = [
  { id: 'FAC-2024-0842', client: 'Fitness Life', amount: 8500000, dueDate: '2024-06-15', days: 56, status: 'overdue' },
  { id: 'FAC-2024-0856', client: 'Casa & Deco', amount: 6200000, dueDate: '2024-07-01', days: 40, status: 'overdue' },
  { id: 'FAC-2024-0871', client: 'TechCorp Colombia', amount: 12500000, dueDate: '2024-07-10', days: 31, status: 'overdue' },
  { id: 'FAC-2024-0889', client: 'Moda Express', amount: 9800000, dueDate: '2024-07-15', days: 26, status: 'warning' },
  { id: 'FAC-2024-0902', client: 'EduOnline Pro', amount: 7500000, dueDate: '2024-07-22', days: 19, status: 'warning' },
  { id: 'FAC-2024-0915', client: 'Alimentos del Valle', amount: 11200000, dueDate: '2024-07-28', days: 13, status: 'warning' },
];

const collectionHistory = [
  { month: 'Mar', collected: 58000000, pending: 32000000 },
  { month: 'Abr', collected: 62000000, pending: 38000000 },
  { month: 'May', collected: 71000000, pending: 42000000 },
  { month: 'Jun', collected: 68000000, pending: 48000000 },
  { month: 'Jul', collected: 75000000, pending: 52000000 },
  { month: 'Ago', collected: 82000000, pending: 55000000 },
];

const clientsWithDebt = [
  { client: 'TechCorp Colombia', total: 28500000, overdue: 12500000, current: 16000000 },
  { client: 'Moda Express', total: 22000000, overdue: 9800000, current: 12200000 },
  { client: 'Fitness Life', total: 14200000, overdue: 8500000, current: 5700000 },
  { client: 'Casa & Deco', total: 11500000, overdue: 6200000, current: 5300000 },
  { client: 'Alimentos del Valle', total: 18000000, overdue: 0, current: 18000000 },
];

const ReceivablesSection = () => {
  const totalReceivables = agingData.reduce((sum, a) => sum + a.amount, 0);
  const overdueAmount = agingData.slice(1).reduce((sum, a) => sum + a.amount, 0);
  const overduePercentage = (overdueAmount / totalReceivables) * 100;
  const avgDaysOutstanding = 32; // Mock calculation
  const collectionRate = 78.5; // Mock percentage

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Cartera Total"
          value={formatCurrency(totalReceivables)}
          subtitle="Cuentas por cobrar"
          icon={Wallet}
          iconColor="teal"
        />
        <KPICard
          title="Cartera Vencida"
          value={formatCurrency(overdueAmount)}
          change={-overduePercentage}
          subtitle="del total"
          icon={AlertTriangle}
          iconColor="rose"
        />
        <KPICard
          title="Días Promedio"
          value={avgDaysOutstanding}
          subtitle="de cobranza"
          icon={Clock}
          iconColor="amber"
        />
        <KPICard
          title="Tasa de Recaudo"
          value={formatPercent(collectionRate)}
          subtitle="últimos 30 días"
          icon={CheckCircle}
          iconColor="emerald"
        />
      </div>

      {/* Aging Grid */}
      <FinancialCard title="Antigüedad de Cartera" subtitle="Distribución por días de vencimiento">
        <div className="grid grid-cols-5 gap-4">
          {agingData.map((aging) => (
            <div
              key={aging.range}
              className="p-4 rounded-xl text-center"
              style={{ backgroundColor: `${aging.color}15`, borderColor: `${aging.color}30`, borderWidth: 1 }}
            >
              <div className="text-2xl font-bold" style={{ color: aging.color }}>
                {formatCurrency(aging.amount)}
              </div>
              <div className="text-sm text-[#a0a1a9] mt-1">{aging.range}</div>
              <div className="text-xs text-[#5c5d66] mt-0.5">{aging.count} facturas</div>
              <div className="mt-2">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${aging.color}30`, color: aging.color }}
                >
                  {formatPercent((aging.amount / totalReceivables) * 100, 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </FinancialCard>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Aging Chart */}
        <FinancialCard title="Distribución de Cartera" subtitle="Por antigüedad" span={6}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2b35" />
                <XAxis dataKey="range" stroke="#5c5d66" fontSize={11} />
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
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>

        {/* Collection History */}
        <FinancialCard title="Historial de Recaudo" subtitle="Últimos 6 meses" span={6}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2b35" />
                <XAxis dataKey="month" stroke="#5c5d66" fontSize={11} />
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
                <Bar dataKey="collected" name="Recaudado" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pendiente" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FinancialCard>
      </div>

      {/* Overdue Invoices Table */}
      <FinancialCard title="Facturas Vencidas" subtitle="Requieren gestión de cobro" action="Ver todas">
        <DataTable
          columns={[
            { key: 'id', label: 'Factura' },
            { key: 'client', label: 'Cliente' },
            { key: 'amount', label: 'Monto', align: 'right' },
            { key: 'dueDate', label: 'Vencimiento' },
            { key: 'days', label: 'Días', align: 'right' },
            { key: 'status', label: 'Estado', align: 'center' },
          ]}
          data={overdueInvoices.map((inv) => ({
            id: inv.id,
            client: inv.client,
            amount: formatCurrency(inv.amount),
            dueDate: new Date(inv.dueDate).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: 'short'
            }),
            days: inv.days,
            cells: {
              id: {
                render: (
                  <span className="font-mono text-xs text-indigo-400">{inv.id}</span>
                ),
              },
              days: {
                render: (
                  <span className={inv.days > 30 ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                    {inv.days}d
                  </span>
                ),
              },
              status: {
                render: (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    inv.status === 'overdue'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {inv.status === 'overdue' ? (
                      <>
                        <XCircle className="w-3 h-3" />
                        Vencida
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        Próxima
                      </>
                    )}
                  </span>
                ),
              },
            },
          }))}
        />
      </FinancialCard>

      {/* Clients with Debt */}
      <FinancialCard title="Clientes con Mayor Deuda" subtitle="Top 5 por saldo pendiente">
        <div className="space-y-4">
          {clientsWithDebt.map((client) => {
            const overdueRatio = client.total > 0 ? (client.overdue / client.total) * 100 : 0;
            return (
              <div key={client.client} className="p-4 bg-[#22232d] rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">{client.client}</h4>
                    <p className="text-xs text-[#5c5d66]">
                      {client.overdue > 0
                        ? `${formatPercent(overdueRatio, 0)} vencido`
                        : 'Sin vencimientos'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(client.total)}</div>
                    <div className="text-xs text-[#5c5d66]">saldo total</div>
                  </div>
                </div>
                <div className="h-2 bg-[#1a1b23] rounded-full overflow-hidden flex">
                  {client.overdue > 0 && (
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${overdueRatio}%` }}
                    />
                  )}
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${100 - overdueRatio}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-rose-400">
                    Vencido: {formatCurrency(client.overdue)}
                  </span>
                  <span className="text-emerald-400">
                    Vigente: {formatCurrency(client.current)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </FinancialCard>
    </div>
  );
};

export default ReceivablesSection;
