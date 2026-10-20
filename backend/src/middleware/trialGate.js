// [modules] Prueba vencida (o plan cancelado): las lecturas siguen, pero los
// POST/PUT/PATCH/DELETE del equipo devuelven 402 { trial_expired: true }.
// Se engancha una sola vez al final de teamAuthMiddleware (solo actúa si hay req.orgId).
import { getOrgPlan } from '../services/plans.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rutas que siguen funcionando con la prueba vencida (gestionar plan, sesión, perfil)
const EXEMPT_PREFIXES = [
  '/api/org',
  '/api/auth',
  '/api/platform',
  '/api/team/profile',
  '/api/team/auth',
  '/api/team/change-pin',
];

export async function trialGate(req, res, next) {
  if (!req.orgId) return next();
  if (SAFE_METHODS.has(req.method)) return next();
  const url = (req.originalUrl || req.url || '').split('?')[0];
  if (EXEMPT_PREFIXES.some((p) => url === p || url.startsWith(p + '/'))) return next();

  try {
    const state = await getOrgPlan(req.orgId, { withUsage: false });
    if (state?.writes_blocked) {
      const canceled = state.status === 'canceled';
      return res.status(402).json({
        error: canceled
          ? 'Tu suscripción está cancelada. Reactiva un plan para seguir editando.'
          : 'Tu prueba gratuita terminó. Elige un plan para seguir editando; puedes seguir consultando tu información.',
        trial_expired: true,
        upgrade: true,
        plan_status: state.status,
        trial_ends_at: state.trial_ends_at,
      });
    }
  } catch (error) {
    console.error('[modules] trialGate error:', error.message);
  }
  next();
}

export default trialGate;
