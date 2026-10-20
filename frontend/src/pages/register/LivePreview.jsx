/**
 * Preview en vivo del registro: una ventana de Orbit en miniatura que se va armando
 * con el nombre, logo, color de acento, plan, módulos y equipo que la agencia elige.
 * Solo presentación: recibe el estado del formulario por props.
 */
import { LayoutDashboard, Search, Settings, Sparkles } from 'lucide-react';
import { PLANS, sidebarItemsFor, formatCOP, initialsOf } from '../../components/onboarding/modules';

const BARS = [38, 52, 44, 61, 58, 72, 66, 80, 74, 88, 82, 95, 90, 100];

const STEP_COPY = {
  1: { title: 'Así se verá tu Orbit.', sub: 'Cada paso que completes aparece aquí en tiempo real.' },
  2: { title: 'Tu agencia, con tu marca.', sub: 'El logo y el color que elijas visten el sidebar y los acentos de toda la app.' },
  3: { title: 'Un plan, 14 días para probarlo.', sub: 'Sin tarjeta. Puedes cambiar de plan cuando quieras.' },
  4: { title: 'Solo los módulos que usas.', sub: 'El menú se arma con lo que enciendas. Lo demás no estorba.' },
  5: { title: 'Tu equipo, desde el día uno.', sub: 'Cada persona recibe su acceso por correo con un PIN propio.' },
  6: { title: 'La casa está montada.', sub: 'Entra, conecta tu primera marca y empieza a ver utilidad real.' },
};

export const MockWindow = ({ data, compact = false }) => {
  const { name, orgName, logo, logoFit, accent, planId, modules, invites, step } = data;
  const plan = PLANS.find((p) => p.id === planId) || PLANS[1];
  const items = sidebarItemsFor(modules);
  const maxItems = compact ? 5 : 8;
  const shown = items.slice(0, maxItems);
  const rest = items.length - shown.length;
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'Hola';
  const validInvites = (invites || []).filter((i) => /\S+@\S+\.\S+/.test(i.email));
  const showPlan = step >= 3;
  const showModules = step >= 4;

  return (
    <div className="rg-win" style={{ '--rg-accent': accent }} aria-hidden="true">
      <aside className="rg-win__side">
        <div className="rg-win__brand">
          <span className="rg-win__logo">
            {logo ? <img src={logo} alt="" className={logoFit === 'cover' ? 'is-cover' : ''} /> : initialsOf(orgName, 'O')}
          </span>
          <span className={`rg-win__brandname ${orgName ? '' : 'is-placeholder'}`}>{orgName || 'Tu agencia'}</span>
        </div>
        <div className="rg-win__user">
          <span className="rg-win__avatar">{initialsOf(name, 'TÚ')}</span>
          <div>
            <b>{name || 'Tu nombre'}</b>
            <span>Administrador</span>
          </div>
        </div>
        <nav className="rg-win__nav">
          <span className="rg-win__item is-active"><LayoutDashboard /> Dashboard</span>
          {showModules ? (
            <>
              {shown.map((m) => {
                const Icon = m.icon;
                return <span key={m.key} className="rg-win__item"><Icon /> {m.name}</span>;
              })}
              {rest > 0 && <span className="rg-win__more">+{rest} más</span>}
            </>
          ) : (
            ['Clientes', 'Proyectos', 'Tareas', 'Métricas'].map((n) => (
              <span key={n} className="rg-win__item is-dim">
                <i style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(18,18,18,0.08)', display: 'inline-block' }} /> {n}
              </span>
            ))
          )}
        </nav>
        <div className="rg-win__foot">
          <span className="rg-win__item"><Settings /> Mi Cuenta</span>
        </div>
      </aside>
      <section className="rg-win__main">
        <div className="rg-win__top">
          <span className="rg-win__search"><Search /> Buscar… <span style={{ opacity: 0.6 }}>⌘K</span></span>
          <span className="rg-win__avatar">{initialsOf(name, 'TÚ')}</span>
        </div>
        <div className="rg-win__content">
          <div className="rg-win__greet">
            <div>
              <div className="rg-win__h">{name ? `Hola, ${firstName}` : 'Dashboard'}</div>
              <div className="rg-win__p">{orgName ? `Resumen de ${orgName}` : 'Resumen general de la agencia'}</div>
            </div>
            {showPlan && (
              <span className="rg-win__plan"><i /> {plan.name} · prueba 14 días</span>
            )}
          </div>
          <div className="rg-win__cards">
            <div className="rg-win__card"><small>Marcas conectadas</small><b>{showPlan ? (plan.id === 'agencia' ? '∞' : plan.id === 'growth' ? '10' : '3') : '—'}</b><em>disponibles</em></div>
            <div className="rg-win__card"><small>Utilidad del mes</small><b>{formatCOP(12480000)}</b><em>+18% vs mes pasado</em></div>
            <div className="rg-win__card"><small>Tareas de hoy</small><b>7</b><em>2 vencen hoy</em></div>
          </div>
          {!compact && (
            <div className="rg-win__chart">
              <div className="rg-win__chart-head"><b>Ventas por marca · últimos 14 días</b><span>cada 5 min</span></div>
              <div className="rg-win__bars">
                {BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
              </div>
            </div>
          )}
          <div className="rg-win__team">
            <span className="rg-win__team-avs">
              <span className="is-you">{initialsOf(name, 'TÚ')}</span>
              {validInvites.map((inv) => (
                <span key={inv.email}>{initialsOf(inv.email.split('@')[0].replace(/[._-]+/g, ' '), '?')}</span>
              ))}
            </span>
            {validInvites.length
              ? `${validInvites.length + 1} personas en el equipo`
              : step >= 5 ? 'Solo tú por ahora · invita a tu equipo' : 'Tu equipo aparecerá aquí'}
          </div>
        </div>
      </section>
    </div>
  );
};

const LivePreview = ({ data }) => {
  const copy = STEP_COPY[data.step] || STEP_COPY[1];
  return (
    <aside className="rg-preview-col" style={{ '--rg-accent': data.accent }}>
      <div className="rg-preview__head">
        <p className="rg-preview__eyebrow"><i /> Preview en vivo</p>
        <h2 className="rg-preview__title">{copy.title}</h2>
        <p className="rg-preview__sub">{copy.sub}</p>
      </div>
      <MockWindow data={data} />
      <p className="rg-preview__caption"><Sparkles /> Todo lo que eliges aquí se puede cambiar después en Mi Cuenta y Configuración.</p>
    </aside>
  );
};

export const LivePreviewMobile = ({ data }) => (
  <div className="rg-preview-mobile" style={{ '--rg-accent': data.accent }}>
    <MockWindow data={data} compact />
    <p className="rg-preview-mobile__cap"><i /> Preview en vivo de tu Orbit</p>
  </div>
);

export default LivePreview;
