/**
 * Marca por organización — presets y utilidades de color (espejo de backend/src/utils/branding.js).
 *
 * El default es exactamente el rediseño papel + tinta + verde de LA REAL.
 */

export const DEFAULT_BRANDING = Object.freeze({
  accent: '#44BF47',
  accent_deep: '#1E7A30',
  accent_rgb: '68 191 71',
  theme: 'paper',
  sidebar: 'paper',
  radius: 'soft',
  font: 'inter-tight',
  logo_url: null,
  logo_dark_url: null,
  icon_url: null,
  report_footer: '',
  portal_welcome: '',
});

export const ACCENT_PRESETS = [
  { id: 'verde', label: 'Verde LA REAL', hex: '#44BF47' },
  { id: 'azul', label: 'Azul', hex: '#2563CA' },
  { id: 'indigo', label: 'Índigo', hex: '#4F46E5' },
  { id: 'naranja', label: 'Naranja', hex: '#E8731A' },
  { id: 'rosa', label: 'Rosa', hex: '#D9467C' },
  { id: 'tinta', label: 'Tinta', hex: '#121314' },
  { id: 'ocre', label: 'Ocre', hex: '#C8881F' },
];

export const THEME_OPTIONS = [
  { id: 'paper', label: 'Papel', hint: 'Crema cálido, el de LA REAL' },
  { id: 'white', label: 'Blanco', hint: 'Neutro, superficies blancas' },
  { id: 'dark', label: 'Oscuro', hint: 'Papel oscuro y texto claro' },
];

export const SIDEBAR_OPTIONS = [
  { id: 'paper', label: 'Papel', hint: 'Barra clara con pastilla tinta' },
  { id: 'ink', label: 'Tinta', hint: 'Barra oscura con acento' },
];

export const RADIUS_OPTIONS = [
  { id: 'soft', label: 'Suave', hint: '12 · 16 · 20 px' },
  { id: 'round', label: 'Redondo', hint: '16 · 22 · 28 px' },
];

export const FONT_OPTIONS = [
  { id: 'inter-tight', label: 'Inter Tight', hint: 'La de la landing' },
  { id: 'inter', label: 'Inter', hint: 'Más abierta' },
];

/**
 * Temas de superficie. Cada uno define los neutros completos para que tablas,
 * inputs, modales y gráficas sigan legibles. `white` es el token de Tailwind:
 * texto claro sobre oscuro en todos los temas (los fondos `bg-white` se
 * reescribieron a `--surface`).
 */
export const THEMES = {
  paper: {
    scheme: 'light',
    bg: '#F3F1ED', surface: '#FBFAF8', ink: '#121212', ink2: '#3A3A3A', muted: '#7A7772',
    dark: '#121314', darkHover: '#1C1D1F', onDark: '#F3F1ED', onDarkMuted: '#8E8C88',
    text: '#121212', textMuted: '#7A7772', inputBg: '#FFFFFF', white: '#FBFAF8',
    line: '18 18 18 / 0.09', line2: '18 18 18 / 0.16',
    gray: { 50: '#F6F5F2', 100: '#F0EEE9', 200: '#E8E5DF', 300: '#C9C6C0', 400: '#9A9792', 500: '#7A7772', 600: '#5C5955', 700: '#4A4844', 800: '#3A3A3A', 900: '#121212', 950: '#0B0B0B' },
    sidebar: { bg: '#FBFAF8' },
  },
  white: {
    scheme: 'light',
    bg: '#F5F5F6', surface: '#FFFFFF', ink: '#111111', ink2: '#333333', muted: '#6B6B70',
    dark: '#111214', darkHover: '#1E1F23', onDark: '#FFFFFF', onDarkMuted: '#9A9AA0',
    text: '#111111', textMuted: '#6B6B70', inputBg: '#FFFFFF', white: '#FFFFFF',
    line: '17 17 17 / 0.08', line2: '17 17 17 / 0.15',
    gray: { 50: '#FAFAFA', 100: '#F4F4F5', 200: '#E4E4E7', 300: '#D4D4D8', 400: '#A1A1AA', 500: '#71717A', 600: '#52525B', 700: '#3F3F46', 800: '#27272A', 900: '#18181B', 950: '#09090B' },
    sidebar: { bg: '#FFFFFF' },
  },
  dark: {
    scheme: 'dark',
    bg: '#121314', surface: '#1C1D1F', ink: '#F3F1ED', ink2: '#D8D5CF', muted: '#9A9792',
    // En oscuro la "tinta" de botones/pastillas es un grafito elevado: se distingue de la
    // superficie y mantiene legibles tanto `text-white` como el acento encima.
    dark: '#2C2D31', darkHover: '#38393E', onDark: '#F3F1ED', onDarkMuted: '#9A9792',
    text: '#F3F1ED', textMuted: '#9A9792', inputBg: '#1C1D1F', white: '#F3F1ED',
    line: '243 241 237 / 0.10', line2: '243 241 237 / 0.18',
    gray: { 50: '#222326', 100: '#2A2B2E', 200: '#343539', 300: '#4A4B50', 400: '#76777C', 500: '#9A9792', 600: '#B5B2AD', 700: '#CFCCC6', 800: '#E3E0DA', 900: '#F3F1ED', 950: '#FFFFFF' },
    sidebar: { bg: '#161719' },
  },
};

