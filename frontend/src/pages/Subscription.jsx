// [modules] Suscripción: plan actual, estado, prueba, uso vs límites y cambio de plan.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, Clock, Users, Store, Building2, ToggleRight, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgPlan } from '../hooks/useOrgPlan';
import { orgAPI } from '../utils/orgApi';
import { formatCOP, PLAN_LABELS, STATUS_LABELS } from '../utils/modules';

const UsageBar = ({ icon, label, used, limit }) => {
  const Icon = icon;
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const full = !unlimited && used >= limit;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-[#121314] font-medium"><Icon size={16} className="text-gray-500" /> {label}</span>
        <span className={`font-semibold ${full ? 'text-red-600' : 'text-[#121314]'}`}>
          {used}{unlimited ? '' : ` / ${limit}`}{unlimited && <span className="text-gray-400 font-normal"> · ilimitado</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-[#121212]/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-[#44BF47]'}`}
          style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.25 : 1 }}
        />
      </div>
    </div>
  );
};

const Subscription = () => {
  const { isAdmin } = useAuth();
  const { loaded, plan, planName, status, daysLeft, trialExpired, trialEndsAt, planSelected, limits, usage, catalog, refresh } = useOrgPlan();
  const [requesting, setRequesting] = useState(null);
  const [notice, setNotice] = useState(null);

  const plans = catalog?.plans || [];
  const moduleName = (key) => catalog?.modules?.find((m) => m.key === key)?.name || key;

  const requestPlan = async (key) => {
    setRequesting(key);
    setNotice(null);
    try {
      const res = await orgAPI.requestPlan(key);
      await refresh();
      window.dispatchEvent(new CustomEvent('orbit:plan-changed'));
      setNotice({ type: 'ok', text: res.data?.message || 'Solicitud enviada. LA REAL activará tu plan y te contactará para el pago; mientras tanto sigues en prueba.' });
    } catch (err) {
      setNotice({ type: 'error', text: err?.response?.data?.error || 'No se pudo enviar la solicitud.' });
    } finally {
      setRequesting(null);
    }
  };

  const statusTone = trialExpired || status === 'canceled'
    ? 'bg-red-50 text-red-700 border-red-200'
    : status === 'trial' || status === 'past_due'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-[#44BF47]/10 text-[#1E7A30] border-[#44BF47]/30';

  const statusLabel = trialExpired ? 'Prueba vencida' : STATUS_LABELS[status] || status || '—';
  const endsLabel = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-[#121314] tracking-tight">Suscripción</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tu plan, el uso de tu organización y las opciones para crecer.</p>
      </div>

      {/* Plan actual + uso */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#121314] flex items-center justify-center">
              <Sparkles size={20} className="text-[#44BF47]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Plan actual</p>
              <p className="text-xl font-semibold text-[#121314] tracking-tight">{loaded ? planName : '…'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 ${statusTone}`}>
              {statusLabel}
            </span>
            {status === 'trial' && !trialExpired && daysLeft != null && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Clock size={12} /> {daysLeft} {daysLeft === 1 ? 'día' : 'días'} restantes{endsLabel ? ` · termina el ${endsLabel}` : ''}</span>
            )}
            {trialExpired && endsLabel && <span className="text-xs text-gray-600">Terminó el {endsLabel}</span>}
          </div>
          {status === 'trial' && (
            <p className="text-sm text-gray-500 mt-4">
              Durante la prueba tienes todo lo del plan Growth. Al terminar, podrás seguir consultando tu información; para editar necesitas elegir un plan.
            </p>
          )}
          {planSelected && (status === 'trial' || planSelected !== plan) && (
            <div className="mt-4 rounded-xl bg-[#121212]/[0.04] px-3 py-2 text-xs text-gray-600 flex items-start gap-2">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>Solicitaste el plan <strong className="text-[#121314]">{PLAN_LABELS[planSelected] || planSelected}</strong>. LA REAL lo activará y te contactará para el pago.</span>
            </div>
          )}
          {isAdmin && (
            <Link to="/app/configuracion/modulos" className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-[#1E7A30] hover:underline">
              <ToggleRight size={16} /> Gestionar módulos
            </Link>
          )}
        </div>

        <div className="glass-card p-6 lg:col-span-3">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-4">Uso vs límites</p>
          <div className="space-y-5">
            <UsageBar icon={Building2} label="Marcas (clientes activos)" used={usage.brands || 0} limit={limits.brands} />
            <UsageBar icon={Users} label="Usuarios del equipo" used={usage.users || 0} limit={limits.users} />
            <UsageBar icon={Store} label="Tiendas conectadas" used={usage.stores || 0} limit={null} />
          </div>
        </div>
      </div>

      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.type === 'ok' ? 'bg-[#44BF47]/10 text-[#1E7A30]' : 'bg-red-50 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      {/* Planes */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold text-[#121314] tracking-tight">Planes</h2>
          <p className="text-xs text-gray-500">Precios mensuales en COP, más IVA.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = status !== 'trial' && plan === p.key;
            const isRequested = planSelected === p.key && !isCurrent;
            const extras = p.modules.filter((k) => !(plans[plans.indexOf(p) - 1]?.modules || []).includes(k));
            const prev = plans[plans.indexOf(p) - 1];
            return (
              <div
                key={p.key}
                className={`glass-card p-6 flex flex-col relative ${p.recommended ? 'ring-2 ring-[#44BF47]' : ''} ${isCurrent ? 'ring-2 ring-[#121314]' : ''}`}
              >
                {p.recommended && !isCurrent && (
                  <span className="absolute -top-3 left-6 text-[10px] uppercase tracking-wide font-bold bg-[#44BF47] text-[#121314] rounded-full px-2.5 py-1">Recomendado</span>
                )}
                {isCurrent && (
                  <span className="absolute -top-3 left-6 text-[10px] uppercase tracking-wide font-bold bg-[#121314] text-white rounded-full px-2.5 py-1">Tu plan</span>
                )}
                <p className="text-lg font-semibold text-[#121314] tracking-tight">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 min-h-[32px]">{p.tagline}</p>
                <p className="mt-4">
                  <span className="text-3xl font-semibold tracking-tight text-[#121314]">{formatCOP(p.price)}</span>
                  <span className="text-xs text-gray-500"> /mes + IVA</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#1E7A30]" /> {p.limits.brands == null ? 'Marcas ilimitadas' : `Hasta ${p.limits.brands} marcas`}</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#1E7A30]" /> {p.limits.users == null ? 'Usuarios ilimitados' : `Hasta ${p.limits.users} usuarios`}</li>
                  {prev && <li className="flex items-center gap-2"><Check size={14} className="text-[#1E7A30]" /> Todo lo de {prev.name}</li>}
                  {(prev ? extras : p.modules).slice(0, prev ? 12 : 6).map((k) => (
                    <li key={k} className="flex items-center gap-2 text-gray-600"><Check size={14} className="text-[#1E7A30]" /> {moduleName(k)}</li>
                  ))}
                  {!prev && p.modules.length > 6 && <li className="text-xs text-gray-400 pl-6">y {p.modules.length - 6} módulos más</li>}
                </ul>
                <div className="mt-auto pt-5">
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={isCurrent || requesting === p.key}
                      onClick={() => requestPlan(p.key)}
                      className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        p.recommended && !isCurrent ? 'bg-[#121314] text-white hover:bg-[#1C1D1F]' : 'border border-[#121212]/[0.16] text-[#121314] hover:bg-[#121212]/[0.04]'
                      }`}
                    >
                      {isCurrent ? 'Plan actual' : isRequested ? 'Solicitado · volver a enviar' : requesting === p.key ? 'Enviando…' : 'Cambiar a este plan'}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400 text-center">Solo un administrador puede cambiar el plan.</p>
                  )}
                </div>
              </div>
            );
          })}
          {!plans.length && <div className="glass-card p-8 text-center text-sm text-gray-500 md:col-span-3">Cargando planes…</div>}
        </div>
        <p className="text-xs text-gray-500 mt-4 flex items-start gap-2">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            El pago en línea llega pronto. Por ahora, al elegir un plan LA REAL lo activa manualmente y te contacta para el pago; mientras tanto sigues en tu estado actual.
          </span>
        </p>
      </div>
    </div>
  );
};

export default Subscription;
