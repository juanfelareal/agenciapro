// [modules][billing] Suscripción: estado del plan, pago mensual/anual (Bold o transferencia),
// add-ons, uso vs límites e historial de pagos. La oferta sale de config/pricing.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check, Sparkles, Clock, Users, Store, Building2, ToggleRight, Info, Copy, ExternalLink, Loader2, Lock,
  MessageCircle, Minus, Plus, ShieldCheck, AlertTriangle, CreditCard, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgPlan } from '../hooks/useOrgPlan';
import { orgAPI } from '../utils/orgApi';
import { orgBillingAPI } from '../utils/api';
import { PLAN_LABELS, STATUS_LABELS } from '../utils/modules';
import {
  PLANS, ADDONS, CYCLES, fmtCOP, withIva, ivaOf, priceFor, monthlyEquivalent, monthlyTimes12, annualSavings,
  includedTotal, limitsLabel, addonsForPlan, INCLUDED_LABEL, PRICE_LOCK_LABEL, GUARANTEE_LABEL, TRIAL_DAYS,
} from '../config/pricing';

const fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  (d ? new Date(d).toLocaleDateString('es-CO', opts) : null);
const isMissing = (err) => [404, 405, 501].includes(err?.response?.status);
const CONTACT = 'mailto:juanfe@larealmarketing.com?subject=Pago%20de%20Orbit';
const WHATSAPP_SETTINGS = '/app/configuracion/whatsapp';

/* ------------------------------------------------------------------ */
/* Piezas                                                               */
/* ------------------------------------------------------------------ */

const Eyebrow = ({ children, className = '' }) => (
  <p className={`text-[11px] font-mono tracking-wider uppercase text-[#7A7772] ${className}`}>{children}</p>
);

