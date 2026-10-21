// [billing] Tarea diaria de facturación.
//  - Planes activos cuya renovación venció hace más de 7 días → plan_status = 'past_due'
//    (las lecturas siguen; el frontend muestra el aviso de pago). LA REAL (org 1) nunca.
//  - Pagos pendientes con más de 30 días → 'voided' (el link de Bold expira a los 7 días).
//
// Enganche en server.js (junto a los otros crons):
//   import { runBillingDaily } from './src/services/billingCron.js';
//   cron.schedule('30 0 * * *', () => runBillingDaily().catch((e) => console.error('❌ Billing daily:', e.message)), { scheduled: true, timezone: 'America/Bogota' });
import db from '../config/database.js';
import { invalidateOrgPlanCache, LA_REAL_ORG_ID } from './plans.js';

export const PAST_DUE_GRACE_DAYS = 7;
export const PENDING_PAYMENT_TTL_DAYS = 30;

export async function runBillingDaily({ now = new Date() } = {}) {
  const graceCutoff = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * 86400000).toISOString();
  const pendingCutoff = new Date(now.getTime() - PENDING_PAYMENT_TTL_DAYS * 86400000).toISOString();

  const pastDue = await db.all(
    `UPDATE organizations
        SET plan_status = 'past_due', updated_at = CURRENT_TIMESTAMP
      WHERE plan_status = 'active' AND plan_renews_at IS NOT NULL AND plan_renews_at < ? AND id <> ?
      RETURNING id, name, plan, plan_renews_at`,
    [graceCutoff, LA_REAL_ORG_ID]
  );
  for (const org of pastDue) {
    invalidateOrgPlanCache(org.id);
    console.warn(`[billing] org ${org.id} (${org.name}) pasó a past_due: plan ${org.plan} venció el ${new Date(org.plan_renews_at).toISOString().slice(0, 10)}`);
  }

  const voided = await db.all(
    `UPDATE billing_payments
        SET status = 'voided',
            bold_payload = COALESCE(bold_payload, '{}'::jsonb) || jsonb_build_object('voided_reason', 'pending_expired', 'voided_at', ?::text)
      WHERE status = 'pending' AND created_at < ?
      RETURNING id, organization_id, reference`,
    [now.toISOString(), pendingCutoff]
  );

  const summary = { past_due: pastDue.length, pending_voided: voided.length, ran_at: now.toISOString() };
  console.log('[billing] daily:', JSON.stringify(summary));
  return summary;
}

export default runBillingDaily;
