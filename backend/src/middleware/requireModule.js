// [modules] Bloquea un prefijo de rutas si el módulo está apagado para la organización.
// Responde 403 { error, module_disabled: true, module, required_plan }.
import { isModuleEnabled, moduleInfo, planForModule } from '../services/plans.js';

export const requireModule = (key) => async (req, res, next) => {
  if (!req.orgId) return next(); // sin sesión de equipo (rutas públicas) no aplica
  try {
    const enabled = await isModuleEnabled(req.orgId, key);
    if (!enabled) {
      const info = moduleInfo(key);
      const plan = planForModule(key);
      return res.status(403).json({
        error: `El módulo ${info?.name || key} no está activo en tu organización`,
        module_disabled: true,
        module: key,
        required_plan: plan?.key || null,
      });
    }
  } catch (error) {
    // Ante un fallo de lectura no bloqueamos la operación
    console.error('[modules] requireModule error:', error.message);
  }
  next();
};

export default requireModule;
