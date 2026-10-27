// [permisos] Aplica en la API los permisos por módulo de cada miembro.
//
// Hasta ahora el frontend escondía los módulos según team_members.permissions pero
// la API no lo verificaba: cualquier miembro autenticado podía llamar /api/invoices,
// /api/dashboard/stats, /api/reports/financial, etc. (vía MCP o curl) y ver el dinero
// de la agencia. Este middleware cierra ese hueco con la MISMA regla del frontend.
//
// Uso:
//   app.use('/api/invoices', teamAuthMiddleware, requireModule('invoices'), requirePermission('invoices'), routes);
//   requirePermission('metricas', 'finanzas')  → pasa si CUALQUIERA de las claves está en true.
//   hasPermission(req.teamMember, 'invoices')  → para filtrar campos dentro de un handler.
//
// Respuesta cuando no hay permiso: 403 { error: 'No tienes permiso para este módulo', module: <clave> }.
import { DEFAULT_PERMISSIONS } from '../config/permissions.js';

/** Devuelve el objeto de permisos del miembro (acepta objeto o JSON serializado). */
export const parsePermissions = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
  }
  return typeof raw === 'object' ? raw : {};
};

/**
 * ¿El miembro tiene permiso para el módulo `key`?
 *  - admin → siempre true.
 *  - permisos vacíos/null → DEFAULT_PERMISSIONS[key] === true.
 *  - en otro caso → permissions[key] === true (estricto, igual que el frontend).
 */
export const hasPermission = (teamMember, key) => {
  if (!teamMember || !key) return false;
  if (teamMember.role === 'admin') return true;
  const perms = parsePermissions(teamMember.permissions);
  if (Object.keys(perms).length === 0) return DEFAULT_PERMISSIONS[key] === true;
  return perms[key] === true;
};

/** ¿Tiene alguna de las claves? */
export const hasAnyPermission = (teamMember, keys) => keys.some((k) => hasPermission(teamMember, k));

export const isAdmin = (teamMember) => teamMember?.role === 'admin';

/** Middleware: pasa si es admin o si alguna de las claves está permitida. */
export const requirePermission = (...keys) => (req, res, next) => {
  if (!req.teamMember) return res.status(401).json({ error: 'No autorizado' });
  if (hasAnyPermission(req.teamMember, keys)) return next();
  return res.status(403).json({ error: 'No tienes permiso para este módulo', module: keys[0] });
};

export default requirePermission;
