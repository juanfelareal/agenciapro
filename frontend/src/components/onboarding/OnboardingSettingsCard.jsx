/**
 * Tarjeta "Empezar de nuevo" en Mi Cuenta: ver el tour otra vez y volver a mostrar
 * la lista de primeros pasos en el Dashboard. También muestra el plan en prueba.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ListChecks, Check } from 'lucide-react';
import { onboardingAPI, ONBOARDING_CHANGED_EVENT } from './onboardingApi';
import { PLANS, formatCOP } from './modules';

const OnboardingSettingsCard = () => {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    onboardingAPI.get().then(({ data }) => { if (!cancelled) setInfo(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const showChecklist = async () => {
    setBusy(true);
    try {
      await onboardingAPI.update({ dismissed: false });
      window.dispatchEvent(new CustomEvent(ONBOARDING_CHANGED_EVENT));
      setInfo((i) => (i ? { ...i, onboarding: { ...i.onboarding, dismissed: false } } : i));
      setMsg('Listo: la lista de primeros pasos vuelve a aparecer en el Dashboard.');
      setTimeout(() => setMsg(''), 4000);
    } catch {
      setMsg('No pudimos guardar el cambio. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const plan = info?.plan_selected ? PLANS.find((p) => p.id === info.plan_selected) : null;
  const trialEnd = info?.trial_ends_at ? new Date(info.trial_ends_at) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - Date.now()) / 86400000)) : null;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#121314] flex items-center justify-center">
          <Compass size={20} className="text-[#44BF47]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#121314]">Primeros pasos y tour</h2>
          {plan && (
            <p className="text-xs text-gray-500">
              Plan {plan.name} · {formatCOP(plan.price)} + IVA / mes
              {trialDaysLeft !== null && info?.plan === 'trial' ? ` · prueba gratis: ${trialDaysLeft} día${trialDaysLeft === 1 ? '' : 's'} restante${trialDaysLeft === 1 ? '' : 's'}` : ''}
            </p>
          )}
        </div>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-xl text-sm bg-[#44BF47]/10 text-[#1E7A30] flex items-center gap-2"><Check size={15} /> {msg}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button type="button" onClick={() => navigate('/app?tour=1')} className="btn-secondary justify-center">
          <Compass size={16} /> Ver el tour otra vez
        </button>
        <button type="button" onClick={showChecklist} disabled={busy || info?.onboarding?.dismissed === false} className="btn-secondary justify-center">
          <ListChecks size={16} /> {info?.onboarding?.dismissed === false ? 'Primeros pasos visibles en el Dashboard' : 'Mostrar primeros pasos en el Dashboard'}
        </button>
      </div>
      <p className="mt-3 text-xs text-gray-500">El tour recorre cada pestaña habilitada. Los primeros pasos detectan solos lo que ya hiciste (tienda, pauta, equipo, proyecto, portal y costos).</p>
    </div>
  );
};

export default OnboardingSettingsCard;
