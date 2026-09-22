import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Megaphone } from 'lucide-react';
import { clientMetricsAPI } from '../../utils/api';

const fmtCOP = (v) => v ? '$' + Math.round(v).toLocaleString('es-CO') : '$0';
const fmtInt = (v) => Math.round(v || 0).toLocaleString('es-CO');
const fmtPct = (v) => `${(v || 0).toFixed(2)}%`;
const fmtRange = (start, end) => {
  const f = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
};

const roasClass = (roas) => roas >= 3 ? 'text-green-600' : roas >= 1 ? 'text-yellow-600' : 'text-red-600';

const STATUS = {
  ACTIVE: { label: 'Activa', cls: 'bg-green-100 text-green-700' },
  PAUSED: { label: 'Pausada', cls: 'bg-gray-100 text-gray-600' },
  CAMPAIGN_PAUSED: { label: 'Pausada', cls: 'bg-gray-100 text-gray-600' },
  ARCHIVED: { label: 'Archivada', cls: 'bg-gray-100 text-gray-500' },
  DELETED: { label: 'Eliminada', cls: 'bg-gray-100 text-gray-500' },
  WITH_ISSUES: { label: 'Con problemas', cls: 'bg-red-100 text-red-700' },
  IN_PROCESS: { label: 'En proceso', cls: 'bg-blue-100 text-blue-700' },
};
const statusOf = (code) => STATUS[code] || { label: code || '—', cls: 'bg-gray-100 text-gray-500' };

/** Roll ad-level rows up to campaign level. */
const aggregateCampaigns = (ads) => {
  const byId = {};
  for (const ad of ads) {
    const id = ad.campaign_id || ad.campaign_name;
    if (!byId[id]) {
      byId[id] = {
        id, name: ad.campaign_name || '—',
        objective: ad.campaign_objective_label || ad.campaign_objective || '—',
        status: ad.campaign_status || null,
        spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0, link_clicks: 0,
        landing_page_views: 0, messaging_conversations: 0, ads: 0,
      };
    }
    const c = byId[id];
    c.spend += ad.spend || 0;
    c.revenue += ad.revenue || 0;
    c.conversions += ad.conversions || 0;
    c.impressions += ad.impressions || 0;
    c.clicks += ad.clicks || 0;
    c.link_clicks += ad.link_clicks || 0;
    c.landing_page_views += ad.landing_page_views || 0;
    c.messaging_conversations += ad.messaging_conversations || 0;
    c.ads += 1;
  }
  return Object.values(byId).map(c => ({
    ...c,
    roas: c.spend > 0 ? c.revenue / c.spend : 0,
    cost_per_purchase: c.conversions > 0 ? c.spend / c.conversions : 0,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
  }));
};

/**
 * "Campañas Meta" section for a Growth client: campaign-level roll-up of the
 * ad insights for the selected period. Shows active campaigns by default.
 */
