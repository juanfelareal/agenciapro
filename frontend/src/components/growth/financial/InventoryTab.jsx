import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, RefreshCw, Search, AlertTriangle, Info, EyeOff, Eye } from 'lucide-react';
import { growthAPI } from '../../../utils/api';
import { fmtMoney, fmtInt } from './format';

const STATUS = {
  sin_stock: { label: 'Sin stock', cls: 'bg-red-100 text-red-700' },
  critico: { label: 'Crítico (< 14 días)', cls: 'bg-orange-100 text-orange-700' },
  bajo: { label: 'Bajo (< 30 días)', cls: 'bg-amber-100 text-amber-700' },
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700' },
  sin_ventas: { label: 'Sin rotación', cls: 'bg-gray-100 text-gray-600' },
  sin_dato: { label: 'Sin dato', cls: 'bg-gray-100 text-gray-500' },
};
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const Card = ({ label, value, sub, tone }) => (
  <div className={`glass-solid rounded-2xl p-4 ${tone === 'bad' ? 'ring-1 ring-red-200' : ''}`}>
    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-xl sm:text-2xl font-bold text-[var(--ink)] tabular-nums break-words mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

/**
 * Pestaña Inventario (laboratorio financiero): existencias por variante sincronizadas con la tienda
 * y proyección de agotamiento según el ritmo de ventas.
 */
export default function InventoryTab({ clientId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [windowDays, setWindowDays] = useState(30);
  const [horizon, setHorizon] = useState(30);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('status');
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await growthAPI.getInventory(clientId, { window: windowDays, horizon, include_hidden: showHidden ? 1 : 0 });
      setData(res.data); setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cargar el inventario');
    } finally { setLoading(false); }
  }, [clientId, windowDays, horizon, showHidden]);
  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    try {
      setSyncing(true);
      await growthAPI.syncInventory(clientId);
      await load({ silent: true });
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo sincronizar el inventario');
    } finally { setSyncing(false); }
  };

  const toggleHidden = async (item) => {
    try {
      await growthAPI.setInventoryHidden(clientId, item.id, !item.hidden);
      await load({ silent: true });
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cambiar la visibilidad');
    }
  };

  const items = useMemo(() => {
    let list = data?.items || [];
    if (status !== 'all') list = list.filter((i) => i.status === status);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((i) => `${i.title} ${i.variant_title || ''} ${i.sku || ''}`.toLowerCase().includes(needle));
    const by = {
      status: null,
      stock: (a, b) => (b.inventory_quantity || 0) - (a.inventory_quantity || 0),
      sales: (a, b) => b.units_30d - a.units_30d,
      days: (a, b) => (a.days_of_stock ?? 9e9) - (b.days_of_stock ?? 9e9),
      restock: (a, b) => b.units_to_restock - a.units_to_restock,
      value: (a, b) => (b.inventory_value_cost || 0) - (a.inventory_value_cost || 0),
    };
    return by[sort] ? [...list].sort(by[sort]) : list;
  }, [data, status, q, sort]);

  const s = data?.summary;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)] flex items-center gap-2"><Package className="w-4 h-4" /> Inventario</h2>
          <p className="text-xs text-gray-500">Existencias de la tienda (se actualizan en cada sincronización de 5 min) · última: {fmtDateTime(s?.synced_at)}</p>
        </div>
        <button type="button" onClick={sync} disabled={syncing} className="btn-ghost text-sm inline-flex items-center gap-1.5">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

      {s && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card label="Unidades en stock" value={fmtInt(s.units_in_stock)} sub={`${fmtInt(s.products)} variantes activas`} />
            <Card label="Valor del inventario (a costo)" value={fmtMoney(s.inventory_value_cost)} sub={`A precio de venta ${fmtMoney(s.inventory_value_price)}`} />
            <Card label={`Vendidas últimos ${s.window_days} días`} value={fmtInt(s.units_sold_30d)} sub="Unidades de pedidos pagados" />
            <Card label="Por reponer" value={`${fmtInt(s.units_to_restock)} und.`} sub={`Para cubrir ${s.horizon_days} días · ${fmtMoney(s.restock_cost)} a costo`} tone={s.units_to_restock > 0 ? 'bad' : undefined} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[['sin_stock', s.sin_stock], ['critico', s.critico], ['bajo', s.bajo], ['sin_ventas', s.sin_ventas]].map(([k, n]) => (
              <button key={k} type="button" onClick={() => setStatus(status === k ? 'all' : k)} className={`px-2.5 py-1 rounded-full font-medium border ${status === k ? 'ring-2 ring-[var(--ink)] ' : ''}${STATUS[k].cls} border-transparent`}>
                {STATUS[k].label}: {n}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="glass-solid rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto, variante o SKU" className="input pl-9 w-full" />
          </div>
          <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className="input w-auto" title="Ventana para calcular el ritmo de ventas">
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Ritmo: últimos {d} días</option>)}
          </select>
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="input w-auto" title="Horizonte para calcular cuánto reponer">
            {[15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>Cubrir {d} días</option>)}
          </select>
          <button type="button" onClick={() => setShowHidden((v) => !v)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm ${showHidden ? 'border-[var(--ink)] bg-[var(--dark)] text-[var(--accent)]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`} title="Ver también los productos ocultos">
            {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} {showHidden ? 'Mostrando ocultos' : `Ocultos${s?.hidden_count ? ` (${s.hidden_count})` : ''}`}
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-auto">
            <option value="status">Orden: urgencia</option>
            <option value="days">Orden: días de inventario</option>
            <option value="sales">Orden: más vendidos</option>
            <option value="stock">Orden: más stock</option>
            <option value="restock">Orden: más por reponer</option>
            <option value="value">Orden: valor en bodega</option>
          </select>
        </div>

        {loading && !data ? (
          <p className="text-sm text-gray-400 py-6 text-center">Cargando inventario…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">{data?.items?.length ? 'Sin resultados con ese filtro.' : 'Aún no hay existencias sincronizadas. Pulsa "Sincronizar ahora".'}</p>
        ) : (
          <>
            {/* Tabla (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 pr-3 font-medium">Producto</th>
                    <th className="text-right py-2 px-2 font-medium">Stock</th>
                    <th className="text-right py-2 px-2 font-medium">Vend. {windowDays}d</th>
                    <th className="text-right py-2 px-2 font-medium">Und./día</th>
                    <th className="text-right py-2 px-2 font-medium">Días inv.</th>
                    <th className="text-right py-2 px-2 font-medium">Se agota</th>
                    <th className="text-right py-2 px-2 font-medium">Reponer</th>
                    <th className="text-right py-2 px-2 font-medium">Valor costo</th>
                    <th className="text-right py-2 pl-2 font-medium">Estado</th>
                    <th className="py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${i.hidden ? 'opacity-50' : ''}`}>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {i.image_url ? <img src={i.image_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-md bg-gray-100 flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--ink)] truncate max-w-[280px]">{i.title}</p>
                            <p className="text-[11px] text-gray-400 truncate">{[i.variant_title, i.sku].filter(Boolean).join(' · ') || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-2 tabular-nums font-semibold">{i.inventory_quantity === null ? '—' : fmtInt(i.inventory_quantity)}</td>
                      <td className="text-right px-2 tabular-nums">{fmtInt(i.units_30d)}</td>
                      <td className="text-right px-2 tabular-nums">{i.units_per_day}</td>
                      <td className="text-right px-2 tabular-nums">{i.days_of_stock === null ? '—' : fmtInt(i.days_of_stock)}</td>
                      <td className="text-right px-2 tabular-nums">{fmtDate(i.stockout_date)}</td>
                      <td className={`text-right px-2 tabular-nums ${i.units_to_restock > 0 ? 'text-orange-700 font-semibold' : 'text-gray-400'}`}>{i.units_to_restock > 0 ? fmtInt(i.units_to_restock) : '—'}</td>
                      <td className="text-right px-2 tabular-nums">{i.inventory_value_cost === null ? '—' : fmtMoney(i.inventory_value_cost)}</td>
                      <td className="text-right pl-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span></td>
                      <td className="pl-2 text-right">
                        <button type="button" onClick={() => toggleHidden(i)} className={`p-1.5 rounded-lg ${i.hidden ? 'text-[var(--accent-deep)] bg-[rgb(var(--accent-rgb)/0.15)]' : 'text-gray-300 hover:text-gray-700 hover:bg-gray-100'}`} title={i.hidden ? 'Volver a mostrar' : 'Ocultar del inventario'}>
                          {i.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Tarjetas (móvil) */}
            <div className="md:hidden divide-y divide-gray-100">
              {items.map((i) => (
                <div key={i.id} className="py-3 flex gap-3">
                  {i.image_url ? <img src={i.image_url} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-md bg-gray-100 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-sm text-[var(--ink)] truncate ${i.hidden ? 'opacity-50' : ''}`}>{i.title}</p>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span>
                        <button type="button" onClick={() => toggleHidden(i)} className="p-1 text-gray-400" title={i.hidden ? 'Volver a mostrar' : 'Ocultar'}>{i.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{[i.variant_title, i.sku].filter(Boolean).join(' · ') || '—'}</p>
                    <p className="text-xs text-gray-600 mt-1">Stock <strong>{i.inventory_quantity === null ? '—' : fmtInt(i.inventory_quantity)}</strong> · {fmtInt(i.units_30d)} vend. · {i.days_of_stock === null ? 'sin ritmo' : `${fmtInt(i.days_of_stock)} días`}{i.stockout_date ? ` · agota ${fmtDate(i.stockout_date)}` : ''}{i.units_to_restock > 0 ? ` · reponer ${fmtInt(i.units_to_restock)}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="text-[11px] text-gray-400 mt-3 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />Días de inventario = stock ÷ unidades vendidas por día (ritmo de la ventana elegida; si no vendió en ese periodo usa el ritmo de 90 días). "Reponer" = lo que falta para cubrir el horizonte elegido con el ritmo actual.</p>
        {s?.sin_dato > 0 && <p className="text-[11px] text-amber-700 mt-1 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{s.sin_dato} variantes no tienen dato de inventario en Shopify (no llevan control de existencias).</p>}
      </div>
    </div>
  );
}
