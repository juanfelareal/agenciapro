/**
 * Escenarios financieros por cliente ("¿qué pasa si…?").
 *
 * Un escenario toma el mes real (computeFinancials, light) y proyecta el MES COMPLETO cambiando
 * supuestos: inversión diaria, ROAS esperado, ticket, % costo de producto, costos variables/fijos
 * extra o desactivados, o una venta objetivo directa.
 *
 *   venta        = revenue_month ó ads_mes × ROAS (ó proyección real si no hay pauta)
 *   pedidos      = venta ÷ ticket            unidades = pedidos × unidades/pedido reales
 *   producto     = venta × % costo de producto
 *   variables    = variableCostsFor(items) (los % sobre venta bruta usan la relación bruta/neta real)
 *   fijos        = fijos del mes (± extras/desactivados) ó fixed_override
 *   utilidad     = venta − producto − pauta − variables − fijos
 *   BE ROAS      = 1 ÷ margen de contribución       ROAS objetivo = (fijos + pauta) ÷ (mc × pauta)
 *   venta cero   = (fijos + pauta) ÷ mc
 *
 * Las funciones de proyección son puras (sin DB) para poder probarlas y reutilizarlas desde el
 * portal del cliente (owner_type 'client').
 */
import db from '../config/database.js';
import { computeFinancials, variableCostsFor, todayColombia } from './clientFinancialsService.js';

const num = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const n0 = (v) => num(v) ?? 0;
const round = (v, d = 0) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : 0);
const ratio = (a, b) => (b > 0 ? a / b : null);
const clean = (s, max = 80) => String(s ?? '').trim().slice(0, max);

export const VISIBILITIES = ['shared', 'private'];
export const OWNER_TYPES = ['team', 'client'];
const VC_KINDS = ['percent', 'per_order', 'per_unit', 'monthly_fixed'];
const VC_BASES = ['revenue', 'gross_revenue', 'net_revenue'];
const MAX_ITEMS = 20;

// ─── Parámetros ───

/** Normaliza y limita los parámetros de un escenario (ignora lo que no conoce). */
export function sanitizeParams(raw = {}) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  const pos = (v) => { const x = num(v); return x !== null && x >= 0 ? x : undefined; };

  if (pos(p.ads_per_day) !== undefined) out.ads_per_day = pos(p.ads_per_day);
  if (pos(p.roas) !== undefined) out.roas = pos(p.roas);
  if (pos(p.revenue_month) !== undefined && pos(p.revenue_month) > 0) out.revenue_month = pos(p.revenue_month);
  if (pos(p.aov) !== undefined && pos(p.aov) > 0) out.aov = pos(p.aov);
  if (num(p.cogs_rate) !== null) out.cogs_rate = Math.min(Math.max(num(p.cogs_rate), 0), 0.99);
  if (pos(p.fixed_override) !== undefined) out.fixed_override = pos(p.fixed_override);

  const ids = (arr) => Array.isArray(arr) ? [...new Set(arr.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200) : [];
  if (ids(p.exclude_variable_cost_ids).length) out.exclude_variable_cost_ids = ids(p.exclude_variable_cost_ids);
  if (ids(p.exclude_fixed_cost_ids).length) out.exclude_fixed_cost_ids = ids(p.exclude_fixed_cost_ids);

  if (Array.isArray(p.extra_variable_costs)) {
    out.extra_variable_costs = p.extra_variable_costs.slice(0, MAX_ITEMS).map((vc) => {
      const kind = VC_KINDS.includes(vc?.kind) ? vc.kind : 'percent';
      return {
        name: clean(vc?.name) || (kind === 'percent' ? 'Costo variable' : 'Costo por pedido'),
        kind,
        percentage: kind === 'percent' ? Math.min(Math.max(n0(vc?.percentage), 0), 100) : 0,
        amount: kind === 'percent' ? 0 : Math.max(n0(vc?.amount), 0),
        applies_to: VC_BASES.includes(vc?.applies_to) ? vc.applies_to : 'revenue',
      };
    }).filter((vc) => (vc.kind === 'percent' ? vc.percentage > 0 : vc.amount > 0));
    if (!out.extra_variable_costs.length) delete out.extra_variable_costs;
  }
  if (Array.isArray(p.extra_fixed_costs)) {
    out.extra_fixed_costs = p.extra_fixed_costs.slice(0, MAX_ITEMS)
      .map((fc) => ({ name: clean(fc?.name) || 'Costo fijo', amount: Math.max(n0(fc?.amount), 0) }))
      .filter((fc) => fc.amount > 0);
    if (!out.extra_fixed_costs.length) delete out.extra_fixed_costs;
  }
  return out;
}

