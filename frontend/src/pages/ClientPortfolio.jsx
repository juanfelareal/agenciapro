import { useState, useMemo, useRef, useEffect } from 'react';
import { clientsAPI } from '../utils/api';
import { TrendingUp, DollarSign, Users, Percent, ChevronDown, Plus, Check } from 'lucide-react';

const DEFAULT_TIPOS = [
  'Growth',
  'Growth con potencial',
  'Growth mal negociado',
  'Fee bien negociado',
  'Fee mensual',
];

const DEFAULT_ESTADOS = [
  'Comenzando',
  'Rentable, buen crecimiento',
  'Poco rentable, poco crecimiento',
  'En la cuerda floja',
  'Rentable, busca crecimiento',
  'No tan rentable, buen crecimiento',
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
  'Rentable, buen crecimiento': { color: '#10B981', bg: '#ECFDF5', icon: '📈' },
  'Poco rentable, poco crecimiento': { color: '#EF4444', bg: '#FEF2F2', icon: '🔻' },
  'En la cuerda floja': { color: '#EF4444', bg: '#FEF2F2', icon: '🔥' },
  'Rentable, busca crecimiento': { color: '#F59E0B', bg: '#FFFBEB', icon: '🔍' },
  'No tan rentable, buen crecimiento': { color: '#F59E0B', bg: '#FFFBEB', icon: '⚠️' },
  'Rentable sin crecimiento': { color: '#8B5CF6', bg: '#F5F3FF', icon: '📊' },
  'Rentable bajo crecimiento': { color: '#6366F1', bg: '#EEF2FF', icon: '📉' },
};

const formatCurrency = (val) => {
  if (!val) return '$0';
  return '$' + Number(val).toLocaleString('es-CO', { maximumFractionDigits: 0 });
};

