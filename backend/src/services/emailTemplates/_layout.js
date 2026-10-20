// Layout base "papel + tinta" para todos los correos de Orbit.
// Tablas + estilos inline (compatibilidad Gmail/Outlook), responsive por ancho fluido.
// Sin recursos externos salvo el logo de la agencia (solo si es una URL http/https).

export const PAPER = '#F3F1ED';
export const CARD = '#FBFAF8';
export const INK = '#121212';
export const INK_SOFT = '#5C5A55';
export const INK_MUTE = '#8B8884';
export const RULE = '#E6E2DB';
export const DEFAULT_ACCENT = '#44BF47';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isSafeColor = (c) => typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());

/** Normaliza la marca de la organización que llega a cada plantilla. */
export const normalizeBrand = (org = {}) => {
  const accent = isSafeColor(org?.branding?.accent) ? org.branding.accent.trim() : DEFAULT_ACCENT;
  const logoCandidate = org?.branding?.logo_url || org?.logo_url || null;
  // Gmail bloquea imágenes data: — en ese caso mostramos el nombre en texto.
  const logoUrl = typeof logoCandidate === 'string' && /^https?:\/\//i.test(logoCandidate) ? logoCandidate : null;
  return {
    name: (org?.name || 'Tu agencia').toString().trim(),
    accent,
    logoUrl,
    textOnAccent: pickTextOnAccent(accent),
  };
};

// Blanco o tinta según el contraste del acento (luminancia relativa aproximada).
const pickTextOnAccent = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? INK : '#FFFFFF';
};

/* ---------- Bloques reutilizables ---------- */

export const p = (text, opts = {}) =>
  `<p style="margin:0 0 14px;font-size:${opts.size || 16}px;line-height:1.55;color:${opts.color || INK_SOFT};font-family:${FONT};">${text}</p>`;

export const h1 = (text) =>
  `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.4px;color:${INK};font-family:${FONT};">${text}</h1>`;

export const eyebrow = (text) =>
  `<p style="margin:0 0 10px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${INK_MUTE};font-family:${FONT};">${text}</p>`;

export const button = (href, label, brand) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" bgcolor="${brand.accent}" style="border-radius:999px;">
        <a href="${escapeHtml(href)}" target="_blank"
           style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${brand.textOnAccent};text-decoration:none;border-radius:999px;font-family:${FONT};">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

export const codeBox = (code) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    <tr>
      <td align="center" style="background:${PAPER};border:1px solid ${RULE};border-radius:14px;padding:22px 16px;">
        <span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:8px;color:${INK};font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(code)}</span>
      </td>
    </tr>
  </table>`;

export const keyValue = (rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;border:1px solid ${RULE};border-radius:14px;border-collapse:separate;overflow:hidden;">
    ${rows.map(([k, v], i) => `
    <tr>
      <td style="padding:12px 16px;font-size:13px;color:${INK_MUTE};font-family:${FONT};background:${PAPER};${i ? `border-top:1px solid ${RULE};` : ''}width:40%;">${escapeHtml(k)}</td>
      <td style="padding:12px 16px;font-size:15px;color:${INK};font-weight:600;font-family:${FONT};background:${CARD};${i ? `border-top:1px solid ${RULE};` : ''}">${v}</td>
    </tr>`).join('')}
  </table>`;

export const steps = (items) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px;">
    ${items.map((it, i) => `
    <tr>
      <td valign="top" style="width:36px;padding:0 0 16px;">
        <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:${INK};color:#fff;font-size:13px;font-weight:700;font-family:${FONT};">${i + 1}</span>
      </td>
      <td valign="top" style="padding:2px 0 16px;">
        <div style="font-size:15px;font-weight:600;color:${INK};font-family:${FONT};">${it.title}</div>
        ${it.body ? `<div style="font-size:14px;line-height:1.5;color:${INK_SOFT};font-family:${FONT};margin-top:2px;">${it.body}</div>` : ''}
      </td>
    </tr>`).join('')}
  </table>`;

export const note = (text) =>
  `<p style="margin:18px 0 0;padding:12px 14px;border-left:3px solid ${RULE};font-size:13px;line-height:1.5;color:${INK_MUTE};font-family:${FONT};">${text}</p>`;

/* ---------- Documento completo ---------- */

/**
 * Envuelve el contenido en el documento HTML papel + tinta.
 * @param {object} args
 * @param {object} args.brand  resultado de normalizeBrand()
 * @param {string} args.title  <title> y preheader
 * @param {string} args.body   HTML interno de la tarjeta
 * @param {string} [args.preheader]
 */
export const layout = ({ brand, title, body, preheader }) => {
  const header = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" height="36" style="display:block;height:36px;max-width:180px;width:auto;border:0;outline:none;" />`
    : `<span style="font-size:17px;font-weight:700;letter-spacing:-0.2px;color:${INK};font-family:${FONT};">${escapeHtml(brand.name)}</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]><style>table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .wrap { padding: 16px !important; }
      .card { padding: 26px 20px !important; border-radius: 16px !important; }
      h1 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader || title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background:${PAPER};">
    <tr>
      <td align="center" class="wrap" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 6px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">${header}</td>
                  <td align="right" valign="middle" style="font-size:12px;color:${INK_MUTE};font-family:${FONT};">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${brand.accent};vertical-align:middle;margin-right:6px;"></span>Orbit
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="card" bgcolor="${CARD}" style="background:${CARD};border:1px solid ${RULE};border-radius:20px;padding:36px 36px 30px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 6px 0;text-align:center;font-size:12px;line-height:1.6;color:${INK_MUTE};font-family:${FONT};">
              Enviado por <strong style="color:${INK_SOFT};">${escapeHtml(brand.name)}</strong> con Orbit.<br>
              Si no esperabas este correo, puedes ignorarlo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/** Convierte el HTML del cuerpo en texto plano aceptable para el alt-text. */
export const toText = (html) => String(html || '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `${label.trim()} (${href})`)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|h1|h2|h3|tr|div|li)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .split('\n').map(l => l.trim()).filter((l, i, arr) => l || (i > 0 && arr[i - 1]))
  .join('\n').trim();
