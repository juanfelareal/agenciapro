import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Plus,
  Menu,
  X,
  Users,
  FolderKanban,
  Receipt,
  MessageCircle,
  Clapperboard,
  Lightbulb,
} from 'lucide-react';
import { HeroDashboard, FinanceScenarios, GrowthView, WhatsAppThread, PortalView } from './landing/Mockups';
import './landing/landing.css';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
const DEMO_MAIL = 'mailto:juanfe@larealmarketing.com?subject=Demo%20de%20Orbit';
const LAREAL_URL = 'https://landing.larealmarketing.com/';

const NAV = [
  { href: '#producto', label: 'Producto' },
  { href: '#finanzas', label: 'Finanzas' },
  { href: '#portal', label: 'Portal' },
  { href: '#precios', label: 'Precios' },
  { href: '#faq', label: 'FAQ' },
];

const PAINS = [
  {
    t: 'La operación vive regada',
    p: 'Excel para los números, Trello para las tareas, WhatsApp para todo lo demás. Nadie tiene la foto completa y el dueño termina siendo el pegamento.',
    q: '«¿En qué va lo de la marca?» — todos los días, en tres chats distintos.',
  },
  {
    t: 'El cliente pregunta cuánto ganó',
    p: 'Y la respuesta tarda días: hay que pedir ventas, cruzar pauta, descontar producto y envíos. Cuando llega, el mes ya cambió.',
    q: '«¿Y al final cuánto me quedó?» — y la agencia solo tiene el ROAS.',
  },
  {
    t: 'El ROAS no dice si la marca gana plata',
    p: 'Un ROAS de 3 puede ser pérdida para una marca y escalar para otra. Sin el punto de equilibrio por marca, cada decisión de pauta es una apuesta.',
    q: '«Subamos presupuesto» — sin saber si cada peso extra deja utilidad.',
  },
  {
    t: 'Los reportes se hacen a mano',
    p: 'Capturas de Ads Manager, tablas pegadas, un PDF que se arma la última semana del mes. Horas de equipo senior en trabajo repetitivo.',
    q: '«Mándame el informe» — y se van dos días de la cuenta.',
  },
];

const MODULES = [
  {
    I: Users,
    t: 'Clientes y CRM',
    p: 'Fichas de cliente, pipeline de leads, propuestas, contratos y documentos para firma electrónica, bitácora por cliente.',
    tags: ['Pipeline', 'Firma electrónica', 'Bitácora'],
  },
  {
    I: FolderKanban,
    t: 'Proyectos y tareas',
    p: 'Kanban, lista y calendario. Plantillas de proyecto, vistas guardadas, asignación múltiple y avisos de tareas nuevas.',
    tags: ['Kanban', 'Plantillas', 'Vistas guardadas'],
  },
  {
    I: Receipt,
    t: 'Facturación y cartera',
    p: 'Facturas, cobros y recordatorios. El cliente sube el soporte de pago desde su portal. Gastos y nómina básica de la agencia.',
    tags: ['Cobros', 'Soportes', 'Gastos'],
  },
  {
    I: MessageCircle,
    t: 'WhatsApp integrado',
    p: 'Bandeja del número de la agencia y resúmenes automáticos al celular del dueño: rendimiento de ayer a las 6:00, ventas del día a las 12:00, tareas del equipo y alertas por marca.',
    tags: ['Meta Cloud API', 'Resúmenes 06:00 / 12:00', 'Alertas'],
  },
  {
    I: Clapperboard,
    t: 'UGC',
    p: 'Base de creadores, contratos públicos para firmar y onboarding. Cada marca ve sus creadores desde el portal.',
    tags: ['Creadores', 'Contratos', 'Onboarding'],
  },
  {
    I: Lightbulb,
    t: 'Novedades y mejoras',
    p: 'Changelog interno para que el equipo sepa qué cambió, y buzón de ideas para que las mejoras salgan del día a día.',
    tags: ['Changelog', 'Buzón de ideas'],
  },
];

const STEPS = [
  {
    t: 'Conectas tiendas y cuentas de pauta',
    p: 'Shopify o WooCommerce, Meta Ads, Google Ads y TikTok Ads. Una vez conectadas, Orbit sincroniza cada 5 minutos sin que nadie exporte nada.',
    time: 'Día 1',
  },
  {
    t: 'Cargas los costos de cada marca',
    p: 'Costo de producto por referencia, pasarela, envío, comisiones y fijos. Con eso Orbit calcula el BE ROAS y la utilidad real día a día.',
    time: 'Semana 1 · con LA REAL',
  },
  {
    t: 'Tu equipo y tu cliente ven los números reales',
    p: 'El equipo opera desde Orbit; cada marca entra a su portal y ve proyectos, tareas, reportes y finanzas. Los resúmenes llegan solos al WhatsApp.',
    time: 'Desde la semana 2',
  },
];

