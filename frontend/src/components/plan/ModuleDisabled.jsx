// [modules] Pantalla que muestra ProtectedRoute cuando el módulo de la ruta está apagado.
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowUpRight, ToggleRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrgPlan } from '../../hooks/useOrgPlan';
import { moduleIcon, PLAN_LABELS } from '../../utils/modules';

const ModuleDisabled = ({ module }) => {
  const { isAdmin } = useAuth();
  const { catalog, plan, requiredPlanFor } = useOrgPlan();
  const info = catalog?.modules?.find((m) => m.key === module);
  const requiredPlan = requiredPlanFor(module);
  const planIncludes = catalog?.plans?.find((p) => p.key === (plan === 'trial' ? 'growth' : plan))?.modules?.includes(module);
  // Si el plan lo incluye, el admin solo lo apagó; si no, hay que subir de plan.
  const needsUpgrade = !planIncludes;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <div className="relative w-16 h-16 rounded-2xl bg-[#121314] flex items-center justify-center mx-auto mb-5">
          {createElement(moduleIcon(module), { size: 28, className: 'text-[#44BF47]' })}
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-[#121212]/[0.09] flex items-center justify-center">
            <Lock size={14} className="text-[#121314]" />
          </span>
        </div>
        <h2 className="text-xl font-semibold text-[#121314] tracking-tight">
          {info?.name ? `${info.name} no está activo` : 'Este módulo no está activo'}
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          {needsUpgrade
            ? `Este módulo no está incluido en tu plan${requiredPlan ? `. Está disponible desde el plan ${PLAN_LABELS[requiredPlan] || requiredPlan}` : ''}.`
            : 'Este módulo está apagado para tu organización.'}
        </p>
        {info?.description && <p className="text-xs text-gray-400 mt-2">{info.description}</p>}

        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
          {isAdmin && !needsUpgrade && (
            <Link to="/app/configuracion/modulos" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#121314] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1C1D1F]">
              <ToggleRight size={16} /> Activar en Módulos
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/app/suscripcion"
              className={`inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold px-5 py-2.5 ${
                needsUpgrade ? 'bg-[#121314] text-white hover:bg-[#1C1D1F]' : 'border border-[#121212]/[0.16] text-[#121314] hover:bg-[#121212]/[0.04]'
              }`}
            >
              Ver planes <ArrowUpRight size={16} />
            </Link>
          )}
          {!isAdmin && (
            <p className="text-xs text-gray-400">Pídele al administrador de tu organización que lo active.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModuleDisabled;
