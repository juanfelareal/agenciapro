import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Lightbulb, Plus, Search, X, ChevronUp, MessageSquare, ImagePlus, Trash2, Pencil, Loader2,
  ChevronLeft, ChevronRight, Bug, HelpCircle, Sparkles, Wrench, Monitor, Check, AlertCircle, UploadCloud,
} from 'lucide-react';
import { orbitFeedbackAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

/**
 * Mejoras de Orbit — tablero interno donde el equipo registra lo que quiere
 * que Orbit haga mejor: mejoras, errores, ideas y preguntas, con pantallazos,
 * votos y comentarios. Queda claro quién lo puso y cuándo.
 */

// ─── Catálogos ───
const CATEGORIES = [
  { id: 'mejora', label: 'Mejora', icon: Wrench, pill: 'bg-[#D7F653]/60 text-[#3f4a10] border-[#c6e63c]' },
  { id: 'error', label: 'Error', icon: Bug, pill: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'idea', label: 'Idea', icon: Sparkles, pill: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'pregunta', label: 'Pregunta', icon: HelpCircle, pill: 'bg-sky-50 text-sky-700 border-sky-200' },
];
const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const STATUSES = [
  { id: 'nueva', label: 'Nueva', pill: 'bg-white text-gray-700 border-gray-200', dot: 'bg-gray-400' },
  { id: 'en_revision', label: 'En revisión', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  { id: 'en_progreso', label: 'En progreso', pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { id: 'hecha', label: 'Hecha', pill: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  { id: 'descartada', label: 'Descartada', pill: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-300' },
];
const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

const PRIORITIES = [
  { id: 'alta', label: 'Alta', pill: 'bg-red-50 text-red-600 border-red-100' },
  { id: 'media', label: 'Media', pill: 'bg-amber-50 text-amber-600 border-amber-100' },
  { id: 'baja', label: 'Baja', pill: 'bg-gray-50 text-gray-500 border-gray-200' },
];
const PRIORITY_BY_ID = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));

const TABS = [{ id: 'all', label: 'Todas' }, ...STATUSES.map((s) => ({ id: s.id, label: s.id === 'nueva' ? 'Nuevas' : s.id === 'hecha' ? 'Hechas' : s.id === 'descartada' ? 'Descartadas' : s.label }))];

const PAGE_SUGGESTIONS = [
  'Dashboard', 'Clientes', 'CRM', 'Email Marketing', 'UGC', 'Social', 'Documentos', 'Proyectos', 'Plantillas', 'Tareas',
  'Finanzas', 'Facturas', 'Cartera', 'Gastos', 'Comisiones', 'Siigo', 'Métricas', 'Reportes', 'Bloc de Notas',
  'Formularios', 'Anuncios', 'SOPs', 'Briefs', 'Equipo', 'Mi Cuenta', 'Portal de clientes', 'General',
];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

// ─── Fechas en hora Colombia ───
const TZ = 'America/Bogota';
const formatFull = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
};
const formatShort = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d);
};
const timeAgo = (value) => {
  if (!value) return '';
  const d = new Date(value);
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

const initials = (name) => {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const errorMessage = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

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
      orbitFeedbackAPI.upload(file, (pct) => {
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
const ImageAttachZone = ({ uploads, compact = false }) => {
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
        className={`rounded-xl border-2 border-dashed transition-colors ${compact ? 'p-3' : 'p-4'} ${
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
        alt={`Pantallazo ${index + 1}`}
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <div className="absolute bottom-4 text-white/80 text-xs font-medium">{index + 1} / {images.length}</div>
      )}
    </div>
  );
};

// ─── Pills ───
const Pill = ({ className = '', children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${className}`}>
    {children}
  </span>
);

const CategoryPill = ({ id }) => {
  const c = CATEGORY_BY_ID[id] || CATEGORY_BY_ID.mejora;
  const Icon = c.icon;
  return <Pill className={c.pill}><Icon size={11} /> {c.label}</Pill>;
};
const StatusPill = ({ id }) => {
  const s = STATUS_BY_ID[id] || STATUS_BY_ID.nueva;
  return <Pill className={s.pill}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}</Pill>;
};
const PriorityPill = ({ id }) => {
  const p = PRIORITY_BY_ID[id] || PRIORITY_BY_ID.media;
  return <Pill className={p.pill} title="Prioridad">Prioridad {p.label.toLowerCase()}</Pill>;
};

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

const VoteButton = ({ item, onVote, size = 'md' }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onVote(item); }}
    className={`flex flex-col items-center justify-center rounded-xl border transition-colors ${
      size === 'md' ? 'w-12 py-1.5' : 'px-3 py-1.5 flex-row gap-1.5'
    } ${item.has_voted ? 'bg-[#17181A] text-[#D7F653] border-[#17181A]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#17181A] hover:text-[#17181A]'}`}
    title={item.has_voted ? 'Quitar mi +1' : 'Dar +1'}
  >
    <ChevronUp size={size === 'md' ? 18 : 16} strokeWidth={2.5} />
    <span className="text-sm font-bold leading-none">{item.votes}</span>
  </button>
);

// ─── Tarjeta ───
const FeedbackCard = ({ item, onOpen, onVote, onLightbox }) => {
  const thumbs = item.images.slice(0, 4);
  const extra = item.images.length - thumbs.length;
  const closed = ['hecha', 'descartada'].includes(item.status);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item); }}
      className={`glass-card p-4 flex gap-4 cursor-pointer hover:bg-white/80 transition-colors ${closed ? 'opacity-75' : ''}`}
    >
      <VoteButton item={item} onVote={onVote} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <CategoryPill id={item.category} />
          {item.status !== 'nueva' && <StatusPill id={item.status} />}
          {item.priority !== 'media' && <PriorityPill id={item.priority} />}
          {item.page && (
            <Pill className="bg-white/70 text-gray-600 border-gray-200"><Monitor size={11} /> {item.page}</Pill>
          )}
        </div>
        <h3 className={`font-semibold text-[#17181A] leading-snug ${item.status === 'hecha' ? 'line-through decoration-gray-400' : ''}`}>{item.title}</h3>
        {item.body && <p className="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-line">{item.body}</p>}

        {thumbs.length > 0 && (
          <div className="flex gap-2 mt-3">
            {thumbs.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={(e) => { e.stopPropagation(); onLightbox(item.images, i); }}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-[#17181A] transition"
                title="Ver pantallazo"
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
          <span className="inline-flex items-center gap-1" title="Comentarios">
            <MessageSquare size={13} /> {item.comments_count}
          </span>
          {item.resolved_at && item.status === 'hecha' && (
            <span className="inline-flex items-center gap-1 text-green-700" title={formatFull(item.resolved_at)}>
              <Check size={13} /> resuelta {timeAgo(item.resolved_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Modal: nueva / editar sugerencia ───
const FeedbackFormModal = ({ initial, onClose, onSaved }) => {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    title: initial?.title || '',
    body: initial?.body || '',
    category: initial?.category || 'mejora',
    priority: initial?.priority || 'media',
    page: initial?.page || '',
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
    if (!form.title.trim()) { setError('Ponle un título a la sugerencia'); return; }
    if (uploads.busy) { setError('Espera a que terminen de subir los pantallazos'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, title: form.title.trim(), body: form.body.trim() || null, page: form.page.trim() || null, images: uploads.urls };
      const res = isEdit ? await orbitFeedbackAPI.update(initial.id, payload) : await orbitFeedbackAPI.create(payload);
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
            <h2 className="text-lg font-bold text-[#17181A]">{isEdit ? 'Editar sugerencia' : 'Nueva sugerencia'}</h2>
            <p className="text-xs text-gray-500">Cuéntale al equipo qué quieres que Orbit haga mejor.</p>
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
              placeholder="Ej: Poder filtrar tareas por cliente en el tablero"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] focus:outline-none focus:ring-2 focus:ring-[#17181A]/20 focus:border-[#17181A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
            <textarea
              value={form.body}
              onChange={set('body')}
              rows={5}
              placeholder="¿Qué pasa hoy, qué esperabas y por qué importa? Puedes pegar pantallazos aquí con Ctrl/Cmd+V."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] resize-y focus:outline-none focus:ring-2 focus:ring-[#17181A]/20 focus:border-[#17181A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
              <select value={form.category} onChange={set('category')} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] focus:outline-none focus:border-[#17181A]">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prioridad</label>
              <select value={form.priority} onChange={set('priority')} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] focus:outline-none focus:border-[#17181A]">
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Pantalla / módulo</label>
              <input
                value={form.page}
                onChange={set('page')}
                list="orbit-feedback-pages"
                maxLength={120}
                placeholder="Ej: Tareas"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] focus:outline-none focus:border-[#17181A]"
              />
              <datalist id="orbit-feedback-pages">
                {PAGE_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>

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
            {uploads.busy ? 'Subiendo pantallazos…' : isEdit ? 'Guardar cambios' : 'Publicar sugerencia'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Modal: detalle + comentarios ───
const FeedbackDetailModal = ({ item, canModerate, currentUserId, isAdmin, onClose, onVote, onEdit, onDeleted, onUpdated, onLightbox }) => {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const uploads = useImageUploads([]);
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const isAuthor = item.created_by === currentUserId;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await orbitFeedbackAPI.comments(item.id);
      setComments(res.data);
    } catch (err) {
      setError(errorMessage(err, 'No se pudieron cargar los comentarios'));
    } finally {
      setLoadingComments(false);
    }
  }, [item.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const changeStatus = async (status) => {
    if (status === item.status) return;
    setChangingStatus(true);
    setError(null);
    try {
      const res = await orbitFeedbackAPI.update(item.id, { status });
      onUpdated(res.data);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cambiar el estado'));
    } finally {
      setChangingStatus(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('¿Eliminar esta sugerencia? Se borran también sus comentarios y votos.')) return;
    setDeleting(true);
    try {
      await orbitFeedbackAPI.delete(item.id);
      onDeleted(item.id);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo eliminar'));
      setDeleting(false);
    }
  };

  const sendComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim() && !uploads.urls.length) return;
    if (uploads.busy) { setError('Espera a que terminen de subir los pantallazos'); return; }
    setSending(true);
    setError(null);
    try {
      const res = await orbitFeedbackAPI.addComment(item.id, { body: commentBody.trim(), images: uploads.urls });
      setComments((prev) => [...prev, res.data]);
      setCommentBody('');
      uploads.items.forEach((it) => uploads.remove(it.key));
      onUpdated({ ...item, comments_count: (item.comments_count || 0) + 1 });
    } catch (err) {
      setError(errorMessage(err, 'No se pudo enviar el comentario'));
    } finally {
      setSending(false);
    }
  };

  const deleteComment = async (c) => {
    if (!window.confirm('¿Eliminar este comentario?')) return;
    try {
      await orbitFeedbackAPI.deleteComment(c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      onUpdated({ ...item, comments_count: Math.max(0, (item.comments_count || 1) - 1) });
    } catch (err) {
      setError(errorMessage(err, 'No se pudo eliminar el comentario'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-solid rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl z-10">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <CategoryPill id={item.category} />
              <StatusPill id={item.status} />
              <PriorityPill id={item.priority} />
              {item.page && <Pill className="bg-white/70 text-gray-600 border-gray-200"><Monitor size={11} /> {item.page}</Pill>}
            </div>
            <h2 className="text-lg font-bold text-[#17181A] leading-snug">{item.title}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(isAuthor || isAdmin) && (
              <button type="button" onClick={() => onEdit(item)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Editar"><Pencil size={16} /></button>
            )}
            {(isAuthor || isAdmin) && (
              <button type="button" onClick={remove} disabled={deleting} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 disabled:opacity-50" title="Eliminar">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Cerrar"><X size={18} /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta + votos + estado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Avatar name={item.created_by_name} size="md" />
              <div className="leading-tight">
                <div className="font-semibold text-[#17181A]">{item.created_by_name || 'Sin autor'}</div>
                <div className="text-xs text-gray-500" title={formatFull(item.created_at)}>
                  {formatFull(item.created_at)} · {timeAgo(item.created_at)}
                  {item.updated_at && item.updated_at !== item.created_at && <span> · editada {timeAgo(item.updated_at)}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VoteButton item={item} onVote={onVote} size="sm" />
              {canModerate ? (
                <div className="relative">
                  <select
                    value={item.status}
                    disabled={changingStatus}
                    onChange={(e) => changeStatus(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-[#17181A] focus:outline-none focus:border-[#17181A] disabled:opacity-60"
                    title="Cambiar estado (admin / manager)"
                  >
                    {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  {changingStatus
                    ? <Loader2 size={14} className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    : <ChevronUp size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-180 text-gray-500 pointer-events-none" />}
                </div>
              ) : null}
            </div>
          </div>

          {/* Cuerpo */}
          {item.body ? (
            <p className="text-[15px] text-[#17181A] whitespace-pre-wrap leading-relaxed">{item.body}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Sin descripción.</p>
          )}

          {item.resolved_at && item.status === 'hecha' && (
            <div className="px-3 py-2 rounded-xl bg-green-50 text-green-700 text-sm flex items-center gap-2">
              <Check size={15} /> Marcada como hecha el {formatFull(item.resolved_at)}
            </div>
          )}

          {/* Pantallazos */}
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
                  <img src={url} alt={`Pantallazo ${i + 1}`} className="w-full max-h-72 object-contain bg-white" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertCircle size={15} /> {error}</div>
          )}

          {/* Comentarios */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-bold text-[#17181A] mb-3 flex items-center gap-2">
              <MessageSquare size={15} /> Comentarios
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{comments.length}</span>
            </h3>

            {loadingComments ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-3"><Loader2 size={15} className="animate-spin" /> Cargando comentarios…</div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">Nadie ha comentado todavía. Sé la primera persona.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-3 group">
                    <Avatar name={c.created_by_name} size="md" />
                    <div className="flex-1 min-w-0 bg-white/70 border border-gray-100 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-xs text-gray-500">
                          <span className="font-semibold text-[#17181A]">{c.created_by_name || 'Sin autor'}</span>
                          <span className="mx-1.5">·</span>
                          <span title={formatFull(c.created_at)}>{timeAgo(c.created_at)}</span>
                        </div>
                        {(c.created_by === currentUserId || isAdmin) && (
                          <button type="button" onClick={() => deleteComment(c)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition" title="Eliminar comentario">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {c.body && <p className="text-sm text-[#17181A] whitespace-pre-wrap">{c.body}</p>}
                      {c.images?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {c.images.map((url, i) => (
                            <button key={url + i} type="button" onClick={() => onLightbox(c.images, i)} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-[#17181A] transition">
                              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Nuevo comentario */}
            <form onSubmit={sendComment} onPaste={uploads.handlePaste} className="mt-4 space-y-2">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={3}
                placeholder="Escribe un comentario… (puedes pegar pantallazos con Ctrl/Cmd+V)"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#17181A] resize-y focus:outline-none focus:ring-2 focus:ring-[#17181A]/20 focus:border-[#17181A]"
              />
              <ImageAttachZone uploads={uploads} compact />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sending || uploads.busy || (!commentBody.trim() && !uploads.urls.length)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
                  Comentar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Página ───
const OrbitFeedback = () => {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const isAdmin = user?.role === 'admin';
  const canModerate = ['admin', 'manager'].includes(user?.role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [statusTab, setStatusTab] = useState('all');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mine, setMine] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images, index }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = {};
      if (category) params.category = category;
      if (debouncedSearch) params.search = debouncedSearch;
      if (mine) params.mine = 1;
      const res = await orbitFeedbackAPI.list(params);
      setItems(res.data);
    } catch (err) {
      setLoadError(errorMessage(err, 'No se pudieron cargar las mejoras'));
    } finally {
      setLoading(false);
    }
  }, [category, debouncedSearch, mine]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // Conteos por estado (sobre el conjunto filtrado por categoría/búsqueda/mías)
  const counts = useMemo(() => {
    const c = { all: items.length };
    for (const s of STATUSES) c[s.id] = 0;
    for (const it of items) c[it.status] = (c[it.status] || 0) + 1;
    return c;
  }, [items]);

  const visible = useMemo(() => (statusTab === 'all' ? items : items.filter((it) => it.status === statusTab)), [items, statusTab]);
  const selected = useMemo(() => items.find((it) => it.id === selectedId) || null, [items, selectedId]);

  const replaceItem = (updated) => setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)));

  const handleVote = async (item) => {
    // Optimista
    replaceItem({ id: item.id, has_voted: !item.has_voted, votes: item.votes + (item.has_voted ? -1 : 1) });
    try {
      const res = await orbitFeedbackAPI.vote(item.id);
      replaceItem({ id: item.id, has_voted: res.data.has_voted, votes: res.data.votes });
    } catch (err) {
      replaceItem({ id: item.id, has_voted: item.has_voted, votes: item.votes });
      setNotice({ type: 'error', text: errorMessage(err, 'No se pudo registrar el voto') });
    }
  };

  const handleSaved = (saved, wasEdit) => {
    setShowForm(false);
    setEditing(null);
    if (wasEdit) {
      replaceItem(saved);
      setNotice({ type: 'success', text: 'Sugerencia actualizada' });
    } else {
      setItems((prev) => [saved, ...prev]);
      setStatusTab((t) => (t === 'all' || t === 'nueva' ? t : 'all'));
      setNotice({ type: 'success', text: 'Sugerencia publicada. Gracias por mejorar Orbit.' });
    }
  };

  const handleDeleted = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedId(null);
    setNotice({ type: 'success', text: 'Sugerencia eliminada' });
  };

  const openEdit = (item) => {
    setEditing(item);
    setShowForm(true);
  };

  const hasFilters = !!category || !!debouncedSearch || mine || statusTab !== 'all';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#17181A] text-[#D7F653] flex items-center justify-center shrink-0">
            <Lightbulb size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#17181A]">Mejoras de Orbit</h1>
            <p className="text-sm text-gray-500 mt-0.5">Lo que el equipo quiere que Orbit haga mejor</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E] transition-colors"
        >
          <Plus size={16} /> Nueva sugerencia
        </button>
      </div>

      {notice && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${notice.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {notice.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />} {notice.text}
        </div>
      )}

      {/* Pestañas por estado */}
      <div className="flex items-center gap-1 mb-3 bg-white/50 border border-white/80 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => {
          const active = statusTab === t.id;
          const count = counts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${active ? 'bg-[#17181A] text-white shadow-sm' : 'text-gray-600 hover:bg-white/80'}`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filtros: categoría, búsqueda, solo mías */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
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
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <div className="relative flex-1 min-w-[160px] md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white/80 text-sm text-[#17181A] focus:outline-none focus:border-[#17181A]"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"><X size={13} /></button>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none whitespace-nowrap">
            <button
              type="button"
              role="switch"
              aria-checked={mine}
              onClick={() => setMine((m) => !m)}
              className={`relative w-9 h-5 rounded-full transition-colors ${mine ? 'bg-[#17181A]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${mine ? 'translate-x-4 bg-[#D7F653]' : 'translate-x-0.5 bg-white'}`} />
            </button>
            Solo las mías
          </label>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card p-4 flex gap-4 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-gray-200/70" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-gray-200/70 rounded" />
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
      ) : visible.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#D7F653]/50 text-[#17181A] flex items-center justify-center mx-auto mb-3">
            <Lightbulb size={26} />
          </div>
          {hasFilters ? (
            <>
              <h3 className="font-semibold text-[#17181A]">Nada por aquí con esos filtros</h3>
              <p className="text-sm text-gray-500 mt-1">Prueba con otro estado o categoría, o limpia la búsqueda.</p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-[#17181A]">Todavía no hay sugerencias</h3>
              <p className="text-sm text-gray-500 mt-1">¿Algo de Orbit te estorba o se te ocurre una idea? Este es el lugar.</p>
              <button
                type="button"
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17181A] text-[#D7F653] text-sm font-medium hover:bg-[#2D2D4E]"
              >
                <Plus size={15} /> Registrar la primera
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              onOpen={(it) => setSelectedId(it.id)}
              onVote={handleVote}
              onLightbox={(images, index) => setLightbox({ images, index })}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {showForm && (
        <FeedbackFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {selected && !showForm && (
        <FeedbackDetailModal
          item={selected}
          canModerate={canModerate}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onClose={() => setSelectedId(null)}
          onVote={handleVote}
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

export default OrbitFeedback;
