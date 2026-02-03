import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { invoicesAPI } from '../../../utils/api';

const IncomeTrendWidget = ({ widget, period }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await invoicesAPI.getAll();
        const invoices = response.data || [];

        // Group invoices by month and sum paid amounts
        const monthlyData = {};
        const now = new Date();

        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[key] = {
            month: d.toLocaleDateString('es-CO', { month: 'short' }),
            amount: 0,
          };
        }

        // Sum paid invoices
        invoices
          .filter(inv => inv.status === 'paid' && inv.paid_date)
          .forEach(inv => {
            const date = new Date(inv.paid_date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyData[key]) {
              monthlyData[key].amount += inv.amount || 0;
            }
          });

        setData(Object.values(monthlyData));
      } catch (error) {
        console.error('Error loading income trend:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [period]);

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString('es-CO')}`;
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-ink-900">Tendencia de Ingresos</h2>
      </div>

      {loading ? (
        <div className="h-48 bg-ink-100 rounded-lg animate-pulse" />
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [`$${value.toLocaleString('es-CO')}`, 'Ingresos']}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#22c55e' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default IncomeTrendWidget;
