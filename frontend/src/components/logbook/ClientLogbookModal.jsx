import React, { useEffect, useMemo, useState } from 'react';
import {
  X, BookOpen, Plus, Loader2, Pin, PinOff, Trash2, Link2, Clock, User,
  CheckCircle2, Circle, CalendarDays, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { clientLogbookAPI, teamAPI } from '../../utils/api';

// ─── Catálogos ───
const ENTRY_TYPES = [
  { value: 'cambio_pauta', label: 'Cambio en pauta', cls: 'bg-blue-100 text-blue-700' },
  { value: 'cambio_web', label: 'Cambio en web', cls: 'bg-violet-100 text-violet-700' },
  { value: 'creativo', label: 'Creativo nuevo', cls: 'bg-pink-100 text-pink-700' },
  { value: 'promocion', label: 'Promoción', cls: 'bg-amber-100 text-amber-700' },
  { value: 'incidente', label: 'Incidente', cls: 'bg-red-100 text-red-700' },
  { value: 'reunion', label: 'Reunión con cliente', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'insight', label: 'Insight', cls: 'bg-cyan-100 text-cyan-700' },
  { value: 'otro', label: 'Otro', cls: 'bg-gray-100 text-gray-600' },
];
const typeOf = (v) => ENTRY_TYPES.find(t => t.value === v) || ENTRY_TYPES[ENTRY_TYPES.length - 1];

const PLATFORMS = [
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'organico', label: 'Orgánico' },
];
const platformLabel = (v) => PLATFORMS.find(p => p.value === v)?.label || v;

const IMPACTS = [
  { value: 'alto', label: 'Alto', cls: 'text-red-600' },
  { value: 'medio', label: 'Medio', cls: 'text-yellow-600' },
  { value: 'bajo', label: 'Bajo', cls: 'text-gray-500' },
];

// ─── Fechas (siempre hora de Colombia) ───
const TZ = 'America/Bogota';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (d) => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-CO', { timeZone: TZ, day: 'numeric', month: 'short' }) : '';
const fmtDayHeader = (iso) => new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
// datetime-local value in Colombia time for "now"
const nowLocalInput = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = (t) => parts.find(p => p.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
};
// Interpret a datetime-local value as Colombia time (UTC-5, no DST) → ISO
const localInputToISO = (v) => v ? new Date(`${v}:00-05:00`).toISOString() : new Date().toISOString();
const isOverdue = (a) => !a.is_done && a.due_date && String(a.due_date).slice(0, 10) < todayKey();

const emptyForm = () => ({
  entry_type: 'cambio_pauta', title: '', description: '', event_at: nowLocalInput(),
  platforms: [], impact: '', link_url: '', is_pinned: false,
  actions: [],
});

/**
 * Bitácora del cliente: registro cronológico de lo que pasa en la marca
 * (hora, quién registró, qué pasó, acciones a tomar con responsable y fecha).
 */
