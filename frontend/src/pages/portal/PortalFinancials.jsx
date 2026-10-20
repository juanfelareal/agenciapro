/**
 * Portal del cliente — Finanzas: el mismo dashboard financiero del equipo (P&L mensual), pero
 * para la marca, desde el celular, y con edición de sus costos y metas si LA REAL lo habilita.
 * Ruta: /portal/finanzas (permiso can_view_financials; edición con financials_editable).
 *
 * Reutiliza los componentes de components/growth/financial pasando un adaptador `api`
 * con la misma firma de growthAPI (el backend ya sabe qué cliente es por el token del portal).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertTriangle, Store, CheckCircle2, X } from 'lucide-react';
import { usePortal } from '../../context/PortalContext';
import { portalFinancialsAPI } from '../../utils/portalApi';
import PortalFinancialHeader from '../../components/portal/PortalFinancialHeader';
import PortalScenariosSlot from '../../components/portal/PortalScenariosSlot';
import { hasScenariosTab } from '../../components/portal/scenariosModule';
import ProfitHero from '../../components/growth/financial/ProfitHero';
import GoalAndRoas from '../../components/growth/financial/GoalAndRoas';
import StatCard, { StatGroup } from '../../components/growth/financial/StatCard';
import MoneyFlow from '../../components/growth/financial/MoneyFlow';
import DailyPnlChart from '../../components/growth/financial/DailyPnlChart';
import CumulativeProfitChart from '../../components/growth/financial/CumulativeProfitChart';
import ProductsTable from '../../components/growth/financial/ProductsTable';
import PurchasePatterns from '../../components/growth/financial/PurchasePatterns';
import CustomerMix from '../../components/growth/financial/CustomerMix';
import CostsPanel, { CostModal } from '../../components/growth/financial/CostsPanel';
import { fmtMoney, fmtPct, fmtX, fmtInt, relDelta, currentPeriod, prevPeriod, sumDays, monthShort } from '../../components/growth/financial/format';

const POLL_MS = 5000;
const POLL_MAX = 8;
const READ_ONLY_MSG = 'Solo lectura · pídele a LA REAL activar la edición';

function Notice({ notice, onClose }) {
  if (!notice) return null;
  const ok = notice.type === 'ok';
  return (
    <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-xl ${ok ? 'bg-[#121314] text-white' : 'bg-red-600 text-white'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#44BF47] shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span className="flex-1 sm:max-w-xs">{notice.text}</span>
      <button type="button" onClick={onClose} className="ml-2 opacity-70 hover:opacity-100" aria-label="Cerrar"><X className="w-4 h-4" /></button>
    </div>
  );
}

export default function PortalFinancials() {
  const { client, permissions } = usePortal();
  const clientId = client?.id;
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [costModal, setCostModal] = useState(null); // { type: 'fixed'|'variable', item? }
  const [notice, setNotice] = useState(null);
  const pollCount = useRef(0);

  // La edición la decide el permiso del portal; el backend la confirma en cada respuesta (data.editable).
  const editable = Boolean(data?.editable ?? permissions?.financials_editable);
  const readOnly = !editable;

  const notify = useCallback((type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }, []);
  const errText = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

  // Pestañas: Resumen siempre; Escenarios solo si existe el módulo (otro equipo lo crea)
  const [tab, setTab] = useState(() => (hasScenariosTab && new URLSearchParams(window.location.search).get('tab') === 'escenarios' ? 'escenarios' : 'resumen'));
  const switchTab = (t) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === 'resumen') url.searchParams.delete('tab'); else url.searchParams.set('tab', t);
    window.history.replaceState({}, '', url);
  };

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const [cur, prev] = await Promise.all([
        portalFinancialsAPI.get(period),
        portalFinancialsAPI.get(prevPeriod(period), { light: true }).catch(() => null),
      ]);
      setData(cur);
      setPrevData(prev || null);
    } catch (err) {
      if (!silent) setError(errText(err, 'No pudimos cargar tus datos financieros.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [period]);

  useEffect(() => { pollCount.current = 0; load(); }, [load]);

  // Mientras el backend trae pedidos/productos de la tienda, refrescamos en silencio.
  useEffect(() => {
    if (!data?.cogs_refreshing || pollCount.current >= POLL_MAX) return undefined;
    const t = setTimeout(() => { pollCount.current += 1; load({ silent: true }); }, POLL_MS);
    return () => clearTimeout(t);
  }, [data, load]);

  // Totales de los mismos días del mes anterior (comparación justa en un mes en curso)
  const prevSameDays = useMemo(() => {
    if (!prevData?.daily?.length || !data) return null;
    const n = data.is_current_month ? data.days_elapsed : prevData.daily.length;
    return sumDays(prevData.daily.slice(0, n));
  }, [prevData, data]);
  const d = (k) => (prevSameDays ? relDelta(data?.totals?.[k], prevSameDays[k]) : null);

  // Adaptador con la firma de growthAPI para los componentes compartidos (ignora el clientId:
  // el portal siempre habla del cliente autenticado). En solo lectura avisa y no llama al backend.
  const portalAdapter = useMemo(() => ({
    createObjective: async (_cid, body) => {
      if (readOnly) { notify('error', READ_ONLY_MSG); return { data: null }; }
      const res = await portalFinancialsAPI.saveObjective(body);
      return { data: res };
    },
  }), [readOnly, notify]);
  // Escenarios: la marca crea los suyos (privados por defecto) y ve los compartidos por LA REAL
  const scenariosAdapter = useMemo(() => ({
    list: (params) => portalFinancialsAPI.scenarios(params),
    create: (body) => portalFinancialsAPI.createScenario(body),
    update: (id, body) => portalFinancialsAPI.updateScenario(id, body),
    remove: (id) => portalFinancialsAPI.deleteScenario(id),
    evaluate: (body) => portalFinancialsAPI.evaluateScenario(body),
    compare: (ids, period) => portalFinancialsAPI.compareScenarios(ids, period),
  }), []);
  const ledgerAdapter = useMemo(() => ({
    patterns: (_cid, days) => portalFinancialsAPI.patterns(days),
    customerMix: (_cid, start, end) => portalFinancialsAPI.customerMix(start, end),
    backfill: (_cid, days) => portalFinancialsAPI.backfillOrders(days),
  }), []);
  const [exportingExcel, setExportingExcel] = useState(false);
  const handleExportExcel = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      const res = await portalFinancialsAPI.exportExcel(period);
      const name = (client?.nickname || client?.company || client?.name || 'marca').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = `Finanzas-${name}-${period}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Error exportando Excel', err);
      notify('error', 'No pudimos generar el Excel.');
    } finally { setExportingExcel(false); }
  };

  // ─── Handlers ───
  const guardEdit = () => { if (readOnly) { notify('error', READ_ONLY_MSG); return false; } return true; };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await portalFinancialsAPI.syncProducts();
      notify('ok', r.message || 'Productos sincronizados.');
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos sincronizar los productos.'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveCost = async (product, cost) => {
    if (!guardEdit()) throw new Error(READ_ONLY_MSG);
    try {
      if (product.in_catalog === false || !product.id) await portalFinancialsAPI.updateVariantCost(product.shopify_variant_id, cost);
      else await portalFinancialsAPI.updateProductCost(product.id, cost);
      notify('ok', `Costo de ${product.title} guardado.`);
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos guardar el costo.'));
      throw err;
    }
  };
  const handleResetCost = async (product) => {
    if (!guardEdit()) return;
    try {
      await portalFinancialsAPI.resetProductCost(product.id);
      notify('ok', 'Volvimos al costo de la tienda.');
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos restaurar el costo.'));
    }
  };
  const handleSaveRate = async (rate) => {
    if (!guardEdit()) return;
    try {
      await portalFinancialsAPI.updateSettings({ default_cogs_rate: rate });
      notify('ok', `Productos sin costo se estiman al ${fmtPct(rate, 0)}.`);
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos guardar el porcentaje.'));
    }
  };

  const handleSaveCostItem = async (type, form) => {
    if (!guardEdit()) throw new Error(READ_ONLY_MSG);
    if (type === 'fixed') {
      if (form.id) await portalFinancialsAPI.updateFixedCost(form.id, form);
      else await portalFinancialsAPI.createFixedCost(form);
    } else {
      if (form.id) await portalFinancialsAPI.updateVariableCost(form.id, form);
      else await portalFinancialsAPI.createVariableCost(form);
    }
    notify('ok', 'Costo guardado.');
    await load({ silent: true });
  };
  const handleDeleteCost = async (type, item) => {
    if (!guardEdit()) return;
    if (!window.confirm(`¿Eliminar "${item.name}"?`)) return;
    try {
      if (type === 'fixed') await portalFinancialsAPI.deleteFixedCost(item.id);
      else await portalFinancialsAPI.deleteVariableCost(item.id);
      notify('ok', 'Costo eliminado.');
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos eliminar el costo.'));
    }
  };
  const openCostModal = (type, item) => { if (guardEdit()) setCostModal({ type, item }); };

  // Exportar PDF: abre el informe imprimible del portal en una pestaña nueva ("Guardar como PDF").
  const pdfRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const handleExportPdf = () => {
    setExporting(true);
    window.open(`/portal/imprimir/finanzas?period=${period}`, '_blank', 'noopener');
    setTimeout(() => setExporting(false), 800);
  };

  // ─── Render ───
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="glass-solid rounded-2xl p-8 sm:p-10 text-center max-w-lg mx-auto mt-6">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600">{error}</p>
        <button type="button" onClick={() => load()} className="btn-primary text-sm mt-5">Reintentar</button>
      </div>
    );
  }

  const t = data.totals;
  const hasAny = t.revenue || t.ad_spend || t.fixed_costs || (data.products || []).length;
  const prevLabel = monthShort(prevPeriod(period));
  const deltaSub = prevSameDays ? `vs ${prevLabel} (mismos días)` : null;
  const costsTotalRevenueShare = t.revenue ? ((t.cogs + t.ad_spend + t.variable_costs + t.fixed_costs) / t.revenue) : null;

  return (
    <div ref={pdfRef} className="space-y-4 sm:space-y-6 pb-10 min-w-0">
      <PortalFinancialHeader
        client={client} period={period} onPeriodChange={setPeriod} data={data}
        onSync={handleSync} syncing={syncing} onExportPdf={handleExportPdf} exporting={exporting} readOnly={readOnly} onExportExcel={handleExportExcel} exportingExcel={exportingExcel}
      />

      {hasScenariosTab && data.scenarios_enabled && (
        <div className="no-print flex gap-1 bg-white/70 border border-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
          {[['resumen', 'Resumen'], ['escenarios', 'Escenarios']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => switchTab(k)} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === k ? 'bg-[#121314] text-[#44BF47]' : 'text-gray-500 hover:text-[#121314]'}`}>{label}</button>
          ))}
        </div>
      )}

      {hasScenariosTab && data.scenarios_enabled && tab === 'escenarios' ? (
        <PortalScenariosSlot clientId={clientId} period={period} data={data} api={scenariosAdapter} readOnly={readOnly} portal />
      ) : data.is_future ? (
        <div className="glass-solid rounded-2xl p-10 text-center text-sm text-gray-500">Ese mes todavía no ha empezado.</div>
      ) : !data.shopify?.connected && !hasAny ? (
        <div className="glass-solid rounded-2xl p-8 sm:p-10 text-center max-w-xl mx-auto">
          <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-[#121314]">Todavía no hay datos de tu tienda</h2>
          <p className="text-sm text-gray-500 mt-1">Cuando LA REAL conecte tu tienda (Shopify o WooCommerce) verás aquí ventas, pedidos, productos y la utilidad real de cada mes.</p>
        </div>
      ) : (
        <>
          <ProfitHero data={data} prev={prevSameDays} />
          <GoalAndRoas clientId={clientId} period={period} data={data} goal={data.goal} onGoalSaved={() => load({ silent: true })} api={portalAdapter} />

          <StatGroup cols={4}>
            <StatCard
              label="Ventas netas" value={fmtMoney(t.revenue)} delta={d('revenue')}
              sub={<>{fmtInt(t.orders)} pedidos · ticket {fmtMoney(t.aov)}<br />Venta total {fmtMoney(t.revenue_total)}</>}
              info="Venta confirmada menos descuentos, devoluciones e impuestos: lo que de verdad entra. La venta total (todos los pedidos, con IVA y envío) va solo de referencia."
            />
            <StatCard
              label="Costo de producto" value={fmtMoney(t.cogs)} delta={d('cogs')} invertDelta
              sub={<>{fmtPct(t.cogs_pct, 0)} de la venta{t.cogs_estimated > 0 ? <> · {fmtMoney(t.cogs_estimated)} estimado</> : null}</>}
              info="Lo que costó la mercancía vendida: costo unitario × unidades. Los productos sin costo se estiman con el % por defecto."
            />
            <StatCard
              label="Utilidad bruta" value={fmtMoney(t.gross_profit)} raw={t.gross_profit} tone="auto" delta={d('gross_profit')}
              sub={`Margen bruto ${fmtPct(t.gross_margin, 1)}`}
              info="Ventas netas menos costo de producto. Lo que queda para pagar ads, variables y fijos."
            />
            <StatCard
              label="Inversión en ads" value={fmtMoney(t.ad_spend)} delta={d('ad_spend')} invertDelta
              sub={`MER ${fmtX(t.mer)} · CPA ${fmtMoney(t.cpa)} · ${fmtPct(t.ads_pct, 0)} de la venta`}
              info="Meta + Google + TikTok. MER (o ROAS combinado): pesos vendidos por cada peso en ads. CPA: ads por pedido."
            />
          </StatGroup>
          <StatGroup cols={3}>
            <StatCard
              label="Costos variables" value={fmtMoney(t.variable_costs)} delta={d('variable_costs')} invertDelta
              sub={t.revenue ? `${fmtPct(t.variable_costs / t.revenue, 1)} de la venta` : '—'}
              info="Pasarela, envíos, empaque: lo que se paga por cada venta o pedido."
            />
            <StatCard
              label="Costos fijos (prorrateados)" value={fmtMoney(t.fixed_costs)} delta={d('fixed_costs')} invertDelta
              sub={`${fmtMoney(data.fixed_costs?.monthly_total)} / mes · ${fmtMoney(data.fixed_costs?.per_day)} / día`}
              info="Fee de agencia, apps, nómina: la parte del mes que corresponde a los días transcurridos."
            />
            <StatCard
              label="Utilidad neta" value={fmtMoney(t.net_profit)} raw={t.net_profit} tone="auto" delta={d('net_profit')}
              sub={<>Margen {fmtPct(t.margin, 1)}{costsTotalRevenueShare !== null ? <> · costos {fmtPct(costsTotalRevenueShare, 0)} de la venta</> : null}{deltaSub ? <><br />{deltaSub}</> : null}</>}
              info="Lo que quedó después de todos los costos."
            />
          </StatGroup>

          <MoneyFlow data={data} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            <DailyPnlChart daily={data.daily} />
            <CumulativeProfitChart data={data} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <PurchasePatterns clientId={clientId} period={period} api={ledgerAdapter} />
            <CustomerMix clientId={clientId} period={period} api={ledgerAdapter} />
          </div>

          <ProductsTable data={data} onSaveCost={handleSaveCost} onResetCost={handleResetCost} onSync={handleSync} syncing={syncing} onSaveRate={handleSaveRate} />

          <CostsPanel
            data={data}
            onAdd={(type) => openCostModal(type)}
            onEdit={(type, item) => openCostModal(type, item)}
            onDelete={handleDeleteCost}
          />
        </>
      )}

      {costModal && (
        <CostModal
          type={costModal.type}
          item={costModal.item}
          onSave={(form) => handleSaveCostItem(costModal.type, form)}
          onClose={() => setCostModal(null)}
        />
      )}
      <Notice notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