// Inline dropdown component for clicking to change values
const InlineDropdown = ({ value, options, colorMap, configMap, onSelect, placeholder = 'Sin clasificar', type = 'tipo' }) => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setAdding(false);
        setNewValue('');
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const handleSelect = (val) => {
    onSelect(val);
    setOpen(false);
    setAdding(false);
    setNewValue('');
  };

  const handleAddNew = () => {
    if (newValue.trim()) {
      handleSelect(newValue.trim());
    }
  };

  if (type === 'estado') {
    const cfg = configMap?.[value] || { color: '#9CA3AF', bg: '#F3F4F6', icon: '❓' };
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer hover:ring-2 hover:ring-gray-200 transition-all"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.icon} {value || placeholder}
          <ChevronDown size={12} className="opacity-50" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 left-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[220px] max-h-64 overflow-y-auto">
            <button
              onClick={() => handleSelect('')}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 flex items-center gap-2"
            >
              {!value && <Check size={12} />}
              Sin clasificar
            </button>
            {options.map(opt => {
              const optCfg = configMap?.[opt] || { color: '#9CA3AF', bg: '#F3F4F6', icon: '❓' };
              return (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                  style={{ color: optCfg.color }}
                >
                  {value === opt && <Check size={12} />}
                  <span className={value === opt ? '' : 'ml-5'}>{optCfg.icon} {opt}</span>
                </button>
              );
            })}
            {!adding ? (
              <button
                onClick={() => setAdding(true)}
                className="w-full text-left px-3 py-2 text-xs text-blue-500 hover:bg-blue-50 flex items-center gap-1 border-t border-gray-50 mt-1"
              >
                <Plus size={12} /> Agregar nuevo
              </button>
            ) : (
              <div className="px-2 py-2 border-t border-gray-50 mt-1 flex gap-1">
                <input
                  ref={inputRef}
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); if (e.key === 'Escape') { setAdding(false); setNewValue(''); } }}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                  placeholder="Nuevo estado..."
                />
                <button onClick={handleAddNew} className="p-1 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#252542]">
                  <Check size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // tipo variant
  const color = colorMap?.[value] || '#9CA3AF';
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer hover:ring-2 hover:ring-gray-200 transition-all"
        style={{ backgroundColor: color + '15', color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {value || placeholder}
        <ChevronDown size={12} className="opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[200px] max-h-64 overflow-y-auto">
          <button
            onClick={() => handleSelect('')}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 flex items-center gap-2"
          >
            {!value && <Check size={12} />}
            Sin clasificar
          </button>
          {options.map(opt => {
            const optColor = colorMap?.[opt] || '#9CA3AF';
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                style={{ color: optColor }}
              >
                {value === opt && <Check size={12} />}
                <span className={`flex items-center gap-1.5 ${value === opt ? '' : 'ml-5'}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: optColor }} />
                  {opt}
                </span>
              </button>
            );
          })}
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="w-full text-left px-3 py-2 text-xs text-blue-500 hover:bg-blue-50 flex items-center gap-1 border-t border-gray-50 mt-1"
            >
              <Plus size={12} /> Agregar nuevo
            </button>
          ) : (
            <div className="px-2 py-2 border-t border-gray-50 mt-1 flex gap-1">
              <input
                ref={inputRef}
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); if (e.key === 'Escape') { setAdding(false); setNewValue(''); } }}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                placeholder="Nuevo tipo..."
              />
              <button onClick={handleAddNew} className="p-1 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#252542]">
                <Check size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Inline editable currency value
const InlineValue = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value || 0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const parsed = parseFloat(localVal) || 0;
    if (parsed !== (value || 0)) onSave(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-32 text-right focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
      />
    );
  }

  return (
    <span
      onClick={() => { setLocalVal(value || 0); setEditing(true); }}
      className="font-semibold text-[#1A1A2E] cursor-pointer hover:bg-gray-100 rounded-lg px-2 py-1 -mx-2 transition-colors"
    >
      {formatCurrency(value)}
    </span>
  );
};

const ClientPortfolio = ({ clients, onClientUpdated }) => {
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');

  // Dynamic options: defaults + any custom values from DB
  const allTipos = useMemo(() => {
    const custom = clients
      .map(c => c.tipo_negociacion)
      .filter(t => t && !DEFAULT_TIPOS.includes(t));
    return [...DEFAULT_TIPOS, ...new Set(custom)];
  }, [clients]);

  const allEstados = useMemo(() => {
    const custom = clients
      .map(c => c.estado_actual)
      .filter(e => e && !DEFAULT_ESTADOS.includes(e));
    return [...DEFAULT_ESTADOS, ...new Set(custom)];
  }, [clients]);

  // Quick update a single field on a client
  const quickUpdate = async (clientId, field, value) => {
    try {
      await clientsAPI.update(clientId, { [field]: value });
      onClientUpdated();
    } catch (error) {
      console.error('Error updating client:', error);
    }
  };

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
      ['En la cuerda floja', 'Poco rentable', 'Poco rentable, poco crecimiento', 'No tan rentable, buen crecimiento'].includes(c.estado_actual)
    ),
    [activeClients]
  );

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
        {allTipos.map(tipo => {
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
        {allEstados.map(estado => {
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E]">
                    {client.nickname || client.company || client.name}
                  </td>
                  <td className="px-4 py-3">
                    <InlineDropdown
                      value={client.tipo_negociacion}
                      options={allTipos}
                      colorMap={TIPO_COLORS}
                      type="tipo"
                      onSelect={(val) => quickUpdate(client.id, 'tipo_negociacion', val || null)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <InlineDropdown
                      value={client.estado_actual}
                      options={allEstados}
                      configMap={ESTADO_CONFIG}
                      type="estado"
                      onSelect={(val) => quickUpdate(client.id, 'estado_actual', val || null)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <InlineValue
                      value={client.valor_contratado}
                      onSave={(val) => quickUpdate(client.id, 'valor_contratado', val)}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => quickUpdate(client.id, 'has_comision', client.has_comision ? 0 : 1)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                        client.has_comision
                          ? 'bg-[#BFFF00]/20 text-[#1A1A2E] hover:bg-[#BFFF00]/30'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {client.has_comision ? 'Sí' : 'No'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientPortfolio;
