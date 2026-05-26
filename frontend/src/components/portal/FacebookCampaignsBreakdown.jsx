import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, ChevronDown, Loader2, ExternalLink, Target, AlertCircle,
} from 'lucide-react';
import { portalMetricsAPI } from '../../utils/portalApi';

const fmtCurrency = (v) =>
  `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtRoas = (v) => `${(v || 0).toFixed(2)}x`;

const statusBadge = (status) => {
  if (!status) return null;
  if (status === 'ACTIVE') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Activa</span>;
  }
  if (status === 'PAUSED') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pausada</span>;
  }
  if (status === 'DELETED' || status === 'ARCHIVED') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Archivada</span>;
  }
  // CAMPAIGN_PAUSED, ADSET_PAUSED, IN_PROCESS, WITH_ISSUES, etc.
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status.replace(/_/g, ' ').toLowerCase()}</span>;
};

const ROAS_CLASS = (r) =>
  r >= 3 ? 'text-emerald-600 font-semibold'
    : r >= 1.5 ? 'text-amber-600 font-semibold'
    : r > 0 ? 'text-red-500 font-semibold'
    : 'text-gray-400';

export default function FacebookCampaignsBreakdown({ startDate, endDate }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  const [objectiveFilter, setObjectiveFilter] = useState('all'); // 'all' | objective label string

  useEffect(() => {
    if (!startDate || !endDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    portalMetricsAPI.getAds({ start_date: startDate, end_date: endDate })
      .then((data) => {
        if (cancelled) return;
        setAds(data?.ads || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error || err.message || 'Error al cargar campañas');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  // Group ads by campaign → adset → ad
  const campaigns = useMemo(() => {
    const map = new Map();
    let totalSpend = 0;

    for (const ad of ads) {
      const cId = ad.campaign_id || `unnamed-${ad.campaign_name || 'sin-campaña'}`;
      const aId = ad.adset_id || `unnamed-${ad.adset_name || 'sin-adset'}`;

      if (!map.has(cId)) {
        map.set(cId, {
          campaign_id: cId,
          campaign_name: ad.campaign_name || 'Sin nombre',
          objective: ad.campaign_objective_label || ad.campaign_objective || null,
          status: ad.campaign_status || null,
          spend: 0, conversions: 0, revenue: 0,
          adsets: new Map(),
        });
      }
      const c = map.get(cId);
      c.spend += ad.spend || 0;
      c.conversions += ad.conversions || 0;
      c.revenue += ad.revenue || 0;

      if (!c.adsets.has(aId)) {
        c.adsets.set(aId, {
          adset_id: aId,
          adset_name: ad.adset_name || 'Sin nombre',
          status: ad.adset_status || null,
          spend: 0, conversions: 0, revenue: 0,
          ads: [],
        });
      }
      const a = c.adsets.get(aId);
      a.spend += ad.spend || 0;
      a.conversions += ad.conversions || 0;
      a.revenue += ad.revenue || 0;
      a.ads.push(ad);
      totalSpend += ad.spend || 0;
    }

    let list = Array.from(map.values()).map((c) => ({
      ...c,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      adsets: Array.from(c.adsets.values())
        .map((a) => ({
          ...a,
          roas: a.spend > 0 ? a.revenue / a.spend : 0,
          ads: a.ads.sort((x, y) => (y.spend || 0) - (x.spend || 0)),
        }))
        .sort((a, b) => b.spend - a.spend),
    }));

    // Only campaigns with spend > 0 (rule from user)
    list = list.filter((c) => c.spend > 0);

    // List of available objectives (built BEFORE applying status/objective
    // filters so the dropdown stays useful even when the user filters down).
    const objectives = Array.from(
      new Set(list.map((c) => c.objective).filter(Boolean))
    ).sort();

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((c) => {
        if (statusFilter === 'ACTIVE') return c.status === 'ACTIVE';
        if (statusFilter === 'PAUSED') return c.status === 'PAUSED' || c.status === 'CAMPAIGN_PAUSED' || c.status === 'ADSET_PAUSED';
        if (statusFilter === 'ARCHIVED') return c.status === 'ARCHIVED' || c.status === 'DELETED';
        return true;
      });
    }

    // Objective filter
    if (objectiveFilter !== 'all') {
      list = list.filter((c) => c.objective === objectiveFilter);
    }

    list.sort((a, b) => b.spend - a.spend);

    // Totals for the currently filtered set — feeds the tfoot row.
    const totals = list.reduce(
      (acc, c) => ({
        spend: acc.spend + (c.spend || 0),
        conversions: acc.conversions + (c.conversions || 0),
        revenue: acc.revenue + (c.revenue || 0),
      }),
      { spend: 0, conversions: 0, revenue: 0 }
    );
    totals.roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    totals.costPerConversion = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

    return { list, totalSpend, objectives, totals };
  }, [ads, statusFilter, objectiveFilter]);

  const toggleCampaign = (id) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAdset = (id) => {
    setExpandedAdsets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-3 text-sm text-gray-500">Cargando campañas…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (campaigns.list.length === 0) {
    return (
      <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500">
        <Target className="w-10 h-10 mx-auto text-gray-300 mb-2" />
        <p className="text-sm">Sin campañas con inversión en el período seleccionado.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Detalle por campaña</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {campaigns.list.length} campaña{campaigns.list.length !== 1 ? 's' : ''} con inversión · Click para expandir
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={objectiveFilter}
            onChange={(e) => setObjectiveFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            title="Filtrar por objetivo de campaña"
          >
            <option value="all">Todos los objetivos</option>
            {campaigns.objectives?.map((obj) => (
              <option key={obj} value={obj}>{obj}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            title="Filtrar por estado"
          >
            <option value="all">Todas</option>
            <option value="ACTIVE">Activas</option>
            <option value="PAUSED">Pausadas</option>
            <option value="ARCHIVED">Archivadas</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 900 }}>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100 bg-gray-50/50">
              <th className="text-left py-2 px-4 font-medium">Campaña / Ad set / Anuncio</th>
              <th className="text-left py-2 px-3 font-medium">Objetivo</th>
              <th className="text-left py-2 px-3 font-medium">Estado</th>
              <th className="text-right py-2 px-3 font-medium">Inversión</th>
              <th className="text-right py-2 px-3 font-medium">Conversiones</th>
              <th className="text-right py-2 px-3 font-medium">Revenue</th>
              <th className="text-right py-2 px-3 font-medium">ROAS</th>
              <th className="text-center py-2 px-3 font-medium w-20">Ver</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.list.map((c) => {
              const isOpen = expandedCampaigns.has(c.campaign_id);
              const pct = campaigns.totalSpend > 0 ? (c.spend / campaigns.totalSpend) * 100 : 0;
              return (
                <FragmentGroup key={c.campaign_id}>
                  <tr
                    onClick={() => toggleCampaign(c.campaign_id)}
                    className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium text-[#1A1A2E] truncate">{c.campaign_name}</p>
                          <div className="h-1 mt-1.5 bg-gray-100 rounded-full overflow-hidden" style={{ width: 140 }}>
                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% del spend total</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {c.objective && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                          {c.objective}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">{statusBadge(c.status)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-[#1A1A2E]">{fmtCurrency(c.spend)}</td>
                    <td className="py-3 px-3 text-right">{fmtInt(c.conversions)}</td>
                    <td className="py-3 px-3 text-right">{fmtCurrency(c.revenue)}</td>
                    <td className={`py-3 px-3 text-right ${ROAS_CLASS(c.roas)}`}>{fmtRoas(c.roas)}</td>
                    <td className="py-3 px-3" />
                  </tr>

                  {isOpen && c.adsets.map((a) => {
                    const adsetOpen = expandedAdsets.has(a.adset_id);
                    return (
                      <FragmentGroup key={a.adset_id}>
                        <tr
                          onClick={() => toggleAdset(a.adset_id)}
                          className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer bg-gray-50/40"
                        >
                          <td className="py-2 pl-12 pr-4">
                            <div className="flex items-center gap-2">
                              {adsetOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                              <p className="text-sm text-gray-700 truncate">{a.adset_name}</p>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-400">Ad set</td>
                          <td className="py-2 px-3">{statusBadge(a.status)}</td>
                          <td className="py-2 px-3 text-right">{fmtCurrency(a.spend)}</td>
                          <td className="py-2 px-3 text-right">{fmtInt(a.conversions)}</td>
                          <td className="py-2 px-3 text-right">{fmtCurrency(a.revenue)}</td>
                          <td className={`py-2 px-3 text-right ${ROAS_CLASS(a.roas)}`}>{fmtRoas(a.roas)}</td>
                          <td className="py-2 px-3" />
                        </tr>

                        {adsetOpen && a.ads.map((ad) => (
                          <tr key={ad.ad_id} className="border-b border-gray-50 hover:bg-gray-50/80 bg-white">
                            <td className="py-2 pl-20 pr-4">
                              <p className="text-sm text-gray-600 truncate">{ad.ad_name}</p>
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-400">Anuncio</td>
                            <td className="py-2 px-3" />
                            <td className="py-2 px-3 text-right">{fmtCurrency(ad.spend)}</td>
                            <td className="py-2 px-3 text-right">{fmtInt(ad.conversions)}</td>
                            <td className="py-2 px-3 text-right">{fmtCurrency(ad.revenue)}</td>
                            <td className={`py-2 px-3 text-right ${ROAS_CLASS(ad.roas)}`}>{fmtRoas(ad.roas)}</td>
                            <td className="py-2 px-3 text-center">
                              {ad.preview_url && (
                                <a
                                  href={ad.preview_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                  title="Ver anuncio en Facebook"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </FragmentGroup>
                    );
                  })}
                </FragmentGroup>
              );
            })}
          </tbody>
          {campaigns.list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-[#1A1A2E]">
                <td className="py-3 px-4">
                  Total
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    ({campaigns.list.length} campaña{campaigns.list.length !== 1 ? 's' : ''})
                  </span>
                </td>
                <td className="py-3 px-3" />
                <td className="py-3 px-3" />
                <td className="py-3 px-3 text-right">{fmtCurrency(campaigns.totals.spend)}</td>
                <td className="py-3 px-3 text-right">
                  {fmtInt(campaigns.totals.conversions)}
                  {campaigns.totals.conversions > 0 && (
                    <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                      {fmtCurrency(campaigns.totals.costPerConversion)} / conv.
                    </p>
                  )}
                </td>
                <td className="py-3 px-3 text-right">{fmtCurrency(campaigns.totals.revenue)}</td>
                <td className={`py-3 px-3 text-right ${ROAS_CLASS(campaigns.totals.roas)}`}>
                  {fmtRoas(campaigns.totals.roas)}
                </td>
                <td className="py-3 px-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// Helper so we can return multiple <tr> without an extra wrapper element
function FragmentGroup({ children }) {
  return <>{children}</>;
}
