import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Package, RefreshCw, Search, Pencil, Check, X, RotateCcw, AlertTriangle, Loader2, ArrowUpDown } from 'lucide-react';
import Info from './Info';
import { fmtMoney, fmtInt, fmtPctNum, fmtPct, fmtRelative } from './format';

const SORTS = [
  { key: 'revenue', label: 'Más vendidos ($)' },
  { key: 'units', label: 'Más unidades' },
  { key: 'margin', label: 'Mejor margen' },
  { key: 'margin_asc', label: 'Peor margen' },
];

const MarginPill = ({ margin, estimated }) => {
  if (margin === null || margin === undefined) return <span className="text-gray-300">—</span>;
  const cls = margin > 0 ? 'bg-green-50 text-green-700' : margin < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold tabular-nums ${cls}`}>
      {fmtPctNum(margin, 0)}{estimated && <span className="opacity-70 font-medium">est.</span>}
    </span>
  );
};

const SourceChip = ({ source, estimated }) => {
  if (estimated) return <span className="inline-flex rounded-full bg-amber-50 text-amber-700 px-1.5 py-[1px] text-[10px] font-semibold">Estimado</span>;
  return source === 'manual'
    ? <span className="inline-flex rounded-full bg-[#17181A] text-[#D7F653] px-1.5 py-[1px] text-[10px] font-semibold">Manual</span>
    : <span className="inline-flex rounded-full bg-gray-100 text-gray-600 px-1.5 py-[1px] text-[10px] font-semibold">Shopify</span>;
};

/** Celda de costo unitario editable inline, con origen y botón para volver al costo de Shopify. */
function CostCell({ product, onSave, onReset, defaultRate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  const start = () => { setValue(product.cost ?? ''); setEditing(true); };
  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    setBusy(true);
    try { await onSave(product, n); setEditing(false); } finally { setBusy(false); }
  };
  const reset = async () => { setBusy(true); try { await onReset(product); } finally { setBusy(false); } };

  if (!product.in_catalog) {
    return <div className="text-right text-[11px] text-gray-400">No está en el catálogo<br />estimado {fmtPct(defaultRate, 0)}</div>;
  }
  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <input
          ref={ref}
          type="number" min="0" step="1" inputMode="numeric"
          className="input !py-1 !px-2 w-28 text-right tabular-nums"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          disabled={busy}
        />
        <button type="button" onClick={save} disabled={busy} className="p-1.5 rounded-lg bg-[#17181A] text-white" aria-label="Guardar">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}</button>
        <button type="button" onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cancelar"><X className="w-3.5 h-3.5 text-gray-500" /></button>
      </div>
    );
  }
  const hasCost = !product.cost_estimated;
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={start} className="group inline-flex flex-col items-end gap-0.5 rounded-lg px-2 py-1 hover:bg-gray-50 transition text-right" title="Editar costo">
        <span className={`inline-flex items-center gap-1.5 tabular-nums font-semibold text-[13px] ${hasCost ? 'text-[#17181A]' : 'text-amber-600'}`}>
          {hasCost ? fmtMoney(product.cost) : 'Sin costo'}
          <Pencil className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
        </span>
        <span className="inline-flex items-center gap-1">
          <SourceChip source={product.cost_source} estimated={!hasCost} />
          {!hasCost && product.price ? <span className="text-[10px] text-gray-400">≈ {fmtMoney(product.price * defaultRate)}</span> : null}
        </span>
      </button>
      {product.cost_source === 'manual' && (
        <button type="button" onClick={reset} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700" title={product.shopify_cost !== null ? `Volver al costo de Shopify (${fmtMoney(product.shopify_cost)})` : 'Volver al costo de Shopify (sin costo allá)'}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

/**
 * Productos del mes: imagen, título/variante, SKU, precio, costo editable, unidades, ventas,
 * costo total, utilidad y margen. Filtros "sin costo" y "solo vendidos", orden y sync con Shopify.
 */
export default function ProductsTable({ data, onSaveCost, onResetCost, onSync, syncing, onSaveRate }) {
  const products = useMemo(() => data?.products || [], [data]);
  const defaultRate = data?.default_cogs_rate ?? 0.35;
  const [sort, setSort] = useState('revenue');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlySold, setOnlySold] = useState(true);
  const [search, setSearch] = useState('');
  const [rateEdit, setRateEdit] = useState(null);

  const missingSold = useMemo(() => products.filter((p) => p.cost_estimated && p.units > 0), [products]);
  const estimatedShare = data?.totals?.cogs ? (data.totals.cogs_estimated || 0) / data.totals.cogs : 0;

  const visible = useMemo(() => {
    let list = products;
    if (onlyMissing) list = list.filter((p) => p.cost_estimated);
    if (onlySold) list = list.filter((p) => p.units !== 0 || p.revenue !== 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => `${p.title} ${p.variant_title || ''} ${p.sku || ''}`.toLowerCase().includes(q));
    }
    const m = (p) => (p.margin_pct === null || p.margin_pct === undefined ? -Infinity : p.margin_pct);
    const sorted = [...list];
    if (sort === 'units') sorted.sort((a, b) => b.units - a.units || b.revenue - a.revenue);
    else if (sort === 'margin') sorted.sort((a, b) => m(b) - m(a) || b.revenue - a.revenue);
    else if (sort === 'margin_asc') sorted.sort((a, b) => m(a) - m(b) || b.revenue - a.revenue);
    else sorted.sort((a, b) => b.revenue - a.revenue || b.units - a.units);
    return sorted;
  }, [products, onlyMissing, onlySold, search, sort]);

  const totals = useMemo(() => visible.reduce((t, p) => ({ units: t.units + (p.units || 0), revenue: t.revenue + (p.revenue || 0), cogs: t.cogs + (p.cogs || 0), gross: t.gross + (p.gross_profit || 0) }), { units: 0, revenue: 0, cogs: 0, gross: 0 }), [visible]);
  const meta = (p) => [p.variant_title, p.sku].filter(Boolean).join(' · ');
  const shopifyConnected = !!data?.shopify?.connected;

  return (
    <div className="glass-solid rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm text-[#17181A]">Productos y costo de producto</h2>
            <Info text="Qué se vendió en el mes, cuánto costó cada unidad y cuánto dejó cada producto antes de ads y fijos." />
          </div>
          <p className="text-xs text-gray-400 mt-0.5 max-w-xl">
            El costo unitario sale del que registras en Shopify en cada variante (Productos → variante → Inventario → <em>Costo por artículo</em>).
            Si allá no está, puedes escribirlo aquí y queda como <strong className="text-gray-600">Manual</strong>; mientras no exista, se estima al {fmtPct(defaultRate, 0)} de la venta.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {shopifyConnected && (
            <button type="button" onClick={onSync} disabled={syncing} className="btn-secondary !py-2 !px-3 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando…' : 'Sincronizar productos de Shopify'}
            </button>
          )}
        </div>
      </div>

      {missingSold.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1 text-[13px] text-amber-900">
            <strong>{missingSold.length} producto{missingSold.length > 1 ? 's' : ''} vendido{missingSold.length > 1 ? 's' : ''} sin costo</strong> ({fmtPct(estimatedShare, 0)} del costo de producto del mes es estimado).
            {' '}Se estiman al{' '}
            {rateEdit === null ? (
              <button type="button" onClick={() => setRateEdit(String(Math.round(defaultRate * 100)))} className="underline font-semibold">{fmtPct(defaultRate, 0)}</button>
            ) : (
              <span className="inline-flex items-center gap-1 align-middle">
                <input type="number" min="0" max="95" className="input !py-0.5 !px-2 w-16 text-right tabular-nums" value={rateEdit} onChange={(e) => setRateEdit(e.target.value)} />%
                <button type="button" className="p-1 rounded bg-[#17181A] text-white" onClick={async () => { await onSaveRate(Number(rateEdit) / 100); setRateEdit(null); }} aria-label="Guardar"><Check className="w-3 h-3" /></button>
                <button type="button" className="p-1 rounded hover:bg-amber-100" onClick={() => setRateEdit(null)} aria-label="Cancelar"><X className="w-3 h-3" /></button>
              </span>
            )}
            {' '}de la venta. La utilidad real puede ser distinta.
          </div>
          <button type="button" onClick={() => { setOnlyMissing(true); setOnlySold(true); }} className="btn-primary !py-2 !px-3 text-xs whitespace-nowrap">Cargar costos</button>
        </div>
      )}

      {!products.length ? (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          {shopifyConnected ? (
            <>
              <p className="text-sm text-gray-600 font-medium">Todavía no hay productos sincronizados</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Traemos el catálogo de Shopify con el costo por artículo de cada variante.</p>
              <button type="button" onClick={onSync} disabled={syncing} className="btn-primary !py-2 text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Sincronizando…' : 'Sincronizar productos de Shopify'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 font-medium">Conecta Shopify para traer los productos</p>
              <p className="text-xs text-gray-400 mt-1">Sin la tienda conectada no podemos calcular el costo de producto.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <label className="relative flex-1 min-w-[160px] sm:flex-none">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input !pl-9 !py-2 w-full sm:w-52 text-sm" placeholder="Buscar producto o SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium">
              <button type="button" onClick={() => setOnlySold(true)} className={`px-3 py-1.5 rounded-md transition ${onlySold ? 'bg-white text-[#17181A] shadow-sm' : 'text-gray-500'}`}>Vendidos este mes</button>
              <button type="button" onClick={() => setOnlySold(false)} className={`px-3 py-1.5 rounded-md transition ${!onlySold ? 'bg-white text-[#17181A] shadow-sm' : 'text-gray-500'}`}>Todo el catálogo</button>
            </div>
            <button type="button" onClick={() => setOnlyMissing((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${onlyMissing ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              <AlertTriangle className="w-3.5 h-3.5" /> Sin costo{onlyMissing ? ` (${visible.length})` : ''}
            </button>
            <label className="relative inline-flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
              <select className="input !py-1.5 !pl-8 !pr-8 w-auto text-xs" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <span className="text-xs text-gray-400 ml-auto">{visible.length} de {products.length}{data?.products_synced_at ? ` · sincronizado ${fmtRelative(data.products_synced_at)}` : ''}</span>
          </div>

          {/* Escritorio */}
          <div className="hidden md:block overflow-x-auto mt-3">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-2 pr-3">Producto</th>
                  <th className="text-right font-medium py-2 px-3">Precio</th>
                  <th className="text-right font-medium py-2 px-3"><span className="inline-flex items-center gap-1">Costo unitario <Info text="Lo que te cuesta una unidad. Clic para editar; el chip dice de dónde sale." /></span></th>
                  <th className="text-right font-medium py-2 px-3"><span className="inline-flex items-center gap-1">Unidades <Info text="Unidades vendidas en el mes (restando devoluciones)." /></span></th>
                  <th className="text-right font-medium py-2 px-3">Ventas</th>
                  <th className="text-right font-medium py-2 px-3"><span className="inline-flex items-center gap-1">Costo total <Info text="Costo unitario × unidades del mes." /></span></th>
                  <th className="text-right font-medium py-2 px-3">Utilidad</th>
                  <th className="text-right font-medium py-2 pl-3"><span className="inline-flex items-center gap-1">Margen <Info text="(Ventas − costo de producto) ÷ ventas. No incluye ads ni fijos." align="right" /></span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id ?? p.shopify_variant_id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-gray-300" /></div>}
                        <div className="min-w-0">
                          <div className="font-medium text-[#17181A] truncate max-w-[280px]" title={p.title}>{p.title}</div>
                          <div className="text-[11px] text-gray-400 truncate">{meta(p) || (p.status && p.status !== 'active' ? p.status : '')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-500 tabular-nums">{p.price !== null ? fmtMoney(p.price) : '—'}</td>
                    <td className="py-2.5 px-3"><CostCell product={p} onSave={onSaveCost} onReset={onResetCost} defaultRate={defaultRate} /></td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtInt(p.units)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#17181A] tabular-nums">{fmtMoney(p.revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500 tabular-nums">{fmtMoney(p.cogs)}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${p.gross_profit > 0 ? 'text-[#16a34a]' : p.gross_profit < 0 ? 'text-[#dc2626]' : 'text-gray-500'}`}>{fmtMoney(p.gross_profit)}</td>
                    <td className="py-2.5 pl-3 text-right"><MarginPill margin={p.margin_pct} estimated={p.cost_estimated} /></td>
                  </tr>
                ))}
              </tbody>
              {visible.length > 1 && (
                <tfoot>
                  <tr className="font-semibold text-[#17181A] border-t-2 border-gray-200">
                    <td className="py-2.5 pr-3">Total ({visible.length})</td>
                    <td /><td />
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtInt(totals.units)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmtMoney(totals.revenue)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-500">{fmtMoney(totals.cogs)}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums ${totals.gross >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{fmtMoney(totals.gross)}</td>
                    <td className="py-2.5 pl-3 text-right"><MarginPill margin={totals.revenue ? (totals.gross / totals.revenue) * 100 : null} /></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Móvil */}
          <div className="md:hidden mt-3 divide-y divide-gray-100">
            {visible.map((p) => (
              <div key={p.id ?? p.shopify_variant_id} className="py-3.5 flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  {p.image_url ? <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-gray-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-[#17181A] truncate">{p.title}</div>
                    <div className="text-[11px] text-gray-400 truncate">{meta(p)}</div>
                  </div>
                  <MarginPill margin={p.margin_pct} estimated={p.cost_estimated} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 tabular-nums">
                  <span>{fmtInt(p.units)} u · <span className="text-[#17181A] font-semibold">{fmtMoney(p.revenue)}</span> · utilidad <span className={p.gross_profit >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}>{fmtMoney(p.gross_profit)}</span></span>
                </div>
                <CostCell product={p} onSave={onSaveCost} onReset={onResetCost} defaultRate={defaultRate} />
              </div>
            ))}
          </div>
          {!visible.length && <p className="text-sm text-gray-400 text-center py-8">Nada que mostrar con ese filtro.</p>}
        </>
      )}
    </div>
  );
}
