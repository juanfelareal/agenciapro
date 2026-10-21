// [email] Servicio de correos transaccionales con la marca de cada agencia.
//
// Proveedor (en orden):
//   EMAIL_PROVIDER=resend|smtp|log  → fuerza uno
//   RESEND_API_KEY                  → Resend vía fetch (https://api.resend.com/emails)
//   EMAIL_USER + EMAIL_PASS         → SMTP (nodemailer, transporte ya existente en utils/emailHelper.js)
//   (nada)                          → "log": imprime el correo en consola; nada sale.
// Remitente: EMAIL_FROM ("Nombre <correo@dominio>" o solo el correo). El display name se
// reemplaza por "{Agencia} vía Orbit" para que el cliente vea la marca de su agencia.
// Todo intento queda en la tabla email_log (si existe).

import db from '../config/database.js';
import { getEmailTransporter } from '../utils/emailHelper.js';
import { templates } from './emailTemplates/index.js';
import { layout, normalizeBrand, toText } from './emailTemplates/_layout.js';

export const APP_URL = () => (process.env.FRONTEND_URL || 'https://orbit.larealmarketing.com').replace(/\/$/, '');

const DEFAULT_FROM_ADDRESS = 'noreply@larealmarketing.com';

/** Qué proveedor usaremos con las variables actuales. */
export const detectProvider = () => {
  const forced = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (['resend', 'smtp', 'log'].includes(forced)) return forced;
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return 'smtp';
  return 'log';
};

/** Separa "Nombre <correo>" en { name, address }. */
const parseFrom = (raw) => {
  const value = (raw || '').trim();
  const m = value.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim() || null, address: m[2].trim() };
  return { name: null, address: value || null };
};

const buildFrom = (brandName) => {
  const { address } = parseFrom(process.env.EMAIL_FROM || process.env.EMAIL_USER);
  const addr = address || DEFAULT_FROM_ADDRESS;
  const display = brandName ? `${brandName} vía Orbit` : 'Orbit';
  return `"${display.replace(/"/g, '')}" <${addr}>`;
};

/* ---------------------------------------------------------------------------
 * Marca de la organización
 * ------------------------------------------------------------------------- */

/**
 * Lee name / logo_url / branding.accent de la organización.
 * Usa SELECT * para no romper si la columna `branding` aún no existe.
 */
export const getOrgBrand = async (orgId) => {
  if (!orgId) return normalizeBrand({});
  try {
    const row = await db.get('SELECT * FROM organizations WHERE id = ?', [orgId]);
    if (!row) return normalizeBrand({});
    let branding = row.branding;
    if (typeof branding === 'string') { try { branding = JSON.parse(branding); } catch { branding = null; } }
    let settings = row.settings;
    if (typeof settings === 'string') { try { settings = JSON.parse(settings); } catch { settings = null; } }
    return normalizeBrand({
      name: row.name,
      logo_url: row.logo_url,
      branding: branding || settings?.branding || null,
    });
  } catch (e) {
    console.error('[email] getOrgBrand failed:', e.message);
    return normalizeBrand({});
  }
};

/* ---------------------------------------------------------------------------
 * Render
 * ------------------------------------------------------------------------- */

/**
 * renderTemplate(name, { org, ...data }) → { subject, html, text }
 * `org` puede ser el row de organizations ({ name, logo_url, branding }) o el
 * resultado de getOrgBrand(). El resto del objeto son los datos de la plantilla.
 */
export const renderTemplate = (name, { org, ...data } = {}) => {
  const tpl = templates[name];
  if (!tpl) throw new Error(`Plantilla de correo desconocida: ${name}`);
  const brand = org && org.textOnAccent ? org : normalizeBrand(org || {});
  const ctx = { ...data, org: brand, brand };
  const subject = tpl.subject(ctx);
  const body = tpl.body(ctx);
  const html = layout({ brand, title: subject, body, preheader: data.preheader });
  return { subject, html, text: toText(body) };
};

