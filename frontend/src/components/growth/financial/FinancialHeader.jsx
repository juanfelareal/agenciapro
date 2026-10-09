import React from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Store, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Package } from 'lucide-react';
import { monthLabel, prevPeriod, nextPeriod, currentPeriod, fmtRelative, fmtPct } from './format';

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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]} ${onClick ? 'hover:opacity-80 transition' : ''}`}
    >
      {icon}
      {children}
    </Cmp>
  );
};

/**
 * Encabezado: marca, selector de mes, "Día X de Y" y pills de estado de datos
 * (Shopify, productos sincronizados, costo de producto).
 */
export default function FinancialHeader({ client, period, onPeriodChange, data, onSync, syncing, onBack }) {
  const name = client?.nickname || client?.company || client?.name || 'Cliente';
  const isCurrent = period === currentPeriod();
  const days = data?.days_elapsed || 0;
  const total = data?.days_in_month || 30;
  const progress = Math.min(100, Math.round((days / total) * 100));
  const shopify = data?.shopify;
  const missing = data?.missing_cost_count || 0;
  const rate = data?.default_cogs_rate ?? 0.35;

  const cogsPill = (() => {
    if (!data) return null;
    if (!shopify?.connected) return null;
    if (data.cogs_refreshing) return <Pill tone="neutral" icon={<Loader2 className="w-3 h-3 animate-spin" />}>Calculando costo de producto…</Pill>;
    if (data.cogs_status === 'ok' && missing === 0) return <Pill tone="ok" icon={<CheckCircle2 className="w-3 h-3" />}>Costo de producto calculado</Pill>;
    if (missing > 0) return <Pill tone="warn" icon={<AlertTriangle className="w-3 h-3" />} title={data.cogs_message || ''}>{missing} producto{missing > 1 ? 's' : ''} sin costo (estimado al {fmtPct(rate, 0)})</Pill>;
    return <Pill tone="warn" icon={<AlertTriangle className="w-3 h-3" />} title={data.cogs_message || ''}>{data.cogs_status === 'partial' ? 'Costo de producto parcial' : 'Sin costo de producto'}</Pill>;
  })();

  return (
    <div className="glass-solid rounded-2xl px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={onBack} className="mt-1 p-2 -ml-2 rounded-xl hover:bg-black/5 transition" aria-label="Volver">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              {client?.logo_url && <img src={client.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover bg-white border border-gray-100" />}
              <h1 className="text-xl sm:text-2xl font-bold text-[#17181A] tracking-tight truncate">{name}</h1>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">Finanzas</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Cuánto vende, cuánto le cuesta y cuánto le queda a la marca cada mes. Todo sin IVA, con la venta neta como base.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onPeriodChange(prevPeriod(period))} className="p-2 rounded-xl hover:bg-black/5 transition" aria-label="Mes anterior">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <label className="relative">
              <span className="sr-only">Mes</span>
              <input
                type="month"
                value={period}
                max={currentPeriod()}
                onChange={(e) => e.target.value && onPeriodChange(e.target.value)}
                className="input !py-1.5 !px-3 text-sm font-semibold w-full sm:w-[160px] text-center"
              />
            </label>
            <button
              type="button"
              onClick={() => onPeriodChange(nextPeriod(period))}
              disabled={isCurrent}
              className="p-2 rounded-xl hover:bg-black/5 transition disabled:opacity-30"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="w-full lg:w-[232px]">
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <span className="capitalize">{monthLabel(period)}</span>
              <span className="font-semibold text-[#17181A]">Día {days} de {total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-[#D7F653]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
          {shopify?.connected ? (
            <Pill tone={shopify.status === 'error' ? 'bad' : 'ok'} icon={<Store className="w-3 h-3" />} title={shopify.store_url}>
              Shopify conectado{shopify.status === 'error' ? ' · con error' : ''}
            </Pill>
          ) : (
            <Pill tone="neutral" icon={<Store className="w-3 h-3" />}>Shopify no conectado</Pill>
          )}
          {shopify?.connected && (
            <Pill
              tone="neutral"
              icon={syncing || data.products_syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
              onClick={syncing ? undefined : onSync}
              title="Volver a traer el catálogo y los costos de Shopify"
            >
              {data.products_syncing || syncing
                ? 'Sincronizando productos…'
                : data.products_synced_at
                  ? `Productos sincronizados ${fmtRelative(data.products_synced_at)}`
                  : 'Productos sin sincronizar'}
              {!syncing && !data.products_syncing && <RefreshCw className="w-3 h-3 opacity-60" />}
            </Pill>
          )}
          {cogsPill}
        </div>
      )}
    </div>
  );
}
