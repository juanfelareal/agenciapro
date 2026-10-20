/**
 * Checklist "Primeros pasos" del Dashboard.
 * Detecta solo qué ya está hecho (GET /api/org/onboarding/status) y enlaza directo a cada tarea.
 * Se oculta con "Ya lo tengo" (settings.onboarding.dismissed) y reaparece desde Mi Cuenta.
 * Devuelve null si la org no tiene onboarding pendiente.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Megaphone, UsersRound, FolderKanban, Globe, Wallet, Check, ArrowRight, X, Compass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { onboardingAPI, startTour, ONBOARDING_CHANGED_EVENT } from './onboardingApi';

const buildTasks = (status) => {
  const c = status?.first_client;
  const platforms = c ? `/app/clients/${c.id}/plataformas` : '/app/clients';
  return [
    { key: 'store', icon: Store, title: 'Conecta tu primera tienda', desc: c ? `Abre Plataformas de ${c.name} y conecta Shopify o WooCommerce.` : 'Crea la marca como cliente y conecta Shopify o WooCommerce en Plataformas.', to: platforms, cta: c ? 'Abrir Plataformas' : 'Crear cliente' },
    { key: 'ads', icon: Megaphone, title: 'Conecta la pauta', desc: 'Meta, Google o TikTok Ads: las métricas llegan cada 5 minutos.', to: platforms, cta: 'Conectar pauta' },
    { key: 'team', icon: UsersRound, title: 'Invita a tu equipo', desc: 'Cada persona entra con su PIN y ve solo las pestañas que le des.', to: '/app/team', cta: 'Ir a Equipo' },
    { key: 'project', icon: FolderKanban, title: 'Crea el primer proyecto', desc: 'Un tablero por cliente con etapas y entregables.', to: '/app/projects', cta: 'Crear proyecto' },
    { key: 'portal', icon: Globe, title: 'Activa el portal de un cliente', desc: 'Genera el enlace de acceso en la ficha del cliente y compártelo.', to: '/app/clients', cta: 'Ir a Clientes' },
    { key: 'costs', icon: Wallet, title: 'Carga los costos de una marca', desc: 'Fijos y variables para ver la utilidad real día a día.', to: c ? `/app/growth/${c.id}/financials` : '/app/clients', cta: 'Cargar costos' },
  ];
};

const GettingStarted = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | hidden | error
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([onboardingAPI.get(), onboardingAPI.status()]);
      setStatus(b.data || null);
      const dismissed = !!a.data?.onboarding?.dismissed;
      const complete = b.data && b.data.done >= b.data.total;
      setState(dismissed || complete ? 'hidden' : 'ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onChange = () => load();
    window.addEventListener(ONBOARDING_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ONBOARDING_CHANGED_EVENT, onChange);
  }, [load]);

  const dismiss = async () => {
    setBusy(true);
    try {
      await onboardingAPI.update({ dismissed: true });
      setState('hidden');
      window.dispatchEvent(new CustomEvent(ONBOARDING_CHANGED_EVENT));
    } catch { /* se queda visible */ } finally { setBusy(false); }
  };

  if (state !== 'ready' || !status) return null;

  const tasks = buildTasks(status);
  const done = tasks.filter((t) => status.tasks?.[t.key]).length;
  const pct = Math.round((done / tasks.length) * 100);
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <section className="glass-card p-5 md:p-6 animate-fade-in" aria-labelledby="gs-title">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-mono tracking-wider uppercase text-[#7A7772]">Primeros pasos</p>
          <h2 id="gs-title" className="mt-1 text-xl font-semibold text-[#121212] tracking-tight">
            {done === 0 ? `Montemos tu casa${firstName ? `, ${firstName}` : ''}.` : done < tasks.length - 1 ? 'Vas bien. Sigamos.' : 'Casi listo.'}
          </h2>
          <p className="mt-1 text-sm text-[#7A7772]">
            Seis pasos para ver utilidad real por marca. Detectamos solos lo que ya hiciste.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => startTour()} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium text-[#121212] border border-[#121212]/[0.16] hover:border-[#121212] transition-colors">
            <Compass size={14} /> Ver el tour
          </button>
          <button type="button" onClick={dismiss} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] text-[#7A7772] hover:text-[#121212] hover:bg-[#121212]/[0.05] transition-colors disabled:opacity-50" title="Ocultar esta tarjeta (vuelve desde Mi Cuenta)">
            <X size={14} /> Ya lo tengo
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-[#121212]/[0.08] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#1E7A30' }} />
        </div>
        <span className="text-xs font-mono text-[#7A7772] shrink-0">{done}/{tasks.length}</span>
      </div>

      <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {tasks.map((t, i) => {
          const isDone = !!status.tasks?.[t.key];
          const Icon = t.icon;
          return (
            <li key={t.key} className={`group relative flex gap-3 p-3.5 rounded-2xl border transition-colors ${isDone ? 'border-[#44BF47]/30 bg-[#44BF47]/[0.06]' : 'border-[#121212]/[0.09] bg-white hover:border-[#121212]/[0.22]'}`}>
              <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${isDone ? 'bg-[#1E7A30] text-white' : 'bg-[#121314] text-[#44BF47]'}`}>
                {isDone ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-tight ${isDone ? 'text-[#1E7A30] line-through decoration-[#1E7A30]/40' : 'text-[#121212]'}`}>
                  <span className="font-mono text-[11px] text-[#7A7772] mr-1.5">{String(i + 1).padStart(2, '0')}</span>{t.title}
                </p>
                <p className="mt-0.5 text-xs text-[#7A7772] leading-snug">{isDone ? 'Hecho.' : t.desc}</p>
                {!isDone && (
                  <Link to={t.to} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#121212] hover:text-[#1E7A30]">
                    {t.cta} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default GettingStarted;
