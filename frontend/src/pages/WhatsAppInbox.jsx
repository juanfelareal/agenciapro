import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageCircle, Search, Send, RefreshCw, Plus, X, Check, CheckCheck, AlertTriangle, FileText, Link2, Phone, Clock, Info,
} from 'lucide-react';
import { whatsappAPI, clientsAPI } from '../utils/api';

// ---------- helpers ----------
const fmtTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};
const fmtFull = (v) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const dayLabel = (v) => {
  const d = new Date(v);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoy';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
};
const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const paramsOf = (body) => Array.from(new Set((body || '').match(/{{\s*([a-z0-9_]+)\s*}}/gi) || [])).map((p) => p.replace(/[{}\s]/g, ''));
const renderTemplate = (body, values) => (body || '').replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, k) => values[k] || `{{${k}}}`);

const StatusIcon = ({ status, error }) => {
  if (status === 'failed') return <span title={error || 'Entrega fallida'} className="text-red-500 inline-flex"><AlertTriangle size={13} /></span>;
  if (status === 'read') return <span title="Leído" className="text-sky-500 inline-flex"><CheckCheck size={14} /></span>;
  if (status === 'delivered') return <span title="Entregado" className="text-gray-400 inline-flex"><CheckCheck size={14} /></span>;
  if (status === 'sent' || status === 'accepted') return <span title="Enviado" className="text-gray-400 inline-flex"><Check size={14} /></span>;
  return <span title={status || 'Pendiente'} className="text-gray-300 inline-flex"><Clock size={12} /></span>;
};

