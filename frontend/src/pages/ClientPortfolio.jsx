import { useState, useMemo } from 'react';
import { clientsAPI } from '../utils/api';
import { TrendingUp, DollarSign, Users, Award, Percent, ChevronDown, X, Save } from 'lucide-react';

const TIPOS_NEGOCIACION = [
  'Growth',
  'Growth con potencial',
  'Growth mal negociado',
  'Fee bien negociado',
  'Fee mensual',
];

const ESTADOS_ACTUAL = [
  'Comenzando',
  'Rentable buen crecimiento',
  'Poco rentable',
  'En la cuerda floja',
  'Rentable sin crecimiento',
  'Rentable bajo crecimiento',
];

const TIPO_COLORS = {
  'Growth': '#10B981',
  'Growth con potencial': '#3B82F6',
  'Growth mal negociado': '#F59E0B',
  'Fee bien negociado': '#8B5CF6',
  'Fee mensual': '#6B7280',
};

const ESTADO_CONFIG = {
  'Comenzando': { color: '#3B82F6', bg: '#EFF6FF', icon: '🚀' },
  'Rentable buen crecimiento': { color: '#10B981', bg: '#ECFDF5', icon: '📈' },
  'Poco rentable': { color: '#F59E0B', bg: '#FFFBEB', icon: '⚠️' },
  'En la cuerda floja': { color: '#EF4444', bg: '#FEF2F2', icon: '🔥' },
  'Rentable sin crecimiento': { color: '#8B5CF6', bg: '#F5F3FF', icon: '📊' },
  'Rentable bajo crecimiento': { color: '#6366F1', bg: '#EEF2FF', icon: '📉' },
};

const formatCurrency = (val) => {
  if (!val) return '$0';
  return '$' + Number(val).toLocaleString('es-CO', { maximumFractionDigits: 0 });
};

