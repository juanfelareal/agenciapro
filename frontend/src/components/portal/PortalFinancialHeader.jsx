import React from 'react';
import { ChevronLeft, ChevronRight, Store, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Package, FileDown, Lock, FileSpreadsheet } from 'lucide-react';
import { monthLabel, prevPeriod, nextPeriod, currentPeriod, fmtRelative, fmtPct } from '../growth/financial/format';

const Pill = ({ tone = 'neutral', icon, children, onClick, title }) => {
  const tones = {
    neutral: 'bg-white/70 text-gray-600 border-gray-200',
    ok: 'bg-green-50 text-green-700 border-green-100',
    warn: 'bg-amber-50 text-amber-800 border-amber-100',
    bad: 'bg-red-50 text-red-700 border-red-100',
  };
  const Cmp = onClick ? 'button' : 'span';
  return (
    <Cmp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium max-w-full ${tones[tone]} ${onClick ? 'hover:opacity-80 transition' : ''}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Cmp>
  );
};

/**
 * Encabezado del dashboard financiero en el portal del cliente: "Finanzas de {marca}", selector de mes,
 * "Día X de Y", pills de estado de datos y aviso de solo lectura. Sin botón "volver" (el portal tiene su menú).
 */
export default function PortalFinancialHeader({ client, period, onPeriodChange, data, onSync, syncing, onExportPdf, exporting, onExportExcel, exportingExcel, readOnly }) {
  const name = client?.nickname || client?.company || client?.name || 'tu marca';
  const isCurrent = period === currentPeriod();
  const days = data?.days_elapsed || 0;
  const total = data?.days_in_month || 30;
  const progress = Math.min(100, Math.round((days / total) * 100));
  const shopify = data?.shopify;
  const missing = data?.missing_cost_count || 0;
  const rate = data?.default_cogs_rate ?? 0.35;

  const cogsPill = (() => {
    if (!data || !shopify?.connected) return null;
    if (data.cogs_refreshing) return <Pill tone="neutral" icon={<Loader2 className="w-3 h-3 animate-spin shrink-0" />}>Calculando costo de producto…</Pill>;
    if (data.cogs_status === 'ok' && missing === 0) return <Pill tone="ok" icon={<CheckCircle2 className="w-3 h-3 shrink-0" />}>Costo de producto calculado</Pill>;
    if (missing > 0) return <Pill tone="warn" icon={<AlertTriangle className="w-3 h-3 shrink-0" />} title={data.cogs_message || ''}>{missing} producto{missing > 1 ? 's' : ''} sin costo (estimado al {fmtPct(rate, 0)})</Pill>;
    return <Pill tone="warn" icon={<AlertTriangle className="w-3 h-3 shrink-0" />} title={data.cogs_message || ''}>{data.cogs_status === 'partial' ? 'Costo de producto parcial' : 'Sin costo de producto'}</Pill>;
  })();

  return (
    <div className="glass-solid rounded-2xl px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {client?.logo_url && <img src={client.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain bg-white border border-gray-100 shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#121314] tracking-tight break-words">Finanzas de {name}</h1>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">Portal</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Cuánto vendes, cuánto te cuesta y cuánto te queda cada mes. Todo sin IVA, con la venta neta como base.
            </p>
            {readOnly && (
              <p className="no-print inline-flex items-center gap-1.5 mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
                <Lock className="w-3 h-3 shrink-0" /> Solo lectura · pídele a LA REAL activar la edición
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch lg:items-end gap-2.5 shrink-0 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 w-full lg:w-auto">
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                disabled={exporting || !data}
                className="no-print mr-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-[#121314] hover:bg-gray-50 disabled:opacity-50 shrink-0"
                title="Descargar este dashboard como PDF"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{exporting ? 'Generando…' : 'Exportar PDF'}</span>
              </button>
            )}
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                disabled={exportingExcel || !data}
                className="no-print mr-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-[#121314] hover:bg-gray-50 disabled:opacity-50 shrink-0"
                title="Descargar en Excel (resumen, diario, productos y costos)"
              >
                {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{exportingExcel ? 'Generando…' : 'Exportar Excel'}</span>
              </button>
            )}
            <span className="pdf-only text-sm font-semibold text-[#121314] capitalize">{monthLabel(period)}</span>
            <button type="button" onClick={() => onPeriodChange(prevPeriod(period))} className="no-print p-2 rounded-xl hover:bg-black/5 transition shrink-0" aria-label="Mes anterior">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <label className="relative no-print flex-1 min-w-0 lg:flex-none">
              <span className="sr-only">Mes</span>
              <input
                type="month"
                value={period}
                max={currentPeriod()}
                onChange={(e) => e.target.value && onPeriodChange(e.target.value)}
                className="input !py-1.5 !px-3 text-sm font-semibold w-full lg:w-[160px] text-center min-w-0"
              />
            </label>
            <button
              type="button"
              onClick={() => onPeriodChange(nextPeriod(period))}
              disabled={isCurrent}
              className="no-print p-2 rounded-xl hover:bg-black/5 transition disabled:opacity-30 shrink-0"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="w-full lg:w-[232px]">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <span className="capitalize">{monthLabel(period)}</span>
              <span className="font-semibold text-[#121314]">Día {days} de {total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-[#44BF47]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
          {shopify?.connected ? (
            <Pill tone={shopify.status === 'error' ? 'bad' : 'ok'} icon={<Store className="w-3 h-3 shrink-0" />} title={shopify.store_url}>
              {shopify.platform === 'woocommerce' ? 'WooCommerce' : 'Shopify'} conectado{shopify.status === 'error' ? ' · con error' : ''}
            </Pill>
          ) : (
            <Pill tone="neutral" icon={<Store className="w-3 h-3 shrink-0" />}>Tienda no conectada</Pill>
          )}
          {shopify?.connected && (
            <Pill
              tone="neutral"
              icon={syncing || data.products_syncing ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Package className="w-3 h-3 shrink-0" />}
              onClick={syncing ? undefined : onSync}
              title="Volver a traer el catálogo y los costos de la tienda"
            >
              {data.products_syncing || syncing
                ? 'Sincronizando productos…'
                : data.products_synced_at
                  ? `Productos sincronizados ${fmtRelative(data.products_synced_at)}`
                  : 'Productos sin sincronizar'}
              {!syncing && !data.products_syncing && <RefreshCw className="w-3 h-3 opacity-60 inline ml-1" />}
            </Pill>
          )}
          {cogsPill}
        </div>
      )}
    </div>
  );
}
