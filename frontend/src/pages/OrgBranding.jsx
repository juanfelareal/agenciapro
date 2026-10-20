import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Trash2, Check, RotateCcw, AlertTriangle, Loader2, Save,
  LayoutDashboard, Users, BarChart3, FolderKanban, Bell, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { orgBrandingAPI } from '../utils/api';
import { computeVars } from '../branding/applyBranding';
import {
  ACCENT_PRESETS, THEME_OPTIONS, SIDEBAR_OPTIONS, RADIUS_OPTIONS, FONT_OPTIONS, THEMES,
  normalizeBranding, isValidHex, normalizeHex, contrastRatio, onAccent, deriveAccent, isDefaultBranding,
} from '../branding/presets';
import OrbitLogo from '../components/OrbitLogo';

/**
 * /app/configuracion/marca — personalización de Orbit con la marca de la agencia.
 * Izquierda: controles. Derecha: vista previa en vivo (mismas variables CSS que la app).
 * Los logos se suben al instante; el resto se aplica a toda la app al Guardar.
 */

const EDITABLE = ['accent', 'theme', 'sidebar', 'radius', 'font', 'report_footer', 'portal_welcome'];
const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

// Variables de la barra "tinta" para la vista previa (espejo de index.css [data-sidebar="ink"])
const INK_SIDEBAR_VARS = {
  '--surface': '#121314', '--surface-rgb': '18 19 20', '--ink': '#F3F1ED', '--ink-rgb': '243 241 237',
  '--dark': '#2C2D31', '--dark-rgb': '44 45 49', '--gray-500': '#A8A6A1', '--gray-500-rgb': '168 166 161',
  '--gray-400': '#8E8C88', '--gray-400-rgb': '142 140 136', '--line': 'rgb(243 241 237 / 0.10)',
  '--gray-50': '#1E1F22', '--gray-50-rgb': '30 31 34', '--gray-100': '#26272A', '--gray-100-rgb': '38 39 42',
};

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function Section({ title, hint, children }) {
  return (
    <section className="glass-card p-5">
      <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
      {hint && <p className="text-xs text-gray-500 mt-0.5 mb-4">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

function OptionCards({ options, value, onChange, render }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`text-left rounded-xl border p-3 transition-all ${
              active
                ? 'border-[var(--accent)] ring-2 ring-[rgb(var(--accent-rgb)/0.25)] bg-[var(--surface)]'
                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[rgb(var(--ink-rgb)/0.25)]'
            }`}
          >
            {render ? render(opt, active) : null}
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-medium text-[var(--ink)]">{opt.label}</span>
              {active && <Check size={14} className="text-[var(--accent-deep)]" />}
            </div>
            {opt.hint && <p className="text-[11px] text-gray-500 mt-0.5">{opt.hint}</p>}
          </button>
        );
      })}
    </div>
  );
}

