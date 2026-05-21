import { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, X, FileText, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { portalMetricsAPI } from '../../utils/portalApi';

const fmtCurrency = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtRoas = (v) => `${(v || 0).toFixed(2)}x`;
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;
const fmtDelta = (v) => {
  if (v == null || !isFinite(v)) return '';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
};

const deltaColor = (v, inverted = false) => {
  if (v == null) return '#94a3b8';
  const positive = inverted ? v < 0 : v > 0;
  if (Math.abs(v) < 0.05) return '#94a3b8';
  return positive ? '#10b981' : '#ef4444';
};

const statusLabel = (s) => {
  if (!s) return '';
  if (s === 'ACTIVE') return 'Activa';
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'Pausada';
  if (s === 'ARCHIVED' || s === 'DELETED') return 'Archivada';
  return s.replace(/_/g, ' ').toLowerCase();
};

const styles = {
  page: {
    width: '210mm',
    minHeight: '297mm',
    padding: '14mm 14mm 14mm 14mm',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#1A1A2E',
    background: '#ffffff',
    fontSize: '11px',
    boxSizing: 'border-box',
  },
  pageBreak: { pageBreakAfter: 'always', breakAfter: 'page' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottom: '2px solid #1A1A2E',
    paddingBottom: '12px',
    marginBottom: '18px',
  },
  h1: { fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' },
  subtitle: { fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    margin: '0 0 10px 0',
    paddingBottom: '6px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionDot: (color) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
  }),
  cardGrid: (cols) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '8px',
    marginBottom: '14px',
  }),
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px 12px',
    background: '#fff',
  },
  cardLabel: { fontSize: '10px', color: '#64748b', margin: 0 },
  cardValue: { fontSize: '14px', fontWeight: 700, margin: '4px 0 0 0' },
  cardDelta: { fontSize: '10px', fontWeight: 600, marginTop: '2px' },
  insightsBox: {
    background: '#FFF8E6',
    border: '1px solid #F4D08A',
    borderLeft: '4px solid #F59E0B',
    borderRadius: '6px',
    padding: '10px 14px',
    marginBottom: '16px',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
    fontSize: '11px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '10px',
    marginBottom: '12px',
  },
  th: {
    textAlign: 'left',
    padding: '6px 6px',
    borderBottom: '1px solid #cbd5e1',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: '#64748b',
    fontWeight: 600,
  },
  td: { padding: '5px 6px', borderBottom: '1px solid #f1f5f9' },
  badge: (bg, color) => ({
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: '999px',
    background: bg,
    color: color,
    fontSize: '9px',
    fontWeight: 600,
  }),
  noticeRed: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '6px',
    padding: '10px 12px',
    color: '#991b1b',
    fontSize: '10px',
    marginTop: '12px',
    lineHeight: 1.4,
  },
};

const Card = ({ label, value, change, inverted, sublabel }) => (
  <div style={styles.card}>
    <p style={styles.cardLabel}>{label}</p>
    <p style={styles.cardValue}>{value}</p>
    {sublabel && <p style={{ ...styles.cardLabel, fontSize: '9px', marginTop: '2px' }}>{sublabel}</p>}
    {change != null && (
      <p style={{ ...styles.cardDelta, color: deltaColor(change, inverted) }}>{fmtDelta(change)} vs anterior</p>
    )}
  </div>
);

