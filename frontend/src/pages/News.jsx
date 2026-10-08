import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Plus, Search, X, ImagePlus, Trash2, Pencil, Loader2, ChevronLeft, ChevronRight,
  Check, AlertCircle, UploadCloud, Pin, PinOff, Eye, Building2, Globe, AlertTriangle, RefreshCw,
  Trophy, Bell, CheckCheck, ChevronDown,
} from 'lucide-react';
import { newsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

/**
 * Novedades — canal interno donde el equipo publica las noticias importantes de
 * las marcas (urgencias, cambios, logros, recordatorios) para que todos estén
 * enterados y quede registrado quién lo vio y cuándo. El feed es el historial.
 */

// ─── Catálogos ───
const CATEGORIES = [
  { id: 'novedad', label: 'Novedad', icon: Megaphone, pill: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' },
  { id: 'urgente', label: 'Urgente', icon: AlertTriangle, pill: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  { id: 'cambio', label: 'Cambio', icon: RefreshCw, pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { id: 'logro', label: 'Logro', icon: Trophy, pill: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  { id: 'recordatorio', label: 'Recordatorio', icon: Bell, pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
];
const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const PAGE_SIZE = 30;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

// ─── Fechas en hora Colombia ───
const TZ = 'America/Bogota';
const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const formatFull = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
};
const formatShort = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d);
};
const formatTime = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
};
const timeAgo = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} d`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  return formatShort(value);
};
// Clave y etiqueta de mes para agrupar el historial ("Octubre 2026")
const monthKey = (value) => {
  const d = toDate(value);
  if (!d) return 'sin-fecha';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
};
const monthLabel = (value) => {
  const d = toDate(value);
  if (!d) return 'Sin fecha';
  const s = new Intl.DateTimeFormat('es-CO', { timeZone: TZ, month: 'long', year: 'numeric' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1).replace(' de ', ' ');
};

const initials = (name) => {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const errorMessage = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

const notifyUnreadChanged = (unread) => {
  window.dispatchEvent(new CustomEvent('news:unread-changed', { detail: typeof unread === 'number' ? { unread } : undefined }));
};

// ─── Hook: subida de pantallazos (adjuntar, drag&drop, pegar) ───
let uploadSeq = 0;
const useImageUploads = (initialUrls = []) => {
  const [items, setItems] = useState(() => initialUrls.map((url) => ({ key: `init-${uploadSeq++}`, url, preview: url, progress: 100, done: true })));
  const [error, setError] = useState(null);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []).filter((f) => f && f.type?.startsWith('image/'));
    if (!files.length) return;
    setError(null);
    files.forEach((file) => {
      if (!IMAGE_MIMES.includes(file.type.toLowerCase())) { setError('Solo se permiten imágenes PNG, JPG, WEBP o GIF'); return; }
      if (file.size > MAX_IMAGE_BYTES) { setError(`"${file.name || 'imagen'}" supera los 8 MB`); return; }
      const key = `up-${uploadSeq++}`;
      const preview = URL.createObjectURL(file);
      setItems((prev) => [...prev, { key, preview, progress: 0, done: false }]);
      newsAPI.upload(file, (pct) => {
        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, progress: pct } : it)));
      })
        .then((res) => {
          setItems((prev) => prev.map((it) => (it.key === key ? { ...it, url: res.data.url, progress: 100, done: true } : it)));
        })
        .catch((err) => {
          setError(errorMessage(err, 'No se pudo subir la imagen'));
          setItems((prev) => prev.filter((it) => it.key !== key));
          URL.revokeObjectURL(preview);
        });
    });
  }, []);

  const remove = useCallback((key) => {
    setItems((prev) => {
      const it = prev.find((x) => x.key === key);
      if (it && it.preview?.startsWith('blob:')) URL.revokeObjectURL(it.preview);
      return prev.filter((x) => x.key !== key);
    });
  }, []);

  const handlePaste = useCallback((e) => {
    const files = Array.from(e.clipboardData?.items || [])
      .filter((it) => it.kind === 'file' && it.type?.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  }, [addFiles]);

  const urls = useMemo(() => items.filter((it) => it.done && it.url).map((it) => it.url), [items]);
  const busy = items.some((it) => !it.done);

  return { items, addFiles, remove, handlePaste, urls, busy, error, clearError: () => setError(null) };
};

// ─── Zona de pantallazos ───
const ImageAttachZone = ({ uploads }) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploads.addFiles(e.dataTransfer?.files);
  };

  return (
    <div>
      <div
        tabIndex={0}
        onPaste={uploads.handlePaste}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed transition-colors p-4 ${
          dragging ? 'border-[#17181A] bg-[#D7F653]/20' : 'border-gray-200 bg-white/50 hover:border-gray-300'
        } focus:outline-none focus:border-[#17181A]`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ImagePlus size={15} /> Adjuntar pantallazo
          </button>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <UploadCloud size={13} className="shrink-0" />
            Arrastra imágenes aquí o pega con <kbd className="px-1 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-mono">Ctrl/Cmd+V</kbd>
            <span className="hidden sm:inline">· PNG, JPG, WEBP o GIF · máx 8 MB</span>
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => { uploads.addFiles(e.target.files); e.target.value = ''; }}
        />

        {uploads.items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {uploads.items.map((it) => (
              <div key={it.key} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                <img src={it.preview} alt="" className={`w-full h-full object-cover ${it.done ? '' : 'opacity-50'}`} />
                {!it.done && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/40">
                    <Loader2 size={16} className="animate-spin text-[#17181A]" />
                    <span className="text-[10px] font-semibold text-[#17181A]">{it.progress}%</span>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                      <div className="h-full bg-[#17181A] transition-all" style={{ width: `${it.progress}%` }} />
                    </div>
                  </div>
                )}
                {it.done && (
                  <button
                    type="button"
                    onClick={() => uploads.remove(it.key)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#17181A]/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Quitar"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {uploads.error && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={13} /> {uploads.error}
          <button type="button" onClick={uploads.clearError} className="ml-1 underline">ok</button>
        </p>
      )}
    </div>
  );
};

// ─── Lightbox simple ───
const Lightbox = ({ images, index, onClose, onIndex }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onIndex]);

  if (!images?.length) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" title="Cerrar">
        <X size={20} />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length); }}
            className="absolute left-3 sm:left-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length); }}
            className="absolute right-3 sm:right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
      <img
        src={images[index]}
        alt={`Imagen ${index + 1}`}
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <div className="absolute bottom-4 text-white/80 text-xs font-medium">{index + 1} / {images.length}</div>
      )}
    </div>
  );
};

