import db from '../config/database.js';
import FacebookAdsIntegration from '../integrations/facebookAds.js';
import ShopifyIntegration from '../integrations/shopify.js';

/**
 * Metrics Sync Service
 * Handles synchronization of metrics from Facebook Ads and Shopify
 */

/**
 * Get all active clients with platform credentials
 * @returns {Array}
 */
export function getClientsWithCredentials() {
  const query = `
    SELECT
      c.id,
      c.name,
      c.company,
      fb.access_token as fb_access_token,
      fb.ad_account_id as fb_ad_account_id,
      fb.status as fb_status,
      sh.store_url as shopify_store_url,
      sh.access_token as shopify_access_token,
      sh.status as shopify_status
    FROM clients c
    LEFT JOIN client_facebook_credentials fb ON c.id = fb.client_id
    LEFT JOIN client_shopify_credentials sh ON c.id = sh.client_id
    WHERE c.status = 'active'
      AND (fb.id IS NOT NULL OR sh.id IS NOT NULL)
  `;

  return db.prepare(query).all();
}

/**
 * Create a sync job record
 * @param {number} clientId
 * @param {string} jobType - 'facebook', 'shopify', or 'all'
 * @returns {number} Job ID
 */
export function createSyncJob(clientId, jobType) {
  const result = db.prepare(`
    INSERT INTO metrics_sync_jobs (client_id, job_type, status, started_at)
    VALUES (?, ?, 'running', datetime('now'))
  `).run(clientId, jobType);

  return result.lastInsertRowid;
}

/**
 * Update sync job status
 * @param {number} jobId
 * @param {string} status
 * @param {number} recordsProcessed
 * @param {string} errorMessage
 */
export function updateSyncJob(jobId, status, recordsProcessed = 0, errorMessage = null) {
  db.prepare(`
    UPDATE metrics_sync_jobs
    SET status = ?,
        completed_at = datetime('now'),
        records_processed = ?,
        error_message = ?
    WHERE id = ?
  `).run(status, recordsProcessed, errorMessage, jobId);
}

/**
 * Update credential status and last sync
 * @param {string} table - 'client_facebook_credentials' or 'client_shopify_credentials'
 * @param {number} clientId
 * @param {string} status
 * @param {string} error
 */
export function updateCredentialStatus(table, clientId, status, error = null) {
  db.prepare(`
    UPDATE ${table}
    SET status = ?,
        last_sync_at = datetime('now'),
        last_error = ?,
        updated_at = datetime('now')
    WHERE client_id = ?
  `).run(status, error, clientId);
}

/**
 * Upsert daily metrics for a client
 * @param {number} clientId
 * @param {string} date - YYYY-MM-DD
 * @param {object} metrics
 */
