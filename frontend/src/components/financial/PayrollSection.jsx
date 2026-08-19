/**
 * Payroll Section - Nómina
 * Uses platform's glass design system (light theme)
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Users, Briefcase, TrendingUp, Percent, Upload, X, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
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

const PayrollSection = ({ data, loading }) => {
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [payrollData, setPayrollData] = useState(null);
  const [loadingPayroll, setLoadingPayroll] = useState(true);
  const fileInputRef = useRef(null);

  // Load payroll data from API
  useEffect(() => {
    loadPayrollData();
  }, []);

  const loadPayrollData = async () => {
    setLoadingPayroll(true);
    try {
      const res = await fetch(`${API_URL}/payroll/current`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPayrollData(data);
      }
    } catch (error) {
      console.error('Error loading payroll data:', error);
    } finally {
      setLoadingPayroll(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadMessage({ type: 'error', text: 'Solo se permiten archivos PDF' });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch(`${API_URL}/payroll/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setUploadMessage({
          type: 'success',
          text: `✓ ${data.message}`
        });
        loadPayrollData(); // Refresh data
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadMessage(null);
        }, 2000);
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Error procesando el PDF' });
      }
    } catch (error) {
      console.error('Error uploading payroll:', error);
      setUploadMessage({ type: 'error', text: 'Error subiendo el archivo' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleEmployee = (empId) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [empId]: !prev[empId],
    }));
  };

  // Transform API data to display format
  const employees = useMemo(() => {
    if (!payrollData?.employees) return [];

    return payrollData.employees.map((emp, idx) => ({
      id: emp.id || `emp-${idx}`,
      name: emp.nombre,
      position: emp.cargo || 'N/A',
      totalPagado: emp.total_pagado || 0,
      totalDevengados: emp.total_devengados || 0,
      totalDeducciones: emp.total_deducciones || 0,
      breakdown: {
        salario: emp.dev_salario || 0,
        transporte: emp.dev_transporte || 0,
        prestaciones: emp.dev_prestaciones_sociales || 0,
        bonificaciones: emp.dev_bonificaciones || 0,
        auxilios: emp.dev_auxilios || 0,
        otros: emp.dev_otros || 0,
        dedSeguridadSocial: emp.ded_seguridad_social || 0,
        dedRetencion: emp.ded_retencion_fuente || 0,
        dedOtros: emp.ded_otros || 0,
      },
    }));
  }, [payrollData]);

  // Period info
  const periodInfo = useMemo(() => {
    if (!payrollData) return null;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return {
      label: payrollData.period_name || `${monthNames[payrollData.month - 1]} ${payrollData.year}`,
      month: payrollData.month,
      year: payrollData.year,
    };
  }, [payrollData]);

  // Calculate totals from real data
  const totals = useMemo(() => {
    if (!payrollData) {
      return { totalDevengados: 0, totalDeducciones: 0, totalNeto: 0 };
    }
    return {
      totalDevengados: payrollData.total_devengados || 0,
      totalDeducciones: payrollData.total_deducciones || 0,
      totalNeto: payrollData.total_neto || 0,
    };
  }, [payrollData]);

  // KPI calculations
  const kpis = useMemo(() => {
    const employeeCount = employees.length;
    const currentPayroll = totals.totalNeto;
    // These would come from real income data in a full implementation
    const estimatedIncome = currentPayroll * 4; // Placeholder
    const productivity = currentPayroll > 0 ? estimatedIncome / currentPayroll : 0;
    const incomePercent = estimatedIncome > 0 ? (currentPayroll / estimatedIncome) * 100 : 0;

    return {
      employeeCount,
      currentPayroll,
      totalDevengados: totals.totalDevengados,
      totalDeducciones: totals.totalDeducciones,
      productivity,
      incomePercent,
      monthChange: 0, // Would need historical data
    };
  }, [employees, totals]);

  if (loading || loadingPayroll) {
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

  // Empty state - no payroll data yet
  if (!payrollData) {
    return (
      <div className="space-y-6">
        {/* Header with upload button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-[#17181A]">Nómina</h2>
            <p className="text-sm text-gray-500">Importa tu nómina desde Aleluya</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-[#17181A] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#26282C] transition-colors"
          >
            <Upload size={18} />
            Importar PDF de Aleluya
          </button>
        </div>

        {/* Empty state card */}
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#17181A] mb-2">Sin datos de nómina</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Sube tu PDF de nómina exportado desde Aleluya para ver el detalle de pagos y deducciones de tu equipo.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-indigo-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-600 transition-colors mx-auto"
          >
            <Upload size={18} />
            Subir PDF de Aleluya
          </button>
        </div>

        {/* Upload Modal */}
        {showUploadModal && renderUploadModal()}
      </div>
    );
  }

  // Render upload modal helper
  function renderUploadModal() {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[#17181A]">Importar Nómina de Aleluya</h2>
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
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="payroll-upload"
                disabled={uploading}
              />
              <label
                htmlFor="payroll-upload"
                className="cursor-pointer block"
              >
                {uploading ? (
                  <Loader2 className="w-12 h-12 text-indigo-500 mx-auto mb-3 animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                )}
                <p className="text-sm font-medium text-[#17181A] mb-1">
                  {uploading ? 'Procesando PDF...' : 'Haz clic para seleccionar PDF'}
                </p>
                <p className="text-xs text-gray-500">
                  PDF de nómina exportado desde Aleluya (máx. 15MB)
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
              <h4 className="text-sm font-medium text-[#17181A] mb-2">¿Cómo exportar desde Aleluya?</h4>
              <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>Ingresa a tu cuenta de Aleluya</li>
                <li>Ve a Nómina → Historial de Liquidaciones</li>
                <li>Selecciona el período y haz clic en "Exportar PDF"</li>
                <li>Sube el archivo aquí</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period info and upload button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[#17181A]">
            Nómina {periodInfo?.label || ''}
          </h2>
          <p className="text-sm text-gray-500">{employees.length} empleados</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="border border-gray-200 text-[#17181A] px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Upload size={18} />
          Importar otro período
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          title="Empleados"
          value={kpis.employeeCount}
          subtitle="En nómina"
          iconColor="indigo"
        />
        <KPICard
          icon={Briefcase}
          title="Total Pagado"
          value={formatCurrency(kpis.currentPayroll)}
          subtitle={periodInfo?.label || 'Este mes'}
          iconColor="violet"
        />
        <KPICard
          icon={TrendingUp}
          title="Total Devengados"
          value={formatCurrency(kpis.totalDevengados)}
          subtitle="Antes de deducciones"
          iconColor="emerald"
        />
        <KPICard
          icon={Percent}
          title="Total Deducciones"
          value={formatCurrency(kpis.totalDeducciones)}
          subtitle="Seg. Social + Retención"
          iconColor="amber"
        />
      </div>

      {/* Upload Modal */}
      {showUploadModal && renderUploadModal()}

      {/* Employee Cost Table with Expandable Rows */}
      <FinancialCard
        title="Detalle por Empleado"
        subtitle={`Liquidación ${periodInfo?.label || ''}`}
        span={12}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[180px]">
                  Empleado
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  Cargo
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                  Devengados
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                  Deducciones
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50 whitespace-nowrap">
                  Neto Pagado
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const isExpanded = expandedEmployees[emp.id];

                return (
                  <tbody key={emp.id}>
                    {/* Main Employee Row */}
                    <tr
                      className="cursor-pointer group hover:bg-gray-50 transition-colors"
                      onClick={() => toggleEmployee(emp.id)}
                    >
                      <td className="px-4 py-3 border-b border-gray-100">
                        <span className="font-semibold text-[#17181A] group-hover:text-indigo-600 transition-colors">
                          {isExpanded ? '▾' : '▸'} {emp.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-100 text-gray-500 whitespace-nowrap">
                        {emp.position}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-gray-100 whitespace-nowrap text-xs text-emerald-600 font-medium">
                        {formatCurrency(emp.totalDevengados)}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-gray-100 whitespace-nowrap text-xs text-red-500 font-medium">
                        -{formatCurrency(emp.totalDeducciones)}
                      </td>
                      <td className="px-4 py-3 text-right border-b border-gray-100 bg-gray-50 font-semibold whitespace-nowrap text-[#17181A]">
                        {formatCurrency(emp.totalPagado)}
                      </td>
                    </tr>

                    {/* Detail Rows - Shown when expanded */}
                    {isExpanded && (
                      <>
                        {/* Devengados Section Header */}
                        <tr className="bg-emerald-50">
                          <td colSpan="5" className="px-4 py-2 text-xs font-semibold text-emerald-700">
                            DEVENGADOS
                          </td>
                        </tr>
                        {/* Salario */}
                        {emp.breakdown.salario > 0 && (
                          <tr className="bg-emerald-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Salario
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-emerald-600">
                              {formatCurrency(emp.breakdown.salario)}
                            </td>
                          </tr>
                        )}
                        {/* Transporte */}
                        {emp.breakdown.transporte > 0 && (
                          <tr className="bg-emerald-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Auxilio de Transporte
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-emerald-600">
                              {formatCurrency(emp.breakdown.transporte)}
                            </td>
                          </tr>
                        )}
                        {/* Prestaciones */}
                        {emp.breakdown.prestaciones > 0 && (
                          <tr className="bg-emerald-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Prestaciones Sociales
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-emerald-600">
                              {formatCurrency(emp.breakdown.prestaciones)}
                            </td>
                          </tr>
                        )}
                        {/* Bonificaciones */}
                        {emp.breakdown.bonificaciones > 0 && (
                          <tr className="bg-emerald-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Bonificaciones
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-emerald-600">
                              {formatCurrency(emp.breakdown.bonificaciones)}
                            </td>
                          </tr>
                        )}
                        {/* Auxilios */}
                        {emp.breakdown.auxilios > 0 && (
                          <tr className="bg-emerald-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Auxilios
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-emerald-600">
                              {formatCurrency(emp.breakdown.auxilios)}
                            </td>
                          </tr>
                        )}
                        {/* Otros devengados */}
                        {emp.breakdown.otros > 0 && (
                          <tr className="bg-emerald-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Otros
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-emerald-600">
                              {formatCurrency(emp.breakdown.otros)}
                            </td>
                          </tr>
                        )}

                        {/* Deducciones Section Header */}
                        <tr className="bg-red-50">
                          <td colSpan="5" className="px-4 py-2 text-xs font-semibold text-red-700">
                            DEDUCCIONES
                          </td>
                        </tr>
                        {/* Seguridad Social */}
                        {emp.breakdown.dedSeguridadSocial > 0 && (
                          <tr className="bg-red-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Seguridad Social
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-red-500">
                              -{formatCurrency(emp.breakdown.dedSeguridadSocial)}
                            </td>
                          </tr>
                        )}
                        {/* Retención */}
                        {emp.breakdown.dedRetencion > 0 && (
                          <tr className="bg-red-50/50">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Retención en la Fuente
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-red-500">
                              -{formatCurrency(emp.breakdown.dedRetencion)}
                            </td>
                          </tr>
                        )}
                        {/* Otros descuentos */}
                        {emp.breakdown.dedOtros > 0 && (
                          <tr className="bg-red-50/50 border-b border-gray-100">
                            <td colSpan="3" className="px-4 py-1.5 pl-8 text-xs text-gray-600">
                              Otros Descuentos
                            </td>
                            <td colSpan="2" className="px-4 py-1.5 text-right text-xs text-red-500">
                              -{formatCurrency(emp.breakdown.dedOtros)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                );
              })}

              {/* Totals Row */}
              <tr className="bg-gray-100 font-semibold">
                <td colSpan="2" className="px-4 py-3 border-t-2 border-gray-200 text-[#17181A]">
                  TOTAL NÓMINA
                </td>
                <td className="px-4 py-3 text-right border-t-2 border-gray-200 whitespace-nowrap text-emerald-600">
                  {formatCurrency(totals.totalDevengados)}
                </td>
                <td className="px-4 py-3 text-right border-t-2 border-gray-200 whitespace-nowrap text-red-500">
                  -{formatCurrency(totals.totalDeducciones)}
                </td>
                <td className="px-4 py-3 text-right bg-gray-100 border-t-2 border-gray-200 text-[#17181A] whitespace-nowrap">
                  {formatCurrency(totals.totalNeto)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            Devengados (Salario + Prestaciones + Auxilios)
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
            Deducciones (Seg. Social + Retención)
          </div>
        </div>
      </FinancialCard>
    </div>
  );
};

export default PayrollSection;
