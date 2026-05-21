import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Download, X, FileText, Loader2 } from 'lucide-react';
import { portalMetricsAPI, portalEmailMarketingAPI } from '../../utils/portalApi';
import { LA_REAL_LOGO_BASE64 } from '../../assets/laRealLogo';

// ====== Formatters ======
const fmtCurrency = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtRoas = (v) => `${(v || 0).toFixed(2)}x`;
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;
const rate = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const fmtDelta = (v) => {
  if (v == null || !isFinite(v)) return '';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
};
const deltaColor = (v, inverted = false) => {
  if (v == null) return '#9ca3af';
  const positive = inverted ? v < 0 : v > 0;
  if (Math.abs(v) < 0.05) return '#9ca3af';
  return positive ? '#16a34a' : '#dc2626';
};
const fmtDateShort = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};
const fmtDateLong = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ====== Color palette (LA REAL) ======
const C = {
  ink: '#0D1B2A',
  inkSoft: '#1F2937',
  bone: '#F8F5F0',
  cream: '#FFFCF7',
  hairline: '#E5E2DD',
  green: '#16a34a',
  greenSoft: '#DCFCE7',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  blue: '#1D4ED8',
  blueSoft: '#DBEAFE',
  pink: '#DB2777',
  pinkSoft: '#FCE7F3',
  violet: '#7C3AED',
  violetSoft: '#EDE9FE',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
};

// ====== Reusable atoms (inline styles) ======
const SectionHeader = ({ number, title, accent }) => (
  <div className="section-header" style={{
    display: 'flex',
    alignItems: 'baseline',
    gap: '14px',
    borderBottom: `1px solid ${C.hairline}`,
    paddingBottom: '8px',
    marginBottom: '14px',
    marginTop: '6px',
    breakAfter: 'avoid',
    pageBreakAfter: 'avoid',
  }}>
    <span style={{
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '2px',
      color: accent || C.ink,
    }}>{String(number).padStart(2, '0')}</span>
    <h2 style={{
      fontSize: '15px',
      fontWeight: 700,
      letterSpacing: '-0.3px',
      color: C.ink,
      margin: 0,
      flex: 1,
    }}>{title}</h2>
    <span style={{
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: accent,
      display: 'inline-block',
    }} />
  </div>
);

const Card = ({ label, value, change, inverted, sublabel, accent }) => (
  <div style={{
    border: `1px solid ${C.hairline}`,
    borderRadius: '10px',
    padding: '12px 14px',
    background: C.cream,
    position: 'relative',
    boxShadow: '0 1px 2px rgba(13, 27, 42, 0.04)',
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  }}>
    {accent && (
      <span style={{
        position: 'absolute',
        left: 0, top: '10px', bottom: '10px',
        width: '3px',
        borderRadius: '0 3px 3px 0',
        background: accent,
      }} />
    )}
    <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6px', color: C.textMuted, margin: 0, fontWeight: 500 }}>{label}</p>
    <p style={{ fontSize: '17px', fontWeight: 700, color: C.ink, letterSpacing: '-0.5px', margin: '5px 0 0 0' }}>{value}</p>
    {sublabel && <p style={{ fontSize: '9px', color: C.textLight, margin: '2px 0 0 0' }}>{sublabel}</p>}
    {change != null && (
      <p style={{ fontSize: '10px', fontWeight: 600, color: deltaColor(change, inverted), margin: '3px 0 0 0' }}>
        {fmtDelta(change)} <span style={{ color: C.textLight, fontWeight: 400 }}>vs anterior</span>
      </p>
    )}
  </div>
);

const grid = (cols, gap = '8px') => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap,
  marginBottom: '12px',
});

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '10px' };
const th = { textAlign: 'left', padding: '7px 8px', borderBottom: `1.5px solid ${C.ink}`, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', color: C.ink, fontWeight: 700 };
const td = { padding: '8px', borderBottom: `1px solid ${C.hairline}`, color: C.inkSoft };

const badge = (bg, color) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '999px',
  background: bg,
  color,
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.2px',
});

const statusBadge = (s) => {
  if (s === 'ACTIVE') return <span style={badge(C.greenSoft, C.green)}>Activa</span>;
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return <span style={badge(C.amberSoft, C.amber)}>Pausada</span>;
  if (s === 'ARCHIVED' || s === 'DELETED') return <span style={badge('#F3F4F6', '#6B7280')}>Archivada</span>;
  return null;
};

