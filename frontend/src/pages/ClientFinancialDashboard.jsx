/**
 * Client Financial Dashboard
 * Complete P&L view with fixed costs, variable costs, COGS, and break-even analysis
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, TrendingUp, TrendingDown, Percent, Target,
  Plus, Trash2, Edit2, Save, X, Loader2, AlertTriangle, CheckCircle2,
  Package, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { growthAPI, clientsAPI } from '../utils/api';

// ─── Helpers ───
const formatCOP = (n) => {
  if (n == null || isNaN(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const formatCOPFull = (n) => {
  if (n == null || isNaN(n)) return '$0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
};

const formatPercent = (n) => {
  if (n == null || isNaN(n)) return '0%';
  return `${n.toFixed(1)}%`;
};

const getCurrentPeriod = () => {
  const d = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return d.substring(0, 7);
};

const getMonthName = (period) => {
  const [year, month] = period.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
};

// ─── KPI Card Component ───
const KPICard = ({ icon: Icon, title, value, subtitle, trend, iconColor = 'gray' }) => {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    violet: 'bg-violet-50 text-violet-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[iconColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend > 0 ? 'bg-emerald-50 text-emerald-600' : trend < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-[#17181A] mb-1">{value}</div>
      <div className="text-xs text-gray-500">{title}</div>
      {subtitle && <div className="text-[10px] text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
};

// ─── Cost Row Component ───
const CostRow = ({ item, onEdit, onDelete, type }) => {
  const isFixed = type === 'fixed';
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg group">
      <div className="flex-1">
        <div className="font-medium text-[#17181A] text-sm">{item.name}</div>
        <div className="text-xs text-gray-400">{item.category}</div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-[#17181A]">
          {isFixed ? formatCOPFull(item.amount) : `${item.percentage}%`}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <Edit2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Add/Edit Cost Modal ───
const CostModal = ({ type, item, onSave, onClose }) => {
  const isFixed = type === 'fixed';
  const [form, setForm] = useState(item || {
    category: '',
    name: '',
    amount: '',
    percentage: '',
    start_date: new Date().toISOString().split('T')[0],
    applies_to: 'revenue',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const categories = isFixed
    ? ['Fee agencia', 'Apps Shopify', 'Email marketing', 'Bodegaje', 'Nómina', 'Otro']
    : ['Pasarela de pago', 'Envío', 'Empaque', 'Otro'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[#17181A]">
            {item ? 'Editar' : 'Agregar'} costo {isFixed ? 'fijo' : 'variable'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar...</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder={isFixed ? 'Ej: Klaviyo Pro' : 'Ej: Mercado Pago'}
              required
            />
          </div>

          {isFixed ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto mensual (COP)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="500000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="3.5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aplica sobre</label>
                <select
                  value={form.applies_to}
                  onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="revenue">Venta total</option>
                  <option value="net_revenue">Venta neta (- COGS)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ───
export default function ClientFinancialDashboard() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [client, setClient] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cost management
  const [costModal, setCostModal] = useState(null); // { type: 'fixed'|'variable', item?: {...} }
  const [expandedSections, setExpandedSections] = useState({ fixed: true, variable: true, products: false });

  // Products management
  const [products, setProducts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingCost, setEditingCost] = useState('');

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [clientRes, financialsRes] = await Promise.all([
          clientsAPI.getById(clientId),
          growthAPI.getFinancials(clientId, period)
        ]);
        setClient(clientRes.data);
        setFinancials(financialsRes.data);

        // Load products separately (non-blocking)
        try {
          const productsRes = await growthAPI.getProducts(clientId);
          setProducts(productsRes.data.products || []);
        } catch (e) {
          console.log('No products loaded:', e.message);
        }
      } catch (err) {
        console.error('Error loading financial data:', err);
        setError('Error cargando datos financieros');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId, period]);

  // Handlers
  const handleSaveFixedCost = async (form) => {
    if (form.id) {
      await growthAPI.updateFixedCost(clientId, form.id, form);
    } else {
      await growthAPI.createFixedCost(clientId, { ...form, amount: parseFloat(form.amount) });
    }
    const res = await growthAPI.getFinancials(clientId, period);
    setFinancials(res.data);
  };

  const handleDeleteFixedCost = async (costId) => {
    if (!confirm('¿Eliminar este costo fijo?')) return;
    await growthAPI.deleteFixedCost(clientId, costId);
    const res = await growthAPI.getFinancials(clientId, period);
    setFinancials(res.data);
  };

  const handleSaveVariableCost = async (form) => {
    if (form.id) {
      await growthAPI.updateVariableCost(clientId, form.id, form);
    } else {
      await growthAPI.createVariableCost(clientId, { ...form, percentage: parseFloat(form.percentage) });
    }
    const res = await growthAPI.getFinancials(clientId, period);
    setFinancials(res.data);
  };

  const handleDeleteVariableCost = async (costId) => {
    if (!confirm('¿Eliminar este costo variable?')) return;
    await growthAPI.deleteVariableCost(clientId, costId);
    const res = await growthAPI.getFinancials(clientId, period);
    setFinancials(res.data);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Product handlers
  const handleSyncProducts = async () => {
    setSyncing(true);
    try {
      const res = await growthAPI.syncProducts(clientId);
      setProducts(res.data.products || []);
      // Refresh financials to update product count
      const financialsRes = await growthAPI.getFinancials(clientId, period);
      setFinancials(financialsRes.data);
    } catch (err) {
      console.error('Error syncing products:', err);
      alert('Error sincronizando productos: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateProductCost = async (productId) => {
    try {
      await growthAPI.updateProductCost(clientId, productId, parseFloat(editingCost));
      // Refresh products
      const productsRes = await growthAPI.getProducts(clientId);
      setProducts(productsRes.data.products || []);
      // Refresh financials to update COGS
      const financialsRes = await growthAPI.getFinancials(clientId, period);
      setFinancials(financialsRes.data);
      setEditingProductId(null);
      setEditingCost('');
    } catch (err) {
      console.error('Error updating product cost:', err);
      alert('Error actualizando costo: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCalculateCOGS = async () => {
    try {
      const [year, month] = period.split('-');
      const startDate = `${period}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
      await growthAPI.calculateCOGS(clientId, startDate, endDate);
      // Refresh financials
      const financialsRes = await growthAPI.getFinancials(clientId, period);
      setFinancials(financialsRes.data);
      alert('COGS calculado exitosamente');
    } catch (err) {
      console.error('Error calculating COGS:', err);
      alert('Error calculando COGS: ' + (err.response?.data?.error || err.message));
    }
  };

  // Waterfall data for P&L visualization
  const waterfallData = useMemo(() => {
    if (!financials) return [];
    const f = financials;
    return [
      { label: 'Ventas', value: f.revenue.mtd, type: 'positive' },
      { label: 'COGS', value: -f.cogs.mtd, type: 'negative' },
      { label: 'Utilidad Bruta', value: f.gross_profit.mtd, type: 'subtotal' },
      { label: 'Ad Spend', value: -f.ad_spend.mtd, type: 'negative' },
      { label: 'Costos Fijos', value: -f.fixed_costs.mtd_prorated, type: 'negative' },
      { label: 'Costos Variables', value: -f.variable_costs.mtd, type: 'negative' },
      { label: 'Utilidad Neta', value: f.net_profit.mtd, type: f.net_profit.mtd >= 0 ? 'result-positive' : 'result-negative' },
    ];
  }, [financials]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button onClick={() => navigate('/app/metricas')} className="mt-4 text-emerald-600 hover:underline">
            Volver a Growth
          </button>
        </div>
      </div>
    );
  }

  const f = financials;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/app/metricas')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-[#17181A]">
                  {client?.nickname || client?.company || 'Cliente'}
                </h1>
                <p className="text-sm text-gray-500 capitalize">{getMonthName(period)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
              />
              <div className="text-sm text-gray-500">
                Día {f.days_elapsed} de {f.days_in_month}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <KPICard
            icon={DollarSign}
            title="Ventas MTD"
            value={formatCOP(f.revenue.mtd)}
            subtitle={`${f.revenue.orders_mtd} pedidos`}
            iconColor="emerald"
          />
          <KPICard
            icon={Package}
            title="COGS"
            value={formatCOP(f.cogs.mtd)}
            subtitle={`Margen ${formatPercent(f.cogs.margin_pct)}`}
            iconColor="amber"
          />
          <KPICard
            icon={TrendingUp}
            title="Utilidad Bruta"
            value={formatCOP(f.gross_profit.mtd)}
            subtitle={`Margen ${formatPercent(f.gross_profit.margin_pct)}`}
            iconColor="indigo"
          />
          <KPICard
            icon={TrendingDown}
            title="Ad Spend"
            value={formatCOP(f.ad_spend.mtd)}
            subtitle={`ROAS ${f.ad_spend.roas.toFixed(2)}x`}
            iconColor="red"
          />
          <KPICard
            icon={Percent}
            title="Utilidad Neta"
            value={formatCOP(f.net_profit.mtd)}
            subtitle={`Margen ${formatPercent(f.net_profit.margin_pct)}`}
            iconColor={f.net_profit.mtd >= 0 ? 'emerald' : 'red'}
          />
          <KPICard
            icon={Target}
            title="Break-even"
            value={f.breakeven.will_be_profitable ? `${f.breakeven.days_to_breakeven.toFixed(1)} días` : 'No alcanza'}
            subtitle={f.breakeven.will_be_profitable ? 'Será rentable' : 'Ver proyección'}
            iconColor={f.breakeven.will_be_profitable ? 'emerald' : 'amber'}
          />
        </div>

        {/* P&L Waterfall */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#17181A] mb-6">Estado de Resultados (MTD)</h2>
          <div className="space-y-3">
            {waterfallData.map((item, idx) => {
              const isSubtotal = item.type === 'subtotal';
              const isResult = item.type.startsWith('result');
              const isNegative = item.type === 'negative' || item.type === 'result-negative';
              const absValue = Math.abs(item.value);
              const maxValue = Math.max(...waterfallData.map(d => Math.abs(d.value)));
              const barWidth = maxValue > 0 ? (absValue / maxValue) * 100 : 0;

              return (
                <div key={idx} className={`flex items-center gap-4 py-2 ${isResult ? 'border-t-2 border-gray-200 pt-4 mt-2' : ''}`}>
                  <div className="w-32 text-sm text-gray-600 font-medium">{item.label}</div>
                  <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full rounded-lg transition-all ${
                        isResult
                          ? (isNegative ? 'bg-red-500' : 'bg-emerald-500')
                          : isSubtotal
                            ? 'bg-indigo-400'
                            : isNegative
                              ? 'bg-red-400'
                              : 'bg-emerald-400'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className={`text-sm font-semibold ${barWidth > 30 ? 'text-white' : 'text-gray-700'}`}>
                        {isNegative && item.value !== 0 ? '-' : ''}{formatCOPFull(absValue)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Costs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fixed Costs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection('fixed')}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
            >
              <div>
                <h3 className="text-lg font-semibold text-[#17181A]">Costos Fijos Mensuales</h3>
                <p className="text-sm text-gray-500">
                  Total: {formatCOPFull(f.fixed_costs.monthly_total)} / mes
                </p>
              </div>
              {expandedSections.fixed ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.fixed && (
              <div className="border-t border-gray-100 p-4">
                {f.fixed_costs.breakdown.length > 0 ? (
                  <div className="space-y-1">
                    {f.fixed_costs.breakdown.map((cost) => (
                      <CostRow
                        key={cost.id}
                        item={cost}
                        type="fixed"
                        onEdit={(item) => setCostModal({ type: 'fixed', item })}
                        onDelete={handleDeleteFixedCost}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4">Sin costos fijos configurados</p>
                )}
                <button
                  onClick={() => setCostModal({ type: 'fixed' })}
                  className="mt-4 w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Agregar costo fijo
                </button>
              </div>
            )}
          </div>

          {/* Variable Costs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection('variable')}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
            >
              <div>
                <h3 className="text-lg font-semibold text-[#17181A]">Costos Variables</h3>
                <p className="text-sm text-gray-500">
                  MTD: {formatCOPFull(f.variable_costs.mtd)}
                </p>
              </div>
              {expandedSections.variable ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {expandedSections.variable && (
              <div className="border-t border-gray-100 p-4">
                {f.variable_costs.breakdown.length > 0 ? (
                  <div className="space-y-1">
                    {f.variable_costs.breakdown.map((cost) => (
                      <CostRow
                        key={cost.id}
                        item={cost}
                        type="variable"
                        onEdit={(item) => setCostModal({ type: 'variable', item })}
                        onDelete={handleDeleteVariableCost}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4">Sin costos variables configurados</p>
                )}
                <button
                  onClick={() => setCostModal({ type: 'variable' })}
                  className="mt-4 w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Agregar costo variable
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Break-even Analysis */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#17181A] mb-4">Proyección Break-even</h2>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Progreso del mes</span>
              <span className="text-sm font-medium text-[#17181A]">
                {((f.days_elapsed / f.days_in_month) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                style={{ width: `${(f.days_elapsed / f.days_in_month) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Margen de contribución</div>
              <div className="text-xl font-bold text-[#17181A]">{formatPercent(f.breakeven.contribution_margin * 100)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Costos fijos restantes</div>
              <div className="text-xl font-bold text-[#17181A]">{formatCOP(f.breakeven.fixed_costs_remaining)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Venta para BE</div>
              <div className="text-xl font-bold text-[#17181A]">{formatCOP(f.breakeven.revenue_to_breakeven)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Días para BE</div>
              <div className="text-xl font-bold text-[#17181A]">{f.breakeven.days_to_breakeven.toFixed(1)}</div>
            </div>
          </div>

          <div className={`p-4 rounded-xl ${f.breakeven.will_be_profitable ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <div className="flex items-start gap-3">
              {f.breakeven.will_be_profitable ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div>
                <div className={`font-semibold ${f.breakeven.will_be_profitable ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {f.breakeven.will_be_profitable ? 'Proyección positiva' : 'Atención requerida'}
                </div>
                <div className={`text-sm ${f.breakeven.will_be_profitable ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {f.breakeven.will_be_profitable
                    ? `Utilidad neta proyectada al cierre: ${formatCOPFull(f.net_profit.projected_eom)}`
                    : `A ritmo actual, el mes no será rentable. Venta adicional necesaria: ${formatCOPFull(f.breakeven.revenue_to_breakeven)}`
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products/COGS Section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('products')}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
          >
            <div>
              <h3 className="text-lg font-semibold text-[#17181A]">Costos de Producto (COGS)</h3>
              <p className="text-sm text-gray-500">
                {products.length} productos sincronizados
                {products.filter(p => !p.cost).length > 0 && (
                  <span className="text-amber-600 ml-2">• {products.filter(p => !p.cost).length} sin costo</span>
                )}
              </p>
            </div>
            {expandedSections.products ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {expandedSections.products && (
            <div className="border-t border-gray-100 p-5">
              {/* Action buttons */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={handleSyncProducts}
                  disabled={syncing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sync Shopify'}
                </button>
                {products.length > 0 && (
                  <button
                    onClick={handleCalculateCOGS}
                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Recalcular COGS
                  </button>
                )}
              </div>

              {products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Sin productos sincronizados de Shopify</p>
                  <p className="text-xs text-gray-400 mt-1">Haz clic en "Sync Shopify" para importar productos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500">SKU</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500">Precio</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500">Costo</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500">Margen</th>
                        <th className="text-center py-3 px-2 font-medium text-gray-500">Fuente</th>
                        <th className="text-center py-3 px-2 font-medium text-gray-500">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 50).map((product) => {
                        const margin = product.price && product.cost
                          ? ((product.price - product.cost) / product.price * 100)
                          : null;
                        const isEditing = editingProductId === product.id;

                        return (
                          <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 px-2">
                              <div className="font-medium text-[#17181A] truncate max-w-[200px]" title={product.title}>
                                {product.title}
                              </div>
                              {product.variant_title && product.variant_title !== 'Default Title' && (
                                <div className="text-xs text-gray-400">{product.variant_title}</div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-gray-500">{product.sku || '-'}</td>
                            <td className="py-3 px-2 text-right">{formatCOPFull(product.price)}</td>
                            <td className="py-3 px-2 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingCost}
                                  onChange={(e) => setEditingCost(e.target.value)}
                                  className="w-24 px-2 py-1 border border-emerald-300 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  autoFocus
                                />
                              ) : (
                                <span className={product.cost ? '' : 'text-amber-500'}>
                                  {product.cost ? formatCOPFull(product.cost) : 'Sin definir'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              {margin !== null ? (
                                <span className={margin >= 50 ? 'text-emerald-600' : margin >= 30 ? 'text-amber-600' : 'text-red-600'}>
                                  {margin.toFixed(0)}%
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                product.cost_source === 'manual' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {product.cost_source === 'manual' ? 'Manual' : 'Shopify'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleUpdateProductCost(product.id)}
                                    className="p-1 hover:bg-emerald-50 rounded"
                                  >
                                    <Save className="w-4 h-4 text-emerald-600" />
                                  </button>
                                  <button
                                    onClick={() => { setEditingProductId(null); setEditingCost(''); }}
                                    className="p-1 hover:bg-gray-100 rounded"
                                  >
                                    <X className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingProductId(product.id); setEditingCost(product.cost || ''); }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                  title="Editar costo"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-400" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {products.length > 50 && (
                    <div className="text-center py-3 text-sm text-gray-500">
                      Mostrando 50 de {products.length} productos
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cost Modal */}
      {costModal && (
        <CostModal
          type={costModal.type}
          item={costModal.item}
          onSave={costModal.type === 'fixed' ? handleSaveFixedCost : handleSaveVariableCost}
          onClose={() => setCostModal(null)}
        />
      )}
    </div>
  );
}
