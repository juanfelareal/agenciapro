import React from 'react';
import Info from './Info';
import { fmtMoney, fmtPct, COLORS, AD_SOURCES } from './format';

/**
 * "A dónde se fue la plata": barra apilada de la venta neta (producto, ads, variables, fijos, utilidad)
 * + lista con monto y %, y el estado de resultados como tabla limpia.
 */
export default function MoneyFlow({ data }) {
  const t = data.totals;
  const revenue = Math.max(t.revenue || 0, 0);
  const share = (v) => (revenue ? Math.max(0, v || 0) / revenue : 0);
  const parts = [
    { key: 'cogs', label: 'Costo de producto', value: t.cogs, color: COLORS.cogs, info: 'Lo que costó la mercancía vendida (costo unitario × unidades). Los productos sin costo se estiman.' },
    { key: 'ads', label: 'Inversión en ads', value: t.ad_spend, color: COLORS.ads, info: 'Lo invertido en Meta, Google y TikTok en el mes.' },
    { key: 'variable', label: 'Costos variables', value: t.variable_costs, color: COLORS.variable, info: 'Pasarela, envíos, empaque: crecen con cada venta o pedido.' },
    { key: 'fixed', label: 'Costos fijos', value: t.fixed_costs, color: COLORS.fixed, info: 'Fee, apps, nómina: la parte del mes que corresponde a los días transcurridos.' },
  ];
  const profit = t.net_profit || 0;
  const positive = profit >= 0;
  const costShare = parts.reduce((a, p) => a + share(p.value), 0);
  const scale = costShare > 1 ? 1 / costShare : 1; // si hay pérdida, los costos superan la venta: se escalan para que quepan
  const profitShare = positive ? share(profit) : 0;

  const rows = [
    { label: 'Ventas netas', value: t.revenue, bold: true, info: 'Venta confirmada menos descuentos, devoluciones e impuestos. Es la base de todo el P&L.' },
    { label: '− Costo de producto', value: -t.cogs, muted: true },
    { label: 'Utilidad bruta', value: t.gross_profit, bold: true, pct: t.gross_margin, info: 'Ventas netas menos costo de producto.' },
    { label: '− Inversión en ads', value: -t.ad_spend, muted: true, sources: t.ad_spend_by_source },
    { label: '− Costos variables', value: -t.variable_costs, muted: true },
    { label: '− Costos fijos (prorrateados)', value: -t.fixed_costs, muted: true },
    { label: positive ? 'Utilidad neta' : 'Pérdida neta', value: t.net_profit, result: true, pct: t.margin },
  ];

  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm text-[#17181A]">A dónde se fue la plata</h2>
            <Info text="De cada peso vendido en el mes, qué parte se va en cada costo y qué parte queda como utilidad." />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Porcentajes sobre la venta neta del mes.</p>

          {!revenue ? (
            <p className="text-sm text-gray-400 py-8 text-center">Sin ventas registradas en este mes.</p>
          ) : (
            <div className="mt-4 space-y-3 text-[13px]">
              <div className="flex justify-between font-medium text-[#17181A]"><span>Ventas netas</span><span className="tabular-nums">{fmtMoney(revenue)}</span></div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex gap-[2px]">
                {parts.filter((p) => share(p.value) > 0).map((p) => (
                  <span key={p.key} title={p.label} style={{ width: `${share(p.value) * scale * 100}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
                ))}
                {positive && profitShare > 0 && <span style={{ width: `${profitShare * 100}%`, background: COLORS.profit }} className="h-full rounded-r-full" />}
              </div>
              <ul className="space-y-2 pt-1">
                {parts.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-3 text-gray-600">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: p.color }} />
                      <span className="truncate">{p.label}</span>
                      <Info text={p.info} />
                    </span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="text-[#17181A] font-medium">{fmtMoney(p.value)}</span>
                      <span className="text-gray-400 ml-2 inline-block w-12 text-right">{fmtPct(share(p.value), 0)}</span>
                    </span>
                  </li>
                ))}
                <li className={`flex items-center justify-between gap-3 pt-2 border-t border-gray-100 font-semibold ${positive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: positive ? COLORS.profit : COLORS.loss }} />
                    {positive ? 'Utilidad' : 'Pérdida'}
                  </span>
                  <span className="tabular-nums whitespace-nowrap">
                    {fmtMoney(profit)}
                    <span className="ml-2 inline-block w-12 text-right opacity-80">{fmtPct(t.margin, 0)}</span>
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm text-[#17181A]">Estado de resultados</h2>
            <Info text="El mismo cálculo, línea por línea: de la venta neta se restan los costos hasta llegar a la utilidad." />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{data.is_current_month ? `Del 1 al ${data.days_elapsed} de este mes` : 'Mes completo'} · sin IVA</p>
          <table className="w-full mt-4 text-[13px]">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={`${r.result ? 'border-t-2 border-gray-200' : 'border-t border-gray-100'} ${r.bold || r.result ? 'font-semibold' : ''}`}>
                  <td className={`py-2.5 pr-3 ${r.muted ? 'text-gray-500' : 'text-[#17181A]'}`}>
                    <span className="inline-flex items-center gap-1.5">
                      {r.label}
                      {r.info && <Info text={r.info} />}
                    </span>
                    {r.sources && (
                      <div className="flex gap-x-3 mt-0.5">
                        {AD_SOURCES.filter((s) => (r.sources?.[s.key] || 0) > 0).map((s) => (
                          <span key={s.key} className="inline-flex items-center gap-1 text-[10px] text-gray-400 tabular-nums">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.label} {fmtMoney(r.sources[s.key])}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={`py-2.5 text-right tabular-nums whitespace-nowrap ${r.result ? (r.value >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]') : r.muted ? 'text-gray-500' : 'text-[#17181A]'}`}>
                    {fmtMoney(r.value)}
                    {r.pct !== undefined && <span className="text-gray-400 font-normal ml-2 inline-block w-14 text-right">{fmtPct(r.pct, 1)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
