import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList, MessageCircle, Plus, RefreshCw, Check, X, Trash2, Sparkles, AlertTriangle, Wand2, Loader2, ChevronLeft, Phone,
} from 'lucide-react';
import { whatsappAPI, teamAPI, clientsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const STATUS = {
  proposed: { label: 'Por confirmar', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Tareas creadas', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Descartada', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  failed: { label: 'Error', cls: 'bg-red-50 text-red-600 border-red-200' },
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};
const shortName = (name) => {
  if (!name) return '';
  const p = name.trim().split(/\s+/);
  return ['maria', 'juan', 'jose', 'ana'].includes(p[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) && p[1] ? `${p[0]} ${p[1]}` : p[0];
};

export default function Meetings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [activeId, setActiveId] = useState(searchParams.get('id') ? Number(searchParams.get('id')) : null);
  const [members, setMembers] = useState([]);
  const [clients, setClients] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await whatsappAPI.meetings();
      setList(data.items || []);
      setAi(Boolean(data.ai));
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'No pude cargar las reuniones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([teamAPI.getAll({ status: 'active' }), clientsAPI.getAll('active')])
      .then(([t, c]) => { setMembers(t.data || []); setClients(c.data || []); })
      .catch(() => {});
  }, []);

  const open = (id) => { setActiveId(id); setSearchParams(id ? { id } : {}); };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] flex items-center gap-2"><ClipboardList className="text-emerald-500" size={24} /> Reuniones → tareas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pega la transcripción de Tactiq o envíala al WhatsApp de LA REAL. Orbit propone las tareas, tú confirmas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-[var(--ink)] hover:bg-gray-50" title="Actualizar"><RefreshCw size={16} /></button>
          <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-xl bg-[var(--dark)] text-[var(--accent)] text-sm font-medium flex items-center gap-2 hover:bg-[#1C1D1F]">
            <Plus size={16} /> Pegar transcripción
          </button>
        </div>
      </div>

      {ai === false && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>IA apagada.</b> Falta una llave de Gemini (gratis, AI Studio) en el servidor, así que Orbit solo detecta la convención <i>«tarea para &lt;persona&gt;: …»</i> y compromisos explícitos («Laura queda de…»). Con la llave activa lee toda la conversación.
          </div>
        </div>
      )}

      {!user?.phone && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Phone size={16} className="mt-0.5 shrink-0" />
          <div>
            Para usar esto desde WhatsApp, agrega tu celular en <b>Configuración → Mi perfil</b>, o escríbele al número de LA REAL «<b>soy {shortName(user?.name) || 'tu nombre'}</b>» una sola vez.
          </div>
        </div>
      )}

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {activeId ? (
        <IntakeDetail id={activeId} members={members} clients={clients} onBack={() => { open(null); load(); }} />
      ) : (
        <IntakeList list={list} loading={loading} onOpen={open} />
      )}

      {showNew && (
        <NewIntakeModal
          onClose={() => setShowNew(false)}
          onCreated={(intake) => { setShowNew(false); load(); open(intake.id); }}
        />
      )}
    </div>
  );
}