// ─── Contexto del mes real ───

/**
 * Extrae del P&L real lo que la proyección necesita (relaciones del mes transcurrido).
 * `fin` es el resultado de computeFinancials.
 */
export function contextFromFinancials(fin) {
  const t = fin.totals || {};
  const daysInMonth = fin.days_in_month || 30;
  const daysElapsed = fin.days_elapsed || 0;
  const revenue = n0(t.revenue);
  const orders = n0(t.orders);
  const units = n0(t.units);
  const adSpend = n0(t.ad_spend);
  const defaultRate = num(fin.default_cogs_rate) ?? 0.35;

  const variableItems = (fin.variable_costs?.items || []).map((vc) => ({
    id: vc.id,
    name: vc.name,
    category: vc.category || null,
    kind: vc.kind || 'percent',
    percentage: n0(vc.percentage),
    // en el P&L `amount` es el total del mes; el valor unitario viene en amount_per_order
    amount: n0(vc.amount_per_order ?? vc.amount),
    applies_to: vc.applies_to || 'revenue',
    is_active: vc.is_active !== false && Number(vc.is_active) !== 0,
  }));
  const fixedItems = (fin.fixed_costs?.items || []).map((fc) => ({ id: fc.id, name: fc.name, category: fc.category || null, amount: n0(fc.amount) }));

  return {
    period: fin.period,
    days_in_month: daysInMonth,
    days_elapsed: daysElapsed,
    revenue, orders, units, ad_spend: adSpend,
    cogs: n0(t.cogs),
    variable_costs: n0(t.variable_costs),
    fixed_month: n0(fin.fixed_costs?.monthly_total),
    ads_per_day: daysElapsed > 0 ? adSpend / daysElapsed : 0,
    revenue_per_day: daysElapsed > 0 ? revenue / daysElapsed : 0,
    roas: ratio(revenue, adSpend),
    aov: ratio(revenue, orders),
    units_per_order: orders > 0 ? units / orders : 1,
    cogs_rate: revenue > 0 ? n0(t.cogs) / revenue : defaultRate,
    gross_ratio: revenue > 0 && n0(t.revenue_confirmed) > 0 ? n0(t.revenue_confirmed) / revenue : 1,
    ad_sources: t.ad_spend_by_source || { fb: 0, ga: 0, tt: 0 },
    variable_items: variableItems,
    fixed_items: fixedItems,
    projection: fin.projection || null,
  };
}

// ─── Proyección pura ───

/**
 * Proyecta el mes completo con los parámetros dados sobre el contexto real. Pura.
 * Devuelve la misma forma para el escenario y para "Hoy (real)" (params vacíos).
 */
