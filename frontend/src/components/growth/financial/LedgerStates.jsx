import React from 'react';
import { Loader2, Database, AlertTriangle, Store } from 'lucide-react';
import Info from './Info';

/** Tarjeta con encabezado estándar: título + Info + controles a la derecha. */
export function LedgerCard({ title, info, right, children, className = '' }) {
  return (
    <div className={`glass-solid rounded-2xl p-5 sm:p-6 flex flex-col min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h2 className="font-semibold text-sm text-[#17181A]">{title}</h2>
          <Info text={info} />
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Grupo de pastillas (30/60/90, Venta/Pedidos). */
export function PillGroup({ options, value, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-full bg-gray-100 p-0.5 text-[11px] font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-full transition ${value === o.value ? 'bg-[#17181A] text-[#D7F653]' : 'text-gray-500 hover:text-[#17181A]'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LedgerLoading() {
  return (
    <div className="flex items-center justify-center py-14">
      <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
    </div>
  );
}

export function LedgerBuilding({ exhausted = false, onRetry }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="relative">
        <Database className="w-7 h-7 text-gray-300" />
        {!exhausted && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#16a34a] absolute -right-1.5 -bottom-1" />}
      </div>
      <p className="text-sm font-medium text-[#17181A] mt-3">Construyendo el histórico de pedidos…</p>
      <p className="text-[12px] text-gray-500 mt-1 max-w-xs">
        Estamos trayendo los últimos 180 días de la tienda. Suele tardar un par de minutos; esta tarjeta se actualiza sola.
      </p>
      {exhausted && onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost text-xs mt-4">Volver a revisar</button>
      )}
    </div>
  );
}

export function LedgerEmpty({ noStore = false, onBackfill, backfilling = false, text }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      {noStore ? <Store className="w-7 h-7 text-gray-300" /> : <Database className="w-7 h-7 text-gray-300" />}
      <p className="text-sm font-medium text-[#17181A] mt-3">{noStore ? 'Conecta la tienda para ver este análisis' : 'Todavía no hay pedidos en el histórico'}</p>
      <p className="text-[12px] text-gray-500 mt-1 max-w-xs">
        {text || (noStore
          ? 'Con Shopify o WooCommerce conectado leemos la fecha y hora de cada pedido y quién lo hizo.'
          : 'Si la tienda sí tiene ventas, podemos volver a traer el histórico de los últimos 180 días.')}
      </p>
      {!noStore && onBackfill && (
        <button type="button" onClick={onBackfill} disabled={backfilling} className="btn-ghost text-xs mt-4 inline-flex items-center gap-1.5">
          {backfilling && <Loader2 className="w-3 h-3 animate-spin" />}
          Traer histórico
        </button>
      )}
    </div>
  );
}

export function LedgerError({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <AlertTriangle className="w-6 h-6 text-red-500" />
      <p className="text-[12px] text-gray-500 mt-2 max-w-xs">{error}</p>
      {onRetry && <button type="button" onClick={onRetry} className="btn-ghost text-xs mt-4">Reintentar</button>}
    </div>
  );
}

/** Pastilla discreta: el histórico sigue actualizándose en segundo plano. */
export function UpdatingPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 px-2 py-[3px] text-[10px] font-medium">
      <Loader2 className="w-3 h-3 animate-spin" /> Actualizando histórico
    </span>
  );
}
