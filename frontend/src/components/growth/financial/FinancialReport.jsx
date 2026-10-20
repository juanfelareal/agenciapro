import React from 'react';
import { fmtMoney, fmtPct, fmtX, fmtInt, monthLabel } from './format';
import { useBranding } from '../../../branding/useBranding'; // [branding]

/**
 * Informe financiero para imprimir / guardar como PDF.
 * Diseñado para papel (A4), no es una captura de pantalla: texto vectorial, sin controles,
 * saltos de página controlados (`.sec` nunca se parte) y gráficas en SVG simple.
 * Lo usan el equipo (/print/finanzas/:clientId) y el portal del cliente (/portal/imprimir/finanzas).
 */

const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => (v === null || v === undefined ? '—' : fmtMoney(v));
const signed = (v) => (num(v) < 0 ? `−${fmtMoney(Math.abs(v))}` : fmtMoney(v));
const dayNum = (iso) => Number(String(iso).slice(8, 10));

const CSS = `
  @page { size: A4 portrait; margin: 14mm 13mm 16mm 13mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .rep { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); font-size: 11px; line-height: 1.45; max-width: 184mm; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rep .num { font-variant-numeric: tabular-nums; }
  .rep .muted { color: #6B7280; }
  .rep .faint { color: #9CA3AF; }
  .rep .pos { color: var(--accent-deep); } .rep .neg { color: #dc2626; } .rep .amber { color: #d97706; }
  .rep .sec { break-inside: avoid; page-break-inside: avoid; margin: 0 0 14px; }
  .rep .brk { break-before: page; page-break-before: always; }
  .rep h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; margin: 0; }
  .rep h2 { font-size: 12.5px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.1px; }
  .rep .tag { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B7280; }
  .rep .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid var(--ink); padding-bottom: 10px; margin-bottom: 16px; }
  .rep .card { border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 14px; }
  .rep .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rep .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .rep .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .rep .kpi .l { font-size: 9.5px; color: #6B7280; margin-bottom: 2px; }
  .rep .kpi .v { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
  .rep .kpi .s { font-size: 9.5px; color: #9CA3AF; margin-top: 2px; }
  .rep .hero { font-size: 30px; font-weight: 800; letter-spacing: -0.8px; line-height: 1.05; }
  .rep table { width: 100%; border-collapse: collapse; }
  .rep th { text-align: left; font-size: 9px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.06em; padding: 5px 6px; border-bottom: 1px solid #E5E7EB; }
  .rep td { padding: 5px 6px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
  .rep th.r, .rep td.r { text-align: right; }
  .rep tr.total td { font-weight: 700; border-top: 1px solid var(--ink); border-bottom: 0; }
  .rep .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9.5px; font-weight: 700; }
  .rep .pill.g { background: var(--accent); color: #fff; } .rep .pill.a { background: #F59E0B; color: #fff; } .rep .pill.r { background: #dc2626; color: #fff; } .rep .pill.n { background: #E5E7EB; color: #374151; }
  .rep .bar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; background: #F3F4F6; }
  .rep .bar i { display: block; height: 100%; }
  .rep .legend { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-top: 6px; font-size: 10px; }
  .rep .dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  .rep .heat { display: grid; grid-template-columns: 26px repeat(24, 1fr); gap: 2px; align-items: center; }
  .rep .heat .c { height: 11px; border-radius: 2px; background: #F3F4F6; }
  .rep .heat .lab { font-size: 9px; color: #6B7280; }
  .rep .heat .hr { font-size: 8px; color: #9CA3AF; text-align: center; }
  .rep .hbar { display: flex; align-items: center; gap: 8px; margin: 3px 0; font-size: 10px; white-space: nowrap; }
  .rep .hbar .t { height: 9px; background: #D1D5DB; border-radius: 4px; }
  .rep .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #E5E7EB; font-size: 9px; color: #9CA3AF; }
  .rep .note { font-size: 9.5px; color: #6B7280; margin-top: 6px; }
`;

