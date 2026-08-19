/**
 * Financial Dashboard - Main Page
 * Uses platform's glass design system (no dark theme)
 */
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Wallet,
  CreditCard,
  UserCheck,
  Building2,
  Calendar,
  ChevronDown,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { dashboardAPI, siigoAPI } from '../utils/api';

// Section components
import OverviewSection from '../components/financial/OverviewSection';
import SalesSection from '../components/financial/SalesSection';
import ClientsSection from '../components/financial/ClientsSection';
import ReceivablesSection from '../components/financial/ReceivablesSection';
import ExpensesSection from '../components/financial/ExpensesSection';
import PayrollSection from '../components/financial/PayrollSection';
import BankSection from '../components/financial/BankSection';

const SECTIONS = [
  { id: 'overview', name: 'Resumen', icon: LayoutDashboard },
  { id: 'ventas', name: 'Ventas', icon: TrendingUp },
  { id: 'clientes', name: 'Clientes', icon: Users },
  { id: 'cartera', name: 'Cartera', icon: Wallet },
  { id: 'gastos', name: 'Gastos', icon: CreditCard },
  { id: 'nomina', name: 'Nomina', icon: UserCheck },
  { id: 'banco', name: 'Banco', icon: Building2 },
];

const FinancialDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [period, setPeriod] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { type: 'success' | 'error', message: string }

  useEffect(() => {
    loadFinancialData();
  }, [period, selectedMonth]);

  const handleSiigoSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      // Sync invoices and expenses in parallel
      const [invoicesRes, expensesRes] = await Promise.all([
        siigoAPI.syncInvoicesFromSiigo(),
        siigoAPI.syncExpensesFromSiigo(),
      ]);

      const invoiceCount = invoicesRes.data?.synced || 0;
      const expenseCount = expensesRes.data?.synced || 0;

      setSyncResult({
        type: 'success',
        message: `Sincronizado: ${invoiceCount} facturas, ${expenseCount} gastos`,
      });

      // Reload data
      loadFinancialData();
    } catch (error) {
      console.error('Error syncing with Siigo:', error);
      setSyncResult({
        type: 'error',
        message: error.response?.data?.error || 'Error sincronizando con Siigo',
      });
    } finally {
      setSyncing(false);
      // Clear result after 5 seconds
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      let startDate, endDate;

      if (period === 'month') {
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
      } else if (period === 'year') {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
      } else {
        const now = new Date();
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
      }

      const response = await dashboardAPI.getStats({
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      });
      setData(response.data);
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPeriodLabel = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    if (period === 'month') {
      return `${monthNames[month - 1]} ${year}`;
    } else if (period === 'year') {
      return `Año ${year}`;
    }
    return 'YTD';
  };

  const renderSection = () => {
    const props = { data, loading, period, selectedMonth };

    switch (activeSection) {
      case 'overview':
        return <OverviewSection {...props} />;
      case 'ventas':
        return <SalesSection {...props} />;
      case 'clientes':
        return <ClientsSection {...props} />;
      case 'cartera':
        return <ReceivablesSection {...props} />;
      case 'gastos':
        return <ExpensesSection {...props} />;
      case 'nomina':
        return <PayrollSection {...props} />;
      case 'banco':
        return <BankSection {...props} />;
      default:
        return <OverviewSection {...props} />;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#17181A] tracking-tight">
            Dashboard Financiero
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Panorama completo de la agencia
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Siigo Sync Button */}
          <button
            onClick={handleSiigoSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              syncing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sync Siigo'}</span>
          </button>

          {/* Sync Result Toast */}
          {syncResult && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                syncResult.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {syncResult.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{syncResult.message}</span>
            </div>
          )}

          {/* Period Selector */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 glass rounded-xl text-sm font-medium text-[#17181A] hover:bg-white/80 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>{formatPeriodLabel()}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

          {showPeriodDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowPeriodDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-64 glass-solid rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="p-3 border-b border-gray-100">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                    Tipo de período
                  </label>
                  <div className="flex gap-2">
                    {[
                      { key: 'month', label: 'Mes' },
                      { key: 'year', label: 'Año' },
                      { key: 'ytd', label: 'YTD' },
                    ].map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          period === p.key
                            ? 'bg-[#17181A] text-[#D7F653]'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {period === 'month' && (
                  <div className="p-3">
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                      Seleccionar mes
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                  </div>
                )}
                {period === 'year' && (
                  <div className="p-3">
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                      Seleccionar año
                    </label>
                    <select
                      value={selectedMonth.split('-')[0]}
                      onChange={(e) => setSelectedMonth(`${e.target.value}-01`)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    >
                      {[2024, 2025, 2026].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="p-3 border-t border-gray-100">
                  <button
                    onClick={() => setShowPeriodDropdown(false)}
                    className="w-full px-3 py-2 bg-[#17181A] text-white text-sm font-medium rounded-lg hover:bg-[#26282C] transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="glass rounded-2xl p-1.5 mb-6 inline-flex gap-1 flex-wrap">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#17181A] text-[#D7F653] shadow-sm'
                  : 'text-gray-600 hover:text-[#17181A] hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{section.name}</span>
            </button>
          );
        })}
      </div>

      {/* Active Section Content */}
      <div className="animate-fade-in">{renderSection()}</div>
    </div>
  );
};

export default FinancialDashboard;
