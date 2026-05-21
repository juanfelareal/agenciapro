import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { LA_REAL_LOGO_BASE64 } from '../../assets/laRealLogo';

// ====== Typography: Inter + JetBrains Mono ======
// Stable, CDN-hosted, embedded into the PDF so the recipient sees them.
// Geist isn't reliably hosted as TTF on public CDNs, so we use Inter — same
// geometric sans-serif feel that cult-ui leans on.
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-Regular.otf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-Medium.otf', fontWeight: 500 },
    { src: 'https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-SemiBold.otf', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-Bold.otf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'JetBrainsMono',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@master/fonts/ttf/JetBrainsMono-Regular.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@master/fonts/ttf/JetBrainsMono-Medium.ttf', fontWeight: 500 },
  ],
});

// ====== Palette: warm editorial, one refined brand accent ======
const C = {
  // Warm off-white paper — feels editorial, not corporate
  paper: '#FAF8F3',
  surface: '#F4F0E8',
  hairline: '#E8E2D5',
  hairlineSoft: '#EFE9DB',
  // Slightly warm grays for text
  inkLight: '#9A9285',
  inkMute: '#6B6357',
  inkSoft: '#3F3A33',
  ink: '#1A1A1A',
  // One refined accent — deep editorial green, used sparingly
  accent: '#0F5132',
  accentSoft: '#D7E4DC',
  // Brand navy reserved for headers & rules
  brand: '#0D1B2A',
  // Delta signals
  pos: '#15803D',
  neg: '#B91C1C',
};