// ====== Template ======
export const PdfTemplate = ({ client, period, insights, metrics, ads, emailCampaigns }) => {
  const fb = metrics?.facebook;
  const sh = metrics?.shopify;
  const blended = metrics?.blended;
  const topProducts = metrics?.shopify?.top_products || [];

  // Group ads by campaign
  const campaigns = [];
  if (ads?.length) {
    const map = new Map();
    let total = 0;
    for (const ad of ads) {
      const cid = ad.campaign_id || ad.campaign_name || 'sin-campaña';
      if (!map.has(cid)) {
        map.set(cid, {
          name: ad.campaign_name || 'Sin nombre',
          objective: ad.campaign_objective_label || ad.campaign_objective || '',
          status: ad.campaign_status || '',
          spend: 0, conversions: 0, revenue: 0,
        });
      }
      const c = map.get(cid);
      c.spend += ad.spend || 0;
      c.conversions += ad.conversions || 0;
      c.revenue += ad.revenue || 0;
      total += ad.spend || 0;
    }
    for (const c of map.values()) {
      if (c.spend > 0) {
        c.roas = c.spend > 0 ? c.revenue / c.spend : 0;
        c.share = total > 0 ? (c.spend / total) * 100 : 0;
        campaigns.push(c);
      }
    }
    campaigns.sort((a, b) => b.spend - a.spend);
  }

  // Email totals
  const emailTotals = (emailCampaigns || []).reduce((acc, c) => ({
    recipients: acc.recipients + (c.recipients || 0),
    delivered: acc.delivered + (c.delivered || 0),
    opens: acc.opens + (c.opens || 0),
    clicks: acc.clicks + (c.clicks || 0),
    unsubscribes: acc.unsubscribes + (c.unsubscribes || 0),
    orders: acc.orders + (c.orders || 0),
    revenue: acc.revenue + (c.revenue || 0),
  }), { recipients: 0, delivered: 0, opens: 0, clicks: 0, unsubscribes: 0, orders: 0, revenue: 0 });

  const clientLabel = (client?.company || client?.name || 'Cliente').toUpperCase();
  const periodLabel = period ? `${fmtDateLong(period.start_date?.split('T')[0])} — ${fmtDateLong(period.end_date?.split('T')[0])}` : '';

  return (
    <div style={{
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: C.ink,
      background: C.bone,
      fontSize: '11px',
      lineHeight: 1.45,
      padding: '0 14mm 6mm 14mm',
    }}>
      {/* ============ HEADER DARK (banner card, not full-bleed) ============ */}
      <table style={{
        width: '100%',
        background: C.ink,
        color: C.bone,
        borderRadius: '12px',
        margin: '8mm 0 10mm 0',
        borderCollapse: 'separate',
      }}>
        <tbody>
          <tr>
            <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
              <table>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: '14px', verticalAlign: 'middle' }}>
                      <img src={LA_REAL_LOGO_BASE64} alt="LA REAL" style={{ width: '40px', height: '40px', objectFit: 'contain', display: 'block' }} />
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <p style={{ fontSize: '8px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a8b3c5', margin: 0 }}>LA REAL MARKETING</p>
                      <p style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.8px', color: '#fff', margin: '2px 0 0 0' }}>Reporte de marketing</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'right' }}>
              <p style={{ fontSize: '8px', letterSpacing: '3px', textTransform: 'uppercase', color: '#a8b3c5', margin: 0 }}>Cliente</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: '2px 0 0 0', letterSpacing: '-0.2px' }}>{clientLabel}</p>
              <p style={{ fontSize: '9px', color: '#a8b3c5', margin: '3px 0 0 0' }}>{periodLabel}</p>
              <p style={{ fontSize: '8px', color: '#6c7a91', margin: '1px 0 0 0' }}>
                Emitido el {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ BODY ============ */}
      <div>
        {/* Insights */}
        {insights?.trim() && (
          <div style={{
            background: '#fff',
            border: `1px solid ${C.hairline}`,
            borderLeft: `4px solid ${C.amber}`,
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '12px',
            boxShadow: '0 1px 2px rgba(13, 27, 42, 0.04)',
          }}>
            <p style={{
              fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase',
              color: C.amber, fontWeight: 700, margin: 0,
            }}>Insights del período</p>
            <p style={{
              fontSize: '11px', color: C.ink, lineHeight: 1.55,
              whiteSpace: 'pre-wrap', margin: '6px 0 0 0',
            }}>{insights}</p>
          </div>
        )}

        {/* 01 — Métricas Combinadas */}
        <SectionHeader number={1} title="Métricas Combinadas" accent={C.violet} />
        <div style={grid(3)}>
          <Card label="Venta Total Confirmada" value={fmtCurrency(sh?.revenue)} change={sh?.revenue_change} accent={C.green} />
          <Card label="Inversión Total" value={fmtCurrency(fb?.spend)} change={fb?.spend_change} inverted accent={C.blue} />
          <Card label="ROAS Real" value={fmtRoas(blended?.real_roas ?? blended?.overall_roas ?? (fb?.spend > 0 && sh?.revenue ? sh.revenue / fb.spend : 0))} change={blended?.real_roas_change ?? blended?.overall_roas_change} accent={C.violet} />
          <Card label="Costo por Pedido" value={fmtCurrency(blended?.cost_per_order ?? (sh?.orders > 0 ? (fb?.spend || 0) / sh.orders : 0))} change={blended?.cost_per_order_change} inverted />
          <Card label="% Inversión" value={fmtPct(blended?.ad_spend_percentage ?? (sh?.revenue > 0 ? ((fb?.spend || 0) / sh.revenue) * 100 : 0))} change={blended?.ad_spend_percentage_change} inverted />
          <Card label="Margen después de Ads" value={fmtCurrency(blended?.margin_after_ads ?? ((sh?.revenue || 0) - (fb?.spend || 0)))} change={blended?.margin_after_ads_change} accent={C.green} />
        </div>

        {/* 02 — Email Marketing */}
        <SectionHeader number={2} title="Email Marketing" accent={C.pink} />
        {(!emailCampaigns || emailCampaigns.length === 0) ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: C.textLight,
            background: '#fff',
            border: `1px dashed ${C.hairline}`,
            borderRadius: '10px',
            marginBottom: '14px',
            fontSize: '10px',
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
          }}>
            Sin campañas registradas en el período.
          </div>
        ) : (
          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <div style={grid(4)}>
              <Card label="Envíos" value={fmtInt(emailTotals.recipients)} accent={C.pink} />
              <Card label="Aperturas" value={fmtPct(rate(emailTotals.opens, emailTotals.delivered))} sublabel={`${fmtInt(emailTotals.opens)} únicos`} accent={C.pink} />
              <Card label="Clicks" value={fmtPct(rate(emailTotals.clicks, emailTotals.delivered))} sublabel={`${fmtInt(emailTotals.clicks)} únicos`} accent={C.pink} />
              <Card label="Revenue atribuido" value={fmtCurrency(emailTotals.revenue)} sublabel={`${fmtInt(emailTotals.orders)} pedidos`} accent={C.green} />
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Campaña</th>
                  <th style={th}>Fecha</th>
                  <th style={{ ...th, textAlign: 'right' }}>Envíos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Apertura</th>
                  <th style={{ ...th, textAlign: 'right' }}>Click</th>
                  <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {emailCampaigns.map((c, i) => (
                  <tr key={i}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: C.ink }}>{c.campaign_name}</div>
                      {c.subject && <div style={{ fontSize: '9px', color: C.textLight }}>{c.subject}</div>}
                    </td>
                    <td style={td}>{fmtDateShort(c.sent_date)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtInt(c.recipients)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtPct(rate(c.opens, c.delivered))}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtPct(rate(c.clicks, c.delivered))}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtInt(c.orders)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 03 — Facebook Ads */}
        {fb && (
          <>
            <div className="keep-together">
              <SectionHeader number={3} title="Facebook Ads" accent={C.blue} />
              <div style={grid(4)}>
                <Card label="Inversión" value={fmtCurrency(fb.spend)} change={fb.spend_change} inverted accent={C.blue} />
                <Card label="Impresiones" value={fmtInt(fb.impressions)} change={fb.impressions_change} />
                <Card label="Clics" value={fmtInt(fb.clicks)} change={fb.clicks_change} />
                <Card label="CTR" value={fmtPct(fb.ctr)} change={fb.ctr_change} />
              </div>
            </div>
            <div style={grid(3)}>
              <Card label="Conversiones" value={fmtInt(fb.conversions)} change={fb.conversions_change} accent={C.green} />
              <Card label="Costo por Compra" value={fmtCurrency(fb.cpa)} change={fb.cpa_change} inverted />
              <Card label="ROAS Facebook" value={fmtRoas(fb.roas)} change={fb.roas_change} accent={C.violet} />
            </div>

            {campaigns.length > 0 && (
              <div style={{ marginTop: '8px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: C.ink, margin: '4px 0 8px 0' }}>Detalle por campaña</p>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={th}>Campaña</th>
                      <th style={th}>Objetivo</th>
                      <th style={th}>Estado</th>
                      <th style={{ ...th, textAlign: 'right' }}>Inversión</th>
                      <th style={{ ...th, textAlign: 'right' }}>Conv.</th>
                      <th style={{ ...th, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...th, textAlign: 'right' }}>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c, i) => (
                      <tr key={i}>
                        <td style={td}>
                          <div style={{ fontWeight: 600, color: C.ink }}>{c.name}</div>
                          <div style={{ height: '3px', background: '#E5E2DD', borderRadius: '2px', marginTop: '4px', overflow: 'hidden', width: '110px' }}>
                            <div style={{ height: '100%', background: C.blue, width: `${Math.min(c.share, 100)}%` }} />
                          </div>
                          <div style={{ fontSize: '8px', color: C.textLight, marginTop: '2px' }}>{c.share.toFixed(1)}% del spend</div>
                        </td>
                        <td style={td}>{c.objective && <span style={badge(C.violetSoft, C.violet)}>{c.objective}</span>}</td>
                        <td style={td}>{statusBadge(c.status)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: C.ink }}>{fmtCurrency(c.spend)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtInt(c.conversions)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtCurrency(c.revenue)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: c.roas >= 3 ? C.green : c.roas >= 1.5 ? C.amber : c.roas > 0 ? C.red : C.textLight }}>{fmtRoas(c.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="notice" style={{
              background: C.redSoft,
              border: `1px solid #FCA5A5`,
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#7F1D1D',
              fontSize: '10px',
              marginTop: '12px',
              lineHeight: 1.5,
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
            }}>
              <strong style={{ letterSpacing: '0.3px' }}>⚠ Atribución de Facebook Ads</strong>
              <div style={{ marginTop: '4px' }}>
                Debido a la problemática de atribución de Facebook Ads es importante revisar las métricas combinadas. Facebook Ads
                nunca garantiza que la información sea 100% correcta. Por lo general, reporta menos ventas de las que realmente generó.
              </div>
            </div>
          </>
        )}

        {/* 04 — Shopify (keep header + first row of cards together so the
            section title never gets orphaned at the end of a page) */}
        {sh && (
          <>
            <div className="keep-together">
              <SectionHeader number={4} title="Shopify" accent={C.green} />
              <div style={grid(4)}>
                <Card label="Venta Total Confirmada" value={fmtCurrency(sh.revenue)} change={sh.revenue_change} accent={C.green} />
                <Card label="Pedidos" value={fmtInt(sh.orders)} change={sh.orders_change} />
                <Card label="Ticket Promedio" value={fmtCurrency(sh.aov)} change={sh.aov_change} />
                <Card label="Clientes" value={fmtInt(sh.customers)} change={sh.customers_change} />
              </div>
            </div>
            <div style={grid(4)}>
              <Card label="Impuestos" value={fmtCurrency(sh.total_tax)} change={sh.total_tax_change} />
              <Card label="Descuentos" value={fmtCurrency(sh.total_discounts)} change={sh.total_discounts_change} inverted />
              <Card label="Venta Neta" value={fmtCurrency(sh.net_revenue)} change={sh.net_revenue_change} sublabel="sin IVA ni envío" accent={C.green} />
              <Card label="Devoluciones" value={fmtCurrency(sh.refunds)} change={sh.refunds_change} inverted />
            </div>

            {topProducts.length > 0 && (
              <div style={{ marginTop: '8px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: C.ink, margin: '4px 0 8px 0' }}>Top 5 productos más vendidos</p>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '24px' }}>#</th>
                      <th style={th}>Producto</th>
                      <th style={{ ...th, textAlign: 'right' }}>Unidades</th>
                      <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
                      <th style={{ ...th, textAlign: 'right' }}>Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.slice(0, 5).map((p, i) => (
                      <tr key={i}>
                        <td style={{ ...td, color: C.textLight, fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</td>
                        <td style={{ ...td, fontWeight: 600, color: C.ink }}>{p.title}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtInt(p.quantity)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtCurrency(p.revenue)}</td>
                        <td style={{ ...td, textAlign: 'right', color: C.textMuted }}>{fmtInt(p.orders)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============ FOOTER (banner card, not full-bleed) ============ */}
      <table style={{
        width: '100%',
        background: C.ink,
        color: '#a8b3c5',
        borderRadius: '12px',
        margin: '8mm 0 0 0',
        borderCollapse: 'separate',
      }}>
        <tbody>
          <tr>
            <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
              <p style={{ margin: 0, color: '#fff', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', fontSize: '10px' }}>LA REAL MARKETING</p>
              <p style={{ margin: '3px 0 0 0', letterSpacing: '0.3px', fontSize: '9px' }}>Reporte confidencial para {clientLabel}. No redistribuir sin autorización.</p>
            </td>
            <td style={{ padding: '12px 18px', verticalAlign: 'middle', textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '9px' }}>orbit.larealmarketing.com</p>
              <p style={{ margin: '3px 0 0 0', color: '#6c7a91', fontSize: '9px' }}>Generado automáticamente</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ====== Main component ======
export default function PortalReportExport({ client, metrics, period, getApiParams }) {
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const params = getApiParams ? getApiParams() : {};
      const [adsRes, topRes, emailRes] = await Promise.all([
        portalMetricsAPI.getAds(params).catch(() => ({ ads: [] })),
        portalMetricsAPI.getTopProducts(params).catch(() => ({ products: [] })),
        portalEmailMarketingAPI
          .list({ start_date: params.start_date, end_date: params.end_date })
          .catch(() => ({ campaigns: [] })),
      ]);

      const enriched = {
        ...metrics,
        shopify: { ...(metrics?.shopify || {}), top_products: topRes?.products || [] },
      };

      const html = renderToStaticMarkup(
        <PdfTemplate
          client={client}
          period={period}
          insights={insights}
          metrics={enriched}
          ads={adsRes?.ads || []}
          emailCampaigns={emailRes?.campaigns || []}
        />
      );

      const filename = `reporte-${(client?.name || client?.company || 'cliente').toLowerCase().replace(/\s+/g, '-')}-${(period?.start_date || '').slice(0, 7)}`;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('title', filename);
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(`<!doctype html>
<html><head>
<meta charset="utf-8">
<title>${filename}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #F8F5F0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
  @page { size: A4; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
    /* Keep table rows and small groups together */
    tr, table, .keep-together { break-inside: avoid; page-break-inside: avoid; }
    /* Don't orphan section headings at the bottom of a page */
    h2, h3, .section-header { break-after: avoid; page-break-after: avoid; }
    /* Notice boxes shouldn't split */
    .notice { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>${html}</body>
</html>`);
      doc.close();

      await new Promise((resolve) => {
        if (doc.readyState === 'complete') resolve();
        else iframe.addEventListener('load', () => resolve(), { once: true });
      });
      await new Promise((resolve) => setTimeout(resolve, 600));

      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 2000);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('No se pudo generar el PDF: ' + (err.message || 'error desconocido'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[#0D1B2A] text-white rounded-xl hover:bg-[#1F2937] transition-colors text-sm font-medium shadow-sm"
        title="Exportar reporte en PDF"
      >
        <Download size={16} />
        Exportar reporte
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0D1B2A] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0D1B2A]">Exportar reporte</h2>
                  <p className="text-xs text-gray-500">Se abrirá el diálogo del navegador — elige "Guardar como PDF"</p>
                </div>
              </div>
              <button onClick={() => !busy && setOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-[#0D1B2A] mb-1">
                Insights del período <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Escribe lo que ves importante en el reporte para que el cliente lo lea en el PDF.
              </p>
              <textarea
                value={insights}
                onChange={(e) => setInsights(e.target.value)}
                placeholder="Ej: Este mes superamos la meta gracias a la campaña de Día de la Madre. ROAS de Catálogo Dinámico fue 5.19x — recomendamos escalar +30% en junio."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm h-40 resize-y focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]"
                disabled={busy}
              />
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium bg-[#0D1B2A] text-white rounded-xl hover:bg-[#1F2937] flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {busy ? 'Preparando…' : 'Generar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
