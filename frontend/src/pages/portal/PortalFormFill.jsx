import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { portalFormsAPI } from '../../utils/portalApi';
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function PortalFormFill() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState(null);
  const [sections, setSections] = useState([]);
  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fieldRefs = useRef({});
  const dirtyRef = useRef(false);
  const formDataRef = useRef({});

  // Keep refs in sync
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Load form data
  useEffect(() => {
    loadForm();
  }, [assignmentId]);

  const loadForm = async () => {
    try {
      const response = await portalFormsAPI.getById(assignmentId);
      setAssignment(response.assignment);
      setSections(response.sections || []);
      setFormData(response.responseData || {});
    } catch (error) {
      console.error('Error loading form:', error);
      setErrorMessage('Error al cargar el formulario. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save draft every 30 seconds if dirty
  useEffect(() => {
    if (assignment?.status === 'submitted') return;

    const interval = setInterval(() => {
      if (dirtyRef.current) {
        handleSaveDraft(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [assignmentId, assignment?.status]);

  const handleFieldChange = useCallback((fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setIsDirty(true);
    // Clear error for this field if it was missing
    setMissingFields(prev => prev.filter(id => id !== fieldId));
  }, []);

  const handleSaveDraft = async (silent = false) => {
    if (saving || submitting) return;
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await portalFormsAPI.saveDraft(assignmentId, formDataRef.current);
      setIsDirty(false);
      if (!silent) {
        setSuccessMessage('Borrador guardado');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      if (!silent) {
        setErrorMessage('Error al guardar el borrador. Intenta de nuevo.');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || saving) return;
    setSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');
    setMissingFields([]);

    try {
      await portalFormsAPI.submit(assignmentId, formData);
      navigate('/portal/forms', {
        state: { message: 'Formulario enviado exitosamente' }
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      const data = error.response?.data;

      if (data?.missing_fields && data.missing_fields.length > 0) {
        setMissingFields(data.missing_fields);
        setErrorMessage(data.error || 'Completa los campos requeridos antes de enviar.');

        // Scroll to first missing field
        const firstMissing = data.missing_fields[0];
        const ref = fieldRefs.current[firstMissing];
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setErrorMessage(data?.error || 'Error al enviar el formulario. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const parseOptions = (options) => {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const isReadOnly = assignment?.status === 'submitted';

  // Render a single field based on type
  const renderField = (field) => {
    const value = formData[field.id] || '';
    const isMissing = missingFields.includes(field.id);
    const baseInputClasses = `w-full px-4 py-2.5 bg-gray-50 border rounded-xl
      focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
      transition-colors`;
    const borderClass = isMissing ? 'border-red-400' : 'border-gray-200';
    const disabledClass = isReadOnly ? 'opacity-70 cursor-not-allowed bg-gray-100' : '';

    switch (field.field_type) {
      case 'short_text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="Escribe tu respuesta..."
            className={`${baseInputClasses} ${borderClass} ${disabledClass}`}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="0"
            className={`${baseInputClasses} ${borderClass} ${disabledClass}`}
          />
        );

      case 'multiple_choice': {
        const options = parseOptions(field.options);
        return (
          <div className="space-y-2">
            {options.map((option, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer
                  transition-colors ${
                    value === option
                      ? 'border-green-400 bg-green-50'
                      : isMissing
                        ? 'border-red-400 bg-white'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={option}
                  checked={value === option}
                  onChange={() => handleFieldChange(field.id, option)}
                  disabled={isReadOnly}
                  className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );
      }

      case 'yes_no':
        return (
          <div className="flex gap-3">
            {['Sí', 'No'].map((option) => (
              <label
                key={option}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border
                  cursor-pointer transition-colors font-medium ${
                    value === option
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : isMissing
                        ? 'border-red-400 bg-white text-gray-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  } ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={option}
                  checked={value === option}
                  onChange={() => handleFieldChange(field.id, option)}
                  disabled={isReadOnly}
                  className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                />
                {option}
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="Escribe tu respuesta..."
            className={`${baseInputClasses} ${borderClass} ${disabledClass}`}
          />
        );
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Error state - no assignment loaded
  if (!assignment) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-[#1A1A2E]">Formulario no encontrado</h2>
        <p className="text-gray-500 mt-2 mb-4">Este formulario no existe o no tienes acceso.</p>
        <Link to="/portal/forms" className="text-[#1A1A2E] hover:underline">
          Volver a formularios
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back button */}
      <Link
        to="/portal/forms"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-[#1A1A2E] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver</span>
      </Link>

      {/* Form header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">
          {assignment.form_title}
        </h1>
        {assignment.form_description && (
          <p className="text-gray-500 mt-1">{assignment.form_description}</p>
        )}
      </div>

      {/* Submitted banner */}
      {isReadOnly && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-800">Este formulario ya fue enviado</p>
            <p className="text-sm text-green-700">Las respuestas se muestran en modo de solo lectura.</p>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800 font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <div
          key={section.id}
          className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden"
        >
          {/* Section header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#1A1A2E]">{section.title}</h2>
            {section.description && (
              <p className="text-sm text-gray-500 mt-1">{section.description}</p>
            )}
          </div>

          {/* Section fields */}
          <div className="px-6 py-5 space-y-6">
            {section.fields.map((field) => (
              <div
                key={field.id}
                ref={(el) => { fieldRefs.current[field.id] = el; }}
              >
                {/* Label */}
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.is_required && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </label>

                {/* Field input */}
                {renderField(field)}

                {/* Help text */}
                {field.help_text && (
                  <p className="text-xs text-slate-400 mt-1.5">{field.help_text}</p>
                )}

                {/* Missing field error */}
                {missingFields.includes(field.id) && (
                  <p className="text-xs text-red-500 mt-1.5">Este campo es requerido</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Action buttons */}
      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <button
            onClick={() => handleSaveDraft(false)}
            disabled={saving || submitting}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-200
                     text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || submitting}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1A1A2E] text-white
                     rounded-xl hover:bg-gray-800 transition-colors font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {submitting ? 'Enviando...' : 'Enviar formulario'}
          </button>
        </div>
      )}
    </div>
  );
}