// ====== Formatters ======
const fmtCurrency = (v) => `$${Math.round(v || 0).toLocaleString('es-CO')}`;
const fmtInt = (v) => (v || 0).toLocaleString('es-CO');
const fmtRoas = (v) => `${(v || 0).toFixed(2)}x`;
const fmtPct = (v) => `${(v || 0).toFixed(1)}%`;
const rate = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const pickRate = (direct, num, denom) => (direct > 0 ? direct : rate(num, denom));
const fmtDelta = (v) => {
  if (v == null || !isFinite(v)) return '';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
};
const deltaColor = (v, inverted = false) => {
  if (v == null) return C.inkLight;
  if (Math.abs(v) < 0.05) return C.inkLight;
  const positive = inverted ? v < 0 : v > 0;
  return positive ? C.pos : C.neg;
};
const deltaArrow = (v, inverted = false) => {
  if (v == null || Math.abs(v) < 0.05) return '·';
  const positive = inverted ? v < 0 : v > 0;
  return positive ? '↗' : '↘';
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

// ====== Styles ======
const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    paddingTop: '16mm',
    paddingHorizontal: '16mm',
    paddingBottom: '16mm',
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: C.ink,
    lineHeight: 1.5,
  },

  // Slim brand strip (top of every page)
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    marginBottom: 18,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 14, height: 14, marginRight: 8 },
  brandLabel: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 1.5,
    color: C.accent,
  },
  pageMarker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 1.5,
    color: C.inkLight,
  },

  // Editorial cover block (page 1 only)
  coverKicker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    fontWeight: 500,
    letterSpacing: 2,
    color: C.accent,
    marginBottom: 10,
  },
  coverTitle: {
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: -1.2,
    color: C.ink,
    lineHeight: 1.1,
    marginBottom: 20,
  },
  coverClient: {
    fontSize: 13,
    fontWeight: 600,
    color: C.ink,
    letterSpacing: -0.2,
  },
  coverMeta: {
    fontSize: 9,
    color: C.inkMute,
    marginTop: 3,
  },
  coverDivider: {
    height: 0.5,
    backgroundColor: C.hairline,
    marginTop: 22,
    marginBottom: 22,
  },

  // Insights — editorial pull quote, no box, accent-marked
  insightsKicker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 2,
    color: C.accent,
    marginBottom: 8,
  },
  insightsBlock: {
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: C.accent,
    marginBottom: 28,
  },
  insightsText: {
    fontSize: 10.5,
    color: C.inkSoft,
    lineHeight: 1.6,
    fontWeight: 400,
  },

  // Section header — accent dot + number + TITLE, hairline below
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    paddingBottom: 10,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
    marginRight: 10,
  },
  sectionNum: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    fontWeight: 500,
    color: C.accent,
    letterSpacing: 1.5,
    marginRight: 10,
  },
  sectionSlash: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    color: C.inkLight,
    marginRight: 10,
  },
  sectionTitle: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    fontWeight: 500,
    color: C.ink,
    letterSpacing: 1.8,
    flex: 1,
  },
  sectionCount: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    color: C.inkMute,
    letterSpacing: 1.2,
  },

  // KPI cells — hairline border, no colored accents, generous padding
  kpiRow: {
    flexDirection: 'row',
    marginBottom: 0,
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
    borderLeftWidth: 0.5,
    borderLeftColor: C.hairline,
  },
  kpiCell: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderRightWidth: 0.5,
    borderRightColor: C.hairline,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
  },
  kpiLabel: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 1.2,
    color: C.accent,
    marginBottom: 10,
  },
  // Tight line-height + explicit padding to prevent overlap with delta
  kpiValue: {
    fontSize: 19,
    fontWeight: 700,
    color: C.ink,
    letterSpacing: -0.5,
    lineHeight: 1.1,
    marginBottom: 10,
  },
  kpiSub: {
    fontSize: 7.5,
    color: C.inkLight,
    marginTop: -6,
    marginBottom: 6,
  },
  kpiDeltaRow: { flexDirection: 'row', alignItems: 'center' },
  kpiDelta: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    fontWeight: 500,
    lineHeight: 1.2,
  },
  kpiDeltaSub: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    color: C.inkLight,
    marginLeft: 5,
    letterSpacing: 0.3,
    lineHeight: 1.2,
  },

  // Tables — editorial, breathing
  tableWrap: { marginTop: 18 },
  tableTitle: {
    fontFamily: 'JetBrainsMono',
    fontSize: 8,
    fontWeight: 500,
    letterSpacing: 1.8,
    color: C.inkMute,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    paddingBottom: 8,
  },
  tableHeaderCell: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 1.2,
    color: C.ink,
    paddingRight: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairlineSoft,
    paddingTop: 9,
    paddingBottom: 9,
  },
  tableCell: {
    fontSize: 9,
    color: C.inkSoft,
    paddingRight: 6,
  },
  tableCellEmph: {
    fontSize: 9,
    fontWeight: 600,
    color: C.ink,
    paddingRight: 6,
  },
  tableCellNum: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    color: C.inkSoft,
    textAlign: 'right',
    paddingRight: 6,
  },
  tableCellNumEmph: {
    fontFamily: 'JetBrainsMono',
    fontSize: 9,
    fontWeight: 500,
    color: C.ink,
    textAlign: 'right',
    paddingRight: 6,
  },
  tableSubtext: {
    fontSize: 7.5,
    color: C.inkLight,
    marginTop: 2,
  },

  // Badge — mono, monochrome, small
  badge: {
    fontFamily: 'JetBrainsMono',
    fontSize: 6.5,
    fontWeight: 500,
    letterSpacing: 0.8,
    paddingTop: 2,
    paddingBottom: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
    backgroundColor: C.surface,
    color: C.inkSoft,
    borderWidth: 0.5,
    borderColor: C.hairline,
    alignSelf: 'flex-start',
  },

  // Notice — minimal, no rainbow background
  notice: {
    marginTop: 20,
    paddingTop: 14,
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 14,
    borderLeftWidth: 2,
    borderLeftColor: C.ink,
    backgroundColor: C.surface,
  },
  noticeKicker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 1.5,
    color: C.ink,
    marginBottom: 5,
  },
  noticeText: {
    fontSize: 8.5,
    color: C.inkSoft,
    lineHeight: 1.5,
  },

  // Empty state
  empty: {
    marginTop: 6,
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: C.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 9,
    color: C.inkLight,
  },

  // Share bar inside campaign rows
  shareBarTrack: {
    height: 1.5,
    backgroundColor: C.hairline,
    marginTop: 5,
    width: 90,
  },
  shareBarFill: {
    height: '100%',
    backgroundColor: C.ink,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
  },
  footerLeft: {},
  footerBrand: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    fontWeight: 500,
    letterSpacing: 1.8,
    color: C.inkMute,
  },
  footerNote: {
    fontSize: 7.5,
    color: C.inkLight,
    marginTop: 3,
  },
  footerRight: { alignItems: 'flex-end' },
  footerUrl: {
    fontFamily: 'JetBrainsMono',
    fontSize: 7,
    color: C.inkMute,
    letterSpacing: 0.5,
  },
});

