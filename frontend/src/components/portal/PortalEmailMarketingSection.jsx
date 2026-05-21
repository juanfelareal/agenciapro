import { useEffect, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { portalEmailMarketingAPI } from '../../utils/portalApi';

const fmtCurrency = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;
const rate = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

export default function PortalEmailMarketingSection({ getApiParams }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = getApiParams ? getApiParams() : {};
    portalEmailMarketingAPI
      .list({ start_date: params.start_date, end_date: params.end_date })
      .then((data) => {
        if (cancelled) return;
        setCampaigns(data?.campaigns || []);
      })
      .catch(() => { if (!cancelled) setCampaigns([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [getApiParams?.()?.start_date, getApiParams?.()?.end_date]);

  const totals = campaigns.reduce(
    (acc, c) => ({
      recipients: acc.recipients + (c.recipients || 0),
      delivered: acc.delivered + (c.delivered || 0),
      opens: acc.opens + (c.opens || 0),
      clicks: acc.clicks + (c.clicks || 0),
      unsubscribes: acc.unsubscribes + (c.unsubscribes || 0),
      orders: acc.orders + (c.orders || 0),
      revenue: acc.revenue + (c.revenue || 0),
    }),
    { recipients: 0, delivered: 0, opens: 0, clicks: 0, unsubscribes: 0, orders: 0, revenue: 0 }
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#1A1A2E] flex items-center gap-2">
          <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
            <Mail className="w-4 h-4 text-pink-600" />
          </div>
          Email Marketing
        </h2>
        {!loading && campaigns.length > 0 && (
          <span className="text-xs text-gray-400">
            {campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''} en el período
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div className="py-6 text-center text-gray-500">
          <Mail className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm">Aún no se han registrado campañas de email marketing en este período.</p>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Enviados" value={fmtInt(totals.recipients)} />
            <Stat label="Aperturas" value={fmtInt(totals.opens)} sub={fmtPct(rate(totals.opens, totals.delivered))} />
            <Stat label="Clicks" value={fmtInt(totals.clicks)} sub={fmtPct(rate(totals.clicks, totals.delivered))} />
            <Stat label="Revenue" value={fmtCurrency(totals.revenue)} sub={`${fmtInt(totals.orders)} pedidos`} accent="text-emerald-600" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 pr-3 font-medium">Campaña</th>
                  <th className="text-left py-2 px-3 font-medium">Fecha</th>
                  <th className="text-right py-2 px-3 font-medium">Enviados</th>
                  <th className="text-right py-2 px-3 font-medium">Apertura</th>
                  <th className="text-right py-2 px-3 font-medium">Click</th>
                  <th className="text-right py-2 px-3 font-medium">Pedidos</th>
                  <th className="text-right py-2 pl-3 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-[#1A1A2E]">{c.campaign_name}</p>
                      {c.subject && <p className="text-xs text-gray-400">{c.subject}</p>}
                    </td>
                    <td className="py-2 px-3 text-gray-600">{fmtDate(c.sent_date)}</td>
                    <td className="py-2 px-3 text-right">{fmtInt(c.recipients)}</td>
                    <td className="py-2 px-3 text-right">{fmtPct(rate(c.opens, c.delivered))}</td>
                    <td className="py-2 px-3 text-right">{fmtPct(rate(c.clicks, c.delivered))}</td>
                    <td className="py-2 px-3 text-right">{fmtInt(c.orders)}</td>
                    <td className="py-2 pl-3 text-right font-semibold">{fmtCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const Stat = ({ label, value, sub, accent = 'text-[#1A1A2E]' }) => (
  <div className="bg-gray-50 rounded-xl p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-lg font-bold ${accent}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);
