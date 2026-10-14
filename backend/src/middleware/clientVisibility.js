/**
 * Clientes privados: un cliente puede quedar visible solo para ciertos miembros del equipo
 * (`clients.visible_to_member_ids` = JSON con ids de team_members; null/[] = visible para todos).
 *
 * Se aplica dentro de teamAuthMiddleware, una vez conocido req.teamMember:
 *   1. Bloquea (403) cualquier ruta que apunte a un cliente oculto por path, query o body.
 *   2. Envuelve res.json para quitar, de cualquier respuesta, las filas que pertenezcan a
 *      clientes ocultos (objetos con `client_id`, o con `id` en listados de clientes).
 *
 * Nota: los administradores NO están exentos; solo ven el cliente los miembros listados.
 */
import db from '../config/database.js';

const CACHE_MS = 30 * 1000;
const cache = new Map(); // orgId → { at, rows: [{ id, members: number[] }] }

const parseMembers = (raw) => {
  if (!raw) return [];
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
};

async function loadRestricted(orgId) {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  let rows = [];
  try {
    const data = await db.all(
      "SELECT id, visible_to_member_ids FROM clients WHERE organization_id = ? AND visible_to_member_ids IS NOT NULL AND visible_to_member_ids <> '' AND visible_to_member_ids <> '[]'",
      [orgId],
    );
    rows = data.map((r) => ({ id: Number(r.id), members: parseMembers(r.visible_to_member_ids) })).filter((r) => r.members.length > 0);
  } catch (e) {
    // Si la columna aún no existe (primer arranque) no bloqueamos nada
    rows = [];
  }
  cache.set(orgId, { at: Date.now(), rows });
  return rows;
}

export const invalidateVisibilityCache = (orgId) => { if (orgId) cache.delete(orgId); else cache.clear(); };

/** Ids de clientes que ESTE miembro no puede ver */
export async function getHiddenClientIds(orgId, memberId) {
  const rows = await loadRestricted(orgId);
  return rows.filter((r) => !r.members.includes(Number(memberId))).map((r) => r.id);
}

export async function canSeeClient(orgId, memberId, clientId) {
  const hidden = await getHiddenClientIds(orgId, memberId);
  return !hidden.includes(Number(clientId));
}

// Rutas cuyo primer segmento numérico tras el prefijo es un id de cliente
const CLIENT_SCOPED = [
  /^\/api\/clients\/(\d+)/,
  /^\/api\/client-metrics\/sync\/(\d+)/,
  /^\/api\/client-metrics\/(\d+)/,
  /^\/api\/growth\/clients\/(\d+)/,
  /^\/api\/growth\/(\d+)/,
  /^\/api\/whatsapp-sales\/(\d+)/,
  /^\/api\/client-logbook\/(\d+)/,
  /^\/api\/client-reports\/(\d+)/,
  /^\/api\/client-documents\/(\d+)/,
  /^\/api\/client-calls\/(\d+)/,
  /^\/api\/platform-credentials\/client\/(\d+)/,
  /^\/api\/portal-admin\/clients\/(\d+)/,
  /^\/api\/collections\/client\/(\d+)/,
  /^\/api\/email-marketing\/(\d+)/,
];

// Listados cuyas filas identifican al cliente por `id` (no por client_id)
const CLIENT_LIST_PATHS = [
  /^\/api\/clients(\?|$)/,
  /^\/api\/growth\/clients(\?|$)/,
  /^\/api\/client-metrics\/summary\/all/,
  /^\/api\/client-metrics\/aggregate\/all/,
  /^\/api\/whatsapp\/contacts/,
];

const stripHidden = (value, hidden, listMode, depth = 0) => {
  if (Array.isArray(value)) {
    return value
      .filter((x) => {
        if (!x || typeof x !== 'object') return true;
        if (x.client_id !== undefined && x.client_id !== null && hidden.has(Number(x.client_id))) return false;
        if (listMode && x.id !== undefined && x.client_id === undefined && hidden.has(Number(x.id)) && ('name' in x || 'company' in x || 'nickname' in x || 'client_name' in x)) return false;
        return true;
      })
      .map((x) => stripHidden(x, hidden, listMode, depth + 1));
  }
  if (value && typeof value === 'object' && depth < 8) {
    for (const k of Object.keys(value)) value[k] = stripHidden(value[k], hidden, listMode, depth + 1);
  }
  return value;
};

/** Úsalo como `return applyClientVisibility(req, res, next)` al final de la autenticación */
export async function applyClientVisibility(req, res, next) {
  try {
    if (!req.orgId || !req.teamMember?.id) return next();
    const hiddenIds = await getHiddenClientIds(req.orgId, req.teamMember.id);
    req.hiddenClientIds = hiddenIds;
    if (!hiddenIds.length) return next();
    const hidden = new Set(hiddenIds);
    const url = String(req.originalUrl || req.url || '').split('?')[0];

    // 1) Path
    for (const re of CLIENT_SCOPED) {
      const m = url.match(re);
      if (m && hidden.has(Number(m[1]))) return res.status(403).json({ error: 'No tienes acceso a este cliente' });
    }
    // 2) Query / body
    const qid = req.query?.client_id ?? req.query?.clientId;
    if (qid !== undefined && hidden.has(Number(qid))) return res.status(403).json({ error: 'No tienes acceso a este cliente' });
    const bid = req.body?.client_id ?? req.body?.clientId;
    if (bid !== undefined && hidden.has(Number(bid))) return res.status(403).json({ error: 'No tienes acceso a este cliente' });

    // 3) Respuestas: quitar filas del cliente oculto
    const listMode = CLIENT_LIST_PATHS.some((re) => re.test(url));
    const originalJson = res.json.bind(res);
    res.json = (payload) => originalJson(stripHidden(payload, hidden, listMode));
    return next();
  } catch (error) {
    console.error('[clientVisibility]', error.message);
    return next();
  }
}

export default { applyClientVisibility, getHiddenClientIds, canSeeClient, invalidateVisibilityCache };
