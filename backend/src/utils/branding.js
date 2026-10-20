/**
 * Marca por organización (branding).
 *
 * Contrato de `organizations.branding` (JSONB):
 *   {
 *     accent:         '#44BF47'        // hex, color de acento
 *     accent_deep:    '#1E7A30'        // derivado: acento oscurecido ~35 % (texto sobre claro)
 *     accent_rgb:     '68 191 71'      // derivado: canales para rgb(var(--accent-rgb)/x)
 *     theme:          'paper' | 'white' | 'dark'
 *     sidebar:        'paper' | 'ink'
 *     radius:         'soft' | 'round'
 *     font:           'inter-tight' | 'inter'
 *     logo_url:       string|null      // logo sobre fondo claro
 *     logo_dark_url:  string|null      // logo sobre fondo oscuro (barra tinta / tema oscuro)
 *     icon_url:       string|null      // icono cuadrado (favicon / manifest)
 *     report_footer:  string           // pie de informes PDF/impresos
 *     portal_welcome: string           // mensaje de bienvenida por defecto del portal
 *   }
 *
 * El default es exactamente el rediseño papel + tinta + verde de LA REAL,
 * así una organización sin branding no cambia de aspecto.
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

export const THEMES = ['paper', 'white', 'dark'];
export const SIDEBARS = ['paper', 'ink'];
export const RADII = ['soft', 'round'];
export const FONTS = ['inter-tight', 'inter'];

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

export function isValidHex(value) {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

export function normalizeHex(value) {
  const m = HEX_RE.exec(String(value || '').trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function rgbToHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Oscurece un color multiplicando sus canales (factor 0.64 ≈ 35 % más oscuro). */
export function darken(hex, factor = 0.64) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHex(rgb.map((c) => c * factor));
}

/** Deriva `accent_deep` y `accent_rgb` a partir del acento. */
export function deriveAccent(accent) {
  const hex = normalizeHex(accent) || DEFAULT_BRANDING.accent;
  if (hex === DEFAULT_BRANDING.accent) {
    return { accent: hex, accent_deep: DEFAULT_BRANDING.accent_deep, accent_rgb: DEFAULT_BRANDING.accent_rgb };
  }
  return { accent: hex, accent_deep: darken(hex), accent_rgb: hexToRgb(hex).join(' ') };
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function cleanText(value, max = 300) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanUrl(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (s.length > 1_500_000) return null;
  if (/^https?:\/\//i.test(s) || /^data:image\/[a-z+.-]+;base64,/i.test(s)) return s;
  return null;
}

/**
 * Normaliza un objeto de branding (de la BD o de un PUT): completa defaults,
 * valida enums y hex, deriva accent_deep / accent_rgb.
 * `raw` puede ser objeto, string JSON o null.
 */
export function normalizeBranding(raw, fallbacks = {}) {
  let src = raw;
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch { src = {}; }
  }
  if (!src || typeof src !== 'object') src = {};

  const accentInfo = deriveAccent(src.accent);
  return {
    ...accentInfo,
    theme: pick(src.theme, THEMES, DEFAULT_BRANDING.theme),
    sidebar: pick(src.sidebar, SIDEBARS, DEFAULT_BRANDING.sidebar),
    radius: pick(src.radius, RADII, DEFAULT_BRANDING.radius),
    font: pick(src.font, FONTS, DEFAULT_BRANDING.font),
    logo_url: cleanUrl(src.logo_url) || cleanUrl(fallbacks.logo_url) || null,
    logo_dark_url: cleanUrl(src.logo_dark_url),
    icon_url: cleanUrl(src.icon_url),
    report_footer: cleanText(src.report_footer),
    portal_welcome: cleanText(src.portal_welcome, 400),
  };
}

/**
 * Valida un PUT parcial. Devuelve { ok, errors, value } donde `value` son solo
 * las claves enviadas (ya limpias) para fusionarlas con lo guardado.
 */
export function validateBrandingPatch(body) {
  const errors = [];
  const value = {};
  if (!body || typeof body !== 'object') return { ok: false, errors: ['Cuerpo inválido'], value };

  if ('accent' in body) {
    if (!isValidHex(body.accent)) errors.push('El acento debe ser un color hex de 6 dígitos (ej. #44BF47).');
    else value.accent = normalizeHex(body.accent);
  }
  if ('theme' in body) {
    if (!THEMES.includes(body.theme)) errors.push(`Tema inválido. Opciones: ${THEMES.join(', ')}.`);
    else value.theme = body.theme;
  }
  if ('sidebar' in body) {
    if (!SIDEBARS.includes(body.sidebar)) errors.push(`Barra lateral inválida. Opciones: ${SIDEBARS.join(', ')}.`);
    else value.sidebar = body.sidebar;
  }
  if ('radius' in body) {
    if (!RADII.includes(body.radius)) errors.push(`Radio inválido. Opciones: ${RADII.join(', ')}.`);
    else value.radius = body.radius;
  }
  if ('font' in body) {
    if (!FONTS.includes(body.font)) errors.push(`Fuente inválida. Opciones: ${FONTS.join(', ')}.`);
    else value.font = body.font;
  }
  for (const key of ['logo_url', 'logo_dark_url', 'icon_url']) {
    if (key in body) {
      if (body[key] === null || body[key] === '') value[key] = null;
      else if (!cleanUrl(body[key])) errors.push(`${key} debe ser una URL https o una imagen base64 (data:image/...).`);
      else value[key] = cleanUrl(body[key]);
    }
  }
  if ('report_footer' in body) value.report_footer = cleanText(body.report_footer);
  if ('portal_welcome' in body) value.portal_welcome = cleanText(body.portal_welcome, 400);

  return { ok: errors.length === 0, errors, value };
}

/** Luminancia relativa (WCAG) de un hex. */
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color de texto recomendado sobre el acento (blanco o tinta). */
export function onAccent(hex) {
  return luminance(hex) > 0.42 ? '#121314' : '#FFFFFF';
}

export default {
  DEFAULT_BRANDING, THEMES, SIDEBARS, RADII, FONTS,
  isValidHex, normalizeHex, hexToRgb, darken, deriveAccent,
  normalizeBranding, validateBrandingPatch, luminance, onAccent,
};