// ─── Pills / avatar ───
const Pill = ({ className = '', children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${className}`}>
    {children}
  </span>
);

const CategoryPill = ({ id }) => {
  const c = CATEGORY_BY_ID[id] || CATEGORY_BY_ID.novedad;
  const Icon = c.icon;
  return <Pill className={c.pill}><Icon size={11} /> {c.label}</Pill>;
};

const BrandPill = ({ item }) => (
  item.client_id ? (
    <Pill className="bg-[#17181A] text-white border-[#17181A] max-w-[220px]" title={item.client_name || 'Marca'}>
      <Building2 size={11} className="shrink-0" /> <span className="truncate">{item.client_name || 'Marca'}</span>
    </Pill>
  ) : (
    <Pill className="bg-white/70 text-gray-600 border-gray-200"><Globe size={11} /> General</Pill>
  )
);

const Avatar = ({ name, size = 'sm' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full bg-[#17181A] text-[#D7F653] font-bold shrink-0 ${
      size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
    }`}
    title={name || 'Sin autor'}
  >
    {initials(name)}
  </span>
);

// ─── Tarjeta del feed ───
const NewsCard = ({ item, onOpen, onLightbox, onAck }) => {
  const thumbs = item.images.slice(0, 4);
  const extra = item.images.length - thumbs.length;
  const unread = !item.is_read;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item); }}
      className={`glass-card p-4 flex gap-3 cursor-pointer hover:bg-white/80 transition-colors ${
        unread ? 'border-l-4 border-l-[#D7F653] ring-1 ring-[#D7F653]/60' : ''
      }`}
    >
      <div className="w-3 pt-2 shrink-0 flex justify-center">
        {unread && <span className="w-2.5 h-2.5 rounded-full bg-[#D7F653] ring-2 ring-[#17181A]/80" title="Sin leer" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <BrandPill item={item} />
          <CategoryPill id={item.category} />
          {item.is_pinned && (
            <Pill className="bg-[#D7F653]/60 text-[#3f4a10] border-[#c6e63c]" title="Fijada arriba"><Pin size={11} /> Fijada</Pill>
          )}
        </div>
        <h3 className={`text-[#17181A] leading-snug ${unread ? 'font-bold' : 'font-semibold'}`}>{item.title}</h3>
        {item.body && <p className="text-sm text-gray-600 mt-1 line-clamp-3 whitespace-pre-line">{item.body}</p>}

        {thumbs.length > 0 && (
          <div className="flex gap-2 mt-3">
            {thumbs.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={(e) => { e.stopPropagation(); onLightbox(item.images, i); }}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-[#17181A] transition"
                title="Ver imagen"
              >
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                {i === thumbs.length - 1 && extra > 0 && (
                  <span className="absolute inset-0 bg-black/55 text-white text-sm font-bold flex items-center justify-center">+{extra}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={item.created_by_name} />
            <span className="font-medium text-gray-700">{item.created_by_name || 'Sin autor'}</span>
          </span>
          <span title={formatFull(item.created_at)}>{timeAgo(item.created_at)}</span>
          <span className="inline-flex items-center gap-1" title="Personas que confirmaron que están enteradas">
            <Eye size={13} /> Enterados: {item.read_count}
          </span>
          <span className="ml-auto">
            {unread ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAck(item); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#17181A] text-[#D7F653] text-xs font-semibold hover:bg-black transition-colors"
                title="Confirmar que ya leíste esta novedad"
              >
                <Check size={13} /> Enterado
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold" title="Ya confirmaste que estás enterado">
                <CheckCheck size={13} /> Enterado
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Selector de marca (reutilizado en filtro y formulario) ───
const ClientSelect = ({ value, onChange, clients, loading, allowFilters = false, className = '' }) => (
  <div className={`relative ${className}`}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 bg-white/80 text-sm text-[#17181A] focus:outline-none focus:border-[#17181A] disabled:opacity-60"
    >
      {allowFilters ? (
        <>
          <option value="">Todas las marcas</option>
          <option value="general">Generales (sin marca)</option>
        </>
      ) : (
        <option value="">General (sin marca)</option>
      )}
      {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
    </select>
    {loading
      ? <Loader2 size={14} className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      : <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />}
  </div>
);

// ─── Modal: nueva / editar novedad ───
const NewsFormModal = ({ initial, clients, clientsLoading, onClose, onSaved }) => {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    title: initial?.title || '',
    body: initial?.body || '',
    client_id: initial?.client_id ? String(initial.client_id) : '',
    category: initial?.category || 'novedad',
    is_pinned: !!initial?.is_pinned,
  });
  const uploads = useImageUploads(initial?.images || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Ponle un título a la novedad'); return; }
    if (uploads.busy) { setError('Espera a que terminen de subir los pantallazos'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim() || null,
        client_id: form.client_id ? Number(form.client_id) : null,
        category: form.category,
        is_pinned: form.is_pinned,
        images: uploads.urls,
      };
      const res = isEdit ? await newsAPI.update(initial.id, payload) : await newsAPI.create(payload);
      onSaved(res.data, isEdit);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onPaste={uploads.handlePaste}
        onClick={(e) => e.stopPropagation()}
        className="glass-solid rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[#17181A]">{isEdit ? 'Editar novedad' : 'Nueva novedad'}</h2>
            <p className="text-xs text-gray-500">Cuéntale al equipo qué está pasando con la marca. Todos lo verán.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Título *</label>
            <input
              ref={titleRef}
              value={form.title}
              onChange={set('title')}
              maxLength={200}
              placeholder="Ej: Natnack lanza combo nuevo y sube el ticket promedio desde el lunes"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] focus:outline-none focus:ring-2 focus:ring-[#17181A]/20 focus:border-[#17181A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Detalle</label>
            <textarea
              value={form.body}
              onChange={set('body')}
              rows={6}
              placeholder="¿Qué pasó, desde cuándo aplica y qué tiene que hacer el equipo? Puedes pegar pantallazos aquí con Ctrl/Cmd+V."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] resize-y focus:outline-none focus:ring-2 focus:ring-[#17181A]/20 focus:border-[#17181A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Marca</label>
              <ClientSelect
                value={form.client_id}
                onChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
                clients={clients}
                loading={clientsLoading}
              />
              <p className="text-[11px] text-gray-400 mt-1">Déjalo en "General" si aplica a toda la agencia.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = form.category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: c.id }))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                        active ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]' : `${c.pill} hover:brightness-95`
                      }`}
                    >
                      <Icon size={12} /> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#17181A]"
            />
            <span className="text-sm">
              <span className="font-semibold text-[#17181A] inline-flex items-center gap-1"><Pin size={13} /> Fijar arriba del feed</span>
              <span className="block text-xs text-gray-500">Para lo que todo el equipo debe tener presente estos días.</span>
            </span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Pantallazos</label>
            <ImageAttachZone uploads={uploads} />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertCircle size={15} /> {error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button
            type="submit"
            disabled={saving || uploads.busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {uploads.busy ? 'Subiendo pantallazos…' : isEdit ? 'Guardar cambios' : 'Publicar novedad'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Modal: detalle + visto por ───
const NewsDetailModal = ({ item, currentUserId, isAdmin, canModerate, onClose, onEdit, onDeleted, onUpdated, onLightbox }) => {
  const [reads, setReads] = useState([]);
  const [loadingReads, setLoadingReads] = useState(true);
  const [pinning, setPinning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const isAuthor = item.created_by === currentUserId;
  const canEdit = isAuthor || canModerate;
  const canDelete = isAuthor || isAdmin;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadReads = useCallback(async () => {
    setLoadingReads(true);
    try {
      const res = await newsAPI.reads(item.id);
      setReads(res.data);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cargar quién la ha visto'));
    } finally {
      setLoadingReads(false);
    }
  }, [item.id]);

  // Abrir el detalle NO marca la novedad como leída: la persona confirma con el botón "Enterado".
  useEffect(() => { loadReads(); }, [item.id, loadReads]);

  const [acking, setAcking] = useState(false);
  const acknowledge = async () => {
    if (item.is_read || acking) return;
    setAcking(true);
    setError(null);
    try {
      const res = await newsAPI.markRead(item.id);
      onUpdated({ id: item.id, is_read: true, read_count: res.data.read_count });
      notifyUnreadChanged();
      loadReads();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo confirmar');
    } finally {
      setAcking(false);
    }
  };

  const togglePin = async () => {
    setPinning(true);
    setError(null);
    try {
      const res = await newsAPI.update(item.id, { is_pinned: !item.is_pinned });
      onUpdated(res.data);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cambiar el fijado'));
    } finally {
      setPinning(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('¿Eliminar esta novedad? Desaparece del historial para todo el equipo.')) return;
    setDeleting(true);
    try {
      await newsAPI.delete(item.id);
      onDeleted(item.id);
      notifyUnreadChanged();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo eliminar'));
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-solid rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl z-10">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <BrandPill item={item} />
              <CategoryPill id={item.category} />
              {item.is_pinned && <Pill className="bg-[#D7F653]/60 text-[#3f4a10] border-[#c6e63c]"><Pin size={11} /> Fijada</Pill>}
            </div>
            <h2 className="text-lg font-bold text-[#17181A] leading-snug">{item.title}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.is_read ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mr-1" title="Ya confirmaste que estás enterado">
                <CheckCheck size={14} /> Enterado
              </span>
            ) : (
              <button
                type="button"
                onClick={acknowledge}
                disabled={acking}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#17181A] text-[#D7F653] text-xs font-semibold hover:bg-black disabled:opacity-50 mr-1"
                title="Confirmar que ya leíste esta novedad"
              >
                {acking ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Enterado
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={togglePin} disabled={pinning} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50" title={item.is_pinned ? 'Desfijar' : 'Fijar arriba'}>
                {pinning ? <Loader2 size={16} className="animate-spin" /> : item.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={() => onEdit(item)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Editar"><Pencil size={16} /></button>
            )}
            {canDelete && (
              <button type="button" onClick={remove} disabled={deleting} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 disabled:opacity-50" title="Eliminar">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Cerrar"><X size={18} /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Autor y fecha */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Avatar name={item.created_by_name} size="md" />
            <div className="leading-tight">
              <div className="font-semibold text-[#17181A]">{item.created_by_name || 'Sin autor'}</div>
              <div className="text-xs text-gray-500">
                {formatFull(item.created_at)} · {timeAgo(item.created_at)}
                {item.updated_at && item.updated_at !== item.created_at && <span> · editada {timeAgo(item.updated_at)}</span>}
              </div>
            </div>
          </div>

          {/* Cuerpo */}
          {item.body ? (
            <p className="text-[15px] text-[#17181A] whitespace-pre-wrap leading-relaxed">{item.body}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Sin detalle.</p>
          )}

          {/* Imágenes */}
          {item.images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {item.images.map((url, i) => (
                <button
                  key={url + i}
                  type="button"
                  onClick={() => onLightbox(item.images, i)}
                  className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-[#17181A] transition text-left"
                  title="Ampliar"
                >
                  <img src={url} alt={`Imagen ${i + 1}`} className="w-full max-h-80 object-contain bg-white" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertCircle size={15} /> {error}</div>
          )}

          {/* Visto por */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-[#17181A] mb-3 flex items-center gap-2">
              <Eye size={15} /> Enterados
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{reads.length}</span>
            </h3>
            {loadingReads ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2"><Loader2 size={15} className="animate-spin" /> Cargando…</div>
            ) : reads.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-1">Nadie ha confirmado todavía.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {reads.map((r) => (
                  <li key={r.team_member_id} className="flex items-center gap-2.5 bg-white/70 border border-gray-100 rounded-xl px-3 py-2">
                    <Avatar name={r.name} size="md" />
                    <div className="min-w-0 leading-tight">
                      <div className="text-sm font-semibold text-[#17181A] truncate">
                        {r.name || 'Miembro'}{r.team_member_id === currentUserId ? <span className="text-gray-400 font-normal"> (tú)</span> : null}
                      </div>
                      <div className="text-xs text-gray-500" title={formatFull(r.read_at)}>{formatTime(r.read_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Página ───
const News = () => {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const isAdmin = user?.role === 'admin';
  const canModerate = ['admin', 'manager'].includes(user?.role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [category, setCategory] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images, index }
  const [notice, setNotice] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    newsAPI.clients()
      .then((res) => { if (!cancelled) setClients(res.data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setClientsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const buildParams = useCallback((offset) => {
    const params = { limit: PAGE_SIZE, offset };
    if (category) params.category = category;
    if (clientFilter) params.client_id = clientFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    if (onlyUnread) params.unread = 1;
    return params;
  }, [category, clientFilter, debouncedSearch, onlyUnread]);

  const readHasMore = (res) => {
    const header = res.headers?.['x-has-more'];
    if (header === '1') return true;
    if (header === '0') return false;
    return (res.data?.length || 0) >= PAGE_SIZE;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await newsAPI.list(buildParams(0));
      setItems(res.data);
      setHasMore(readHasMore(res));
    } catch (err) {
      setLoadError(errorMessage(err, 'No se pudieron cargar las novedades'));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await newsAPI.list(buildParams(items.length));
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        return [...prev, ...res.data.filter((it) => !seen.has(it.id))];
      });
      setHasMore(readHasMore(res));
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err, 'No se pudieron cargar más novedades') });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const selected = useMemo(() => items.find((it) => it.id === selectedId) || null, [items, selectedId]);
  const unreadLoaded = useMemo(() => items.filter((it) => !it.is_read).length, [items]);

  // Historial: fijadas arriba, luego agrupadas por mes
  const groups = useMemo(() => {
    const pinned = items.filter((it) => it.is_pinned);
    const rest = items.filter((it) => !it.is_pinned);
    const out = [];
    if (pinned.length) out.push({ key: 'pinned', label: 'Fijadas', icon: Pin, items: pinned });
    const byMonth = new Map();
    for (const it of rest) {
      const k = monthKey(it.created_at);
      if (!byMonth.has(k)) byMonth.set(k, { key: k, label: monthLabel(it.created_at), items: [] });
      byMonth.get(k).items.push(it);
    }
    return [...out, ...byMonth.values()];
  }, [items]);

  const replaceItem = useCallback((updated) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)));
  }, []);

  // "Enterado" desde la tarjeta: confirma lectura sin abrir el detalle
  const ackItem = useCallback(async (item) => {
    if (item.is_read) return;
    try {
      const res = await newsAPI.markRead(item.id);
      replaceItem({ id: item.id, is_read: true, read_count: res.data.read_count });
      notifyUnreadChanged();
    } catch (e) {
      setNotice({ type: 'error', text: e.response?.data?.error || 'No se pudo confirmar' });
    }
  }, [replaceItem]);

  const handleSaved = (saved, wasEdit) => {
    setShowForm(false);
    setEditing(null);
    if (wasEdit) {
      replaceItem(saved);
      setNotice({ type: 'success', text: 'Novedad actualizada' });
    } else {
      setItems((prev) => [saved, ...prev]);
      setNotice({ type: 'success', text: 'Novedad publicada. El equipo la verá en su próxima visita.' });
    }
  };

  const handleDeleted = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedId(null);
    setNotice({ type: 'success', text: 'Novedad eliminada' });
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await newsAPI.markAllRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((it) => (it.is_read ? it : { ...it, is_read: true, read_count: (it.read_count || 0) + 1, _read_at: now })));
      notifyUnreadChanged(0);
      setNotice({ type: 'success', text: 'Todo marcado como leído' });
      if (onlyUnread) load();
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err, 'No se pudo marcar todo como leído') });
    } finally {
      setMarkingAll(false);
    }
  };

  const openEdit = (item) => {
    setEditing(item);
    setShowForm(true);
  };

  const hasFilters = !!category || !!clientFilter || !!debouncedSearch || onlyUnread;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#17181A] text-[#D7F653] flex items-center justify-center shrink-0">
            <Megaphone size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#17181A]">Novedades</h1>
            <p className="text-sm text-gray-500 mt-0.5">Lo que está pasando con las marcas, para todo el equipo</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll || (!loading && unreadLoaded === 0 && !hasMore)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white/70 text-sm font-medium text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
            title="Marca todas las novedades como leídas"
          >
            {markingAll ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />} Marcar todo como leído
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] transition-colors"
          >
            <Plus size={16} /> Nueva novedad
          </button>
        </div>
      </div>

      {notice && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${notice.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {notice.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />} {notice.text}
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategory('')}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${!category ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]' : 'bg-white/70 text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            Todo
          </button>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(active ? '' : c.id)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${active ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]' : `${c.pill} hover:brightness-95`}`}
              >
                <Icon size={12} /> {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <ClientSelect
            value={clientFilter}
            onChange={setClientFilter}
            clients={clients}
            loading={clientsLoading}
            allowFilters
            className="md:w-64"
          />
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en título, detalle o marca…"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white/80 text-sm text-[#17181A] focus:outline-none focus:border-[#17181A]"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"><X size={13} /></button>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none whitespace-nowrap md:ml-1">
            <button
              type="button"
              role="switch"
              aria-checked={onlyUnread}
              onClick={() => setOnlyUnread((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${onlyUnread ? 'bg-[#17181A]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${onlyUnread ? 'translate-x-4 bg-[#D7F653]' : 'translate-x-0.5 bg-white'}`} />
            </button>
            Solo no leídas
          </label>
        </div>
      </div>

      {/* Feed / historial */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card p-4 flex gap-4 animate-pulse">
              <div className="w-3" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-gray-200/70 rounded" />
                <div className="h-4 w-2/3 bg-gray-200/70 rounded" />
                <div className="h-3 w-full bg-gray-200/70 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="glass-card p-8 text-center">
          <AlertCircle size={28} className="mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700 mb-3">{loadError}</p>
          <button type="button" onClick={load} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Reintentar</button>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#D7F653]/50 text-[#17181A] flex items-center justify-center mx-auto mb-3">
            {onlyUnread && !category && !clientFilter && !debouncedSearch ? <CheckCheck size={26} /> : <Megaphone size={26} />}
          </div>
          {hasFilters ? (
            <>
              <h3 className="font-semibold text-[#17181A]">
                {onlyUnread && !category && !clientFilter && !debouncedSearch ? 'Estás al día' : 'Nada por aquí con esos filtros'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {onlyUnread && !category && !clientFilter && !debouncedSearch
                  ? 'No tienes novedades sin leer. Apaga el filtro para ver el historial.'
                  : 'Prueba con otra marca o categoría, o limpia la búsqueda.'}
              </p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-[#17181A]">Todavía no hay novedades</h3>
              <p className="text-sm text-gray-500 mt-1">¿Pasó algo importante con una marca? Publícalo aquí para que todo el equipo se entere.</p>
              <button
                type="button"
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E]"
              >
                <Plus size={15} /> Publicar la primera
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="flex items-center gap-3 mb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
                  {g.icon ? <g.icon size={12} /> : null} {g.label}
                </h2>
                <span className="text-[11px] text-gray-400">{g.items.length}</span>
                <div className="flex-1 h-px bg-gray-200/80" />
              </div>
              <div className="space-y-3">
                {g.items.map((item) => (
                  <NewsCard
                    key={item.id}
                    item={item}
                    onOpen={(it) => setSelectedId(it.id)}
                    onLightbox={(images, index) => setLightbox({ images, index })}
                    onAck={ackItem}
                  />
                ))}
              </div>
            </section>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white/70 text-sm font-medium text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
              >
                {loadingMore ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {showForm && (
        <NewsFormModal
          initial={editing}
          clients={clients}
          clientsLoading={clientsLoading}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {selected && !showForm && (
        <NewsDetailModal
          item={selected}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          canModerate={canModerate}
          onClose={() => setSelectedId(null)}
          onEdit={openEdit}
          onDeleted={handleDeleted}
          onUpdated={replaceItem}
          onLightbox={(images, index) => setLightbox({ images, index })}
        />
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
        />
      )}
    </div>
  );
};

export default News;
