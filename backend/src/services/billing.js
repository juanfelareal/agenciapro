// [billing] Cobro de planes con Bold (bold.co) y activación de planes.
//
//  - quote(plan, cycle)                      → { amount, iva, total, ... } (precios del catálogo, COP)
//  - createCheckout({ orgId, plan, cycle })  → fila en billing_payments + link de Bold (o instrucciones manuales)
//  - verifyBoldSignature(rawBody, sig)       → HMAC-SHA256(base64(body)) hex, header x-bold-signature
//  - applyBoldEvent(event)                   → idempotente: SALE_APPROVED activa el plan, SALE_REJECTED / VOID_* marcan el pago
//  - activateOrgPlan({...})                  → UPDATE organizations (lo usa el webhook y la activación manual)
//
// Docs: https://developers.bold.co/pagos-en-linea/api-link-de-pagos · https://developers.bold.co/webhook
import crypto from 'node:crypto';
import db from '../config/database.js';
import {
  PLANS,
  SELECTABLE_PLANS,
  BILLING_CYCLES,
  IVA,
  BOLD_FEE,
  ANNUAL_MONTHS,
  PRICE_LOCK_MONTHS,
  annualPrice,
} from '../config/planCatalog.js';
import { invalidateOrgPlanCache } from './plans.js';
import { sendTemplate, APP_URL } from './email.js';

export const BOLD_API_BASE = process.env.BOLD_API_BASE || 'https://integrations.api.bold.co';
export const BOLD_LINK_EXPIRATION_DAYS = 7;
// Bold limita el monto por link (Nequi / Botón Bancolombia 10.000.000; tarjeta / PSE 5.000.000).
export const BOLD_MAX_LINK_AMOUNT = Number(process.env.BOLD_MAX_LINK_AMOUNT || 10_000_000);
export const BILLING_CONTACT_EMAIL = process.env.BILLING_CONTACT_EMAIL || 'juanfe@larealmarketing.com';

export const PAYMENT_STATUSES = ['pending', 'approved', 'rejected', 'voided'];

const boldApiKey = () => (process.env.BOLD_API_KEY || '').trim();
const boldWebhookSecret = () => (process.env.BOLD_WEBHOOK_SECRET || '').trim();

export const bankInstructions = () =>
  (process.env.BILLING_BANK_INSTRUCTIONS || '').trim()
  || `Escríbenos a ${BILLING_CONTACT_EMAIL} con la referencia de tu pago y te enviamos los datos para la transferencia. Activamos tu plan el mismo día en que confirmamos el pago.`;

/* ---------------------------------------------------------------------------
 * Cotización
 * ------------------------------------------------------------------------- */

export function normalizeCycle(cycle) {
  const c = String(cycle || 'monthly').toLowerCase();
  if (c === 'anual' || c === 'yearly' || c === 'year') return 'annual';
  if (c === 'mensual' || c === 'month') return 'monthly';
  return BILLING_CYCLES.includes(c) ? c : null;
}

/** Comisión estimada de Bold (informativa; el cliente paga `total`, la comisión la asume LA REAL). */
export function boldFeeFor(total) {
  const base = Math.round(total * BOLD_FEE.pct + BOLD_FEE.fixed);
  const iva = Math.round(base * IVA);
  return { base, iva, total: base + iva };
}

