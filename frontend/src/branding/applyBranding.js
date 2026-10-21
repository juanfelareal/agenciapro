/**
 * Tokens vivos de marca. Escribe las variables CSS en <html> a partir del
 * `branding` de la organización (ver presets.js para el contrato) y notifica a
 * los componentes que necesitan el valor en JS (gráficas, PDF) vía `subscribeBranding`.
 *
 *   applyBranding(org.branding, { scope: 'app' | 'portal', org })
 *   bootBranding()   → al arrancar: aplica el último branding cacheado (sin flash) o el default
 *   computeVars(b)   → objeto { '--accent': … } reutilizable como style de una vista previa
 */
import {
  DEFAULT_BRANDING, THEMES, RADII, FONTS,
  normalizeBranding, rgbChannels, onAccent, isDefaultBranding,
} from './presets.js';

export const BRANDING_EVENT = 'orbit:branding';
const CACHE_KEYS = { app: 'orbitBranding', portal: 'orbitPortalBranding' };
const DEFAULT_FAVICON = '/orbit-favicon.svg';
const DEFAULT_TOUCH_ICON = '/icons/apple-touch-icon.png';

let current = {
  scope: 'app',
  branding: normalizeBranding(DEFAULT_BRANDING),
  org: null,
  colors: colorsFor(normalizeBranding(DEFAULT_BRANDING)),
};

function colorsFor(b) {
  const t = THEMES[b.theme] || THEMES.paper;
  return {
    accent: b.accent,
    accentDeep: b.accent_deep,
    accentRgb: b.accent_rgb,
    onAccent: onAccent(b.accent),
    bg: t.bg,
    surface: t.surface,
    ink: t.ink,
    dark: t.dark,
    onDark: t.onDark,
    text: t.text,
    textMuted: t.textMuted,
    scheme: t.scheme,
    gray: t.gray,
  };
}

/** Variables CSS para un branding dado (sirve como `style` de una vista previa aislada). */
export function computeVars(raw) {
  const b = normalizeBranding(raw);
  const t = THEMES[b.theme] || THEMES.paper;
  const r = RADII[b.radius] || RADII.soft;
  const vars = {
    '--accent': b.accent,
    '--accent-rgb': b.accent_rgb,
    '--accent-deep': b.accent_deep,
    '--accent-deep-rgb': rgbChannels(b.accent_deep),
    '--on-accent': onAccent(b.accent),
    '--accent-light': b.accent,
    '--accent-dark': b.accent_deep,
    '--lime-400': b.accent,
    '--lime-500': b.accent_deep,
    '--lime-600': b.accent_deep,
    '--success-500': b.accent,
    '--success-600': b.accent_deep,

    '--bg': t.bg,
    '--bg-rgb': rgbChannels(t.bg),
    '--surface': t.surface,
    '--surface-rgb': rgbChannels(t.surface),
    '--card': t.surface,
    '--card-solid': t.inputBg,
    '--input-bg': t.inputBg,
    '--white-rgb': rgbChannels(t.white),
    '--ink': t.ink,
    '--ink-rgb': rgbChannels(t.ink),
    '--ink-2': t.ink2,
    '--muted': t.muted,
    '--dark': t.dark,
    '--dark-rgb': rgbChannels(t.dark),
    '--dark-2': t.darkHover,
    '--dark-hover': t.darkHover,
    '--on-dark': t.onDark,
    '--on-dark-muted': t.onDarkMuted,
    '--text': t.text,
    '--text-primary': t.text,
    '--text-muted': t.textMuted,
    '--text-secondary': t.textMuted,
    '--line': `rgb(${t.line})`,
    '--line-2': `rgb(${t.line2})`,
    '--border': `rgb(${t.line})`,
    '--border-strong': `rgb(${t.line2})`,
    '--background': t.bg,
    '--sidebar-bg': b.sidebar === 'ink' ? (t.scheme === 'dark' ? '#0E0F10' : '#121314') : t.sidebar.bg,

    '--radius-md': r.md,
    '--radius-lg': r.lg,
    '--radius-xl': r.xl,
    '--radius-2xl': r['2xl'],
    '--font-sans': FONTS[b.font] || FONTS['inter-tight'],
  };
  for (const [k, v] of Object.entries(t.gray)) {
    vars[`--gray-${k}-rgb`] = rgbChannels(v);
    vars[`--gray-${k}`] = v;
  }
  // Escala "ink" heredada (ink-900 = texto, ink-50 = fondo sutil)
  const inkScale = { 900: t.gray[900], 800: t.gray[800], 700: t.gray[700], 600: t.gray[600], 500: t.gray[500], 400: t.gray[400], 300: t.gray[300], 200: t.gray[200], 100: t.gray[100], 50: t.gray[50] };
  for (const [k, v] of Object.entries(inkScale)) vars[`--ink-${k}`] = v;
  vars['--cream-50'] = t.surface;
  vars['--cream-100'] = t.gray[50];
  vars['--cream-200'] = t.bg;
  vars['--cream-300'] = t.gray[200];
  return vars;
}

