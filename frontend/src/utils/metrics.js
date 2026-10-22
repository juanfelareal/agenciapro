/**
 * Helpers de formato para métricas de pauta.
 */

/** Umbral de fatiga de audiencia: por encima de esta frecuencia la tarjeta se marca en alerta. */
export const FREQUENCY_ALERT = 3.5;

/** Nota que acompaña la frecuencia cuando viene del plan B (Σimpresiones ÷ Σalcance diario). */
export const FREQUENCY_DAILY_AVG_NOTE = 'Frecuencia promedio diaria (aproximada)';

/**
 * Frecuencia con un decimal y coma decimal (es-CO): 2,4. Sin dato (null, 0, infinito) → "—".
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatFrequency(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * true cuando la frecuencia supera el umbral de fatiga (3,5).
 * @param {number|string|null|undefined} value
 */
export function isFrequencyAlert(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > FREQUENCY_ALERT;
}
