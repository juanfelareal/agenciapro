import db from '../config/database.js';
import FacebookAdsIntegration from '../integrations/facebookAds.js';
import ShopifyIntegration from '../integrations/shopify.js';
import siigoService from './siigoService.js';

/**
 * Runs through every connected integration in the database and tests it.
 * Updates status / last_error so the UI can surface stale tokens before
 * the user notices in production.
 */
export async function runIntegrationHealthCheck() {
  const startedAt = new Date();
  const summary = { facebook: { ok: 0, fail: 0 }, shopify: { ok: 0, fail: 0 }, siigo: { ok: 0, fail: 0 } };
  const failures = [];

  // -------- Facebook Ads --------
  const fbAccounts = await db.prepare(`
    SELECT cfc.id, cfc.client_id, cfc.access_token, cfc.ad_account_id, cfc.ad_account_name,
           c.organization_id, c.name as client_name, c.company
    FROM client_facebook_credentials cfc
    JOIN clients c ON cfc.client_id = c.id
  `).all();

  for (const a of fbAccounts) {
    const token = a.access_token || process.env.FACEBOOK_SYSTEM_USER_TOKEN;
    try {
      const fb = new FacebookAdsIntegration(token, a.ad_account_id);
      const result = await fb.testConnection();
      if (result?.success) {
        summary.facebook.ok++;
        await db.prepare(
          "UPDATE client_facebook_credentials SET status = 'active', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(a.id);
      } else {
        summary.facebook.fail++;
        const msg = result?.error || 'Unknown error';
        await db.prepare(
          "UPDATE client_facebook_credentials SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(msg, a.id);
        failures.push({
          platform: 'Facebook Ads',
          client: a.company || a.client_name,
          account: a.ad_account_name || a.ad_account_id,
          error: msg,
        });
      }
    } catch (err) {
      summary.facebook.fail++;
      await db.prepare(
        "UPDATE client_facebook_credentials SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(err.message, a.id);
      failures.push({
        platform: 'Facebook Ads',
        client: a.company || a.client_name,
        account: a.ad_account_name || a.ad_account_id,
        error: err.message,
      });
    }
  }

  // -------- Shopify --------
  const shopifyAccounts = await db.prepare(`
    SELECT csc.id, csc.client_id, csc.store_url, csc.access_token,
           c.organization_id, c.name as client_name, c.company
    FROM client_shopify_credentials csc
    JOIN clients c ON csc.client_id = c.id
    WHERE csc.access_token IS NOT NULL
  `).all();

  for (const s of shopifyAccounts) {
    try {
      const shopify = new ShopifyIntegration(s.store_url, s.access_token);
      const result = await shopify.testConnection();
      if (result?.success) {
        summary.shopify.ok++;
        await db.prepare(
          "UPDATE client_shopify_credentials SET status = 'active', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(s.id);
      } else {
        summary.shopify.fail++;
        const msg = result?.error || 'Unknown error';
        await db.prepare(
          "UPDATE client_shopify_credentials SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(msg, s.id);
        failures.push({
          platform: 'Shopify',
          client: s.company || s.client_name,
          account: s.store_url,
          error: msg,
        });
      }
    } catch (err) {
      summary.shopify.fail++;
      await db.prepare(
        "UPDATE client_shopify_credentials SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(err.message, s.id);
      failures.push({
        platform: 'Shopify',
        client: s.company || s.client_name,
        account: s.store_url,
        error: err.message,
      });
    }
  }

  // -------- Siigo (per organization) --------
  const siigoOrgs = await db.prepare(
    'SELECT DISTINCT organization_id FROM siigo_settings WHERE is_active = 1'
  ).all();

  for (const row of siigoOrgs) {
    try {
      const result = await siigoService.testConnection(row.organization_id);
      if (result?.success) summary.siigo.ok++;
      else {
        summary.siigo.fail++;
        failures.push({ platform: 'Siigo', client: `Org ${row.organization_id}`, account: '-', error: result?.message || 'auth failed' });
      }
    } catch (err) {
      summary.siigo.fail++;
      failures.push({ platform: 'Siigo', client: `Org ${row.organization_id}`, account: '-', error: err.message });
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt - startedAt;

  console.log('[HealthCheck]', {
    durationMs,
    facebook: summary.facebook,
    shopify: summary.shopify,
    siigo: summary.siigo,
    failureCount: failures.length,
  });
  if (failures.length > 0) {
    console.log('[HealthCheck] Failures:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.platform}] ${f.client} (${f.account}) → ${f.error}`);
    });
  }

  return { startedAt, finishedAt, durationMs, summary, failures };
}
