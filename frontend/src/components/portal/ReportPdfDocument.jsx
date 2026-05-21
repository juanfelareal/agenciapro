import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { LA_REAL_LOGO_BASE64 } from '../../assets/laRealLogo';

// Use built-in Helvetica (Inter would need external font loading)
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

const C = {
  ink: '#0D1B2A',
  inkSoft: '#1F2937',
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
  if (v == null) return C.textLight;
  const positive = inverted ? v < 0 : v > 0;
  if (Math.abs(v) < 0.05) return C.textLight;
  return positive ? C.green : C.red;
};
const fmtDateLong = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
};
const fmtDateShort = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const s = StyleSheet.create({
  page: {
    backgroundColor: '#fff',
    padding: '14mm 12mm',
    fontFamily: FONT,
    fontSize: 9,
    color: C.ink,
    lineHeight: 1.45,
  },
  // Header banner
  headerBanner: {
    backgroundColor: C.ink,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  logoBlock: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 36, height: 36, marginRight: 12 },
  brandKicker: { color: '#a8b3c5', fontSize: 7, letterSpacing: 3, fontFamily: FONT_BOLD, marginBottom: 2 },
  brandTitle: { color: '#fff', fontSize: 16, fontFamily: FONT_BOLD, letterSpacing: -0.5 },
  metaRight: { alignItems: 'flex-end' },
  metaKicker: { color: '#a8b3c5', fontSize: 7, letterSpacing: 3, fontFamily: FONT_BOLD },
  metaClient: { color: '#fff', fontSize: 12, fontFamily: FONT_BOLD, marginTop: 2 },
  metaPeriod: { color: '#a8b3c5', fontSize: 9, marginTop: 3 },
  metaEmit: { color: '#6c7a91', fontSize: 7, marginTop: 1 },

  // Insights box
  insightsBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.hairline,
    borderLeftWidth: 4,
    borderLeftColor: C.amber,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  insightsLabel: { color: C.amber, fontSize: 7, letterSpacing: 2, fontFamily: FONT_BOLD, marginBottom: 4 },
  insightsText: { color: C.ink, fontSize: 9, lineHeight: 1.5 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
    paddingBottom: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  sectionNumber: { fontSize: 9, fontFamily: FONT_BOLD, letterSpacing: 2, marginRight: 12 },
  sectionTitle: { fontSize: 13, fontFamily: FONT_BOLD, letterSpacing: -0.3, color: C.ink, flex: 1 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },

  // Card grid
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    position: 'relative',
  },
  cardLabel: { fontSize: 7, color: C.textMuted, letterSpacing: 0.5, fontFamily: FONT_BOLD, marginBottom: 4 },
  cardValue: { fontSize: 14, color: C.ink, fontFamily: FONT_BOLD, letterSpacing: -0.3 },
  cardSub: { fontSize: 7, color: C.textLight, marginTop: 2 },
  cardDelta: { fontSize: 8, fontFamily: FONT_BOLD, marginTop: 3 },
  cardDeltaSub: { fontSize: 8, color: C.textLight, fontFamily: FONT },
  cardAccent: {
    position: 'absolute',
    left: 0, top: 8, bottom: 8, width: 3,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
  },

  // Table
  table: { marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: C.ink,
    paddingBottom: 6,
    marginBottom: 2,
  },
  tableHeaderCell: { fontSize: 7, fontFamily: FONT_BOLD, color: C.ink, letterSpacing: 0.5, paddingRight: 4 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  tableCell: { fontSize: 8, color: C.inkSoft, paddingRight: 4 },

  // Badges
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    fontSize: 7,
    fontFamily: FONT_BOLD,
    alignSelf: 'flex-start',
  },

  // Notice
  notice: {
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  noticeTitle: { color: '#7F1D1D', fontSize: 9, fontFamily: FONT_BOLD, marginBottom: 3 },
  noticeText: { color: '#7F1D1D', fontSize: 8, lineHeight: 1.4 },

  // Footer
  footer: {
    backgroundColor: C.ink,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  footerKicker: { color: '#fff', fontSize: 8, fontFamily: FONT_BOLD, letterSpacing: 3 },
  footerText: { color: '#a8b3c5', fontSize: 7, marginTop: 2 },
  footerTextRight: { color: '#a8b3c5', fontSize: 7 },
  footerSub: { color: '#6c7a91', fontSize: 7, marginTop: 2 },
});

// ===== Atoms =====
const SectionHeader = ({ number, title, accent }) => (
  <View style={s.sectionHeader}>
    <Text style={[s.sectionNumber, { color: accent }]}>{String(number).padStart(2, '0')}</Text>
    <Text style={s.sectionTitle}>{title}</Text>
    <View style={[s.sectionDot, { backgroundColor: accent }]} />
  </View>
);

const Card = ({ label, value, change, inverted, sublabel, accent, width }) => (
  <View style={[s.card, { width }]}>
    {accent && <View style={[s.cardAccent, { backgroundColor: accent }]} />}
    <Text style={s.cardLabel}>{label.toUpperCase()}</Text>
    <Text style={s.cardValue}>{value}</Text>
    {sublabel && <Text style={s.cardSub}>{sublabel}</Text>}
    {change != null && (
      <Text style={s.cardDelta}>
        <Text style={{ color: deltaColor(change, inverted) }}>{fmtDelta(change)}</Text>
        <Text style={s.cardDeltaSub}> vs anterior</Text>
      </Text>
    )}
  </View>
);

const Badge = ({ bg, color, children }) => (
  <Text style={[s.badge, { backgroundColor: bg, color }]}>{children}</Text>
);

const StatusBadge = ({ status }) => {
  if (status === 'ACTIVE') return <Badge bg={C.greenSoft} color={C.green}>Activa</Badge>;
  if (status === 'PAUSED' || status === 'CAMPAIGN_PAUSED' || status === 'ADSET_PAUSED')
    return <Badge bg={C.amberSoft} color={C.amber}>Pausada</Badge>;
  if (status === 'ARCHIVED' || status === 'DELETED')
    return <Badge bg="#E5E7EB" color="#4B5563">Archivada</Badge>;
  return null;
};

const cardWidth = (cols, gap = 6) => `${(100 - gap * (cols - 1) / 5.4) / cols}%`;
const W3 = '32.6%';
const W4 = '24%';

// ===== Main Document =====
export default function ReportPdfDocument({ client, period, insights, metrics, ads, emailCampaigns }) {
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
  const periodLabel = period
    ? `${fmtDateLong(period.start_date)} - ${fmtDateLong(period.end_date)}`
    : '';

  const HeaderBanner = () => (
    <View style={s.headerBanner} fixed={false}>
      <View style={s.logoBlock}>
        <Image src={LA_REAL_LOGO_BASE64} style={s.logo} />
        <View>
          <Text style={s.brandKicker}>LA REAL MARKETING</Text>
          <Text style={s.brandTitle}>Reporte de marketing</Text>
        </View>
      </View>
      <View style={s.metaRight}>
        <Text style={s.metaKicker}>CLIENTE</Text>
        <Text style={s.metaClient}>{clientLabel}</Text>
        <Text style={s.metaPeriod}>{periodLabel}</Text>
        <Text style={s.metaEmit}>
          Emitido el {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </View>
    </View>
  );

  const FooterBanner = () => (
    <View style={s.footer}>
      <View>
        <Text style={s.footerKicker}>LA REAL MARKETING</Text>
        <Text style={s.footerText}>Reporte confidencial para {clientLabel}. No redistribuir sin autorización.</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.footerTextRight}>orbit.larealmarketing.com</Text>
        <Text style={s.footerSub}>Generado automáticamente</Text>
      </View>
    </View>
  );

  return (
    <Document>
      {/* ===== PAGE 1: HEADER + INSIGHTS + COMBINED + EMAIL ===== */}
      <Page size="A4" style={s.page}>
        <HeaderBanner />

        {insights?.trim() && (
          <View style={s.insightsBox}>
            <Text style={s.insightsLabel}>INSIGHTS DEL PERIODO</Text>
            <Text style={s.insightsText}>{insights}</Text>
          </View>
        )}

        <SectionHeader number={1} title="Metricas Combinadas" accent={C.violet} />
        <View style={s.cardGrid}>
          <Card width={W3} label="Venta Total Confirmada" value={fmtCurrency(sh?.revenue)} change={sh?.revenue_change} accent={C.green} />
          <Card width={W3} label="Inversion Total" value={fmtCurrency(fb?.spend)} change={fb?.spend_change} inverted accent={C.blue} />
          <Card width={W3} label="ROAS Real" value={fmtRoas(blended?.real_roas ?? (fb?.spend > 0 && sh?.revenue ? sh.revenue / fb.spend : 0))} change={blended?.real_roas_change} accent={C.violet} />
          <Card width={W3} label="Costo por Pedido" value={fmtCurrency(blended?.cost_per_order ?? (sh?.orders > 0 ? (fb?.spend || 0) / sh.orders : 0))} change={blended?.cost_per_order_change} inverted />
          <Card width={W3} label="% Inversion" value={fmtPct(blended?.ad_spend_percentage ?? (sh?.revenue > 0 ? ((fb?.spend || 0) / sh.revenue) * 100 : 0))} change={blended?.ad_spend_percentage_change} inverted />
          <Card width={W3} label="Margen despues de Ads" value={fmtCurrency(blended?.margin_after_ads ?? ((sh?.revenue || 0) - (fb?.spend || 0)))} change={blended?.margin_after_ads_change} accent={C.green} />
        </View>

        <SectionHeader number={2} title="Email Marketing" accent={C.pink} />
        {(!emailCampaigns || emailCampaigns.length === 0) ? (
          <View style={{ padding: 18, borderWidth: 1, borderColor: C.hairline, borderStyle: 'dashed', borderRadius: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 9, color: C.textLight, textAlign: 'center' }}>
              Sin campanas registradas en el periodo.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.cardGrid}>
              <Card width={W4} label="Envios" value={fmtInt(emailTotals.recipients)} accent={C.pink} />
              <Card width={W4} label="Aperturas" value={fmtPct(rate(emailTotals.opens, emailTotals.delivered))} sublabel={`${fmtInt(emailTotals.opens)} unicos`} accent={C.pink} />
              <Card width={W4} label="Clicks" value={fmtPct(rate(emailTotals.clicks, emailTotals.delivered))} sublabel={`${fmtInt(emailTotals.clicks)} unicos`} accent={C.pink} />
              <Card width={W4} label="Revenue atribuido" value={fmtCurrency(emailTotals.revenue)} sublabel={`${fmtInt(emailTotals.orders)} pedidos`} accent={C.green} />
            </View>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '36%' }]}>CAMPANA</Text>
                <Text style={[s.tableHeaderCell, { width: '12%' }]}>FECHA</Text>
                <Text style={[s.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>ENVIOS</Text>
                <Text style={[s.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>APERTURA</Text>
                <Text style={[s.tableHeaderCell, { width: '8%', textAlign: 'right' }]}>CLICK</Text>
                <Text style={[s.tableHeaderCell, { width: '8%', textAlign: 'right' }]}>PEDIDOS</Text>
                <Text style={[s.tableHeaderCell, { width: '16%', textAlign: 'right' }]}>REVENUE</Text>
              </View>
              {emailCampaigns.map((c, i) => (
                <View key={i} style={s.tableRow}>
                  <View style={{ width: '36%', paddingRight: 4 }}>
                    <Text style={{ fontSize: 8, fontFamily: FONT_BOLD, color: C.ink }}>{c.campaign_name}</Text>
                    {c.subject && <Text style={{ fontSize: 7, color: C.textLight }}>{c.subject}</Text>}
                  </View>
                  <Text style={[s.tableCell, { width: '12%' }]}>{fmtDateShort(c.sent_date)}</Text>
                  <Text style={[s.tableCell, { width: '10%', textAlign: 'right' }]}>{fmtInt(c.recipients)}</Text>
                  <Text style={[s.tableCell, { width: '10%', textAlign: 'right' }]}>{fmtPct(rate(c.opens, c.delivered))}</Text>
                  <Text style={[s.tableCell, { width: '8%', textAlign: 'right' }]}>{fmtPct(rate(c.clicks, c.delivered))}</Text>
                  <Text style={[s.tableCell, { width: '8%', textAlign: 'right' }]}>{fmtInt(c.orders)}</Text>
                  <Text style={[s.tableCell, { width: '16%', textAlign: 'right', fontFamily: FONT_BOLD }]}>{fmtCurrency(c.revenue)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Page>

      {/* ===== PAGE 2: FACEBOOK ADS ===== */}
      {fb && (
        <Page size="A4" style={s.page}>
          <SectionHeader number={3} title="Facebook Ads" accent={C.blue} />
          <View style={s.cardGrid}>
            <Card width={W4} label="Inversion" value={fmtCurrency(fb.spend)} change={fb.spend_change} inverted accent={C.blue} />
            <Card width={W4} label="Impresiones" value={fmtInt(fb.impressions)} change={fb.impressions_change} />
            <Card width={W4} label="Clics" value={fmtInt(fb.clicks)} change={fb.clicks_change} />
            <Card width={W4} label="CTR" value={fmtPct(fb.ctr)} change={fb.ctr_change} />
          </View>
          <View style={s.cardGrid}>
            <Card width={W3} label="Conversiones" value={fmtInt(fb.conversions)} change={fb.conversions_change} accent={C.green} />
            <Card width={W3} label="Costo por Compra" value={fmtCurrency(fb.cpa)} change={fb.cpa_change} inverted />
            <Card width={W3} label="ROAS Facebook" value={fmtRoas(fb.roas)} change={fb.roas_change} accent={C.violet} />
          </View>

          {campaigns.length > 0 && (
            <>
              <Text style={{ fontSize: 10, fontFamily: FONT_BOLD, color: C.ink, marginTop: 6, marginBottom: 6 }}>Detalle por campana</Text>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderCell, { width: '34%' }]}>CAMPANA</Text>
                  <Text style={[s.tableHeaderCell, { width: '10%' }]}>OBJETIVO</Text>
                  <Text style={[s.tableHeaderCell, { width: '10%' }]}>ESTADO</Text>
                  <Text style={[s.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>INVERSION</Text>
                  <Text style={[s.tableHeaderCell, { width: '8%', textAlign: 'right' }]}>CONV.</Text>
                  <Text style={[s.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>REVENUE</Text>
                  <Text style={[s.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>ROAS</Text>
                </View>
                {campaigns.map((c, i) => {
                  const roasColor = c.roas >= 3 ? C.green : c.roas >= 1.5 ? C.amber : c.roas > 0 ? C.red : C.textLight;
                  return (
                    <View key={i} style={s.tableRow}>
                      <View style={{ width: '34%', paddingRight: 4 }}>
                        <Text style={{ fontSize: 8, fontFamily: FONT_BOLD, color: C.ink }}>{c.name}</Text>
                        <View style={{ height: 2.5, backgroundColor: C.hairline, borderRadius: 1.5, marginTop: 3, width: 90 }}>
                          <View style={{ height: '100%', backgroundColor: C.blue, width: `${Math.min(c.share, 100)}%`, borderRadius: 1.5 }} />
                        </View>
                        <Text style={{ fontSize: 7, color: C.textLight, marginTop: 2 }}>{c.share.toFixed(1)}% del spend</Text>
                      </View>
                      <View style={{ width: '10%', paddingRight: 4 }}>
                        {c.objective && <Badge bg={C.violetSoft} color={C.violet}>{c.objective}</Badge>}
                      </View>
                      <View style={{ width: '10%', paddingRight: 4 }}>
                        <StatusBadge status={c.status} />
                      </View>
                      <Text style={[s.tableCell, { width: '14%', textAlign: 'right', fontFamily: FONT_BOLD, color: C.ink }]}>{fmtCurrency(c.spend)}</Text>
                      <Text style={[s.tableCell, { width: '8%', textAlign: 'right' }]}>{fmtInt(c.conversions)}</Text>
                      <Text style={[s.tableCell, { width: '14%', textAlign: 'right' }]}>{fmtCurrency(c.revenue)}</Text>
                      <Text style={[s.tableCell, { width: '10%', textAlign: 'right', fontFamily: FONT_BOLD, color: roasColor }]}>{fmtRoas(c.roas)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <View style={s.notice}>
            <Text style={s.noticeTitle}>Atribucion de Facebook Ads</Text>
            <Text style={s.noticeText}>
              Debido a la problematica de atribucion de Facebook Ads es importante revisar las metricas combinadas. Facebook Ads nunca garantiza que la informacion sea 100% correcta. Por lo general, reporta menos ventas de las que realmente genero.
            </Text>
          </View>
        </Page>
      )}

      {/* ===== PAGE 3: SHOPIFY ===== */}
      {sh && (
        <Page size="A4" style={s.page}>
          <SectionHeader number={4} title="Shopify" accent={C.green} />
          <View style={s.cardGrid}>
            <Card width={W4} label="Venta Total Confirmada" value={fmtCurrency(sh.revenue)} change={sh.revenue_change} accent={C.green} />
            <Card width={W4} label="Pedidos" value={fmtInt(sh.orders)} change={sh.orders_change} />
            <Card width={W4} label="Ticket Promedio" value={fmtCurrency(sh.aov)} change={sh.aov_change} />
            <Card width={W4} label="Clientes" value={fmtInt(sh.customers)} change={sh.customers_change} />
          </View>
          <View style={s.cardGrid}>
            <Card width={W4} label="Impuestos" value={fmtCurrency(sh.total_tax)} change={sh.total_tax_change} />
            <Card width={W4} label="Descuentos" value={fmtCurrency(sh.total_discounts)} change={sh.total_discounts_change} inverted />
            <Card width={W4} label="Venta Neta" value={fmtCurrency(sh.net_revenue)} change={sh.net_revenue_change} sublabel="sin IVA ni envio" accent={C.green} />
            <Card width={W4} label="Devoluciones" value={fmtCurrency(sh.refunds)} change={sh.refunds_change} inverted />
          </View>

          {topProducts.length > 0 && (
            <>
              <Text style={{ fontSize: 10, fontFamily: FONT_BOLD, color: C.ink, marginTop: 6, marginBottom: 6 }}>Top 5 productos mas vendidos</Text>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderCell, { width: '6%' }]}>#</Text>
                  <Text style={[s.tableHeaderCell, { width: '50%' }]}>PRODUCTO</Text>
                  <Text style={[s.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>UNIDADES</Text>
                  <Text style={[s.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>INGRESOS</Text>
                  <Text style={[s.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>PEDIDOS</Text>
                </View>
                {topProducts.slice(0, 5).map((p, i) => (
                  <View key={i} style={s.tableRow}>
                    <Text style={[s.tableCell, { width: '6%', color: C.textLight, fontFamily: FONT_BOLD }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={[s.tableCell, { width: '50%', fontFamily: FONT_BOLD, color: C.ink }]}>{p.title}</Text>
                    <Text style={[s.tableCell, { width: '14%', textAlign: 'right' }]}>{fmtInt(p.quantity)}</Text>
                    <Text style={[s.tableCell, { width: '18%', textAlign: 'right', fontFamily: FONT_BOLD }]}>{fmtCurrency(p.revenue)}</Text>
                    <Text style={[s.tableCell, { width: '12%', textAlign: 'right', color: C.textMuted }]}>{fmtInt(p.orders)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <FooterBanner />
        </Page>
      )}
    </Document>
  );
}