export default function ClientLogbookModal({ clientId, clientName, onClose, onChanged }) {
  const [entries, setEntries] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newAction, setNewAction] = useState({}); // { [entryId]: { description, assignee_id, due_date } }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [entriesRes, teamRes] = await Promise.all([
          clientLogbookAPI.list(clientId),
          teamAPI.getAll().catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setEntries(entriesRes.data || []);
        const members = Array.isArray(teamRes.data) ? teamRes.data : (teamRes.data?.members || []);
        setTeam(members.filter(m => m.status !== 'inactive'));
      } catch (e) {
        console.error('Error loading logbook:', e);
        if (!cancelled) setError('No se pudo cargar la bitácora');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const notifyChanged = (list) => { onChanged?.(list); };
  const replaceEntry = (updated) => setEntries(prev => {
    const list = prev.map(e => e.id === updated.id ? updated : e);
    notifyChanged(list);
    return list;
  });

  // ─── Crear entrada ───
  const submitEntry = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        event_at: localInputToISO(form.event_at),
        impact: form.impact || null,
        actions: form.actions.filter(a => a.description?.trim()),
      };
      const res = await clientLogbookAPI.create(clientId, payload);
      setEntries(prev => { const list = [res.data, ...prev]; notifyChanged(list); return list; });
      setForm(emptyForm());
      setShowForm(false);
    } catch (err) {
      console.error('Error creating entry:', err);
      setError(err.response?.data?.error || 'No se pudo guardar la entrada');
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (entry) => {
    try {
      const res = await clientLogbookAPI.update(clientId, entry.id, { is_pinned: !entry.is_pinned });
      replaceEntry(res.data);
    } catch (err) { console.error(err); }
  };

  const deleteEntry = async (entry) => {
    if (!confirm(`¿Eliminar la entrada "${entry.title}"? Se borran también sus acciones.`)) return;
    try {
      await clientLogbookAPI.delete(clientId, entry.id);
      setEntries(prev => { const list = prev.filter(e => e.id !== entry.id); notifyChanged(list); return list; });
    } catch (err) { console.error(err); }
  };

  // ─── Acciones ───
  const toggleAction = async (entry, action) => {
    try {
      const res = await clientLogbookAPI.updateAction(clientId, entry.id, action.id, { is_done: !action.is_done });
      replaceEntry(res.data);
    } catch (err) { console.error(err); }
  };
  const deleteAction = async (entry, action) => {
    try {
      const res = await clientLogbookAPI.deleteAction(clientId, entry.id, action.id);
      replaceEntry(res.data);
    } catch (err) { console.error(err); }
  };
  const addAction = async (entry) => {
    const draft = newAction[entry.id];
    if (!draft?.description?.trim()) return;
    try {
      const res = await clientLogbookAPI.addAction(clientId, entry.id, {
        description: draft.description.trim(), assignee_id: draft.assignee_id || null, due_date: draft.due_date || null,
      });
      replaceEntry(res.data);
      setNewAction(prev => ({ ...prev, [entry.id]: { description: '', assignee_id: '', due_date: '' } }));
    } catch (err) { console.error(err); }
  };

  // ─── Derivados ───
  const filtered = useMemo(
    () => typeFilter === 'all' ? entries : entries.filter(e => e.entry_type === typeFilter),
    [entries, typeFilter]
  );
  const pinned = filtered.filter(e => e.is_pinned);
  const rest = filtered.filter(e => !e.is_pinned);
  const groupedByDay = useMemo(() => {
    const groups = [];
    for (const e of rest) {
      const k = dayKey(e.event_at);
      const g = groups[groups.length - 1];
      if (g && g.key === k) g.items.push(e); else groups.push({ key: k, label: fmtDayHeader(e.event_at), items: [e] });
    }
    return groups;
  }, [rest]);
  const pendingCount = entries.reduce((n, e) => n + e.actions.filter(a => !a.is_done).length, 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#17181A] text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">Bitácora · {clientName}</h2>
              <p className="text-xs text-gray-500">
                {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
                {pendingCount > 0 && <span className="text-amber-600"> · {pendingCount} {pendingCount === 1 ? 'acción pendiente' : 'acciones pendientes'}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowForm(v => !v); if (!showForm) setForm(emptyForm()); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[#17181A] text-white hover:bg-black transition-colors"
            >
              <Plus className="w-4 h-4" /> Nueva entrada
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Formulario nueva entrada */}
          {showForm && (
            <form onSubmit={submitEntry} className="px-6 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {ENTRY_TYPES.map(t => (
                  <button
                    type="button" key={t.value}
                    onClick={() => setForm(f => ({ ...f, entry_type: t.value }))}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${form.entry_type === t.value ? t.cls + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <input
                autoFocus
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="¿Qué pasó? (título corto)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
              />
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detalle: qué se cambió, por qué, qué se observó…"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs text-gray-500 space-y-1">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Fecha y hora del suceso</span>
                  <input
                    type="datetime-local"
                    value={form.event_at}
                    onChange={e => setForm(f => ({ ...f, event_at: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900"
                  />
                </label>
                <label className="text-xs text-gray-500 space-y-1">
                  <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Impacto esperado</span>
                  <select
                    value={form.impact}
                    onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900"
                  >
                    <option value="">Sin definir</option>
                    {IMPACTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-500 space-y-1">
                  <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> Link (opcional)</span>
                  <input
                    type="url"
                    value={form.link_url}
                    onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                    placeholder="https://…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-500 mr-1">Plataformas:</span>
                {PLATFORMS.map(p => {
                  const on = form.platforms.includes(p.value);
                  return (
                    <button
                      type="button" key={p.value}
                      onClick={() => setForm(f => ({ ...f, platforms: on ? f.platforms.filter(x => x !== p.value) : [...f.platforms, p.value] }))}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${on ? 'bg-[#17181A] text-white border-[#17181A]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Acciones a tomar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Acciones a tomar</span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, actions: [...f.actions, { description: '', assignee_id: '', due_date: '' }] }))}
                    className="text-xs text-gray-600 hover:text-[#17181A] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Agregar acción
                  </button>
                </div>
                {form.actions.map((a, idx) => (
                  <ActionEditor
                    key={idx} value={a} team={team}
                    onChange={(v) => setForm(f => ({ ...f, actions: f.actions.map((x, i) => i === idx ? v : x) }))}
                    onRemove={() => setForm(f => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }))}
                  />
                ))}
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} className="rounded" />
                  Fijar arriba
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                  <button type="submit" disabled={saving || !form.title.trim()} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#17181A] text-white hover:bg-black disabled:opacity-50">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar entrada
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Filtro por tipo */}
          {entries.length > 0 && (
            <div className="px-6 pt-4 flex flex-wrap gap-1.5">
              <button onClick={() => setTypeFilter('all')} className={`text-xs px-2.5 py-1 rounded-full ${typeFilter === 'all' ? 'bg-[#17181A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Todas ({entries.length})
              </button>
              {ENTRY_TYPES.filter(t => entries.some(e => e.entry_type === t.value)).map(t => (
                <button key={t.value} onClick={() => setTypeFilter(t.value)} className={`text-xs px-2.5 py-1 rounded-full ${typeFilter === t.value ? 'bg-[#17181A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t.label} ({entries.filter(e => e.entry_type === t.value).length})
                </button>
              ))}
            </div>
          )}

          {/* Lista */}
          <div className="px-6 py-4 space-y-5">
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aún no hay entradas en la bitácora de {clientName}.</p>
                <p className="text-xs text-gray-400 mt-1">Registra cambios en pauta, web, creativos, promociones, incidentes o acuerdos con el cliente.</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Sin entradas de este tipo</p>
            ) : (
              <>
                {pinned.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1"><Pin className="w-3 h-3" /> Fijadas</h3>
                    {pinned.map(e => (
                      <EntryCard key={e.id} entry={e} team={team} draft={newAction[e.id]} setDraft={(d) => setNewAction(p => ({ ...p, [e.id]: d }))}
                        onPin={togglePin} onDelete={deleteEntry} onToggleAction={toggleAction} onDeleteAction={deleteAction} onAddAction={addAction} />
                    ))}
                  </section>
                )}
                {groupedByDay.map(g => (
                  <section key={g.key} className="space-y-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 capitalize">
                      {g.key === todayKey() ? 'Hoy · ' : ''}{g.label}
                    </h3>
                    {g.items.map(e => (
                      <EntryCard key={e.id} entry={e} team={team} draft={newAction[e.id]} setDraft={(d) => setNewAction(p => ({ ...p, [e.id]: d }))}
                        onPin={togglePin} onDelete={deleteEntry} onToggleAction={toggleAction} onDeleteAction={deleteAction} onAddAction={addAction} />
                    ))}
                  </section>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Editor de acción (en el formulario de nueva entrada) ───
function ActionEditor({ value, team, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_150px_auto] gap-2 items-center">
      <input
        value={value.description}
        onChange={e => onChange({ ...value, description: e.target.value })}
        placeholder="Qué hay que hacer"
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
      />
      <select
        value={value.assignee_id || ''}
        onChange={e => onChange({ ...value, assignee_id: e.target.value })}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
      >
        <option value="">Responsable</option>
        {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <input
        type="date"
        value={value.due_date || ''}
        onChange={e => onChange({ ...value, due_date: e.target.value })}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
      />
      <button type="button" onClick={onRemove} className="p-2 text-gray-400 hover:text-red-500 rounded-lg" title="Quitar">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Tarjeta de entrada ───
function EntryCard({ entry, team, draft, setDraft, onPin, onDelete, onToggleAction, onDeleteAction, onAddAction }) {
  const [addingAction, setAddingAction] = useState(false);
  const t = typeOf(entry.entry_type);
  const impact = IMPACTS.find(i => i.value === entry.impact);
  const pending = entry.actions.filter(a => !a.is_done).length;
  const d = draft || { description: '', assignee_id: '', due_date: '' };

  return (
    <article className={`rounded-xl border p-4 ${entry.is_pinned ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.cls}`}>{t.label}</span>
            {impact && <span className={`text-[10px] font-medium ${impact.cls}`}>Impacto {impact.label.toLowerCase()}</span>}
            {entry.platforms?.map(p => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{platformLabel(p)}</span>
            ))}
          </div>
          <h4 className="text-sm font-semibold text-gray-900">{entry.title}</h4>
          {entry.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{entry.description}</p>}
          {entry.link_url && (
            <a href={entry.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 break-all">
              <Link2 className="w-3 h-3" /> {entry.link_url}
            </a>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDateTime(entry.event_at)}</span>
            <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {entry.created_by_name || 'Equipo'}</span>
            {dayKey(entry.created_at) !== dayKey(entry.event_at) && <span>Registrado {fmtDateTime(entry.created_at)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onPin(entry)} className={`p-1.5 rounded-lg ${entry.is_pinned ? 'text-amber-600 hover:bg-amber-100' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'}`} title={entry.is_pinned ? 'Quitar de fijadas' : 'Fijar arriba'}>
            {entry.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
          <button onClick={() => onDelete(entry)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar entrada">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-gray-500">
            Acciones {entry.actions.length > 0 && <span className="text-gray-400">· {entry.actions.length - pending}/{entry.actions.length} hechas</span>}
          </span>
          <button onClick={() => setAddingAction(v => !v)} className="text-[11px] text-gray-500 hover:text-[#17181A] inline-flex items-center gap-1">
            {addingAction ? <ChevronUp className="w-3 h-3" /> : <Plus className="w-3 h-3" />} {addingAction ? 'Cerrar' : 'Agregar acción'}
          </button>
        </div>
        {entry.actions.length === 0 && !addingAction && <p className="text-xs text-gray-400">Sin acciones registradas</p>}
        <ul className="space-y-1">
          {entry.actions.map(a => {
            const overdue = isOverdue(a);
            return (
              <li key={a.id} className="flex items-start gap-2 group">
                <button onClick={() => onToggleAction(entry, a)} className={`mt-0.5 shrink-0 ${a.is_done ? 'text-green-600' : overdue ? 'text-red-500' : 'text-gray-300 hover:text-gray-500'}`} title={a.is_done ? 'Marcar pendiente' : 'Marcar hecha'}>
                  {a.is_done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${a.is_done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{a.description}</p>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
                    {a.assignee_name && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {a.assignee_name}</span>}
                    {a.due_date && <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}><CalendarDays className="w-3 h-3" /> {fmtDate(a.due_date)}{overdue ? ' · vencida' : ''}</span>}
                    {a.is_done && a.done_at && <span>Hecha {fmtDateTime(a.done_at)}{a.done_by_name ? ` por ${a.done_by_name}` : ''}</span>}
                  </div>
                </div>
                <button onClick={() => onDeleteAction(entry, a)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Quitar acción">
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        {addingAction && (
          <div className="mt-2">
            <ActionEditor value={d} team={team} onChange={setDraft} onRemove={() => { setAddingAction(false); setDraft({ description: '', assignee_id: '', due_date: '' }); }} />
            <div className="flex justify-end mt-2">
              <button onClick={() => { onAddAction(entry); setAddingAction(false); }} disabled={!d.description?.trim()} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#17181A] text-white hover:bg-black disabled:opacity-50">
                Guardar acción
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
