import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePortal } from '../../context/PortalContext';
import { portalDashboardAPI } from '../../utils/portalApi';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  Calendar,
  ClipboardList,
  ExternalLink,
  Zap,
  CalendarDays,
  StickyNote,
  ArrowLeft,
  X
} from 'lucide-react';

export default function PortalDashboard() {
  const { client, welcomeMessage } = usePortal();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [respondForm, setRespondForm] = useState({ will_participate: null, has_offer: false, offer_description: '', client_notes: '' });
  const [saving, setSaving] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

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
            Hola, {client?.nickname || client?.name?.split(' ')[0]}
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
              <h2 className="font-semibold text-[#1A1A2E]">Top prioridades para {client?.nickname || client?.name}</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.priorities.map((task) => {
              const days = task.due_date ? daysUntil(task.due_date) : null;
              const statusLabel = { todo: 'Pendiente', in_progress: 'En progreso', review: 'En revisión' };
              return (
                <div key={task.id} className="flex items-center justify-between px-6 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{task.project_name}</p>
                  </div>
                  {days !== null ? (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ml-3 ${
                      days <= 2 ? 'bg-red-100 text-red-700' :
                      days <= 7 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${formatDate(task.due_date)}`}
                    </span>
                  ) : (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg flex-shrink-0 ml-3 ${
                      task.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                      task.status === 'review' ? 'bg-purple-50 text-purple-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {statusLabel[task.status] || 'Pendiente'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Client Notes */}
      {data?.client_notes?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <StickyNote className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A2E]">Notas para {client?.nickname || client?.name}</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.client_notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  {note.color && note.color !== '#FFFFFF' && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: note.color }} />
                  )}
                  <p className="font-medium text-[#1A1A2E]">{note.title}</p>
                  {note.category_name && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: note.category_color + '20', color: note.category_color }}>
                      {note.category_name}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
                </div>
                {note.content_plain && (
                  <p className="text-sm text-gray-500 line-clamp-2 whitespace-pre-line">{note.content_plain}</p>
                )}
              </button>
            ))}
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
              <h2 className="font-semibold text-[#1A1A2E]">Fechas comerciales para {client?.nickname || client?.name}</h2>
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
              <h2 className="font-semibold text-[#1A1A2E]">Formularios para {client?.nickname || client?.name}</h2>
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

      {/* Note Viewer — Full-screen overlay (portaled to body to escape stacking contexts) */}
      {selectedNote && createPortal(
        <NoteViewer note={selectedNote} onClose={() => setSelectedNote(null)} />,
        document.body
      )}
    </div>
  );
}

/* ─── Read-only note viewer (full-screen, SharedNoteView style) ─── */

const noteViewerStyles = `
  .portal-note .ProseMirror { padding: 2.5rem; min-height: 300px; outline: none; font-size: 0.95rem; line-height: 1.75; color: #334155; }
  .portal-note .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #0f172a; }
  .portal-note .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #1e293b; }
  .portal-note .ProseMirror p { margin: 0.5rem 0; }
  .portal-note .ProseMirror ul, .portal-note .ProseMirror ol { padding-left: 1.5rem; }
  .portal-note .ProseMirror li { margin: 0.25rem 0; }
  .portal-note .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  .portal-note .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
  .portal-note .ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 0.25rem; }
  .portal-note .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div > p { text-decoration: line-through; color: #94a3b8; }
  .portal-note .ProseMirror blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; margin-left: 0; color: #64748b; font-style: italic; }
  .portal-note .ProseMirror code { background: #f1f5f9; padding: 0.2em 0.4em; border-radius: 0.25rem; font-size: 0.9em; }
  .portal-note .ProseMirror pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
  .portal-note .ProseMirror pre code { background: none; padding: 0; color: inherit; }
  .portal-note .ProseMirror mark { background: #fef08a; padding: 0.1em 0.2em; border-radius: 0.15rem; }
  .portal-note .ProseMirror img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0; }
  .portal-note .ProseMirror hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
`;

function NoteViewer({ note, onClose }) {
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2] } }),
    Highlight.configure({ multicolor: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ], []);

  const editor = useEditor({
    extensions,
    content: note.content ? JSON.parse(note.content) : `<p>${note.content_plain || ''}</p>`,
    editable: false,
  });

  return (
    <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col overflow-hidden">
      <style>{noteViewerStyles}</style>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-800 text-lg truncate">{note.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {note.category_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: note.category_color + '20', color: note.category_color }}>
                    {note.category_name}
                  </span>
                )}
                <span className="text-xs text-slate-400">Solo lectura</span>
              </div>
            </div>
          </div>
          <img
            src="/logo-lareal.png"
            alt="LA REAL"
            className="h-8 sm:h-10 opacity-80 flex-shrink-0"
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden portal-note">
            <EditorContent editor={editor} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 text-center flex-shrink-0">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo-lareal.png" alt="" className="h-4 opacity-40" />
          <span className="text-xs text-slate-400">Compartido por LA REAL</span>
        </div>
      </footer>
    </div>
  );
}
