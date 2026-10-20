/**
 * Cliente de WhatsApp vía Kapso (https://kapso.ai)
 *
 * Kapso expone la Cloud API de Meta detrás de un proxy autenticado con API key:
 *   - Mensajería / plantillas / media:  {KAPSO_API_BASE_URL}/meta/whatsapp/{GRAPH}/...
 *   - Platform API (números, webhooks): {KAPSO_API_BASE_URL}/platform/v1/...
 *
 * Variables de entorno:
 *   KAPSO_API_KEY                 API key del proyecto Kapso (obligatoria)
 *   KAPSO_PHONE_NUMBER_ID         phone_number_id de Meta del número conectado (obligatoria)
 *   KAPSO_API_BASE_URL            (opcional) default https://api.kapso.ai
 *   KAPSO_META_GRAPH_VERSION      (opcional) default v24.0
 *   KAPSO_WEBHOOK_SECRET          secreto HMAC del webhook configurado en Kapso
 *   KAPSO_ORGANIZATION_ID         organización por defecto cuando un mensaje entrante no se puede atribuir a ninguna (default 1).
 *                                 El número es compartido por todas las agencias; una org con el add-on `dedicated_number`
 *                                 envía desde su propio `organizations.kapso_phone_number_id`.
 *   WHATSAPP_DEFAULT_COUNTRY_CODE indicativo por defecto para números locales (default 57 = Colombia)
 */
import axios from 'axios';
import crypto from 'crypto';

const BASE_URL = (process.env.KAPSO_API_BASE_URL || 'https://api.kapso.ai').replace(/\/+$/, '');
const GRAPH_VERSION = process.env.KAPSO_META_GRAPH_VERSION || 'v24.0';

export const getKapsoConfig = () => ({
  apiKey: process.env.KAPSO_API_KEY || '',
  phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID || '',
  webhookSecret: process.env.KAPSO_WEBHOOK_SECRET || '',
  organizationId: Number(process.env.KAPSO_ORGANIZATION_ID || 1),
  defaultCountryCode: (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '57').replace(/\D/g, ''),
  baseUrl: BASE_URL,
  graphVersion: GRAPH_VERSION,
});

export const isKapsoConfigured = () => {
  const { apiKey, phoneNumberId } = getKapsoConfig();
  return Boolean(apiKey && phoneNumberId);
};

/**
 * Normaliza un teléfono a formato wa_id (solo dígitos con indicativo de país).
 * "300 123 4567" → "573001234567" · "+57 300..." → "573001234567" · "0057..." → "57..."
 */
export const normalizeWaNumber = (raw, countryCode = getKapsoConfig().defaultCountryCode) => {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Celular colombiano sin indicativo (10 dígitos, empieza por 3)
  if (digits.length === 10 && countryCode === '57' && digits.startsWith('3')) digits = countryCode + digits;
  // Número local genérico sin indicativo (<= 10 dígitos)
  else if (digits.length <= 10 && countryCode && !digits.startsWith(countryCode)) digits = countryCode + digits;
  return digits;
};

/** Últimos 10 dígitos: sirve para emparejar teléfonos guardados con/sin indicativo */
export const phoneTail = (raw) => String(raw || '').replace(/\D/g, '').slice(-10);