/** Cotiza un plan en un ciclo: montos en COP enteros. */
export function quote(planKey, cycle) {
  const plan = String(planKey || '').toLowerCase();
  if (!SELECTABLE_PLANS.includes(plan)) {
    const err = new Error(`Plan inválido. Opciones: ${SELECTABLE_PLANS.join(', ')}`);
    err.status = 400;
    throw err;
  }
  const c = normalizeCycle(cycle);
  if (!c) {
    const err = new Error(`Ciclo inválido. Opciones: ${BILLING_CYCLES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  const monthly = PLANS[plan].price;
  const amount = c === 'annual' ? annualPrice(plan) : monthly;
  const iva = Math.round(amount * IVA);
  const total = amount + iva;
  return {
    plan,
    plan_name: PLANS[plan].name,
    cycle: c,
    months: c === 'annual' ? 12 : 1,
    billed_months: c === 'annual' ? ANNUAL_MONTHS : 1,
    unit_price: monthly,
    amount,
    iva,
    total,
    bold_fee_estimate: boldFeeFor(total),
    includes: c === 'annual' ? (PLANS[plan].annual_includes || []) : [],
  };
}

/* ---------------------------------------------------------------------------
 * Bold API
 * ------------------------------------------------------------------------- */

const boldHeaders = () => ({
  Authorization: `x-api-key ${boldApiKey()}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

/**
 * Crea un link de pago cerrado. Bold pide `expiration_date` en nanosegundos desde epoch
 * (el ejemplo de la doc parece en ms; BOLD_EXPIRATION_UNIT=ms lo cambia sin tocar código).
 */
export async function boldCreateLink({ total, iva, description, reference, callbackUrl, payerEmail }) {
  const expiresAtMs = Date.now() + BOLD_LINK_EXPIRATION_DAYS * 86400000;
  const unit = (process.env.BOLD_EXPIRATION_UNIT || 'ns').toLowerCase();
  const expiration = unit === 'ms' ? BigInt(expiresAtMs) : BigInt(expiresAtMs) * 1_000_000n;

  const body = {
    amount_type: 'CLOSE',
    amount: {
      currency: 'COP',
      total_amount: total,
      tip_amount: 0,
      ...(iva ? { taxes: [{ type: 'VAT', base: total - iva, value: iva }] } : {}),
    },
    description: String(description || 'Suscripción Orbit').slice(0, 100),
    reference,
    callback_url: callbackUrl,
    expiration_date: '__EXPIRATION__',
    ...(payerEmail ? { payer_email: payerEmail } : {}),
  };
  // BigInt no serializa con JSON.stringify: lo inyectamos como número crudo
  const json = JSON.stringify(body).replace('"__EXPIRATION__"', expiration.toString());

  const res = await fetch(`${BOLD_API_BASE}/online/link/v1`, { method: 'POST', headers: boldHeaders(), body: json });
  const data = await res.json().catch(() => ({}));
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (!res.ok || !data?.payload?.url || errors.length) {
    const msg = errors.map((e) => e?.message || e?.code || JSON.stringify(e)).join('; ') || `HTTP ${res.status}`;
    const err = new Error(`Bold no pudo crear el link de pago: ${msg}`);
    err.status = 502;
    err.bold = data;
    throw err;
  }
  return { link_id: data.payload.payment_link, url: data.payload.url, raw: data };
}

/** Consulta un link: { status: ACTIVE|PROCESSING|PAID|REJECTED|CANCELLED|EXPIRED, ... } */
export async function boldGetLink(linkId) {
  const res = await fetch(`${BOLD_API_BASE}/online/link/v1/${encodeURIComponent(linkId)}`, { headers: boldHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Bold: no se pudo consultar el link (${res.status})`);
    err.status = 502;
    throw err;
  }
  return data?.payload || data;
}

/**
 * Firma del webhook: HMAC-SHA256 con la llave secreta sobre el cuerpo codificado en Base64, en hex.
 * Header: x-bold-signature.
 */
export function verifyBoldSignature(rawBody, signature, secret = boldWebhookSecret()) {
  if (!secret) return false;
  const sig = String(signature || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(buf.toString('base64')).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/** Para pruebas locales y el README: firma un cuerpo como lo haría Bold. */
export function signBoldBody(rawBody, secret = boldWebhookSecret()) {
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  return crypto.createHmac('sha256', secret).update(buf.toString('base64')).digest('hex');
}

/* ---------------------------------------------------------------------------
 * Pagos (billing_payments)
 * ------------------------------------------------------------------------- */

export function newReference(orgId) {
  return `orb_${Number(orgId)}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

const parseJson = (v) => {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};

export function publicPayment(row) {
  if (!row) return null;
  const payload = parseJson(row.bold_payload) || {};
  return {
    id: row.id,
    organization_id: row.organization_id,
    provider: row.provider,
    reference: row.reference,
    plan: row.plan,
    plan_name: PLANS[row.plan]?.name || row.plan,
    cycle: row.cycle,
    amount: Number(row.amount),
    iva: Number(row.iva),
    total: Number(row.total),
    status: row.status,
    bold_link_id: row.bold_link_id || null,
    url: payload.url || null,
    payment_method: payload.event?.data?.payment_method || null,
    created_at: row.created_at,
    paid_at: row.paid_at,
  };
}

export async function getPaymentByReference(reference, orgId = null) {
  if (!reference) return null;
  const row = orgId == null
    ? await db.get('SELECT * FROM billing_payments WHERE reference = ?', [reference])
    : await db.get('SELECT * FROM billing_payments WHERE reference = ? AND organization_id = ?', [reference, Number(orgId)]);
  return row || null;
}

export async function listPayments(orgId, limit = 50) {
  return db.all(
    'SELECT * FROM billing_payments WHERE organization_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    [Number(orgId), Math.min(Number(limit) || 50, 200)]
  );
}

/**
 * Crea el intento de pago y, si hay BOLD_API_KEY, el link de Bold.
 * Devuelve { provider: 'bold', url, reference, amount, iva, total } o
 *          { provider: 'manual', reference, amount, iva, total, instructions }.
 */
export async function createCheckout({ orgId, orgName, plan, cycle, payerEmail }) {
  const q = quote(plan, cycle);
  const reference = newReference(orgId);
  const description = `Orbit ${q.plan_name} ${q.cycle === 'annual' ? 'anual' : 'mensual'}${orgName ? ` · ${orgName}` : ''}`;
  const callbackUrl = `${APP_URL()}/app/suscripcion?pago=${encodeURIComponent(reference)}`;

  const useBold = !!boldApiKey() && q.total <= BOLD_MAX_LINK_AMOUNT;
  let provider = 'manual';
  let link = null;
  let manualReason = null;

  if (useBold) {
    link = await boldCreateLink({ total: q.total, iva: q.iva, description, reference, callbackUrl, payerEmail });
    provider = 'bold';
  } else if (boldApiKey()) {
    manualReason = `El total (${q.total.toLocaleString('es-CO')} COP) supera el máximo por link de Bold (${BOLD_MAX_LINK_AMOUNT.toLocaleString('es-CO')} COP); este pago se hace por transferencia.`;
  }

  const payload = {
    description,
    callback_url: callbackUrl,
    url: link?.url || null,
    bold_create_response: link?.raw || null,
    manual_reason: manualReason,
    quote: { unit_price: q.unit_price, billed_months: q.billed_months, months: q.months },
  };
  const ins = await db.run(
    `INSERT INTO billing_payments (organization_id, provider, reference, plan, cycle, amount, iva, total, status, bold_link_id, bold_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?::jsonb)`,
    [Number(orgId), provider, reference, q.plan, q.cycle, q.amount, q.iva, q.total, link?.link_id || null, JSON.stringify(payload)]
  );

  const base = { id: ins.lastInsertRowid, provider, reference, plan: q.plan, plan_name: q.plan_name, cycle: q.cycle, amount: q.amount, iva: q.iva, total: q.total, includes: q.includes };
  if (provider === 'bold') return { ...base, url: link.url, bold_link_id: link.link_id, expires_in_days: BOLD_LINK_EXPIRATION_DAYS };
  return { ...base, instructions: bankInstructions(), contact_email: BILLING_CONTACT_EMAIL, reason: manualReason };
}

/* ---------------------------------------------------------------------------
 * Activación del plan
 * ------------------------------------------------------------------------- */

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

/**
 * Activa (o renueva) el plan de una organización tras un pago aprobado.
 *  - plan_status = 'active', billing_cycle, plan_started_at (si no venía o cambió de plan),
 *  - plan_renews_at: +1 mes (mensual) o +12 meses (anual) desde hoy, o desde la renovación vigente si paga antes,
 *  - anual: price_locked_until = +24 meses y plan_price_locked = precio mensual del plan,
 *  - trial_ends_at = NULL. Los addons no se tocan: los incluidos del anual salen por regla.
 */
export async function activateOrgPlan({ orgId, plan, cycle, now = new Date() }) {
  const c = normalizeCycle(cycle) || 'monthly';
  const org = await db.get('SELECT id, plan, plan_status, plan_started_at, plan_renews_at FROM organizations WHERE id = ?', [Number(orgId)]);
  if (!org) throw new Error(`Organización ${orgId} no existe`);

  const samePlan = org.plan === plan && org.plan_status === 'active';
  const currentRenews = org.plan_renews_at ? new Date(org.plan_renews_at) : null;
  const base = samePlan && currentRenews && currentRenews > now ? currentRenews : now;
  const renewsAt = addMonths(base, c === 'annual' ? 12 : 1);
  const startedAt = samePlan && org.plan_started_at ? new Date(org.plan_started_at) : now;
  const lockedUntil = c === 'annual' ? addMonths(now, PRICE_LOCK_MONTHS) : null;
  const priceLocked = PLANS[plan]?.price ?? null;

  await db.run(
    `UPDATE organizations
        SET plan = ?, plan_selected = ?, plan_status = 'active', billing_cycle = ?,
            plan_started_at = ?, plan_renews_at = ?, price_locked_until = ?, plan_price_locked = ?,
            trial_ends_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [plan, plan, c, startedAt.toISOString(), renewsAt.toISOString(), lockedUntil ? lockedUntil.toISOString() : null, priceLocked, Number(orgId)]
  );
  invalidateOrgPlanCache(orgId);
  return { plan, cycle: c, plan_started_at: startedAt.toISOString(), plan_renews_at: renewsAt.toISOString(), price_locked_until: lockedUntil ? lockedUntil.toISOString() : null, plan_price_locked: priceLocked };
}

/* ---------------------------------------------------------------------------
 * Webhook de Bold
 * ------------------------------------------------------------------------- */

export const BOLD_EVENT_STATUS = {
  SALE_APPROVED: 'approved',
  SALE_REJECTED: 'rejected',
  VOID_APPROVED: 'voided',
  // VOID_REJECTED: la anulación falló → el pago sigue aprobado; solo se registra.
};

export function referenceFromEvent(event) {
  return event?.data?.metadata?.reference
    || event?.data?.reference
    || event?.metadata?.reference
    || event?.reference
    || null;
}

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
const fmtDate = (iso) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }); } catch { return String(iso); }
};

/** Correo de confirmación a los admins de la organización (nunca lanza). */
export async function sendPaymentApprovedEmail(payment, activation) {
  try {
    const admins = await db.all(
      `SELECT DISTINCT email FROM team_members WHERE organization_id = ? AND role = 'admin' AND status = 'active' AND email IS NOT NULL`,
      [payment.organization_id]
    );
    const to = admins.map((a) => a.email).filter(Boolean);
    const payerEmail = parseJson(payment.bold_payload)?.event?.data?.payer_email;
    if (payerEmail && !to.includes(payerEmail)) to.push(payerEmail);
    if (!to.length) return { ok: false, error: 'sin destinatarios' };
    const plan = PLANS[payment.plan];
    return await sendTemplate({
      orgId: payment.organization_id,
      to,
      template: 'payment-approved',
      replyTo: BILLING_CONTACT_EMAIL,
      data: {
        planName: plan?.name || payment.plan,
        cycle: payment.cycle,
        cycleLabel: payment.cycle === 'annual' ? 'Anual' : 'Mensual',
        amount: money(payment.amount),
        iva: money(payment.iva),
        total: money(payment.total),
        reference: payment.reference,
        paymentMethod: parseJson(payment.bold_payload)?.event?.data?.payment_method || null,
        renewsAt: fmtDate(activation?.plan_renews_at),
        priceLockedUntil: fmtDate(activation?.price_locked_until),
        includes: payment.cycle === 'annual' ? (plan?.annual_includes || []).map((i) => ({ label: i.label, value: money(i.value) })) : [],
        appUrl: `${APP_URL()}/app/suscripcion`,
      },
    });
  } catch (error) {
    console.error('[billing] correo payment-approved:', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Aplica un evento del webhook de Bold. Idempotente por referencia + estado.
 * Devuelve { handled, reference, status, activated?, reason? }.
 */
export async function applyBoldEvent(event, { source = 'webhook' } = {}) {
  const type = String(event?.type || '').toUpperCase();
  const reference = referenceFromEvent(event);
  if (!reference) return { handled: false, reason: 'sin referencia' };

  const payment = await getPaymentByReference(reference);
  if (!payment) return { handled: false, reference, reason: 'referencia desconocida' };

  const nextStatus = BOLD_EVENT_STATUS[type];
  const payload = { ...(parseJson(payment.bold_payload) || {}), event, last_event_type: type, last_event_at: new Date().toISOString(), source };

  if (!nextStatus) {
    await db.run('UPDATE billing_payments SET bold_payload = ?::jsonb WHERE id = ?', [JSON.stringify(payload), payment.id]);
    return { handled: true, reference, status: payment.status, ignored: type || 'desconocido' };
  }

  // Idempotencia: mismo estado ya aplicado → no reprocesar
  if (payment.status === nextStatus) return { handled: true, reference, status: nextStatus, duplicate: true };
  // Un pago anulado no vuelve a aprobarse por un evento viejo
  if (payment.status === 'voided' && nextStatus === 'approved') return { handled: true, reference, status: 'voided', ignored: 'approved-after-void' };

  if (nextStatus === 'approved') {
    const expectedTotal = Number(payment.total);
    const paidTotal = Number(event?.data?.amount?.total);
    if (Number.isFinite(paidTotal) && paidTotal > 0 && Math.abs(paidTotal - expectedTotal) > 1) {
      payload.amount_mismatch = { expected: expectedTotal, paid: paidTotal };
      console.warn(`[billing] ${reference}: monto pagado ${paidTotal} ≠ esperado ${expectedTotal}`);
    }
    await db.run(
      `UPDATE billing_payments SET status = 'approved', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), bold_payload = ?::jsonb WHERE id = ?`,
      [JSON.stringify(payload), payment.id]
    );
    const activation = await activateOrgPlan({ orgId: payment.organization_id, plan: payment.plan, cycle: payment.cycle });
    console.log(`[billing] Pago aprobado ${reference}: org ${payment.organization_id} → ${payment.plan} ${payment.cycle} (renueva ${activation.plan_renews_at})`);
    const fresh = await getPaymentByReference(reference);
    // El correo no bloquea la respuesta al webhook (Bold espera 200 en < 2 s)
    sendPaymentApprovedEmail(fresh, activation).catch(() => {});
    return { handled: true, reference, status: 'approved', activated: activation };
  }

  await db.run('UPDATE billing_payments SET status = ?, bold_payload = ?::jsonb WHERE id = ?', [nextStatus, JSON.stringify(payload), payment.id]);
  if (nextStatus === 'voided' && payment.status === 'approved') {
    console.warn(`[billing] Pago ${reference} ANULADO después de activar la org ${payment.organization_id}; revisar a mano (el plan no se desactiva solo).`);
  }
  return { handled: true, reference, status: nextStatus };
}

/**
 * Para la pantalla de retorno: si el pago sigue pendiente y hay link de Bold,
 * consulta el link y, si ya está PAID, lo aplica (por si el webhook aún no llegó).
 */
export async function reconcilePendingPayment(payment) {
  if (!payment || payment.status !== 'pending' || !payment.bold_link_id || !boldApiKey()) return payment;
  try {
    const link = await boldGetLink(payment.bold_link_id);
    const status = String(link?.status || '').toUpperCase();
    const map = { PAID: 'SALE_APPROVED', REJECTED: 'SALE_REJECTED', CANCELLED: 'VOID_APPROVED' };
    if (map[status]) {
      await applyBoldEvent(
        { type: map[status], data: { metadata: { reference: payment.reference }, amount: { total: link.total }, payment_method: link.payment_method, payment_id: link.transaction_id }, source: '/online/link/v1' },
        { source: 'poll' }
      );
      return getPaymentByReference(payment.reference);
    }
    if (status === 'EXPIRED') {
      const payload = { ...(parseJson(payment.bold_payload) || {}), link_status: status };
      await db.run('UPDATE billing_payments SET bold_payload = ?::jsonb WHERE id = ?', [JSON.stringify(payload), payment.id]);
    }
  } catch (error) {
    console.warn('[billing] reconcile:', error.message);
  }
  return payment;
}

export default {
  quote, createCheckout, verifyBoldSignature, signBoldBody, applyBoldEvent, activateOrgPlan,
  getPaymentByReference, listPayments, publicPayment, reconcilePendingPayment, bankInstructions,
};
