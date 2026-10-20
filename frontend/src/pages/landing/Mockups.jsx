import { useState } from 'react';
import {
  Check,
  FileText,
  House,
  FolderKanban,
  SquareCheckBig,
  ChartColumn,
  Wallet,
  PenLine,
  ClipboardList,
  Phone,
  Clapperboard,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

const copFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (n) => `$${copFmt.format(Math.round(n))}`;
const pct = (n, d = 1) => `${n.toFixed(d).replace('.', ',')}%`;
const ratio = (n) => n.toFixed(2).replace('.', ',');

/* Marca Demo — octubre 2026, corte 20 de octubre. Todo sin IVA. */
const DEMO = {
  ventas: 186420000,
  productoRate: 0.38,
  pauta: 31690000,
  variablesRate: 0.08,
  fijos: 22000000,
  diasCorridos: 20,
  diasMes: 31,
};

function pnl({ ventas, productoRate, pauta, variablesRate, fijos }) {
  const producto = ventas * productoRate;
  const variables = ventas * variablesRate;
  const contribucion = ventas - producto - pauta - variables;
  const utilidad = contribucion - fijos;
  const margen = ventas > 0 ? (utilidad / ventas) * 100 : 0;
  const roas = pauta > 0 ? ventas / pauta : 0;
  const beRoas = 1 / (1 - productoRate - variablesRate);
  return { ventas, producto, pauta, variables, fijos, contribucion, utilidad, margen, roas, beRoas };
}

/* Utilidad diaria (millones) del 1 al 20 de octubre. Suma ~47 M. */
const DAILY = [2.1, 1.8, 2.6, 2.6, 2.9, 1.2, 2.4, 3.1, 2.7, 3.2, 3.6, -0.6, 1.4, 2.8, 2.6, 2.2, 2.9, 3.0, 1.9, 2.6];
const DAILY_AVG = DAILY.reduce((a, b) => a + b, 0) / DAILY.length;

/* ------------------------------------------------------------------ */
/* Ventana genérica                                                     */
/* ------------------------------------------------------------------ */

export function Window({ title, live, children }) {
  return (
    <div className="lp-window">
      <div className="lp-window__bar">
        <div className="lp-window__dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="lp-window__title">{title}</div>
        {live && <div className="lp-window__live">{live}</div>}
      </div>
      <div className="lp-window__body">{children}</div>
    </div>
  );
}

function Verdict({ roas, be }) {
  if (roas >= be * 1.5) return <span className="lp-chip lp-chip--green">Escalar</span>;
  if (roas >= be) return <span className="lp-chip lp-chip--amber">Sostener</span>;
  return <span className="lp-chip lp-chip--red">No escalar</span>;
}

/* ------------------------------------------------------------------ */
/* 1. Dashboard financiero del hero                                      */
/* ------------------------------------------------------------------ */

function DailyChart() {
  const W = 600;
  const H = 150;
  const padX = 4;
  const zeroY = 118;
  const scale = 26; // px por millón
  const n = DAILY.length;
  const slot = (W - padX * 2) / n;
  const bw = slot * 0.62;
  const avgY = zeroY - DAILY_AVG * scale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Utilidad diaria de Marca Demo, 1 al 20 de octubre">
      <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="rgba(18,18,18,.16)" strokeWidth="1" />
      <line x1="0" y1={avgY} x2={W} y2={avgY} stroke="#1E7A30" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
      {DAILY.map((v, i) => {
        const x = padX + i * slot + (slot - bw) / 2;
        const h = Math.abs(v) * scale;
        const y = v >= 0 ? zeroY - h : zeroY;
        const isToday = i === n - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={bw}
            height={h}
            fill={v < 0 ? 'rgba(18,18,18,.22)' : isToday ? '#44BF47' : '#121212'}
          />
        );
      })}
    </svg>
  );
}

