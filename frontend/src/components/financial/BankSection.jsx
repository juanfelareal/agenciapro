/**
 * Bank Section - Extractos Bancarios (Bancolombia)
 * Uses platform's glass design system (light theme)
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Building2, ArrowDownRight, ArrowUpRight, TrendingUp, Upload, X, CheckCircle, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import KPICard from './shared/KPICard';
import FinancialCard from './shared/FinancialCard';
import { formatCurrency } from './shared/formatters';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const BankSection = ({ data, loading }) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [bankData, setBankData] = useState(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'credits', 'debits'
  const fileInputRef = useRef(null);

  // Load bank data from API
  useEffect(() => {
    loadBankData();
  }, []);

  const loadBankData = async () => {
    setLoadingBank(true);
    try {
      const res = await fetch(`${API_URL}/bank-statements/current`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBankData(data);
      }
    } catch (error) {
      console.error('Error loading bank data:', error);
    } finally {
      setLoadingBank(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadMessage({ type: 'error', text: 'Solo se permiten archivos CSV' });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const res = await fetch(`${API_URL}/bank-statements/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setUploadMessage({
          type: 'success',
          text: `${data.message}`
        });
        loadBankData(); // Refresh data
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadMessage(null);
        }, 2000);
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Error procesando el CSV' });
      }
    } catch (error) {
      console.error('Error uploading bank statement:', error);
      setUploadMessage({ type: 'error', text: 'Error subiendo el archivo' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Period info
  const periodInfo = useMemo(() => {
    if (!bankData) return null;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return {
      label: bankData.period_name || `${monthNames[bankData.month - 1]} ${bankData.year}`,
      month: bankData.month,
      year: bankData.year,
      account: bankData.account_number,
    };
  }, [bankData]);

  // Filter transactions
  const transactions = useMemo(() => {
    if (!bankData?.transactions) return [];

    return bankData.transactions.filter((txn) => {
      if (filterType === 'credits') return txn.credit > 0;
      if (filterType === 'debits') return txn.debit > 0;
      return true;
    });
  }, [bankData, filterType]);

  // KPI calculations
  const kpis = useMemo(() => {
    if (!bankData) {
      return {
        openingBalance: 0,
        closingBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        netFlow: 0,
        transactionCount: 0,
      };
    }

    return {
      openingBalance: bankData.opening_balance || 0,
      closingBalance: bankData.closing_balance || 0,
      totalCredits: bankData.total_credits || 0,
      totalDebits: bankData.total_debits || 0,
      netFlow: (bankData.total_credits || 0) - (bankData.total_debits || 0),
      transactionCount: bankData.transaction_count || 0,
    };
  }, [bankData]);

  if (loading || loadingBank) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 glass rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Render upload modal helper
  function renderUploadModal() {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[#17181A]">Importar Extracto Bancolombia</h2>
            <button
              onClick={() => {
                setShowUploadModal(false);
                setUploadMessage(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="bank-upload"
                disabled={uploading}
              />
              <label
                htmlFor="bank-upload"
                className="cursor-pointer block"
              >
                {uploading ? (
                  <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-3 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                )}
                <p className="text-sm font-medium text-[#17181A] mb-1">
                  {uploading ? 'Procesando CSV...' : 'Haz clic para seleccionar CSV'}
                </p>
                <p className="text-xs text-gray-500">
                  Extracto CSV exportado desde Bancolombia (max. 10MB)
                </p>
              </label>
            </div>

            {uploadMessage && (
              <div className={`px-4 py-3 rounded-xl flex items-center gap-2 ${
                uploadMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {uploadMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {uploadMessage.text}
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-[#17181A] mb-2">Como exportar desde Bancolombia</h4>
              <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>Ingresa a la Sucursal Virtual Empresas</li>
                <li>Ve a Cuentas → Extractos y Movimientos</li>
                <li>Selecciona la cuenta y el periodo</li>
                <li>Exporta en formato CSV y sube el archivo aqui</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no bank data yet
  if (!bankData) {
    return (
      <div className="space-y-6">
        {/* Header with upload button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-[#17181A]">Extractos Bancarios</h2>
            <p className="text-sm text-gray-500">Importa tu extracto de Bancolombia</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-[#17181A] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#26282C] transition-colors"
          >
            <Upload size={18} />
            Importar CSV de Bancolombia
          </button>
        </div>

        {/* Empty state card */}
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#17181A] mb-2">Sin extractos bancarios</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Sube tu extracto CSV de Bancolombia para ver el detalle de movimientos, creditos y debitos.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-600 transition-colors mx-auto"
          >
            <Upload size={18} />
            Subir CSV de Bancolombia
          </button>
        </div>

        {/* Upload Modal */}
        {showUploadModal && renderUploadModal()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period info and upload button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[#17181A]">
            Extracto {periodInfo?.label || ''}
          </h2>
          <p className="text-sm text-gray-500">
            {kpis.transactionCount} movimientos
            {periodInfo?.account && periodInfo.account !== 'default' && (
              <span className="ml-2">• Cuenta {periodInfo.account}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="border border-gray-200 text-[#17181A] px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Upload size={18} />
          Importar otro periodo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Building2}
          title="Saldo Inicial"
          value={formatCurrency(kpis.openingBalance)}
          subtitle={`1 de ${periodInfo?.label || 'mes'}`}
          iconColor="slate"
        />
        <KPICard
          icon={ArrowUpRight}
          title="Total Creditos"
          value={formatCurrency(kpis.totalCredits)}
          subtitle="Ingresos del periodo"
          iconColor="emerald"
        />
        <KPICard
          icon={ArrowDownRight}
          title="Total Debitos"
          value={formatCurrency(kpis.totalDebits)}
          subtitle="Egresos del periodo"
          iconColor="red"
        />
        <KPICard
          icon={TrendingUp}
          title="Saldo Final"
          value={formatCurrency(kpis.closingBalance)}
          subtitle={`Fin de ${periodInfo?.label || 'mes'}`}
          iconColor="blue"
          trend={kpis.netFlow >= 0 ? 'up' : 'down'}
          trendLabel={`${kpis.netFlow >= 0 ? '+' : ''}${formatCurrency(kpis.netFlow)}`}
        />
      </div>

      {/* Upload Modal */}
      {showUploadModal && renderUploadModal()}

      {/* Transactions Table */}
      <FinancialCard
        title="Movimientos"
        subtitle={`Extracto ${periodInfo?.label || ''}`}
        span={12}
        action={
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'credits', label: 'Creditos' },
              { key: 'debits', label: 'Debitos' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilterType(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filterType === opt.key
                    ? 'bg-white text-[#17181A] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Fecha
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[300px]">
                  Descripcion
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Referencia
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                  Debito
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                  Credito
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50 whitespace-nowrap">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn, idx) => {
                const dateStr = txn.transaction_date?.split('T')[0] || '';
                const [year, month, day] = dateStr.split('-');
                const formattedDate = day && month ? `${day}/${month}` : dateStr;

                return (
                  <tr key={txn.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border-b border-gray-100 text-gray-600 whitespace-nowrap">
                      {formattedDate}
                    </td>
                    <td className="px-4 py-3 border-b border-gray-100">
                      <span className="font-medium text-[#17181A] line-clamp-1" title={txn.description}>
                        {txn.description || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-gray-100 text-gray-500 text-xs">
                      {txn.reference || txn.doc_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-right border-b border-gray-100 whitespace-nowrap">
                      {txn.debit > 0 ? (
                        <span className="text-red-500 font-medium">
                          -{formatCurrency(txn.debit)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right border-b border-gray-100 whitespace-nowrap">
                      {txn.credit > 0 ? (
                        <span className="text-emerald-600 font-medium">
                          +{formatCurrency(txn.credit)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right border-b border-gray-100 bg-gray-50 font-medium text-[#17181A] whitespace-nowrap">
                      {formatCurrency(txn.balance)}
                    </td>
                  </tr>
                );
              })}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No hay movimientos {filterType !== 'all' ? `de ${filterType === 'credits' ? 'credito' : 'debito'}` : ''} en este periodo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        {transactions.length > 0 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 px-4">
            <div className="text-xs text-gray-500">
              Mostrando {transactions.length} de {bankData.transaction_count} movimientos
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-0.5">Total Debitos</div>
                <div className="font-semibold text-red-500">-{formatCurrency(kpis.totalDebits)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-0.5">Total Creditos</div>
                <div className="font-semibold text-emerald-600">+{formatCurrency(kpis.totalCredits)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-0.5">Flujo Neto</div>
                <div className={`font-bold ${kpis.netFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {kpis.netFlow >= 0 ? '+' : ''}{formatCurrency(kpis.netFlow)}
                </div>
              </div>
            </div>
          </div>
        )}
      </FinancialCard>
    </div>
  );
};

export default BankSection;
