import { Router } from 'express';
import db from '../config/database.js';
import { syncClientForDate, syncClientDateRange, syncAllClientsForDate, syncAllClientsSmart } from '../services/metricsSyncService.js';
import FacebookAdsIntegration from '../integrations/facebookAds.js';
import GoogleAdsIntegration from '../integrations/googleAds.js';
import TikTokAdsIntegration from '../integrations/tiktokAds.js';
import ShopifyIntegration from '../integrations/shopify.js';

const router = Router();

/**
 * Get current date string in Colombia timezone (America/Bogota, UTC-5)
 */
function getColombiaDate(offsetDays = 0) {
  const now = new Date();
  const colombiaStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (offsetDays === 0) return colombiaStr;
  const d = new Date(colombiaStr + 'T12:00:00');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ============================================
// GET METRICS
// ============================================

/**
 * GET /api/client-metrics/:clientId
 * Get aggregated metrics for a client within a date range
 */
router.get('/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    // Verify client belongs to org and get revenue metric setting
    const client = await db.prepare(`
      SELECT c.id, COALESCE(ps.portal_revenue_metric, 'total') as portal_revenue_metric
      FROM clients c
      LEFT JOIN client_portal_settings ps ON ps.client_id = c.id
      WHERE c.id = ? AND c.organization_id = ?
    `).get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const metrics = await db.prepare(`
      SELECT
        SUM(shopify_revenue) as total_revenue,
        SUM(shopify_net_revenue) as net_revenue,
        SUM(shopify_orders) as total_orders,
        AVG(shopify_aov) as avg_aov,
        SUM(shopify_refunds) as total_refunds,
        SUM(fb_spend) as total_ad_spend,
        SUM(fb_impressions) as total_impressions,
        SUM(fb_clicks) as total_clicks,
        SUM(fb_conversions) as total_conversions,
        AVG(fb_ctr) as avg_ctr,
        AVG(fb_cpc) as avg_cpc,
        SUM(ga_spend) as total_google_spend,
        SUM(ga_impressions) as total_google_impressions,
        SUM(ga_clicks) as total_google_clicks,
        SUM(ga_conversions) as total_google_conversions,
        SUM(ga_revenue) as total_google_revenue,
        SUM(tt_spend) as total_tiktok_spend,
        SUM(tt_impressions) as total_tiktok_impressions,
        SUM(tt_clicks) as total_tiktok_clicks,
        SUM(tt_conversions) as total_tiktok_conversions,
        SUM(tt_revenue) as total_tiktok_revenue,
        SUM(shopify_total_tax) as total_tax,
        SUM(shopify_total_discounts) as total_discounts,
        SUM(shopify_sessions) as total_sessions,
        SUM(fb_video_3sec_views) as total_video_3sec_views,
        SUM(fb_video_thruplay_views) as total_video_thruplay_views,
        SUM(fb_landing_page_views) as total_landing_page_views,
        SUM(shopify_pending_orders) as total_pending_orders,
        SUM(COALESCE(shopify_all_orders_revenue, 0)) as total_all_orders_revenue,
        SUM(COALESCE(shopify_all_orders_count, 0)) as total_all_orders_count
      FROM client_daily_metrics
      WHERE client_id = ? AND metric_date BETWEEN ? AND ?
    `).get(clientId, start_date, end_date);

    // Calculate derived metrics
    // Note: PostgreSQL SUM() returns BIGINT which pg driver sends as string — must parseFloat
    const totalRevenue = parseFloat(metrics.total_revenue) || 0;
    const netRevenue = parseFloat(metrics.net_revenue) || 0;
    const allOrdersRevenue = parseFloat(metrics.total_all_orders_revenue) || 0;
    const totalFbSpend = parseFloat(metrics.total_ad_spend) || 0;
    const totalGoogleSpend = parseFloat(metrics.total_google_spend) || 0;
    const totalTiktokSpend = parseFloat(metrics.total_tiktok_spend) || 0;
    // Blended ad spend across Meta + Google + TikTok — used for overall ROAS, cost/order, % inversión
    const totalAdSpend = totalFbSpend + totalGoogleSpend + totalTiktokSpend;
    const totalOrders = parseFloat(metrics.total_orders) || 0;
    const totalImpressions = parseFloat(metrics.total_impressions) || 0;
    const totalConversions = parseFloat(metrics.total_conversions) || 0;
    const totalGoogleImpressions = parseFloat(metrics.total_google_impressions) || 0;
    const totalGoogleClicks = parseFloat(metrics.total_google_clicks) || 0;
    const totalGoogleConversions = parseFloat(metrics.total_google_conversions) || 0;
    const totalGoogleRevenue = parseFloat(metrics.total_google_revenue) || 0;
    const totalTiktokImpressions = parseFloat(metrics.total_tiktok_impressions) || 0;
    const totalTiktokClicks = parseFloat(metrics.total_tiktok_clicks) || 0;
    const totalTiktokConversions = parseFloat(metrics.total_tiktok_conversions) || 0;
    const totalTiktokRevenue = parseFloat(metrics.total_tiktok_revenue) || 0;
    const totalVideo3sec = parseFloat(metrics.total_video_3sec_views) || 0;
    const totalVideoThruplay = parseFloat(metrics.total_video_thruplay_views) || 0;
    const totalSessions = parseFloat(metrics.total_sessions) || 0;

    // Pick revenue based on the client's portal_revenue_metric setting
    let displayRevenue = allOrdersRevenue || totalRevenue; // default 'total'
    if (client.portal_revenue_metric === 'confirmed') displayRevenue = totalRevenue;
    else if (client.portal_revenue_metric === 'net_confirmed') displayRevenue = netRevenue;

    const result = {
      ...metrics,
      total_revenue: totalRevenue,
      net_revenue: netRevenue,
      total_ad_spend: totalAdSpend,
      total_fb_spend: totalFbSpend,
      total_google_spend: totalGoogleSpend,
      total_tiktok_spend: totalTiktokSpend,
      total_orders: totalOrders,
      total_impressions: totalImpressions,
      total_conversions: totalConversions,
      portal_revenue_metric: client.portal_revenue_metric,
      display_revenue: displayRevenue,
      roas: totalAdSpend > 0 ? displayRevenue / totalAdSpend : 0,
      cost_per_order: totalOrders > 0 ? totalAdSpend / totalOrders : 0,
      ad_spend_percentage: displayRevenue > 0 ? (totalAdSpend / displayRevenue) * 100 : 0,
      ticket_promedio: totalOrders > 0 ? displayRevenue / totalOrders : 0,
      cpm: totalFbSpend > 0 && totalImpressions > 0 ? (totalFbSpend / totalImpressions) * 1000 : 0,
      cost_per_purchase: totalConversions > 0 ? totalFbSpend / totalConversions : 0,
      // Google Ads breakdown
      google: {
        spend: totalGoogleSpend,
        impressions: totalGoogleImpressions,
        clicks: totalGoogleClicks,
        conversions: totalGoogleConversions,
        revenue: totalGoogleRevenue,
        ctr: totalGoogleImpressions > 0 ? (totalGoogleClicks / totalGoogleImpressions) * 100 : 0,
        cpc: totalGoogleClicks > 0 ? totalGoogleSpend / totalGoogleClicks : 0,
        cpm: totalGoogleImpressions > 0 ? (totalGoogleSpend / totalGoogleImpressions) * 1000 : 0,
        roas: totalGoogleSpend > 0 ? totalGoogleRevenue / totalGoogleSpend : 0,
        cost_per_conversion: totalGoogleConversions > 0 ? totalGoogleSpend / totalGoogleConversions : 0,
      },
      // TikTok Ads breakdown
      tiktok: {
        spend: totalTiktokSpend,
        impressions: totalTiktokImpressions,
        clicks: totalTiktokClicks,
        conversions: totalTiktokConversions,
        revenue: totalTiktokRevenue,
        ctr: totalTiktokImpressions > 0 ? (totalTiktokClicks / totalTiktokImpressions) * 100 : 0,
        cpc: totalTiktokClicks > 0 ? totalTiktokSpend / totalTiktokClicks : 0,
        cpm: totalTiktokImpressions > 0 ? (totalTiktokSpend / totalTiktokImpressions) * 1000 : 0,
        roas: totalTiktokSpend > 0 ? totalTiktokRevenue / totalTiktokSpend : 0,
        cost_per_conversion: totalTiktokConversions > 0 ? totalTiktokSpend / totalTiktokConversions : 0,
      },
      hook_rate: totalImpressions > 0 ? (totalVideo3sec / totalImpressions) * 100 : 0,
      hold_rate: totalVideo3sec > 0 ? (totalVideoThruplay / totalVideo3sec) * 100 : 0,
      conversion_rate: totalSessions > 0 ? (totalOrders / totalSessions) * 100 : 0,
      total_tax: parseFloat(metrics.total_tax) || 0,
      total_discounts: parseFloat(metrics.total_discounts) || 0,
      total_sessions: totalSessions,
      total_landing_page_views: parseFloat(metrics.total_landing_page_views) || 0,
      total_video_3sec_views: totalVideo3sec,
      total_video_thruplay_views: totalVideoThruplay,
      total_pending_orders: parseFloat(metrics.total_pending_orders) || 0,
      total_all_orders_revenue: parseFloat(metrics.total_all_orders_revenue) || 0,
      total_all_orders_count: parseFloat(metrics.total_all_orders_count) || 0
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching client metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/:clientId/daily
 * Get daily metrics breakdown for a client
 */
router.get('/:clientId/daily', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const metrics = await db.prepare(`
      SELECT
        metric_date,
        shopify_revenue,
        shopify_net_revenue,
        shopify_orders,
        shopify_aov,
        shopify_refunds,
        fb_spend,
        fb_impressions,
        fb_clicks,
        fb_ctr,
        fb_cpc,
        fb_conversions,
        fb_roas,
        total_revenue,
        overall_roas,
        cost_per_order,
        ad_spend_percentage,
        fb_cpm,
        fb_cost_per_purchase,
        fb_landing_page_views,
        fb_cost_per_landing_page_view,
        fb_video_3sec_views,
        fb_video_thruplay_views,
        fb_hook_rate,
        fb_hold_rate,
        fb_messaging_conversations,
        fb_cost_per_messaging_conversation,
        ga_spend,
        ga_impressions,
        ga_clicks,
        ga_ctr,
        ga_cpc,
        ga_cpm,
        ga_conversions,
        ga_revenue,
        ga_roas,
        ga_cost_per_conversion,
        tt_spend,
        tt_impressions,
        tt_clicks,
        tt_ctr,
        tt_cpc,
        tt_cpm,
        tt_conversions,
        tt_revenue,
        tt_roas,
        tt_cost_per_conversion,
        shopify_total_tax,
        shopify_total_discounts,
        shopify_sessions,
        shopify_conversion_rate,
        shopify_pending_orders,
        shopify_all_orders_revenue,
        shopify_all_orders_count
      FROM client_daily_metrics
      WHERE client_id = ? AND metric_date BETWEEN ? AND ?
      ORDER BY metric_date DESC
    `).all(clientId, start_date, end_date);

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching daily metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/aggregate
 * Get aggregated metrics for all clients
 */
router.get('/aggregate/all', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    const metrics = await db.prepare(`
      SELECT
        c.id as client_id,
        c.name as client_name,
        c.company,
        c.nickname,
        c.service_type,
        COALESCE(c.is_hidden_from_metrics, 0) as is_hidden_from_metrics,
        COALESCE(ps.portal_revenue_metric, 'total') as portal_revenue_metric,
        SUM(m.shopify_revenue) as total_revenue,
        SUM(m.shopify_net_revenue) as net_revenue,
        SUM(m.shopify_orders) as total_orders,
        SUM(m.fb_spend) as total_fb_spend,
        SUM(m.ga_spend) as total_google_spend,
        SUM(m.tt_spend) as total_tiktok_spend,
        SUM(m.fb_spend + COALESCE(m.ga_spend, 0) + COALESCE(m.tt_spend, 0)) as total_ad_spend,
        SUM(m.fb_impressions) as total_impressions,
        SUM(m.fb_clicks) as total_clicks,
        AVG(m.fb_ctr) as avg_ctr,
        SUM(m.shopify_total_tax) as total_tax,
        SUM(m.shopify_total_discounts) as total_discounts,
        SUM(m.shopify_sessions) as total_sessions,
        SUM(m.fb_video_3sec_views) as total_video_3sec_views,
        SUM(m.fb_video_thruplay_views) as total_video_thruplay_views,
        SUM(m.fb_landing_page_views) as total_landing_page_views,
        SUM(m.shopify_pending_orders) as total_pending_orders,
        SUM(COALESCE(m.shopify_all_orders_revenue, 0)) as total_all_orders_revenue,
        SUM(COALESCE(m.shopify_all_orders_count, 0)) as total_all_orders_count
      FROM clients c
      INNER JOIN client_daily_metrics m ON c.id = m.client_id
      LEFT JOIN client_portal_settings ps ON c.id = ps.client_id
      WHERE m.metric_date BETWEEN ? AND ? AND c.organization_id = ?
      GROUP BY c.id, ps.portal_revenue_metric
      ORDER BY total_revenue DESC
    `).all(start_date, end_date, orgId);

    // Calculate derived metrics for each client
    // Note: PostgreSQL SUM() returns BIGINT which pg driver sends as string — must parseFloat
    const result = metrics.map(client => {
      const totalRevenue = parseFloat(client.total_revenue) || 0;
      const totalAdSpend = parseFloat(client.total_ad_spend) || 0;
      const totalFbSpend = parseFloat(client.total_fb_spend) || 0;
      const totalGoogleSpend = parseFloat(client.total_google_spend) || 0;
      const totalTiktokSpend = parseFloat(client.total_tiktok_spend) || 0;
      const totalOrders = parseFloat(client.total_orders) || 0;
      const totalImpressions = parseFloat(client.total_impressions) || 0;
      const totalClicks = parseFloat(client.total_clicks) || 0;
      const totalConversions = parseFloat(client.total_conversions) || 0;

      const netRevenue = parseFloat(client.net_revenue) || 0;
      const allOrdersRevenue = parseFloat(client.total_all_orders_revenue) || 0;

      // Pick the display revenue based on the client's portal_revenue_metric setting
      let displayRevenue = totalRevenue;
      if (client.portal_revenue_metric === 'confirmed') displayRevenue = totalRevenue;
      else if (client.portal_revenue_metric === 'net_confirmed') displayRevenue = netRevenue;
      else displayRevenue = allOrdersRevenue || totalRevenue; // 'total' = all orders

      return {
        ...client,
        total_revenue: totalRevenue,
        net_revenue: netRevenue,
        total_all_orders_revenue: allOrdersRevenue,
        display_revenue: displayRevenue,
        portal_revenue_metric: client.portal_revenue_metric || 'total',
        total_ad_spend: totalAdSpend,
        total_fb_spend: totalFbSpend,
        total_google_spend: totalGoogleSpend,
        total_tiktok_spend: totalTiktokSpend,
        total_orders: totalOrders,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        roas: totalAdSpend > 0 ? displayRevenue / totalAdSpend : 0,
        cost_per_order: totalOrders > 0 ? totalAdSpend / totalOrders : 0,
        ad_spend_percentage: displayRevenue > 0 ? (totalAdSpend / displayRevenue) * 100 : 0,
        ticket_promedio: totalOrders > 0 ? displayRevenue / totalOrders : 0,
        cpm: totalFbSpend > 0 && totalImpressions > 0 ? (totalFbSpend / totalImpressions) * 1000 : 0,
        cost_per_purchase: totalConversions > 0 ? totalFbSpend / totalConversions : 0,
        total_tax: parseFloat(client.total_tax) || 0,
        total_discounts: parseFloat(client.total_discounts) || 0,
        total_sessions: parseFloat(client.total_sessions) || 0
      };
    });

    // Calculate totals
    const totals = result.reduce((acc, client) => ({
      total_revenue: acc.total_revenue + (client.total_revenue || 0),
      net_revenue: acc.net_revenue + (client.net_revenue || 0),
      display_revenue: acc.display_revenue + (client.display_revenue || 0),
      total_orders: acc.total_orders + (client.total_orders || 0),
      total_ad_spend: acc.total_ad_spend + (client.total_ad_spend || 0),
      total_impressions: acc.total_impressions + (client.total_impressions || 0),
      total_clicks: acc.total_clicks + (client.total_clicks || 0)
    }), {
      total_revenue: 0,
      net_revenue: 0,
      display_revenue: 0,
      total_orders: 0,
      total_ad_spend: 0,
      total_impressions: 0,
      total_clicks: 0
    });

    totals.roas = totals.total_ad_spend > 0 ? totals.display_revenue / totals.total_ad_spend : 0;
    totals.avg_ctr = totals.total_impressions > 0 ? (totals.total_clicks / totals.total_impressions) * 100 : 0;

    // Most recent successful sync across this org (FB or Shopify credentials)
    let last_sync_at = null;
    try {
      const lastSyncRow = await db.prepare(`
        SELECT MAX(last_sync_at) AS last_sync_at FROM (
          SELECT fc.last_sync_at
          FROM client_facebook_credentials fc
          JOIN clients c ON c.id = fc.client_id
          WHERE c.organization_id = ? AND fc.last_sync_at IS NOT NULL
          UNION ALL
          SELECT gc.last_sync_at
          FROM client_google_ads_credentials gc
          JOIN clients c ON c.id = gc.client_id
          WHERE c.organization_id = ? AND gc.last_sync_at IS NOT NULL
          UNION ALL
          SELECT tc.last_sync_at
          FROM client_tiktok_credentials tc
          JOIN clients c ON c.id = tc.client_id
          WHERE c.organization_id = ? AND tc.last_sync_at IS NOT NULL
          UNION ALL
          SELECT sc.last_sync_at
          FROM client_shopify_credentials sc
          JOIN clients c ON c.id = sc.client_id
          WHERE c.organization_id = ? AND sc.last_sync_at IS NOT NULL
        ) t
      `).get(orgId, orgId, orgId, orgId);
      last_sync_at = lastSyncRow?.last_sync_at || null;
    } catch (e) {
      // If anything fails here we still return the metrics — last_sync_at is just informative
      console.warn('Could not fetch last_sync_at:', e.message);
    }

    res.json({ clients: result, totals, last_sync_at });
  } catch (error) {
    console.error('Error fetching aggregate metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/summary
 * Get summary of all clients with platform connection status
 */
router.get('/summary/all', async (req, res) => {
  try {
    const orgId = req.orgId;
    const clients = await db.prepare(`
      SELECT
        c.id,
        c.name,
        c.company,
        c.status as client_status,
        fb.status as fb_status,
        fb.last_sync_at as fb_last_sync,
        ga.status as google_status,
        ga.last_sync_at as google_last_sync,
        tt.status as tiktok_status,
        tt.last_sync_at as tiktok_last_sync,
        sh.status as shopify_status,
        sh.last_sync_at as shopify_last_sync
      FROM clients c
      LEFT JOIN client_facebook_credentials fb ON c.id = fb.client_id
      LEFT JOIN client_google_ads_credentials ga ON c.id = ga.client_id
      LEFT JOIN client_tiktok_credentials tt ON c.id = tt.client_id
      LEFT JOIN client_shopify_credentials sh ON c.id = sh.client_id
      WHERE c.status = 'active' AND c.organization_id = ?
      ORDER BY c.name
    `).all(orgId);

    res.json(clients);
  } catch (error) {
    console.error('Error fetching client summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/:clientId/ads
 * Get ad-level insights (on-demand from Facebook API)
 */
router.get('/:clientId/ads', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get Facebook credentials
    const fbCred = await db.prepare(
      'SELECT access_token, ad_account_id FROM client_facebook_credentials WHERE client_id = ?'
    ).get(clientId);

    if (!fbCred || !fbCred.ad_account_id) {
      return res.json({ ads: [], message: 'Sin conexión Facebook' });
    }

    const accessToken = fbCred.access_token || process.env.FACEBOOK_SYSTEM_USER_TOKEN;
    if (!accessToken) {
      return res.json({ ads: [], message: 'Sin token de acceso Facebook' });
    }

    const fb = new FacebookAdsIntegration(accessToken, fbCred.ad_account_id);
    const ads = await fb.getAdLevelInsights(start_date, end_date);

    // Merge persisted tags into ads
    if (ads.length > 0) {
      const adIds = ads.map(a => a.ad_id);
      const placeholders = adIds.map((_, i) => `$${i + 1}`).join(',');
      const tagRows = await db.prepare(`
        SELECT ata.ad_id, atv.id as value_id, atv.name as value_name, atv.color as value_color,
               atc.id as category_id, atc.name as category_name, atc.color as category_color
        FROM ad_tag_assignments ata
        JOIN ad_tag_values atv ON ata.tag_value_id = atv.id
        JOIN ad_tag_categories atc ON atv.category_id = atc.id
        WHERE ata.ad_id IN (${placeholders}) AND ata.organization_id = $${adIds.length + 1}
      `).all(...adIds, orgId);

      const tagsByAd = {};
      for (const row of tagRows) {
        if (!tagsByAd[row.ad_id]) tagsByAd[row.ad_id] = [];
        tagsByAd[row.ad_id].push({
          category_id: row.category_id,
          category_name: row.category_name,
          category_color: row.category_color,
          value_id: row.value_id,
          value_name: row.value_name,
          value_color: row.value_color
        });
      }

      for (const ad of ads) {
        ad.tags = tagsByAd[ad.ad_id] || [];
      }
    }

    res.json({ ads });
  } catch (error) {
    console.error('Error fetching ad-level insights:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/:clientId/google-campaigns
 * Get Google Ads campaign-level insights (on-demand from Google Ads API)
 */
router.get('/:clientId/google-campaigns', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const gaCred = await db.prepare(
      'SELECT refresh_token, customer_id, login_customer_id FROM client_google_ads_credentials WHERE client_id = ?'
    ).get(clientId);

    if (!gaCred || !gaCred.customer_id) {
      return res.json({ campaigns: [], message: 'Sin conexión Google Ads' });
    }

    const refreshToken = gaCred.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN;
    if (!refreshToken) {
      return res.json({ campaigns: [], message: 'Sin token de acceso Google Ads' });
    }

    const google = new GoogleAdsIntegration(refreshToken, gaCred.customer_id, gaCred.login_customer_id);
    const campaigns = await google.getCampaignInsights(start_date, end_date);

    res.json({ campaigns });
  } catch (error) {
    console.error('Error fetching Google Ads campaigns:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/:clientId/tiktok-campaigns
 * Get TikTok Ads campaign-level insights (on-demand from TikTok API)
 */
router.get('/:clientId/tiktok-campaigns', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const ttCred = await db.prepare(
      'SELECT access_token, advertiser_id FROM client_tiktok_credentials WHERE client_id = ?'
    ).get(clientId);

    if (!ttCred || !ttCred.advertiser_id) {
      return res.json({ campaigns: [], message: 'Sin conexión TikTok' });
    }

    const accessToken = ttCred.access_token || process.env.TIKTOK_SYSTEM_ACCESS_TOKEN;
    if (!accessToken) {
      return res.json({ campaigns: [], message: 'Sin token de acceso TikTok' });
    }

    const tiktok = new TikTokAdsIntegration(accessToken, ttCred.advertiser_id);
    const campaigns = await tiktok.getCampaignInsights(start_date, end_date);

    res.json({ campaigns });
  } catch (error) {
    console.error('Error fetching TikTok campaigns:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/:clientId/top-products
 * Get top selling products from Shopify (on-demand)
 */
router.get('/:clientId/top-products', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get Shopify credentials
    const shopifyCred = await db.prepare(
      'SELECT store_url, access_token FROM client_shopify_credentials WHERE client_id = ? AND status = ?'
    ).get(clientId, 'active');

    if (!shopifyCred || !shopifyCred.store_url || !shopifyCred.access_token) {
      return res.json({ products: [], message: 'Sin conexión Shopify' });
    }

    const shopify = new ShopifyIntegration(shopifyCred.store_url, shopifyCred.access_token);
    const products = await shopify.getTopProducts(start_date, end_date, 10);

    res.json({ products });
  } catch (error) {
    console.error('Error fetching top products:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar productos' });
  }
});

// ============================================
// SYNC METRICS
// ============================================

/**
 * POST /api/client-metrics/sync/:clientId
 * Manually sync metrics for a single client.
 * If client has no existing data, auto-expands to full previous year + current year (runs in background).
 */
router.post('/sync/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Always sync last 365 days when manually triggered
    const endDate = getColombiaDate(0);
    const d = new Date(endDate + 'T12:00:00');
    d.setDate(d.getDate() - 364);
    const startDate = d.toISOString().split('T')[0];

    // Calculate approximate days
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1;

    // Always run in background (365 days is a large sync)
    res.json({
      message: `Sincronización de ${days} días iniciada en segundo plano.`,
      status: 'running',
      background: true,
      days
    });

    syncClientDateRange(parseInt(clientId), startDate, endDate)
      .then(result => {
        console.log(`✅ Client ${clientId} sync done: ${result.recordsProcessed} days processed`);
      })
      .catch(err => {
        console.error(`❌ Client ${clientId} sync failed:`, err.message);
      });
  } catch (error) {
    console.error('Error syncing client metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/client-metrics/sync-all
 * Smart sync: last 365 days for all clients, skipping dates that already have data.
 * Runs in background — returns immediately so the HTTP request doesn't timeout.
 */
router.post('/sync-all', async (req, res) => {
  try {
    const { start_date, end_date } = req.body;

    // Return immediately — sync runs in background
    res.json({
      message: 'Sincronización iniciada en segundo plano. Los datos se irán actualizando progresivamente.',
      status: 'running'
    });

    // Run sync in background (not awaited)
    syncAllClientsSmart(start_date, end_date)
      .then(result => {
        console.log(`✅ Background sync done: ${result.daysProcessed} days synced, ${result.daysSkipped} skipped, ${result.errors.length} errors`);
      })
      .catch(err => {
        console.error('❌ Background sync failed:', err.message);
      });
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/client-metrics/sync-status
 * Check how many days have been synced for a client (to track progress)
 */
router.get('/sync-status', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
    }

    const result = await db.prepare(`
      SELECT
        c.id as client_id,
        c.name,
        c.company,
        COUNT(m.id) as days_synced
      FROM clients c
      LEFT JOIN client_daily_metrics m ON c.id = m.client_id
        AND m.metric_date BETWEEN ? AND ?
      WHERE c.organization_id = ? AND c.status = 'active'
      GROUP BY c.id
    `).all(start_date, end_date, orgId);

    res.json(result);
  } catch (error) {
    console.error('Error checking sync status:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