function Kpi({ label, value, sub, cls = '' }) {
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className={`v num ${cls}`}>{value}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </div>
  );
}

/** Barras diarias: ventas (negro), costos (gris) y utilidad (línea verde/roja). SVG fijo, sin librerías. */
function DailyChart({ daily }) {
  const days = (daily || []).filter((d) => d);
  if (!days.length) return null;
  const W = 680; const H = 170; const padL = 44; const padB = 18; const padT = 8;
  const innerW = W - padL - 8; const innerH = H - padB - padT;
  const maxV = Math.max(1, ...days.map((d) => Math.max(num(d.revenue), num(d.cogs) + num(d.ad_spend) + num(d.variable_costs) + num(d.fixed_costs))));
  const minP = Math.min(0, ...days.map((d) => num(d.net_profit)));
  const maxP = Math.max(0, ...days.map((d) => num(d.net_profit)));
  const top = Math.max(maxV, maxP); const bottom = minP;
  const y = (v) => padT + innerH * (1 - (v - bottom) / (top - bottom || 1));
  const slot = innerW / days.length; const bw = Math.max(2, Math.min(9, slot * 0.32));
  const ticks = [0, 0.5, 1].map((f) => bottom + (top - bottom) * f);
  const fmtK = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`);
  const linePts = days.map((d, i) => `${padL + slot * i + slot / 2},${y(num(d.net_profit))}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#E8E5DF" />
          <text x={padL - 6} y={y(t) + 3} fontSize="8" fill="#7A7772" textAnchor="end">{t === 0 ? '$0' : `$${fmtK(t)}`}</text>
        </g>
      ))}
      <line x1={padL} x2={W - 8} y1={y(0)} y2={y(0)} stroke="#C9C6C0" strokeWidth="0.6" />
      {days.map((d, i) => {
        const x0 = padL + slot * i + slot / 2;
        const costs = num(d.cogs) + num(d.ad_spend) + num(d.variable_costs) + num(d.fixed_costs);
        return (
          <g key={d.date}>
            <rect x={x0 - bw - 1} y={y(num(d.revenue))} width={bw} height={Math.max(0, y(0) - y(num(d.revenue)))} fill="var(--ink)" />
            <rect x={x0 + 1} y={y(costs)} width={bw} height={Math.max(0, y(0) - y(costs))} fill="#C7CBD1" />
            {(i % Math.ceil(days.length / 10) === 0 || i === days.length - 1) && (
              <text x={x0} y={H - 4} fontSize="8" fill="#7A7772" textAnchor="middle">{dayNum(d.date)}</text>
            )}
          </g>
        );
      })}
      <polyline points={linePts} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      {days.map((d, i) => (num(d.net_profit) < 0 ? <circle key={`p${i}`} cx={padL + slot * i + slot / 2} cy={y(num(d.net_profit))} r="1.8" fill="#dc2626" /> : null))}
    </svg>
  );
}

function CumulativeChart({ cumulative, projection, daysInMonth }) {
  const pts = (cumulative || []).map((c) => num(c.net_profit));
  if (!pts.length) return null;
  const W = 680; const H = 150; const padL = 44; const padB = 18; const padT = 8;
  const innerW = W - padL - 8; const innerH = H - padB - padT;
  const projEnd = num(projection?.net_profit_eom);
  const all = [0, ...pts, projEnd];
  const top = Math.max(...all); const bottom = Math.min(...all);
  const y = (v) => padT + innerH * (1 - (v - bottom) / (top - bottom || 1));
  const x = (i) => padL + innerW * (i / Math.max(1, daysInMonth - 1));
  const line = pts.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const last = pts[pts.length - 1];
  const fmtK = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[bottom, 0, top].filter((v, i, a) => a.indexOf(v) === i).map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#9CA3AF' : '#F3F4F6'} strokeWidth={t === 0 ? 0.6 : 1} />
          <text x={padL - 6} y={y(t) + 3} fontSize="8" fill="#7A7772" textAnchor="end">{t === 0 ? '$0' : `${t < 0 ? '−' : ''}$${fmtK(Math.abs(t))}`}</text>
        </g>
      ))}
      <polyline points={line} fill="none" stroke={last < 0 ? '#dc2626' : 'var(--accent)'} strokeWidth="1.8" />
      {pts.length < daysInMonth && (
        <line x1={x(pts.length - 1)} y1={y(last)} x2={x(daysInMonth - 1)} y2={y(projEnd)} stroke="#C9C6C0" strokeWidth="1.2" strokeDasharray="4 3" />
      )}
      {[1, Math.round(daysInMonth / 2), daysInMonth].map((d) => (
        <text key={d} x={x(d - 1)} y={H - 4} fontSize="8" fill="#7A7772" textAnchor="middle">{d}</text>
      ))}
    </svg>
  );
}

