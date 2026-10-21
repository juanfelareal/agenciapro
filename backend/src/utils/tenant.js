/**
 * Helpers de aislamiento multi-tenant.
 *
 * Cada función verifica que un recurso pertenece a la organización activa
 * (`req.orgId`). Si no existe o es de otra organización lanza un error con
 * `err.status = 404` (nunca 403: no revelamos que el recurso existe).
 *
 * Uso típico en una ruta:
 *   try {
 *     const task = await assertTaskInOrg(db, req.params.id, req.orgId);
 *     ...
 *   } catch (error) {
 *     return sendTenantError(res, error);   // 404 si es de tenant, 500 si no
 *   }
 *
 * Todas aceptan el `db` como primer argumento (el wrapper de database.js, con
 * placeholders `?`) para no acoplarlas a la conexión y poder usarlas también
 * dentro de servicios/cron.
 */

export class TenantError extends Error {
  constructor(message = 'Recurso no encontrado', status = 404) {
    super(message);
    this.name = 'TenantError';
    this.status = status;
    this.code = 'NOT_FOUND';
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/i;

const toId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const toOrg = (orgId) => {
  const n = Number(orgId);
  if (!Number.isInteger(n) || n <= 0) {
    // Sin organización activa no se puede resolver nada: tratamos como no encontrado
    throw new TenantError('Organización no válida', 404);
  }
  return n;
};

/**
 * Verifica que una fila de `table` con `id` pertenece a `orgId` (columna
 * organization_id directa). Devuelve la fila (columnas pedidas) o lanza 404.
 */
export async function assertRowInOrg(db, table, id, orgId, { columns = '*', idColumn = 'id', label = 'Recurso' } = {}) {
  const rowId = toId(id);
  const org = toOrg(orgId);
  if (!rowId) throw new TenantError(`${label} no encontrado`);
  if (!IDENT.test(table) || !IDENT.test(idColumn)) {
    throw new Error('Nombre de tabla/columna inválido');
  }
  const row = await db.get(
    `SELECT ${columns} FROM ${table} WHERE ${idColumn} = ? AND organization_id = ?`,
    [rowId, org]
  );
  if (!row) throw new TenantError(`${label} no encontrado`);
  return row;
}

/** Cliente de la organización. Devuelve la fila de `clients` o lanza 404. */
export async function assertClientInOrg(db, clientId, orgId, columns = '*') {
  return assertRowInOrg(db, 'clients', clientId, orgId, { columns, label: 'Cliente' });
}

/** Proyecto de la organización. Devuelve la fila de `projects` o lanza 404. */
export async function assertProjectInOrg(db, projectId, orgId, columns = '*') {
  return assertRowInOrg(db, 'projects', projectId, orgId, { columns, label: 'Proyecto' });
}

/** Tarea de la organización. Devuelve la fila de `tasks` o lanza 404. */
export async function assertTaskInOrg(db, taskId, orgId, columns = '*') {
  return assertRowInOrg(db, 'tasks', taskId, orgId, { columns, label: 'Tarea' });
}

/** Factura de la organización. */
export async function assertInvoiceInOrg(db, invoiceId, orgId, columns = '*') {
  return assertRowInOrg(db, 'invoices', invoiceId, orgId, { columns, label: 'Factura' });
}

/** Nota de la organización. */
export async function assertNoteInOrg(db, noteId, orgId, columns = '*') {
  return assertRowInOrg(db, 'notes', noteId, orgId, { columns, label: 'Nota' });
}

/** Formulario de la organización. */
export async function assertFormInOrg(db, formId, orgId, columns = '*') {
  return assertRowInOrg(db, 'forms', formId, orgId, { columns, label: 'Formulario' });
}

/**
 * Igual que las anteriores pero devuelve null en vez de lanzar: útil cuando el
 * padre es opcional (p. ej. `client_id` puede venir vacío en el body).
 */
export async function findRowInOrg(db, table, id, orgId, options = {}) {
  try {
    return await assertRowInOrg(db, table, id, orgId, options);
  } catch (error) {
    if (error instanceof TenantError) return null;
    throw error;
  }
}

/**
 * Verifica que TODOS los ids pertenecen a la org. Devuelve el array de filas
 * (en cualquier orden) o lanza 404 si falta alguno. `ids` vacío → [].
 */
export async function assertAllRowsInOrg(db, table, ids, orgId, { columns = 'id', label = 'Recurso' } = {}) {
  const clean = [...new Set((ids || []).map(toId).filter(Boolean))];
  const org = toOrg(orgId);
  if (!clean.length) return [];
  if (!IDENT.test(table)) throw new Error('Nombre de tabla inválido');
  const rows = await db.all(
    `SELECT ${columns} FROM ${table} WHERE id IN (${clean.map(() => '?').join(',')}) AND organization_id = ?`,
    [...clean, org]
  );
  if (rows.length !== clean.length) throw new TenantError(`${label} no encontrado`);
  return rows;
}

/** ¿Es un error de tenant (404)? */
export const isTenantError = (error) => error instanceof TenantError || error?.status === 404;

/**
 * Responde un error de ruta: 404 si es TenantError, 500 en caso contrario.
 * Devuelve el `res` para poder hacer `return sendTenantError(res, error)`.
 */
export function sendTenantError(res, error, fallbackMessage = 'Error interno del servidor') {
  if (isTenantError(error)) {
    return res.status(404).json({ error: error.message || 'Recurso no encontrado' });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ error: error.message || fallbackMessage });
}

/**
 * Middleware de Express: exige que `req.orgId` exista. Para rutas montadas tras
 * teamAuthMiddleware donde una sesión legacy sin organización no debe pasar.
 */
export function requireOrg(req, res, next) {
  if (!toId(req.orgId)) {
    return res.status(401).json({ error: 'No hay una organización activa en la sesión.' });
  }
  return next();
}

export default {
  TenantError,
  assertRowInOrg,
  assertClientInOrg,
  assertProjectInOrg,
  assertTaskInOrg,
  assertInvoiceInOrg,
  assertNoteInOrg,
  assertFormInOrg,
  findRowInOrg,
  assertAllRowsInOrg,
  isTenantError,
  sendTenantError,
  requireOrg,
};