function LogoDrop({ kind, label, hint, value, dark, busy, onFile, onRemove }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onFile(kind, file);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {value && !busy && (
          <button type="button" onClick={() => onRemove(kind)} className="text-[11px] text-gray-500 hover:text-red-600 inline-flex items-center gap-1">
            <Trash2 size={12} /> Quitar
          </button>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
        className={`relative h-24 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors overflow-hidden ${
          over ? 'border-[var(--accent)] bg-[rgb(var(--accent-rgb)/0.08)]' : 'border-[var(--line-2)] hover:border-[rgb(var(--ink-rgb)/0.3)]'
        } ${dark ? 'bg-[#121314]' : 'bg-[var(--input-bg)]'}`}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin text-gray-400" />
        ) : value ? (
          <img src={value} alt={label} className={`object-contain ${kind === 'icon' ? 'h-14 w-14' : 'h-14 max-w-[85%]'}`} />
        ) : (
          <div className={`flex flex-col items-center gap-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            <Upload size={16} />
            <span className="text-[11px]">Arrastra o haz clic</span>
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// ─── Vista previa ───
function Preview({ draft, orgName }) {
  const vars = useMemo(() => computeVars(draft), [draft]);
  const theme = THEMES[draft.theme] || THEMES.paper;
  const sidebarInk = draft.sidebar === 'ink';
  const sidebarVars = sidebarInk
    ? { ...INK_SIDEBAR_VARS, ...(theme.scheme === 'dark' ? { '--surface': '#0E0F10', '--surface-rgb': '14 15 16' } : {}) }
    : {};
  const logo = (sidebarInk || theme.scheme === 'dark') ? (draft.logo_dark_url || draft.logo_url) : draft.logo_url;
  const lightLogo = theme.scheme === 'dark' ? (draft.logo_dark_url || draft.logo_url) : draft.logo_url;
  const nav = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Users, label: 'Clientes' },
    { icon: FolderKanban, label: 'Proyectos' },
    { icon: BarChart3, label: 'Métricas' },
  ];
  const rows = [
    ['Cacao Hunters', 'Activo', '$ 4.200.000'],
    ['Onside', 'Activo', '$ 2.800.000'],
    ['Natnack', 'Pausado', '$ 1.150.000'],
  ];

  return (
    <div
      style={{ ...vars, colorScheme: theme.scheme }}
      className="rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--bg)] text-[var(--text)] font-sans select-none"
    >
      {/* App */}
      <div className="flex h-[300px]">
        <aside style={sidebarVars} className="w-[132px] shrink-0 bg-[var(--surface)] border-r border-[var(--line)] p-2.5 flex flex-col gap-1">
          <div className="h-8 flex items-center px-1 mb-1.5">
            {logo ? <img src={logo} alt="" className="h-6 max-w-full object-contain object-left" /> : <OrbitLogo size={20} showText />}
          </div>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl text-[11px] font-medium ${item.active ? 'bg-[var(--dark)] text-[var(--accent)]' : 'text-gray-500'}`}>
                <Icon size={12} />{item.label}
              </div>
            );
          })}
          <div className="mt-auto flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-lg bg-[var(--dark)] text-[var(--accent)] text-[10px] font-semibold flex items-center justify-center">JF</div>
            <span className="text-[10px] text-[var(--ink)] truncate">Juan Felipe</span>
          </div>
        </aside>
        <main className="flex-1 p-3.5 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Resumen</p>
              <h3 className="text-sm font-semibold text-[var(--ink)] tracking-tight">Dashboard</h3>
            </div>
            <div className="flex gap-1.5">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink)]">Exportar</span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[var(--dark)] text-[var(--on-dark)]">Nuevo cliente</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2.5">
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--line)] p-2.5">
              <p className="text-[9px] text-gray-500">Ingresos del mes</p>
              <p className="text-base font-semibold text-[var(--ink)] tracking-tight">$ 18,4M</p>
              <p className="text-[9px] font-medium text-[var(--accent-deep)]">▲ 12 % vs mes anterior</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--line)] p-2.5">
              <p className="text-[9px] text-gray-500">Tareas al día</p>
              <p className="text-base font-semibold text-[var(--ink)] tracking-tight">94 %</p>
              <div className="h-1 rounded-full bg-gray-200 mt-1.5 overflow-hidden"><div className="h-full w-[94%] bg-[var(--accent)]" /></div>
            </div>
            <div className="rounded-2xl bg-[var(--dark)] text-[var(--on-dark)] p-2.5">
              <p className="text-[9px] opacity-70">Cartera</p>
              <p className="text-base font-semibold tracking-tight text-[var(--accent)]">$ 6,1M</p>
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold bg-[var(--accent)] text-[var(--on-accent)]">3 por cobrar</span>
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden text-[10px]">
            <div className="grid grid-cols-3 px-2.5 py-1.5 bg-gray-50 text-gray-500 font-medium border-b border-[var(--line)]"><span>Cliente</span><span>Estado</span><span className="text-right">Contrato</span></div>
            {rows.map(([n, st, v]) => (
              <div key={n} className="grid grid-cols-3 px-2.5 py-1.5 border-b border-[var(--line)] last:border-0">
                <span className="text-[var(--ink)] font-medium">{n}</span>
                <span><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${st === 'Activo' ? 'bg-[rgb(var(--accent-rgb)/0.14)] text-[var(--accent-deep)]' : 'bg-gray-100 text-gray-600'}`}>{st}</span></span>
                <span className="text-right text-[var(--ink)] tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Portal del cliente */}
      <div className="border-t border-[var(--line)]">
        <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-gray-500 bg-[var(--surface)]">Portal del cliente</div>
        <div className="p-3">
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--line)]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-[var(--ink)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[var(--ink)] leading-tight">Cacao Hunters</p>
                  <p className="text-[9px] text-gray-500 truncate">Portal de cliente de {orgName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-[var(--ink)] text-[var(--surface)] text-[9px] font-medium">Dashboard</span>
                <span className="text-[9px] text-gray-600">Proyectos</span>
                <span className="text-[9px] text-gray-600">Reportes</span>
                {lightLogo && <img src={lightLogo} alt="" className="h-4 max-w-[48px] object-contain" />}
                <Bell size={11} className="text-gray-500" />
              </div>
            </div>
            <div className="p-3 grid grid-cols-[1.4fr_1fr] gap-2">
              <div className="rounded-xl bg-[var(--dark)] text-[var(--on-dark)] p-2.5">
                <p className="text-[9px] opacity-70">Bienvenido</p>
                <p className="text-[10px] leading-snug mt-0.5">{draft.portal_welcome || 'Aquí podrás consultar siempre el estado de tus proyectos y tareas.'}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-2.5">
                <div className="flex items-center gap-1 text-[9px] text-gray-500"><Wallet size={10} /> ROAS del mes</div>
                <p className="text-sm font-semibold text-[var(--accent-deep)] tracking-tight">4,8x</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página ───
export default function OrgBranding() {
  const { isAdmin, currentOrg, updateOrgBranding } = useAuth();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState(null);
  const [hexInput, setHexInput] = useState('');

  useEffect(() => {
    let alive = true;
    orgBrandingAPI.get()
      .then((res) => {
        if (!alive) return;
        const b = normalizeBranding(res.data.branding);
        setSaved(b); setDraft(b); setHexInput(b.accent);
      })
      .catch((err) => setMessage({ type: 'error', text: err.response?.data?.error || 'No se pudo cargar la marca' }))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!message || message.type === 'error') return undefined;
    const t = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const dirty = useMemo(() => !!draft && !!saved && EDITABLE.some((k) => draft[k] !== saved[k]), [draft, saved]);
  const patch = (changes) => setDraft((d) => normalizeBranding({ ...d, ...changes }));
  const setAccent = (hex) => { const h = normalizeHex(hex); if (h) { patch({ accent: h }); setHexInput(h); } };

  const contrastWhite = draft ? contrastRatio(draft.accent, '#FFFFFF') : 0;
  const contrastSurface = draft ? contrastRatio(draft.accent, (THEMES[draft.theme] || THEMES.paper).surface) : 0;
  const deepContrast = draft ? contrastRatio(deriveAccent(draft.accent).accent_deep, (THEMES[draft.theme] || THEMES.paper).surface) : 0;
  const lightAccent = draft ? onAccent(draft.accent) !== '#FFFFFF' : false;

  const applySaved = (b) => {
    const n = normalizeBranding(b);
    setSaved(n); setDraft(n); setHexInput(n.accent);
    updateOrgBranding(n); // aplica a toda la app en vivo (AuthContext → applyBranding)
  };

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true); setMessage(null);
    try {
      const body = {};
      for (const k of EDITABLE) if (draft[k] !== saved[k]) body[k] = draft[k];
      const res = await orgBrandingAPI.update(body);
      applySaved(res.data.branding);
      setMessage({ type: 'success', text: 'Marca guardada. Ya se ve en toda la app.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al guardar la marca' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('¿Volver a la marca de LA REAL (verde, papel, barra clara)? Los logos se conservan.')) return;
    setSaving(true); setMessage(null);
    try {
      const res = await orgBrandingAPI.reset();
      applySaved(res.data.branding);
      setMessage({ type: 'success', text: 'Marca restablecida a LA REAL.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al restablecer' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (kind, file) => {
    if (!file.type.startsWith('image/')) return setMessage({ type: 'error', text: 'Solo se permiten imágenes' });
    if (file.size > MAX_LOGO_BYTES) return setMessage({ type: 'error', text: 'La imagen no puede superar 1.5 MB' });
    setBusy((b) => ({ ...b, [kind]: true })); setMessage(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await orgBrandingAPI.uploadLogo(kind, dataUrl);
      // Los logos se guardan al instante; conservamos el resto del borrador
      const b = normalizeBranding(res.data.branding);
      setSaved(b);
      setDraft((d) => normalizeBranding({ ...d, logo_url: b.logo_url, logo_dark_url: b.logo_dark_url, icon_url: b.icon_url }));
      updateOrgBranding({ ...b, ...Object.fromEntries(EDITABLE.map((k) => [k, saved?.[k] ?? b[k]])) });
      setMessage({ type: 'success', text: 'Imagen actualizada' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al subir la imagen' });
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }));
    }
  };

  const handleLogoRemove = async (kind) => {
    setBusy((b) => ({ ...b, [kind]: true })); setMessage(null);
    try {
      const res = await orgBrandingAPI.removeLogo(kind);
      const b = normalizeBranding(res.data.branding);
      setSaved(b);
      setDraft((d) => normalizeBranding({ ...d, logo_url: b.logo_url, logo_dark_url: b.logo_dark_url, icon_url: b.icon_url }));
      updateOrgBranding({ ...b, ...Object.fromEntries(EDITABLE.map((k) => [k, saved?.[k] ?? b[k]])) });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al quitar la imagen' });
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }));
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <AlertTriangle className="mx-auto text-amber-500 mb-3" />
        <p className="text-sm text-gray-600">Solo los administradores pueden personalizar la marca.</p>
        <Link to="/app/settings" className="inline-block mt-4 text-sm text-[var(--accent-deep)] hover:underline">Volver a configuración</Link>
      </div>
    );
  }

  if (loading || !draft) {
    return <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <Link to="/app/settings" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[var(--ink)] mb-2"><ArrowLeft size={14} /> Configuración</Link>
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Marca de {currentOrg?.name || 'la agencia'}</h1>
          <p className="text-sm text-gray-500 mt-1">Logo, color de acento, tema y estilo. Se ve en la app, el portal de tus clientes, los informes y los correos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleReset} disabled={saving || (isDefaultBranding(saved) && !dirty)} className="btn-secondary text-sm disabled:opacity-50">
            <RotateCcw size={14} /> Restablecer a LA REAL
          </button>
          <button type="button" onClick={handleSave} disabled={!dirty || saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${message.type === 'success' ? 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent-deep)]' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 items-start">
        {/* Controles */}
        <div className="space-y-4">
          <Section title="Logos" hint="PNG o SVG con fondo transparente. Se suben al instante.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <LogoDrop kind="logo" label="Logo (fondo claro)" hint="Barra lateral, portal, informes" value={draft.logo_url} busy={busy.logo} onFile={handleLogoFile} onRemove={handleLogoRemove} />
              <LogoDrop kind="logo_dark" label="Logo (fondo oscuro)" hint="Barra tinta y tema oscuro" value={draft.logo_dark_url} dark busy={busy.logo_dark} onFile={handleLogoFile} onRemove={handleLogoRemove} />
              <LogoDrop kind="icon" label="Icono" hint="Favicon y pantalla de inicio (cuadrado)" value={draft.icon_url} busy={busy.icon} onFile={handleLogoFile} onRemove={handleLogoRemove} />
            </div>
          </Section>

          <Section title="Color de acento" hint="Botones, gráficas, estados activos y detalles.">
            <div className="flex flex-wrap gap-2 mb-3">
              {ACCENT_PRESETS.map((p) => {
                const active = draft.accent === p.hex;
                return (
                  <button key={p.id} type="button" title={p.label} onClick={() => setAccent(p.hex)}
                    className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-105 ${active ? 'border-[var(--ink)] scale-105' : 'border-transparent'}`}
                    style={{ background: p.hex, boxShadow: '0 0 0 1px var(--line-2)' }}
                    aria-label={p.label}
                  >
                    {active && <Check size={14} className="mx-auto" style={{ color: onAccent(p.hex) }} />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[var(--line-2)] bg-transparent cursor-pointer p-0.5"
                aria-label="Elegir color"
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => { setHexInput(e.target.value); if (isValidHex(e.target.value)) setAccent(e.target.value); }}
                onBlur={() => setHexInput(draft.accent)}
                placeholder="#44BF47"
                className={`input w-32 font-mono text-sm ${hexInput && !isValidHex(hexInput) ? 'border-red-400' : ''}`}
                maxLength={7}
              />
              <div className="text-xs text-gray-500 leading-tight">
                Profundo: <span className="font-mono text-[var(--ink)]">{draft.accent_deep}</span>
                <span className="block">para texto sobre fondo claro</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-[var(--line)] p-2.5 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg text-[10px] font-semibold" style={{ background: draft.accent, color: '#FFFFFF' }}>Aa</span>
                <div>
                  <p className="font-medium text-[var(--ink)]">Texto blanco sobre el acento · {contrastWhite.toFixed(1)}:1</p>
                  <p className="text-gray-500">{contrastWhite >= 4.5 ? 'Excelente' : contrastWhite >= 3 ? 'Aceptable para botones' : 'Bajo'}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-2.5 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg text-[10px] font-semibold bg-[var(--surface)] border border-[var(--line)]" style={{ color: deriveAccent(draft.accent).accent_deep }}>Aa</span>
                <div>
                  <p className="font-medium text-[var(--ink)]">Acento profundo sobre papel · {deepContrast.toFixed(1)}:1</p>
                  <p className="text-gray-500">Acento puro sobre papel: {contrastSurface.toFixed(1)}:1</p>
                </div>
              </div>
            </div>
            {lightAccent && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 text-amber-800 px-3 py-2 text-xs">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>Este acento es claro: el texto blanco encima se lee mal. Orbit usará texto tinta en los botones y etiquetas de acento, pero considera un tono más oscuro.</span>
              </div>
            )}
          </Section>

          <Section title="Tema de superficie" hint="Fondo, tarjetas y neutros de toda la app.">
            <OptionCards
              options={THEME_OPTIONS}
              value={draft.theme}
              onChange={(theme) => patch({ theme })}
              render={(opt) => {
                const t = THEMES[opt.id];
                return (
                  <div className="h-10 rounded-lg overflow-hidden border border-[var(--line)] flex" style={{ background: t.bg }}>
                    <div className="w-1/3 h-full" style={{ background: t.surface }} />
                    <div className="flex-1 flex items-center px-2 gap-1">
                      <span className="h-2 w-8 rounded-full" style={{ background: t.ink }} />
                      <span className="h-2 w-3 rounded-full" style={{ background: draft.accent }} />
                    </div>
                  </div>
                );
              }}
            />
          </Section>

          <Section title="Barra lateral">
            <OptionCards
              options={SIDEBAR_OPTIONS}
              value={draft.sidebar}
              onChange={(sidebar) => patch({ sidebar })}
              render={(opt) => (
                <div className="h-10 rounded-lg overflow-hidden border border-[var(--line)] flex" style={{ background: (THEMES[draft.theme] || THEMES.paper).bg }}>
                  <div className="w-1/3 h-full p-1.5 space-y-1" style={{ background: opt.id === 'ink' ? '#121314' : (THEMES[draft.theme] || THEMES.paper).surface }}>
                    <span className="block h-1.5 w-4/5 rounded-full" style={{ background: opt.id === 'ink' ? '#2C2D31' : '#121314' }} />
                    <span className="block h-1.5 w-3/5 rounded-full opacity-40" style={{ background: opt.id === 'ink' ? '#F3F1ED' : '#121314' }} />
                  </div>
                </div>
              )}
            />
          </Section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Radios">
              <OptionCards
                options={RADIUS_OPTIONS}
                value={draft.radius}
                onChange={(radius) => patch({ radius })}
                render={(opt) => (
                  <div className="h-10 flex items-center gap-2">
                    <span className="h-8 w-12 border-2 border-[var(--ink)]" style={{ borderRadius: opt.id === 'round' ? 16 : 10 }} />
                    <span className="h-6 w-16 bg-[var(--dark)]" style={{ borderRadius: 999 }} />
                  </div>
                )}
              />
            </Section>
            <Section title="Tipografía">
              <OptionCards
                options={FONT_OPTIONS}
                value={draft.font}
                onChange={(font) => patch({ font })}
                render={(opt) => (
                  <p className="h-10 text-xl font-semibold tracking-tight text-[var(--ink)] leading-10" style={{ fontFamily: opt.id === 'inter' ? "'Inter', sans-serif" : "'Inter Tight', sans-serif" }}>Orbit Ag 12</p>
                )}
              />
            </Section>
          </div>

          <Section title="Textos" hint="Pie de los informes y bienvenida por defecto del portal.">
            <label className="block text-xs font-medium text-gray-600 mb-1">Pie de informes (PDF, Excel, impresos)</label>
            <input
              type="text"
              value={draft.report_footer}
              onChange={(e) => patch({ report_footer: e.target.value })}
              placeholder="Ej. www.tuagencia.com · hola@tuagencia.com"
              maxLength={300}
              className="input mb-3"
            />
            <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje de bienvenida del portal</label>
            <textarea
              value={draft.portal_welcome}
              onChange={(e) => patch({ portal_welcome: e.target.value })}
              placeholder="Aquí podrás consultar siempre el estado de tus proyectos y tareas."
              maxLength={400}
              rows={2}
              className="input resize-none"
            />
            <p className="text-[11px] text-gray-500 mt-1">Cada cliente puede tener su propio mensaje; este es el que se usa cuando no lo tiene.</p>
          </Section>
        </div>

        {/* Vista previa */}
        <div className="lg:sticky lg:top-20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vista previa en vivo</p>
            {dirty && <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Sin guardar</span>}
          </div>
          <Preview draft={draft} orgName={currentOrg?.name || 'tu agencia'} />
          <p className="text-[11px] text-gray-500 mt-2">Al guardar, la marca se aplica en vivo a toda la app, al portal de tus clientes, a los informes y a los correos.</p>
        </div>
      </div>
    </div>
  );
}
