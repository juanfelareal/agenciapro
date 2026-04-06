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
  CalendarDays,
  X
} from 'lucide-react';

export default function PortalDashboard() {
  const { client, welcomeMessage } = usePortal();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [respondForm, setRespondForm] = useState({ will_participate: null, has_offer: false, offer_description: '', client_notes: '' });
  const [saving, setSaving] = useState(false);

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

  const openDateResponse = (cd) => {
    setSelectedDate(cd);
    setRespondForm({
      will_participate: cd.will_participate ?? null,
      has_offer: cd.has_offer ?? false,
      offer_description: cd.offer_description || '',
      client_notes: cd.client_notes || ''
    });
  };

  const handleSaveResponse = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      await portalDashboardAPI.respondCommercialDate(selectedDate.id, respondForm);
      // Update local data
      setData(prev => ({
        ...prev,
        commercial_dates: prev.commercial_dates.map(cd =>
          cd.id === selectedDate.id ? { ...cd, ...respondForm, client_response_at: new Date().toISOString() } : cd
        )
      }));
      setSelectedDate(null);
    } catch (error) {
      console.error('Error saving response:', error);
    } finally {
      setSaving(false);
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
          <div className="divide-y divide-gray-50">
            {data.priorities.map((task) => {
              const days = daysUntil(task.due_date);
              return (
                <div key={task.id} className="flex items-center justify-between px-6 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{task.project_name}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ml-3 ${
                    days <= 2 ? 'bg-red-100 text-red-700' :
                    days <= 7 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${formatDate(task.due_date)}`}
                  </span>
                </div>
              );
            })}
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
              const hasResponse = cd.client_response_at != null;
              return (
                <button
                  key={cd.id}
                  onClick={() => openDateResponse(cd)}
                  className="flex items-center justify-between px-6 py-3.5 w-full text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-shrink-0 w-12">
                      <p className="text-lg font-bold text-[#1A1A2E] leading-tight">
                        {new Date(cd.date + 'T12:00:00').getDate()}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase font-medium">
                        {new Date(cd.date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-800 font-medium">{cd.title}</p>
                      {hasResponse && (
                        <p className="text-xs mt-0.5">
                          {cd.will_participate ? (
                            <span className="text-green-600">Vamos a participar{cd.has_offer ? ` · Oferta: ${cd.offer_description}` : ''}{cd.client_notes ? ` · ${cd.client_notes}` : ''}</span>
                          ) : (
                            <span className="text-gray-400">No participaremos{cd.client_notes ? ` · ${cd.client_notes}` : ''}</span>
                          )}
                        </p>
                      )}
                      {!hasResponse && (
                        <p className="text-xs text-blue-500 mt-0.5">Clic para responder</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                    days <= 7 ? 'bg-red-100 text-red-700' :
                    days <= 30 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`}
                  </span>
                </button>
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
      {/* Commercial Date Response Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#1A1A2E]">{selectedDate.title}</h3>
                <p className="text-sm text-gray-500">{formatDate(selectedDate.date)}</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">¿Van a participar en esta fecha?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRespondForm(f => ({ ...f, will_participate: true }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                      respondForm.will_participate === true
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    Sí, participaremos
                  </button>
                  <button
                    onClick={() => setRespondForm(f => ({ ...f, will_participate: false, has_offer: false, offer_description: '' }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                      respondForm.will_participate === false
                        ? 'border-red-400 bg-red-50 text-red-600'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    No participaremos
                  </button>
                </div>
              </div>

              {respondForm.will_participate && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={respondForm.has_offer}
                      onChange={e => setRespondForm(f => ({ ...f, has_offer: e.target.checked, offer_description: e.target.checked ? f.offer_description : '' }))}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-700">Tendremos una oferta especial</span>
                  </label>
                  {respondForm.has_offer && (
                    <textarea
                      value={respondForm.offer_description}
                      onChange={e => setRespondForm(f => ({ ...f, offer_description: e.target.value }))}
                      placeholder="Describe la oferta (ej: 20% de descuento en toda la tienda, 2x1 en productos seleccionados...)"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] resize-none"
                      rows={3}
                    />
                  )}
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Observaciones</p>
                <textarea
                  value={respondForm.client_notes}
                  onChange={e => setRespondForm(f => ({ ...f, client_notes: e.target.value }))}
                  placeholder="Notas adicionales, comentarios o instrucciones..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] resize-none"
                  rows={3}
                />
              </div>

              <button
                onClick={handleSaveResponse}
                disabled={respondForm.will_participate === null || saving}
                className="w-full py-3 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#252542] disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Guardando...' : 'Guardar respuesta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
