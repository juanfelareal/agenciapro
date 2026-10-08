/**
 * Formato y paleta del dashboard financiero de cliente (Orbit).
 * Pesos colombianos sin decimales; porcentajes a partir de razones (0.34 → "34 %").
 */

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

const copFull = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const intFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** $1.234.567 (negativo: −$1.234.567) */
export const fmtMoney = (v) => {
  if (!isNum(v)) return '—';
  const n = Number(v);
  const s = copFull.format(Math.abs(n)).replace(/\s/g, '');
  return n < 0 ? `−${s}` : s;
};

/** $1,2M · $450K · $900 (para ejes y espacios chicos) */
export const fmtMoneyShort = (v) => {
  if (!isNum(v)) return '—';
  const n = Number(v);
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1).replace('.', ',')}MM`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',')}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
};

/** Razón → porcentaje: 0.345 → "34,5 %" */
export const fmtPct = (ratio, decimals = 0) => {
  if (!isNum(ratio)) return '—';
  return `${(Number(ratio) * 100).toFixed(decimals).replace('.', ',')} %`;
};

/** Número ya en porcentaje: 34.5 → "34,5 %" */
export const fmtPctNum = (n, decimals = 1) => (isNum(n) ? `${Number(n).toFixed(decimals).replace('.', ',')} %` : '—');

/** 3.33 → "3,3×" */
export const fmtX = (v) => (isNum(v) ? `${Number(v).toFixed(1).replace('.', ',')}×` : '—');

export const fmtInt = (v) => (isNum(v) ? intFmt.format(Number(v)) : '—');

/** Variación relativa (0.12 = +12 %) o null si no hay base. */
export const relDelta = (cur, prev) => {
  if (!isNum(cur) || !isNum(prev) || Number(prev) === 0) return null;
  return (Number(cur) - Number(prev)) / Math.abs(Number(prev));
};

/** 'YYYY-MM' → "Octubre 2026" */
export const monthLabel = (period) => {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};

/** 'YYYY-MM' → "oct 26" */
export const monthShort = (period) => {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
};

/** 'YYYY-MM-DD' → "7 oct" */
export const dayShort = (iso) => {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

/** 'YYYY-MM-DD' → "martes 7 de octubre" */
export const dayLong = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** ISO → "hace 5 min" / "hace 3 h" / "hace 2 días" */
export const fmtRelative = (iso) => {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return 'nunca';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
};

export const prevPeriod = (period) => {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};
export const nextPeriod = (period) => {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
};
export const currentPeriod = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7);

/** Paleta: Orbit (carbón + lima) con verde utilidad / rojo pérdida y colores por plataforma. */
export const COLORS = {
  ink: '#17181A',
  muted: '#6B7280',
  profit: '#16a34a',
  loss: '#dc2626',
  lime: '#D7F653',
  // Barras del P&L diario
  revenue: '#17181A',
  costs: '#9AA3AD',
  // Desglose "a dónde se fue la plata"
  cogs: '#64748B',
  ads: '#2563EB',
  variable: '#0D9488',
  fixed: '#D97706',
  // Plataformas de ads
  meta: '#1877F2',
  google: '#F59E0B',
  tiktok: '#111827',
};

export const AD_SOURCES = [
  { key: 'fb', label: 'Meta', color: COLORS.meta },
  { key: 'ga', label: 'Google', color: COLORS.google },
  { key: 'tt', label: 'TikTok', color: COLORS.tiktok },
];

/** Color estable por categoría de costo (misma categoría → mismo color). */
const CATEGORY_COLORS = ['#2563EB', '#0D9488', '#D97706', '#7C3AED', '#DB2777', '#64748B', '#16a34a', '#EA580C'];
export const categoryColor = (name = '') => {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
};

/** Suma las claves numéricas de un arreglo de días (para comparar "mismos días" del mes anterior). */
export const sumDays = (days = []) => {
  const t = { revenue: 0, revenue_total: 0, orders: 0, cogs: 0, gross_profit: 0, ad_spend: 0, variable_costs: 0, fixed_costs: 0, net_profit: 0, units: 0 };
  for (const d of days) for (const k of Object.keys(t)) t[k] += Number(d[k]) || 0;
  t.margin = t.revenue > 0 ? t.net_profit / t.revenue : null;
  t.gross_margin = t.revenue > 0 ? t.gross_profit / t.revenue : null;
  t.mer = t.ad_spend > 0 ? t.revenue / t.ad_spend : null;
  return t;
};
