import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import Info from './Info';
import { fmtPct } from './format';

/** Tarjeta que agrupa KPIs separados por líneas (2 columnas en móvil, `cols` en escritorio). */
export function StatGroup({ cols = 4, children, className = '' }) {
  const grid = cols === 3 ? 'lg:grid-cols-3' : cols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-4';
  return (
    <div className={`glass-solid rounded-2xl px-2 py-1 lg:px-4 lg:py-3 ${className}`}>
      <div className={`grid grid-cols-2 ${grid} lg:divide-x lg:divide-gray-100`}>
        {children}
      </div>
    </div>
  );
}

/** Pill de variación: flecha + porcentaje. `invert` cuando subir es malo (costos). */
export function DeltaPill({ delta, invert = false, className = '' }) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
  const flat = Math.abs(delta) < 0.005;
  const good = invert ? delta < 0 : delta > 0;
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const cls = flat ? 'bg-gray-100 text-gray-500' : good ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-[3px] text-[11px] font-semibold ${cls} ${className}`}>
      <Icon className="w-3 h-3" strokeWidth={2.2} />
      {fmtPct(Math.abs(delta), 0)}
    </span>
  );
}

/**
 * Celda de métrica: label + Info, número grande, pill de delta y subtexto.
 * - `tone: 'auto'` colorea por signo de `raw` (verde utilidad / rojo pérdida).
 * - `invertDelta` para costos (subir es malo).
 */
export default function StatCard({
  label, value, raw, delta, sub, info, tone = 'neutral', invertDelta = false, size = 'md', className = '',
}) {
  const color = tone === 'auto' && typeof raw === 'number'
    ? (raw > 0 ? 'text-[#16a34a]' : raw < 0 ? 'text-[#dc2626]' : 'text-[#17181A]')
    : 'text-[#17181A]';
  const sizeCls = size === 'lg' ? 'text-[26px] sm:text-[30px]' : 'text-[20px] sm:text-[24px]';
  return (
    <div className={`flex flex-col px-3 py-3 lg:px-5 lg:py-2 min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
        <span className="leading-snug truncate">{label}</span>
        <Info text={info} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1.5">
        <span className={`font-bold tracking-tight leading-none tabular-nums ${sizeCls} ${color}`}>{value}</span>
        <DeltaPill delta={delta} invert={invertDelta} />
      </div>
      {sub && <div className="text-[11px] text-gray-400 mt-1.5 leading-snug">{sub}</div>}
    </div>
  );
}