export function projectMonth(ctx, rawParams = {}) {
  const p = sanitizeParams(rawParams);
  const D = ctx.days_in_month;

  const adsPerDay = p.ads_per_day ?? ctx.ads_per_day;
  const adsMonth = adsPerDay * D;
  const roasIn = p.roas ?? ctx.roas;

  let revenue;
  let revenueSource;
  if (p.revenue_month !== undefined) { revenue = p.revenue_month; revenueSource = 'target'; }
  else if (roasIn !== null && roasIn !== undefined && adsMonth > 0) { revenue = adsMonth * roasIn; revenueSource = 'ads_x_roas'; }
  else { revenue = ctx.revenue_per_day * D; revenueSource = 'trend'; }

  const aov = p.aov ?? ctx.aov;
  const orders = aov && aov > 0 ? revenue / aov : 0;
  const units = orders * (ctx.units_per_order || 1);
  const cogsRate = p.cogs_rate ?? ctx.cogs_rate;
  const cogs = revenue * cogsRate;
  const grossRevenue = revenue * (ctx.gross_ratio || 1);

  // Costos variables: existentes activos (menos desactivados) + extras
  const excludedV = new Set(p.exclude_variable_cost_ids || []);
  const baseV = ctx.variable_items.filter((vc) => vc.is_active && !excludedV.has(Number(vc.id)));
  const extraV = (p.extra_variable_costs || []).map((vc) => ({ ...vc, id: null, extra: true }));
  const allV = [...baseV, ...extraV];
  const vcAmount = (vc) => variableCostsFor([vc], revenue, cogs, orders, { units, dayFraction: 1, grossRevenue });
  const variableItems = allV.map((vc) => ({ id: vc.id ?? null, name: vc.name, kind: vc.kind, percentage: vc.percentage, amount_unit: vc.amount, applies_to: vc.applies_to, extra: !!vc.extra, amount: round(vcAmount(vc)) }));
  const variable = allV.reduce((s, vc) => s + vcAmount(vc), 0);

  // Fijos
  const excludedF = new Set(p.exclude_fixed_cost_ids || []);
  const baseF = ctx.fixed_items.filter((fc) => !excludedF.has(Number(fc.id)));
  const extraF = (p.extra_fixed_costs || []).map((fc) => ({ ...fc, id: null, extra: true }));
  let fixedItems = [...baseF, ...extraF].map((fc) => ({ id: fc.id ?? null, name: fc.name, extra: !!fc.extra, amount: round(fc.amount) }));
  let fixed = fixedItems.reduce((s, fc) => s + fc.amount, 0);
  if (p.fixed_override !== undefined) { fixed = p.fixed_override; fixedItems = [{ id: null, name: 'Fijos (monto fijado)', extra: true, amount: round(fixed) }]; }

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - adsMonth - variable - fixed;
  const cr = revenue > 0 ? 1 - (cogs + variable) / revenue : null;
  const reachable = cr !== null && cr > 0;
  const beRoas = reachable ? 1 / cr : null;
  const roasTarget = reachable && adsMonth > 0 ? (fixed + adsMonth) / (cr * adsMonth) : null;
  const revenueBreakEven = reachable ? (fixed + adsMonth) / cr : null;
  const roasEff = ratio(revenue, adsMonth);

  const share = (v) => (revenue > 0 ? v / revenue : null);
  const srcTotal = n0(ctx.ad_sources.fb) + n0(ctx.ad_sources.ga) + n0(ctx.ad_sources.tt);
  const adsBySource = srcTotal > 0
    ? Object.fromEntries(['fb', 'ga', 'tt'].map((k) => [k, round(adsMonth * (n0(ctx.ad_sources[k]) / srcTotal))]))
    : { fb: round(adsMonth), ga: 0, tt: 0 };

  return {
    period: ctx.period,
    days_in_month: D,
    days_elapsed: ctx.days_elapsed,
    ads_per_day: round(adsPerDay),
    ads_month: round(adsMonth),
    roas: roasEff === null ? null : round(roasEff, 2),
    revenue: round(revenue),
    revenue_source: revenueSource,
    orders: round(orders, 1),
    units: round(units, 1),
    aov: aov ? round(aov) : null,
    cpa: orders > 0 ? round(adsMonth / orders) : null,
    cogs: round(cogs),
    cogs_rate: round(cogsRate, 4),
    gross_profit: round(grossProfit),
    gross_margin: share(grossProfit),
    variable_costs: round(variable),
    fixed_costs: round(fixed),
    net_profit: round(netProfit),
    margin: share(netProfit),
    contribution_ratio: cr,
    be_roas: beRoas === null ? null : round(beRoas, 2),
    roas_target: roasTarget === null ? null : round(roasTarget, 2),
    revenue_break_even: revenueBreakEven === null ? null : round(revenueBreakEven),
    reachable,
    breakdown: {
      cogs: round(cogs), ads: round(adsMonth), variable: round(variable), fixed: round(fixed), profit: round(netProfit),
      cogs_pct: share(cogs), ads_pct: share(adsMonth), variable_pct: share(variable), fixed_pct: share(fixed), profit_pct: share(netProfit),
      ads_by_source: adsBySource,
    },
    variable_items: variableItems,
    fixed_items: fixedItems,
    assumptions: {
      ads_per_day: round(adsPerDay), roas: roasIn === null || roasIn === undefined ? null : round(roasIn, 2),
      aov: aov ? round(aov) : null, cogs_rate: round(cogsRate, 4), units_per_order: round(ctx.units_per_order || 1, 2),
      gross_ratio: round(ctx.gross_ratio || 1, 4), revenue_month: p.revenue_month ?? null, fixed_override: p.fixed_override ?? null,
    },
    params: p,
  };
}