function IntakeList({ list, loading, onOpen }) {
  if (loading) return <div className="py-16 text-center text-gray-400 text-sm"><Loader2 className="inline animate-spin mr-2" size={16} />Cargando…</div>;
  if (!list.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-[var(--surface)] px-6 py-14 text-center">
        <Sparkles className="mx-auto text-emerald-400 mb-3" size={28} />
        <p className="text-[var(--ink)] font-medium">Todavía no hay reuniones procesadas</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          Al terminar una reunión, envía el archivo .txt de Tactiq al WhatsApp de LA REAL o pégalo aquí. Orbit te devuelve las tareas con responsable, cliente y fecha para que las confirmes.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
      {list.map((it) => {
        const st = STATUS[it.status] || STATUS.proposed;
        return (
          <button key={it.id} onClick={() => onOpen(it.id)} className="w-full text-left px-4 sm:px-5 py-4 hover:bg-gray-50 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium text-[var(--ink)] flex items-center gap-2">
                {it.source === 'whatsapp' ? <MessageCircle size={14} className="text-emerald-500" /> : <ClipboardList size={14} className="text-gray-400" />}
                {it.title || 'Reunión'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {it.meeting_date ? `Reunión ${fmtDate(it.meeting_date)} · ` : ''}{it.sender_name ? `envió ${shortName(it.sender_name)} · ` : ''}{fmtDate(it.created_at)}
              </div>
            </div>
            <div className="text-sm text-gray-600">{it.task_count} tarea{it.task_count === 1 ? '' : 's'}</div>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function IntakeDetail({ id, members, clients, onBack }) {
  const [intake, setIntake] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  const load = useCallback(async () => {
    const { data } = await whatsappAPI.meeting(id);
    setIntake(data);
    setTasks(data.tasks || []);
    setDirty(false);
  }, [id]);
  useEffect(() => { load().catch((e) => setMsg({ type: 'error', text: e.response?.data?.error || 'No encontrada' })); }, [load]);

  const editable = intake?.status === 'proposed';
  const active = useMemo(() => tasks.filter((t) => !t.removed), [tasks]);
  const memberName = (mid) => members.find((m) => m.id === mid)?.name || null;
  const clientName = (cid) => { const c = clients.find((x) => x.id === cid); return c ? (c.nickname || c.company || c.name) : null; };

  const patch = (n, changes) => {
    setTasks((prev) => prev.map((t) => (t.n === n ? { ...t, ...changes } : t)));
    setDirty(true);
  };
  const addTask = () => {
    const n = Math.max(0, ...tasks.map((t) => t.n)) + 1;
    setTasks((prev) => [...prev, { n, title: '', detail: '', assignee_member_id: null, client_id: null, due_date: null, confidence: 1, removed: false }]);
    setDirty(true);
  };

  const save = async () => {
    setBusy('save');
    try {
      const { data } = await whatsappAPI.saveMeetingTasks(id, tasks.filter((t) => t.title?.trim()));
      setIntake(data); setTasks(data.tasks || []); setDirty(false);
      setMsg({ type: 'ok', text: 'Cambios guardados' });
    } catch (e) { setMsg({ type: 'error', text: e.response?.data?.error || 'No pude guardar' }); }
    finally { setBusy(null); }
  };
  const correct = async () => {
    if (!instruction.trim()) return;
    setBusy('correct');
    try {
      if (dirty) await whatsappAPI.saveMeetingTasks(id, tasks.filter((t) => t.title?.trim()));
      const { data } = await whatsappAPI.correctMeeting(id, instruction.trim());
      setIntake(data); setTasks(data.tasks || []); setDirty(false); setInstruction('');
      setMsg({ type: 'ok', text: data.note || 'Listo' });
    } catch (e) { setMsg({ type: 'error', text: e.response?.data?.error || 'No pude aplicar la corrección' }); }
    finally { setBusy(null); }
  };
  const confirm = async () => {
    setBusy('confirm');
    try {
      if (dirty) await whatsappAPI.saveMeetingTasks(id, tasks.filter((t) => t.title?.trim()));
      const { data } = await whatsappAPI.confirmMeeting(id);
      setIntake(data.intake); setTasks(data.intake.tasks || []); setDirty(false);
      setMsg({ type: 'ok', text: `Creé ${data.created.length} tarea${data.created.length === 1 ? '' : 's'} en Orbit` });
    } catch (e) { setMsg({ type: 'error', text: e.response?.data?.error || 'No pude crear las tareas' }); }
    finally { setBusy(null); }
  };
  const cancel = async () => {
    setBusy('cancel');
    try { const { data } = await whatsappAPI.cancelMeeting(id); setIntake(data); setTasks(data.tasks || []); setMsg({ type: 'ok', text: 'Descartada' }); }
    catch (e) { setMsg({ type: 'error', text: e.response?.data?.error || 'Error' }); }
    finally { setBusy(null); }
  };

  if (!intake) return <div className="py-16 text-center text-gray-400 text-sm"><Loader2 className="inline animate-spin mr-2" size={16} />Cargando…</div>;
  const st = STATUS[intake.status] || STATUS.proposed;
  const inputCls = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.4)] focus:border-[var(--accent)] disabled:bg-gray-50 disabled:text-gray-500';

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-[var(--ink)] flex items-center gap-1"><ChevronLeft size={16} /> Volver</button>

      <div className="bg-[var(--surface)] rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--ink)]">{intake.title || 'Reunión'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {intake.meeting_date ? `Reunión ${fmtDate(intake.meeting_date)} · ` : ''}
              {intake.source === 'whatsapp' ? 'llegó por WhatsApp' : 'pegada en Orbit'} · {fmtDate(intake.created_at)}
            </p>
            {intake.summary && <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{intake.summary}</p>}
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
        </div>
        <button onClick={() => setShowTranscript((v) => !v)} className="mt-3 text-xs text-gray-500 underline underline-offset-2">{showTranscript ? 'Ocultar transcripción' : 'Ver transcripción'}</button>
        {showTranscript && <pre className="mt-2 max-h-72 overflow-auto text-xs text-gray-600 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{intake.transcript}</pre>}
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2.5 text-sm border ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>
      )}

      <div className="bg-[var(--surface)] rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium text-[var(--ink)]">{active.length} tarea{active.length === 1 ? '' : 's'} {editable ? 'propuesta' + (active.length === 1 ? '' : 's') : ''}</div>
          {editable && (
            <button onClick={addTask} className="text-sm text-emerald-700 hover:text-emerald-900 flex items-center gap-1"><Plus size={14} /> Agregar tarea</button>
          )}
        </div>

        {active.length === 0 && <div className="px-5 py-10 text-center text-sm text-gray-500">No hay tareas en esta reunión.</div>}

        <div className="divide-y divide-gray-100">
          {active.map((t) => {
            return (
              <div key={t.n} className="px-4 sm:px-5 py-3 grid gap-2 sm:grid-cols-12 sm:items-start">
                <div className="sm:col-span-5">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-xs font-semibold text-gray-400 w-5 shrink-0">{t.n}.</span>
                    <div className="flex-1 min-w-0">
                      <input className={inputCls} value={t.title || ''} disabled={!editable} placeholder="Qué hay que hacer" onChange={(e) => patch(t.n, { title: e.target.value })} />
                      {(t.detail || t.quote) && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.detail || `"${t.quote}"`}</p>}
                      {t.confidence < 0.6 && <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 mt-1"><AlertTriangle size={11} /> dudosa, revísala</span>}
                      {!t.assignee_member_id && t.assignee_hint && <span className="block text-[11px] text-gray-500 mt-0.5">Pista: {t.assignee_hint}</span>}
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-3 sm:pl-0 pl-7">
                  <select className={inputCls} value={t.assignee_member_id || ''} disabled={!editable} onChange={(e) => patch(t.n, { assignee_member_id: e.target.value ? Number(e.target.value) : null, assignee_name: memberName(Number(e.target.value)) })}>
                    <option value="">Sin responsable</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 pl-7 sm:pl-0">
                  <select className={inputCls} value={t.client_id || ''} disabled={!editable} onChange={(e) => patch(t.n, { client_id: e.target.value ? Number(e.target.value) : null, client_name: clientName(Number(e.target.value)) })}>
                    <option value="">LA REAL (interna)</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.nickname || c.company || c.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 pl-7 sm:pl-0 flex items-center gap-1">
                  <input type="date" className={inputCls} value={t.due_date || ''} disabled={!editable} onChange={(e) => patch(t.n, { due_date: e.target.value || null })} />
                  {editable && (
                    <button onClick={() => patch(t.n, { removed: true })} className="p-1.5 text-gray-400 hover:text-red-600 shrink-0" title="Quitar"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {editable && (
          <div className="px-4 sm:px-5 py-4 border-t border-gray-100 bg-gray-50/60 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[var(--surface)] border border-gray-200 rounded-xl px-3">
                <Wand2 size={15} className="text-gray-400 shrink-0" />
                <input
                  className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
                  placeholder="Corregir en palabras: «2 para Valentina», «3 el lunes», «quita 1», «agrega: enviar propuesta a Bites»"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') correct(); }}
                />
                <button onClick={correct} disabled={busy || !instruction.trim()} className="text-sm font-medium text-[var(--ink)] disabled:text-gray-300">{busy === 'correct' ? <Loader2 size={15} className="animate-spin" /> : 'Aplicar'}</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={cancel} disabled={!!busy} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1"><X size={14} /> Descartar reunión</button>
              <div className="flex items-center gap-2">
                {dirty && <button onClick={save} disabled={!!busy} className="px-4 py-2 rounded-xl border border-gray-200 bg-[var(--surface)] text-sm font-medium text-[var(--ink)] hover:bg-gray-50">Guardar cambios</button>}
                <button onClick={confirm} disabled={!!busy || active.length === 0} className="px-4 py-2 rounded-xl bg-[var(--dark)] text-[var(--accent)] text-sm font-medium flex items-center gap-2 hover:bg-[#1C1D1F] disabled:opacity-50">
                  {busy === 'confirm' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Crear {active.length} tarea{active.length === 1 ? '' : 's'} en Orbit
                </button>
              </div>
            </div>
          </div>
        )}
        {intake.status === 'confirmed' && (
          <div className="px-4 sm:px-5 py-3 border-t border-gray-100 text-sm text-gray-600 flex items-center gap-2">
            <Check size={15} className="text-emerald-600" /> Tareas creadas el {fmtDate(intake.confirmed_at)}. Las ves en <a href="/app/tasks" className="underline underline-offset-2">Tareas</a>.
          </div>
        )}
      </div>
    </div>
  );
}

function NewIntakeModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    if (/\.txt$|\.md$|text\//i.test(file.name + file.type)) {
      setText(await file.text());
      if (!title) setTitle(file.name.replace(/\.(txt|md)$/i, ''));
    } else {
      setErr('Sube el .txt de Tactiq (o pega el texto). Los PDF envíalos por WhatsApp.');
    }
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const { data } = await whatsappAPI.createMeeting({ title: title.trim() || undefined, text });
      onCreated(data);
    } catch (e) { setErr(e.response?.data?.error || 'No pude procesar la transcripción'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[var(--ink)]">Nueva reunión</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-3">
          <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="Título (opcional) — ej. Reu semanal equipo" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm min-h-[260px] font-mono"
            placeholder={'Pega aquí la transcripción de Tactiq…\n\n00:00 Laura Martínez: Hola Juancho\n00:03 Juan David Gallego: ...'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <label className="cursor-pointer underline underline-offset-2">
              o sube el archivo .txt
              <input type="file" accept=".txt,.md,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <span>{text.length.toLocaleString('es-CO')} caracteres</span>
          </div>
          {err && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancelar</button>
          <button onClick={submit} disabled={busy || text.trim().length < 120} className="px-4 py-2 rounded-xl bg-[var(--dark)] text-[var(--accent)] text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? 'Leyendo la reunión…' : 'Proponer tareas'}
          </button>
        </div>
      </div>
    </div>
  );
}
