/**
 * Helpers for the trend table of ClientTrendPanel: view/range selection
 * (persisted in localStorage), date ranges in Colombia time and the weekly
 * (Monday–Sunday) aggregation of daily metric rows.
 */
import { pickDailyDisplayRevenue, dailyAdSpend } from '../../utils/revenueMetric';

export const TREND_VIEW_STORAGE_KEY = 'metrics-trend-view';

export const DAY_RANGES = [7, 14, 30, 60, 90];
export const WEEK_RANGES = [4, 8, 12, 26];

export const DEFAULT_TREND_VIEW = { view: 'days', days: 7, weeks: 4 };

// ─── Date helpers (Colombia timezone, all values are 'YYYY-MM-DD' strings) ───
export const getColombiaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const toDate = (dateStr) => new Date(dateStr + 'T12:00:00');
const toStr = (date) => date.toISOString().split('T')[0];

export const addDays = (dateStr, n) => {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + n);
  return toStr(d);
};

/** Monday of the week (Mon–Sun) that contains dateStr. */
export const weekMonday = (dateStr) => {
  const d = toDate(dateStr);
  const offset = (d.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0
  return addDays(dateStr, -offset);
};

/** Days between two 'YYYY-MM-DD' strings (b - a). */
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

// ─── View / range selection ───
export const normalizeTrendView = (raw) => {
  const view = raw?.view === 'weeks' ? 'weeks' : 'days';
  const days = DAY_RANGES.includes(Number(raw?.days)) ? Number(raw.days) : DEFAULT_TREND_VIEW.days;
  const weeks = WEEK_RANGES.includes(Number(raw?.weeks)) ? Number(raw.weeks) : DEFAULT_TREND_VIEW.weeks;
  return { view, days, weeks };
};

export const loadTrendView = () => {
  try {
    const raw = localStorage.getItem(TREND_VIEW_STORAGE_KEY);
    return normalizeTrendView(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_TREND_VIEW };
  }
};

export const saveTrendView = (selection) => {
  try {
    localStorage.setItem(TREND_VIEW_STORAGE_KEY, JSON.stringify(normalizeTrendView(selection)));
  } catch {
    /* localStorage no disponible: la selección vive solo en memoria */
  }
};

/** Current range size for the active view (e.g. 14 for days, 8 for weeks). */
export const trendRangeSize = (selection) => (selection.view === 'weeks' ? selection.weeks : selection.days);

/**
 * API range for the current selection.
 *  - days:  the last N days up to today (inclusive).
 *  - weeks: from the Monday of the oldest week up to today.
 */
export const trendDateRange = (selection, today = getColombiaDate()) => {
  if (selection.view === 'weeks') {
    const currentMonday = weekMonday(today);
    return { start: addDays(currentMonday, -(selection.weeks - 1) * 7), end: today };
  }
  return { start: addDays(today, -(selection.days - 1)), end: today };
};

export const trendTitle = (selection) =>
  selection.view === 'weeks' ? `Últimas ${selection.weeks} semanas` : `Últimos ${selection.days} días`;

export const trendEmptyText = (selection) =>
  selection.view === 'weeks'
    ? `Sin datos en las últimas ${selection.weeks} semanas`
    : `Sin datos en los últimos ${selection.days} días`;

// ─── Aggregations ───
export const summarizeDays = (rows, revenueMetric) =>
  rows.reduce(
    (acc, day) => {
      acc.revenue += pickDailyDisplayRevenue(revenueMetric, day);
      acc.spend += dailyAdSpend(day);
      acc.orders += day.shopify_orders || 0;
      acc.days += 1;
      return acc;
    },
    { revenue: 0, spend: 0, orders: 0, days: 0 }
  );

/**
 * Group daily rows into Monday–Sunday weeks.
 * Returns weeks from the most recent to the oldest. Weeks before the first row
 * with data are dropped; gaps in between are kept with zeros so the week-over-week
 * variation stays honest. Each week carries `changePct` vs the previous week
 * (null when there is no previous week or it had no revenue).
 */
export const groupByWeek = (rows, revenueMetric, selection, today = getColombiaDate()) => {
  const byMonday = new Map();
  for (const day of rows) {
    if (!day?.metric_date) continue;
    const monday = weekMonday(day.metric_date);
    if (!byMonday.has(monday)) byMonday.set(monday, []);
    byMonday.get(monday).push(day);
  }
  if (byMonday.size === 0) return [];

  const currentMonday = weekMonday(today);
  const { start } = trendDateRange(selection, today);
  const firstMondayWithData = [...byMonday.keys()].sort()[0];
  let monday = start > firstMondayWithData ? start : firstMondayWithData;

  const weeks = [];
  while (monday <= currentMonday) {
    const sunday = addDays(monday, 6);
    const isCurrent = monday === currentMonday;
    const summary = summarizeDays(byMonday.get(monday) || [], revenueMetric);
    weeks.push({
      start: monday,
      end: sunday,
      isCurrent,
      daysElapsed: isCurrent ? diffDays(monday, today) + 1 : 7,
      ...summary,
      roas: summary.spend > 0 ? summary.revenue / summary.spend : 0,
      avgTicket: summary.orders > 0 ? summary.revenue / summary.orders : 0,
      changePct: null,
    });
    monday = addDays(monday, 7);
  }

  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1];
    weeks[i].changePct = prev.revenue > 0 ? ((weeks[i].revenue - prev.revenue) / prev.revenue) * 100 : null;
  }

  return weeks.reverse();
};

// ─── Formatters shared by the panel and the tables ───
export const formatShortDate = (dateStr) =>
  dateStr ? toDate(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—';
export const formatWeekday = (dateStr) =>
  dateStr ? toDate(dateStr).toLocaleDateString('es-CO', { weekday: 'short' }) : '';
export const formatCOPFull = (val) => (val ? '$' + Math.round(val).toLocaleString('es-CO') : '$0');

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "29 sep – 5 oct" / "6 – 12 oct"; adds the year when the week ends in another year. */
export const formatWeekLabel = (start, end, today = getColombiaDate()) => {
  const s = toDate(start);
  const e = toDate(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const startText = sameMonth ? String(s.getDate()) : `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}`;
  const yearText = end.substring(0, 4) !== today.substring(0, 4) ? ` ${e.getFullYear()}` : '';
  return `${startText} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}${yearText}`;
};

export const roasColor = (roas, zeroClass = 'text-red-600') =>
  roas >= 3 ? 'text-green-600' : roas >= 1 ? 'text-yellow-600' : zeroClass;
