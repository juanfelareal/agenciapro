import { useState, useEffect } from 'react';
import { usePortal } from '../../context/PortalContext';
import { portalDashboardAPI } from '../../utils/portalApi';
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  Calendar,
  ClipboardList,
  ExternalLink,
  Zap,
  CalendarDays
} from 'lucide-react';

export default function PortalDashboard() {
  const { client, welcomeMessage } = usePortal();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await portalDashboardAPI.get();
      setData(response);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  };

  const daysUntil = (dateStr) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T12:00:00');
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d - now) / 86400000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#1A1A2E] via-[#16213e] to-[#0f3460] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.1),transparent_60%)]" />
        <div className="relative">
          <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">Panel de Control</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
            Hola, {client?.name?.split(' ')[0]}
          </h1>
          {welcomeMessage ? (
            <p className="mt-2 text-gray-300 max-w-xl">{welcomeMessage}</p>
          ) : (
            <p className="mt-2 text-gray-300 max-w-xl">
              Aquí tienes un resumen de lo que estamos trabajando para ti.
            </p>
          )}
        </div>
      </div>

      {/* Priorities */}
      {data?.priorities?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A2E]">Nuestra prioridad los próximos días</h2>
            </div>
          </div>
          <div className="px-6 py-4">
            <ul className="space-y-3">
              {data.priorities.map((p, idx) => (
                <li key={p.id} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-gray-800">{p.title}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Commercial Dates */}
      {data?.commercial_dates?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A2E]">Fechas comerciales</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.commercial_dates.map((cd) => {
              const days = daysUntil(cd.date);
              return (
                <div key={cd.id} className="flex items-center justify-between px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-shrink-0 w-12">
                      <p className="text-lg font-bold text-[#1A1A2E] leading-tight">
                        {new Date(cd.date + 'T12:00:00').getDate()}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase font-medium">
                        {new Date(cd.date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short' })}
                      </p>
                    </div>
                    <p className="text-gray-800 font-medium">{cd.title}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                    days <= 7 ? 'bg-red-100 text-red-700' :
                    days <= 30 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assigned Forms */}
      {data?.assigned_forms?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A2E]">Formularios</h2>
              <p className="text-sm text-gray-500">Formularios asignados para completar</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.assigned_forms.map((form) => {
              const isSubmitted = form.status === 'submitted';
              const isDraft = form.status === 'draft';
              return (
                <a
                  key={form.id}
                  href={`/fa/${form.share_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A1A2E]">{form.form_title}</p>
                    {form.form_description && (
                      <p className="text-sm text-gray-400 truncate mt-0.5">{form.form_description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isSubmitted ? 'bg-green-100 text-green-700' :
                        isDraft ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {isSubmitted ? 'Enviado' : isDraft ? 'En borrador' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  {isSubmitted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
