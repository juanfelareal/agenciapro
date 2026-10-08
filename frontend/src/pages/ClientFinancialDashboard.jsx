/**
 * Dashboard financiero de un cliente (P&L mensual estilo Tanteo, lenguaje visual Orbit).
 * Ruta: /app/growth/:clientId/financials
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, Store, CheckCircle2, X } from 'lucide-react';
import { growthAPI, clientsAPI } from '../utils/api';
import FinancialHeader from '../components/growth/financial/FinancialHeader';
import ProfitHero from '../components/growth/financial/ProfitHero';
import StatCard, { StatGroup } from '../components/growth/financial/StatCard';
import MoneyFlow from '../components/growth/financial/MoneyFlow';
import DailyPnlChart from '../components/growth/financial/DailyPnlChart';
import CumulativeProfitChart from '../components/growth/financial/CumulativeProfitChart';
import ProductsTable from '../components/growth/financial/ProductsTable';
import CostsPanel, { CostModal } from '../components/growth/financial/CostsPanel';
import { fmtMoney, fmtPct, fmtX, fmtInt, relDelta, currentPeriod, prevPeriod, sumDays, monthShort } from '../components/growth/financial/format';

const POLL_MS = 5000;
const POLL_MAX = 8;

function Notice({ notice, onClose }) {
  if (!notice) return null;
  const ok = notice.type === 'ok';
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-xl ${ok ? 'bg-[#17181A] text-white' : 'bg-red-600 text-white'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#D7F653]" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
      <span className="max-w-xs">{notice.text}</span>
      <button type="button" onClick={onClose} className="ml-2 opacity-70 hover:opacity-100" aria-label="Cerrar"><X className="w-4 h-4" /></button>
    </div>
  );
}

export default function ClientFinancialDashboard() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(currentPeriod());
  const [client, setClient] = useState(null);
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [costModal, setCostModal] = useState(null); // { type: 'fixed'|'variable', item? }
  const [notice, setNotice] = useState(null);
  const pollCount = useRef(0);

  const notify = useCallback((type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }, []);
  const errText = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

  useEffect(() => {
    clientsAPI.getById(clientId).then((r) => setClient(r.data)).catch(() => {});
  }, [clientId]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const [cur, prev] = await Promise.all([
        growthAPI.getFinancials(clientId, period),
        growthAPI.getFinancials(clientId, prevPeriod(period), { light: true }).catch(() => null),
      ]);
      setData(cur.data);
      setPrevData(prev?.data || null);
    } catch (err) {
      if (!silent) setError(errText(err, 'No pudimos cargar los datos financieros.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clientId, period]);

  useEffect(() => { pollCount.current = 0; load(); }, [load]);

  // Mientras el backend trae pedidos/productos de Shopify, refrescamos en silencio.
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

  // ─── Handlers ───
  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await growthAPI.syncProducts(clientId);
      notify('ok', r.data.message || 'Productos sincronizados.');
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos sincronizar los productos.'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveCost = async (product, cost) => {
    try {
      await growthAPI.updateProductCost(clientId, product.id, cost);
      notify('ok', `Costo de ${product.title} guardado.`);
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos guardar el costo.'));
      throw err;
    }
  };
  const handleResetCost = async (product) => {
    try {
      await growthAPI.resetProductCost(clientId, product.id);
      notify('ok', 'Volvimos al costo de Shopify.');
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos restaurar el costo.'));
    }
  };
  const handleSaveRate = async (rate) => {
    try {
      await growthAPI.updateFinancialSettings(clientId, { default_cogs_rate: rate });
      notify('ok', `Productos sin costo se estiman al ${fmtPct(rate, 0)}.`);
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos guardar el porcentaje.'));
    }
  };

  const handleSaveCostItem = async (type, form) => {
    if (type === 'fixed') {
      if (form.id) await growthAPI.updateFixedCost(clientId, form.id, form);
      else await growthAPI.createFixedCost(clientId, form);
    } else {
      if (form.id) await growthAPI.updateVariableCost(clientId, form.id, form);
      else await growthAPI.createVariableCost(clientId, form);
    }
    notify('ok', 'Costo guardado.');
    await load({ silent: true });
  };
  const handleDeleteCost = async (type, item) => {
    if (!window.confirm(`¿Eliminar "${item.name}"?`)) return;
    try {
      if (type === 'fixed') await growthAPI.deleteFixedCost(clientId, item.id);
      else await growthAPI.deleteVariableCost(clientId, item.id);
      notify('ok', 'Costo eliminado.');
      await load({ silent: true });
    } catch (err) {
      notify('error', errText(err, 'No pudimos eliminar el costo.'));
    }
  };

  // ─── Render ───
  const back = () => navigate('/app/metricas');

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="glass-solid rounded-2xl p-10 text-center max-w-lg mx-auto mt-10">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600">{error}</p>
        <div className="flex justify-center gap-2 mt-5">
          <button type="button" onClick={back} className="btn-ghost text-sm">Volver a Growth</button>
          <button type="button" onClick={() => load()} className="btn-primary text-sm">Reintentar</button>
        </div>
      </div>
    );
  }

  const t = data.totals;
  const hasAny = t.revenue || t.ad_spend || t.fixed_costs || (data.products || []).length;
  const prevLabel = monthShort(prevPeriod(period));
  const deltaSub = prevSameDays ? `vs ${prevLabel} (mismos días)` : null;
  const costsTotalRevenueShare = t.revenue ? ((t.cogs + t.ad_spend + t.variable_costs + t.fixed_costs) / t.revenue) : null;

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      <FinancialHeader client={client} period={period} onPeriodChange={setPeriod} data={data} onSync={handleSync} syncing={syncing} onBack={back} />

      {data.is_future ? (
        <div className="glass-solid rounded-2xl p-10 text-center text-sm text-gray-500">Ese mes todavía no ha empezado.</div>
      ) : !data.shopify?.connected && !hasAny ? (
        <div className="glass-solid rounded-2xl p-10 text-center max-w-xl mx-auto">
          <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-[#17181A]">Conecta Shopify para ver la utilidad real</h2>
          <p className="text-sm text-gray-500 mt-1">Con la tienda conectada traemos ventas, pedidos, productos y el costo de cada uno. Luego cargas los costos fijos y variables de la marca.</p>
          <button type="button" onClick={() => navigate(`/app/clients/${clientId}/plataformas`)} className="btn-primary text-sm mt-5">Conectar Shopify</button>
        </div>
      ) : (
        <>
          <ProfitHero data={data} prev={prevSameDays} />

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

          <ProductsTable data={data} onSaveCost={handleSaveCost} onResetCost={handleResetCost} onSync={handleSync} syncing={syncing} onSaveRate={handleSaveRate} />

          <CostsPanel
            data={data}
            onAdd={(type) => setCostModal({ type })}
            onEdit={(type, item) => setCostModal({ type, item })}
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
