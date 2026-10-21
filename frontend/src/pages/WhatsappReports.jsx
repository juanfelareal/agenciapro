// [briefings] Configuración → Reportes por WhatsApp (solo admin).
// Quién del equipo recibe cada resumen, reporte diario al dueño de cada marca (add-on),
// número desde el que se envía (compartido de Orbit o propio, add-on) y envío de prueba.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ADDONS_BY_KEY } from '../config/pricing';
import { Link, Navigate } from 'react-router-dom';
import {
  ChevronLeft, MessageCircle, Lock, ArrowUpRight, Loader2, Save, Send, Eye, X, Users, Store, Phone, Hash, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { whatsappBriefingsAPI } from '../utils/api';

// Precio mensual de cada add-on cuando no viene incluido en el plan anual (fuente única: config/pricing.js).
const ADDON_PRICES = Object.fromEntries(Object.entries(ADDONS_BY_KEY).map(([k, a]) => [k, a.price]));
const ADDON_LABELS = { hourly_reports: 'Reportes cada hora', owner_reports: 'Reporte diario al dueño de cada marca', dedicated_number: 'Número de WhatsApp propio' };

const KIND_META = [
  { key: 'morning', label: 'Mañana', hint: '06:00 · rendimiento de ayer por marca' },
  { key: 'tasks', label: 'Tareas', hint: '06:00 · tareas de hoy y de la semana' },
  { key: 'noon', label: 'Mediodía', hint: '12:00 · ventas de hoy hasta ahora' },
  { key: 'alerts', label: 'Alertas', hint: 'cada hora · marcas muy bien o muy mal' },
  { key: 'hourly', label: 'Cada hora', hint: '10:00–21:00 · ventas, pedidos, pauta y ROAS de hoy', addon: 'hourly_reports' },
];
const DEFAULT_KINDS = ['morning', 'tasks', 'noon', 'alerts'];

const cop = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const digits = (v) => String(v || '').replace(/\D/g, '');
const fmtPhone = (v) => {
  const d = digits(v);
  if (d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d ? `+${d}` : '';
};

const Switch = ({ checked, disabled, onChange, label, size = 'md' }) => {
  const sm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.5)] ${
        sm ? 'h-5 w-9' : 'h-6 w-11'
      } ${checked ? 'bg-[var(--accent)]' : 'bg-gray-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block transform rounded-full bg-white shadow transition-transform ${sm ? 'h-4 w-4' : 'h-5 w-5'} ${
        checked ? (sm ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5'
      }`} />
    </button>
  );
};

/** Chip "Incluido en el plan anual · o $X/mes" con link a Suscripción */
const AddonChip = ({ addon }) => (
  <Link
    to="/app/suscripcion"
    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100"
    title={`Activar "${ADDON_LABELS[addon]}" en Suscripción`}
  >
    <Lock size={10} /> Incluido en el plan anual · o {cop(ADDON_PRICES[addon])}/mes <ArrowUpRight size={10} />
  </Link>
);

function Section({ icon, title, hint, right, children }) {
  const Icon = icon;
  return (
    <section className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--dark)] flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
            {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const inputCls = 'w-full rounded-xl border border-[var(--line-2)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.2)]';

/** Vista previa del mensaje como burbuja de WhatsApp */
function PreviewModal({ preview, onClose }) {
  if (!preview) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121314]/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] shadow-xl border border-[var(--line)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
          <p className="text-sm font-semibold text-[var(--ink)]">{preview.title}</p>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-[rgb(var(--ink-rgb)/0.06)]" aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="p-4 bg-[#E7E2D8] dark:bg-[#1E1F22] max-h-[70vh] overflow-y-auto">
          {preview.loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600"><Loader2 size={14} className="animate-spin" /> Generando…</div>
          ) : preview.error ? (
            <p className="text-sm text-red-700">{preview.error}</p>
          ) : (
            <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#D9FDD3] text-[#111B21] px-3.5 py-2.5 shadow-sm">
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{renderWa(preview.text || '_Sin contenido para mostrar._')}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Negritas *x* e itálicas _x_ de WhatsApp */
function renderWa(text) {
  const parts = String(text).split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return parts.map((p, i) => {
    if (/^\*[^*]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
    if (/^_[^_]+_$/.test(p)) return <em key={i} className="text-[#54656F]">{p.slice(1, -1)}</em>;
    return p;
  });
}

export default function WhatsappReports() {
  const { isAdmin, user } = useAuth();
  const [data, setData] = useState(null);       // GET recipients
  const [ownersData, setOwnersData] = useState(null); // GET owners
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Borradores
  const [rows, setRows] = useState([]);         // destinatarios del equipo
  const [owners, setOwners] = useState([]);
  const [number, setNumber] = useState({ mode: 'shared', phone_number_id: '' });
  const [saving, setSaving] = useState(null);   // 'recipients' | 'owners' | 'number'
  const [preview, setPreview] = useState(null);
  const [test, setTest] = useState({ kind: 'morning', clientId: '', phone: '', sending: false, result: null });

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [r, o] = await Promise.all([whatsappBriefingsAPI.recipients(), whatsappBriefingsAPI.owners()]);
      setData(r.data); setOwnersData(o.data);
      const byMember = Object.fromEntries((r.data.recipients || []).filter((x) => x.team_member_id).map((x) => [x.team_member_id, x]));
      const byPhone = Object.fromEntries((r.data.recipients || []).map((x) => [x.phone, x]));
      const memberRows = (r.data.members || []).map((m) => {
        const rec = byMember[m.id] || (m.wa ? byPhone[m.wa] : null);
        return {
          key: `m-${m.id}`, team_member_id: m.id, name: m.name, role: m.role,
          phone: rec?.phone || m.wa || '', phoneFromMember: Boolean(m.wa),
          kinds: rec ? (rec.enabled ? rec.kinds : []) : [],
        };
      });
      const linked = new Set(memberRows.map((x) => x.phone).filter(Boolean));
      const extra = (r.data.recipients || []).filter((x) => !x.team_member_id && !linked.has(x.phone)).map((x) => ({
        key: `p-${x.phone}`, team_member_id: null, name: x.name || '', role: null, phone: x.phone, phoneFromMember: false, kinds: x.enabled ? x.kinds : [],
      }));
      setRows([...memberRows, ...extra]);
      setOwners((o.data.owners || []).map((x) => ({ ...x, phone: x.phone || '' })));
      setNumber({ mode: r.data.number?.mode === 'dedicated' || r.data.number?.phone_number_id ? 'dedicated' : 'shared', phone_number_id: r.data.number?.phone_number_id || '' });
      const me = (r.data.members || []).find((m) => m.id === user?.id);
      setTest((t) => ({ ...t, phone: t.phone || me?.wa || '' }));
    } catch (err) {
      setLoadError(err?.response?.data?.error || 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const addons = data?.addons || {};
  const hourlyOn = addons.hourly_reports === true;
  const ownerOn = ownersData?.addon_enabled === true || addons.owner_reports === true;
  const dedicatedOn = addons.dedicated_number === true;
  const agency = ownersData?.agency_name || data?.agency_name || 'Tu agencia';

  const flash = (type, text) => { setNotice({ type, text }); window.clearTimeout(flash.t); flash.t = window.setTimeout(() => setNotice(null), 5000); };
  const handleError = (err, fallback) => {
    const d = err?.response?.data;
    if (d?.upgrade && d?.addon) {
      flash('upgrade', `${d.error}. `);
      return;
    }
    flash('error', d?.error || fallback);
  };

  // ── Destinatarios ──
  const toggleKind = (key, kind) => setRows((rs) => rs.map((r) => (r.key !== key ? r : { ...r, kinds: r.kinds.includes(kind) ? r.kinds.filter((k) => k !== kind) : [...r.kinds, kind] })));
  const setAll = (key, on) => setRows((rs) => rs.map((r) => (r.key !== key ? r : { ...r, kinds: on ? [...DEFAULT_KINDS, ...(hourlyOn && r.kinds.includes('hourly') ? ['hourly'] : [])] : [] })));
  const setRowPhone = (key, phone) => setRows((rs) => rs.map((r) => (r.key !== key ? r : { ...r, phone: digits(phone) })));
  const saveRecipients = async () => {
    const payload = rows.filter((r) => r.kinds.length && r.phone).map((r) => ({ team_member_id: r.team_member_id, phone: r.phone, name: r.name, kinds: r.kinds, enabled: true }));
    const missing = rows.find((r) => r.kinds.length && !r.phone);
    if (missing) return flash('error', `${missing.name || 'Un destinatario'} necesita un número de WhatsApp.`);
    setSaving('recipients');
    try {
      await whatsappBriefingsAPI.saveRecipients(payload);
      flash('ok', 'Destinatarios guardados.');
      await load();
    } catch (err) { handleError(err, 'No se pudieron guardar los destinatarios.'); } finally { setSaving(null); }
  };
  const activeRecipients = useMemo(() => rows.filter((r) => r.kinds.length && r.phone).length, [rows]);

  // ── Dueños ──
  const setOwner = (clientId, patch) => setOwners((os) => os.map((o) => (o.client_id !== clientId ? o : { ...o, ...patch })));
  const saveOwners = async () => {
    const bad = owners.find((o) => o.enabled && digits(o.phone).length < 8);
    if (bad) return flash('error', `${bad.brand}: escribe el WhatsApp del dueño antes de activar el reporte.`);
    setSaving('owners');
    try {
      await whatsappBriefingsAPI.saveOwners(owners.map((o) => ({ client_id: o.client_id, phone: digits(o.phone), name: o.name, enabled: o.enabled, send_morning: o.send_morning, send_noon: o.send_noon })));
      flash('ok', 'Reportes a dueños guardados.');
      await load();
    } catch (err) { handleError(err, 'No se pudieron guardar los dueños.'); } finally { setSaving(null); }
  };
  const activeOwners = owners.filter((o) => o.enabled).length;

  // ── Número ──
  const saveNumber = async () => {
    setSaving('number');
    try {
      const res = await whatsappBriefingsAPI.saveNumber(number.mode === 'dedicated' ? { mode: 'dedicated', phone_number_id: digits(number.phone_number_id) } : { mode: 'shared' });
      setNumber({ mode: res.data.mode, phone_number_id: res.data.phone_number_id || '' });
      flash('ok', res.data.mode === 'dedicated' ? 'Los mensajes saldrán desde el número propio de la agencia.' : 'Los mensajes saldrán desde el número compartido de Orbit.');
      await load();
    } catch (err) { handleError(err, 'No se pudo guardar el número.'); } finally { setSaving(null); }
  };

  // ── Vista previa ──
  const openPreview = async (kind, { clientId = null, sub = null, title } = {}) => {
    setPreview({ title: title || 'Vista previa', loading: true });
    try {
      const res = await whatsappBriefingsAPI.preview({ kind, ...(clientId ? { clientId } : {}), ...(sub ? { sub } : {}) });
      setPreview({ title: title || 'Vista previa', text: res.data.empty ? '_Hoy no hay nada que reportar para este tipo._' : res.data.text });
    } catch (err) {
      setPreview({ title: title || 'Vista previa', error: err?.response?.data?.error || 'No se pudo generar la vista previa.' });
    }
  };

  // ── Prueba ──
  const sendTest = async () => {
    setTest((t) => ({ ...t, sending: true, result: null }));
    try {
      const isOwner = test.kind === 'owner';
      const res = await whatsappBriefingsAPI.test({
        kind: isOwner ? `owner:${test.clientId}` : test.kind,
        ...(isOwner ? { clientId: Number(test.clientId) } : {}),
        ...(test.phone ? { phone: digits(test.phone) } : {}),
      });
      const r = res.data.results?.[0];
      const text = !r ? 'Sin destinatarios.' : r.skipped ? `Nada que enviar (${r.skipped}).` : r.delivered ? `Enviado a ${fmtPhone(r.phone)} (${r.parts} mensaje${r.parts === 1 ? '' : 's'}).` : `Quedó pendiente para ${fmtPhone(r.phone)}: ${r.reason || 'se avisará con la plantilla y se entrega al responder'}.`;
      setTest((t) => ({ ...t, sending: false, result: { ok: Boolean(r?.delivered), text } }));
    } catch (err) {
      const d = err?.response?.data;
      setTest((t) => ({ ...t, sending: false, result: { ok: false, text: d?.error || 'No se pudo enviar la prueba.', upgrade: d?.upgrade } }));
    }
  };

  if (!isAdmin) return <Navigate to="/app/settings" replace />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Link to="/app/settings" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[var(--ink)] mb-2">
            <ChevronLeft size={14} /> Configuración
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Reportes por WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Resúmenes automáticos de ventas, pauta y tareas para tu equipo, y un reporte diario para el dueño de cada marca firmado por {agency}.
          </p>
        </div>
        <Link to="/app/suscripcion" className="inline-flex items-center gap-1 rounded-full border border-[var(--line-2)] text-[var(--ink)] text-sm font-semibold px-4 py-2 hover:bg-[rgb(var(--ink-rgb)/0.04)] self-start sm:self-auto">
          Add-ons y plan <ArrowUpRight size={14} />
        </Link>
      </div>

      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 ${
          notice.type === 'ok' ? 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent-deep)]' : notice.type === 'upgrade' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-red-50 text-red-700'
        }`}>
          <span>{notice.text}</span>
          {notice.type === 'upgrade' && <Link to="/app/suscripcion" className="font-semibold underline whitespace-nowrap">Ir a Suscripción</Link>}
        </div>
      )}

      {loading && !data ? (
        <div className="glass-card p-8 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando configuración…</div>
      ) : loadError ? (
        <div className="glass-card p-6 text-sm text-red-700">{loadError} <button type="button" className="underline ml-2" onClick={load}>Reintentar</button></div>
      ) : (
        <>
          {/* 1 · Quién recibe los reportes */}
          <Section
            icon={Users}
            title="Quién recibe los reportes"
            hint={`${activeRecipients} persona${activeRecipients === 1 ? '' : 's'} del equipo con reportes activos. Cada quien elige qué tipo recibe.`}
            right={(
              <button type="button" onClick={saveRecipients} disabled={saving === 'recipients'} className="btn-primary text-sm disabled:opacity-50">
                {saving === 'recipients' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
              </button>
            )}
          >
            {!rows.length ? (
              <p className="text-sm text-gray-500">No hay miembros activos. Agrega a tu equipo en <Link to="/app/team" className="underline">Equipo</Link>.</p>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                      <th className="text-left font-medium pb-2 pr-3">Persona</th>
                      <th className="text-left font-medium pb-2 pr-3">WhatsApp</th>
                      {KIND_META.map((k) => (
                        <th key={k.key} className="text-center font-medium pb-2 px-2 whitespace-nowrap" title={k.hint}>
                          {k.label}
                        </th>
                      ))}
                      <th className="text-right font-medium pb-2 pl-2">Todo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {rows.map((r) => {
                      const active = r.kinds.length > 0;
                      return (
                        <tr key={r.key} className={active ? '' : 'opacity-70'}>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-[var(--ink)] whitespace-nowrap">{r.name || 'Sin nombre'}</p>
                            {r.role && <p className="text-[11px] text-gray-500 capitalize">{r.role}</p>}
                          </td>
                          <td className="py-2.5 pr-3 min-w-[170px]">
                            {r.phoneFromMember ? (
                              <span className="inline-flex items-center gap-1 text-[var(--ink)] whitespace-nowrap"><Phone size={12} className="text-gray-400" /> {fmtPhone(r.phone)}</span>
                            ) : (
                              <input value={r.phone} onChange={(e) => setRowPhone(r.key, e.target.value)} placeholder="300 123 4567" className={`${inputCls} py-1.5`} inputMode="tel" />
                            )}
                          </td>
                          {KIND_META.map((k) => {
                            const locked = k.addon && !addons[k.addon];
                            return (
                              <td key={k.key} className="py-2.5 px-2 text-center">
                                {locked ? (
                                  <Link to="/app/suscripcion" title={`${ADDON_LABELS[k.addon]} · incluido en el plan anual o ${cop(ADDON_PRICES[k.addon])}/mes`} className="inline-flex text-amber-700"><Lock size={14} /></Link>
                                ) : (
                                  <Switch size="sm" checked={r.kinds.includes(k.key)} onChange={() => toggleKind(r.key, k.key)} label={`${k.label} para ${r.name}`} />
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 pl-2 text-right">
                            <Switch checked={active} onChange={(v) => setAll(r.key, v)} label={`${active ? 'Quitar' : 'Activar'} reportes para ${r.name}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {KIND_META.map((k) => (
                <button key={k.key} type="button" onClick={() => openPreview(k.key, { title: `Vista previa · ${k.label}` })} disabled={k.addon && !addons[k.addon]} className="inline-flex items-center gap-1 rounded-full border border-[var(--line-2)] px-2.5 py-1 hover:bg-[rgb(var(--ink-rgb)/0.04)] disabled:opacity-40">
                  <Eye size={12} /> {k.label}
                </button>
              ))}
              {!hourlyOn && <AddonChip addon="hourly_reports" />}
            </div>
          </Section>

          {/* 2 · Reporte al dueño de cada marca */}
          <Section
            icon={Store}
            title="Reporte al dueño de cada marca"
            hint={ownerOn
              ? `Cada dueño recibe a las 06:00 y 12:00 solo los datos de su marca, con la firma "Enviado por ${agency} con Orbit". ${activeOwners} marca${activeOwners === 1 ? '' : 's'} activa${activeOwners === 1 ? '' : 's'}.`
              : 'Cada dueño recibe solo los datos de su marca (ventas, pedidos, ticket, pauta y ROAS) con la firma de tu agencia.'}
            right={(
              <div className="flex items-center gap-2">
                {!ownerOn && <AddonChip addon="owner_reports" />}
                <button type="button" onClick={saveOwners} disabled={saving === 'owners'} className="btn-primary text-sm disabled:opacity-50">
                  {saving === 'owners' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
                </button>
              </div>
            )}
          >
            {!owners.length ? (
              <p className="text-sm text-gray-500">No hay marcas activas todavía.</p>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                      <th className="text-left font-medium pb-2 pr-3">Marca</th>
                      <th className="text-left font-medium pb-2 pr-3">WhatsApp del dueño</th>
                      <th className="text-left font-medium pb-2 pr-3">Nombre</th>
                      <th className="text-center font-medium pb-2 px-2">Mañana</th>
                      <th className="text-center font-medium pb-2 px-2">Mediodía</th>
                      <th className="text-center font-medium pb-2 px-2">Vista</th>
                      <th className="text-right font-medium pb-2 pl-2">Activo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {owners.map((o) => (
                      <tr key={o.client_id} className={o.enabled ? '' : 'opacity-80'}>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-[var(--ink)] whitespace-nowrap">{o.brand}</p>
                          {o.growth && <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--accent-deep)]">Growth</span>}
                        </td>
                        <td className="py-2.5 pr-3 min-w-[170px]">
                          <input value={o.phone} onChange={(e) => setOwner(o.client_id, { phone: digits(e.target.value) })} placeholder={o.suggested_phone ? fmtPhone(o.suggested_phone) : '300 123 4567'} className={`${inputCls} py-1.5`} inputMode="tel" />
                        </td>
                        <td className="py-2.5 pr-3 min-w-[140px]">
                          <input value={o.name} onChange={(e) => setOwner(o.client_id, { name: e.target.value })} placeholder="Nombre del dueño" className={`${inputCls} py-1.5`} />
                        </td>
                        <td className="py-2.5 px-2 text-center"><Switch size="sm" checked={o.send_morning} onChange={(v) => setOwner(o.client_id, { send_morning: v })} label={`Mañana ${o.brand}`} /></td>
                        <td className="py-2.5 px-2 text-center"><Switch size="sm" checked={o.send_noon} onChange={(v) => setOwner(o.client_id, { send_noon: v })} label={`Mediodía ${o.brand}`} /></td>
                        <td className="py-2.5 px-2 text-center">
                          <button type="button" onClick={() => openPreview('owner', { clientId: o.client_id, sub: 'morning', title: `${agency} · ${o.brand}` })} className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--line-2)] hover:bg-[rgb(var(--ink-rgb)/0.04)]" title="Vista previa del mensaje de la mañana">
                            <Eye size={14} />
                          </button>
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          {ownerOn ? (
                            <Switch checked={o.enabled} onChange={(v) => setOwner(o.client_id, { enabled: v })} label={`${o.enabled ? 'Desactivar' : 'Activar'} reporte a ${o.brand}`} />
                          ) : (
                            <Link to="/app/suscripcion" className="inline-flex text-amber-700" title="Activa el add-on en Suscripción"><Lock size={16} /></Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-gray-500">El dueño nunca ve datos de otras marcas ni de la agencia. Si no ha escrito en 24 h, recibe primero un aviso con el botón «Ver resumen».</p>
          </Section>

          {/* 3 · Número de WhatsApp */}
          <Section
            icon={Hash}
            title="Número de WhatsApp"
            hint="Desde qué número salen los reportes y las respuestas automáticas."
            right={(
              <button type="button" onClick={saveNumber} disabled={saving === 'number' || (number.mode === 'dedicated' && digits(number.phone_number_id).length < 6)} className="btn-primary text-sm disabled:opacity-50">
                {saving === 'number' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
              </button>
            )}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'shared', label: 'Compartido de Orbit', hint: 'El número de Orbit atiende a todas las agencias. Sin configuración.', locked: false },
                { id: 'dedicated', label: 'Propio de la agencia', hint: 'Tu número verificado en Meta, conectado vía Kapso.', locked: !dedicatedOn },
              ].map((opt) => {
                const active = number.mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => !opt.locked && setNumber((n) => ({ ...n, mode: opt.id }))}
                    className={`text-left rounded-xl border p-4 transition-all ${active ? 'border-[var(--accent)] ring-2 ring-[rgb(var(--accent-rgb)/0.25)] bg-[var(--surface)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[rgb(var(--ink-rgb)/0.25)]'} ${opt.locked ? 'opacity-80 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--ink)]">{opt.label}{opt.id === 'dedicated' && <span className="text-gray-400 font-normal"> · add-on</span>}</span>
                      {active && !opt.locked && <Check size={14} className="text-[var(--accent-deep)]" />}
                      {opt.locked && <Lock size={14} className="text-amber-700" />}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{opt.hint}</p>
                    {opt.locked && <div className="mt-2"><AddonChip addon="dedicated_number" /></div>}
                  </button>
                );
              })}
            </div>
            {number.mode === 'dedicated' && dedicatedOn && (
              <div className="mt-4 max-w-md">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">phone_number_id (Meta / Kapso)</label>
                <input value={number.phone_number_id} onChange={(e) => setNumber((n) => ({ ...n, phone_number_id: digits(e.target.value) }))} placeholder="p. ej. 123456789012345" className={inputCls} inputMode="numeric" />
                <p className="text-[11px] text-gray-500 mt-1">Lo encuentras en Kapso → Números, o en Meta Business → WhatsApp → API. Debe estar en el mismo proyecto Kapso de Orbit.</p>
              </div>
            )}
          </Section>

          {/* 4 · Prueba */}
          <Section icon={MessageCircle} title="Enviarme una prueba ahora" hint="Envía el reporte elegido en este momento a un número, sin esperar al horario.">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Reporte</label>
                <select value={test.kind} onChange={(e) => setTest((t) => ({ ...t, kind: e.target.value, result: null }))} className={inputCls}>
                  {KIND_META.filter((k) => !k.addon || addons[k.addon]).map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                  {ownerOn && <option value="owner">Dueño de marca</option>}
                </select>
              </div>
              {test.kind === 'owner' && (
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Marca</label>
                  <select value={test.clientId} onChange={(e) => setTest((t) => ({ ...t, clientId: e.target.value, result: null }))} className={inputCls}>
                    <option value="">Elige una marca</option>
                    {owners.map((o) => <option key={o.client_id} value={o.client_id}>{o.brand}</option>)}
                  </select>
                </div>
              )}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Enviar a</label>
                <input value={test.phone} onChange={(e) => setTest((t) => ({ ...t, phone: digits(e.target.value), result: null }))} placeholder="300 123 4567" className={inputCls} inputMode="tel" />
              </div>
              <button type="button" onClick={sendTest} disabled={test.sending || !test.phone || (test.kind === 'owner' && !test.clientId)} className="btn-secondary text-sm disabled:opacity-50 whitespace-nowrap">
                {test.sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar prueba
              </button>
            </div>
            {test.result && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-sm flex items-center justify-between gap-3 ${test.result.ok ? 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent-deep)]' : test.result.upgrade ? 'bg-amber-50 text-amber-800' : 'bg-[rgb(var(--ink-rgb)/0.05)] text-[var(--ink)]'}`}>
                <span>{test.result.text}</span>
                {test.result.upgrade && <Link to="/app/suscripcion" className="font-semibold underline whitespace-nowrap">Suscripción</Link>}
              </div>
            )}
          </Section>
        </>
      )}

      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