/** Datos de ejemplo de una plantilla con {{APP_URL}} resuelto (para la vista previa). */
export const sampleDataFor = (name) => {
  const tpl = templates[name];
  if (!tpl) return null;
  const json = JSON.stringify(tpl.sample || {}).replaceAll('{{APP_URL}}', APP_URL());
  return JSON.parse(json);
};

/* ---------------------------------------------------------------------------
 * Envío
 * ------------------------------------------------------------------------- */

const logEmail = async ({ orgId, to, subject, template, status, provider, providerId, error }) => {
  try {
    await db.run(
      `INSERT INTO email_log (organization_id, "to", subject, template, status, provider, provider_id, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orgId || null, Array.isArray(to) ? to.join(', ') : to, subject, template || null, status, provider, providerId || null, error || null]
    );
  } catch (e) {
    // La tabla puede no existir todavía (primer arranque); nunca bloquea el envío.
    console.warn('[email] email_log insert failed:', e.message);
  }
};

const sendViaResend = async ({ from, to, subject, html, text, replyTo, tags }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(tags?.length ? { tags: tags.map(t => (typeof t === 'string' ? { name: 'tag', value: t } : t)) } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${data?.message || data?.name || 'error'}`);
  return data?.id || null;
};

const sendViaSmtp = async ({ from, to, subject, html, text, replyTo }) => {
  const transporter = getEmailTransporter();
  const info = await transporter.sendMail({ from, to, subject, html, text, ...(replyTo ? { replyTo } : {}) });
  return info?.messageId || null;
};

const sendViaLog = async ({ from, to, subject, text }) => {
  console.log('\n📧 [email:log] (no hay proveedor configurado; el correo NO se envió)');
  console.log(`   From:    ${from}`);
  console.log(`   To:      ${Array.isArray(to) ? to.join(', ') : to}`);
  console.log(`   Subject: ${subject}`);
  console.log('   ---');
  console.log((text || '').split('\n').map(l => `   ${l}`).join('\n'));
  console.log('');
  return `log-${Date.now()}`;
};

/**
 * sendEmail({ orgId, to, subject, html, text, replyTo, tags, template })
 * Devuelve { ok, provider, id } o { ok: false, provider, error }. Nunca lanza
 * por fallos del proveedor (queda en email_log); sí lanza si faltan `to`/`subject`.
 */
export const sendEmail = async ({ orgId, to, subject, html, text, replyTo, tags, template, brandName }) => {
  if (!to) throw new Error('sendEmail: falta destinatario');
  if (!subject) throw new Error('sendEmail: falta asunto');

  const provider = detectProvider();
  const name = brandName ?? (orgId ? (await getOrgBrand(orgId)).name : null);
  const from = buildFrom(name);
  const payload = { from, to, subject, html, text: text || (html ? toText(html) : ''), replyTo, tags };

  try {
    let id = null;
    if (provider === 'resend') id = await sendViaResend(payload);
    else if (provider === 'smtp') id = await sendViaSmtp(payload);
    else id = await sendViaLog(payload);
    await logEmail({ orgId, to, subject, template, status: provider === 'log' ? 'logged' : 'sent', provider, providerId: id });
    return { ok: true, provider, id };
  } catch (error) {
    console.error(`[email] ${provider} failed for ${Array.isArray(to) ? to.join(',') : to}:`, error.message);
    await logEmail({ orgId, to, subject, template, status: 'failed', provider, error: error.message });
    return { ok: false, provider, error: error.message };
  }
};

/**
 * Atajo: carga la marca de la org, renderiza la plantilla y envía.
 * sendTemplate({ orgId, to, template, data, replyTo })
 */
export const sendTemplate = async ({ orgId, to, template, data = {}, replyTo, tags }) => {
  const org = await getOrgBrand(orgId);
  const { subject, html, text } = renderTemplate(template, { org, ...data });
  return sendEmail({ orgId, to, subject, html, text, replyTo, tags: tags || [template], template, brandName: org.name });
};

export { templates, templateNames } from './emailTemplates/index.js';
