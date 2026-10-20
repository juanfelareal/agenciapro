import React from 'react';
import Info from './Info';
import { fmtMoney, fmtPct } from './format';

const ALERT_SHARE = 0.15; // si los descuentos pasan del 15 % de la venta bruta, se marca en rojo suave

/**
 * Línea discreta "Venta bruta − descuentos = venta neta" con el % de la venta que se va en descuentos.
 * No muestra nada si el mes no tiene descuentos (0 o null).
 */
export default function DiscountsLine({ totals }) {
  const discounts = Number(totals?.discounts) || 0;
  if (discounts <= 0) return null;
  const revenue = Number(totals?.revenue) || 0;
  const gross = Number(totals?.gross_sales) || revenue + discounts;
  const share = totals?.discount_pct ?? (gross > 0 ? discounts / gross : null);
  const high = share !== null && share > ALERT_SHARE;

  return (
    <div className={`mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] tabular-nums ${high ? 'text-[#b91c1c]' : 'text-gray-500'}`}>
      <span>Venta bruta <strong className={high ? 'text-[#b91c1c]' : 'text-[var(--ink)]'}>{fmtMoney(gross)}</strong></span>
      <span>−</span>
      <span>
        descuentos <strong className={high ? 'text-[#b91c1c]' : 'text-[var(--ink)]'}>{fmtMoney(discounts)}</strong>
        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${high ? 'bg-red-50 text-[#b91c1c]' : 'bg-gray-100 text-gray-600'}`}>{fmtPct(share, 1)}</span>
      </span>
      <span>=</span>
      <span>venta neta <strong className={high ? 'text-[#b91c1c]' : 'text-[var(--ink)]'}>{fmtMoney(revenue)}</strong></span>
      <Info
        align="left"
        text={`Descuentos aplicados en los pedidos pagados del mes (códigos, promociones), ya sin IVA. La venta bruta es lo que se habría vendido sin descuentos. ${high ? `Más del ${Math.round(ALERT_SHARE * 100)} % de la venta se está yendo en descuentos.` : ''}`}
      />
    </div>
  );
}
