// [modules] Piezas de plan para el Layout: chip de plan en el menú, banda de
// prueba vencida y aviso global cuando el backend responde 402 (límite / prueba).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, X, ArrowUpRight } from 'lucide-react';
import { useOrgPlan } from '../../hooks/useOrgPlan';

/** Chip "Prueba · 9 días" o nombre del plan. Enlaza a Suscripción. */
export const PlanChip = ({ collapsed = false, active = false }) => {
  const { loaded, plan, planName, status, daysLeft, trialExpired } = useOrgPlan();
  if (!loaded || !plan) return null;

  const isTrial = status === 'trial';
  let label = planName;
  if (isTrial) {
    if (trialExpired) label = 'Prueba vencida';
    else if (daysLeft != null) label = `Prueba · ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`;
    else label = 'Prueba';
  } else if (status === 'past_due') label = `${planName} · pago pendiente`;
  else if (status === 'canceled') label = `${planName} · cancelado`;

  const tone = trialExpired || status === 'canceled'
    ? 'border-red-200 bg-red-50 text-red-700'
    : isTrial || status === 'past_due'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-[#44BF47]/30 bg-[#44BF47]/10 text-[#1E7A30]';

  if (collapsed) {
    return (
      <Link
        to="/app/suscripcion"
        title={label}
        className={`group relative flex items-center justify-center w-full py-2 rounded-xl border ${tone} ${active ? 'ring-1 ring-[#121314]/20' : ''}`}
      >
        <Sparkles size={16} />
        <div className="absolute left-full ml-2 px-2 py-1 bg-[#121314] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
          {label}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/app/suscripcion"
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors hover:brightness-95 ${tone} ${active ? 'ring-1 ring-[#121314]/20' : ''}`}
    >
      <Sparkles size={14} className="flex-shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <ArrowUpRight size={14} className="flex-shrink-0 opacity-60" />
    </Link>
  );
};

/** Banda superior cuando la prueba terminó o el plan está cancelado / con pago pendiente. */
export const TrialBanner = () => {
  const { loaded, status, trialExpired } = useOrgPlan();
  if (!loaded) return null;

  let text = null;
  let tone = 'bg-[#121314] text-[#F3F1ED]';
  if (trialExpired) {
    text = 'Tu prueba terminó. Puedes seguir consultando tu información; para editar, elige un plan.';
  } else if (status === 'canceled') {
    text = 'Tu suscripción está cancelada. Reactiva un plan para seguir editando.';
  } else if (status === 'past_due') {
    text = 'Tu pago está pendiente. Ponte al día para evitar interrupciones.';
    tone = 'bg-amber-100 text-amber-900';
  }
  if (!text) return null;

  return (
    <div className={`${tone} px-4 py-2 text-sm flex items-center justify-center gap-3 flex-wrap`}>
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span>{text}</span>
      <Link
        to="/app/suscripcion"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
          tone.includes('amber') ? 'bg-[#121314] text-white' : 'bg-[#44BF47] text-[#121314]'
        }`}
      >
        Ver planes <ArrowUpRight size={12} />
      </Link>
    </div>
  );
};

/**
 * Aviso flotante disparado por `orbit:upgrade-needed` (lo emite utils/api.js al recibir 402).
 * detail: { message, trial_expired, limit_reached, required_plan }
 */
export const UpgradeToast = () => {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer = null;
    const onUpgrade = (e) => {
      const d = e?.detail || {};
      setToast({
        message: d.message || 'Esta acción necesita un plan superior.',
        trialExpired: !!d.trial_expired,
        limitReached: !!d.limit_reached,
      });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 9000);
    };
    window.addEventListener('orbit:upgrade-needed', onUpgrade);
    return () => {
      window.removeEventListener('orbit:upgrade-needed', onUpgrade);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[380px] z-[70] animate-fade-in">
      <div className="glass-solid rounded-2xl p-4 shadow-lg border border-[#121212]/[0.09] flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#121314] flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} className="text-[#44BF47]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#121314]">
            {toast.trialExpired ? 'Tu prueba terminó' : toast.limitReached ? 'Límite del plan alcanzado' : 'Necesitas un plan superior'}
          </p>
          <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
          <Link
            to="/app/suscripcion"
            onClick={() => setToast(null)}
            className="inline-flex items-center gap-1 mt-2 rounded-full bg-[#121314] text-white text-xs font-semibold px-3 py-1.5 hover:bg-[#1C1D1F]"
          >
            Ver planes <ArrowUpRight size={12} />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="p-1 rounded-lg text-gray-400 hover:text-[#121314] hover:bg-[#121212]/[0.04]"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
