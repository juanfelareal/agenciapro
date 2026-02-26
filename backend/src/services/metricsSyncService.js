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
export async function getClientsWithCredentials() {
  const systemToken = process.env.FACEBOOK_SYSTEM_USER_TOKEN;

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

  const clients = await db.prepare(query).all();

  // Use System User token as fallback when client has ad_account_id but no personal token
  if (systemToken) {
    return clients.map(c => ({
      ...c,
      fb_access_token: c.fb_access_token || (c.fb_ad_account_id ? systemToken : null)
    }));
  }

  return clients;
}

/**
 * Create a sync job record
 * @param {number} clientId
 * @param {string} jobType - 'facebook', 'shopify', or 'all'
 * @returns {number} Job ID
 */
export async function createSyncJob(clientId, jobType) {
  const result = await db.prepare(`
    INSERT INTO metrics_sync_jobs (client_id, job_type, status, started_at)
    VALUES (?, ?, 'running', NOW())
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
export async function updateSyncJob(jobId, status, recordsProcessed = 0, errorMessage = null) {
  await db.prepare(`
    UPDATE metrics_sync_jobs
    SET status = ?,
        completed_at = NOW(),
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
export async function updateCredentialStatus(table, clientId, status, error = null) {
  await db.prepare(`
    UPDATE ${table}
    SET status = ?,
        last_sync_at = NOW(),
        last_error = ?,
        updated_at = NOW()
    WHERE client_id = ?
  `).run(status, error, clientId);
}

/**
 * Upsert daily metrics for a client
 * @param {number} clientId
 * @param {string} date - YYYY-MM-DD
 * @param {object} metrics
 */
export async function upsertDailyMetrics(clientId, date, metrics) {
  const existing = await db.prepare(`
    SELECT id FROM client_daily_metrics
    WHERE client_id = ? AND metric_date = ?
  `).get(clientId, date);

  if (existing) {
    await db.prepare(`
      UPDATE client_daily_metrics
      SET shopify_revenue = ?,
          shopify_orders = ?,
          shopify_aov = ?,
          shopify_refunds = ?,
          shopify_net_revenue = ?,
          shopify_total_tax = ?,
          shopify_total_discounts = ?,
          shopify_sessions = ?,
          shopify_conversion_rate = ?,
          fb_spend = ?,
          fb_impressions = ?,
          fb_clicks = ?,
          fb_ctr = ?,
          fb_cpc = ?,
          fb_cpm = ?,
          fb_conversions = ?,
          fb_revenue = ?,
          fb_roas = ?,
          fb_cost_per_purchase = ?,
          fb_landing_page_views = ?,
          fb_cost_per_landing_page_view = ?,
          fb_video_3sec_views = ?,
          fb_video_thruplay_views = ?,
          fb_hook_rate = ?,
          fb_hold_rate = ?,
          total_revenue = ?,
          overall_roas = ?,
          cost_per_order = ?,
          ad_spend_percentage = ?,
          updated_at = NOW()
      WHERE id = ?
    `).run(
      metrics.shopify_revenue || 0,
      metrics.shopify_orders || 0,
      metrics.shopify_aov || 0,
      metrics.shopify_refunds || 0,
      metrics.shopify_net_revenue || 0,
      metrics.shopify_total_tax || 0,
      metrics.shopify_total_discounts || 0,
      metrics.shopify_sessions || 0,
      metrics.shopify_conversion_rate || 0,
      metrics.fb_spend || 0,
      metrics.fb_impressions || 0,
      metrics.fb_clicks || 0,
      metrics.fb_ctr || 0,
      metrics.fb_cpc || 0,
      metrics.fb_cpm || 0,
      metrics.fb_conversions || 0,
      metrics.fb_revenue || 0,
      metrics.fb_roas || 0,
      metrics.fb_cost_per_purchase || 0,
      metrics.fb_landing_page_views || 0,
      metrics.fb_cost_per_landing_page_view || 0,
      metrics.fb_video_3sec_views || 0,
      metrics.fb_video_thruplay_views || 0,
      metrics.fb_hook_rate || 0,
      metrics.fb_hold_rate || 0,
      metrics.total_revenue || 0,
      metrics.overall_roas || 0,
      metrics.cost_per_order || 0,
      metrics.ad_spend_percentage || 0,
      existing.id
    );
  } else {
    await db.prepare(`
      INSERT INTO client_daily_metrics (
        client_id, metric_date,
        shopify_revenue, shopify_orders, shopify_aov, shopify_refunds, shopify_net_revenue,
        shopify_total_tax, shopify_total_discounts, shopify_sessions, shopify_conversion_rate,
        fb_spend, fb_impressions, fb_clicks, fb_ctr, fb_cpc, fb_cpm,
        fb_conversions, fb_revenue, fb_roas,
        fb_cost_per_purchase, fb_landing_page_views, fb_cost_per_landing_page_view,
        fb_video_3sec_views, fb_video_thruplay_views, fb_hook_rate, fb_hold_rate,
        total_revenue, overall_roas, cost_per_order, ad_spend_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId, date,
      metrics.shopify_revenue || 0,
      metrics.shopify_orders || 0,
      metrics.shopify_aov || 0,
      metrics.shopify_refunds || 0,
      metrics.shopify_net_revenue || 0,
      metrics.shopify_total_tax || 0,
      metrics.shopify_total_discounts || 0,
      metrics.shopify_sessions || 0,
      metrics.shopify_conversion_rate || 0,
      metrics.fb_spend || 0,
      metrics.fb_impressions || 0,
      metrics.fb_clicks || 0,
      metrics.fb_ctr || 0,
      metrics.fb_cpc || 0,
      metrics.fb_cpm || 0,
      metrics.fb_conversions || 0,
      metrics.fb_revenue || 0,
      metrics.fb_roas || 0,
      metrics.fb_cost_per_purchase || 0,
      metrics.fb_landing_page_views || 0,
      metrics.fb_cost_per_landing_page_view || 0,
      metrics.fb_video_3sec_views || 0,
      metrics.fb_video_thruplay_views || 0,
      metrics.fb_hook_rate || 0,
      metrics.fb_hold_rate || 0,
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
  // Don't filter by status — we need credentials even if a previous day set status to 'error'
  const client = await db.prepare(`
    SELECT
      c.id, c.name,
      fb.access_token as fb_access_token,
      fb.ad_account_id as fb_ad_account_id,
      sh.store_url as shopify_store_url,
      sh.access_token as shopify_access_token
    FROM clients c
    LEFT JOIN client_facebook_credentials fb ON c.id = fb.client_id
    LEFT JOIN client_shopify_credentials sh ON c.id = sh.client_id
    WHERE c.id = ?
  `).get(clientId);

  if (!client) {
    return { success: false, error: 'Cliente no encontrado' };
  }

  let shopifyMetrics = { revenue: 0, orders: 0, aov: 0, refunds: 0, netRevenue: 0, totalTax: 0, totalDiscounts: 0, sessions: 0, conversionRate: 0 };
  let fbMetrics = { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, conversions: 0, revenue: 0, roas: 0, costPerPurchase: 0, costPerLandingPageView: 0, landingPageViews: 0, video3SecViews: 0, videoThruplayViews: 0, hookRate: 0, holdRate: 0 };
  let shopifyOk = false;
  let fbOk = false;
  const hasShopify = !!(client.shopify_store_url && client.shopify_access_token);
  const hasFacebook = !!(client.fb_access_token && client.fb_ad_account_id);

  // Fetch Shopify metrics
  if (hasShopify) {
    try {
      const shopify = new ShopifyIntegration(client.shopify_store_url, client.shopify_access_token);
      shopifyMetrics = await shopify.getMetrics(date, date);
      shopifyOk = true;
    } catch (error) {
      console.error(`Error syncing Shopify for client ${clientId} on ${date}:`, error.message);
    }
  }

  // Fetch Facebook Ads metrics
  if (hasFacebook) {
    try {
      const facebook = new FacebookAdsIntegration(client.fb_access_token, client.fb_ad_account_id);
      const fbDailyMetrics = await facebook.getMetrics(date, date);
      if (fbDailyMetrics.length > 0) {
        fbMetrics = fbDailyMetrics[0];
      }
      fbOk = true;
    } catch (error) {
      console.error(`Error syncing Facebook for client ${clientId} on ${date}:`, error.message);
    }
  }

  // Only save if at least one API call succeeded (avoid storing empty records from failures)
  const anyApiSucceeded = (hasShopify && shopifyOk) || (hasFacebook && fbOk) || (!hasShopify && !hasFacebook);
  if (!anyApiSucceeded) {
    return { success: false, error: `API calls failed for ${date}` };
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
    shopify_total_tax: shopifyMetrics.totalTax,
    shopify_total_discounts: shopifyMetrics.totalDiscounts,
    shopify_sessions: shopifyMetrics.sessions,
    shopify_conversion_rate: shopifyMetrics.conversionRate,
    fb_spend: fbMetrics.spend,
    fb_impressions: fbMetrics.impressions,
    fb_clicks: fbMetrics.clicks,
    fb_ctr: fbMetrics.ctr,
    fb_cpc: fbMetrics.cpc,
    fb_cpm: fbMetrics.cpm,
    fb_conversions: fbMetrics.conversions,
    fb_revenue: fbMetrics.revenue,
    fb_roas: fbMetrics.roas,
    fb_cost_per_purchase: fbMetrics.costPerPurchase,
    fb_landing_page_views: fbMetrics.landingPageViews,
    fb_cost_per_landing_page_view: fbMetrics.costPerLandingPageView,
    fb_video_3sec_views: fbMetrics.video3SecViews,
    fb_video_thruplay_views: fbMetrics.videoThruplayViews,
    fb_hook_rate: fbMetrics.hookRate,
    fb_hold_rate: fbMetrics.holdRate,
    ...derivedMetrics
  };

  await upsertDailyMetrics(clientId, date, metricsToSave);

  // Update credential status only after successful save
  if (hasShopify && shopifyOk) {
    await updateCredentialStatus('client_shopify_credentials', clientId, 'active');
  }
  if (hasFacebook && fbOk) {
    await updateCredentialStatus('client_facebook_credentials', clientId, 'active');
  }

  return { success: true };
}

/**
 * Generate array of YYYY-MM-DD strings between two dates (inclusive)
 */
function generateDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Sync metrics for a single client for a date range
 * @param {number} clientId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<{success: boolean, recordsProcessed: number, error?: string}>}
 */
export async function syncClientDateRange(clientId, startDate, endDate) {
  const jobId = await createSyncJob(clientId, 'all');
  let recordsProcessed = 0;

  try {
    const dates = generateDateRange(startDate, endDate);
    for (let i = 0; i < dates.length; i++) {
      await syncClientForDate(clientId, dates[i]);
      recordsProcessed++;
      // Rate limit: wait 600ms between API calls
      if (i < dates.length - 1) {
        await sleep(600);
      }
    }

    await updateSyncJob(jobId, 'completed', recordsProcessed);
    return { success: true, recordsProcessed };
  } catch (error) {
    await updateSyncJob(jobId, 'failed', recordsProcessed, error.message);
    return { success: false, recordsProcessed, error: error.message };
  }
}

/**
 * Get current date string in Colombia timezone (America/Bogota, UTC-5)
 * @param {number} offsetDays - Days to offset (e.g., -1 for yesterday)
 * @returns {string} YYYY-MM-DD
 */
function getColombiaDate(offsetDays = 0) {
  const now = new Date();
  const colombiaStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (offsetDays === 0) return colombiaStr;
  const d = new Date(colombiaStr + 'T12:00:00');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/**
 * Sync all clients for a specific date (used by daily cron)
 * @param {string} date - YYYY-MM-DD (defaults to yesterday in Colombia timezone)
 * @returns {Promise<{success: boolean, clientsSynced: number, errors: Array}>}
 */
export async function syncAllClientsForDate(date = null) {
  if (!date) {
    date = getColombiaDate(-1);
  }

  const clients = await getClientsWithCredentials();
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

/**
 * Sleep helper for rate limiting
 * @param {number} ms - Milliseconds to wait
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get dates that already have REAL metrics for a client in a given range.
 * Ignores records where all metrics are zero (likely from failed API calls).
 * @param {number} clientId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Set<string>} Set of YYYY-MM-DD dates that have real data
 */
async function getExistingDates(clientId, startDate, endDate) {
  const rows = await db.prepare(`
    SELECT metric_date FROM client_daily_metrics
    WHERE client_id = ? AND metric_date BETWEEN ? AND ?
      AND (shopify_revenue > 0 OR shopify_orders > 0 OR fb_spend > 0 OR fb_impressions > 0)
  `).all(clientId, startDate, endDate);

  return new Set(rows.map(r => {
    const d = r.metric_date;
    if (typeof d === 'string') return d.split('T')[0];
    return new Date(d).toISOString().split('T')[0];
  }));
}

/**
 * Sync all clients for a date range, skipping dates that already have data.
 * Defaults to last 365 days up to yesterday (Colombia timezone).
 * @param {string} startDate - YYYY-MM-DD (defaults to 365 days ago)
 * @param {string} endDate - YYYY-MM-DD (defaults to yesterday)
 * @returns {Promise<{success: boolean, clientsSynced: number, daysProcessed: number, daysSkipped: number, errors: Array}>}
 */
export async function syncAllClientsSmart(startDate = null, endDate = null) {
  if (!endDate) {
    endDate = getColombiaDate(-1);
  }
  if (!startDate) {
    startDate = getColombiaDate(-365);
  }

  const clients = await getClientsWithCredentials();
  let clientsSynced = 0;
  let totalDaysProcessed = 0;
  let totalDaysSkipped = 0;
  const errors = [];
  const allDates = generateDateRange(startDate, endDate);

  console.log(`\n🔄 Smart sync: ${startDate} → ${endDate} (${allDates.length} days) - ${clients.length} clients`);

  for (const client of clients) {
    try {
      const clientName = client.name || client.company;
      const existingDates = await getExistingDates(client.id, startDate, endDate);
      const missingDates = allDates.filter(d => !existingDates.has(d));

      if (missingDates.length === 0) {
        console.log(`  ✅ ${clientName}: all ${allDates.length} days already synced, skipping`);
        totalDaysSkipped += allDates.length;
        clientsSynced++;
        continue;
      }

      console.log(`  🔄 ${clientName}: ${missingDates.length} days to sync (${existingDates.size} already exist)`);
      totalDaysSkipped += existingDates.size;

      for (let i = 0; i < missingDates.length; i++) {
        const date = missingDates[i];
        try {
          await syncClientForDate(client.id, date);
          totalDaysProcessed++;
          // Rate limit: wait 600ms between API calls to respect Shopify/Facebook limits
          if (i < missingDates.length - 1) {
            await sleep(600);
          }
        } catch (err) {
          console.error(`    Error syncing ${clientName} for ${date}:`, err.message);
          errors.push({ clientId: client.id, date, error: err.message });
          // On rate limit errors, wait longer before continuing
          if (err.response?.status === 429) {
            console.log(`    ⏳ Rate limited, waiting 5 seconds...`);
            await sleep(5000);
          }
        }
      }

      clientsSynced++;
    } catch (error) {
      console.error(`  Error processing client ${client.id}:`, error.message);
      errors.push({ clientId: client.id, error: error.message });
    }
  }

  console.log(`✅ Smart sync completed: ${clientsSynced}/${clients.length} clients, ${totalDaysProcessed} days synced, ${totalDaysSkipped} days skipped`);

  return {
    success: true,
    clientsSynced,
    daysProcessed: totalDaysProcessed,
    daysSkipped: totalDaysSkipped,
    errors
  };
}

export default {
  getClientsWithCredentials,
  syncClientForDate,
  syncClientDateRange,
  syncAllClientsForDate,
  syncAllClientsSmart
};