export const RADII = {
  soft: { md: '12px', lg: '16px', xl: '20px', '2xl': '24px' },
  round: { md: '16px', lg: '22px', xl: '28px', '2xl': '32px' },
};

export const FONTS = {
  'inter-tight': "'Inter Tight', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  inter: "'Inter', 'Inter Tight', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// ─── Color helpers ───
const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

export const isValidHex = (v) => typeof v === 'string' && HEX_RE.test(v.trim());

export function normalizeHex(v) {
  const m = HEX_RE.exec(String(v || '').trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export const rgbChannels = (hex) => (hexToRgb(hex) || [0, 0, 0]).join(' ');

function rgbToHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function darken(hex, factor = 0.64) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb.map((c) => c * factor)) : null;
}

export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos hex (1–21). */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto recomendado sobre el acento. */
export const onAccent = (hex) => (luminance(hex) > 0.42 ? '#121314' : '#FFFFFF');

export function deriveAccent(accent) {
  const hex = normalizeHex(accent) || DEFAULT_BRANDING.accent;
  if (hex === DEFAULT_BRANDING.accent) {
    return { accent: hex, accent_deep: DEFAULT_BRANDING.accent_deep, accent_rgb: DEFAULT_BRANDING.accent_rgb };
  }
  return { accent: hex, accent_deep: darken(hex), accent_rgb: rgbChannels(hex) };
}

const pick = (v, obj, fallback) => (v && Object.prototype.hasOwnProperty.call(obj, v) ? v : fallback);

/** Completa defaults, valida enums/hex y deriva los valores dependientes. */
export function normalizeBranding(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    ...deriveAccent(src.accent),
    theme: pick(src.theme, THEMES, DEFAULT_BRANDING.theme),
    sidebar: ['paper', 'ink'].includes(src.sidebar) ? src.sidebar : DEFAULT_BRANDING.sidebar,
    radius: pick(src.radius, RADII, DEFAULT_BRANDING.radius),
    font: pick(src.font, FONTS, DEFAULT_BRANDING.font),
    logo_url: src.logo_url || null,
    logo_dark_url: src.logo_dark_url || null,
    icon_url: src.icon_url || null,
    report_footer: typeof src.report_footer === 'string' ? src.report_footer : '',
    portal_welcome: typeof src.portal_welcome === 'string' ? src.portal_welcome : '',
  };
}

export const isDefaultBranding = (b) => {
  const n = normalizeBranding(b);
  return ['accent', 'theme', 'sidebar', 'radius', 'font'].every((k) => n[k] === DEFAULT_BRANDING[k])
    && !n.logo_dark_url && !n.icon_url && !n.report_footer && !n.portal_welcome;
};
