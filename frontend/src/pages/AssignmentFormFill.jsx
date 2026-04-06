import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, AlertCircle, CheckCircle2, Send, Save, Building2, ClipboardList
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function AssignmentFormFill() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [sections, setSections] = useState([]);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fieldRefs = useRef({});
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    loadForm();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [token]);

  // Auto-save every 30 seconds when dirty
  useEffect(() => {
    if (dirty && !submitted && assignment?.status !== 'submitted') {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => saveDraft(true), 30000);
    }
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [dirty, formData, submitted]);

  const loadForm = async () => {
    try {
      const res = await fetch(`${API_URL}/form-share/assignment/${token}`);
      if (!res.ok) {
        setError('Este formulario no existe o el enlace ya no es válido.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setForm(data.form);
      setAssignment(data.assignment);
      setSections(data.sections || []);
      if (data.assignment.status === 'submitted') {
        setSubmitted(true);
      }
      // Load draft data
      const draft = typeof data.draftData === 'string' ? JSON.parse(data.draftData) : data.draftData;
      if (draft && Object.keys(draft).length > 0) {
        setFormData(draft);
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar el formulario. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setMissingFields(prev => prev.filter(id => id !== fieldId));
    setDirty(true);
    setSaved(false);
  };

  const saveDraft = useCallback(async (isAuto = false) => {
    if (saving || submitting || submitted) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/form-share/assignment/${token}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: formData }),
      });
      if (res.ok) {
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      setSaving(false);
    }
  }, [formData, saving, submitting, submitted, token]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setMissingFields([]);

    try {
      const res = await fetch(`${API_URL}/form-share/assignment/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: formData }),
      });
      const result = await res.json();

      if (!res.ok) {
        if (result.missing_fields?.length > 0) {
          setMissingFields(result.missing_fields);
          setError(result.error || 'Completa los campos requeridos.');
          const firstRef = fieldRefs.current[result.missing_fields[0]];
          if (firstRef) firstRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setError(result.error || 'Error al enviar.');
        }
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const parseOptions = (options) => {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    try { return JSON.parse(options); } catch { return []; }
  };

  const renderField = (field) => {
    const value = formData[field.id] || '';
    const isMissing = missingFields.includes(field.id);
    const isReadOnly = submitted;
    const base = `w-full px-4 py-2.5 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] transition-colors ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`;
    const border = isMissing ? 'border-red-400' : 'border-gray-200';

    switch (field.field_type) {
      case 'short_text':
        return <input type="text" value={value} onChange={e => handleFieldChange(field.id, e.target.value)}
          placeholder="Escribe tu respuesta..." className={`${base} ${border}`} disabled={isReadOnly} />;
      case 'number':
        return <input type="number" value={value} onChange={e => handleFieldChange(field.id, e.target.value)}
          placeholder="0" className={`${base} ${border}`} disabled={isReadOnly} />;
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {parseOptions(field.options).map((option, idx) => (
              <label key={idx} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                value === option ? 'border-[#1A1A2E] bg-[#1A1A2E]/5' : isMissing ? 'border-red-400 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'
              } ${isReadOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                <input type="radio" name={`field-${field.id}`} value={option} checked={value === option}
                  onChange={() => handleFieldChange(field.id, option)} disabled={isReadOnly}
                  className="w-4 h-4 text-[#1A1A2E] border-gray-300" />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );
      case 'yes_no':
        return (
          <div className="flex gap-3">
            {['Sí', 'No'].map(option => (
              <label key={option} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-colors font-medium ${
                value === option ? 'border-[#1A1A2E] bg-[#1A1A2E]/5 text-[#1A1A2E]' : isMissing ? 'border-red-400 bg-white text-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              } ${isReadOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                <input type="radio" name={`field-${field.id}`} value={option} checked={value === option}
                  onChange={() => handleFieldChange(field.id, option)} disabled={isReadOnly}
                  className="w-4 h-4 text-[#1A1A2E] border-gray-300" />
                {option}
              </label>
            ))}
          </div>
        );
      default:
        return <input type="text" value={value} onChange={e => handleFieldChange(field.id, e.target.value)}
          placeholder="Escribe tu respuesta..." className={`${base} ${border}`} disabled={isReadOnly} />;
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Error (form not found)
  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Formulario no disponible</h1>
          <p className="text-gray-500">{error || 'Este enlace no es válido o el formulario ya no está disponible.'}</p>
        </div>
      </div>
    );
  }

  // Submitted success
  if (submitted && !sections.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Formulario enviado</h1>
          <p className="text-gray-500">Las respuestas han sido registradas exitosamente.</p>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Building2 className="w-4 h-4" />
            {assignment.client_name}
            {assignment.company && assignment.client_name !== assignment.company && (
              <span className="text-gray-400">— {assignment.company}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{form.title}</h1>
          {form.description && <p className="text-gray-500 mt-1">{form.description}</p>}
          {assignment.due_date && (
            <p className="text-sm text-gray-400 mt-2">Fecha límite: {new Date(assignment.due_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          )}
        </div>

        {/* Status banner */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 mb-6">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-medium text-sm">Este formulario ya fue enviado. Las respuestas son de solo lectura.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 font-medium text-sm">{error}</p>
          </div>
        )}

        {/* Sections */}
        {sections.map(section => (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">{section.title}</h2>
              {section.description && <p className="text-sm text-gray-500 mt-1">{section.description}</p>}
            </div>
            <div className="px-6 py-5 space-y-6">
              {section.fields.map(field => (
                <div key={field.id} ref={el => { fieldRefs.current[field.id] = el; }}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {field.label}
                    {field.is_required ? <span className="text-red-500 ml-0.5">*</span> : null}
                  </label>
                  {renderField(field)}
                  {field.help_text && <p className="text-xs text-gray-400 mt-1.5">{field.help_text}</p>}
                  {missingFields.includes(field.id) && (
                    <p className="text-xs text-red-500 mt-1.5">Este campo es requerido</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Actions */}
        {!submitted && (
          <div className="py-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => saveDraft(false)}
              disabled={saving || !dirty}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar borrador'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#2a2a3e] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Enviando...' : 'Enviar formulario'}
            </button>
          </div>
        )}

        {/* Save status */}
        {saved && !submitted && (
          <div className="flex items-center gap-2 text-green-600 text-sm pb-4">
            <CheckCircle2 className="w-4 h-4" /> Borrador guardado
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-8">Formulario seguro</p>
      </div>
    </div>
  );
}