const PLANS = [
  {
    name: 'Starter',
    for: 'Agencias que arrancan a ordenar la operación',
    price: '$249.000',
    features: [
      'Hasta 3 marcas conectadas',
      'Clientes, CRM, proyectos y tareas',
      'Métricas en vivo (Shopify / Woo + pauta)',
      'Portal del cliente',
      'Implementación acompañada por LA REAL',
    ],
    cta: 'Agenda una demo',
  },
  {
    name: 'Growth',
    for: 'Agencias que venden resultados por marca',
    price: '$489.000',
    featured: true,
    badge: 'Recomendado',
    features: [
      'Hasta 10 marcas conectadas',
      'Todo lo de Starter',
      'Finanzas por marca: P&L diario, BE ROAS y escenarios',
      'Reuniones → tareas por WhatsApp',
      'Resúmenes automáticos al celular del dueño',
      'Facturación y cartera',
      'Implementación acompañada por LA REAL',
    ],
    cta: 'Agenda una demo',
  },
  {
    name: 'Agencia',
    for: 'Operaciones con varios equipos y muchas marcas',
    price: '$990.000',
    features: [
      'Marcas ilimitadas',
      'Todo lo de Growth',
      'UGC: creadores, contratos y onboarding',
      'Bandeja de WhatsApp del número de la agencia',
      'Acompañamiento mensual de LA REAL',
    ],
    cta: 'Hablemos',
  },
];

const FAQS = [
  {
    q: '¿Orbit es un software o un servicio?',
    a: 'Las dos cosas. Es el software que LA REAL construyó en 2026 para operar su propia agencia, y se entrega con una implementación acompañada: conectamos tus tiendas y cuentas de pauta, cargamos los costos contigo y dejamos a tu equipo operando.',
  },
  {
    q: '¿Qué tiendas y plataformas de pauta conecta?',
    a: 'Shopify y WooCommerce del lado de ventas; Meta Ads, Google Ads y TikTok Ads del lado de pauta. Los datos se sincronizan cada 5 minutos. Las ventas por WhatsApp las registra el cliente desde su portal para que también entren al P&L.',
  },
  {
    q: '¿Cómo calcula la utilidad real de una marca?',
    a: 'Ventas netas sin IVA, menos costo de producto (por referencia), menos pauta, menos costos variables (pasarela, envío, comisiones), menos fijos. Eso da la utilidad del mes día a día, el punto de equilibrio y la proyección a fin de mes. El BE ROAS sale de la misma estructura de costos.',
  },
  {
    q: '¿Mis clientes pueden ver los datos de otras marcas?',
    a: 'No. Cada marca entra con su propio enlace y solo ve sus proyectos, tareas, reportes, métricas, finanzas y documentos. Tú decides por marca qué módulos tiene habilitados y si puede editar sus finanzas.',
  },
  {
    q: '¿Cómo funciona lo de reuniones a tareas?',
    a: 'Grabas la reunión con Tactiq, mandas la transcripción al WhatsApp de la agencia y Orbit propone las tareas con responsable y fecha. Confirmas por el mismo chat y quedan creadas en el proyecto de esa marca.',
  },
  {
    q: '¿Puedo exportar los informes?',
    a: 'Sí. Finanzas y métricas se exportan a PDF y Excel, y el portal del cliente tiene su propio informe financiero imprimible.',
  },
  {
    q: '¿Cuánto tarda la implementación?',
    a: 'Conectar tiendas y cuentas de pauta toma un día. Cargar costos y dejar el P&L afinado por marca, alrededor de una semana con el acompañamiento de LA REAL. Desde la segunda semana el equipo y los clientes ya operan en Orbit.',
  },
  {
    q: '¿Tengo que ser cliente de LA REAL?',
    a: 'No. Orbit se ofrece a agencias de marketing digital que operan marcas de ecommerce, sean o no clientes de LA REAL.',
  },
];

/* ------------------------------------------------------------------ */
/* Piezas pequeñas                                                      */
/* ------------------------------------------------------------------ */

function OrbitMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.25" opacity="0.25" />
      <ellipse cx="12" cy="12" rx="6" ry="10.5" transform="rotate(-32 12 12)" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <circle cx="19.2" cy="6.2" r="2" fill="#44BF47" />
    </svg>
  );
}

function Placeholder({ children }) {
  return <span className="lp-placeholder">{children}</span>;
}

/* Marca los {{...}} para que se vean como placeholders */
function withPlaceholders(text) {
  const parts = text.split(/(\{\{[A-Z_]+\}\})/g);
  return parts.map((part, i) => (/^\{\{[A-Z_]+\}\}$/.test(part) ? <Placeholder key={i}>{part}</Placeholder> : part));
}

function FAQ({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="lp-faq">
      {items.map((f, i) => {
        const isOpen = open === i;
        const id = `lp-faq-${i}`;
        return (
          <div className={`lp-faq__item${isOpen ? ' is-open' : ''}`} key={f.q}>
            <h3>
              <button type="button" className="lp-faq__q" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(isOpen ? null : i)}>
                <span>{f.q}</span>
                <Plus aria-hidden="true" />
              </button>
            </h3>
            <div className="lp-faq__a" id={id} role="region" aria-hidden={!isOpen}>
              <div><p>{f.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

const Landing = () => {
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // SEO + fuentes (sin tocar index.html)
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Orbit · El sistema operativo de tu agencia';

    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    const prevDesc = meta ? meta.getAttribute('content') : null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Orbit es el sistema operativo para agencias de marketing digital en Colombia: finanzas por marca con utilidad real y BE ROAS, métricas en vivo de Shopify y pauta, proyectos, portal del cliente y WhatsApp integrado. Construido por LA REAL.'
    );

    if (!document.getElementById('lp-fonts')) {
      const link = document.createElement('link');
      link.id = 'lp-fonts';
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      document.head.appendChild(link);
    }

    return () => {
      document.title = prevTitle;
      if (created) meta.remove();
      else if (prevDesc !== null) meta.setAttribute('content', prevDesc);
    };
  }, []);

  // Fade-up al hacer scroll
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const nodes = root.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const goTo = (e, href) => {
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    setMenuOpen(false);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="lp" ref={rootRef}>
      {/* ---------- Nav ---------- */}
      <header className={`lp-nav${menuOpen ? ' is-open' : ''}`}>
        <div className="lp-container">
          <div className="lp-nav__inner">
            <a href="#top" className="lp-brand" onClick={(e) => goTo(e, '#top')} aria-label="Orbit, inicio">
              <OrbitMark />
              <span className="lp-brand__name">Orbit</span>
              <span className="lp-brand__by">por LA REAL</span>
            </a>
            <nav className="lp-nav__links" aria-label="Secciones">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} onClick={(e) => goTo(e, n.href)}>{n.label}</a>
              ))}
            </nav>
            <div className="lp-nav__actions">
              <Link to="/login" className="lp-nav__login">Entrar</Link>
              <a href={DEMO_MAIL} className="lp-btn lp-btn--primary lp-btn--sm lp-nav__cta">Agenda una demo</a>
              <button
                type="button"
                className="lp-nav__burger"
                aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className="lp-nav__sheet">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={(e) => goTo(e, n.href)}>{n.label}</a>
            ))}
            <Link to="/login">Entrar</Link>
            <a href={DEMO_MAIL} className="lp-btn lp-btn--primary">Agenda una demo</a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="lp-hero">
          <div className="lp-container">
            <div className="lp-hero__grid">
              <p className="lp-eyebrow" data-reveal>Orbit · construido por LA REAL · Colombia</p>
              <h1 className="lp-h1" data-reveal data-reveal-delay="1">
                El sistema operativo <br />de tu agencia.
              </h1>
              <p className="lp-lead" data-reveal data-reveal-delay="2">
                Todas tus marcas, sus números reales y tu equipo en un solo lugar. Utilidad por marca día a día, métricas de tienda y pauta cada 5 minutos, proyectos, portal del cliente y WhatsApp integrado.
              </p>
              <div className="lp-hero__cta" data-reveal data-reveal-delay="3">
                <a href={DEMO_MAIL} className="lp-btn lp-btn--primary lp-btn--lg">
                  Agenda una demo <ArrowRight aria-hidden="true" />
                </a>
                <a href="#producto" className="lp-btn lp-btn--ghost lp-btn--lg" onClick={(e) => goTo(e, '#producto')}>
                  Ver cómo funciona
                </a>
              </div>
              <p className="lp-hero__note" data-reveal data-reveal-delay="3">Para agencias de marketing digital que operan marcas de ecommerce.</p>
            </div>
            <div className="lp-hero__mock" data-reveal>
              <HeroDashboard />
            </div>
          </div>
        </section>

        {/* ---------- Prueba social ---------- */}
        <section className="lp-proof" aria-label="Cifras de LA REAL con Orbit">
          <div className="lp-container">
            <div className="lp-proof__grid">
              <div className="lp-proof__item" data-reveal>
                <div className="lp-proof__n">18</div>
                <div className="lp-proof__l">tiendas Shopify y Woo conectadas hoy</div>
              </div>
              <div className="lp-proof__item" data-reveal data-reveal-delay="1">
                <div className="lp-proof__n">5 <em>min</em></div>
                <div className="lp-proof__l">entre cada sincronización de ventas y pauta</div>
              </div>
              <div className="lp-proof__item" data-reveal data-reveal-delay="2">
                <div className="lp-proof__n">+11</div>
                <div className="lp-proof__l">años de LA REAL operando marcas de ecommerce</div>
              </div>
              <div className="lp-proof__item" data-reveal data-reveal-delay="3">
                <div className="lp-proof__n">+$900 <em>M</em></div>
                <div className="lp-proof__l">en ventas de clientes vistas en Orbit en un rango reciente</div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Problema ---------- */}
        <section className="lp-section" id="problema">
          <div className="lp-container">
            <div className="lp-section__head">
              <p className="lp-eyebrow" data-reveal>El problema</p>
              <h2 className="lp-h2" data-reveal data-reveal-delay="1">Una agencia que crece se llena de herramientas, no de claridad.</h2>
            </div>
            <div className="lp-pains">
              {PAINS.map((p, i) => (
                <article className="lp-pain" key={p.t} data-reveal data-reveal-delay={String(Math.min(i, 3))}>
                  <div className="lp-pain__n">0{i + 1}</div>
                  <h3 className="lp-pain__t">{p.t}</h3>
                  <p className="lp-pain__p">{p.p}</p>
                  <p className="lp-pain__quote">{p.q}</p>
                </article>
              ))}
            </div>
            <div className="lp-problem__closer" data-reveal>
              <p className="lp-h3">
                Orbit nació de ese dolor. LA REAL lo construyó en 2026 sobre su propio día a día: <span className="lp-u">8 marcas de Growth</span>, 18 tiendas conectadas y un equipo que necesitaba una sola fuente de verdad.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Módulos ---------- */}
        <section className="lp-section" id="producto">
          <div className="lp-container">
            <div className="lp-section__head">
              <p className="lp-eyebrow" data-reveal>El producto</p>
              <h2 className="lp-h2" data-reveal data-reveal-delay="1">Lo que una agencia necesita para operar marcas, sin pegar nada a mano.</h2>
            </div>

            {/* Finanzas */}
            <div className="lp-feature" id="finanzas">
              <div className="lp-feature__text" data-reveal>
                <p className="lp-eyebrow">Finanzas por marca</p>
                <h3 className="lp-h2">La utilidad real de cada marca, día a día.</h3>
                <p className="lp-lead">
                  Ventas netas sin IVA, menos producto, pauta, variables y fijos. Orbit lo calcula solo con los datos sincronizados y los costos que cargas una vez.
                </p>
                <ul className="lp-feature__list">
                  <li><Check aria-hidden="true" /><span><strong>BE ROAS por marca</strong> con veredicto: escalar, sostener o no escalar.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Punto de equilibrio y proyección</strong> a fin de mes, con descuentos discriminados.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Escenarios</strong> privados o compartidos: ¿y si invierto el doble?, ¿y si pago el envío?</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Patrones de compra</strong> (día × hora), nuevos vs. recurrentes con CAC y recompra, inventario y reservas para 3PL.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Exporta a PDF y Excel</strong> cuando el cliente lo pida.</span></li>
                </ul>
              </div>
              <div className="lp-feature__mock" data-reveal data-reveal-delay="1">
                <FinanceScenarios />
              </div>
            </div>

            {/* Métricas */}
            <div className="lp-feature lp-feature--flip" id="metricas">
              <div className="lp-feature__text" data-reveal>
                <p className="lp-eyebrow">Métricas en vivo</p>
                <h3 className="lp-h2">Todas las marcas en una vista, con datos de hace cinco minutos.</h3>
                <p className="lp-lead">
                  Shopify o WooCommerce, Meta Ads, Google Ads y TikTok Ads sincronizados cada 5 minutos. ROAS, venta neta sin IVA, sesiones y conversión por marca, sin exportar nada.
                </p>
                <ul className="lp-feature__list">
                  <li><Check aria-hidden="true" /><span><strong>Vista Growth</strong>: ROAS del mes y BE ROAS de cada marca, lado a lado.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Alertas por WhatsApp</strong> cuando una marca va muy bien o muy mal.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Resumen a las 6:00</strong> con el rendimiento de ayer y <strong>a las 12:00</strong> con las ventas del día.</span></li>
                </ul>
              </div>
              <div className="lp-feature__mock" data-reveal data-reveal-delay="1">
                <GrowthView />
              </div>
            </div>

            {/* Reuniones → tareas */}
            <div className="lp-feature" id="reuniones">
              <div className="lp-feature__text" data-reveal>
                <p className="lp-eyebrow">Reuniones → tareas</p>
                <h3 className="lp-h2">De la reunión a las tareas, por WhatsApp.</h3>
                <p className="lp-lead">
                  Mandas la transcripción de la reunión (Tactiq) al WhatsApp de la agencia. Orbit propone las tareas con responsable y fecha; confirmas y quedan creadas en el proyecto de esa marca.
                </p>
                <ul className="lp-feature__list">
                  <li><Check aria-hidden="true" /><span><strong>Sin abrir el computador</strong>: todo pasa en el mismo chat.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Avisos de tareas nuevas</strong> para cada responsable.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Bandeja del número de la agencia</strong> dentro de Orbit, con Meta Cloud API.</span></li>
                </ul>
              </div>
              <div className="lp-feature__mock" data-reveal data-reveal-delay="1">
                <WhatsAppThread />
              </div>
            </div>

            {/* Portal */}
            <div className="lp-feature lp-feature--flip" id="portal">
              <div className="lp-feature__text" data-reveal>
                <p className="lp-eyebrow">Portal del cliente</p>
                <h3 className="lp-h2">Cada marca entra con su enlace y ve lo suyo.</h3>
                <p className="lp-lead">
                  Proyectos, tareas, reportes, métricas y finanzas de su marca. Documentos para firmar, formularios, llamadas y creadores UGC. Tú decides qué módulos ve cada cliente y si puede editar sus finanzas.
                </p>
                <ul className="lp-feature__list">
                  <li><Check aria-hidden="true" /><span><strong>Menos «¿en qué van?»</strong>: el cliente consulta antes de preguntar.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Soportes de pago y firmas</strong> desde el mismo portal.</span></li>
                  <li><Check aria-hidden="true" /><span><strong>Ventas por WhatsApp</strong> registradas por el cliente para que entren al P&amp;L.</span></li>
                </ul>
              </div>
              <div className="lp-feature__mock" data-reveal data-reveal-delay="1">
                <PortalView />
              </div>
            </div>

            {/* Grilla compacta */}
            <div className="lp-section__head" style={{ marginTop: 'clamp(40px, 6vw, 80px)' }}>
              <p className="lp-eyebrow" data-reveal>Y todo lo demás</p>
              <h3 className="lp-h2" data-reveal data-reveal-delay="1" style={{ fontSize: 'clamp(28px, 3.2vw, 44px)' }}>Lo que hoy tienes en cinco herramientas, en una.</h3>
            </div>
            <div className="lp-modules">
              {MODULES.map((m, i) => {
                const Icon = m.I;
                return (
                  <article className="lp-module" key={m.t} data-reveal data-reveal-delay={String(i % 3)}>
                    <div className="lp-module__icon"><Icon aria-hidden="true" /></div>
                    <h4 className="lp-module__t">{m.t}</h4>
                    <p className="lp-module__p">{m.p}</p>
                    <div className="lp-module__tags">
                      {m.tags.map((tag) => <span className="lp-tag" key={tag}>{tag}</span>)}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section className="lp-section" id="como-funciona">
          <div className="lp-container">
            <div className="lp-section__head">
              <p className="lp-eyebrow" data-reveal>Cómo funciona</p>
              <h2 className="lp-h2" data-reveal data-reveal-delay="1">Tres pasos. Dos semanas. Una sola fuente de verdad.</h2>
            </div>
            <div className="lp-steps">
              {STEPS.map((s, i) => (
                <div className="lp-step" key={s.t} data-reveal data-reveal-delay={String(i)}>
                  <div className="lp-step__n">PASO {i + 1}</div>
                  <h3 className="lp-step__t">{s.t}</h3>
                  <p className="lp-step__p">{s.p}</p>
                  <div className="lp-step__time">{s.time}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Precios ---------- */}
        <section className="lp-section" id="precios">
          <div className="lp-container">
            <div className="lp-section__head lp-section__head--center">
              <p className="lp-eyebrow lp-eyebrow--plain" data-reveal>Precios</p>
              <h2 className="lp-h2" data-reveal data-reveal-delay="1">Un plan por el tamaño de tu operación.</h2>
              <p className="lp-lead" data-reveal data-reveal-delay="2">Todos incluyen implementación acompañada por LA REAL. Precios mensuales en pesos colombianos, más IVA.</p>
            </div>
            <div className="lp-plans">
              {PLANS.map((plan, i) => (
                <article className={`lp-plan${plan.featured ? ' lp-plan--featured' : ''}`} key={plan.name} data-reveal data-reveal-delay={String(i)}>
                  {plan.badge && <span className="lp-chip lp-chip--green lp-plan__badge">{plan.badge}</span>}
                  <div className="lp-plan__name">{plan.name}</div>
                  <div className="lp-plan__for">{plan.for}</div>
                  <div className="lp-plan__price">
                    <span className="lp-plan__amount">{withPlaceholders(plan.price)}</span>
                    <span className="lp-plan__period">COP / mes</span>
                  </div>
                  <div className="lp-plan__iva">+ IVA</div>
                  <ul className="lp-plan__list">
                    {plan.features.map((f) => (
                      <li key={f}><Check aria-hidden="true" /><span>{withPlaceholders(f)}</span></li>
                    ))}
                  </ul>
                  <a href={DEMO_MAIL} className={`lp-btn ${plan.featured ? 'lp-btn--green' : 'lp-btn--ghost'}`}>
                    {plan.cta} <ArrowRight aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
            <p className="lp-plans__note" data-reveal>
              ¿Tu agencia opera marcas fuera de Shopify o Woo, o necesita algo distinto? Escríbenos y lo revisamos juntos.
            </p>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="lp-section" id="faq">
          <div className="lp-container">
            <div className="lp-section__head lp-section__head--center">
              <p className="lp-eyebrow lp-eyebrow--plain" data-reveal>Preguntas frecuentes</p>
              <h2 className="lp-h2" data-reveal data-reveal-delay="1">Lo que nos preguntan antes de la demo.</h2>
            </div>
            <div data-reveal>
              <FAQ items={FAQS} />
            </div>
          </div>
        </section>

        {/* ---------- Cierre ---------- */}
        <section className="lp-close" id="demo">
          <div className="lp-container">
            <p className="lp-eyebrow" data-reveal>Agenda una demo</p>
            <h2 className="lp-h2" data-reveal data-reveal-delay="1">Mira Orbit con los números de tu agencia.</h2>
            <p className="lp-lead" data-reveal data-reveal-delay="2">
              Una llamada de 30 minutos. Te mostramos cómo opera LA REAL en Orbit y vemos cómo quedaría con tus marcas.
            </p>
            <div className="lp-close__cta" data-reveal data-reveal-delay="3">
              <a href={DEMO_MAIL} className="lp-btn lp-btn--green lp-btn--lg">
                Agenda una demo <ArrowRight aria-hidden="true" />
              </a>
              <a href={LAREAL_URL} className="lp-btn lp-btn--light lp-btn--lg" target="_blank" rel="noreferrer">
                Conocer LA REAL <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
            <p className="lp-close__mail" data-reveal data-reveal-delay="3">
              O escribe a <a href="mailto:juanfe@larealmarketing.com">juanfe@larealmarketing.com</a>
            </p>

            <footer className="lp-footer">
              <div className="lp-footer__inner">
                <div>© 2026 Orbit · LA REAL</div>
                <div className="lp-footer__links">
                  <a href={LAREAL_URL} target="_blank" rel="noreferrer">larealmarketing.com</a>
                  <Link to="/login">Entrar</Link>
                  <a href="#top" onClick={(e) => goTo(e, '#top')}>Volver arriba</a>
                </div>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Landing;
