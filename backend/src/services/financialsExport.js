/**
 * Exportación a Excel (.xlsx) del dashboard financiero de un cliente.
 *
 * buildFinancialsWorkbook({ clientId, orgId, period }) → Buffer .xlsx con las hojas
 * "Resumen", "Diario", "Productos", "Costos fijos" y "Costos variables".
 * Reutilizable desde el panel interno y desde el portal del cliente (misma función).
 * Todo sin IVA, etiquetas en español, formato de miles.
 */
import * as XLSX from 'xlsx';
import db from '../config/database.js';
import { computeFinancials } from './clientFinancialsService.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const FMT_MONEY = '#,##0;-#,##0';
const FMT_INT = '#,##0';
const FMT_PCT = '0.0%';
const FMT_X = '0.00';

const num = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

export const monthLabel = (period) => {
  const [y, m] = String(period || '').split('-').map(Number);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : String(period || '');
};

/** Nombre del archivo: Finanzas-<marca>-<periodo>.xlsx (sin caracteres raros). */
export function financialsExportFilename(brand, period) {
  const safe = String(brand || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'cliente';
  return `Finanzas-${safe}-${period}.xlsx`;
}

/** Nombre visible de la marca (nickname > company > name). */
export async function getClientBrandName(clientId, orgId) {
  const row = await db.get('SELECT name, nickname, company FROM clients WHERE id = ? AND organization_id = ?', [clientId, orgId]);
  return row?.nickname || row?.company || row?.name || 'cliente';
}

// ─── Celdas ───
const money = (v) => ({ v: num(v) ?? 0, t: 'n', z: FMT_MONEY });
const int = (v) => ({ v: num(v) ?? 0, t: 'n', z: FMT_INT });
const pct = (ratio) => (num(ratio) === null ? { v: '—', t: 's' } : { v: Number(ratio), t: 'n', z: FMT_PCT });
const times = (v) => (num(v) === null ? { v: '—', t: 's' } : { v: Number(v), t: 'n', z: FMT_X });
const text = (v) => ({ v: v === null || v === undefined ? '' : String(v), t: 's' });

function sheetFromRows(rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => (c && typeof c === 'object' && 't' in c ? c.v : c))));
  // Volver a aplicar tipo/formato a cada celda (aoa_to_sheet solo toma el valor)
  rows.forEach((r, ri) => r.forEach((c, ci) => {
    if (!c || typeof c !== 'object' || !('t' in c)) return;
    const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
    if (!ws[addr]) return;
    ws[addr].t = c.t;
    if (c.z) ws[addr].z = c.z;
  }));
  if (widths) ws['!cols'] = widths.map((wch) => ({ wch }));
  return ws;
}

const KIND_LABEL = { percent: 'Porcentaje', per_order: 'Por pedido', per_unit: 'Por unidad', monthly_fixed: 'Fijo mensual (prorrateado)' };
const BASE_LABEL = { revenue: 'Venta neta', net_revenue: 'Venta neta − costo de producto', gross_revenue: 'Venta total pagada (con IVA y envío)' };