export function HeroDashboard() {
  const p = pnl(DEMO);
  const proyUtilidad = (p.contribucion / DEMO.diasCorridos) * DEMO.diasMes - DEMO.fijos;
  const proyVentas = (p.ventas / DEMO.diasCorridos) * DEMO.diasMes;
  const share = [
    { k: 'Producto', v: p.producto, cls: 'lp-bar__fill--muted' },
    { k: 'Pauta', v: p.pauta, cls: 'lp-bar__fill--muted' },
    { k: 'Variables', v: p.variables, cls: 'lp-bar__fill--muted' },
    { k: 'Fijos', v: p.fijos, cls: 'lp-bar__fill--muted' },
    { k: 'Utilidad', v: p.utilidad, cls: 'lp-bar__fill--green' },
  ];

  return (
    <Window title="Marca Demo · Finanzas · Octubre 2026 · corte 20 oct" live="Sincronizado hace 3 min">
      <div className="lp-kpis">
        <div className="lp-kpi">
          <div className="lp-kpi__label">Utilidad del mes</div>
          <div className="lp-kpi__value lp-kpi__value--green">{cop(p.utilidad)}</div>
          <div className="lp-kpi__sub">Margen {pct(p.margen)} · sin IVA</div>
        </div>
        <div className="lp-kpi">
          <div className="lp-kpi__label">Ventas netas</div>
          <div className="lp-kpi__value">{cop(p.ventas)}</div>
          <div className="lp-kpi__sub">1.012 pedidos · Shopify</div>
        </div>
        <div className="lp-kpi">
          <div className="lp-kpi__label">Pauta</div>
          <div className="lp-kpi__value">{cop(p.pauta)}</div>
          <div className="lp-kpi__sub">Meta · Google · TikTok</div>
        </div>
        <div className="lp-kpi">
          <div className="lp-kpi__label">ROAS vs. BE ROAS</div>
          <div className="lp-kpi__value">{ratio(p.roas)} <span className="lp-muted" style={{ fontWeight: 400, fontSize: '0.6em' }}>/ {ratio(p.beRoas)}</span></div>
          <div className="lp-kpi__sub"><Verdict roas={p.roas} be={p.beRoas} /></div>
        </div>
      </div>

      <div className="lp-chart">
        <div className="lp-chart__head">
          <div className="lp-chart__title">Utilidad diaria</div>
          <div className="lp-chart__legend">
            <span><i style={{ background: '#121212' }} />día cerrado</span>
            <span><i style={{ background: '#44BF47' }} />hoy</span>
            <span><i style={{ background: '#1E7A30', height: 1 }} />promedio {ratio(DAILY_AVG)} M/día</span>
          </div>
        </div>
        <DailyChart />
        <div className="lp-chart__axis"><span>1 oct</span><span>10 oct</span><span>20 oct</span></div>
      </div>

      <div className="lp-split">
        <div className="lp-panel">
          <div className="lp-panel__title">P&amp;L del mes <small>sin IVA</small></div>
          <div className="lp-rows">
            <div className="lp-row"><span className="lp-row__k">Ventas netas</span><span className="lp-row__v">{cop(p.ventas)}</span></div>
            <div className="lp-row"><span className="lp-row__k">Costo de producto (38%)</span><span className="lp-row__v lp-row__v--neg">− {cop(p.producto)}</span></div>
            <div className="lp-row"><span className="lp-row__k">Pauta</span><span className="lp-row__v lp-row__v--neg">− {cop(p.pauta)}</span></div>
            <div className="lp-row"><span className="lp-row__k">Pasarela, envío, comisión</span><span className="lp-row__v lp-row__v--neg">− {cop(p.variables)}</span></div>
            <div className="lp-row"><span className="lp-row__k">Costos fijos</span><span className="lp-row__v lp-row__v--neg">− {cop(p.fijos)}</span></div>
            <div className="lp-row lp-row--total"><span className="lp-row__k">Utilidad real</span><span className="lp-row__v lp-row__v--pos">{cop(p.utilidad)}</span></div>
          </div>
        </div>
        <div className="lp-panel">
          <div className="lp-panel__title">A dónde va cada peso <small>de {cop(p.ventas)}</small></div>
          <div className="lp-bars">
            {share.map((s) => (
              <div className="lp-bar" key={s.k}>
                <span className="lp-bar__label">{s.k}</span>
                <span className="lp-bar__track"><span className={`lp-bar__fill ${s.cls}`} style={{ width: `${(s.v / p.ventas) * 100}%` }} /></span>
                <span className="lp-bar__v">{pct((s.v / p.ventas) * 100)}</span>
              </div>
            ))}
          </div>
          <div className="lp-rows" style={{ marginTop: 14 }}>
            <div className="lp-row"><span className="lp-row__k">Punto de equilibrio</span><span className="lp-row__v">7 oct</span></div>
            <div className="lp-row"><span className="lp-row__k">Proyección ventas a 31 oct</span><span className="lp-row__v">{cop(proyVentas)}</span></div>
            <div className="lp-row"><span className="lp-row__k">Proyección utilidad a 31 oct</span><span className="lp-row__v lp-row__v--pos">{cop(proyUtilidad)}</span></div>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Finanzas: escenarios interactivos                                  */
/* ------------------------------------------------------------------ */

const SCENARIOS = [
  { id: 'hoy', label: 'Hoy', apply: (d) => d },
  { id: 'doble', label: '¿Y si invierto el doble?', apply: (d) => ({ ...d, pauta: d.pauta * 2, ventas: d.ventas * 1.6 }) },
  { id: 'envio', label: '¿Y si pago el envío?', apply: (d) => ({ ...d, variablesRate: d.variablesRate + 0.06 }) },
  { id: 'desc', label: '¿Y si doy 15% de descuento?', apply: (d) => ({ ...d, ventas: d.ventas * 0.85 * 1.2, productoRate: d.productoRate / 0.85 }) },
];

export function FinanceScenarios() {
  const [active, setActive] = useState('hoy');
  const base = pnl(DEMO);
  const sc = SCENARIOS.find((s) => s.id === active) || SCENARIOS[0];
  const p = pnl(sc.apply(DEMO));
  const delta = p.utilidad - base.utilidad;
  const isBase = active === 'hoy';

  return (
    <Window title="Marca Demo · Escenarios · Octubre 2026" live="Privado">
      <div className="lp-scenarios" role="tablist" aria-label="Escenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active === s.id}
            className={`lp-scenario${active === s.id ? ' on' : ''}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="lp-kpis lp-kpis--2" style={{ marginTop: 14 }}>
        <div className="lp-kpi">
          <div className="lp-kpi__label">Utilidad</div>
          <div className={`lp-kpi__value${p.utilidad >= 0 ? ' lp-kpi__value--green' : ''}`}>{cop(p.utilidad)}</div>
          <div className="lp-kpi__sub">
            {isBase ? `Margen ${pct(p.margen)}` : (
              <span className={`lp-chip ${delta >= 0 ? 'lp-chip--green' : 'lp-chip--red'}`}>{delta >= 0 ? '+' : '−'} {cop(Math.abs(delta))}</span>
            )}
          </div>
        </div>
        <div className="lp-kpi">
          <div className="lp-kpi__label">Ventas netas</div>
          <div className="lp-kpi__value">{cop(p.ventas)}</div>
          <div className="lp-kpi__sub">sin IVA</div>
        </div>
        <div className="lp-kpi">
          <div className="lp-kpi__label">Pauta</div>
          <div className="lp-kpi__value">{cop(p.pauta)}</div>
          <div className="lp-kpi__sub">ROAS {ratio(p.roas)}</div>
        </div>
        <div className="lp-kpi">
          <div className="lp-kpi__label">BE ROAS</div>
          <div className="lp-kpi__value">{ratio(p.beRoas)}</div>
          <div className="lp-kpi__sub"><Verdict roas={p.roas} be={p.beRoas} /></div>
        </div>
      </div>

      <div className="lp-split">
        <div className="lp-panel">
          <div className="lp-panel__title">Costos variables <small>por pedido</small></div>
          <div className="lp-rows">
            <div className="lp-row"><span className="lp-row__k">Pasarela de pagos</span><span className="lp-row__v">2,9% + $900</span></div>
            <div className="lp-row"><span className="lp-row__k">Envío asumido por la marca</span><span className="lp-row__v">{active === 'envio' ? '$11.500' : '$0'}</span></div>
            <div className="lp-row"><span className="lp-row__k">Comisión de ventas</span><span className="lp-row__v">3,0%</span></div>
            <div className="lp-row"><span className="lp-row__k">Empaque</span><span className="lp-row__v">$1.800</span></div>
          </div>
        </div>
        <div className="lp-panel">
          <div className="lp-panel__title">Costo unitario <small>por producto</small></div>
          <div className="lp-rows">
            <div className="lp-row"><span className="lp-row__k">Kit básico</span><span className="lp-row__v">$38.400</span></div>
            <div className="lp-row"><span className="lp-row__k">Kit completo</span><span className="lp-row__v">$61.900</span></div>
            <div className="lp-row"><span className="lp-row__k">Repuesto x3</span><span className="lp-row__v">$17.200</span></div>
            <div className="lp-row"><span className="lp-row__k">Edición limitada</span><span className="lp-row__v">$84.000</span></div>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Métricas en vivo: vista Growth                                     */
/* ------------------------------------------------------------------ */

const BRANDS = [
  { name: 'Marca Demo', src: 'shopify', ventas: 186420000, pauta: 31690000, be: 1.85 },
  { name: 'Casa Verde', src: 'shopify', ventas: 94300000, pauta: 30420000, be: 2.4 },
  { name: 'Alba Cosmética', src: 'shopify', ventas: 142800000, pauta: 33600000, be: 2.6 },
  { name: 'Nómada Outdoor', src: 'woo', ventas: 38900000, pauta: 22880000, be: 2.1 },
  { name: 'Trópico Café', src: 'shopify', ventas: 61200000, pauta: 24000000, be: 2.3 },
];

export function GrowthView() {
  const total = BRANDS.reduce((a, b) => a + b.ventas, 0);
  const totalPauta = BRANDS.reduce((a, b) => a + b.pauta, 0);
  return (
    <Window title="Growth · Todas las marcas · Octubre 2026" live="Datos cada 5 min">
      <div className="lp-tiles" style={{ marginTop: 0 }}>
        <div className="lp-tile"><div className="lp-tile__l">Ventas netas</div><div className="lp-tile__v">{cop(total)}</div></div>
        <div className="lp-tile"><div className="lp-tile__l">Pauta total</div><div className="lp-tile__v">{cop(totalPauta)}</div></div>
        <div className="lp-tile"><div className="lp-tile__l">ROAS del mes</div><div className="lp-tile__v">{ratio(total / totalPauta)}<small>mezcla</small></div></div>
      </div>
      <div className="lp-panel lp-scroll" style={{ marginTop: 14 }}>
        <table className="lp-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th className="num">Ventas netas</th>
              <th className="num">Pauta</th>
              <th className="num">ROAS</th>
              <th className="num">BE ROAS</th>
              <th style={{ paddingLeft: 14 }}>Veredicto</th>
            </tr>
          </thead>
          <tbody>
            {BRANDS.map((b) => {
              const roas = b.ventas / b.pauta;
              return (
                <tr key={b.name}>
                  <td><span className="brand"><i className={b.src} />{b.name}</span></td>
                  <td className="num">{cop(b.ventas)}</td>
                  <td className="num">{cop(b.pauta)}</td>
                  <td className="num">{ratio(roas)}</td>
                  <td className="num">{ratio(b.be)}</td>
                  <td style={{ paddingLeft: 14 }}><Verdict roas={roas} be={b.be} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="lp-tiles">
        <div className="lp-tile"><div className="lp-tile__l">Sesiones</div><div className="lp-tile__v">48.210</div></div>
        <div className="lp-tile"><div className="lp-tile__l">Conversión</div><div className="lp-tile__v">2,1%</div></div>
        <div className="lp-tile"><div className="lp-tile__l">Pedidos</div><div className="lp-tile__v">1.012</div></div>
      </div>
      <div className="lp-sources" aria-label="Fuentes conectadas">
        {['Shopify', 'WooCommerce', 'Meta Ads', 'Google Ads', 'TikTok Ads'].map((s) => <span className="lp-chip" key={s}>{s}</span>)}
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Reuniones → tareas por WhatsApp                                    */
/* ------------------------------------------------------------------ */

const PROPOSED = [
  { t: 'Subir el presupuesto diario de Meta a $1.200.000', who: 'Camila', when: 'vie 24 oct' },
  { t: 'Grabar 4 creativos nuevos para el lanzamiento', who: 'Andrés', when: 'mar 28 oct' },
  { t: 'Enviar informe de septiembre a la marca', who: 'Laura', when: 'jue 23 oct' },
];

export function WhatsAppThread() {
  return (
    <div className="lp-phone">
      <div className="lp-phone__head">
        <div className="lp-phone__avatar" aria-hidden="true">O</div>
        <div>
          <div className="lp-phone__name">Orbit · LA REAL</div>
          <div className="lp-phone__status">WhatsApp de la agencia</div>
        </div>
      </div>
      <div className="lp-phone__body">
        <div className="lp-msg lp-msg--out">
          <div className="lp-msg__file">
            <FileText aria-hidden="true" />
            <div>Reunión Marca Demo — 20 oct.txt<small>Transcripción Tactiq · 42 min</small></div>
          </div>
          Reunión de hoy con Marca Demo
          <span className="lp-msg__time">10:48</span>
        </div>
        <div className="lp-msg lp-msg--in">
          Leí la reunión. Te propongo estas tareas:
          <div className="lp-tasks">
            {PROPOSED.map((t, i) => (
              <div className="lp-task" key={i}>
                <span className="lp-task__box" aria-hidden="true" />
                <div>
                  {t.t}
                  <div className="lp-task__meta"><span>{t.who}</span><span>·</span><span>{t.when}</span></div>
                </div>
              </div>
            ))}
          </div>
          Responde <strong>1</strong> para crearlas o dime qué cambio.
          <span className="lp-msg__time">10:49</span>
        </div>
        <div className="lp-msg lp-msg--out">1<span className="lp-msg__time">10:51</span></div>
        <div className="lp-msg lp-msg--in">
          Listo. 3 tareas creadas en <strong>Marca Demo · Octubre</strong> y avisé a Camila, Andrés y Laura.
          <div className="lp-tasks">
            <div className="lp-task"><span className="lp-task__box on" aria-hidden="true"><Check /></span><div>3 de 3 creadas</div></div>
          </div>
          <span className="lp-msg__time">10:51</span>
        </div>
      </div>
      <div className="lp-phone__input">Escribe un mensaje</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Portal del cliente                                                 */
/* ------------------------------------------------------------------ */

const PORTAL_NAV = [
  { l: 'Inicio', I: House, on: true },
  { l: 'Proyectos', I: FolderKanban },
  { l: 'Tareas', I: SquareCheckBig },
  { l: 'Reportes', I: ClipboardList },
  { l: 'Métricas', I: ChartColumn },
  { l: 'Finanzas', I: Wallet },
  { l: 'Documentos', I: PenLine },
  { l: 'Llamadas', I: Phone },
  { l: 'Creadores UGC', I: Clapperboard },
];

export function PortalView() {
  return (
    <div className="lp-window">
      <div className="lp-window__bar">
        <div className="lp-window__dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="lp-window__title">orbit.larealmarketing.com/portal · Marca Demo</div>
        <div className="lp-window__live">En línea</div>
      </div>
      <div className="lp-portal">
        <nav className="lp-portal__side" aria-label="Navegación del portal (maqueta)">
          <div className="lp-portal__brand"><i aria-hidden="true" />Marca Demo</div>
          {PORTAL_NAV.map((item) => {
            const Icon = item.I;
            return (
              <a key={item.l} href="#portal" className={item.on ? 'on' : undefined} onClick={(e) => e.preventDefault()} tabIndex={-1} aria-hidden="true">
                <Icon />{item.l}
              </a>
            );
          })}
        </nav>
        <div className="lp-portal__main">
          <div className="lp-portal__hello">
            <div>
              <h4>Hola, Marca Demo</h4>
              <p>Martes 20 de octubre · utilidad del mes al día</p>
            </div>
            <span className="lp-chip lp-chip--green">Utilidad {cop(pnl(DEMO).utilidad)}</span>
          </div>
          <div className="lp-portal__grid">
            <div className="lp-card-sm">
              <div className="lp-card-sm__t">Proyectos en curso <small>2 activos</small></div>
              <ul>
                <li><span>Lanzamiento colección noviembre</span><span>68%</span></li>
              </ul>
              <div className="lp-progress"><i style={{ width: '68%' }} /></div>
              <ul>
                <li><span>Optimización de la tienda</span><span>35%</span></li>
              </ul>
              <div className="lp-progress"><i style={{ width: '35%' }} /></div>
            </div>
            <div className="lp-card-sm">
              <div className="lp-card-sm__t">Pendientes de tu lado <small>3</small></div>
              <ul>
                <li><span>Aprobar 4 creativos</span><span>hoy</span></li>
                <li><span>Enviar fotos del producto nuevo</span><span>jue 23</span></li>
                <li><span>Confirmar stock para campaña</span><span>vie 24</span></li>
              </ul>
            </div>
            <div className="lp-card-sm">
              <div className="lp-card-sm__t">Documentos <small>1 por firmar</small></div>
              <ul>
                <li><span>Renovación de contrato Q4</span><span>firmar</span></li>
                <li><span>Propuesta pauta noviembre</span><span>firmado</span></li>
              </ul>
            </div>
            <div className="lp-card-sm">
              <div className="lp-card-sm__t">Reportes y métricas <small>en vivo</small></div>
              <ul>
                <li><span>Informe de septiembre</span><span>listo</span></li>
                <li><span>ROAS del mes</span><span>5,88</span></li>
                <li><span>Ventas por WhatsApp registradas</span><span>14</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
