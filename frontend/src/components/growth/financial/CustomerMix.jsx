import React, { useState } from 'react';
import { UserPlus, Repeat } from 'lucide-react';
import Info from './Info';
import { fmtMoney, fmtPct, fmtInt, monthLabel } from './format';
import { useLedgerQuery } from './useLedgerQuery';
import { LedgerCard, LedgerLoading, LedgerBuilding, LedgerEmpty, LedgerError, UpdatingPill } from './LedgerStates';

const fmtDec = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d).replace('.', ','));

/** 'YYYY-MM' → { start, end } del mes (el backend recorta `end` a hoy). */
const monthRange = (period) => {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}` };
};

function Column({ icon, title, bucket, accent }) {
  const Icon = icon;
  const b = bucket || {};
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
        <span className="inline-flex w-5 h-5 rounded-full items-center justify-center" style={{ background: accent.bg }}>
          <Icon className="w-3 h-3" style={{ color: accent.fg }} strokeWidth={2.4} />
        </span>
        <span className="truncate">{title}</span>
      </div>
      <div className="text-[22px] sm:text-[26px] font-bold tracking-tight leading-none tabular-nums text-[#121314] mt-2">{fmtInt(b.customers)}</div>
      <div className="text-[11px] text-gray-400 mt-1">clientes</div>
      <dl className="mt-3 space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-2"><dt className="text-gray-500">Pedidos</dt><dd className="tabular-nums font-medium text-[#121314]">{fmtInt(b.orders)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-gray-500">Venta neta</dt><dd className="tabular-nums font-medium text-[#121314]">{fmtMoney(b.revenue)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-gray-500">Ticket</dt><dd className="tabular-nums font-medium text-[#121314]">{fmtMoney(b.aov)}</dd></div>
      </dl>
    </div>
  );
}

function Metric({ label, value, sub, info }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
        <span className="truncate">{label}</span>
        <Info text={info} />
      </div>
      <div className="text-[18px] sm:text-[20px] font-bold tracking-tight leading-none tabular-nums text-[#121314] mt-1.5">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-1 leading-snug">{sub}</div>}
    </div>
  );
}

/**
 * "Nuevos vs recurrentes": venta de primera compra vs recompra en el mes, participación, CAC,
 * tasa de recompra y pedidos por cliente. `api` es el adaptador { patterns, customerMix, backfill }.
 */
export default function CustomerMix({ clientId, period, api }) {
  const { start, end } = monthRange(period);
  const [backfilling, setBackfilling] = useState(false);
  const { data, loading, error, reload, pollsExhausted } = useLedgerQuery(`${clientId}|${period}`, () => api.customerMix(clientId, start, end));

  const handleBackfill = async () => {
    setBackfilling(true);
    try { await api.backfill(clientId, 180); reload(); } catch { /* el estado de error lo muestra la tarjeta */ } finally { setBackfilling(false); }
  };

  const hasData = Boolean(data?.new && data?.returning);
  const right = (
    <div className="flex items-center gap-1.5">
      {data?.building && hasData && <UpdatingPill />}
      <span className="text-[11px] text-gray-400">{monthLabel(period)}</span>
    </div>
  );

  let body;
  if (loading && !data) body = <LedgerLoading />;
  else if (error && !data) body = <LedgerError error={error} onRetry={reload} />;
  else if (data?.building && !hasData) body = <LedgerBuilding exhausted={pollsExhausted} onRetry={reload} />;
  else if (!hasData || !data.totals?.orders) {
    body = (
      <LedgerEmpty
        noStore={Boolean(data?.no_store)}
        onBackfill={handleBackfill}
        backfilling={backfilling}
        text={hasData ? `No hay pedidos pagados en ${monthLabel(period).toLowerCase()}.` : undefined}
      />
    );
  } else {
    const newShare = data.new_share_revenue ?? 0;
    const retShare = data.new_share_revenue === null ? 0 : 1 - newShare;
    body = (
      <>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 mt-4">
          <Column icon={UserPlus} title="Clientes nuevos" bucket={data.new} accent={{ bg: '#121314', fg: '#44BF47' }} />
          <Column icon={Repeat} title="Recurrentes" bucket={data.returning} accent={{ bg: '#E3F3E4', fg: '#1E7A30' }} />
        </div>

        <div className="mt-5">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100" role="img" aria-label={`Nuevos ${fmtPct(newShare, 0)} de la venta, recurrentes ${fmtPct(retShare, 0)}`}>
            <div className="h-full bg-[#121314] transition-[width] duration-500" style={{ width: `${Math.round(newShare * 100)}%` }} />
            <div className="h-full bg-[#44BF47] transition-[width] duration-500" style={{ width: `${Math.round(retShare * 100)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 mt-1.5 tabular-nums">
            <span><span className="inline-block w-2 h-2 rounded-[2px] bg-[#121314] mr-1.5 align-middle" />Nuevos {fmtPct(newShare, 0)} de la venta</span>
            <span>Recurrentes {fmtPct(retShare, 0)}<span className="inline-block w-2 h-2 rounded-[2px] bg-[#44BF47] ml-1.5 align-middle" /></span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-5 mt-5 pt-4 border-t border-gray-100">
          <Metric
            label="CAC"
            value={fmtMoney(data.cac)}
            sub={data.cac !== null ? `${fmtMoney(data.ad_spend)} en ads ÷ ${fmtInt(data.new.customers)} nuevos` : (data.ad_spend ? 'Sin clientes nuevos en el mes' : 'Sin inversión en ads registrada')}
            info="Costo de adquirir un cliente: inversión en ads del mes (Meta + Google + TikTok) dividida entre los clientes que compraron por primera vez. Compáralo con la utilidad que deja un cliente en su vida (LTV)."
          />
          <Metric
            label="Tasa de recompra"
            value={fmtPct(data.repeat_rate, 0)}
            sub={data.repeat_rate !== null
              ? <>{fmtInt(data.repeat_customers)} de {fmtInt(data.window_customers)} clientes · {data.repeat_window_days} días{data.days_between_orders_median !== null ? <><br />mediana {fmtInt(data.days_between_orders_median)} días entre compras</> : null}</>
              : 'Sin suficientes datos'}
            info="De los clientes que compraron en los últimos 180 días, qué porcentaje compró dos o más veces. Es la métrica para ponerse metas de LTV: cada punto de recompra vale más que un punto de CAC."
          />
          <Metric
            label="Pedidos por cliente"
            value={fmtDec(data.orders_per_customer, 2)}
            sub={`${fmtInt(data.totals.orders)} pedidos · ${fmtInt(data.totals.customers)} clientes`}
            info="Pedidos del mes dividido entre clientes distintos del mes. Si es 1,0 nadie repitió dentro del mes."
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-3">Venta neta sin IVA ni envío. Un cliente es nuevo cuando ese pedido es su primera compra en la tienda.</p>
      </>
    );
  }

  return (
    <LedgerCard
      title="Nuevos vs recurrentes"
      info="Cuánta venta del mes viene de clientes que compran por primera vez y cuánta de recompra, con el costo de adquisición y la tasa de recompra para fijar metas de LTV."
      right={right}
    >
      {body}
    </LedgerCard>
  );
}
