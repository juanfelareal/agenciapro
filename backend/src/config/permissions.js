// Permisos por módulo de cada miembro del equipo (team_members.permissions, JSON).
//
// ⚠️  Esta tabla DEBE COINCIDIR con DEFAULT_PERMISSIONS de
//     frontend/src/pages/Team.jsx. El frontend la usa para esconder módulos;
//     el backend (middleware/requirePermission.js) la usa para APLICARLOS en la API.
//     Si cambias una clave aquí, cámbiala también allá (y viceversa).
//
// Regla (la misma del frontend, AuthContext.hasPermission):
//   - role 'admin'  → todo permitido.
//   - otros roles   → el módulo se permite solo si permissions[clave] === true.
//                     Si permissions es null/vacío se usan estos valores por defecto.
//   - 'manager' NO es admin: se rige por sus permisos como cualquier otro.
//
// Claves que no existen aquí ni en el JSON del miembro (p. ej. 'payroll') quedan
// en false para todo el que no sea admin.
export const DEFAULT_PERMISSIONS = Object.freeze({
  dashboard: true, metricas: false, clients: true, projects: true, plantillas: false,
  tasks: true, calendario: true, invoices: false, expenses: false, comisiones: false, siigo: false,
  team: false, automatizaciones: false, notas: true, formularios: true, sops: true, reportes: false, ugc: false,
});

export default DEFAULT_PERMISSIONS;