export const formatWaNumber = (digits) => {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('57') && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  if (d.startsWith('1') && d.length === 11) return `+1 ${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  return `+${d}`;
};

/**
 * Config efectiva para un envío. `phoneNumberId` opcional: número propio de una organización
 * (add-on `dedicated_number`); si no se pasa, se usa el número compartido de Orbit (env).
 */
const requireConfig = (phoneNumberId = null) => {
  const cfg = getKapsoConfig();
  if (!cfg.apiKey) throw new Error('KAPSO_API_KEY no está configurada');
  const effective = String(phoneNumberId || cfg.phoneNumberId || '').trim();
  if (!effective) throw new Error('KAPSO_PHONE_NUMBER_ID no está configurado');
  return { ...cfg, phoneNumberId: effective };
};

const metaClient = () => {
  const cfg = requireConfig();
  return axios.create({
    baseURL: `${cfg.baseUrl}/meta/whatsapp/${cfg.graphVersion}`,
    headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' },
    timeout: 20000,
    maxRedirects: 0,
  });
};

const platformClient = () => {
  const cfg = requireConfig();
  return axios.create({
    baseURL: `${cfg.baseUrl}/platform/v1`,
    headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' },
    timeout: 20000,
    maxRedirects: 0,
  });
};

/** Convierte un error de axios/Meta en un Error legible */
export const kapsoError = (error, fallback = 'Error comunicándose con WhatsApp') => {
  const data = error?.response?.data;
  const metaErr = data?.error;
  const msg = metaErr?.error_data?.details
    || metaErr?.message
    || data?.message
    || (typeof data === 'string' ? data : null)
    || error?.message
    || fallback;
  const err = new Error(msg);
  err.status = error?.response?.status;
  err.metaCode = metaErr?.code;
  err.raw = data;
  return err;
};

// ---------------------------------------------------------------------------
// Envío de mensajes
// ---------------------------------------------------------------------------

/**
 * Envía cualquier payload de la Cloud API (`messaging_product` se agrega solo).
 * opts.phoneNumberId: enviar desde el número propio de una organización en vez del compartido.
 */
export const sendWhatsAppMessage = async (payload, { phoneNumberId = null } = {}) => {
  const cfg = requireConfig(phoneNumberId);
  try {
    const res = await metaClient().post(`/${cfg.phoneNumberId}/messages`, { messaging_product: 'whatsapp', ...payload });
    const data = res.data || {};
    return {
      wamid: data.messages?.[0]?.id || null,
      messageStatus: data.messages?.[0]?.message_status || null,
      waId: data.contacts?.[0]?.wa_id || payload.to,
      raw: data,
    };
  } catch (error) {
    throw kapsoError(error, 'No se pudo enviar el mensaje de WhatsApp');
  }
};

export const sendText = ({ to, body, previewUrl = false, phoneNumberId = null }) =>
  sendWhatsAppMessage({
    to: normalizeWaNumber(to),
    type: 'text',
    text: { body: String(body || '').slice(0, 4096), preview_url: Boolean(previewUrl) },
  }, { phoneNumberId });

/**
 * Envía una plantilla aprobada.
 * components: formato Cloud API ([{ type:'body', parameters:[{type:'text', parameter_name, text}] }])
 */
export const sendTemplate = ({ to, name, language = 'es', components = [], phoneNumberId = null }) =>
  sendWhatsAppMessage({
    to: normalizeWaNumber(to),
    type: 'template',
    template: { name, language: { code: language }, components },
  }, { phoneNumberId });

export const sendDocument = ({ to, link, filename, caption, phoneNumberId = null }) =>
  sendWhatsAppMessage({
    to: normalizeWaNumber(to),
    type: 'document',
    document: { link, filename, ...(caption ? { caption } : {}) },
  }, { phoneNumberId });

// ---------------------------------------------------------------------------
// Consultas (Platform API / proxy Meta)
// ---------------------------------------------------------------------------

const phoneInfoCache = new Map(); // phoneNumberId -> { at, data }

/** Info del número conectado (estado, nombre verificado, calidad, WABA). Cache 5 min por número. */
export const getPhoneNumberInfo = async ({ force = false, phoneNumberId = null } = {}) => {
  const cfg = requireConfig(phoneNumberId);
  const hit = phoneInfoCache.get(cfg.phoneNumberId);
  if (!force && hit?.data && Date.now() - hit.at < 5 * 60 * 1000) return hit.data;
  try {
    const res = await platformClient().get(`/whatsapp/phone_numbers/${cfg.phoneNumberId}`);
    const data = res.data?.data || res.data;
    phoneInfoCache.set(cfg.phoneNumberId, { at: Date.now(), data });
    return data;
  } catch (error) {
    throw kapsoError(error, 'No se pudo consultar el número de WhatsApp');
  }
};

let templatesCache = { at: 0, data: null };

/** Plantillas del WABA (con estado APPROVED / PENDING / REJECTED). Cache 2 min. */
export const listTemplates = async ({ force = false } = {}) => {
  if (!force && templatesCache.data && Date.now() - templatesCache.at < 2 * 60 * 1000) return templatesCache.data;
  const info = await getPhoneNumberInfo();
  const wabaId = info?.business_account_id;
  if (!wabaId) throw new Error('El número no tiene business_account_id (WABA)');
  try {
    const res = await metaClient().get(`/${wabaId}/message_templates`, { params: { limit: 100 } });
    const data = res.data?.data || [];
    templatesCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    throw kapsoError(error, 'No se pudieron listar las plantillas');
  }
};

export const getApprovedTemplate = async (name, language = 'es') => {
  if (!name) return null;
  try {
    const templates = await listTemplates();
    return templates.find((t) => t.name === name && t.status === 'APPROVED' && (!language || t.language === language))
      || templates.find((t) => t.name === name && t.status === 'APPROVED')
      || null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/**
 * Verifica la firma HMAC-SHA256 (hex) que Kapso envía en X-Webhook-Signature,
 * calculada sobre el cuerpo crudo del request.
 */
export const verifyKapsoSignature = (rawBody, signature, secret = getKapsoConfig().webhookSecret) => {
  if (!secret) return false;
  const sig = String(signature || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
};

/** Extrae un texto legible de un mensaje de la Cloud API (texto, botones, media, etc.) */
export const extractMessageText = (message) => {
  if (!message) return '';
  switch (message.type) {
    case 'text': return message.text?.body || '';
    case 'button': return message.button?.text || '';
    case 'interactive':
      return message.interactive?.button_reply?.title
        || message.interactive?.list_reply?.title
        || message.interactive?.nfm_reply?.body
        || '';
    case 'image': return message.image?.caption || '[Imagen]';
    case 'video': return message.video?.caption || '[Video]';
    case 'audio': return '[Audio]';
    case 'document': return message.document?.caption || `[Documento] ${message.document?.filename || ''}`.trim();
    case 'sticker': return '[Sticker]';
    case 'location': return `[Ubicación] ${message.location?.name || ''}`.trim();
    case 'contacts': return '[Contacto]';
    case 'reaction': return `[Reacción] ${message.reaction?.emoji || ''}`.trim();
    case 'template': return message.kapso?.content || '[Plantilla]';
    default: return message.kapso?.content || `[${message.type || 'mensaje'}]`;
  }
};

export default {
  getKapsoConfig,
  isKapsoConfigured,
  normalizeWaNumber,
  phoneTail,
  formatWaNumber,
  sendWhatsAppMessage,
  sendText,
  sendTemplate,
  sendDocument,
  getPhoneNumberInfo,
  listTemplates,
  getApprovedTemplate,
  verifyKapsoSignature,
  extractMessageText,
};