export default function FinancialReport({ data, client, period, patterns, mix, scenarios, generatedAt = new Date(), portal = false }) {
  // [branding] Encabezado y pie con la marca de la agencia (nombre, logo, pie configurado)
  const { org: agency, branding, logo: brandLogo } = useBranding();
  const agencyName = agency?.name || 'LA REAL';
  const agencyLogo = brandLogo('light');
  if (!data) return null;
  const t = data.totals || {};
  const be = data.break_even || {};
  const bd = data.breakdown || {};
  const brand = client?.nickname || client?.company || client?.name || 'Marca';
  const profitNeg = num(t.net_profit) < 0;
  const orders = num(t.orders);
  const aov = orders > 0 ? t.revenue / orders : null;
  const cogsPo = orders > 0 ? t.cogs / orders : null;
  const varPo = orders > 0 ? t.variable_costs / orders : null;
  const marginPo = aov !== null ? aov - cogsPo - varPo : null;
  const cur = num(be.current_roas);
  const verdict = !be.roas_min ? null : !cur ? 'none' : cur >= be.roas_min * 1.15 ? 'scale' : cur >= be.roas_min ? 'hold' : 'stop';
  const vLabel = { scale: 'Escalar', hold: 'Sostener', stop: 'No escalar', none: 'Sin pauta' }[verdict] || '—';
  const vCls = { scale: 'g', hold: 'a', stop: 'r', none: 'n' }[verdict] || 'n';
  const share = (v) => (t.revenue > 0 ? Math.max(0, num(v) / t.revenue) : 0);
  const products = (data.products || []).filter((p) => num(p.units) > 0).sort((a, b) => num(b.revenue) - num(a.revenue)).slice(0, 18);
  const fixedItems = data.fixed_costs?.items || [];
  const varItems = (data.variable_costs?.items || []).filter((v) => v.is_active !== false);
  const varLabel = (v) => (v.kind === 'per_order' ? `${fmtMoney(v.amount_per_order)} por pedido` : v.kind === 'per_unit' ? `${fmtMoney(v.amount_per_order)} por unidad` : v.kind === 'monthly_fixed' ? `${fmtMoney(v.amount_per_order)} al mes` : `${v.percentage}% ${v.applies_to === 'gross_revenue' ? 'de la venta total pagada' : v.applies_to === 'net_revenue' ? 'de la venta neta − producto' : 'de la venta neta'}`);
  const heat = patterns?.heatmap || [];
  const maxHeat = Math.max(1, ...heat.map((c) => num(c.revenue)));
  const byWd = (patterns?.by_weekday || []).slice().sort((a, b) => (a.weekday === 0 ? 7 : a.weekday) - (b.weekday === 0 ? 7 : b.weekday));
  const maxWd = Math.max(1, ...byWd.map((w) => num(w.avg_revenue_per_day)));
  const wk = patterns?.weekend_vs_weekday;
  const sharedScenarios = (scenarios || []).filter((s) => s.result);
  const gen = generatedAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="rep">
      <style>{CSS}</style>

      <div className="head">
        <div>
          <div className="tag" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {agencyLogo && <img src={agencyLogo} alt={agencyName} style={{ height: 18, maxWidth: 90, objectFit: 'contain' }} />}
            <span>Informe financiero · {portal ? `Portal del cliente · ${agencyName}` : `Orbit · ${agencyName}`}</span>
          </div>
          <h1>{brand} · {monthLabel(period)}</h1>
          <div className="muted" style={{ marginTop: 3 }}>
            Del 1 al {data.days_elapsed || 0} de {data.days_in_month} · todo sin IVA, venta neta como base{data.is_current_month ? ' · mes en curso' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }} className="muted">
          <div>Generado el {gen}</div>
          <div>{data.shopify?.platform === 'woocommerce' ? 'WooCommerce' : 'Shopify'} · datos cada 5 minutos</div>
        </div>
      </div>

      {/* Resumen */}
      <div className="sec card">
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div>
            <div className="tag">{profitNeg ? 'Pérdida neta del mes' : 'Utilidad neta del mes'}</div>
            <div className={`hero num ${profitNeg ? 'neg' : 'pos'}`}>{signed(t.net_profit)}</div>
            <div className="muted" style={{ marginTop: 4 }}>
              Margen <b className={profitNeg ? 'neg' : 'pos'}>{fmtPct(t.revenue ? t.net_profit / t.revenue : null, 1)}</b>
              {data.projection?.net_profit_eom !== undefined && (
                <> · proyección fin de mes <b className={num(data.projection.net_profit_eom) < 0 ? 'neg' : 'pos'}>{signed(data.projection.net_profit_eom)}</b></>
              )}
            </div>
            {num(t.discounts) > 0 && (
              <div className="note">Venta bruta {fmtMoney(t.gross_sales)} − descuentos {fmtMoney(t.discounts)} ({fmtPct(t.discount_pct, 1)}) = venta neta {fmtMoney(t.revenue)}</div>
            )}
          </div>
          <div className="grid2" style={{ gap: 10 }}>
            <Kpi label="Ventas netas" value={money(t.revenue)} sub={`${fmtInt(orders)} pedidos · ticket ${money(aov)}`} />
            <Kpi label="Costos totales" value={money(num(t.cogs) + num(t.ad_spend) + num(t.variable_costs) + num(t.fixed_costs))} sub="producto + pauta + variables + fijos" />
            <Kpi label="Inversión en pauta" value={money(t.ad_spend)} sub={`ROAS ${fmtX(be.current_roas)} · ${fmtPct(share(t.ad_spend), 0)} de la venta`} />
            <Kpi label="Utilidad bruta" value={money(t.gross_profit)} sub={`margen bruto ${fmtPct(t.revenue ? t.gross_profit / t.revenue : null, 1)}`} cls={num(t.gross_profit) < 0 ? 'neg' : ''} />
          </div>
        </div>
      </div>

      <div className="sec grid2">
        {/* Estado de resultados */}
        <div className="card">
          <h2>Estado de resultados</h2>
          <table>
            <tbody>
              <tr><td>Ventas netas</td><td className="r num">{money(t.revenue)}</td><td className="r muted num">100 %</td></tr>
              <tr><td className="muted">− Costo de producto</td><td className="r num">−{money(t.cogs)}</td><td className="r muted num">{fmtPct(share(t.cogs), 0)}</td></tr>
              <tr><td><b>Utilidad bruta</b></td><td className="r num"><b>{signed(t.gross_profit)}</b></td><td className="r muted num">{fmtPct(t.revenue ? t.gross_profit / t.revenue : null, 0)}</td></tr>
              <tr><td className="muted">− Inversión en pauta</td><td className="r num">−{money(t.ad_spend)}</td><td className="r muted num">{fmtPct(share(t.ad_spend), 0)}</td></tr>
              <tr><td className="muted">− Costos variables</td><td className="r num">−{money(t.variable_costs)}</td><td className="r muted num">{fmtPct(share(t.variable_costs), 0)}</td></tr>
              <tr><td className="muted">− Costos fijos (prorrateados)</td><td className="r num">−{money(t.fixed_costs)}</td><td className="r muted num">{fmtPct(share(t.fixed_costs), 0)}</td></tr>
              <tr className="total"><td>{profitNeg ? 'Pérdida neta' : 'Utilidad neta'}</td><td className={`r num ${profitNeg ? 'neg' : 'pos'}`}>{signed(t.net_profit)}</td><td className="r muted num">{fmtPct(t.revenue ? t.net_profit / t.revenue : null, 1)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* A dónde va cada peso */}
        <div className="card">
          <h2>A dónde se fue cada peso</h2>
          <div className="muted" style={{ marginBottom: 6 }}>Porcentajes sobre la venta neta del mes.</div>
          <div className="bar">
            <i style={{ width: `${Math.min(100, share(bd.cogs) * 100)}%`, background: '#6B7280' }} />
            <i style={{ width: `${Math.min(100, share(bd.ads) * 100)}%`, background: '#3B82F6' }} />
            <i style={{ width: `${Math.min(100, share(bd.variable) * 100)}%`, background: '#10B981' }} />
            <i style={{ width: `${Math.min(100, share(bd.fixed) * 100)}%`, background: '#F59E0B' }} />
          </div>
          <table style={{ marginTop: 8 }}>
            <tbody>
              <tr><td><span className="dot" style={{ background: '#6B7280' }} />Costo de producto</td><td className="r num">{money(bd.cogs)}</td><td className="r muted num">{fmtPct(bd.cogs_pct, 0)}</td></tr>
              <tr><td><span className="dot" style={{ background: '#3B82F6' }} />Inversión en pauta</td><td className="r num">{money(bd.ads)}</td><td className="r muted num">{fmtPct(bd.ads_pct, 0)}</td></tr>
              <tr><td><span className="dot" style={{ background: '#10B981' }} />Costos variables</td><td className="r num">{money(bd.variable)}</td><td className="r muted num">{fmtPct(bd.variable_pct, 0)}</td></tr>
              <tr><td><span className="dot" style={{ background: '#F59E0B' }} />Costos fijos</td><td className="r num">{money(bd.fixed)}</td><td className="r muted num">{fmtPct(bd.fixed_pct, 0)}</td></tr>
              <tr className="total"><td><span className="dot" style={{ background: profitNeg ? '#dc2626' : 'var(--accent)' }} />{profitNeg ? 'Pérdida' : 'Utilidad'}</td><td className={`r num ${profitNeg ? 'neg' : 'pos'}`}>{signed(bd.profit)}</td><td className="r muted num">{fmtPct(bd.profit_pct, 0)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* BE ROAS + punto de equilibrio */}
      <div className="sec grid2">
        <div className="card">
          <h2>BE ROAS · ROAS de equilibrio</h2>
          <div className="grid3" style={{ alignItems: 'end', gap: 8 }}>
            <Kpi label="BE ROAS de la marca" value={fmtX(be.roas_min)} />
            <Kpi label={data.is_current_month ? 'ROAS actual' : 'ROAS del mes'} value={fmtX(be.current_roas)} cls={verdict === 'scale' ? 'pos' : verdict === 'stop' ? 'neg' : verdict === 'hold' ? 'amber' : ''} />
            <div><span className={`pill ${vCls}`}>{vLabel}</span></div>
          </div>
          {aov !== null && marginPo !== null && (
            <div style={{ marginTop: 10, background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' }}>
              <div className="tag" style={{ fontSize: 8.5 }}>Cómo sale</div>
              <div className="grid4" style={{ gap: 6, marginTop: 4 }}>
                <Kpi label="Ticket promedio" value={money(aov)} />
                <Kpi label="− Producto / pedido" value={money(cogsPo)} />
                <Kpi label="− Variables / pedido" value={money(varPo)} />
                <Kpi label="= Margen / pedido" value={money(marginPo)} cls={marginPo > 0 ? 'pos' : 'neg'} />
              </div>
              <div className="note">BE ROAS = {money(aov)} ÷ {money(marginPo)} = <b>{fmtX(be.roas_min)}</b> · margen de contribución {fmtPct(be.contribution_ratio, 0)} · se escala con ROAS ≥ {fmtX(num(be.roas_min) * 1.15)}</div>
            </div>
          )}
          {!be.reachable && t.revenue ? <div className="note neg">Con el costo de producto y los variables actuales no hay ROAS que alcance: cada venta deja menos de lo que cuesta.</div> : null}
        </div>
        <div className="card" style={{ background: 'var(--dark)', color: '#fff', borderColor: 'var(--ink)' }}>
          <h2 style={{ color: 'var(--accent)' }}>Punto de equilibrio</h2>
          <div className="grid2" style={{ gap: 8 }}>
            <div className="kpi"><div className="l" style={{ color: '#9CA3AF' }}>Necesitas vender / día</div><div className="v num" style={{ color: '#fff', fontSize: 18 }}>{money(be.revenue_per_day)}</div></div>
            <div className="kpi"><div className="l" style={{ color: '#9CA3AF' }}>Vas en / día</div><div className="v num" style={{ fontSize: 18, color: num(be.current_revenue_per_day) >= num(be.revenue_per_day) ? '#4ADE80' : '#FCA5A5' }}>{money(be.current_revenue_per_day)}</div></div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10.5, color: '#E5E7EB' }}>
            {be.revenue_per_day ? <>Para no perder (con el ritmo actual de pauta) necesitas vender {money(be.revenue_per_day)} por día; hoy vas en {money(be.current_revenue_per_day)}. {num(be.gap_per_day) > 0 ? `Faltan ${money(be.gap_per_day)} por día.` : 'Vas por encima del punto de equilibrio.'}</> : 'Sin margen de contribución positivo no hay punto de equilibrio alcanzable.'}
          </div>
          <div style={{ marginTop: 6, fontSize: 9.5, color: '#9CA3AF' }}>
            ROAS objetivo (cubre fijos) {fmtX(be.roas_target)} · venta del mes para no perder {money(be.revenue_month)} · fijos {money(data.fixed_costs?.monthly_total)}/mes.
          </div>
        </div>
      </div>

      {/* Diario */}
      <div className="sec card">
        <h2>Ventas, costos y utilidad por día</h2>
        <div className="muted" style={{ marginBottom: 6 }}>Barra negra: venta neta · barra gris: costos del día (producto, pauta, variables y fijos prorrateados) · línea verde: utilidad del día (punto rojo = día en pérdida).</div>
        <DailyChart daily={data.daily} />
      </div>
      <div className="sec card">
        <h2>Utilidad acumulada del mes</h2>
        <div className="muted" style={{ marginBottom: 6 }}>Línea continua: acumulado real · punteada: proyección al ritmo actual ({signed(data.projection?.net_profit_eom)} a fin de mes).</div>
        <CumulativeChart cumulative={data.cumulative} projection={data.projection} daysInMonth={data.days_in_month || 30} />
      </div>

      {/* Patrones + mezcla de clientes */}
      {(patterns?.heatmap?.length || mix?.new) ? (
        <div className="sec grid2">
          {patterns?.heatmap?.length ? (
            <div className="card">
              <h2>Cuándo compran</h2>
              <div className="muted" style={{ marginBottom: 6 }}>
                Últimos {patterns.period?.days || 90} días · {fmtInt(patterns.totals?.orders)} pedidos.
                {wk?.ratio ? ` Los fines de semana venden ${String(wk.ratio).replace('.', ',')}× ${wk.ratio >= 1 ? 'más' : 'menos'} por día que entre semana.` : ''}
                {patterns.peak_hour ? ` Hora pico: ${String(patterns.peak_hour.hour).padStart(2, '0')}:00.` : ''}
              </div>
              <div className="heat">
                <div />
                {Array.from({ length: 24 }, (_, h) => <div key={h} className="hr">{h % 6 === 0 ? `${h}h` : ''}</div>)}
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                  <React.Fragment key={wd}>
                    <div className="lab">{WD[wd]}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const c = heat.find((x) => x.weekday === wd && x.hour === h);
                      const v = c ? num(c.revenue) / maxHeat : 0;
                      return <div key={h} className="c" style={{ background: v > 0 ? `rgba(23,24,26,${0.12 + v * 0.88})` : '#F3F4F6' }} />;
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                {byWd.map((w) => (
                  <div className="hbar" key={w.weekday}>
                    <span className="muted" style={{ width: 24 }}>{WD[w.weekday]}</span>
                    <span className="t" style={{ width: `${Math.max(2, (num(w.avg_revenue_per_day) / maxWd) * 60)}%`, background: patterns.best_days?.includes(w.weekday) ? 'var(--ink)' : '#D1D5DB' }} />
                    <span className="num">{money(w.avg_revenue_per_day)}<span className="faint"> / día · {fmtPct(w.share, 0)}</span></span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div />}
          {mix?.new ? (
            <div className="card">
              <h2>Nuevos vs recurrentes</h2>
              <div className="muted" style={{ marginBottom: 6 }}>{monthLabel(period)} · venta neta sin IVA ni envío.</div>
              <table>
                <thead><tr><th /><th className="r">Clientes nuevos</th><th className="r">Recurrentes</th></tr></thead>
                <tbody>
                  <tr><td>Clientes</td><td className="r num">{fmtInt(mix.new.customers)}</td><td className="r num">{fmtInt(mix.returning.customers)}</td></tr>
                  <tr><td>Pedidos</td><td className="r num">{fmtInt(mix.new.orders)}</td><td className="r num">{fmtInt(mix.returning.orders)}</td></tr>
                  <tr><td>Venta neta</td><td className="r num">{money(mix.new.revenue)}</td><td className="r num">{money(mix.returning.revenue)}</td></tr>
                  <tr><td>Ticket</td><td className="r num">{money(mix.new.aov)}</td><td className="r num">{money(mix.returning.aov)}</td></tr>
                  <tr><td>Participación en la venta</td><td className="r num">{fmtPct(mix.new_share_revenue, 0)}</td><td className="r num">{fmtPct(mix.new_share_revenue === null ? null : 1 - mix.new_share_revenue, 0)}</td></tr>
                </tbody>
              </table>
              <div className="grid3" style={{ marginTop: 10, gap: 8 }}>
                <Kpi label="CAC" value={money(mix.cac)} sub={`${money(mix.ad_spend)} en pauta ÷ ${fmtInt(mix.new.customers)} nuevos`} />
                <Kpi label="Tasa de recompra" value={fmtPct(mix.repeat_rate, 0)} sub={`${fmtInt(mix.repeat_customers)} de ${fmtInt(mix.window_customers)} · ${mix.repeat_window_days} días`} />
                <Kpi label="Pedidos por cliente" value={mix.orders_per_customer ?? '—'} sub={mix.days_between_orders_median ? `mediana ${mix.days_between_orders_median} días entre compras` : ''} />
              </div>
            </div>
          ) : <div />}
        </div>
      ) : null}

      {/* Escenarios compartidos */}
      {sharedScenarios.length ? (
        <div className="sec card">
          <h2>Escenarios guardados</h2>
          <table>
            <thead><tr><th>Escenario</th><th className="r">Pauta / mes</th><th className="r">ROAS</th><th className="r">Venta</th><th className="r">Utilidad neta</th><th className="r">BE ROAS</th></tr></thead>
            <tbody>
              {sharedScenarios.map((s) => {
                const r = s.result || {};
                const np = r.net_profit ?? r.totals?.net_profit;
                return (
                  <tr key={s.id}>
                    <td><b>{s.name}</b>{s.visibility === 'private' ? <span className="faint"> · privado</span> : null}{s.description ? <div className="muted">{s.description}</div> : null}</td>
                    <td className="r num">{money(r.ad_spend ?? r.ads_month)}</td>
                    <td className="r num">{fmtX(r.roas)}</td>
                    <td className="r num">{money(r.revenue)}</td>
                    <td className={`r num ${num(np) < 0 ? 'neg' : 'pos'}`}>{signed(np)}</td>
                    <td className="r num">{fmtX(r.be_roas ?? r.roas_min)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Productos */}
      {products.length ? (
        <div className="sec card">
          <h2>Productos vendidos en el mes</h2>
          <table>
            <thead><tr><th>Producto</th><th className="r">Unid.</th><th className="r">Venta neta</th><th className="r">Costo unit.</th><th className="r">Costo total</th><th className="r">Utilidad</th><th className="r">Margen</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.shopify_variant_id || p.id}>
                  <td>{p.title}{p.variant_title ? <span className="muted"> · {p.variant_title}</span> : null}{p.sku ? <div className="faint">{p.sku}</div> : null}</td>
                  <td className="r num">{fmtInt(p.units)}</td>
                  <td className="r num">{money(p.revenue)}</td>
                  <td className="r num">{p.cost_estimated ? <span className="amber">est. {fmtPct(data.default_cogs_rate, 0)}</span> : money(p.cost)}</td>
                  <td className="r num">{money(p.cogs)}</td>
                  <td className={`r num ${num(p.gross_profit) < 0 ? 'neg' : ''}`}>{signed(p.gross_profit)}</td>
                  <td className="r num">{p.margin_pct === null ? '—' : `${String(p.margin_pct).replace('.', ',')} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.missing_cost_count ? <div className="note amber">{data.missing_cost_count} producto{data.missing_cost_count === 1 ? '' : 's'} sin costo real: se estima al {fmtPct(data.default_cogs_rate, 0)} de la venta.</div> : null}
        </div>
      ) : null}

      {/* Costos */}
      {(fixedItems.length || varItems.length) ? (
        <div className="sec grid2">
          <div className="card">
            <h2>Costos fijos del mes</h2>
            {fixedItems.length ? (
              <table>
                <tbody>
                  {fixedItems.map((f) => <tr key={f.id}><td>{f.name}{f.category ? <span className="faint"> · {f.category}</span> : null}</td><td className="r num">{money(f.amount)}</td></tr>)}
                  <tr className="total"><td>Total al mes</td><td className="r num">{money(data.fixed_costs?.monthly_total)}</td></tr>
                </tbody>
              </table>
            ) : <div className="muted">Sin costos fijos cargados.</div>}
            <div className="note">Prorrateados a {money(data.fixed_costs?.per_day)} por día.</div>
          </div>
          <div className="card">
            <h2>Costos variables</h2>
            {varItems.length ? (
              <table>
                <tbody>
                  {varItems.map((v) => <tr key={v.id}><td>{v.name}<div className="faint">{varLabel(v)}</div></td><td className="r num">{money(v.amount)}</td></tr>)}
                  <tr className="total"><td>Total del mes</td><td className="r num">{money(data.variable_costs?.total)}</td></tr>
                </tbody>
              </table>
            ) : <div className="muted">Sin costos variables cargados.</div>}
          </div>
        </div>
      ) : null}

      <div className="foot">
        Venta neta = lo que entra sin IVA ni envío, después de descuentos y devoluciones. Costo de producto = costo unitario registrado × unidades (estimado al {fmtPct(data.default_cogs_rate, 0)} cuando no hay costo). BE ROAS = ticket promedio ÷ margen por pedido. Generado por Orbit · {agencyName}.{branding?.report_footer ? ` ${branding.report_footer}` : ''}
      </div>
    </div>
  );
}