// ---------- page ----------
const WhatsAppInbox = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [search, setSearch] = useState('');
  const [activePhone, setActivePhone] = useState(searchParams.get('phone') || '');
  const [thread, setThread] = useState({ messages: [], client: null, phone: '', phone_formatted: '' });
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const bottomRef = useRef(null);

  const loadStatus = useCallback(() => whatsappAPI.status().then((r) => setStatus(r.data)).catch(() => setStatus({ configured: false })), []);

  const loadConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConvs(true);
      const res = await whatsappAPI.conversations();
      setConversations(res.data || []);
    } catch (e) {
      if (!silent) setError(e.response?.data?.error || 'No se pudo cargar la bandeja');
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadThread = useCallback(async (phone, { silent = false } = {}) => {
    if (!phone) return;
    try {
      if (!silent) setLoadingThread(true);
      const res = await whatsappAPI.messages(phone);
      setThread(res.data);
      const hadUnread = (res.data.messages || []).some((m) => m.direction === 'inbound' && !m.read_by_team_at);
      if (hadUnread || !silent) {
        whatsappAPI.markRead(phone)
          .then((r) => window.dispatchEvent(new CustomEvent('whatsapp:unread-changed', { detail: { unread: r.data?.unread } })))
          .catch(() => {});
        setConversations((prev) => prev.map((c) => (c.phone === phone ? { ...c, unread_count: 0 } : c)));
      }
    } catch (e) {
      if (!silent) setError(e.response?.data?.error || 'No se pudo cargar la conversación');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => { loadStatus(); loadConversations(); }, [loadStatus, loadConversations]);
  useEffect(() => {
    const i = setInterval(() => { loadConversations(true); if (activePhone) loadThread(activePhone, { silent: true }); }, 15000);
    return () => clearInterval(i);
  }, [activePhone, loadConversations, loadThread]);
  useEffect(() => {
    if (activePhone) {
      loadThread(activePhone);
      setSearchParams((p) => { p.set('phone', activePhone); return p; }, { replace: true });
    }
  }, [activePhone, loadThread, setSearchParams]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread.messages?.length, activePhone]);

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    const qd = q.replace(/\D/g, '');
    return conversations.filter((c) => (c.display_name || '').toLowerCase().includes(q) || (qd && c.phone.includes(qd)));
  }, [conversations, search]);

  const activeConv = conversations.find((c) => c.phone === activePhone);
  const activeName = thread.client?.display_name || activeConv?.display_name || activeConv?.contact_name || thread.phone_formatted || activePhone;
  const lastInbound = useMemo(() => {
    const inb = (thread.messages || []).filter((m) => m.direction === 'inbound');
    return inb.length ? new Date(inb[inb.length - 1].created_at) : null;
  }, [thread.messages]);
  const windowOpen = lastInbound ? (Date.now() - lastInbound.getTime()) < 24 * 60 * 60 * 1000 : false;

  const handleSend = async () => {
    if (!draft.trim() || !activePhone) return;
    try {
      setSending(true);
      setError(null);
      await whatsappAPI.send({ to: activePhone, body: draft.trim(), client_id: thread.client?.id || null });
      setDraft('');
      await loadThread(activePhone, { silent: true });
      loadConversations(true);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const openConversation = (phone) => { setError(null); setActivePhone(phone); };

  const startNew = (contact) => {
    setShowNew(false);
    const phone = contact.wa;
    if (!conversations.some((c) => c.phone === phone)) {
      setConversations((prev) => [{ phone, phone_formatted: contact.phone_formatted, display_name: contact.name, client_id: contact.kind === 'client' ? contact.id : null, unread_count: 0, last_body: '', last_at: null }, ...prev]);
    }
    setThread({ messages: [], client: contact.kind === 'client' ? { id: contact.id, display_name: contact.name } : null, phone, phone_formatted: contact.phone_formatted });
    setActivePhone(phone);
  };

  // ---------- render ----------
  if (status && !status.configured) {
    return (
      <div className="max-w-3xl mx-auto">
        <Header status={status} onRefresh={loadStatus} />
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4"><MessageCircle size={26} /></div>
          <h2 className="text-lg font-bold text-[#17181A]">WhatsApp aún no está conectado</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Falta configurar las credenciales de Kapso en el backend (<code className="text-xs bg-gray-100 px-1 rounded">KAPSO_API_KEY</code> y <code className="text-xs bg-gray-100 px-1 rounded">KAPSO_PHONE_NUMBER_ID</code>).
            Cuando estén listas, aquí verás la bandeja del número de LA REAL.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <Header status={status} onRefresh={() => { loadStatus(); loadConversations(); if (activePhone) loadThread(activePhone); }} onNew={() => setShowNew(true)} />

      {error && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 overflow-hidden grid grid-cols-1 md:grid-cols-[320px_1fr]">
        {/* ---- Conversations ---- */}
        <aside className={`border-r border-gray-100 flex flex-col min-h-0 ${activePhone ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o número"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs && conversations.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">Cargando conversaciones...</p>
            ) : filteredConvs.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">{search ? 'Sin resultados' : 'Aún no hay conversaciones'}</p>
                {!search && <p className="text-xs text-gray-400 mt-1">Los mensajes que lleguen al número de LA REAL aparecerán aquí.</p>}
              </div>
            ) : filteredConvs.map((c) => (
              <button
                key={c.phone}
                onClick={() => openConversation(c.phone)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${c.phone === activePhone ? 'bg-[#D7F653]/20' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.client_id ? 'bg-[#17181A] text-[#D7F653]' : 'bg-gray-100 text-gray-600'}`}>
                  {c.display_name ? initials(c.display_name) : <Phone size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#17181A] truncate">{c.display_name || c.phone_formatted}</p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{fmtTime(c.last_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      {c.last_direction === 'outbound' && <StatusIcon status={c.last_status} />}
                      <span className="truncate">{c.last_body || (c.last_type ? `[${c.last_type}]` : 'Sin mensajes')}</span>
                    </p>
                    {c.unread_count > 0 && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">{c.unread_count}</span>
                    )}
                  </div>
                  {c.display_name && <p className="text-[11px] text-gray-400 mt-0.5">{c.phone_formatted}</p>}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* ---- Thread ---- */}
        <section className={`flex flex-col min-h-0 ${activePhone ? 'flex' : 'hidden md:flex'}`}>
          {!activePhone ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4"><MessageCircle size={30} /></div>
              <p className="text-sm font-medium text-[#17181A]">Elige una conversación</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">O inicia una nueva con un cliente o creador desde “Nuevo mensaje”.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setActivePhone('')} className="md:hidden text-gray-400 hover:text-[#17181A]"><X size={18} /></button>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${thread.client ? 'bg-[#17181A] text-[#D7F653]' : 'bg-gray-100 text-gray-600'}`}>
                    {activeName ? initials(activeName) : <Phone size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#17181A] truncate">{activeName}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {thread.phone_formatted || activePhone}
                      {thread.client ? ' · Cliente' : ''}
                      {' · '}
                      <span className={windowOpen ? 'text-emerald-600' : 'text-amber-600'}>
                        {windowOpen ? 'Ventana de 24 h abierta' : 'Sin ventana de 24 h: usa una plantilla'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!thread.client && (
                    <button onClick={() => setShowLink(true)} title="Vincular a un cliente" className="p-2 rounded-lg text-gray-400 hover:text-[#17181A] hover:bg-gray-100"><Link2 size={16} /></button>
                  )}
                  <button onClick={() => setShowTemplates(true)} title="Enviar plantilla" className="p-2 rounded-lg text-gray-400 hover:text-[#17181A] hover:bg-gray-100"><FileText size={16} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 bg-[#F7F7F5]">
                {loadingThread && thread.messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">Cargando...</p>
                ) : thread.messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">Todavía no hay mensajes con este número.</p>
                ) : thread.messages.map((m, idx) => {
                  const prev = thread.messages[idx - 1];
                  const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                  const out = m.direction === 'outbound';
                  return (
                    <div key={m.id}>
                      {newDay && (
                        <div className="flex justify-center my-3">
                          <span className="text-[11px] text-gray-500 bg-white border border-gray-100 rounded-full px-3 py-1 capitalize">{dayLabel(m.created_at)}</span>
                        </div>
                      )}
                      <div className={`flex ${out ? 'justify-end' : 'justify-start'} mb-2`}>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm ${out ? 'bg-[#17181A] text-white rounded-br-md' : 'bg-white text-[#17181A] rounded-bl-md border border-gray-100'}`}>
                          {m.message_type === 'template' && (
                            <p className={`text-[10px] uppercase tracking-wide mb-1 ${out ? 'text-[#D7F653]' : 'text-gray-400'}`}>Plantilla · {m.template_name}</p>
                          )}
                          {m.context?.source === 'cartera' && (
                            <p className={`text-[10px] uppercase tracking-wide mb-1 ${out ? 'text-[#D7F653]' : 'text-gray-400'}`}>Cartera</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                          {m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className={`text-xs underline ${out ? 'text-[#D7F653]' : 'text-blue-600'}`}>Ver archivo</a>}
                          <div className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${out ? 'text-gray-400' : 'text-gray-400'}`} title={fmtFull(m.created_at)}>
                            {out && m.sent_by_name && <span className="truncate max-w-[120px]">{m.sent_by_name.split(' ')[0]}</span>}
                            <span>{new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                            {out && <StatusIcon status={m.status} error={m.error_message} />}
                          </div>
                          {out && m.status === 'failed' && m.error_message && (
                            <p className="text-[11px] text-red-300 mt-1">{m.error_message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-gray-100">
                {!windowOpen && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mb-2 flex items-center gap-1.5">
                    <Info size={12} /> Meta solo entrega texto libre si el contacto escribió en las últimas 24 h. Para iniciar la conversación usa una plantilla aprobada.
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={Math.min(5, Math.max(1, draft.split('\n').length))}
                    placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter salto de línea)"
                    className="flex-1 resize-none px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7F653]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="h-[42px] px-4 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium flex items-center gap-2 hover:bg-[#2D2D4E] disabled:opacity-50"
                  >
                    <Send size={16} /> {sending ? 'Enviando' : 'Enviar'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {showNew && <NewMessageModal onClose={() => setShowNew(false)} onPick={startNew} />}
      {showTemplates && activePhone && (
        <TemplateModal
          phone={activePhone}
          clientId={thread.client?.id || null}
          contactName={activeName}
          onClose={() => setShowTemplates(false)}
          onSent={() => { setShowTemplates(false); loadThread(activePhone, { silent: true }); loadConversations(true); }}
        />
      )}
      {showLink && activePhone && (
        <LinkClientModal
          phone={activePhone}
          onClose={() => setShowLink(false)}
          onLinked={() => { setShowLink(false); loadThread(activePhone, { silent: true }); loadConversations(true); }}
        />
      )}
    </div>
  );
};

// ---------- header ----------
const Header = ({ status, onRefresh, onNew }) => {
  const n = status?.number;
  const connected = n?.status === 'CONNECTED';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold text-[#17181A] flex items-center gap-2"><MessageCircle className="text-emerald-500" size={24} /> WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {status?.configured && n ? (
            <>
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              {n.display_name || 'La Real'} · {n.display_phone_number}
              {n.quality_rating && n.quality_rating !== 'UNKNOWN' ? ` · Calidad ${n.quality_rating}` : ''}
              {n.messaging_limit ? ` · Límite ${String(n.messaging_limit).replace('TIER_', '')}/día` : ''}
            </>
          ) : status?.configured ? 'Número conectado vía Kapso' : 'Bandeja del número de LA REAL (vía Kapso)'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onRefresh} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-[#17181A] hover:bg-gray-50" title="Actualizar"><RefreshCw size={16} /></button>
        {onNew && (
          <button onClick={onNew} className="px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium flex items-center gap-2 hover:bg-[#2D2D4E]">
            <Plus size={16} /> Nuevo mensaje
          </button>
        )}
      </div>
    </div>
  );
};

// ---------- modals ----------
const ModalShell = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="text-lg font-bold text-[#17181A]">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-6 overflow-y-auto">{children}</div>
    </div>
  </div>
);

const NewMessageModal = ({ onClose, onPick }) => {
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState([]);
  const [manual, setManual] = useState('');
  useEffect(() => {
    const t = setTimeout(() => whatsappAPI.contacts(q).then((r) => setContacts(r.data || [])).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  const manualDigits = manual.replace(/\D/g, '');
  return (
    <ModalShell title="Nuevo mensaje" onClose={onClose}>
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o creador…" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7F653]" />
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
        {contacts.length === 0 ? <p className="p-4 text-sm text-gray-400 text-center">Sin contactos con teléfono</p> : contacts.map((c) => (
          <button key={`${c.kind}-${c.id}`} onClick={() => onPick(c)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#17181A] truncate">{c.name}</p>
              <p className="text-xs text-gray-400">{c.phone_formatted}</p>
            </div>
            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${c.kind === 'client' ? 'bg-[#D7F653]/40 text-[#17181A]' : 'bg-gray-100 text-gray-500'}`}>{c.kind === 'client' ? 'Cliente' : 'Creador'}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">O escribe un número (con indicativo, ej. 57 300 123 4567)</label>
        <div className="flex gap-2">
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="57 300 123 4567" className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7F653]" />
          <button
            disabled={manualDigits.length < 8}
            onClick={() => onPick({ id: manualDigits, kind: 'manual', name: '', wa: manualDigits, phone_formatted: `+${manualDigits}` })}
            className="px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium disabled:opacity-50"
          >Abrir</button>
        </div>
      </div>
    </ModalShell>
  );
};

const TemplateModal = ({ phone, clientId, contactName, onClose, onSent }) => {
  const [templates, setTemplates] = useState(null);
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    whatsappAPI.templates().then((r) => setTemplates((r.data || []).filter((t) => t.status === 'APPROVED'))).catch((e) => { setTemplates([]); setErr(e.response?.data?.error || 'No se pudieron cargar las plantillas'); });
  }, []);
  const params = selected ? paramsOf(selected.body) : [];
  const named = selected ? (selected.parameter_format === 'NAMED' || params.some((p) => !/^\d+$/.test(p))) : false;
  const send = async () => {
    try {
      setSending(true); setErr(null);
      const parameters = params.map((k) => (named ? { type: 'text', parameter_name: k, text: values[k] || '' } : { type: 'text', text: values[k] || '' }));
      await whatsappAPI.sendTemplate({
        to: phone, name: selected.name, language: selected.language, client_id: clientId,
        components: parameters.length ? [{ type: 'body', parameters }] : [],
        rendered_text: renderTemplate(selected.body, values),
      });
      onSent();
    } catch (e) {
      setErr(e.response?.data?.error || 'No se pudo enviar la plantilla');
    } finally { setSending(false); }
  };
  return (
    <ModalShell title={`Enviar plantilla a ${contactName}`} onClose={onClose} wide>
      {err && <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      {templates === null ? <p className="text-sm text-gray-400">Cargando plantillas…</p> : templates.length === 0 ? (
        <p className="text-sm text-gray-500">No hay plantillas aprobadas todavía. Las plantillas se crean en Kapso/Meta y Meta tarda unos minutos u horas en aprobarlas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {templates.map((t) => (
              <button key={t.id || t.name} onClick={() => { setSelected(t); setValues({}); }} className={`w-full text-left px-3 py-2 rounded-xl border text-sm ${selected?.name === t.name ? 'border-[#17181A] bg-[#D7F653]/20' : 'border-gray-200 hover:bg-gray-50'}`}>
                <p className="font-medium text-[#17181A] truncate">{t.name}</p>
                <p className="text-[11px] text-gray-400">{t.language} · {t.category}</p>
              </button>
            ))}
          </div>
          <div>
            {!selected ? <p className="text-sm text-gray-400">Elige una plantilla para ver su contenido.</p> : (
              <>
                <div className="bg-[#F7F7F5] rounded-xl p-3 text-sm text-[#17181A] whitespace-pre-wrap border border-gray-100">{renderTemplate(selected.body, values)}</div>
                {params.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {params.map((k) => (
                      <div key={k}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{k}</label>
                        <input value={values[k] || ''} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D7F653]" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-4">
                  <button onClick={send} disabled={sending || params.some((k) => !values[k])} className="px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                    <Send size={15} /> {sending ? 'Enviando…' : 'Enviar plantilla'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
};

const LinkClientModal = ({ phone, onClose, onLinked }) => {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { clientsAPI.getAll().then((r) => setClients(r.data || [])).catch(() => {}); }, []);
  const filtered = clients.filter((c) => (c.company || c.name || '').toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const link = async (id) => {
    try { setSaving(true); await whatsappAPI.linkClient(phone, id); onLinked(); } finally { setSaving(false); }
  };
  return (
    <ModalShell title="Vincular conversación a un cliente" onClose={onClose}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 mb-3 focus:outline-none focus:ring-2 focus:ring-[#D7F653]" />
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
        {filtered.map((c) => (
          <button key={c.id} disabled={saving} onClick={() => link(c.id)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-[#17181A]">{c.company || c.name}</button>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">Sin resultados</p>}
      </div>
    </ModalShell>
  );
};

export default WhatsAppInbox;