// ====== Atoms ======
const BrandStrip = () => (
  <View style={s.brandStrip} fixed>
    <View style={s.brandLeft}>
      <Image src={LA_REAL_LOGO_BASE64} style={s.brandMark} />
      <Text style={s.brandLabel}>LA REAL · MARKETING REPORT</Text>
    </View>
    <Text
      style={s.pageMarker}
      render={({ pageNumber, totalPages }) =>
        `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`
      }
    />
  </View>
);

const SectionHeader = ({ number, title, count }) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionDot} />
    <Text style={s.sectionNum}>{String(number).padStart(2, '0')}</Text>
    <Text style={s.sectionSlash}>/</Text>
    <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
    {count != null && <Text style={s.sectionCount}>{count}</Text>}
  </View>
);

const KpiCell = ({ label, value, sub, change, inverted, last }) => (
  <View style={[s.kpiCell, last && { borderRightWidth: 0.5 }]}>
    <Text style={s.kpiLabel}>{label.toUpperCase()}</Text>
    <Text style={s.kpiValue}>{value}</Text>
    {sub && <Text style={s.kpiSub}>{sub}</Text>}
    {change != null && (
      <View style={s.kpiDeltaRow}>
        <Text style={[s.kpiDelta, { color: deltaColor(change, inverted) }]}>
          {deltaArrow(change, inverted)} {fmtDelta(change)}
        </Text>
        <Text style={s.kpiDeltaSub}>vs período ant.</Text>
      </View>
    )}
  </View>
);

// KPI rows never split mid-row across pages — they're small enough to always fit
const KpiRow = ({ children }) => <View style={s.kpiRow} wrap={false}>{children}</View>;

