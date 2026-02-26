import { Router } from 'express';
import db from '../config/database.js';
import { syncClientForDate, syncClientDateRange, syncAllClientsForDate, syncAllClientsSmart } from '../services/metricsSyncService.js';
import FacebookAdsIntegration from '../integrations/facebookAds.js';

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

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
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
        SUM(shopify_total_tax) as total_tax,
        SUM(shopify_total_discounts) as total_discounts,
        SUM(shopify_sessions) as total_sessions,
        SUM(fb_video_3sec_views) as total_video_3sec_views,
        SUM(fb_video_thruplay_views) as total_video_thruplay_views,
        SUM(fb_landing_page_views) as total_landing_page_views,
        SUM(shopify_pending_orders) as total_pending_orders
      FROM client_daily_metrics
      WHERE client_id = ? AND metric_date BETWEEN ? AND ?
    `).get(clientId, start_date, end_date);

    // Calculate derived metrics
    const totalRevenue = metrics.total_revenue || 0;
    const totalAdSpend = metrics.total_ad_spend || 0;
    const totalOrders = metrics.total_orders || 0;

    const result = {
      ...metrics,
      roas: totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0,
      cost_per_order: totalOrders > 0 ? totalAdSpend / totalOrders : 0,
      ad_spend_percentage: totalRevenue > 0 ? (totalAdSpend / totalRevenue) * 100 : 0,
      ticket_promedio: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      cpm: metrics.total_impressions > 0 ? (totalAdSpend / metrics.total_impressions) * 1000 : 0,
      cost_per_purchase: metrics.total_conversions > 0 ? totalAdSpend / metrics.total_conversions : 0,
      hook_rate: metrics.total_impressions > 0 ? ((metrics.total_video_3sec_views || 0) / metrics.total_impressions) * 100 : 0,
      hold_rate: (metrics.total_video_3sec_views || 0) > 0 ? ((metrics.total_video_thruplay_views || 0) / metrics.total_video_3sec_views) * 100 : 0,
      conversion_rate: (metrics.total_sessions || 0) > 0 ? (totalOrders / metrics.total_sessions) * 100 : 0,
      total_tax: metrics.total_tax || 0,
      total_discounts: metrics.total_discounts || 0,
      total_sessions: metrics.total_sessions || 0,
      total_landing_page_views: metrics.total_landing_page_views || 0,
      total_video_3sec_views: metrics.total_video_3sec_views || 0,
      total_video_thruplay_views: metrics.total_video_thruplay_views || 0,
      total_pending_orders: metrics.total_pending_orders || 0
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
        shopify_total_tax,
        shopify_total_discounts,
        shopify_sessions,
        shopify_conversion_rate,
        shopify_pending_orders
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
        SUM(m.shopify_revenue) as total_revenue,
        SUM(m.shopify_net_revenue) as net_revenue,
        SUM(m.shopify_orders) as total_orders,
        SUM(m.fb_spend) as total_ad_spend,
        SUM(m.fb_impressions) as total_impressions,
        SUM(m.fb_clicks) as total_clicks,
        AVG(m.fb_ctr) as avg_ctr,
        SUM(m.shopify_total_tax) as total_tax,
        SUM(m.shopify_total_discounts) as total_discounts,
        SUM(m.shopify_sessions) as total_sessions,
        SUM(m.fb_video_3sec_views) as total_video_3sec_views,
        SUM(m.fb_video_thruplay_views) as total_video_thruplay_views,
        SUM(m.fb_landing_page_views) as total_landing_page_views,
        SUM(m.shopify_pending_orders) as total_pending_orders
      FROM clients c
      INNER JOIN client_daily_metrics m ON c.id = m.client_id
      WHERE m.metric_date BETWEEN ? AND ? AND c.organization_id = ?
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `).all(start_date, end_date, orgId);

    // Calculate derived metrics for each client
    const result = metrics.map(client => {
      const totalRevenue = client.total_revenue || 0;
      const totalAdSpend = client.total_ad_spend || 0;
      const totalOrders = client.total_orders || 0;

      return {
        ...client,
        roas: totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0,
        cost_per_order: totalOrders > 0 ? totalAdSpend / totalOrders : 0,
        ad_spend_percentage: totalRevenue > 0 ? (totalAdSpend / totalRevenue) * 100 : 0,
        ticket_promedio: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        cpm: totalAdSpend > 0 && client.total_impressions > 0 ? (totalAdSpend / client.total_impressions) * 1000 : 0,
        cost_per_purchase: client.total_conversions > 0 ? totalAdSpend / (client.total_conversions || 1) : 0,
        total_tax: client.total_tax || 0,
        total_discounts: client.total_discounts || 0,
        total_sessions: client.total_sessions || 0
      };
    });

    // Calculate totals
    const totals = result.reduce((acc, client) => ({
      total_revenue: acc.total_revenue + (client.total_revenue || 0),
      net_revenue: acc.net_revenue + (client.net_revenue || 0),
      total_orders: acc.total_orders + (client.total_orders || 0),
      total_ad_spend: acc.total_ad_spend + (client.total_ad_spend || 0),
      total_impressions: acc.total_impressions + (client.total_impressions || 0),
      total_clicks: acc.total_clicks + (client.total_clicks || 0)
    }), {
      total_revenue: 0,
      net_revenue: 0,
      total_orders: 0,
      total_ad_spend: 0,
      total_impressions: 0,
      total_clicks: 0
    });

    totals.roas = totals.total_ad_spend > 0 ? totals.total_revenue / totals.total_ad_spend : 0;
    totals.avg_ctr = totals.total_impressions > 0 ? (totals.total_clicks / totals.total_impressions) * 100 : 0;

    res.json({ clients: result, totals });
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
        sh.status as shopify_status,
        sh.last_sync_at as shopify_last_sync
      FROM clients c
      LEFT JOIN client_facebook_credentials fb ON c.id = fb.client_id
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

    res.json({ ads });
  } catch (error) {
    console.error('Error fetching ad-level insights:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYNC METRICS
// ============================================

/**
 * POST /api/client-metrics/sync/:clientId
 * Manually sync metrics for a single client
 */
router.post('/sync/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;
    const { start_date, end_date } = req.body;

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Default to yesterday (Colombia timezone) if no dates provided
    let startDate = start_date;
    let endDate = end_date;

    if (!startDate || !endDate) {
      startDate = getColombiaDate(-1);
      endDate = startDate;
    }

    const result = await syncClientDateRange(parseInt(clientId), startDate, endDate);

    if (result.success) {
      res.json({
        message: `Sincronizacion completada: ${result.recordsProcessed} dias procesados`,
        recordsProcessed: result.recordsProcessed
      });
    } else {
      res.status(500).json({ error: result.error });
    }
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
