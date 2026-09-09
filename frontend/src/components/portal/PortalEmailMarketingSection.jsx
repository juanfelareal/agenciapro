import { useEffect, useState } from 'react';
import { Mail, Loader2, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Send } from 'lucide-react';
import { portalEmailMarketingAPI } from '../../utils/portalApi';

const fmtCurrency = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;
const rate = (a, b) => (b > 0 ? (a / b) * 100 : 0);

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const formatMonth = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;

export default function PortalEmailMarketingSection({ getApiParams }) {
  const [data, setData] = useState({ months: [], totals: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = getApiParams ? getApiParams() : {};
    portalEmailMarketingAPI
      .list({ start_date: params.start_date, end_date: params.end_date })
      .then((res) => {
        if (cancelled) return;
        setData({ months: res?.months || [], totals: res?.totals || null });
      })
      .catch(() => { if (!cancelled) setData({ months: [], totals: null }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [getApiParams?.()?.start_date, getApiParams?.()?.end_date]);

  const { months, totals } = data;
  const hasData = months.length > 0 && totals;

  // Calculate rates
  const totalDeliveries = hasData ? (totals.campaigns_deliveries + totals.flows_deliveries) : 0;
  const totalOpens = hasData ? (totals.campaigns_opens + totals.flows_opens) : 0;
  const totalClicks = hasData ? (totals.campaigns_clicks + totals.flows_clicks) : 0;
  const totalRevenue = hasData ? (totals.campaigns_revenue + totals.flows_revenue) : 0;
  const totalConversions = hasData ? (totals.campaigns_conversions + totals.flows_conversions) : 0;
  const openRate = rate(totalOpens, totalDeliveries);
  const clickRate = rate(totalClicks, totalOpens);
  const conversionRate = rate(totalConversions, totalDeliveries);

  // Net list growth
  const netGrowth = hasData ? (totals.monthly_subscriptions - totals.monthly_unsubscribes) : 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#17181A] flex items-center gap-2">
          <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
            <Mail className="w-4 h-4 text-pink-600" />
          </div>
          Email Marketing
        </h2>
        {!loading && hasData && (
          <span className="text-xs text-gray-400">
            {months.length} mes{months.length !== 1 ? 'es' : ''} con datos
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      )}

      {!loading && !hasData && (
        <div className="py-6 text-center text-gray-500">
          <Mail className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm">Aún no se han registrado métricas de email marketing.</p>
        </div>
      )}

      {!loading && hasData && (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat
              label="Ventas totales"
              value={fmtCurrency(totalRevenue)}
              sub={`${fmtInt(totalConversions)} conversiones`}
              accent="text-emerald-600"
            />
            <Stat
              label="Correos enviados"
              value={fmtInt(totalDeliveries)}
            />
            <Stat
              label="Tasa de apertura"
              value={fmtPct(openRate)}
              sub={`${fmtInt(totalOpens)} aperturas`}
            />
            <Stat
              label="Tasa de clics"
              value={fmtPct(clickRate)}
              sub={`${fmtPct(conversionRate)} conv.`}
            />
          </div>

          {/* Campaigns vs Flows breakdown */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Campañas</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{fmtCurrency(totals.campaigns_revenue)}</p>
              <p className="text-xs text-blue-600/70 mt-1">
                {fmtInt(totals.campaigns_deliveries)} enviados · {fmtPct(rate(totals.campaigns_opens, totals.campaigns_deliveries))} apertura
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Flujos automatizados</span>
              </div>
              <p className="text-xl font-bold text-purple-600">{fmtCurrency(totals.flows_revenue)}</p>
              <p className="text-xs text-purple-600/70 mt-1">
                {fmtInt(totals.flows_deliveries)} enviados · {fmtPct(rate(totals.flows_opens, totals.flows_deliveries))} apertura
              </p>
            </div>
          </div>

          {/* List Growth */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Crecimiento de lista</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-emerald-600">
                  <ArrowUpRight className="w-3 h-3" />
                  +{fmtInt(totals.monthly_subscriptions)} suscripciones
                </span>
                <span className="flex items-center gap-1 text-red-500">
                  <ArrowDownRight className="w-3 h-3" />
                  -{fmtInt(totals.monthly_unsubscribes)} bajas
                </span>
                <span className={`font-semibold ${netGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  = {netGrowth >= 0 ? '+' : ''}{fmtInt(netGrowth)} neto
                </span>
              </div>
            </div>
            {totals.master_segment_size > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Tamaño actual de lista: {fmtInt(totals.master_segment_size)} suscriptores
              </p>
            )}
          </div>

          {/* Monthly breakdown table */}
          {months.length > 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 pr-3 font-medium">Mes</th>
                    <th className="text-right py-2 px-3 font-medium">Campañas</th>
                    <th className="text-right py-2 px-3 font-medium">Flujos</th>
                    <th className="text-right py-2 px-3 font-medium">Total</th>
                    <th className="text-right py-2 px-3 font-medium">Enviados</th>
                    <th className="text-right py-2 px-3 font-medium">Apertura</th>
                    <th className="text-right py-2 pl-3 font-medium">Crec. lista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {months.map((m) => {
                    const mDeliveries = (m.campaigns_deliveries || 0) + (m.flows_deliveries || 0);
                    const mOpens = (m.campaigns_opens || 0) + (m.flows_opens || 0);
                    const mRevenue = (m.campaigns_revenue || 0) + (m.flows_revenue || 0);
                    const mNet = (m.monthly_subscriptions || 0) - (m.monthly_unsubscribes || 0);
                    return (
                      <tr key={`${m.year}-${m.month}`}>
                        <td className="py-2 pr-3 font-medium text-gray-900">
                          {formatMonth(m.year, m.month)}
                        </td>
                        <td className="py-2 px-3 text-right text-blue-600">{fmtCurrency(m.campaigns_revenue)}</td>
                        <td className="py-2 px-3 text-right text-purple-600">{fmtCurrency(m.flows_revenue)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-emerald-600">{fmtCurrency(mRevenue)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{fmtInt(mDeliveries)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{fmtPct(rate(mOpens, mDeliveries))}</td>
                        <td className={`py-2 pl-3 text-right ${mNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {mNet >= 0 ? '+' : ''}{fmtInt(mNet)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Stat = ({ label, value, sub, accent = 'text-[#17181A]' }) => (
  <div className="bg-gray-50 rounded-xl p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-lg font-bold ${accent}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);