export default function MetaCampaignsPanel({ clientId, startDate, endDate, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState([]);
  const [message, setMessage] = useState(null);
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const res = await clientMetricsAPI.getAds(clientId, startDate, endDate);
        if (cancelled) return;
        setAds(res.data?.ads || []);
        if (res.data?.message) setMessage(res.data.message);
      } catch (error) {
        console.error('Error loading Meta campaigns:', error);
        if (!cancelled) { setAds([]); setMessage('No se pudieron cargar las campañas'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [clientId, startDate, endDate, refreshKey]);

  const campaigns = useMemo(() => aggregateCampaigns(ads), [ads]);
  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;
  const visible = useMemo(() => {
    const list = onlyActive ? campaigns.filter(c => c.status === 'ACTIVE') : campaigns;
    return [...list].sort((a, b) => b.spend - a.spend);
  }, [campaigns, onlyActive]);

  const totals = useMemo(() => {
    const t = visible.reduce((acc, c) => ({
      spend: acc.spend + c.spend, revenue: acc.revenue + c.revenue, conversions: acc.conversions + c.conversions,
      impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
    }), { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 });
    return {
      ...t,
      roas: t.spend > 0 ? t.revenue / t.spend : 0,
      cost_per_purchase: t.conversions > 0 ? t.spend / t.conversions : 0,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
    };
  }, [visible]);

  const showMessaging = visible.some(c => c.messaging_conversations > 0);

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Campañas Meta</span>
          <span className="text-[10px] text-gray-400">{fmtRange(startDate, endDate)}</span>
        </div>
        {!loading && campaigns.length > 0 && (
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setOnlyActive(true)}
              className={`px-2 py-1 rounded-md transition-colors ${onlyActive ? 'bg-[#17181A] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Activas ({activeCount})
            </button>
            <button
              onClick={() => setOnlyActive(false)}
              className={`px-2 py-1 rounded-md transition-colors ${!onlyActive ? 'bg-[#17181A] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Todas ({campaigns.length})
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm">{message || 'Sin campañas con actividad en este periodo'}</div>
      ) : visible.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm">Ninguna campaña activa en este periodo</div>
      ) : (
        <div className="overflow-x-auto px-4 pb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="px-3 py-2 text-left font-medium">Campaña</th>
                <th className="px-3 py-2 text-left font-medium">Objetivo</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Inversión</th>
                <th className="px-3 py-2 text-right font-medium">Ventas</th>
                <th className="px-3 py-2 text-right font-medium">ROAS</th>
                <th className="px-3 py-2 text-right font-medium">Compras</th>
                <th className="px-3 py-2 text-right font-medium">Costo/compra</th>
                {showMessaging && <th className="px-3 py-2 text-right font-medium">Conversaciones</th>}
                <th className="px-3 py-2 text-right font-medium">CTR</th>
                <th className="px-3 py-2 text-right font-medium">CPM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((c) => {
                const st = statusOf(c.status);
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 max-w-[260px]">
                      <p className="font-medium text-gray-900 truncate" title={c.name}>{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.ads} {c.ads === 1 ? 'anuncio' : 'anuncios'}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.objective}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">{fmtCOP(c.spend)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">{fmtCOP(c.revenue)}</td>
                    <td className="px-3 py-2 text-right"><span className={`font-medium ${roasClass(c.roas)}`}>{c.roas.toFixed(2)}</span></td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtInt(c.conversions)}</td>
                    <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">{c.conversions > 0 ? fmtCOP(c.cost_per_purchase) : '—'}</td>
                    {showMessaging && <td className="px-3 py-2 text-right text-gray-600">{fmtInt(c.messaging_conversations)}</td>}
                    <td className="px-3 py-2 text-right text-gray-600">{fmtPct(c.ctr)}</td>
                    <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">{fmtCOP(c.cpm)}</td>
                  </tr>
                );
              })}
            </tbody>
            {visible.length > 1 && (
              <tfoot>
                <tr className="border-t border-gray-200 text-xs font-medium text-gray-700 bg-gray-50">
                  <td className="px-3 py-2" colSpan={3}>Total ({visible.length} campañas)</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtCOP(totals.spend)}</td>
                  <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">{fmtCOP(totals.revenue)}</td>
                  <td className="px-3 py-2 text-right"><span className={roasClass(totals.roas)}>{totals.roas.toFixed(2)}</span></td>
                  <td className="px-3 py-2 text-right">{fmtInt(totals.conversions)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{totals.conversions > 0 ? fmtCOP(totals.cost_per_purchase) : '—'}</td>
                  {showMessaging && <td className="px-3 py-2 text-right">{fmtInt(visible.reduce((s, c) => s + c.messaging_conversations, 0))}</td>}
                  <td className="px-3 py-2 text-right">{fmtPct(totals.ctr)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmtCOP(totals.cpm)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <p className="text-[10px] text-gray-400 mt-2">Ventas y ROAS según atribución de Meta, no de Shopify.</p>
        </div>
      )}
    </div>
  );
}