const UsageBar = ({ icon, label, used, limit }) => {
  const Icon = icon;
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const full = !unlimited && used >= limit;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-[#121314] font-medium"><Icon size={16} className="text-[#7A7772]" /> {label}</span>
        <span className={`font-mono text-[13px] ${full ? 'text-red-600' : 'text-[#121314]'}`}>
          {used}{unlimited ? '' : ` / ${limit}`}{unlimited && <span className="text-[#7A7772]"> · sin límite</span>}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[#121212]/[0.06] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-[#1E7A30]'}`} style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.2 : 1 }} />
      </div>
    </div>
  );
};

const CycleToggle = ({ cycle, onChange }) => (
  <div className="inline-flex items-center gap-0.5 p-[3px] rounded-full border border-[#121212]/[0.16] bg-[#FBFAF8]" role="radiogroup" aria-label="Ciclo de pago">
    {['monthly', 'annual'].map((c) => {
      const on = cycle === c;
      return (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => onChange(c)}
          className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium transition-colors ${on ? 'bg-[#121314] text-[#F3F1ED]' : 'text-[#3A3A3A] hover:text-[#121212]'}`}
        >
          {CYCLES[c].label}
          {c === 'annual' && (
            <span className={`font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full ${on ? 'bg-[#44BF47] text-[#121314]' : 'bg-[#44BF47]/15 text-[#1E7A30]'}`}>{CYCLES.annual.chip}</span>
          )}
        </button>
      );
    })}
  </div>
);

const Chip = ({ tone = 'neutral', children, className = '' }) => {
  const tones = {
    neutral: 'border-[#121212]/[0.16] text-[#3A3A3A]',
    green: 'border-[#44BF47]/40 bg-[#44BF47]/10 text-[#1E7A30]',
    amber: 'border-amber-300 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-700',
    dark: 'border-[#121314] bg-[#121314] text-[#F3F1ED]',
  };
  return <span className={`inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full border font-mono text-[10.5px] tracking-wider uppercase whitespace-nowrap ${tones[tone]} ${className}`}>{children}</span>;
};

const CopyButton = ({ value }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(value)); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* sin clipboard */ }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[#121212]/[0.16] text-xs font-medium text-[#121212] hover:border-[#121212] transition-colors">
      {done ? <Check size={13} className="text-[#1E7A30]" /> : <Copy size={13} />} {done ? 'Copiado' : 'Copiar'}
    </button>
  );
};

const Stepper = ({ value, onChange, disabled, min = 0, max = 50 }) => (
  <div className={`inline-flex items-center rounded-full border border-[#121212]/[0.16] bg-white ${disabled ? 'opacity-50' : ''}`}>
    <button type="button" aria-label="Quitar uno" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className="w-8 h-8 grid place-items-center rounded-full disabled:opacity-30 hover:bg-[#121212]/[0.05]"><Minus size={14} /></button>
    <span className="w-8 text-center font-mono text-sm tabular-nums">{value}</span>
    <button type="button" aria-label="Agregar uno" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className="w-8 h-8 grid place-items-center rounded-full disabled:opacity-30 hover:bg-[#121212]/[0.05]"><Plus size={14} /></button>
  </div>
);

const Switch = ({ on, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-[#1E7A30]' : 'bg-[#121212]/[0.18]'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

const Subscription = () => {
  const { isAdmin } = useAuth();
  const orgPlan = useOrgPlan();
  const {
    loading, loaded, plan, planName, status, daysLeft, trialExpired, trialEndsAt, planSelected, limits, usage, refresh,
    billingCycle, addons, addonsIncluded, planRenewsAt, priceLockedUntil, planPriceLocked,
  } = orgPlan;
  const [searchParams, setSearchParams] = useSearchParams();

  const isTrial = loaded && (status === 'trial' || !status);
  const isActive = status === 'active';
  const currentCycle = billingCycle || 'monthly';

  // Ciclo que el usuario está mirando (anual por defecto; si ya paga anual, anual)
  const [cycle, setCycle] = useState(() => (billingCycle === 'monthly' && status === 'active' ? 'monthly' : 'annual'));
  useEffect(() => { if (isActive) setCycle(currentCycle); }, [isActive, currentCycle]);
  const annual = cycle === 'annual';

  const [notice, setNotice] = useState(null); // { type: 'ok'|'error'|'info', text, cta? }
  const [checkingOut, setCheckingOut] = useState(null);
  const [manual, setManual] = useState(null); // respuesta provider=manual

  // Add-ons: estado local optimista + ocupado
  const [addonBusy, setAddonBusy] = useState(null);
  const [addonsError, setAddonsError] = useState(null); // { text, requiredPlan }
  const effectivePlanKey = (isTrial ? (planSelected || 'growth') : plan) || 'growth';
  const planForAddons = PLANS.find((p) => p.key === effectivePlanKey) || PLANS[1];
  const isAnnualActive = isActive && currentCycle === 'annual';
  // Qué add-ons cuentan como incluidos: si ya paga anual, los que dice el backend; si está mirando el
  // anual sin haberlo pagado, los que traería su plan (vista previa); en mensual, solo los del backend.
  const includedSet = useMemo(() => {
    if (isAnnualActive) return new Set(addonsIncluded?.length ? addonsIncluded : planForAddons.includedAddons);
    if (annual) return new Set(planForAddons.includedAddons);
    return new Set(addonsIncluded || []);
  }, [isAnnualActive, annual, addonsIncluded, planForAddons]);
  const includedChip = isAnnualActive ? 'Incluido en tu plan anual' : 'Incluido al pagar el anual';

  // Pagos
  const [payments, setPayments] = useState(null); // null = cargando, [] = vacío, false = no disponible
  const loadPayments = useCallback(async () => {
    try {
      const res = await orgBillingAPI.payments();
      setPayments(Array.isArray(res.data) ? res.data : (res.data?.payments || []));
    } catch (err) {
      setPayments(isMissing(err) ? false : []);
    }
  }, []);
  useEffect(() => { loadPayments(); }, [loadPayments]);

  // Volver de Bold: ?pago=<reference> → consultar estado cada 3 s hasta 60 s
  const pagoRef = searchParams.get('pago');
  const [payCheck, setPayCheck] = useState(null); // { state: 'checking'|'approved'|'pending'|'rejected'|'voided'|'unknown', reference, data }
  const pollTimer = useRef(null);
  useEffect(() => {
    if (!pagoRef) return undefined;
    let cancelled = false;
    const started = Date.now();
    setPayCheck({ state: 'checking', reference: pagoRef });
    const tick = async () => {
      if (cancelled) return;
      try {
        const { data } = await orgBillingAPI.status(pagoRef);
        if (cancelled) return;
        if (data?.status === 'approved') {
          setPayCheck({ state: 'approved', reference: pagoRef, data });
          await refresh();
          window.dispatchEvent(new CustomEvent('orbit:plan-changed'));
          loadPayments();
          return;
        }
        if (data?.status === 'rejected' || data?.status === 'voided') {
          setPayCheck({ state: data.status, reference: pagoRef, data });
          loadPayments();
          return;
        }
        if (Date.now() - started >= 60000) { setPayCheck({ state: 'pending', reference: pagoRef, data }); loadPayments(); return; }
        pollTimer.current = setTimeout(tick, 3000);
      } catch (err) {
        if (cancelled) return;
        if (isMissing(err) || Date.now() - started >= 60000) { setPayCheck({ state: 'unknown', reference: pagoRef }); return; }
        pollTimer.current = setTimeout(tick, 3000);
      }
    };
    tick();
    return () => { cancelled = true; if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [pagoRef, refresh, loadPayments]);

  const dismissPayCheck = () => {
    setPayCheck(null);
    const next = new URLSearchParams(searchParams);
    next.delete('pago');
    setSearchParams(next, { replace: true });
  };

  /* ---------- Checkout ---------- */
  const checkout = async (planKey) => {
    setCheckingOut(planKey);
    setNotice(null);
    setManual(null);
    try {
      const { data } = await orgBillingAPI.checkout(planKey, cycle);
      if (data?.provider === 'bold' && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data?.provider === 'manual') {
        setManual({ ...data, plan: planKey, cycle });
        return;
      }
      setNotice({ type: 'error', text: 'La pasarela respondió algo que no reconocemos. Escríbenos y lo resolvemos.' });
    } catch (err) {
      if (isMissing(err)) {
        // Backend de cobros aún no desplegado: dejamos registrada la solicitud como antes.
        try {
          await orgAPI.requestPlan(planKey);
          await refresh();
          window.dispatchEvent(new CustomEvent('orbit:plan-changed'));
          setNotice({ type: 'info', text: `El pago en línea todavía no está habilitado. Registramos tu solicitud del plan ${PLAN_LABELS[planKey] || planKey} ${annual ? 'anual' : 'mensual'}; LA REAL te contacta para el pago.` });
        } catch (e2) {
          setNotice({ type: 'error', text: e2?.response?.data?.error || 'No pudimos registrar la solicitud. Escríbenos a juanfe@larealmarketing.com.' });
        }
      } else {
        setNotice({ type: 'error', text: err?.response?.data?.error || 'No se pudo iniciar el pago. Intenta de nuevo.' });
      }
    } finally {
      setCheckingOut(null);
    }
  };

  /* ---------- Add-ons ---------- */
  const addonValue = (a) => {
    if (a.type === 'int') return Number(addons?.[a.countKey] ?? addons?.[a.key] ?? 0) || 0;
    return !!addons?.[a.key];
  };
  const setAddon = async (a, value) => {
    setAddonBusy(a.key);
    setAddonsError(null);
    const patch = a.type === 'int' ? { [a.countKey]: value } : { [a.key]: value };
    try {
      await orgAPI.updateAddons(patch);
      await refresh();
      window.dispatchEvent(new CustomEvent('orbit:plan-changed'));
    } catch (err) {
      const d = err?.response?.data;
      if (err?.response?.status === 402) {
        setAddonsError({ text: d?.error || 'Tu plan no incluye este add-on.', requiredPlan: d?.required_plan || null });
      } else if (isMissing(err)) {
        setAddonsError({ text: 'Los add-ons todavía no se pueden activar desde aquí. Escríbenos y lo activamos por ti.' });
      } else {
        setAddonsError({ text: d?.error || 'No se pudo guardar el add-on.' });
      }
    } finally {
      setAddonBusy(null);
    }
  };

  /* ---------- Cabecera de estado ---------- */
  const endsLabel = fmtDate(trialEndsAt);
  const headline = (() => {
    if (!loaded) return loading ? 'Cargando tu plan…' : 'No pudimos cargar tu plan';
    if (trialExpired) return 'Prueba vencida';
    if (isTrial) return `Prueba · ${daysLeft ?? TRIAL_DAYS} ${daysLeft === 1 ? 'día restante' : 'días restantes'}`;
    if (isActive && currentCycle === 'annual') return `${planName || PLAN_LABELS[plan] || 'Plan'} · Activo anual${planRenewsAt ? ` hasta ${fmtDate(planRenewsAt)}` : ''}`;
    if (isActive) return `${planName || PLAN_LABELS[plan] || 'Plan'} · Activo mensual`;
    return `${planName || PLAN_LABELS[plan] || 'Plan'} · ${STATUS_LABELS[status] || status}`;
  })();
  const tone = trialExpired || status === 'canceled' ? 'red' : isTrial || status === 'past_due' ? 'amber' : 'green';

  const noticeTone = { ok: 'bg-[#44BF47]/10 text-[#1E7A30]', error: 'bg-red-50 text-red-700', info: 'bg-[#121212]/[0.04] text-[#3A3A3A]' };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <Eyebrow>Suscripción</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold text-[#121314] tracking-tight">{headline}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Chip tone={loaded ? tone : 'neutral'}>{!loaded ? (loading ? 'Cargando' : 'Sin conexión') : trialExpired ? 'Prueba vencida' : STATUS_LABELS[status] || status}</Chip>
            {isTrial && !trialExpired && endsLabel && <span className="inline-flex items-center gap-1 text-xs text-[#7A7772]"><Clock size={12} /> termina el {endsLabel}</span>}
            {trialExpired && endsLabel && <span className="text-xs text-[#7A7772]">Terminó el {endsLabel}</span>}
            {isActive && (planPriceLocked || priceLockedUntil) && (
              <Chip tone="neutral"><Lock size={11} /> Precio congelado{priceLockedUntil ? ` hasta ${fmtDate(priceLockedUntil, { month: 'short', year: 'numeric' })}` : ''}</Chip>
            )}
          </div>
        </div>
        {isAdmin && (
          <Link to="/app/configuracion/modulos" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E7A30] hover:underline">
            <ToggleRight size={16} /> Gestionar módulos
          </Link>
        )}
      </div>

      {/* Sin backend / error de carga */}
      {!loaded && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>No pudimos cargar el estado de tu plan. Te mostramos la oferta igual; vuelve a intentarlo en un momento o <a className="underline" href={CONTACT}>escríbenos</a>.</span>
        </div>
      )}

      {/* Resultado del pago (vuelta de Bold) */}
      {payCheck && (
        <div className={`rounded-2xl px-4 py-3 text-sm flex items-start justify-between gap-3 ${
          payCheck.state === 'approved' ? 'bg-[#44BF47]/10 text-[#1E7A30]'
            : payCheck.state === 'checking' ? 'bg-[#121212]/[0.04] text-[#3A3A3A]'
              : payCheck.state === 'pending' || payCheck.state === 'unknown' ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-700'}`}
        >
          <div className="flex items-start gap-2">
            {payCheck.state === 'checking' ? <Loader2 size={16} className="mt-0.5 animate-spin flex-shrink-0" /> : payCheck.state === 'approved' ? <Check size={16} className="mt-0.5 flex-shrink-0" /> : <Info size={16} className="mt-0.5 flex-shrink-0" />}
            <div>
              <p className="font-medium">
                {payCheck.state === 'checking' && 'Confirmando tu pago con Bold…'}
                {payCheck.state === 'approved' && 'Pago aprobado · tu plan ya está activo'}
                {payCheck.state === 'pending' && 'Tu pago sigue pendiente de confirmación'}
                {payCheck.state === 'rejected' && 'El pago fue rechazado'}
                {payCheck.state === 'voided' && 'El pago fue anulado'}
                {payCheck.state === 'unknown' && 'No pudimos confirmar el estado del pago'}
              </p>
              <p className="text-xs opacity-80 mt-0.5 font-mono">Referencia {payCheck.reference}{payCheck.data?.total ? ` · ${fmtCOP(payCheck.data.total)}` : ''}</p>
              {(payCheck.state === 'pending' || payCheck.state === 'unknown') && <p className="text-xs mt-1">Bold puede tardar unos minutos. Si ya pagaste, el plan se activa solo; si no, puedes <a className="underline" href={CONTACT}>escribirnos</a>.</p>}
              {(payCheck.state === 'rejected' || payCheck.state === 'voided') && <p className="text-xs mt-1">Puedes intentar de nuevo con otro medio de pago desde los planes de abajo.</p>}
            </div>
          </div>
          {payCheck.state !== 'checking' && <button type="button" onClick={dismissPayCheck} className="p-1 rounded-full hover:bg-black/5" aria-label="Cerrar"><X size={14} /></button>}
        </div>
      )}

      {/* Plan actual + uso */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#121314] flex items-center justify-center"><Sparkles size={20} className="text-[#44BF47]" /></div>
            <div>
              <Eyebrow>Plan actual</Eyebrow>
              <p className="text-xl font-semibold text-[#121314] tracking-tight">{loaded ? (isTrial ? `Prueba · ${planName || 'Growth'}` : planName) : '—'}</p>
            </div>
          </div>
          {!loaded && (
            <p className="text-sm text-[#3A3A3A] mt-4">{loading ? 'Cargando tu plan y tu uso…' : 'Cuando recuperemos la conexión verás aquí tu plan, tu uso y tus add-ons.'}</p>
          )}
          {isTrial && !trialExpired && (
            <p className="text-sm text-[#3A3A3A] mt-4">
              Durante la prueba tienes todo lo del plan Growth. La prueba es gratis: el cobro se hace al terminar los {TRIAL_DAYS} días, desde aquí.
            </p>
          )}
          {trialExpired && (
            <p className="text-sm text-[#3A3A3A] mt-4">Puedes seguir consultando tu información. Para editar, paga un plan abajo.</p>
          )}
          {isActive && (
            <p className="text-sm text-[#3A3A3A] mt-4">
              {currentCycle === 'annual'
                ? `Pagaste el año: ${planRenewsAt ? `renueva el ${fmtDate(planRenewsAt)}` : 'renueva en 12 meses'}${priceLockedUntil ? `, con el precio congelado hasta ${fmtDate(priceLockedUntil)}` : ''}.`
                : 'Pagas mes a mes. Puedes pasar al anual cuando quieras y ahorrar dos meses.'}
            </p>
          )}
          {planSelected && isTrial && (
            <div className="mt-4 rounded-xl bg-[#121212]/[0.04] px-3 py-2 text-xs text-[#3A3A3A] flex items-start gap-2">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>Elegiste el plan <strong className="text-[#121314]">{PLAN_LABELS[planSelected] || planSelected}</strong> al registrarte. Págalo abajo cuando quieras activarlo.</span>
            </div>
          )}
        </div>

        <div className="glass-card p-6 lg:col-span-3">
          <Eyebrow className="mb-4">Uso vs límites</Eyebrow>
          <div className="space-y-5">
            <UsageBar icon={Building2} label="Marcas (clientes activos)" used={usage.brands || 0} limit={limits.brands} />
            <UsageBar icon={Users} label="Usuarios del equipo" used={usage.users || 0} limit={limits.users} />
            <UsageBar icon={Store} label="Tiendas conectadas" used={usage.stores || 0} limit={null} />
          </div>
        </div>
      </div>

      {notice && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${noticeTone[notice.type] || noticeTone.info}`}>{notice.text}</div>
      )}

      {/* Panel de pago manual */}
      {manual && (
        <div className="glass-card p-6 border-[#121314]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow>Pago por transferencia</Eyebrow>
              <h2 className="mt-1 text-lg font-semibold text-[#121314] tracking-tight">
                {PLAN_LABELS[manual.plan] || manual.plan} {manual.cycle === 'annual' ? 'anual' : 'mensual'} · {fmtCOP(manual.total ?? withIva(manual.amount))} con IVA
              </h2>
            </div>
            <button type="button" onClick={() => setManual(null)} className="p-1 rounded-full hover:bg-black/5" aria-label="Cerrar"><X size={16} /></button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-[#121212]/[0.09] p-3"><Eyebrow>Valor</Eyebrow><p className="mt-1 font-mono">{fmtCOP(manual.amount)}</p></div>
            <div className="rounded-xl border border-[#121212]/[0.09] p-3"><Eyebrow>IVA 19 %</Eyebrow><p className="mt-1 font-mono">{fmtCOP(manual.iva ?? ivaOf(manual.amount))}</p></div>
            <div className="rounded-xl border border-[#121212]/[0.09] p-3"><Eyebrow>Total</Eyebrow><p className="mt-1 font-mono font-semibold">{fmtCOP(manual.total ?? withIva(manual.amount))}</p></div>
          </div>
          <div className="mt-4 rounded-xl bg-[#121212]/[0.04] p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Eyebrow>Referencia de pago</Eyebrow>
                <p className="mt-1 font-mono text-base text-[#121314]">{manual.reference}</p>
              </div>
              <CopyButton value={manual.reference} />
            </div>
            {manual.instructions && (
              <p className="mt-3 text-sm text-[#3A3A3A] whitespace-pre-line">{manual.instructions}</p>
            )}
            <p className="mt-3 text-xs text-[#7A7772]">Pon la referencia en la descripción de la transferencia. Cuando la confirmemos, el plan se activa solo y te avisamos.</p>
          </div>
        </div>
      )}

      {/* Planes */}
      <section id="sub-planes">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#121314] tracking-tight">Planes</h2>
            <p className="text-xs text-[#7A7772] mt-0.5">
              {annual ? 'Anual: pagas 10 meses, usas 12. Precio congelado 24 meses. Precios en COP más IVA.' : 'Mes a mes, sin permanencia. Precios en COP más IVA.'}
            </p>
          </div>
          <CycleToggle cycle={cycle} onChange={setCycle} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isCurrent = isActive && plan === p.key && currentCycle === cycle;
            const isCurrentPlanOtherCycle = isActive && plan === p.key && currentCycle !== cycle;
            const price = priceFor(p, cycle);
            const busy = checkingOut === p.key;
            const dark = p.recommended && !isCurrent;
            return (
              <article
                key={p.key}
                className={`relative rounded-2xl border p-6 flex flex-col ${dark ? 'bg-[#121314] text-[#F3F1ED] border-[#121314]' : 'glass-card'} ${isCurrent ? 'ring-2 ring-[#121314]' : ''}`}
              >
                {p.badge && !isCurrent && <span className={`absolute -top-3 left-6 ${dark ? '' : ''}`}><Chip tone="green">{p.badge}</Chip></span>}
                {isCurrent && <span className="absolute -top-3 left-6"><Chip tone="dark">Tu plan</Chip></span>}

                <p className="text-sm font-medium">{p.name}</p>
                <p className={`text-xs mt-0.5 min-h-[32px] ${dark ? 'text-[#8E8C88]' : 'text-[#7A7772]'}`}>{p.for}</p>

                <div className="mt-4 flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-[26px] font-medium tracking-tight tabular-nums">{fmtCOP(price)}</span>
                  <span className={`text-xs ${dark ? 'text-[#8E8C88]' : 'text-[#7A7772]'}`}>COP {CYCLES[cycle].per}</span>
                </div>
                {annual ? (
                  <>
                    <p className={`mt-2 text-[13px] ${dark ? 'text-[#F3F1ED]/80' : 'text-[#3A3A3A]'}`}>
                      equivale a <b className="font-semibold">{fmtCOP(monthlyEquivalent(p))}/mes</b> · ahorras <b className="font-semibold">{fmtCOP(annualSavings(p))}</b>
                    </p>
                    <p className={`mt-1 font-mono text-[11px] uppercase tracking-wider ${dark ? 'text-[#8E8C88]' : 'text-[#7A7772]'}`}><s>{fmtCOP(monthlyTimes12(p))}</s> mes a mes · + IVA</p>
                  </>
                ) : (
                  <p className={`mt-2 font-mono text-[11px] uppercase tracking-wider ${dark ? 'text-[#8E8C88]' : 'text-[#7A7772]'}`}>+ IVA · cancelas cuando quieras</p>
                )}

                <ul className={`mt-4 pt-4 border-t space-y-1.5 text-sm ${dark ? 'border-[#F3F1ED]/15 text-[#F3F1ED]/85' : 'border-[#121212]/[0.09] text-[#3A3A3A]'}`}>
                  <li className="flex items-start gap-2"><Check size={14} className={`mt-0.5 flex-shrink-0 ${dark ? 'text-[#44BF47]' : 'text-[#1E7A30]'}`} /> {limitsLabel(p)}</li>
                  {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check size={14} className={`mt-0.5 flex-shrink-0 ${dark ? 'text-[#44BF47]' : 'text-[#1E7A30]'}`} /> {f}</li>)}
                </ul>

                {annual ? (
                  <div className={`mt-4 rounded-xl border p-3.5 flex-1 flex flex-col ${dark ? 'border-[#F3F1ED]/20 bg-[#F3F1ED]/[0.06]' : 'border-[#121212]/[0.16] bg-white'}`}>
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span className={`font-mono text-[10.5px] tracking-wider uppercase ${dark ? 'text-[#44BF47]' : 'text-[#1E7A30]'}`}>{INCLUDED_LABEL}</span>
                      <span className="font-mono text-[11.5px] tabular-nums">Valor incluido: {fmtCOP(includedTotal(p))}</span>
                    </div>
                    <ul className="mt-2">
                      {p.included.map((it) => (
                        <li key={it.key} className={`flex items-baseline justify-between gap-3 py-1.5 border-t text-[12.5px] ${dark ? 'border-[#F3F1ED]/12 text-[#F3F1ED]/85' : 'border-[#121212]/[0.09] text-[#3A3A3A]'}`}>
                          <span>{it.label}</span>
                          <span className="font-mono text-[11.5px] tabular-nums whitespace-nowrap">{fmtCOP(it.value)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
                      <Chip tone="neutral" className={dark ? 'border-[#F3F1ED]/30 text-[#F3F1ED]' : ''}>{PRICE_LOCK_LABEL}</Chip>
                      <Chip tone="neutral" className={dark ? 'border-[#F3F1ED]/30 text-[#F3F1ED]' : ''}>{GUARANTEE_LABEL}</Chip>
                    </div>
                  </div>
                ) : (
                  <div className={`mt-4 rounded-xl border p-3.5 flex-1 ${dark ? 'border-[#F3F1ED]/20 bg-[#F3F1ED]/[0.06]' : 'border-[#121212]/[0.16] bg-white'}`}>
                    <span className={`font-mono text-[10.5px] tracking-wider uppercase ${dark ? 'text-[#8E8C88]' : 'text-[#7A7772]'}`}>Agrega cuando quieras</span>
                    <ul className="mt-2">
                      {addonsForPlan(p.key).map((a) => (
                        <li key={a.key} className={`flex items-baseline justify-between gap-3 py-1.5 border-t text-[12.5px] ${dark ? 'border-[#F3F1ED]/12 text-[#F3F1ED]/85' : 'border-[#121212]/[0.09] text-[#3A3A3A]'}`}>
                          <span>{a.name}</span>
                          <span className="font-mono text-[11.5px] tabular-nums whitespace-nowrap">{fmtCOP(a.price)}<small className="opacity-60">/mes</small></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-5">
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={isCurrent || !!checkingOut}
                      onClick={() => checkout(p.key)}
                      className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        dark ? 'bg-[#1E7A30] text-white hover:bg-[#196628]' : isCurrent ? 'border border-[#121212]/[0.16] text-[#121314]' : 'bg-[#121314] text-white hover:bg-[#1C1D1F]'
                      }`}
                    >
                      {busy ? <><Loader2 size={15} className="animate-spin" /> Preparando el pago…</>
                        : isCurrent ? 'Plan actual'
                          : isCurrentPlanOtherCycle ? (annual ? 'Pasar al anual' : 'Pasar al mensual')
                            : <><CreditCard size={15} /> {annual ? 'Pagar el año' : 'Pagar el mes'}</>}
                    </button>
                  ) : (
                    <p className={`text-xs text-center ${dark ? 'text-[#8E8C88]' : 'text-[#7A7772]'}`}>Solo un administrador puede pagar o cambiar el plan.</p>
                  )}
                  <p className={`mt-2 text-center font-mono text-[10.5px] tabular-nums ${dark ? 'text-[#8E8C88]' : 'text-[#7A7772]'}`}>
                    Total con IVA: {fmtCOP(withIva(price))}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="text-xs text-[#7A7772] mt-4 flex items-start gap-2">
          <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-[#1E7A30]" />
          <span>
            {GUARANTEE_LABEL} con devolución completa. Después, si necesitas más, subes de plan pagando solo la diferencia. Pago con tarjeta, PSE o Nequi a través de Bold, o por transferencia con referencia.
          </span>
        </p>
      </section>

      {/* Add-ons */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#121314] tracking-tight">Add-ons</h2>
            <p className="text-xs text-[#7A7772] mt-0.5">
              {annual ? 'En el plan anual los add-ons de WhatsApp van incluidos; los demás se activan cuando quieras.' : 'Se suman al plan mes a mes. Precios en COP más IVA.'}
            </p>
          </div>
          <Link to={WHATSAPP_SETTINGS} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E7A30] hover:underline">
            <MessageCircle size={15} /> Configurar WhatsApp
          </Link>
        </div>

        {addonsError && (
          <div className="mb-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {addonsError.text}</span>
            {addonsError.requiredPlan && (
              <button type="button" onClick={() => { setAddonsError(null); document.getElementById('sub-planes')?.scrollIntoView({ behavior: 'smooth' }); }} className="inline-flex items-center gap-1 self-start sm:self-auto rounded-full bg-[#121314] text-white text-xs font-semibold px-3 py-1.5">
                Subir a {PLAN_LABELS[addonsError.requiredPlan] || addonsError.requiredPlan}
              </button>
            )}
          </div>
        )}

        <div className="glass-card divide-y divide-[#121212]/[0.09]">
          {ADDONS.map((a) => {
            const included = includedSet.has(a.key);
            const allowed = a.plans.includes(effectivePlanKey);
            const value = addonValue(a);
            const on = included || (a.type === 'int' ? value > 0 : !!value);
            const busy = addonBusy === a.key;
            const canEdit = isAdmin && !included && !busy;
            return (
              <div key={a.key} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[#121314]">{a.name}</p>
                    {included && <Chip tone="green"><Check size={11} /> {includedChip}</Chip>}
                    {!included && on && <Chip tone="dark">Activo</Chip>}
                    {!allowed && !included && <Chip tone="neutral">Desde {PLAN_LABELS[a.plans[0]]}</Chip>}
                  </div>
                  <p className="mt-1 text-xs text-[#7A7772] leading-snug">{a.desc}{a.note ? ` ${a.note}` : ''}</p>
                  {a.whatsapp && (
                    <Link to={WHATSAPP_SETTINGS} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#1E7A30] hover:underline">
                      Configurar en WhatsApp <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4 md:w-[260px] flex-shrink-0">
                  <span className="font-mono text-[12.5px] text-[#121314] tabular-nums">
                    {included ? <s className="text-[#7A7772]">{fmtCOP(a.price)}</s> : fmtCOP(a.price)}
                    <small className="block text-[10px] text-[#7A7772] normal-case">{included ? 'incluido' : `/${a.unit}`}</small>
                  </span>
                  {busy ? <Loader2 size={18} className="animate-spin text-[#7A7772]" />
                    : a.type === 'int'
                      ? <Stepper value={value} onChange={(v) => setAddon(a, v)} disabled={!canEdit} />
                      : <Switch on={on} onChange={(v) => setAddon(a, v)} disabled={!canEdit} label={a.name} />}
                </div>
              </div>
            );
          })}
        </div>
        {!isAdmin && <p className="mt-2 text-xs text-[#7A7772]">Solo un administrador puede activar add-ons.</p>}
      </section>

      {/* Pagos */}
      <section>
        <h2 className="text-lg font-semibold text-[#121314] tracking-tight mb-3">Pagos</h2>
        <div className="glass-card overflow-hidden">
          {payments === null && <p className="p-5 text-sm text-[#7A7772]">Cargando pagos…</p>}
          {payments === false && <p className="p-5 text-sm text-[#7A7772]">El historial de pagos estará disponible cuando se habilite el pago en línea.</p>}
          {Array.isArray(payments) && payments.length === 0 && <p className="p-5 text-sm text-[#7A7772]">Aún no hay pagos. Cuando pagues tu plan, aparecerá aquí con su referencia.</p>}
          {Array.isArray(payments) && payments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left font-mono text-[10.5px] tracking-wider uppercase text-[#7A7772] border-b border-[#121212]/[0.09]">
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Medio</th>
                    <th className="px-5 py-3 font-medium">Referencia</th>
                    <th className="px-5 py-3 font-medium text-right">Total</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#121212]/[0.06]">
                  {payments.map((pay) => (
                    <tr key={pay.reference}>
                      <td className="px-5 py-3 text-[#3A3A3A] whitespace-nowrap">{fmtDate(pay.paid_at || pay.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-5 py-3 text-[#121314]">{PLAN_LABELS[pay.plan] || pay.plan} · {pay.cycle === 'annual' ? 'anual' : 'mensual'}</td>
                      <td className="px-5 py-3 text-[#3A3A3A] capitalize">{pay.provider === 'bold' ? 'Bold' : pay.provider === 'manual' ? 'Transferencia' : pay.provider}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[#3A3A3A]">{pay.reference}</td>
                      <td className="px-5 py-3 font-mono text-right tabular-nums">{fmtCOP(pay.total)}</td>
                      <td className="px-5 py-3">
                        <Chip tone={pay.status === 'approved' ? 'green' : pay.status === 'pending' ? 'amber' : 'red'}>
                          {pay.status === 'approved' ? 'Aprobado' : pay.status === 'pending' ? 'Pendiente' : pay.status === 'rejected' ? 'Rechazado' : pay.status === 'voided' ? 'Anulado' : pay.status}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Subscription;