// ─── Evaluación contra el mes real (DB) ───

const normPeriod = (period) => (/^\d{4}-\d{2}$/.test(period || '') ? period : todayColombia().slice(0, 7));

async function loadContext({ clientId, orgId, period }) {
  const fin = await computeFinancials({ clientId: Number(clientId), orgId, period: normPeriod(period), light: true });
  return { fin, ctx: contextFromFinancials(fin) };
}

function baselineOf(fin, ctx) {
  return { ...projectMonth(ctx, {}), projection: fin.projection, totals: fin.totals, is_current_month: fin.is_current_month, is_future: fin.is_future };
}

/** Evalúa parámetros (sin guardar). Devuelve { scenario, baseline, params }. */
export async function evaluateScenario({ clientId, orgId, period, params }) {
  const { fin, ctx } = await loadContext({ clientId, orgId, period });
  const scenario = projectMonth(ctx, params);
  return { period: ctx.period, scenario, baseline: baselineOf(fin, ctx), params: scenario.params };
}

// ─── CRUD con visibilidad ───

const parseParams = (raw) => { try { return sanitizeParams(typeof raw === 'string' ? JSON.parse(raw) : (raw || {})); } catch { return {}; } };
const rowToScenario = (r) => ({
  id: r.id, client_id: r.client_id, name: r.name, description: r.description || null,
  visibility: r.visibility, owner_type: r.owner_type, owner_id: r.owner_id === null ? null : Number(r.owner_id),
  owner_name: r.owner_name || null,
  params: parseParams(r.params), period: r.period || null,
  created_at: r.created_at, updated_at: r.updated_at,
});