const ClientPortfolio = ({ clients, onClientUpdated }) => {
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');

  const activeClients = useMemo(() =>
    clients.filter(c => c.status === 'active'),
    [clients]
  );

  const filteredClients = useMemo(() => {
    let result = activeClients;
    if (filterTipo !== 'all') result = result.filter(c => c.tipo_negociacion === filterTipo);
    if (filterEstado !== 'all') result = result.filter(c => c.estado_actual === filterEstado);
    return result;
  }, [activeClients, filterTipo, filterEstado]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = activeClients.length;
    const facturacionFija = activeClients
      .filter(c => c.valor_contratado > 0)
      .reduce((sum, c) => sum + (c.valor_contratado || 0), 0);
    const ticketPromedio = total > 0 ? facturacionFija / total : 0;
    const topCliente = activeClients.reduce((top, c) =>
      (c.valor_contratado || 0) > (top?.valor_contratado || 0) ? c : top
    , null);
    const conComision = activeClients.filter(c => c.has_comision).length;
    const pctComision = total > 0 ? Math.round((conComision / total) * 100) : 0;

    return { total, facturacionFija, ticketPromedio, topCliente, conComision, pctComision };
  }, [activeClients]);

  // Donut chart data
  const tipoDistribution = useMemo(() => {
    const counts = {};
    activeClients.forEach(c => {
      const tipo = c.tipo_negociacion || 'Sin clasificar';
      counts[tipo] = (counts[tipo] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / activeClients.length) * 100) || 0,
      color: TIPO_COLORS[name] || '#9CA3AF',
    }));
  }, [activeClients]);

  // Estado distribution
  const estadoDistribution = useMemo(() => {
    const counts = {};
    activeClients.forEach(c => {
      const estado = c.estado_actual || 'Sin clasificar';
      counts[estado] = (counts[estado] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      config: ESTADO_CONFIG[name] || { color: '#9CA3AF', bg: '#F3F4F6', icon: '❓' },
    }));
  }, [activeClients]);

  // Bar chart: clients sorted by valor_contratado
  const sortedByValor = useMemo(() =>
    [...filteredClients]
      .filter(c => c.valor_contratado > 0)
      .sort((a, b) => (b.valor_contratado || 0) - (a.valor_contratado || 0)),
    [filteredClients]
  );

  const maxValor = sortedByValor[0]?.valor_contratado || 1;

  // Risk zone: clients with bad estado
  const riskClients = useMemo(() =>
    activeClients.filter(c =>
      ['En la cuerda floja', 'Poco rentable'].includes(c.estado_actual)
    ),
    [activeClients]
  );

  const handleEditClient = (client) => {
    setEditingClient(client.id);
    setEditForm({
      tipo_negociacion: client.tipo_negociacion || '',
      estado_actual: client.estado_actual || '',
      valor_contratado: client.valor_contratado || 0,
      has_comision: client.has_comision ? true : false,
    });
  };

  const handleSaveClient = async (clientId) => {
    setSaving(true);
    try {
      await clientsAPI.update(clientId, editForm);
      onClientUpdated();
      setEditingClient(null);
    } catch (error) {
      console.error('Error updating client:', error);
    } finally {
      setSaving(false);
    }
  };

  // Donut SVG
  const DonutChart = ({ data }) => {
    const total = data.reduce((s, d) => s + d.count, 0);
    if (total === 0) return null;
    const size = 160;
    const strokeWidth = 28;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
      <div className="flex items-center gap-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {data.map((d, i) => {
            const pct = d.count / total;
            const dashLength = pct * circumference;
            const dashOffset = -offset;
            offset += dashLength;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          })}
          <text x={size / 2} y={size / 2 - 8} textAnchor="middle" className="text-2xl font-bold fill-[#1A1A2E]" fontSize="24">{total}</text>
          <text x={size / 2} y={size / 2 + 12} textAnchor="middle" className="fill-gray-400" fontSize="11">clientes</text>
        </svg>
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600">{d.name}</span>
              <span className="font-semibold text-[#1A1A2E] ml-auto">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#10B981]/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#10B981]" />
            </div>
            <span className="text-sm text-gray-500">Facturación Fija</span>
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{formatCurrency(kpis.facturacionFija)}</p>
          <p className="text-xs text-gray-400 mt-1">mensual contratada</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-gray-500">Total Clientes</span>
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{kpis.total}</p>
          <p className="text-xs text-gray-400 mt-1">activos</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-sm text-gray-500">Ticket Promedio</span>
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{formatCurrency(kpis.ticketPromedio)}</p>
          <p className="text-xs text-gray-400 mt-1">por cliente</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Percent className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-gray-500">Con Comisión</span>
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{kpis.conComision} <span className="text-base font-normal text-gray-400">({kpis.pctComision}%)</span></p>
          <p className="text-xs text-gray-400 mt-1">de {kpis.total} clientes</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut: Tipo de Negociación */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-[#1A1A2E] mb-4">Tipo de Negociación</h3>
          <DonutChart data={tipoDistribution} />
        </div>

        {/* Estado Actual Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-[#1A1A2E] mb-4">Estado Actual</h3>
          <div className="space-y-2.5">
            {estadoDistribution.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg flex-shrink-0">{d.config.icon}</span>
                <span className="text-sm text-gray-700 flex-1">{d.name}</span>
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: d.config.bg, color: d.config.color }}
                >
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-500 mr-1">Filtrar:</span>
        <button
          onClick={() => { setFilterTipo('all'); setFilterEstado('all'); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterTipo === 'all' && filterEstado === 'all'
              ? 'bg-[#1A1A2E] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos ({activeClients.length})
        </button>
        {TIPOS_NEGOCIACION.map(tipo => {
          const count = activeClients.filter(c => c.tipo_negociacion === tipo).length;
          if (count === 0) return null;
          return (
            <button
              key={tipo}
              onClick={() => { setFilterTipo(filterTipo === tipo ? 'all' : tipo); setFilterEstado('all'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterTipo === tipo
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={filterTipo === tipo ? { backgroundColor: TIPO_COLORS[tipo] } : {}}
            >
              {tipo} ({count})
            </button>
          );
        })}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {ESTADOS_ACTUAL.map(estado => {
          const count = activeClients.filter(c => c.estado_actual === estado).length;
          if (count === 0) return null;
          const cfg = ESTADO_CONFIG[estado];
          return (
            <button
              key={estado}
              onClick={() => { setFilterEstado(filterEstado === estado ? 'all' : estado); setFilterTipo('all'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterEstado === estado
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
              style={filterEstado === estado
                ? { backgroundColor: cfg.color }
                : { backgroundColor: cfg.bg }
              }
            >
              {cfg.icon} {estado} ({count})
            </button>
          );
        })}
      </div>

      {/* Bar Chart: Valor Contratado */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-semibold text-[#1A1A2E] mb-4">Valor Contratado por Cliente</h3>
        {sortedByValor.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No hay clientes con valor contratado asignado</p>
        ) : (
          <div className="space-y-2">
            {sortedByValor.map(client => {
              const pct = ((client.valor_contratado || 0) / maxValor) * 100;
              const tipoColor = TIPO_COLORS[client.tipo_negociacion] || '#9CA3AF';
              return (
                <div key={client.id} className="flex items-center gap-3 group">
                  <div className="w-40 flex-shrink-0 text-sm text-gray-700 truncate" title={client.nickname || client.company || client.name}>
                    {client.nickname || client.company || client.name}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-2 transition-all duration-500"
                      style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: tipoColor }}
                    >
                      <span className="text-xs font-semibold text-white whitespace-nowrap">
                        {formatCurrency(client.valor_contratado)}
                      </span>
                    </div>
                  </div>
                  {client.has_comision ? (
                    <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md font-medium flex-shrink-0">%</span>
                  ) : (
                    <span className="w-6 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Risk Zone */}
      {riskClients.length > 0 && (
        <div className="bg-red-50/50 rounded-2xl border border-red-100 p-6">
          <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span>🔥</span> Zona de Riesgo
            <span className="text-xs font-normal bg-red-100 text-red-600 px-2 py-0.5 rounded-lg ml-2">{riskClients.length} clientes</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {riskClients.map(client => {
              const cfg = ESTADO_CONFIG[client.estado_actual] || {};
              return (
                <div key={client.id} className="bg-white rounded-xl p-4 border border-red-100 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1A1A2E]">{client.nickname || client.company || client.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded-lg font-medium"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {client.estado_actual}
                      </span>
                      {client.tipo_negociacion && (
                        <span className="text-xs text-gray-400">{client.tipo_negociacion}</span>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-[#1A1A2E]">{formatCurrency(client.valor_contratado)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Client Detail Table (editable) */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-[#1A1A2E]">Detalle de Clientes</h3>
          <span className="text-sm text-gray-400">{filteredClients.length} clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo Negociación</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado Actual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Contratado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comisión</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredClients.map(client => {
                const isEditing = editingClient === client.id;
                const estadoCfg = ESTADO_CONFIG[client.estado_actual] || { color: '#9CA3AF', bg: '#F3F4F6', icon: '' };
                return (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E]">
                      {client.nickname || client.company || client.name}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.tipo_negociacion}
                          onChange={e => setEditForm({ ...editForm, tipo_negociacion: e.target.value })}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                        >
                          <option value="">Sin clasificar</option>
                          {TIPOS_NEGOCIACION.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{
                            backgroundColor: (TIPO_COLORS[client.tipo_negociacion] || '#9CA3AF') + '15',
                            color: TIPO_COLORS[client.tipo_negociacion] || '#9CA3AF',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TIPO_COLORS[client.tipo_negociacion] || '#9CA3AF' }} />
                          {client.tipo_negociacion || 'Sin clasificar'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editForm.estado_actual}
                          onChange={e => setEditForm({ ...editForm, estado_actual: e.target.value })}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                        >
                          <option value="">Sin clasificar</option>
                          {ESTADOS_ACTUAL.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: estadoCfg.bg, color: estadoCfg.color }}
                        >
                          {estadoCfg.icon} {client.estado_actual || 'Sin clasificar'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.valor_contratado}
                          onChange={e => setEditForm({ ...editForm, valor_contratado: parseFloat(e.target.value) || 0 })}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-32 text-right focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                        />
                      ) : (
                        <span className="font-semibold text-[#1A1A2E]">{formatCurrency(client.valor_contratado)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={editForm.has_comision}
                          onChange={e => setEditForm({ ...editForm, has_comision: e.target.checked })}
                          className="w-4 h-4"
                        />
                      ) : (
                        client.has_comision ? (
                          <span className="text-xs px-2 py-0.5 bg-[#BFFF00]/20 text-[#1A1A2E] rounded-lg font-medium">Sí</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => handleSaveClient(client.id)}
                            disabled={saving}
                            className="p-1.5 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] disabled:opacity-50"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => setEditingClient(null)}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditClient(client)}
                          className="text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
                        >
                          <ChevronDown size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientPortfolio;
