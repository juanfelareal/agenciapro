/**
 * Tour guiado de Orbit — sin librerías.
 * Spotlight (SVG con máscara) alrededor de cada ítem del menú marcado con data-tour,
 * tooltip con título + 1 frase + Siguiente / Saltar.
 *
 * Se dispara con ?tour=1, la primera vez (settings.onboarding.tour_seen=false) o con el
 * evento `orbit:tour-start` (Mi Cuenta → "Ver el tour otra vez").
 * En móvil abre el drawer del menú antes de los pasos del sidebar (evento `orbit:tour-menu`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useIsMobile from '../../hooks/useIsMobile';
import { onboardingAPI, requestMenu, TOUR_START_EVENT } from './onboardingApi';
import { MODULES } from './modules';

/** Copy por data-tour. Lo que no esté aquí no entra al tour. `menu` = necesita el sidebar abierto en móvil. */
const COPY = {
  dashboard: { title: 'Dashboard', text: 'Tu resumen del día: ventas, tareas y alertas de todas las marcas en una sola pantalla.', menu: true },
  novedades: { title: 'Novedades', text: 'Aquí te contamos qué cambió en Orbit. Cuando hay algo nuevo, aparece un punto rojo.', menu: true },
  clients: { title: 'Clientes', text: 'Cada marca con su ficha: tienda, pauta, portal y equipo. Aquí conectas tu primera tienda.', menu: true },
  crm: { title: 'CRM', text: 'Tu pipeline de prospectos, de la primera llamada al contrato firmado.', menu: true },
  'email-marketing': { title: 'Email marketing', text: 'Campañas y flujos de cada marca con sus resultados.', menu: true },
  whatsapp: { title: 'WhatsApp', text: 'La bandeja del número de la agencia y las reuniones que se vuelven tareas.', menu: true },
  ugc: { title: 'UGC', text: 'Creadores, briefs, contratos y liquidaciones de contenido.', menu: true },
  documentos: { title: 'Documentos', text: 'Contratos y NDAs con firma digital desde el portal del cliente.', menu: true },
  projects: { title: 'Proyectos', text: 'Tableros por cliente con etapas y entregables. Crea el primero desde aquí.', menu: true },
  'plantillas-proyecto': { title: 'Plantillas', text: 'Guarda la estructura de un proyecto que repites y créalo en un clic.', menu: true },
  tasks: { title: 'Tareas', text: 'Lo de hoy, lo vencido y lo de cada persona. Lista, tablero o calendario.', menu: true },
  reuniones: { title: 'Reuniones', text: 'Actas que se convierten en tareas asignadas, sin copiar y pegar.', menu: true },
  finanzas: { title: 'Finanzas', text: 'Facturas, cartera, gastos y comisiones: el dinero de la agencia.', menu: true },
  metricas: { title: 'Métricas', text: 'Ventas de tienda y pauta cada 5 minutos, y la utilidad real por marca.', menu: true },
  reportes: { title: 'Reportes', text: 'Informes mensuales por cliente, listos para enviar.', menu: true },
  notas: { title: 'Bloc de notas', text: 'Notas colaborativas por cliente, con comentarios y versiones.', menu: true },
  formularios: { title: 'Formularios', text: 'Briefs y encuestas que el cliente llena desde un enlace.', menu: true },
  sops: { title: 'SOPs', text: 'Procesos documentados para que la operación no dependa de una persona.', menu: true },
  team: { title: 'Equipo', text: 'Invita a tu gente y define qué pestañas ve cada quien.', menu: true },
  search: { title: 'Buscador', text: 'Encuentra cualquier tarea, proyecto o cliente desde donde estés. Atajo: ⌘K.', menu: false },
  settings: { title: 'Mi Cuenta', text: 'Tu perfil, el logo de la agencia y tu PIN. Desde aquí también repites este tour.', menu: true },
};
const ORDER_TAIL = ['search', 'settings'];
const PAD = 6;
const TOOLTIP_W = 320;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** data-tour → claves de módulo que lo habilitan (si la org tiene módulos configurados). */
const TOUR_MODULES = MODULES.reduce((acc, m) => { (acc[m.tour] ||= []).push(m.key); return acc; }, {});
const ALWAYS = new Set(['dashboard', 'search', 'settings']);

