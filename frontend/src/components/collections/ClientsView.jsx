import { useMemo, useState } from 'react';
import { Send, ChevronRight, Mail, Search, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle } from 'lucide-react';
import { BUCKET_STYLES, formatCurrency, formatDate, statusMeta, daysLabel } from './collectionsUtils';

const SORTS = {
  owed: { label: 'Saldo', get: (c) => Number(c.total_owed || 0) },
  oldest: { label: 'Más antigua', get: (c) => Number(c.oldest_days ?? -1) },
  reminder: { label: 'Último cobro', get: (c) => (c.last_reminder_sent ? new Date(c.last_reminder_sent).getTime() : 0) },
};

const SortIcon = ({ active, dir }) => {
  if (!active) return <ArrowUpDown size={12} className="text-gray-300" />;
  return dir === 'desc' ? <ArrowDown size={12} className="text-[#17181A]" /> : <ArrowUp size={12} className="text-[#17181A]" />;
};

const SortableTh = ({ k, sortKey, sortDir, onToggle, children, className = '' }) => (
  <th className={`px-4 py-3 ${className}`}>
    <button type="button" onClick={() => onToggle(k)} className="inline-flex items-center gap-1 hover:text-[#17181A] transition-colors uppercase tracking-wider">
      {children}
      <SortIcon active={sortKey === k} dir={sortDir} />
    </button>
  </th>
);

// Vista "Por cliente": lista de clientes con saldo pendiente, ordenable y con buscador
const ClientsView = ({ clients = [], onCollect, onOpenDetail }) => {
  const [sortKey, setSortKey] = useState('owed');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? clients.filter((c) => (c.client_name || '').toLowerCase().includes(q) || (c.client_email || '').toLowerCase().includes(q))
      : clients;
    const getter = SORTS[sortKey].get;
    return [...filtered].sort((a, b) => {
      const diff = getter(a) - getter(b);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [clients, sortKey, sortDir, search]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir(key === 'reminder' ? 'asc' : 'desc'); }
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#17181A]">Clientes con saldo pendiente</h2>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length} de {clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-60 focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
          />
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-600">No hay cartera pendiente</p>
          <p className="text-sm text-gray-400 mt-1">Todas las facturas están al día</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-gray-400">Ningún cliente coincide con "{search}"</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50/70 text-xs text-gray-500 text-left">
                <th className="px-6 py-3 uppercase tracking-wider">Cliente</th>
                <th className="px-4 py-3 uppercase tracking-wider text-center"># Fact.</th>
                <SortableTh k="oldest" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort}>Más antigua</SortableTh>
                <th className="px-4 py-3 uppercase tracking-wider">Promesa</th>
                <th className="px-4 py-3 uppercase tracking-wider">Estado de cobro</th>
                <SortableTh k="reminder" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort}>Último cobro</SortableTh>
                <SortableTh k="owed" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} className="text-right">Saldo</SortableTh>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((client) => {
                const bucket = client.aging_bucket;
                const bStyle = bucket ? BUCKET_STYLES[bucket] : null;
                const status = statusMeta(client.collection_status);
                return (
                  <tr key={client.client_id} className="hover:bg-white/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <button type="button" onClick={() => onOpenDetail(client.client_id)} className="text-left">
                        <p className="text-sm font-semibold text-[#17181A] hover:underline">{client.client_name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[220px]">{client.client_email || 'Sin email'}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 text-center">{client.invoice_count}</td>
                    <td className="px-4 py-3.5">
                      {bStyle ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${bStyle.badge}`}>{daysLabel(client.oldest_days)}</span>
                      ) : <span className="text-xs text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{client.promise_date ? formatDate(client.promise_date) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {client.last_reminder_sent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          <Mail size={12} />
                          {formatDate(client.last_reminder_sent)}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">Sin cobro</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-base font-bold text-[#17181A] whitespace-nowrap">{formatCurrency(client.total_owed)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCollect(client)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#17181A] text-[#D7F653] text-xs font-medium hover:bg-[#2D2D4E] transition-colors"
                          title="Enviar estado de cuenta"
                        >
                          <Send size={13} />
                          Cobrar
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDetail(client.client_id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#17181A] hover:bg-gray-100 transition-colors"
                          title="Ver detalle"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ClientsView;