function setLink(rel, href) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
    if (rel === 'icon') link.removeAttribute('type');
  }
}

function writeToDocument(b) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = computeVars(b);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);

  const t = THEMES[b.theme] || THEMES.paper;
  root.dataset.theme = b.theme;
  root.dataset.sidebar = b.sidebar;
  root.dataset.radius = b.radius;
  root.style.colorScheme = t.scheme;
  root.style.backgroundColor = t.bg;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.bg);

  if (b.icon_url) {
    setLink('icon', b.icon_url);
    setLink('apple-touch-icon', b.icon_url);
  } else {
    setLink('icon', DEFAULT_FAVICON);
    setLink('apple-touch-icon', DEFAULT_TOUCH_ICON);
  }
}

function cache(scope, payload) {
  try {
    const key = CACHE_KEYS[scope] || CACHE_KEYS.app;
    if (!payload) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(payload));
  } catch { /* storage bloqueado: sin cache */ }
}

function readCache(scope) {
  try {
    const raw = localStorage.getItem(CACHE_KEYS[scope] || CACHE_KEYS.app);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function notify() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: current }));
}

/**
 * Aplica la marca a toda la app. `branding` null/undefined → default LA REAL.
 * `org` ({ name, logo_url }) se guarda junto a la marca para los informes/portal.
 */
export function applyBranding(branding, { scope = 'app', org = null, persist = true } = {}) {
  const b = normalizeBranding(branding || DEFAULT_BRANDING);
  current = { scope, branding: b, org: org ? { name: org.name || null, logo_url: org.logo_url || b.logo_url || null } : null, colors: colorsFor(b) };
  writeToDocument(b);
  if (persist) cache(scope, branding ? { branding: b, org: current.org } : null);
  notify();
  return current;
}

/** Vuelve al default (p. ej. al cerrar sesión). */
export function resetBranding(scope = 'app') {
  return applyBranding(null, { scope });
}

/**
 * Al arrancar: aplica el último branding cacheado para evitar el flash del
 * default antes de que llegue /auth/me. En rutas públicas (landing, registro)
 * se usa siempre el default.
 */
export function bootBranding(pathname = typeof location !== 'undefined' ? location.pathname : '/') {
  const isPortal = pathname.startsWith('/portal');
  const isPublic = pathname === '/' || pathname.startsWith('/landing') || pathname.startsWith('/register');
  if (isPublic) return applyBranding(null, { scope: 'app', persist: false });
  const scope = isPortal ? 'portal' : 'app';
  const cached = readCache(scope);
  if (cached?.branding && !isDefaultBranding(cached.branding) || cached?.org) {
    return applyBranding(cached.branding, { scope, org: cached.org, persist: false });
  }
  return applyBranding(null, { scope, persist: false });
}

export const getBranding = () => current;

export function subscribeBranding(fn) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => fn(e.detail);
  window.addEventListener(BRANDING_EVENT, handler);
  return () => window.removeEventListener(BRANDING_EVENT, handler);
}

/** Lee un valor hex/rgb ya resuelto desde el DOM (para librerías que no aceptan var()). */
export function cssVar(name, fallback = '') {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Logo adecuado para un contexto: 'light' (fondo claro) · 'dark' (fondo oscuro) · 'sidebar' · 'icon'. */
export function logoFor(context = 'light', state = current) {
  const b = state.branding;
  const orgLogo = state.org?.logo_url || null;
  if (context === 'icon') return b.icon_url || b.logo_url || orgLogo;
  const darkCtx = context === 'dark'
    || (context === 'sidebar' && (b.sidebar === 'ink' || b.theme === 'dark'))
    || (context === 'light' && b.theme === 'dark');
  if (darkCtx) return b.logo_dark_url || b.logo_url || orgLogo;
  return b.logo_url || orgLogo;
}

export default applyBranding;