// ─── Hojas ───
function buildResumen(data, brand) {
  const t = data.totals || {};
  const be = data.break_even || {};
  const proj = data.projection || {};
  const costsTotal = (t.cogs || 0) + (t.ad_spend || 0) + (t.variable_costs || 0) + (t.fixed_costs || 0);
  const rows = [
    [text(`Finanzas — ${brand}`), text(monthLabel(data.period))],
    [text('Periodo'), text(`${data.start} a ${data.end}`)],
    [text('Días transcurridos'), int(data.days_elapsed), text(`de ${data.days_in_month}`)],
    [text('Base'), text('Venta neta confirmada, todo sin IVA')],
    [],
    [text('VENTAS'), text('Valor'), text('Nota')],
    [text('Venta bruta (antes de descuentos)'), money(t.gross_sales), text('Venta neta + descuentos')],
    [text('Descuentos (sin IVA)'), money(t.discounts), pct(t.discount_pct)],
    [text('Venta neta'), money(t.revenue), text('Después de descuentos, sin IVA ni envío')],
    [text('Venta total (todos los pedidos, con IVA y envío)'), money(t.revenue_total), text('Referencia')],
    [text('Pedidos'), int(t.orders)],
    [text('Ticket promedio'), money(t.aov)],
    [text('Unidades'), int(t.units)],
    [text('Venta por WhatsApp'), money(t.revenue_whatsapp), pct(t.whatsapp_share)],
    [],
    [text('COSTOS'), text('Valor'), text('% de la venta neta')],
    [text('Costo de producto'), money(t.cogs), pct(t.cogs_pct)],
    [text('  del cual estimado (sin costo cargado)'), money(t.cogs_estimated)],
    [text('Pauta (Meta + Google + TikTok)'), money(t.ad_spend), pct(t.ads_pct)],
    [text('  Meta'), money(t.ad_spend_by_source?.fb)],
    [text('  Google'), money(t.ad_spend_by_source?.ga)],
    [text('  TikTok'), money(t.ad_spend_by_source?.tt)],
    [text('Costos variables'), money(t.variable_costs), pct(t.revenue > 0 ? (t.variable_costs || 0) / t.revenue : null)],
    [text('Costos fijos (parte del mes)'), money(t.fixed_costs), pct(t.revenue > 0 ? (t.fixed_costs || 0) / t.revenue : null)],
    [text('Costos totales'), money(costsTotal), pct(t.revenue > 0 ? costsTotal / t.revenue : null)],
    [],
    [text('RESULTADO'), text('Valor'), text('Nota')],
    [text('Utilidad bruta (venta neta − costo de producto)'), money(t.gross_profit), pct(t.gross_margin)],
    [text('Utilidad neta del mes'), money(t.net_profit), pct(t.margin)],
    [text('Margen neto'), pct(t.margin)],
    [text('Margen de contribución'), pct(be.contribution_ratio), text('1 − (costo de producto + variables) / venta neta')],
    [text('ROAS (venta neta / pauta)'), times(t.mer)],
    [text('ROAS web'), times(t.roas_web)],
    [text('ROAS WhatsApp'), times(t.roas_whatsapp)],
    [text('Costo por pedido (pauta / pedidos)'), money(t.cpa)],
    [],
    [text('PUNTO DE EQUILIBRIO'), text('Valor'), text('Nota')],
    [text('BE ROAS mínimo (la pauta no pierde)'), times(be.roas_min), text('1 / margen de contribución')],
    [text('BE ROAS objetivo (cubre fijos al ritmo actual)'), times(be.roas_target)],
    [text('ROAS actual'), times(be.current_roas)],
    [text('Venta necesaria por día'), be.revenue_per_day === null || be.revenue_per_day === undefined ? text('—') : money(be.revenue_per_day), text(be.reachable === false ? 'Sin punto de equilibrio con los costos actuales' : '')],
    [text('Venta necesaria por día (sin pauta)'), be.revenue_per_day_without_ads === null || be.revenue_per_day_without_ads === undefined ? text('—') : money(be.revenue_per_day_without_ads)],
    [text('Venta actual por día'), money(be.current_revenue_per_day)],
    [text('Costos fijos por día'), money(be.fixed_per_day)],
    [text('Pauta por día'), money(be.ads_per_day)],
    [],
    [text('PROYECCIÓN FIN DE MES'), text('Valor'), text('Nota')],
    [text('Venta neta proyectada'), money(proj.revenue_eom), text(data.is_current_month ? 'Al ritmo promedio de los días transcurridos' : 'Mes cerrado')],
    [text('Utilidad neta proyectada'), money(proj.net_profit_eom)],
    [text('Utilidad por día'), money(proj.net_profit_per_day)],
    [text('Días restantes'), int(proj.days_remaining)],
  ];
  return sheetFromRows(rows, [46, 20, 48]);
}

function buildDiario(data) {
  const cumByDate = new Map((data.cumulative || []).map((c) => [c.date, c]));
  const header = ['Fecha', 'Venta bruta', 'Descuentos', 'Venta neta', 'Pedidos', 'Costo producto', 'Pauta', 'Costos variables', 'Costos fijos', 'Utilidad del día', 'Utilidad acumulada'].map(text);
  const rows = [header];
  for (const d of data.daily || []) {
    const gross = d.gross_sales ?? ((d.revenue || 0) + (d.discounts || 0));
    rows.push([
      text(d.date), money(gross), money(d.discounts), money(d.revenue), int(d.orders),
      money(d.cogs), money(d.ad_spend), money(d.variable_costs), money(d.fixed_costs), money(d.net_profit),
      money(cumByDate.get(d.date)?.net_profit),
    ]);
  }
  const t = data.totals || {};
  if ((data.daily || []).length) {
    rows.push([
      text('Total'), money(t.gross_sales), money(t.discounts), money(t.revenue), int(t.orders),
      money(t.cogs), money(t.ad_spend), money(t.variable_costs), money(t.fixed_costs), money(t.net_profit), money(t.net_profit),
    ]);
  }
  return sheetFromRows(rows, [12, 14, 13, 14, 9, 15, 13, 16, 13, 16, 18]);
}