const Footer = ({ clientLabel }) => (
  <View style={s.footer} fixed>
    <View style={s.footerLeft}>
      <Text style={s.footerBrand}>LA REAL MARKETING</Text>
      <Text style={s.footerNote}>Confidencial · {clientLabel}</Text>
    </View>
    <View style={s.footerRight}>
      <Text style={s.footerUrl}>orbit.larealmarketing.com</Text>
      <Text style={s.footerNote}>
        {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>
    </View>
  </View>
);

// ====== Document ======
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

  // Email totals — weighted averages
  const emailTotals = (emailCampaigns || []).reduce((acc, c) => ({
    recipients: acc.recipients + (c.recipients || 0),
    delivered: acc.delivered + (c.delivered || 0),
    opens: acc.opens + (c.opens || 0),
    clicks: acc.clicks + (c.clicks || 0),
    orders: acc.orders + (c.orders || 0),
    revenue: acc.revenue + (c.revenue || 0),
  }), { recipients: 0, delivered: 0, opens: 0, clicks: 0, orders: 0, revenue: 0 });
  {
    let on = 0, od = 0, cn = 0, cd = 0;
    for (const c of emailCampaigns || []) {
      const d = c.recipients || 0;
      on += (c.open_rate || pickRate(0, c.opens, c.delivered)) * d;
      cn += (c.click_rate || pickRate(0, c.clicks, c.delivered)) * d;
      od += d; cd += d;
    }
    emailTotals.avgOpen = od > 0 ? on / od : 0;
    emailTotals.avgClick = cd > 0 ? cn / cd : 0;
  }

  const clientLabel = (client?.company || client?.name || 'Cliente').toUpperCase();
  const periodLabel = period
    ? `${fmtDateLong(period.start_date)} — ${fmtDateLong(period.end_date)}`
    : '';
  const emitDate = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  // Section block — keeps the header and following content together
  // so a section header never gets orphaned at the bottom of a page.
  const SectionBlock = ({ children, gap = 28 }) => (
    <View style={{ marginTop: gap }} minPresenceAhead={140}>
      {children}
    </View>
  );

  return (
    <Document>
      {/* Single Page — content flows naturally and react-pdf paginates.
          No forced page breaks, no orphaned white space. */}
      <Page size="A4" style={s.page}>
        <BrandStrip />

        {/* Editorial cover block */}
        <View>
          <Text style={s.coverKicker}>REPORTE DE MARKETING · {periodLabel.toUpperCase()}</Text>
          <Text style={s.coverTitle}>Resumen ejecutivo del período</Text>
          <Text style={s.coverClient}>{clientLabel}</Text>
          <Text style={s.coverMeta}>Emitido el {emitDate}</Text>
        </View>
        <View style={s.coverDivider} />

        {/* Insights */}
        {insights?.trim() && (
          <View style={s.insightsBlock}>
            <Text style={s.insightsKicker}>INSIGHTS DEL PERÍODO</Text>
            <Text style={s.insightsText}>{insights}</Text>
          </View>
        )}

        {/* Section 01 — Métricas Combinadas */}
        <View minPresenceAhead={140}>
          <SectionHeader number={1} title="Métricas Combinadas" />
        </View>
        <KpiRow>
          <KpiCell label="Venta total confirmada" value={fmtCurrency(sh?.revenue)} change={sh?.revenue_change} />
          <KpiCell label="Inversión total" value={fmtCurrency(fb?.spend)} change={fb?.spend_change} inverted />
          <KpiCell label="ROAS real" value={fmtRoas(blended?.real_roas ?? blended?.overall_roas ?? (fb?.spend > 0 && sh?.revenue ? sh.revenue / fb.spend : 0))} change={blended?.real_roas_change ?? blended?.overall_roas_change} last />
        </KpiRow>
        <KpiRow>
          <KpiCell label="Costo por pedido" value={fmtCurrency(blended?.cost_per_order ?? (sh?.orders > 0 ? (fb?.spend || 0) / sh.orders : 0))} change={blended?.cost_per_order_change} inverted />
          <KpiCell label="% Inversión" value={fmtPct(blended?.ad_spend_percentage ?? (sh?.revenue > 0 ? ((fb?.spend || 0) / sh.revenue) * 100 : 0))} change={blended?.ad_spend_percentage_change} inverted />
          <KpiCell label="Margen después de ads" value={fmtCurrency(blended?.margin_after_ads ?? ((sh?.revenue || 0) - (fb?.spend || 0)))} change={blended?.margin_after_ads_change} last />
        </KpiRow>

        {/* Section 02 — Email Marketing */}
        <SectionBlock>
          <SectionHeader number={2} title="Email Marketing" count={emailCampaigns?.length ? `${emailCampaigns.length} CAMPAÑAS` : null} />
        </SectionBlock>
        {(!emailCampaigns || emailCampaigns.length === 0) ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>Sin campañas registradas en el período.</Text>
          </View>
        ) : (
          <>
            <KpiRow>
              <KpiCell label="Correos enviados" value={fmtInt(emailTotals.recipients)} />
              <KpiCell label="Tasa de apertura" value={fmtPct(emailTotals.avgOpen)} />
              <KpiCell label="Tasa de clics" value={fmtPct(emailTotals.avgClick)} />
              <KpiCell label="Ventas atribuidas" value={fmtCurrency(emailTotals.revenue)} sub={`${fmtInt(emailTotals.orders)} pedidos`} last />
            </KpiRow>
            <View style={s.tableWrap}>
              <View style={s.tableHeader} wrap={false}>
                <Text style={[s.tableHeaderCell, { width: '34%' }]}>CAMPAÑA</Text>
                <Text style={[s.tableHeaderCell, { width: '10%' }]}>FECHA</Text>
                <Text style={[s.tableHeaderCell, { width: '11%', textAlign: 'right' }]}>ENVÍOS</Text>
                <Text style={[s.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>APERT.</Text>
                <Text style={[s.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>CLICS</Text>
                <Text style={[s.tableHeaderCell, { width: '9%', textAlign: 'right' }]}>PEDIDOS</Text>
                <Text style={[s.tableHeaderCell, { width: '16%', textAlign: 'right' }]}>VENTAS</Text>
              </View>
              {emailCampaigns.map((c, i) => (
                <View key={i} style={s.tableRow} wrap={false}>
                  <View style={{ width: '34%', paddingRight: 6 }}>
                    <Text style={s.tableCellEmph}>{c.campaign_name}</Text>
                    {c.subject && <Text style={s.tableSubtext}>{c.subject}</Text>}
                  </View>
                  <Text style={[s.tableCell, { width: '10%' }]}>{fmtDateShort(c.sent_date)}</Text>
                  <Text style={[s.tableCellNum, { width: '11%' }]}>{fmtInt(c.recipients)}</Text>
                  <Text style={[s.tableCellNum, { width: '10%' }]}>{fmtPct(pickRate(c.open_rate, c.opens, c.delivered))}</Text>
                  <Text style={[s.tableCellNum, { width: '10%' }]}>{fmtPct(pickRate(c.click_rate, c.clicks, c.delivered))}</Text>
                  <Text style={[s.tableCellNum, { width: '9%' }]}>{fmtInt(c.orders)}</Text>
                  <Text style={[s.tableCellNumEmph, { width: '16%' }]}>{fmtCurrency(c.revenue)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Section 03 — Facebook Ads */}
        {fb && (
          <>
            <SectionBlock>
              <SectionHeader number={3} title="Facebook Ads" count={campaigns.length ? `${campaigns.length} CAMPAÑAS` : null} />
            </SectionBlock>
            <KpiRow>
              <KpiCell label="Inversión" value={fmtCurrency(fb.spend)} change={fb.spend_change} inverted />
              <KpiCell label="Impresiones" value={fmtInt(fb.impressions)} change={fb.impressions_change} />
              <KpiCell label="Clics" value={fmtInt(fb.clicks)} change={fb.clicks_change} />
              <KpiCell label="CTR" value={fmtPct(fb.ctr)} change={fb.ctr_change} last />
            </KpiRow>
            <KpiRow>
              <KpiCell label="Conversiones" value={fmtInt(fb.conversions)} change={fb.conversions_change} />
              <KpiCell label="Costo por compra" value={fmtCurrency(fb.cpa)} change={fb.cpa_change} inverted />
              <KpiCell label="ROAS Facebook" value={fmtRoas(fb.roas)} change={fb.roas_change} last />
            </KpiRow>

            {campaigns.length > 0 && (
              <View style={s.tableWrap}>
                <Text style={s.tableTitle}>DETALLE POR CAMPAÑA</Text>
                <View style={s.tableHeader} wrap={false}>
                  <Text style={[s.tableHeaderCell, { width: '34%' }]}>CAMPAÑA</Text>
                  <Text style={[s.tableHeaderCell, { width: '12%' }]}>OBJETIVO</Text>
                  <Text style={[s.tableHeaderCell, { width: '10%' }]}>ESTADO</Text>
                  <Text style={[s.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>INVERSIÓN</Text>
                  <Text style={[s.tableHeaderCell, { width: '8%', textAlign: 'right' }]}>CONV.</Text>
                  <Text style={[s.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>REVENUE</Text>
                  <Text style={[s.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>ROAS</Text>
                </View>
                {campaigns.map((c, i) => {
                  const roasColor = c.roas >= 3 ? C.pos : c.roas >= 1.5 ? C.ink : c.roas > 0 ? C.neg : C.inkLight;
                  return (
                    <View key={i} style={s.tableRow} wrap={false}>
                      <View style={{ width: '34%', paddingRight: 6 }}>
                        <Text style={s.tableCellEmph}>{c.name}</Text>
                        <View style={s.shareBarTrack}>
                          <View style={[s.shareBarFill, { width: `${Math.min(c.share, 100)}%` }]} />
                        </View>
                        <Text style={s.tableSubtext}>{c.share.toFixed(1)}% del spend</Text>
                      </View>
                      <View style={{ width: '12%', paddingRight: 6 }}>
                        {c.objective && <Text style={s.badge}>{c.objective}</Text>}
                      </View>
                      <View style={{ width: '10%', paddingRight: 6 }}>
                        {c.status === 'ACTIVE' && <Text style={s.badge}>ACTIVA</Text>}
                        {(c.status === 'PAUSED' || c.status === 'CAMPAIGN_PAUSED' || c.status === 'ADSET_PAUSED') && <Text style={s.badge}>PAUSADA</Text>}
                        {(c.status === 'ARCHIVED' || c.status === 'DELETED') && <Text style={s.badge}>ARCHIVADA</Text>}
                      </View>
                      <Text style={[s.tableCellNumEmph, { width: '14%' }]}>{fmtCurrency(c.spend)}</Text>
                      <Text style={[s.tableCellNum, { width: '8%' }]}>{fmtInt(c.conversions)}</Text>
                      <Text style={[s.tableCellNum, { width: '12%' }]}>{fmtCurrency(c.revenue)}</Text>
                      <Text style={[s.tableCellNum, { width: '10%', color: roasColor, fontWeight: 500 }]}>{fmtRoas(c.roas)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={s.notice} wrap={false}>
              <Text style={s.noticeKicker}>NOTA SOBRE ATRIBUCIÓN</Text>
              <Text style={s.noticeText}>
                Debido a la problemática de atribución de Facebook Ads es importante revisar las métricas combinadas. Facebook Ads nunca garantiza que la información sea 100% correcta — por lo general reporta menos ventas de las que realmente generó.
              </Text>
            </View>
          </>
        )}

        {/* Section 04 — Shopify */}
        {sh && (
          <>
            <SectionBlock>
              <SectionHeader number={4} title="Shopify" />
            </SectionBlock>
            <KpiRow>
              <KpiCell label="Venta total confirmada" value={fmtCurrency(sh.revenue)} change={sh.revenue_change} />
              <KpiCell label="Pedidos" value={fmtInt(sh.orders)} change={sh.orders_change} />
              <KpiCell label="Ticket promedio" value={fmtCurrency(sh.aov)} change={sh.aov_change} />
              <KpiCell label="Clientes" value={fmtInt(sh.customers)} change={sh.customers_change} last />
            </KpiRow>
            <KpiRow>
              <KpiCell label="Impuestos" value={fmtCurrency(sh.total_tax)} change={sh.total_tax_change} />
              <KpiCell label="Descuentos" value={fmtCurrency(sh.total_discounts)} change={sh.total_discounts_change} inverted />
              <KpiCell label="Venta neta" value={fmtCurrency(sh.net_revenue)} sub="sin IVA ni envío" change={sh.net_revenue_change} />
              <KpiCell label="Devoluciones" value={fmtCurrency(sh.refunds)} change={sh.refunds_change} inverted last />
            </KpiRow>

            {topProducts.length > 0 && (
              <View style={s.tableWrap}>
                <Text style={s.tableTitle}>TOP 5 PRODUCTOS MÁS VENDIDOS</Text>
                <View style={s.tableHeader} wrap={false}>
                  <Text style={[s.tableHeaderCell, { width: '6%' }]}>#</Text>
                  <Text style={[s.tableHeaderCell, { width: '52%' }]}>PRODUCTO</Text>
                  <Text style={[s.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>UNIDADES</Text>
                  <Text style={[s.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>INGRESOS</Text>
                  <Text style={[s.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>PEDIDOS</Text>
                </View>
                {topProducts.slice(0, 5).map((p, i) => (
                  <View key={i} style={s.tableRow} wrap={false}>
                    <Text style={[s.tableCellNum, { width: '6%', color: C.inkLight, textAlign: 'left' }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={[s.tableCellEmph, { width: '52%' }]}>{p.title}</Text>
                    <Text style={[s.tableCellNum, { width: '12%' }]}>{fmtInt(p.quantity)}</Text>
                    <Text style={[s.tableCellNumEmph, { width: '18%' }]}>{fmtCurrency(p.revenue)}</Text>
                    <Text style={[s.tableCellNum, { width: '12%' }]}>{fmtInt(p.orders)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Footer clientLabel={clientLabel} />
      </Page>
    </Document>
  );
}