const collectSteps = (modules) => {
  const els = Array.from(document.querySelectorAll('[data-tour]'));
  const byKey = new Map();
  for (const el of els) {
    const key = el.getAttribute('data-tour');
    if (!COPY[key] || byKey.has(key)) continue;
    // Con módulos configurados: un paso por pestaña habilitada (las pestañas sin módulo asociado se omiten)
    if (modules && !ALWAYS.has(key)) {
      const keys = TOUR_MODULES[key];
      if (!keys || !keys.some((k) => modules[k])) continue;
    }
    byKey.set(key, el);
  }
  const navKeys = [...byKey.keys()].filter((k) => !ORDER_TAIL.includes(k));
  const keys = [...navKeys, ...ORDER_TAIL.filter((k) => byKey.has(k))];
  return keys.map((key) => ({ key, ...COPY[key] }));
};

const Tour = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [steps, setSteps] = useState([]);
  const [idx, setIdx] = useState(-1);
  const [rect, setRect] = useState(null);
  const startedRef = useRef(false);
  const checkedRef = useRef(false);
  const modulesRef = useRef(undefined); // undefined = no consultado · null = la org no tiene módulos configurados
  const active = idx >= 0 && idx < steps.length;
  const step = active ? steps[idx] : null;

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.key}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [step]);

  const finish = useCallback(async (markSeen = true) => {
    setIdx(-1);
    setSteps([]);
    startedRef.current = false;
    if (isMobile) requestMenu(false);
    if (location.search.includes('tour=1')) {
      const params = new URLSearchParams(location.search);
      params.delete('tour');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true });
    }
    if (markSeen) onboardingAPI.update({ tour_seen: true }).catch(() => {});
  }, [isMobile, location.pathname, location.search, navigate]);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (modulesRef.current === undefined) {
      try { modulesRef.current = (await onboardingAPI.get()).data?.modules || null; } catch { modulesRef.current = null; }
    }
    if (isMobile) { requestMenu(true); await sleep(380); }
    else await sleep(120);
    const list = collectSteps(modulesRef.current);
    if (!list.length) { startedRef.current = false; return; }
    setSteps(list);
    setIdx(0);
  }, [isMobile]);

  // Disparadores: ?tour=1 · evento manual · primera vez
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tour') === '1') {
      const t = setTimeout(start, 500);
      return () => clearTimeout(t);
    }
  }, [location.search, start]);

  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [start]);

  useEffect(() => {
    if (checkedRef.current || !user) return;
    if (new URLSearchParams(location.search).get('tour') === '1') return;
    if (sessionStorage.getItem('orbit:tour-checked')) { checkedRef.current = true; return; }
    checkedRef.current = true;
    let cancelled = false;
    onboardingAPI.get()
      .then(({ data }) => {
        sessionStorage.setItem('orbit:tour-checked', '1');
        if (cancelled) return;
        modulesRef.current = data?.modules || null;
        if (data?.onboarding && data.onboarding.tour_seen === false && user.role === 'admin') {
          setTimeout(start, 900);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, location.search, start]);

  // Al cambiar de paso: abrir/cerrar drawer en móvil, hacer scroll al ítem y medir
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    (async () => {
      if (isMobile) { requestMenu(!!step.menu); await sleep(step.menu ? 360 : 300); }
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.key}"]`);
      if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      await sleep(60);
      if (!cancelled) measure();
    })();
    return () => { cancelled = true; };
  }, [step, isMobile, measure]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    const t = setInterval(measure, 500); // sidebar colapsándose, fuentes cargando, etc.
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      clearInterval(t);
    };
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, idx, steps.length]);

  const next = () => {
    if (idx + 1 >= steps.length) finish();
    else setIdx(idx + 1);
  };

  if (!active) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;

  // Posición del tooltip
  const tw = Math.min(TOOLTIP_W, vw - 24);
  let tx = 12; let ty = 12; let arrow = 'none';
  if (hole) {
    const spaceRight = vw - (hole.x + hole.w);
    if (!isMobile && spaceRight >= tw + 28) {
      tx = hole.x + hole.w + 14;
      ty = Math.min(Math.max(12, hole.y - 6), vh - 12 - 170);
      arrow = 'left';
    } else if (vh - (hole.y + hole.h) >= 190) {
      ty = hole.y + hole.h + 14;
      tx = Math.min(Math.max(12, hole.x + hole.w / 2 - tw / 2), vw - tw - 12);
      arrow = 'top';
    } else {
      ty = Math.max(12, hole.y - 14 - 170);
      tx = Math.min(Math.max(12, hole.x + hole.w / 2 - tw / 2), vw - tw - 12);
      arrow = 'bottom';
    }
  }

  const isLast = idx === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tour de Orbit">
      <svg className="absolute inset-0 w-full h-full" width={vw} height={vh} aria-hidden="true">
        <defs>
          <mask id="orbit-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="14" fill="black" />}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(18,19,20,0.62)" mask="url(#orbit-tour-mask)" />
        {hole && (
          <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="14" fill="none" stroke="#44BF47" strokeWidth="2" className="transition-all duration-300" />
        )}
      </svg>

      <div
        className="absolute transition-all duration-300 ease-out"
        style={{ left: tx, top: ty, width: tw }}
      >
        <div className="relative rounded-2xl p-4 shadow-2xl" style={{ background: '#FBFAF8', border: '1px solid rgba(18,18,18,0.09)' }}>
          {arrow !== 'none' && (
            <span
              aria-hidden="true"
              className="absolute w-3 h-3 rotate-45"
              style={{
                background: '#FBFAF8',
                borderLeft: arrow === 'left' || arrow === 'bottom' ? '1px solid rgba(18,18,18,0.09)' : 'none',
                borderBottom: arrow === 'left' || arrow === 'bottom' ? '1px solid rgba(18,18,18,0.09)' : 'none',
                borderTop: arrow === 'top' ? '1px solid rgba(18,18,18,0.09)' : 'none',
                borderRight: arrow === 'top' ? 'none' : undefined,
                ...(arrow === 'left' ? { left: -7, top: 22 } : {}),
                ...(arrow === 'top' ? { top: -7, left: Math.min(Math.max(16, (hole?.x ?? 0) + (hole?.w ?? 0) / 2 - tx - 6), tw - 28), borderLeft: '1px solid rgba(18,18,18,0.09)' } : {}),
                ...(arrow === 'bottom' ? { bottom: -7, left: Math.min(Math.max(16, (hole?.x ?? 0) + (hole?.w ?? 0) / 2 - tx - 6), tw - 28), borderLeft: 'none', borderBottom: 'none', borderRight: '1px solid rgba(18,18,18,0.09)', borderTop: 'none', boxShadow: '1px 1px 0 rgba(18,18,18,0.09)' } : {}),
              }}
            />
          )}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono tracking-wider uppercase text-[#7A7772]">Paso {idx + 1} de {steps.length}</p>
              <h3 className="mt-1 text-[15px] font-semibold text-[#121212] tracking-tight">{step.title}</h3>
            </div>
            <button type="button" onClick={() => finish()} className="p-1 -mr-1 -mt-1 rounded-lg text-[#7A7772] hover:text-[#121212] hover:bg-[#121212]/[0.05]" aria-label="Saltar tour"><X size={16} /></button>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-snug text-[#3A3A3A]">{step.text}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1" aria-hidden="true">
              {steps.map((s, i) => (
                <span key={s.key} className="h-1 rounded-full transition-all" style={{ width: i === idx ? 14 : 5, background: i <= idx ? '#1E7A30' : 'rgba(18,18,18,0.14)' }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => finish()} className="px-3 h-8 rounded-full text-[13px] text-[#7A7772] hover:text-[#121212]">Saltar</button>
              <button type="button" onClick={next} className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[13px] font-medium text-white" style={{ background: '#121314' }}>
                {isLast ? 'Terminar' : 'Siguiente'} {!isLast && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tour;