function buildProductos(data) {
  const header = ['Producto', 'Variante', 'SKU', 'Unidades', 'Venta', 'Costo unitario', 'Costo total', 'Utilidad', 'Margen', 'Costo'].map(text);
  const rows = [header];
  for (const p of data.products || []) {
    if (!p.units && !p.revenue) continue;
    rows.push([
      text(p.title), text(p.variant_title && p.variant_title !== 'Default Title' ? p.variant_title : ''), text(p.sku),
      int(p.units), money(p.revenue),
      p.cost === null || p.cost === undefined ? text('—') : money(p.cost),
      money(p.cogs), money(p.gross_profit),
      pct(p.margin_pct === null || p.margin_pct === undefined ? null : p.margin_pct / 100),
      text(p.cost_estimated ? `Estimado al ${Math.round((data.default_cogs_rate || 0) * 100)} %` : (p.cost_source === 'manual' ? 'Manual' : 'Tienda')),
    ]);
  }
  if (rows.length === 1) rows.push([text('Sin ventas por producto en el periodo')]);
  return sheetFromRows(rows, [40, 22, 16, 10, 14, 14, 14, 14, 9, 18]);
}

function buildCostosFijos(data) {
  const fc = data.fixed_costs || {};
  const header = ['Categoría', 'Nombre', 'Mensual', 'Por día', 'Desde', 'Hasta', 'Notas'].map(text);
  const rows = [header];
  for (const it of fc.items || []) {
    rows.push([text(it.category), text(it.name), money(it.amount), money(it.per_day), text(it.start_date ? String(it.start_date).slice(0, 10) : ''), text(it.end_date ? String(it.end_date).slice(0, 10) : ''), text(it.notes)]);
  }
  if ((fc.items || []).length) {
    rows.push([text('Total'), text(''), money(fc.monthly_total), money(fc.per_day)]);
    rows.push([text('Parte del mes (prorrateo por días transcurridos)'), text(''), money(fc.prorated)]);
  } else {
    rows.push([text('Sin costos fijos cargados')]);
  }
  return sheetFromRows(rows, [26, 30, 14, 12, 12, 12, 30]);
}

function buildCostosVariables(data) {
  const vc = data.variable_costs || {};
  const header = ['Categoría', 'Nombre', 'Tipo', 'Porcentaje', 'Base', 'Monto unitario', 'Costo del mes', 'Activo', 'Notas'].map(text);
  const rows = [header];
  for (const it of vc.items || []) {
    const kind = it.kind || 'percent';
    rows.push([
      text(it.category), text(it.name), text(KIND_LABEL[kind] || kind),
      kind === 'percent' ? pct(it.percentage === null || it.percentage === undefined ? null : it.percentage / 100) : text(''),
      text(kind === 'percent' ? (BASE_LABEL[it.applies_to] || BASE_LABEL.revenue) : ''),
      kind === 'percent' ? text('') : money(it.amount_per_order),
      money(it.amount), text(it.is_active ? 'Sí' : 'No'), text(it.notes),
    ]);
  }
  if ((vc.items || []).length) rows.push([text('Total'), text(''), text(''), text(''), text(''), text(''), money(vc.total)]);
  else rows.push([text('Sin costos variables cargados')]);
  return sheetFromRows(rows, [22, 30, 24, 11, 34, 14, 14, 8, 30]);
}

/**
 * Arma el libro .xlsx del dashboard financiero.
 * @param {{clientId:number, orgId:number, period:string, data?:object, brand?:string}} opts
 *   `data` (opcional) = resultado de computeFinancials ya calculado (evita recomputar / permite pruebas).
 *   `brand` (opcional) = nombre de la marca para el encabezado (si no, se lee de la tabla clients).
 * @returns {Promise<Buffer>}
 */
export async function buildFinancialsWorkbook({ clientId, orgId, period, data = null, brand = null }) {
  const financials = data || await computeFinancials({ clientId: Number(clientId), orgId, period, light: true });
  const brandName = brand || (clientId && orgId ? await getClientBrandName(clientId, orgId) : 'cliente');

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildResumen(financials, brandName), 'Resumen');
  XLSX.utils.book_append_sheet(wb, buildDiario(financials), 'Diario');
  XLSX.utils.book_append_sheet(wb, buildProductos(financials), 'Productos');
  XLSX.utils.book_append_sheet(wb, buildCostosFijos(financials), 'Costos fijos');
  XLSX.utils.book_append_sheet(wb, buildCostosVariables(financials), 'Costos variables');
  wb.Props = { Title: `Finanzas ${brandName} ${monthLabel(period)}`, Author: 'Orbit', CreatedDate: new Date() };

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: false });
}

export default { buildFinancialsWorkbook, financialsExportFilename, getClientBrandName };