export function upsertDailyMetrics(clientId, date, metrics) {
  const existing = db.prepare(`
    SELECT id FROM client_daily_metrics
    WHERE client_id = ? AND metric_date = ?
  `).get(clientId, date);

  if (existing) {
    db.prepare(`
      UPDATE client_daily_metrics
      SET shopify_revenue = ?,
          shopify_orders = ?,
          shopify_aov = ?,
          shopify_refunds = ?,
          shopify_net_revenue = ?,
          fb_spend = ?,
          fb_impressions = ?,
          fb_clicks = ?,
          fb_ctr = ?,
          fb_cpc = ?,
          fb_conversions = ?,
          fb_revenue = ?,
          fb_roas = ?,
          total_revenue = ?,
          overall_roas = ?,
          cost_per_order = ?,
          ad_spend_percentage = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      metrics.shopify_revenue || 0,
      metrics.shopify_orders || 0,
      metrics.shopify_aov || 0,
      metrics.shopify_refunds || 0,
      metrics.shopify_net_revenue || 0,
      metrics.fb_spend || 0,
      metrics.fb_impressions || 0,
      metrics.fb_clicks || 0,
      metrics.fb_ctr || 0,
      metrics.fb_cpc || 0,
      metrics.fb_conversions || 0,
      metrics.fb_revenue || 0,
      metrics.fb_roas || 0,
      metrics.total_revenue || 0,
      metrics.overall_roas || 0,
      metrics.cost_per_order || 0,
      metrics.ad_spend_percentage || 0,
      existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO client_daily_metrics (
        client_id, metric_date,
        shopify_revenue, shopify_orders, shopify_aov, shopify_refunds, shopify_net_revenue,
        fb_spend, fb_impressions, fb_clicks, fb_ctr, fb_cpc, fb_conversions, fb_revenue, fb_roas,
        total_revenue, overall_roas, cost_per_order, ad_spend_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId, date,
      metrics.shopify_revenue || 0,
      metrics.shopify_orders || 0,
      metrics.shopify_aov || 0,
      metrics.shopify_refunds || 0,
      metrics.shopify_net_revenue || 0,
      metrics.fb_spend || 0,
      metrics.fb_impressions || 0,
      metrics.fb_clicks || 0,
      metrics.fb_ctr || 0,
      metrics.fb_cpc || 0,
      metrics.fb_conversions || 0,
      metrics.fb_revenue || 0,
      metrics.fb_roas || 0,
      metrics.total_revenue || 0,
      metrics.overall_roas || 0,
      metrics.cost_per_order || 0,
      metrics.ad_spend_percentage || 0
    );
  }
}

/**
 * Calculate derived metrics from Shopify and Facebook data
 * @param {object} shopifyMetrics
 * @param {object} fbMetrics
 * @returns {object}
 */
export function calculateDerivedMetrics(shopifyMetrics, fbMetrics) {
  const totalRevenue = shopifyMetrics.revenue || 0;
  const adSpend = fbMetrics.spend || 0;
  const orders = shopifyMetrics.orders || 0;

  return {
    total_revenue: totalRevenue,
    overall_roas: adSpend > 0 ? totalRevenue / adSpend : 0,
    cost_per_order: orders > 0 ? adSpend / orders : 0,
    ad_spend_percentage: totalRevenue > 0 ? (adSpend / totalRevenue) * 100 : 0
  };
}

/**
 * Sync metrics for a single client for a specific date
 * @param {number} clientId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function syncClientForDate(clientId, date) {
  const client = db.prepare(`
    SELECT
      c.id, c.name,
      fb.access_token as fb_access_token,
      fb.ad_account_id as fb_ad_account_id,
      sh.store_url as shopify_store_url,
      sh.access_token as shopify_access_token
    FROM clients c
    LEFT JOIN client_facebook_credentials fb ON c.id = fb.client_id AND fb.status = 'active'
    LEFT JOIN client_shopify_credentials sh ON c.id = sh.client_id AND sh.status = 'active'
    WHERE c.id = ?
  `).get(clientId);

  if (!client) {
    return { success: false, error: 'Cliente no encontrado' };
  }

  let shopifyMetrics = { revenue: 0, orders: 0, aov: 0, refunds: 0, netRevenue: 0 };
  let fbMetrics = { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, conversions: 0, revenue: 0, roas: 0 };

  // Fetch Shopify metrics
  if (client.shopify_store_url && client.shopify_access_token) {
    try {
      const shopify = new ShopifyIntegration(client.shopify_store_url, client.shopify_access_token);
      shopifyMetrics = await shopify.getMetrics(date, date);
      updateCredentialStatus('client_shopify_credentials', clientId, 'active');
    } catch (error) {
      console.error(`Error syncing Shopify for client ${clientId}:`, error.message);
      updateCredentialStatus('client_shopify_credentials', clientId, 'error', error.message);
    }
  }

  // Fetch Facebook Ads metrics
  if (client.fb_access_token && client.fb_ad_account_id) {
    try {
      const facebook = new FacebookAdsIntegration(client.fb_access_token, client.fb_ad_account_id);
      const fbDailyMetrics = await facebook.getMetrics(date, date);
      if (fbDailyMetrics.length > 0) {
        fbMetrics = fbDailyMetrics[0];
      }
      updateCredentialStatus('client_facebook_credentials', clientId, 'active');
    } catch (error) {
      console.error(`Error syncing Facebook for client ${clientId}:`, error.message);
      updateCredentialStatus('client_facebook_credentials', clientId, 'error', error.message);
    }
  }

  // Calculate derived metrics
  const derivedMetrics = calculateDerivedMetrics(shopifyMetrics, fbMetrics);

  // Save to database
  const metricsToSave = {
    shopify_revenue: shopifyMetrics.revenue,
    shopify_orders: shopifyMetrics.orders,
    shopify_aov: shopifyMetrics.aov,
    shopify_refunds: shopifyMetrics.refunds,
    shopify_net_revenue: shopifyMetrics.netRevenue,
    fb_spend: fbMetrics.spend,
    fb_impressions: fbMetrics.impressions,
    fb_clicks: fbMetrics.clicks,
    fb_ctr: fbMetrics.ctr,
    fb_cpc: fbMetrics.cpc,
    fb_conversions: fbMetrics.conversions,
    fb_revenue: fbMetrics.revenue,
    fb_roas: fbMetrics.roas,
    ...derivedMetrics
  };

  upsertDailyMetrics(clientId, date, metricsToSave);

  return { success: true };
}

/**
 * Sync metrics for a single client for a date range
 * @param {number} clientId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<{success: boolean, recordsProcessed: number, error?: string}>}
 */
export async function syncClientDateRange(clientId, startDate, endDate) {
  const jobId = createSyncJob(clientId, 'all');
  let recordsProcessed = 0;

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await syncClientForDate(clientId, dateStr);
      recordsProcessed++;
    }

    updateSyncJob(jobId, 'completed', recordsProcessed);
    return { success: true, recordsProcessed };
  } catch (error) {
    updateSyncJob(jobId, 'failed', recordsProcessed, error.message);
    return { success: false, recordsProcessed, error: error.message };
  }
}

/**
 * Sync all clients for a specific date (usually yesterday)
 * @param {string} date - YYYY-MM-DD (defaults to yesterday)
 * @returns {Promise<{success: boolean, clientsSynced: number, errors: Array}>}
 */
export async function syncAllClientsForDate(date = null) {
  if (!date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  }

  const clients = getClientsWithCredentials();
  let clientsSynced = 0;
  const errors = [];

  console.log(`\n🔄 Starting metrics sync for ${date} - ${clients.length} clients`);

  for (const client of clients) {
    try {
      console.log(`  Syncing client: ${client.name || client.company}`);
      const result = await syncClientForDate(client.id, date);

      if (result.success) {
        clientsSynced++;
      } else {
        errors.push({ clientId: client.id, error: result.error });
      }
    } catch (error) {
      console.error(`  Error syncing client ${client.id}:`, error.message);
      errors.push({ clientId: client.id, error: error.message });
    }
  }

  console.log(`✅ Sync completed: ${clientsSynced}/${clients.length} clients synced`);

  if (errors.length > 0) {
    console.log(`⚠️  Errors: ${errors.length}`);
  }

  return { success: true, clientsSynced, errors };
}

export default {
  getClientsWithCredentials,
  syncClientForDate,
  syncClientDateRange,
  syncAllClientsForDate
};
