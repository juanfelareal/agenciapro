// [modules] Configuración → Módulos: encender/apagar módulos de la organización (solo admin).
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Lock, ArrowUpRight, ChevronLeft, Puzzle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgPlan } from '../hooks/useOrgPlan';
import { orgAPI } from '../utils/orgApi';
import { moduleIcon, PLAN_LABELS } from '../utils/modules';

const Switch = ({ checked, disabled, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#44BF47]/50 ${
      checked ? 'bg-[#44BF47]' : 'bg-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const OrgModules = () => {
  const { isAdmin } = useAuth();
  const { catalog, modules, plan, planName, refresh, loaded } = useOrgPlan();
  const [saving, setSaving] = useState(null);
  const [notice, setNotice] = useState(null);

  if (!isAdmin) return <Navigate to="/app/settings" replace />;

  const planKeyForModules = plan === 'trial' ? 'growth' : plan;
  const planModules = catalog?.plans?.find((p) => p.key === planKeyForModules)?.modules || [];
  const list = catalog?.modules || [];

  const toggle = async (key, value) => {
    setSaving(key);
    setNotice(null);
    try {
      await orgAPI.updateModules({ [key]: value });
      await refresh();
      window.dispatchEvent(new CustomEvent('orbit:plan-changed'));
      setNotice({ type: 'ok', text: value ? 'Módulo activado.' : 'Módulo desactivado. Desaparece del menú para todo el equipo.' });
    } catch (err) {
      const data = err?.response?.data;
      setNotice({ type: 'error', text: data?.error || 'No se pudo actualizar el módulo.' });
    } finally {
      setSaving(null);
    }
  };

  const enabledCount = list.filter((m) => modules?.[m.key] !== false && planModules.includes(m.key)).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/app/settings" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#121314] mb-2">
          <ChevronLeft size={14} /> Mi Cuenta
        </Link>
        <h1 className="text-2xl font-semibold text-[#121314] tracking-tight">Módulos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Decide qué partes de Orbit ve tu equipo. Los permisos por persona siguen aplicando dentro de cada módulo activo.
        </p>
      </div>

      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#121314] flex items-center justify-center">
            <Puzzle size={20} className="text-[#44BF47]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#121314]">
              Plan {planName || '—'}{plan === 'trial' ? ' (incluye lo de Growth)' : ''}
            </p>
            <p className="text-xs text-gray-500">
              {loaded ? `${enabledCount} de ${planModules.length} módulos del plan activos · ${list.length - planModules.length} disponibles en planes superiores` : 'Cargando…'}
            </p>
          </div>
        </div>
        <Link to="/app/suscripcion" className="inline-flex items-center gap-1 rounded-full border border-[#121212]/[0.16] text-[#121314] text-sm font-semibold px-4 py-2 hover:bg-[#121212]/[0.04]">
          Ver planes <ArrowUpRight size={14} />
        </Link>
      </div>

      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.type === 'ok' ? 'bg-[#44BF47]/10 text-[#1E7A30]' : 'bg-red-50 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      <div className="glass-card divide-y divide-[#121212]/[0.06]">
        {list.map((m) => {
          const Icon = moduleIcon(m.key);
          const inPlan = planModules.includes(m.key);
          const on = inPlan && modules?.[m.key] !== false;
          const locked = !inPlan;
          const requiredPlan = m.required_plan ? PLAN_LABELS[m.required_plan] || m.required_plan : null;
          return (
            <div key={m.key} className={`flex items-center gap-4 px-4 py-3.5 ${locked ? 'opacity-70' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${on ? 'bg-[#121314]' : 'bg-[#121212]/[0.06]'}`}>
                <Icon size={18} className={on ? 'text-[#44BF47]' : 'text-gray-500'} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[#121314]">{m.name}</p>
                  {m.always_on && <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">siempre activo</span>}
                  {locked && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      <Lock size={10} /> Disponible en {requiredPlan}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
              </div>
              {locked ? (
                <Link to="/app/suscripcion" className="text-xs font-semibold text-[#1E7A30] hover:underline whitespace-nowrap">
                  Cambiar plan
                </Link>
              ) : (
                <Switch
                  checked={on}
                  disabled={m.always_on || saving === m.key || !loaded}
                  onChange={(v) => toggle(m.key, v)}
                  label={`${on ? 'Desactivar' : 'Activar'} ${m.name}`}
                />
              )}
            </div>
          );
        })}
        {!list.length && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Cargando catálogo de módulos…</div>
        )}
      </div>
    </div>
  );
};

export default OrgModules;