export const PdfTemplate = ({ client, period, insights, metrics, ads }) => {
  const fb = metrics?.facebook;
  const sh = metrics?.shopify;
  const blended = metrics?.blended;

  // Group ads by campaign for FB breakdown
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

  const topProducts = metrics?.shopify?.top_products || [];

  const fmtPeriod = (p) => {
    if (!p) return '';
    const start = p.start_date?.split('T')[0];
    const end = p.end_date?.split('T')[0];
    const f = (d) => {
      if (!d) return '';
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    };
    return `${f(start)} — ${f(end)}`;
  };

  return (
    <div>
      {/* ===== PAGE 1: COVER + COMBINED + EMAIL + INSIGHTS ===== */}
      <div style={{ ...styles.page, ...styles.pageBreak }}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.h1}>Reporte de marketing</h1>
            <p style={styles.subtitle}>{client?.name || client?.company || 'Cliente'}</p>
            <p style={styles.subtitle}>{fmtPeriod(period)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={styles.subtitle}>Generado por LA REAL MARKETING</p>
            <p style={styles.subtitle}>{new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {insights?.trim() && (
          <>
            <h2 style={styles.sectionTitle}>
              <span style={styles.sectionDot('#F59E0B')} />
              Insights del período
            </h2>
            <div style={styles.insightsBox}>{insights}</div>
          </>
        )}

        <h2 style={styles.sectionTitle}>
          <span style={styles.sectionDot('#7c3aed')} />
          Métricas Combinadas
        </h2>
        <div style={styles.cardGrid(3)}>
          <Card
            label="Venta Total Confirmada"
            value={fmtCurrency(sh?.revenue)}
            change={sh?.revenue_change}
          />
          <Card
            label="Inversión Total"
            value={fmtCurrency(fb?.spend)}
            change={fb?.spend_change}
            inverted
          />
          <Card
            label="ROAS Real"
            value={fmtRoas(blended?.real_roas ?? blended?.overall_roas ?? (fb?.spend > 0 && sh?.revenue ? sh.revenue / fb.spend : 0))}
            change={blended?.real_roas_change ?? blended?.overall_roas_change}
          />
          <Card
            label="Costo por Pedido"
            value={fmtCurrency(blended?.cost_per_order ?? (sh?.orders > 0 ? (fb?.spend || 0) / sh.orders : 0))}
            change={blended?.cost_per_order_change}
            inverted
          />
          <Card
            label="% Inversión"
            value={fmtPct(blended?.ad_spend_percentage ?? (sh?.revenue > 0 ? ((fb?.spend || 0) / sh.revenue) * 100 : 0))}
            change={blended?.ad_spend_percentage_change}
            inverted
          />
          <Card
            label="Margen después de Ads"
            value={fmtCurrency(blended?.margin_after_ads ?? ((sh?.revenue || 0) - (fb?.spend || 0)))}
            change={blended?.margin_after_ads_change}
          />
        </div>

        <h2 style={styles.sectionTitle}>
          <span style={styles.sectionDot('#ec4899')} />
          Email Marketing
        </h2>
        <div style={{
          padding: '18px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '10px',
          border: '1px dashed #e2e8f0',
          borderRadius: '8px',
          marginBottom: '14px',
        }}>
          Próximamente: registro de campañas de email marketing
        </div>
      </div>

      {/* ===== PAGE 2: FACEBOOK ADS ===== */}
      {fb && (
        <div style={{ ...styles.page, ...styles.pageBreak }}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.sectionDot('#3b82f6')} />
            Facebook Ads
          </h2>

          <div style={styles.cardGrid(4)}>
            <Card label="Inversión" value={fmtCurrency(fb.spend)} change={fb.spend_change} inverted />
            <Card label="Impresiones" value={fmtInt(fb.impressions)} change={fb.impressions_change} />
            <Card label="Clics" value={fmtInt(fb.clicks)} change={fb.clicks_change} />
            <Card label="CTR" value={fmtPct(fb.ctr)} change={fb.ctr_change} />
          </div>
          <div style={styles.cardGrid(3)}>
            <Card label="Conversiones" value={fmtInt(fb.conversions)} change={fb.conversions_change} />
            <Card label="Costo por Conversión" value={fmtCurrency(fb.cpa)} change={fb.cpa_change} inverted />
            <Card label="ROAS" value={fmtRoas(fb.roas)} change={fb.roas_change} />
          </div>
          <div style={styles.cardGrid(3)}>
            <Card label="CPM" value={fmtCurrency(fb.cpm)} change={fb.cpm_change} inverted />
            <Card label="Costo por Compra" value={fmtCurrency(fb.cost_per_purchase)} change={fb.cost_per_purchase_change} inverted />
            <Card label="Costo por Visita" value={fmtCurrency(fb.cost_per_landing_page_view)} change={fb.cost_per_landing_page_view_change} inverted />
          </div>

          {campaigns.length > 0 && (
            <>
              <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '14px 0 6px 0' }}>Detalle por campaña</h3>
              <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 8px 0' }}>
                {campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''} con inversión en el período
              </p>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Campaña</th>
                    <th style={styles.th}>Objetivo</th>
                    <th style={styles.th}>Estado</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Inversión</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Conv.</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Revenue</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={i}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{
                          height: '3px', background: '#e2e8f0', borderRadius: '2px',
                          marginTop: '3px', overflow: 'hidden', width: '120px',
                        }}>
                          <div style={{ height: '100%', background: '#3b82f6', width: `${Math.min(c.share, 100)}%` }} />
                        </div>
                        <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>{c.share.toFixed(1)}% del spend</div>
                      </td>
                      <td style={styles.td}>
                        {c.objective && (
                          <span style={styles.badge('#ede9fe', '#6d28d9')}>{c.objective}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {c.status === 'ACTIVE' && <span style={styles.badge('#d1fae5', '#047857')}>Activa</span>}
                        {(c.status === 'PAUSED' || c.status === 'CAMPAIGN_PAUSED' || c.status === 'ADSET_PAUSED') && (
                          <span style={styles.badge('#fef3c7', '#92400e')}>Pausada</span>
                        )}
                        {(c.status === 'ARCHIVED' || c.status === 'DELETED') && (
                          <span style={styles.badge('#e5e7eb', '#4b5563')}>Archivada</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(c.spend)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmtInt(c.conversions)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmtCurrency(c.revenue)}</td>
                      <td style={{
                        ...styles.td,
                        textAlign: 'right',
                        fontWeight: 600,
                        color: c.roas >= 3 ? '#10b981' : c.roas >= 1.5 ? '#f59e0b' : '#ef4444',
                      }}>{fmtRoas(c.roas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={styles.noticeRed}>
            <strong>⚠ Atribución de Facebook Ads:</strong> Debido a la problemática de atribución
            de Facebook Ads es importante revisar las métricas combinadas. Facebook Ads nunca
            garantiza que la información sea 100% correcta. Por lo general, reporta menos ventas
            de las que realmente generó.
          </div>
        </div>
      )}

      {/* ===== PAGE 3: SHOPIFY ===== */}
      {sh && (
        <div style={styles.page}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.sectionDot('#10b981')} />
            Shopify
          </h2>

          <div style={styles.cardGrid(4)}>
            <Card label="Venta Total Confirmada" value={fmtCurrency(sh.revenue)} change={sh.revenue_change} />
            <Card label="Pedidos" value={fmtInt(sh.orders)} change={sh.orders_change} />
            <Card label="Ticket Promedio" value={fmtCurrency(sh.aov)} change={sh.aov_change} />
            <Card label="Clientes" value={fmtInt(sh.customers)} change={sh.customers_change} />
          </div>
          <div style={styles.cardGrid(4)}>
            <Card label="Impuestos" value={fmtCurrency(sh.total_tax)} change={sh.total_tax_change} />
            <Card label="Descuentos" value={fmtCurrency(sh.total_discounts)} change={sh.total_discounts_change} inverted />
            <Card label="Venta Neta" sublabel="sin IVA ni envío" value={fmtCurrency(sh.net_revenue)} change={sh.net_revenue_change} />
            <Card label="Devoluciones" value={fmtCurrency(sh.refunds)} change={sh.refunds_change} inverted />
          </div>

          {topProducts.length > 0 && (
            <>
              <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '14px 0 6px 0' }}>Top 5 productos más vendidos</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '24px' }}>#</th>
                    <th style={styles.th}>Producto</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Unidades</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Ingresos</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.slice(0, 5).map((p, i) => (
                    <tr key={i}>
                      <td style={{ ...styles.td, color: '#94a3b8' }}>{i + 1}</td>
                      <td style={styles.td}>{p.title}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmtInt(p.quantity)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(p.revenue)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#64748b' }}>{fmtInt(p.orders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default function PortalReportExport({ client, metrics, period, getApiParams }) {
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState('');
  const [busy, setBusy] = useState(false);
  const templateRef = useRef(null);

  const handleGenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Fetch ads + top products in parallel using the same period
      const params = getApiParams ? getApiParams() : {};
      const [adsRes, topRes] = await Promise.all([
        portalMetricsAPI.getAds(params).catch(() => ({ ads: [] })),
        portalMetricsAPI.getTopProducts(params).catch(() => ({ products: [] })),
      ]);

      // Build the augmented metrics object expected by the template
      const enriched = {
        ...metrics,
        shopify: { ...(metrics?.shopify || {}), top_products: topRes?.products || [] },
      };

      // html2canvas (used by html2pdf under the hood) DOES NOT support
      // position:fixed elements — it silently skips them, leaving a blank
      // canvas. So we mount the template at position:absolute, scrolled to
      // the top of the page, and let it occupy real document flow off to the
      // right where the user won't see it. The browser still paints it and
      // html2canvas captures it correctly.
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.width = '210mm';
      wrapper.style.background = '#ffffff';
      wrapper.style.zIndex = '9999'; // above the modal so the modal doesn't clip the snapshot
      wrapper.style.pointerEvents = 'none';
      wrapper.style.visibility = 'hidden'; // invisible to the user, still painted
      document.body.appendChild(wrapper);

      // Mount React tree into the wrapper so styles + layout are computed.
      const root = createRoot(wrapper);
      root.render(
        <PdfTemplate client={client} period={period} insights={insights} metrics={enriched} ads={adsRes?.ads || []} />
      );

      // Wait two animation frames so the browser has fully painted the layout.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      // Small extra delay for fonts/measurements to settle.
      await new Promise((resolve) => setTimeout(resolve, 400));

      const rect = wrapper.getBoundingClientRect();
      console.log('[PDF] wrapper size:', rect.width, 'x', rect.height, 'children:', wrapper.children.length);
      if (rect.width === 0 || rect.height === 0 || wrapper.children.length === 0) {
        throw new Error(`Render del template falló (size: ${rect.width}x${rect.height}, children: ${wrapper.children.length})`);
      }

      // html2canvas needs the element to be capture-able, so right before
      // snapshotting we flip visibility back to visible (it's still off-flow
      // and behind nothing because we placed it at position:absolute 0,0).
      wrapper.style.visibility = 'visible';
      // Scroll to top so the captured area starts at the wrapper.
      const prevScroll = { x: window.scrollX, y: window.scrollY };
      window.scrollTo(0, 0);

      const filename = `reporte-${(client?.name || client?.company || 'cliente').toLowerCase().replace(/\s+/g, '-')}-${(period?.start_date || '').slice(0, 7)}.pdf`;

      console.log('[PDF] starting html2pdf save…');
      await html2pdf()
        .from(wrapper)
        .set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .save();
      console.log('[PDF] save finished');

      // Cleanup
      root.unmount();
      document.body.removeChild(wrapper);
      window.scrollTo(prevScroll.x, prevScroll.y);
      setOpen(false);
      setInsights('');
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
        className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] transition-colors text-sm font-medium"
        title="Exportar reporte en PDF"
      >
        <Download size={16} />
        Exportar reporte
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1A1A2E]">Exportar reporte</h2>
                  <p className="text-xs text-gray-500">Va a incluir Métricas Combinadas, Email Marketing, Facebook Ads y Shopify</p>
                </div>
              </div>
              <button onClick={() => !busy && setOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#1A1A2E] mb-1">
                  Insights del período <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Escribe lo que ves importante en el reporte para que el cliente lo lea en el PDF.
                  Por ejemplo: campañas que destacaron, aprendizajes, próximos pasos.
                </p>
                <textarea
                  value={insights}
                  onChange={(e) => setInsights(e.target.value)}
                  placeholder="Ej: Este mes superamos la meta gracias a la campaña de Día de la Madre. ROAS de Catálogo Dinámico fue 5.19x — recomendamos escalar +30% en junio."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm h-40 resize-y"
                  disabled={busy}
                />
              </div>
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
                className="px-4 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {busy ? 'Generando…' : 'Generar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden template — only used during generation */}
      <div ref={templateRef} style={{ display: 'none' }} />
    </>
  );
}
