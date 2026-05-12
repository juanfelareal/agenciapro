import { useEffect, useState } from 'react';
import { Target, Settings, X, Save } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { dashboardAPI, salesGoalsAPI } from '../../../utils/api';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Forecast inicial para 2026 (lo proporcionó el usuario)
const FORECAST_2026 = {
  1: 69945708, 2: 63590192, 3: 63749163, 4: 56590671,
  5: 78125697, 6: 82792423, 7: 79457326, 8: 79784856,
  9: 77961124, 10: 82109724, 11: 92438448, 12: 103631504,
};

const formatCurrency = (value) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value || 0).toLocaleString('es-CO')}`;
};

const formatCurrencyFull = (value) => `$${Math.round(value || 0).toLocaleString('es-CO')}`;

const formatDelta = (value) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const MonthlySalesGoalWidget = () => {
  const year = new Date().getFullYear();
  const [data, setData] = useState({ year, prevYear: year - 1, months: [] });
  const [loading, setLoading] = useState(true);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goalsDraft, setGoalsDraft] = useState({});
  const [savingGoals, setSavingGoals] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getMonthlySalesComparison(year);
      setData(res.data);
    } catch (err) {
      console.error('Error loading monthly sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-seed forecast if no goals yet
  useEffect(() => {
    if (loading) return;
    const hasGoals = data.months.some((m) => m.goal > 0);
    if (!hasGoals && year === 2026) {
      const goals = Object.entries(FORECAST_2026).map(([month, goal_amount]) => ({
        month: Number(month),
        goal_amount,
      }));
      salesGoalsAPI.bulkUpsert(year, goals).then(() => load()).catch(() => {});
    }
  }, [loading]);

  const openGoalsModal = () => {
    const draft = {};
    data.months.forEach((m) => { draft[m.month] = m.goal || FORECAST_2026[m.month] || 0; });
    setGoalsDraft(draft);
    setShowGoalsModal(true);
  };

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    try {
      const goals = Object.entries(goalsDraft).map(([month, goal_amount]) => ({
        month: Number(month),
        goal_amount: Number(goal_amount) || 0,
      }));
      await salesGoalsAPI.bulkUpsert(year, goals);
      setShowGoalsModal(false);
      await load();
    } finally {
      setSavingGoals(false);
    }
  };

  const chartData = data.months.map((m) => ({
    month: MONTH_LABELS[m.month - 1],
    'Este año': m.sales_net,
    'Año anterior': m.prev_sales_net,
    Meta: m.goal,
  }));

  const currentMonth = new Date().getMonth() + 1;
  const currentMonthData = data.months.find((m) => m.month === currentMonth);
  const currentSales = currentMonthData?.sales_net || 0;
  const currentGoal = currentMonthData?.goal || 0;
  const pct = currentGoal > 0 ? (currentSales / currentGoal) * 100 : 0;
  const pctColor = pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500';
  const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">Ventas Mensuales · Meta {data.year}</h2>
        </div>
        <button
          onClick={openGoalsModal}
          className="p-2 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-ink-900"
          title="Editar metas"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Mes actual stat */}
      <div className="mb-5 p-4 rounded-xl bg-ink-50 border border-ink-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-ink-500 uppercase tracking-wide">Mes actual ({MONTH_LABELS[currentMonth - 1]})</p>
            <p className="text-2xl font-bold text-ink-900 mt-1">{formatCurrency(currentSales)}</p>
            <p className="text-xs text-ink-500 mt-1">de {formatCurrency(currentGoal)}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${pctColor}`}>{pct.toFixed(0)}%</p>
            <p className="text-xs text-ink-500">de la meta</p>
          </div>
        </div>
        <div className="h-2 bg-ink-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="h-72 bg-ink-100 rounded-lg animate-pulse" />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value, name) => [formatCurrencyFull(value), name]}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Año anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Este año" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Meta" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla mensual detallada */}
      {!loading && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="text-left py-2 px-2 font-medium">Mes</th>
                <th className="text-right py-2 px-2 font-medium">Venta neta {data.year}</th>
                <th className="text-right py-2 px-2 font-medium">vs Año anterior</th>
                <th className="text-right py-2 px-2 font-medium">vs Meta</th>
                <th className="text-right py-2 px-2 font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {data.months.filter((m) => m.month <= currentMonth).map((m) => {
                const isCurrentMonth = m.month === currentMonth;
                const prevDelta = m.prev_sales_net > 0
                  ? ((m.sales_net - m.prev_sales_net) / m.prev_sales_net) * 100
                  : null;
                const goalPct = m.goal > 0 ? (m.sales_net / m.goal) * 100 : null;
                const goalDiff = m.sales_net - (m.goal || 0);
                return (
                  <tr
                    key={m.month}
                    className={`border-b border-ink-50 ${isCurrentMonth ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="py-2 px-2 font-medium text-ink-700">
                      {MONTH_LABELS[m.month - 1]}
                      {isCurrentMonth && <span className="ml-1 text-xs text-blue-600">·</span>}
                    </td>
                    <td className="text-right py-2 px-2 text-ink-900 font-medium">
                      {formatCurrencyFull(m.sales_net)}
                    </td>
                    <td className={`text-right py-2 px-2 ${
                      prevDelta == null ? 'text-ink-400' : prevDelta >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {prevDelta == null ? '—' : formatDelta(prevDelta)}
                    </td>
                    <td className={`text-right py-2 px-2 ${
                      goalPct == null ? 'text-ink-400' :
                      goalPct >= 100 ? 'text-emerald-600' :
                      goalPct >= 70 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {goalPct == null ? '—' : `${goalPct.toFixed(0)}%`}
                    </td>
                    <td className={`text-right py-2 px-2 ${
                      m.goal === 0 ? 'text-ink-400' : goalDiff >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {m.goal === 0 ? '—' : `${goalDiff >= 0 ? '+' : ''}${formatCurrencyFull(goalDiff)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen acumulado YTD y total año */}
      {!loading && (() => {
        const ytdMonths = data.months.filter((m) => m.month <= currentMonth);
        const ytdSales = ytdMonths.reduce((s, m) => s + m.sales_net, 0);
        const ytdGoal = ytdMonths.reduce((s, m) => s + (m.goal || 0), 0);
        const ytdPct = ytdGoal > 0 ? (ytdSales / ytdGoal) * 100 : 0;
        const ytdDiff = ytdSales - ytdGoal;

        const yearSales = data.months.reduce((s, m) => s + m.sales_net, 0);
        const yearGoal = data.months.reduce((s, m) => s + (m.goal || 0), 0);
        const yearPct = yearGoal > 0 ? (yearSales / yearGoal) * 100 : 0;
        const yearDiff = yearSales - yearGoal;

        const ytdColor = ytdPct >= 100 ? 'text-emerald-600' : ytdPct >= 70 ? 'text-amber-600' : 'text-red-500';

        return (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100">
              <p className="text-xs uppercase tracking-wide text-blue-700 font-medium">Acumulado YTD (Ene–{MONTH_LABELS[currentMonth - 1]})</p>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-2xl font-bold text-ink-900">{formatCurrencyFull(ytdSales)}</p>
                <p className={`text-2xl font-bold ${ytdColor}`}>{ytdPct.toFixed(0)}%</p>
              </div>
              <p className="text-xs text-ink-600 mt-1">
                Meta acumulada: {formatCurrencyFull(ytdGoal)}
              </p>
              <p className={`text-sm font-medium mt-1 ${ytdDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {ytdDiff >= 0 ? 'Superando' : 'Faltan'} {formatCurrencyFull(Math.abs(ytdDiff))}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100">
              <p className="text-xs uppercase tracking-wide text-emerald-700 font-medium">Proyección año {data.year}</p>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-2xl font-bold text-ink-900">{formatCurrencyFull(yearSales)}</p>
                <p className="text-2xl font-bold text-ink-700">{yearPct.toFixed(0)}%</p>
              </div>
              <p className="text-xs text-ink-600 mt-1">
                Meta anual: {formatCurrencyFull(yearGoal)}
              </p>
              <p className={`text-sm font-medium mt-1 ${yearDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {yearDiff >= 0 ? 'Superando por' : 'Faltan'} {formatCurrencyFull(Math.abs(yearDiff))}
              </p>
            </div>
          </div>
        );
      })()}

      {showGoalsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex justify-between items-center p-6 pb-4 border-b border-ink-100">
              <h2 className="text-xl font-semibold text-ink-900">Editar metas {year}</h2>
              <button onClick={() => setShowGoalsModal(false)} className="p-2 hover:bg-ink-100 rounded-xl">
                <X size={20} className="text-ink-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {MONTH_LABELS.map((label, idx) => {
                const month = idx + 1;
                return (
                  <div key={month} className="flex items-center gap-3">
                    <label className="text-sm font-medium text-ink-700 w-12">{label}</label>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-ink-500">$</span>
                      <input
                        type="number"
                        value={goalsDraft[month] || 0}
                        onChange={(e) => setGoalsDraft({ ...goalsDraft, [month]: e.target.value })}
                        className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-6 pt-4 border-t border-ink-100 flex justify-end gap-2">
              <button
                onClick={() => setShowGoalsModal(false)}
                className="px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGoals}
                disabled={savingGoals}
                className="px-4 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] flex items-center gap-2"
              >
                <Save size={16} />
                {savingGoals ? 'Guardando…' : 'Guardar metas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlySalesGoalWidget;
