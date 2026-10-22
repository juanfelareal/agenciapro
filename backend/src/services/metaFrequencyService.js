import db from '../config/database.js';
import { withFacebookFallback } from '../utils/facebookClient.js';

/**
 * Frecuencia de los anuncios de Meta para un RANGO de fechas.
 *
 * La frecuencia (impresiones ÷ personas alcanzadas) no se puede sumar ni
 * promediar desde los días guardados: las personas se repiten entre días.
 * Por eso el KPI del rango se pide en vivo a Meta Insights sin time_increment
 * y se lee `frequency` tal cual lo devuelve la API.
 *
 * Plan B (Meta falla o el cliente no tiene credenciales): Σ fb_impressions ÷ Σ fb_reach
 * de los días con alcance guardado, marcado como `daily_avg` (aproximado).
 *
 * Caché en memoria por cliente + rango, TTL 15 minutos.
 */

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map(); // key -> { value, expiresAt }

function cacheKey(clientId, since, until) {
  return `${clientId}:${since}:${until}`;
}

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value, ttl = CACHE_TTL_MS) {
  // Evitar crecimiento sin límite si hay muchos rangos distintos
  if (cache.size > 2000) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

/** Limpia la caché (útil en pruebas o tras un backfill). */
export function clearFrequencyCache() {
  cache.clear();
}

function normalizeFrequency(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Plan B: promedio diario aproximado desde client_daily_metrics.
 * Solo cuenta los días que tienen alcance (fb_reach > 0).
 */
async function dailyAverageFrequency(clientId, since, until) {
  const row = await db.get(`
    SELECT
      COALESCE(SUM(CASE WHEN fb_reach > 0 THEN fb_impressions ELSE 0 END), 0) AS impressions,
      COALESCE(SUM(CASE WHEN fb_reach > 0 THEN fb_reach ELSE 0 END), 0) AS reach
    FROM client_daily_metrics
    WHERE client_id = ? AND metric_date BETWEEN ? AND ?
  `, [clientId, since, until]);
  const impressions = parseFloat(row?.impressions) || 0;
  const reach = parseFloat(row?.reach) || 0;
  const frequency = reach > 0 ? normalizeFrequency(impressions / reach) : null;
  return {
    frequency,
    reach: reach > 0 ? reach : null,
    impressions: reach > 0 ? impressions : null,
    source: frequency !== null ? 'daily_avg' : null,
  };
}

/**
 * Frecuencia del rango para un cliente.
 * @param {{clientId:number, orgId?:number|null, since:string, until:string}} params fechas YYYY-MM-DD
 * @returns {Promise<{frequency:number|null, reach:number|null, impressions:number|null, source:'meta'|'daily_avg'|null}>}
 *   `frequency` nunca es 0 ni infinito: sin dato → null.
 */
export async function getRangeFrequency({ clientId, orgId = null, since, until }) {
  const empty = { frequency: null, reach: null, impressions: null, source: null };
  if (!clientId || !since || !until) return empty;

  const key = cacheKey(clientId, since, until);
  const cached = getCached(key);
  if (cached) return cached;

  // Credenciales de Meta del cliente (siempre dentro de su organización)
  const cred = orgId
    ? await db.get(`
        SELECT fb.access_token, fb.ad_account_id
        FROM client_facebook_credentials fb
        JOIN clients c ON c.id = fb.client_id
        WHERE fb.client_id = ? AND c.organization_id = ?
      `, [clientId, orgId])
    : await db.get(
        'SELECT access_token, ad_account_id FROM client_facebook_credentials WHERE client_id = ?',
        [clientId]
      );

  const hasCred = !!(cred?.ad_account_id && (cred.access_token || process.env.FACEBOOK_SYSTEM_USER_TOKEN));

  if (hasCred) {
    try {
      const { result } = await withFacebookFallback(cred, (fb) => fb.getRangeInsights(since, until), 'Frecuencia');
      const value = result
        ? {
            frequency: normalizeFrequency(result.frequency),
            reach: result.reach > 0 ? result.reach : null,
            impressions: result.impressions > 0 ? result.impressions : null,
            source: 'meta',
          }
        : { ...empty, source: 'meta' }; // sin entrega en el rango: dato real, no error
      setCached(key, value);
      return value;
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      console.warn(`  ⚠️ Frecuencia Meta cliente ${clientId} (${since}→${until}) falló, uso promedio diario: ${msg}`);
      // Cache corto del plan B para no golpear a Meta en cada carga mientras falla
      const fallback = await dailyAverageFrequency(clientId, since, until);
      setCached(key, fallback, 2 * 60 * 1000);
      return fallback;
    }
  }

  // Sin credenciales: solo plan B (barato, no se cachea)
  return dailyAverageFrequency(clientId, since, until);
}

/**
 * Variación porcentual entre dos frecuencias; null si falta alguna.
 */
export function frequencyChange(current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default { getRangeFrequency, frequencyChange, clearFrequencyCache };
