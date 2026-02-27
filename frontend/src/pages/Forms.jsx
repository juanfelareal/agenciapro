import { useState, useEffect } from 'react';
import {
  ClipboardList, Plus, Search, ChevronLeft, Trash2, Copy, Send,
  GripVertical, ChevronDown, ChevronUp, AlertTriangle, Eye,
  FileText, X, Calendar, Check, User
} from 'lucide-react';
import { formsAPI, clientsAPI } from '../utils/api';

const STATUS_LABELS = {
  draft: { label: 'Borrador', color: 'bg-slate-100 text-slate-600' },
  published: { label: 'Publicado', color: 'bg-green-100 text-green-700' },
  archived: { label: 'Archivado', color: 'bg-amber-100 text-amber-700' },
};

const ASSIGNMENT_STATUS = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  draft: { label: 'En progreso', color: 'bg-blue-100 text-blue-700' },
  submitted: { label: 'Enviado', color: 'bg-green-100 text-green-700' },
};

const FIELD_TYPES = [
  { value: 'short_text', label: 'Texto corto' },
  { value: 'number', label: 'Número' },
  { value: 'multiple_choice', label: 'Opción múltiple' },
  { value: 'yes_no', label: 'Sí / No' },
];

export default function Forms() {
  const [view, setView] = useState('list'); // list | builder | response
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Builder state
  const [editingForm, setEditingForm] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('draft');
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeAssignments, setActiveAssignments] = useState(0);

  // Assignment state
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [clients, setClients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Response viewer
  const [responseData, setResponseData] = useState(null);

  useEffect(() => {
    if (view === 'list') loadForms();
  }, [view, search, statusFilter]);

  const loadForms = async () => {
    try {
      setLoading(true);
      const { data } = await formsAPI.getAll({ search: search || undefined, status: statusFilter || undefined });
      setForms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openBuilder = async (form = null) => {
    if (form) {
      try {
        const { data } = await formsAPI.getById(form.id);
        setEditingForm(data);
        setFormTitle(data.title);
        setFormDescription(data.description || '');
        setFormStatus(data.status);
        setSections(data.sections || []);
        setActiveAssignments(data.active_assignments || 0);
      } catch (err) {
        console.error(err);
        return;
      }
    } else {
      setEditingForm(null);
      setFormTitle('');
      setFormDescription('');
      setFormStatus('draft');
      setSections([{ title: 'Sección 1', description: '', fields: [] }]);
      setActiveAssignments(0);
    }
    setShowAssignPanel(false);
    setAssignments([]);
    setView('builder');
  };

  const saveForm = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const payload = { title: formTitle, description: formDescription, status: formStatus, sections };
      if (editingForm) {
        await formsAPI.update(editingForm.id, payload);
      } else {
        const { data } = await formsAPI.create(payload);
        setEditingForm(data);
      }
      setView('list');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteForm = async (id) => {
    if (!confirm('¿Eliminar este formulario?')) return;
    try {
      await formsAPI.delete(id);
      loadForms();
    } catch (err) {
      console.error(err);
    }
  };

  const duplicateForm = async (id) => {
    try {
      await formsAPI.duplicate(id);
      loadForms();
    } catch (err) {
      console.error(err);
    }
  };

  // Section helpers
  const addSection = () => {
    setSections([...sections, { title: `Sección ${sections.length + 1}`, description: '', fields: [] }]);
  };

  const updateSection = (idx, key, value) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [key]: value };
    setSections(updated);
  };

  const removeSection = (idx) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const moveSection = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const updated = [...sections];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setSections(updated);
  };

  // Field helpers
  const addField = (sectionIdx) => {
    const updated = [...sections];
    updated[sectionIdx].fields = [
      ...updated[sectionIdx].fields,
      { label: '', field_type: 'short_text', help_text: '', is_required: false, options: [] }
    ];
    setSections(updated);
  };

  const updateField = (sectionIdx, fieldIdx, key, value) => {
    const updated = [...sections];
    updated[sectionIdx].fields[fieldIdx] = { ...updated[sectionIdx].fields[fieldIdx], [key]: value };
    setSections(updated);
  };

  const removeField = (sectionIdx, fieldIdx) => {
    const updated = [...sections];
    updated[sectionIdx].fields = updated[sectionIdx].fields.filter((_, i) => i !== fieldIdx);
    setSections(updated);
  };

  // Assignment helpers
  const loadAssignments = async () => {
    if (!editingForm) return;
    try {
      const [assignRes, clientRes] = await Promise.all([
        formsAPI.getAssignments(editingForm.id),
        clientsAPI.getAll()
      ]);
      setAssignments(assignRes.data);
      setClients(clientRes.data);
      setShowAssignPanel(true);
    } catch (err) {
      console.error(err);
    }
  };

  const assignForm = async () => {
    if (!selectedClient || !editingForm) return;
    try {
      await formsAPI.assign(editingForm.id, { client_id: parseInt(selectedClient), due_date: dueDate || undefined });
      setSelectedClient('');
      setDueDate('');
      const { data } = await formsAPI.getAssignments(editingForm.id);
      setAssignments(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al asignar');
    }
  };

  const removeAssignment = async (assignmentId) => {
    if (!confirm('¿Quitar esta asignación?')) return;
    try {
      await formsAPI.removeAssignment(assignmentId);
      const { data } = await formsAPI.getAssignments(editingForm.id);
      setAssignments(data);
    } catch (err) {
      console.error(err);
    }
  };

  // View response
  const viewResponse = async (assignmentId) => {
    try {
      const { data } = await formsAPI.getResponse(assignmentId);
      setResponseData(data);
      setView('response');
    } catch (err) {
      console.error(err);
    }
  };

  // ============ RENDER ============

  if (view === 'response' && responseData) {
    return <ResponseViewer data={responseData} onBack={() => { setResponseData(null); setView('builder'); }} />;
  }

  if (view === 'builder') {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700">
            <ChevronLeft size={20} /> Volver
          </button>
          <div className="flex items-center gap-3">
            {editingForm && (
              <button onClick={loadAssignments} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm">
                <Send size={16} /> Asignar
              </button>
            )}
            <button onClick={saveForm} disabled={saving || !formTitle.trim()} className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2a2a3e] disabled:opacity-50 text-sm">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Warning for active assignments */}
        {activeAssignments > 0 && (
          <div className="flex items-center gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
            Este formulario tiene {activeAssignments} asignación(es) activa(s). Los cambios afectarán a los clientes que aún no lo han enviado.
          </div>
        )}

        {/* Form title & description */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <input
            type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
            placeholder="Título del formulario"
            className="w-full text-2xl font-bold text-slate-800 border-0 border-b border-slate-200 pb-3 mb-3 focus:outline-none focus:border-[#1A1A2E] placeholder:text-slate-300"
          />
          <textarea
            value={formDescription} onChange={e => setFormDescription(e.target.value)}
            placeholder="Descripción o instrucciones para el cliente..."
            rows={2}
            className="w-full text-sm text-slate-600 border-0 focus:outline-none resize-none placeholder:text-slate-300"
          />
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">Estado:</span>
            {['draft', 'published', 'archived'].map(s => (
              <button key={s} onClick={() => setFormStatus(s)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${formStatus === s ? STATUS_LABELS[s].color + ' font-medium' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                {STATUS_LABELS[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-200">
              <GripVertical size={16} className="text-slate-400" />
              <input
                type="text" value={section.title} onChange={e => updateSection(sIdx, 'title', e.target.value)}
                className="flex-1 font-semibold text-slate-700 bg-transparent border-0 focus:outline-none"
                placeholder="Nombre de sección"
              />
              <div className="flex items-center gap-1">
                <button onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0} className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"><ChevronUp size={16} /></button>
                <button onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1} className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"><ChevronDown size={16} /></button>
                <button onClick={() => removeSection(sIdx)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="p-4">
              <input
                type="text" value={section.description || ''} onChange={e => updateSection(sIdx, 'description', e.target.value)}
                placeholder="Descripción de la sección (opcional)"
                className="w-full text-sm text-slate-500 mb-4 border-0 focus:outline-none placeholder:text-slate-300"
              />

              {/* Fields */}
              {section.fields.map((field, fIdx) => (
                <div key={fIdx} className="flex gap-3 items-start p-3 mb-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text" value={field.label} onChange={e => updateField(sIdx, fIdx, 'label', e.target.value)}
                        placeholder="Pregunta"
                        className="flex-1 text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]"
                      />
                      <select value={field.field_type} onChange={e => updateField(sIdx, fIdx, 'field_type', e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                        {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <input
                      type="text" value={field.help_text || ''} onChange={e => updateField(sIdx, fIdx, 'help_text', e.target.value)}
                      placeholder="Texto de ayuda (opcional)"
                      className="w-full text-xs text-slate-400 border-0 focus:outline-none placeholder:text-slate-300"
                    />
                    {field.field_type === 'multiple_choice' && (
                      <OptionsEditor
                        options={field.options || []}
                        onChange={opts => updateField(sIdx, fIdx, 'options', opts)}
                      />
                    )}
                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                      <input type="checkbox" checked={!!field.is_required} onChange={e => updateField(sIdx, fIdx, 'is_required', e.target.checked)}
                        className="rounded border-slate-300" />
                      Obligatorio
                    </label>
                  </div>
                  <button onClick={() => removeField(sIdx, fIdx)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 mt-1">
                    <X size={16} />
                  </button>
                </div>
              ))}

              <button onClick={() => addField(sIdx)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#1A1A2E] py-2">
                <Plus size={16} /> Agregar campo
              </button>
            </div>
          </div>
        ))}

        <button onClick={addSection} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#1A1A2E] py-3 px-4 border border-dashed border-slate-300 rounded-xl w-full justify-center hover:border-slate-400">
          <Plus size={16} /> Agregar sección
        </button>

        {/* Assign Panel */}
        {showAssignPanel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800">Asignar formulario</h3>
                <button onClick={() => setShowAssignPanel(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="flex gap-2">
                  <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]">
                    <option value="">Seleccionar cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                  </select>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  <button onClick={assignForm} disabled={!selectedClient}
                    className="px-4 py-2 bg-[#1A1A2E] text-white rounded-lg text-sm hover:bg-[#2a2a3e] disabled:opacity-50">
                    Asignar
                  </button>
                </div>

                {assignments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium">Asignaciones ({assignments.length})</p>
                    {assignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{a.client_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ASSIGNMENT_STATUS[a.status]?.color || 'bg-slate-100'}`}>
                              {ASSIGNMENT_STATUS[a.status]?.label || a.status}
                            </span>
                            {a.due_date && <span className="text-xs text-slate-400">{a.due_date}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {a.status === 'submitted' && (
                            <button onClick={() => { setShowAssignPanel(false); viewResponse(a.id); }}
                              className="p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600" title="Ver respuesta">
                              <Eye size={16} />
                            </button>
                          )}
                          <button onClick={() => removeAssignment(a.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Formularios</h1>
          <p className="text-sm text-slate-500 mt-1">Crea y asigna formularios a tus clientes</p>
        </div>
        <button onClick={() => openBuilder()} className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2a2a3e] text-sm">
          <Plus size={18} /> Nuevo formulario
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar formularios..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1A1A2E]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Cargando formularios...</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">{search || statusFilter ? 'No se encontraron formularios' : 'No hay formularios aún'}</p>
          <p className="text-sm text-slate-400 mt-1">Crea uno para empezar a recopilar datos de tus clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map(form => (
            <div key={form.id} onClick={() => openBuilder(form)}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-800 group-hover:text-[#1A1A2E] line-clamp-1">{form.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${STATUS_LABELS[form.status]?.color || 'bg-slate-100'}`}>
                  {STATUS_LABELS[form.status]?.label || form.status}
                </span>
              </div>
              {form.description && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{form.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3 mt-auto">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Send size={12} /> {form.assignment_count || 0} asignados</span>
                  <span className="flex items-center gap-1"><Check size={12} /> {form.submitted_count || 0} enviados</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => duplicateForm(form.id)} className="p-1.5 hover:bg-slate-100 rounded" title="Duplicar">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => deleteForm(form.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ OPTIONS EDITOR (for multiple choice fields) ============
function OptionsEditor({ options, onChange }) {
  const parsed = Array.isArray(options) ? options : (typeof options === 'string' ? JSON.parse(options) : []);

  const addOption = () => onChange([...parsed, '']);
  const updateOption = (idx, val) => {
    const updated = [...parsed];
    updated[idx] = val;
    onChange(updated);
  };
  const removeOption = (idx) => onChange(parsed.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1 pl-2 border-l-2 border-slate-200">
      <p className="text-xs text-slate-400 mb-1">Opciones:</p>
      {parsed.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-slate-300 flex-shrink-0" />
          <input type="text" value={opt} onChange={e => updateOption(idx, e.target.value)}
            placeholder={`Opción ${idx + 1}`}
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none" />
          <button onClick={() => removeOption(idx)} className="text-slate-400 hover:text-red-500"><X size={12} /></button>
        </div>
      ))}
      <button onClick={addOption} className="text-xs text-slate-400 hover:text-[#1A1A2E] flex items-center gap-1 pt-1">
        <Plus size={12} /> Agregar opción
      </button>
    </div>
  );
}

// ============ RESPONSE VIEWER ============
function ResponseViewer({ data, onBack }) {
  const { assignment, sections, response } = data;
  const answers = response?.data || {};
  const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6">
        <ChevronLeft size={20} /> Volver
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-800">{assignment.form_title}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${ASSIGNMENT_STATUS[assignment.status]?.color}`}>
            {ASSIGNMENT_STATUS[assignment.status]?.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1"><User size={14} /> {assignment.client_name}</span>
          {assignment.company && <span>{assignment.company}</span>}
          {response?.submitted_at && (
            <span className="flex items-center gap-1"><Calendar size={14} /> Enviado: {new Date(response.submitted_at).toLocaleDateString('es-CO')}</span>
          )}
        </div>
      </div>

      {sections.map(section => (
        <div key={section.id} className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h2 className="font-semibold text-slate-700">{section.title}</h2>
            {section.description && <p className="text-sm text-slate-500 mt-1">{section.description}</p>}
          </div>
          <div className="p-4 space-y-4">
            {section.fields.map(field => {
              const val = parsed[String(field.id)];
              return (
                <div key={field.id}>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    {field.label}
                    {field.is_required ? <span className="text-red-400 ml-1">*</span> : null}
                  </p>
                  <div className="text-sm text-slate-800 bg-slate-50 rounded-lg px-3 py-2 min-h-[36px]">
                    {val !== undefined && val !== null && val !== ''
                      ? (field.field_type === 'yes_no' ? (val === true || val === 'true' ? 'Sí' : 'No') : String(val))
                      : <span className="text-slate-300 italic">Sin respuesta</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
