import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePortal } from '../../context/PortalContext';
import { portalDashboardAPI, portalNotesAPI } from '../../utils/portalApi';
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
  X,
  FileCode2,
  Maximize2,
  Minimize2,
  MessageSquare,
  Send,
  LayoutDashboard
} from 'lucide-react';
import TabbedNoteView from '../../components/TabbedNoteView';

export default function PortalDashboard() {
  const { client, welcomeMessage } = usePortal();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [respondForm, setRespondForm] = useState({ will_participate: null, has_offer: false, offer_description: '', client_notes: '' });
  const [saving, setSaving] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [briefFullscreen, setBriefFullscreen] = useState(false);

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

      {/* Client Briefs */}
      {data?.client_briefs?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
              <FileCode2 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A2E]">Briefs</h2>
              <p className="text-sm text-gray-500">Documentos compartidos por tu equipo</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {data.client_briefs.map((brief) => (
              <button
                key={brief.id}
                onClick={() => setSelectedBrief(brief)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileCode2 className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[#1A1A2E] truncate">{brief.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(brief.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-3" />
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

      {/* Brief Viewer — Interactive HTML in iframe */}
      {selectedBrief && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div
            className={`bg-white shadow-xl flex flex-col ${
              briefFullscreen ? 'w-full h-full' : 'rounded-2xl w-full max-w-5xl h-[85vh] mx-4'
            }`}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileCode2 className="w-4 h-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#1A1A2E] truncate">{selectedBrief.title}</h3>
                  <p className="text-xs text-gray-400">
                    {new Date(selectedBrief.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setBriefFullscreen(!briefFullscreen)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {briefFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  onClick={() => { setSelectedBrief(null); setBriefFullscreen(false); }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                srcDoc={
                  selectedBrief.html_content
                    ? selectedBrief.html_content.replace(
                        /<\/body>/i,
                        `<script>
                          document.addEventListener('click', function(e) {
                            var a = e.target.closest('a');
                            if (!a) return;
                            var href = a.getAttribute('href');
                            if (!href) return;
                            if (href.startsWith('#')) {
                              e.preventDefault();
                              var el = document.querySelector(href);
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            } else if (href.startsWith('http')) {
                              e.preventDefault();
                              window.open(href, '_blank');
                            }
                          });
                        <\/script></body>`
                      )
                    : '<p style="padding:2rem;color:#999">Sin contenido HTML</p>'
                }
                className="w-full h-full border-0"
                title={selectedBrief.title}
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          </div>
        </div>,
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
  .portal-note-comment-highlight { background: #fef08a; border-radius: 2px; cursor: pointer; }
  .portal-note-comment-highlight:hover { background: #fde047; }
  .portal-note-comment-highlight.active { background: #fde047; box-shadow: 0 0 0 2px #facc15; }
`;

function NoteViewer({ note, onClose }) {
  const [tabbedView, setTabbedView] = useState(true);
  const [comments, setComments] = useState([]);
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTabContext, setActiveTabContext] = useState('');
  // Inline comment state
  const [selectionInfo, setSelectionInfo] = useState(null); // { text, top }
  const [newCommentState, setNewCommentState] = useState(null); // { quotedText, top, text }
  const [activeCommentId, setActiveCommentId] = useState(null);
  const contentRef = useRef(null);

  // Stable callback to prevent re-render loop
  const handleTabChange = useCallback((ctx) => setActiveTabContext(ctx), []);

  // Parse content
  const parsedContent = useMemo(() => {
    if (!note.content) return null;
    try {
      let c = typeof note.content === 'string' ? JSON.parse(note.content) : note.content;
      if (typeof c === 'string') c = JSON.parse(c);
      return c;
    } catch { return null; }
  }, [note.content]);

  // TipTap editor for non-tabbed view
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Highlight.configure({ multicolor: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ], []);

  const editor = useEditor({
    extensions,
    content: parsedContent || `<p>${note.content_plain || ''}</p>`,
    editable: false,
  });

  // Load comments
  useEffect(() => {
    portalNotesAPI.getNote(note.id).then(data => {
      setComments(data.comments || []);
    }).catch(() => {});
  }, [note.id]);

  // Filter comments by tab context
  const filteredComments = useMemo(() => {
    if (!activeTabContext) return comments;
    return comments.filter(c => !c.tab_context || c.tab_context === activeTabContext);
  }, [comments, activeTabContext]);

  // Detect text selection in the content area
  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay to let browser finalize selection
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          setSelectionInfo(null);
          return;
        }

        // Check if selection is within our content area
        const contentEl = contentRef.current;
        if (!contentEl) return;
        const anchorNode = selection.anchorNode;
        if (!contentEl.contains(anchorNode)) {
          setSelectionInfo(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = contentEl.getBoundingClientRect();
        const top = rect.top - containerRect.top + contentEl.scrollTop;

        setSelectionInfo({
          text: selection.toString().trim().substring(0, 200),
          top,
        });
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Start new inline comment from selection
  const startInlineComment = () => {
    if (!selectionInfo) return;
    setNewCommentState({
      quotedText: selectionInfo.text,
      top: selectionInfo.top,
      text: '',
    });
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleSubmitComment = async () => {
    const commentText = newCommentState?.text;
    if (!commentText?.trim() || !authorName.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await portalNotesAPI.addComment(note.id, {
        author_name: authorName,
        content: commentText,
        tab_context: activeTabContext || null,
        quoted_text: newCommentState.quotedText || null,
      });
      setComments(prev => [...prev, newComment]);
      setNewCommentState(null);
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGeneralComment = () => {
    setNewCommentState({
      quotedText: null,
      top: null,
      text: '',
    });
  };

  const pendingCount = comments.length;

  return (
    <div className="fixed inset-0 bg-slate-50 z-[100] flex flex-col overflow-hidden">
      <style>{noteViewerStyles}</style>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0">
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
                {note.updated_at && (
                  <span className="text-xs text-slate-400">
                    Actualizado {new Date(note.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTabbedView(!tabbedView)}
              className={`p-2 rounded-lg transition-colors ${tabbedView ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Vista con pestañas"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <button
              onClick={handleAddGeneralComment}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              title="Agregar comentario general"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Comentar</span>
              {pendingCount > 0 && (
                <span className="w-5 h-5 bg-indigo-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
            <img src="/logo-lareal.png" alt="LA REAL" className="h-8 opacity-80 flex-shrink-0 hidden sm:block" />
          </div>
        </div>
      </header>

      {/* Instruction banner */}
      {!authorName && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-sm text-amber-700">Para comentar, primero ingresa tu nombre:</span>
            <input
              type="text"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="Tu nombre"
              className="px-3 py-1 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
              onKeyDown={e => e.key === 'Enter' && authorName.trim() && e.target.blur()}
            />
          </div>
        </div>
      )}

      {/* Content + Comment margin */}
      <div className="flex-1 overflow-y-auto" ref={contentRef}>
        <div className="max-w-6xl mx-auto flex py-6 sm:py-8 px-4 sm:px-6 gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0 max-w-3xl relative">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden portal-note p-6 sm:p-8">
              {tabbedView && parsedContent ? (
                <TabbedNoteView content={parsedContent} onTabChange={handleTabChange} />
              ) : (
                <EditorContent editor={editor} />
              )}
            </div>

            {/* Floating selection tooltip */}
            {selectionInfo && authorName && (
              <div
                className="absolute z-50 animate-in fade-in"
                style={{ top: selectionInfo.top - 40, right: -12 }}
              >
                <button
                  onClick={startInlineComment}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A2E] text-white rounded-lg shadow-lg text-xs font-medium hover:bg-[#252542] transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comentar
                </button>
              </div>
            )}
          </div>

          {/* Right margin — comments */}
          <div className="w-72 lg:w-80 flex-shrink-0 hidden md:block">
            <div className="space-y-3">
              {/* New comment form (inline) */}
              {newCommentState && (
                <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-lg p-3 animate-in slide-in-from-left">
                  {newCommentState.quotedText && (
                    <div className="mb-2 px-2 py-1.5 bg-amber-50 border-l-2 border-amber-300 rounded text-xs text-slate-600 italic line-clamp-3">
                      "{newCommentState.quotedText}"
                    </div>
                  )}
                  {!authorName ? (
                    <p className="text-xs text-slate-400 text-center py-2">Ingresa tu nombre arriba para comentar</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">
                          {authorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-slate-600">{authorName}</span>
                        <button onClick={() => setAuthorName('')} className="text-[10px] text-slate-400 hover:text-slate-600 ml-auto">cambiar</button>
                      </div>
                      <textarea
                        autoFocus
                        value={newCommentState.text}
                        onChange={e => setNewCommentState(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="Escribe tu comentario..."
                        className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        rows={3}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); }
                          if (e.key === 'Escape') setNewCommentState(null);
                        }}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => setNewCommentState(null)}
                          className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSubmitComment}
                          disabled={!newCommentState.text.trim() || submitting}
                          className="px-3 py-1 text-xs bg-[#1A1A2E] text-white rounded-lg hover:bg-[#252542] disabled:opacity-50 flex items-center gap-1"
                        >
                          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Comentar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Existing comments */}
              {filteredComments.map(comment => (
                <div
                  key={comment.id}
                  onClick={() => setActiveCommentId(activeCommentId === comment.id ? null : comment.id)}
                  className={`bg-white rounded-xl border shadow-sm p-3 cursor-pointer transition-all hover:shadow-md ${
                    activeCommentId === comment.id ? 'border-indigo-300 shadow-md' : 'border-slate-200'
                  }`}
                >
                  {comment.quoted_text && (
                    <div className="mb-2 px-2 py-1 bg-amber-50 border-l-2 border-amber-300 rounded text-[11px] text-slate-500 italic line-clamp-2">
                      "{comment.quoted_text}"
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      comment.author_type === 'team' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {comment.author_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="text-xs font-medium text-slate-700">{comment.author_name}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${
                      comment.author_type === 'team' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {comment.author_type === 'team' ? 'Equipo' : 'Cliente'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{comment.content}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-400">
                      {new Date(comment.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {comment.tab_context && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{comment.tab_context}</span>
                    )}
                  </div>
                </div>
              ))}

              {filteredComments.length === 0 && !newCommentState && (
                <div className="text-center py-12">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No hay comentarios aún</p>
                  <p className="text-xs text-slate-300 mt-1">Selecciona texto en el documento para comentar</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: floating comment button + sheet */}
        <div className="md:hidden fixed bottom-4 right-4 z-50">
          {pendingCount > 0 && (
            <button
              onClick={handleAddGeneralComment}
              className="w-12 h-12 bg-[#1A1A2E] text-white rounded-full shadow-lg flex items-center justify-center relative"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
