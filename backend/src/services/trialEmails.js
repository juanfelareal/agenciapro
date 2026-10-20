// [email] Aviso "tu prueba termina en 3 días" a los admins de cada organización.
// Job diario (ver server.js). Defensivo: si organizations aún no tiene
// plan_status / trial_ends_at (los agrega otra etapa), no hace nada.
// Marca el envío en organizations.settings.emails.trial_ending_sent para no repetirlo.

import db from '../config/database.js';
import { sendTemplate, APP_URL } from './email.js';

const hasColumns = async () => {
  const rows = await db.all(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'organizations' AND column_name IN ('plan_status', 'trial_ends_at')`
  );
  return rows.length === 2;
};

export const sendTrialEndingEmails = async () => {
  try {
    if (!(await hasColumns())) {
      console.log('[trial-ending] organizations.plan_status/trial_ends_at no existen todavía; se omite.');
      return { skipped: true };
    }

    const orgs = await db.all(
      `SELECT id, name, trial_ends_at, settings FROM organizations
       WHERE plan_status = 'trial'
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at::date BETWEEN (CURRENT_DATE + 2) AND (CURRENT_DATE + 4)
         AND COALESCE(settings->'emails'->>'trial_ending_sent', '') = ''`
    );

    let sent = 0;
    for (const org of orgs) {
      const admins = await db.all(
        `SELECT name, email FROM team_members
         WHERE organization_id = ? AND role = 'admin' AND status = 'active' AND email IS NOT NULL`,
        [org.id]
      );
      if (!admins.length) continue;

      const endsAt = new Date(org.trial_ends_at);
      const daysLeft = Math.max(1, Math.round((endsAt.getTime() - Date.now()) / 86400000));

      for (const admin of admins) {
        await sendTemplate({
          orgId: org.id,
          to: admin.email,
          template: 'trial-ending',
          data: { adminName: admin.name, trialEndsAt: org.trial_ends_at, daysLeft, billingUrl: `${APP_URL()}/app/settings` },
        });
        sent++;
      }

      await db.run(
        `UPDATE organizations
         SET settings = jsonb_set(
               jsonb_set(COALESCE(settings, '{}'::jsonb), '{emails}', COALESCE(settings->'emails', '{}'::jsonb), true),
               '{emails,trial_ending_sent}', to_jsonb(NOW()::text), true),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [org.id]
      );
    }

    if (orgs.length) console.log(`[trial-ending] ${sent} correos para ${orgs.length} organizaciones`);
    return { orgs: orgs.length, sent };
  } catch (error) {
    console.error('[trial-ending] error:', error.message);
    return { error: error.message };
  }
};
