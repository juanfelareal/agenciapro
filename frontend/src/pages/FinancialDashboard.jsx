import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Wallet,
  CreditCard,
  UserCheck,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { dashboardAPI } from '../utils/api';

// Section components
import OverviewSection from '../components/financial/OverviewSection';
import SalesSection from '../components/financial/SalesSection';
import ClientsSection from '../components/financial/ClientsSection';
import ReceivablesSection from '../components/financial/ReceivablesSection';
import ExpensesSection from '../components/financial/ExpensesSection';
import PayrollSection from '../components/financial/PayrollSection';

const SECTIONS = [
  { id: 'overview', name: 'Resumen', icon: LayoutDashboard },
  { id: 'ventas', name: 'Ventas', icon: TrendingUp },
  { id: 'clientes', name: 'Clientes', icon: Users },
  { id: 'cartera', name: 'Cartera', icon: Wallet },
  { id: 'gastos', name: 'Gastos', icon: CreditCard },
  { id: 'nomina', name: 'Nómina', icon: UserCheck },
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

  useEffect(() => {
    loadFinancialData();
  }, [period, selectedMonth]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      // Build date range based on period
      const [year, month] = selectedMonth.split('-').map(Number);
      let startDate, endDate;

      if (period === 'month') {
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
      } else if (period === 'year') {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
      } else {
        // YTD
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
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
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
      default:
        return <OverviewSection {...props} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] text-[#f4f4f5]">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 w-[72px] h-screen bg-[#13141a] border-r border-white/5 flex flex-col items-center py-5 z-50">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center font-bold text-lg mb-8">
          LR
        </div>
        <div className="flex flex-col gap-2 flex-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-[#5c5d66] hover:bg-[#1a1b23] hover:text-[#f4f4f5]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-[-14px] w-[3px] h-6 bg-teal-400 rounded-r" />
                )}
                <Icon size={20} />
                <span className="absolute left-[60px] px-3 py-2 bg-[#1a1b23] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap border border-white/5 z-50">
                  {section.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-[72px] p-8">
        {/* Header */}
        <header className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight mb-1">Dashboard Financiero</h1>
            <p className="text-[#94959c] text-sm">Panorama completo de la agencia</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1b23] border border-white/5 rounded-xl text-sm font-medium hover:border-white/10 transition-colors"
              >
                <Calendar size={16} className="text-[#94959c]" />
                {formatPeriodLabel()}
                <ChevronDown size={16} className="text-[#94959c]" />
              </button>

              {showPeriodDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1b23] border border-white/5 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-white/5">
                    <label className="text-xs text-[#5c5d66] uppercase tracking-wider mb-2 block">Tipo de período</label>
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
                              ? 'bg-teal-500/20 text-teal-400'
                              : 'bg-[#0c0d10] text-[#94959c] hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {period === 'month' && (
                    <div className="p-3">
                      <label className="text-xs text-[#5c5d66] uppercase tracking-wider mb-2 block">Seleccionar mes</label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0c0d10] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  )}
                  {period === 'year' && (
                    <div className="p-3">
                      <label className="text-xs text-[#5c5d66] uppercase tracking-wider mb-2 block">Seleccionar año</label>
                      <select
                        value={selectedMonth.split('-')[0]}
                        onChange={(e) => setSelectedMonth(`${e.target.value}-01`)}
                        className="w-full px-3 py-2 bg-[#0c0d10] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                      >
                        {[2024, 2025, 2026].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="p-3 border-t border-white/5">
                    <button
                      onClick={() => setShowPeriodDropdown(false)}
                      className="w-full px-3 py-2 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Section Content */}
        <div className="animate-fade-in">
          {renderSection()}
        </div>
      </main>

      {/* Click outside to close dropdown */}
      {showPeriodDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPeriodDropdown(false)}
        />
      )}
    </div>
  );
};

export default FinancialDashboard;