const normOwner = (owner) => {
  const type = OWNER_TYPES.includes(owner?.owner_type) ? owner.owner_type : 'team';
  const id = Number(owner?.owner_id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('owner_id inválido');
  return { owner_type: type, owner_id: id };
};
const isOwner = (row, owner) => row.owner_type === owner.owner_type && Number(row.owner_id) === owner.owner_id;
export const canSee = (row, owner) => row.visibility === 'shared' || isOwner(row, owner);
/** Los privados solo los edita su dueño; los compartidos, el dueño o cualquiera del equipo. */
export const canEdit = (row, owner) => isOwner(row, owner) || (row.visibility === 'shared' && owner.owner_type === 'team');

const SELECT = `
  SELECT s.*, CASE WHEN s.owner_type = 'team' THEN tm.name ELSE c.name END AS owner_name
  FROM client_financial_scenarios s
  LEFT JOIN team_members tm ON s.owner_type = 'team' AND tm.id = s.owner_id
  LEFT JOIN clients c ON s.owner_type = 'client' AND c.id = s.owner_id
`;

/**
 * Lista los escenarios visibles para `owner`. Con `withResults` (por defecto) anexa `result`
 * (proyección del mes) a cada uno y devuelve también `baseline` ("Hoy (real)").
 */
export async function listScenarios({ clientId, orgId, owner, period, withResults = true }) {
  const o = normOwner(owner);
  const rows = await db.all(`${SELECT} WHERE s.client_id = ? AND s.organization_id = ? ORDER BY s.updated_at DESC, s.id DESC`, [clientId, orgId]);
  const visible = rows.filter((r) => canSee(r, o)).map((r) => ({ ...rowToScenario(r), can_edit: canEdit(r, o), is_mine: isOwner(r, o) }));
  if (!withResults) return { period: normPeriod(period), scenarios: visible, baseline: null };
  const { fin, ctx } = await loadContext({ clientId, orgId, period });
  return {
    period: ctx.period,
    baseline: baselineOf(fin, ctx),
    scenarios: visible.map((s) => ({ ...s, result: projectMonth(ctx, s.params) })),
  };
}

export async function getScenario({ clientId, orgId, id, owner }) {
  const o = normOwner(owner);
  const row = await db.get(`${SELECT} WHERE s.id = ? AND s.client_id = ? AND s.organization_id = ?`, [id, clientId, orgId]);
  if (!row || !canSee(row, o)) return null;
  return { ...rowToScenario(row), can_edit: canEdit(row, o), is_mine: isOwner(row, o) };
}

export async function createScenario({ clientId, orgId, owner, name, description, visibility, params, period }) {
  const o = normOwner(owner);
  const cleanName = clean(name, 120);
  if (!cleanName) throw new Error('El escenario necesita un nombre');
  const vis = VISIBILITIES.includes(visibility) ? visibility : 'shared';
  const per = /^\d{4}-\d{2}$/.test(period || '') ? period : null;
  const r = await db.run(`
    INSERT INTO client_financial_scenarios (organization_id, client_id, name, description, visibility, owner_type, owner_id, params, period)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [orgId, clientId, cleanName, clean(description, 500) || null, vis, o.owner_type, o.owner_id, JSON.stringify(sanitizeParams(params)), per]);
  return getScenario({ clientId, orgId, id: r.lastInsertRowid, owner: o });
}

export async function updateScenario({ clientId, orgId, id, owner, name, description, visibility, params, period }) {
  const o = normOwner(owner);
  const row = await db.get('SELECT * FROM client_financial_scenarios WHERE id = ? AND client_id = ? AND organization_id = ?', [id, clientId, orgId]);
  if (!row || !canSee(row, o)) return null;
  if (!canEdit(row, o)) { const e = new Error('Solo quien creó este escenario puede editarlo'); e.status = 403; throw e; }
  // Solo el dueño puede cambiar la visibilidad (un compartido no se vuelve privado de otro)
  const vis = VISIBILITIES.includes(visibility) && isOwner(row, o) ? visibility : row.visibility;
  const cleanName = name === undefined ? row.name : clean(name, 120);
  if (!cleanName) throw new Error('El escenario necesita un nombre');
  const desc = description === undefined ? row.description : (clean(description, 500) || null);
  const par = params === undefined ? row.params : JSON.stringify(sanitizeParams(params));
  const per = period === undefined ? row.period : (/^\d{4}-\d{2}$/.test(period || '') ? period : null);
  await db.run(`
    UPDATE client_financial_scenarios SET name = ?, description = ?, visibility = ?, params = ?, period = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND client_id = ? AND organization_id = ?
  `, [cleanName, desc, vis, par, per, id, clientId, orgId]);
  return getScenario({ clientId, orgId, id, owner: o });
}

export async function deleteScenario({ clientId, orgId, id, owner }) {
  const o = normOwner(owner);
  const row = await db.get('SELECT * FROM client_financial_scenarios WHERE id = ? AND client_id = ? AND organization_id = ?', [id, clientId, orgId]);
  if (!row || !canSee(row, o)) return false;
  if (!canEdit(row, o)) { const e = new Error('Solo quien creó este escenario puede borrarlo'); e.status = 403; throw e; }
  await db.run('DELETE FROM client_financial_scenarios WHERE id = ? AND client_id = ? AND organization_id = ?', [id, clientId, orgId]);
  return true;
}

/** Compara hasta `max` escenarios (visibles) contra "Hoy (real)" en un mismo periodo. */
export async function compareScenarios({ clientId, orgId, owner, ids, period, max = 3 }) {
  const o = normOwner(owner);
  const wanted = [...new Set((ids || []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))].slice(0, max);
  const { fin, ctx } = await loadContext({ clientId, orgId, period });
  const scenarios = [];
  if (wanted.length) {
    const rows = await db.all(`${SELECT} WHERE s.client_id = ? AND s.organization_id = ? AND s.id = ANY(?::int[])`, [clientId, orgId, wanted]);
    const byId = new Map(rows.map((r) => [Number(r.id), r]));
    for (const id of wanted) {
      const r = byId.get(id);
      if (!r || !canSee(r, o)) continue;
      const s = rowToScenario(r);
      scenarios.push({ ...s, can_edit: canEdit(r, o), is_mine: isOwner(r, o), result: projectMonth(ctx, s.params) });
    }
  }
  return { period: ctx.period, baseline: baselineOf(fin, ctx), scenarios };
}
