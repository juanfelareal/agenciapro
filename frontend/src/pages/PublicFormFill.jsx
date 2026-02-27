import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, AlertCircle, CheckCircle2, Send, ArrowRight, User, ClipboardList
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function PublicFormFill() {
  const { token } = useParams();
  const [step, setStep] = useState('name'); // name | form | success
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [respondentName, setRespondentName] = useState('');
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [missingFields, setMissingFields] = useState([]);
  const fieldRefs = useRef({});

  useEffect(() => {
    loadForm();
  }, [token]);

  const loadForm = async () => {
    try {
      const res = await fetch(`${API_URL}/form-share/public/${token}`);
      if (!res.ok) {
        setError('Este formulario no existe o el enlace ya no es válido.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setForm(data.form);
      setSections(data.sections || []);
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
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setMissingFields([]);

    try {
      const res = await fetch(`${API_URL}/form-share/public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respondent_name: respondentName, data: formData }),
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

      setStep('success');
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
    const base = 'w-full px-4 py-2.5 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] transition-colors';
    const border = isMissing ? 'border-red-400' : 'border-gray-200';

    switch (field.field_type) {
      case 'short_text':
        return <input type="text" value={value} onChange={e => handleFieldChange(field.id, e.target.value)}
          placeholder="Escribe tu respuesta..." className={`${base} ${border}`} />;
      case 'number':
        return <input type="number" value={value} onChange={e => handleFieldChange(field.id, e.target.value)}
          placeholder="0" className={`${base} ${border}`} />;
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {parseOptions(field.options).map((option, idx) => (
              <label key={idx} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                value === option ? 'border-[#1A1A2E] bg-[#1A1A2E]/5' : isMissing ? 'border-red-400 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <input type="radio" name={`field-${field.id}`} value={option} checked={value === option}
                  onChange={() => handleFieldChange(field.id, option)}
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
              }`}>
                <input type="radio" name={`field-${field.id}`} value={option} checked={value === option}
                  onChange={() => handleFieldChange(field.id, option)}
                  className="w-4 h-4 text-[#1A1A2E] border-gray-300" />
                {option}
              </label>
            ))}
          </div>
        );
      default:
        return <input type="text" value={value} onChange={e => handleFieldChange(field.id, e.target.value)}
          placeholder="Escribe tu respuesta..." className={`${base} ${border}`} />;
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

  // Success
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Formulario enviado</h1>
          <p className="text-gray-500">Gracias, {respondentName}. Tu respuesta ha sido registrada exitosamente.</p>
        </div>
      </div>
    );
  }

  // Name step
  if (step === 'name') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="w-12 h-12 bg-[#1A1A2E] rounded-xl flex items-center justify-center mb-6">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{form.title}</h1>
            {form.description && (
              <p className="text-gray-500 text-sm mb-6">{form.description}</p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tu nombre completo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={respondentName}
                    onChange={e => setRespondentName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && respondentName.trim()) setStep('form'); }}
                    placeholder="Ingresa tu nombre"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 focus:border-[#1A1A2E] transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={() => setStep('form')}
                disabled={!respondentName.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#2a2a3e] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">Formulario seguro</p>
        </div>
      </div>
    );
  }

  // Form step
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <User className="w-4 h-4" /> {respondentName}
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{form.title}</h1>
          {form.description && <p className="text-gray-500 mt-1">{form.description}</p>}
        </div>

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

        {/* Submit */}
        <div className="py-6">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#2a2a3e] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Enviando...' : 'Enviar formulario'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 pb-8">Formulario seguro</p>
      </div>
    </div>
  );
}
