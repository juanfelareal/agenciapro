import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { portalFormsAPI } from '../../utils/portalApi';
import {
  ClipboardList,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight
} from 'lucide-react';

export default function PortalForms() {
  const { client } = usePortal();
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const response = await portalFormsAPI.getAll();
      setForms(response.forms || []);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Pendiente' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: ClipboardList, label: 'En progreso' },
      submitted: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Enviado' }
    };
    const style = styles[status] || styles.pending;
    const Icon = style.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="w-3.5 h-3.5" />
        {style.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isPastDue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getProgressPercent = (answered, total) => {
    if (!total || total === 0) return 0;
    return Math.round((answered / total) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Cargando formularios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">Formularios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Completa los formularios asignados a tu cuenta</p>
      </div>

      {/* Forms Grid */}
      {forms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map((form) => {
            const progress = getProgressPercent(form.fields_answered, form.fields_count);
            const pastDue = isPastDue(form.due_date) && form.status !== 'submitted';

            return (
              <div
                key={form.assignment_id}
                onClick={() => navigate(`/portal/forms/${form.assignment_id}`)}
                className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 cursor-pointer
                         hover:shadow-md hover:border-gray-200 transition-all group"
              >
                {/* Top row: title + arrow */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-[#1A1A2E] group-hover:text-blue-600 transition-colors line-clamp-1">
                    {form.form_title}
                  </h3>
                  <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                </div>

                {/* Description */}
                {form.form_description && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                    {form.form_description}
                  </p>
                )}

                {/* Status + Due date row */}
                <div className="flex items-center flex-wrap gap-2 mb-4">
                  {getStatusBadge(form.status)}
                  {form.due_date && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      pastDue ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      <Calendar className={`w-3.5 h-3.5 ${pastDue ? 'text-red-500' : 'text-gray-400'}`} />
                      {pastDue && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      {pastDue ? 'Vencido: ' : 'Fecha limite: '}
                      {formatDate(form.due_date)}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">
                      {form.fields_answered || 0} de {form.fields_count || 0} campos
                    </span>
                    <span className="text-xs font-medium text-gray-600">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress === 100
                          ? 'bg-green-500'
                          : progress > 0
                          ? 'bg-blue-500'
                          : 'bg-gray-200'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">No tienes formularios asignados</h3>
          <p className="text-gray-500">
            Cuando te asignen un formulario aparecera aqui.
          </p>
        </div>
      )}
    </div>
  );
}
