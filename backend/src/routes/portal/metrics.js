import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/metrics
 * Get metrics summary for the client
 */
router.get('/', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { start_date, end_date } = req.query;

    // Default to last 30 days
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get aggregated metrics
    const summary = await db.get(`
      SELECT
        SUM(shopify_revenue) as total_revenue,
        SUM(shopify_orders) as total_orders,
        SUM(fb_spend) as total_ad_spend,
        SUM(fb_impressions) as total_impressions,
        SUM(fb_clicks) as total_clicks,
        SUM(fb_conversions) as total_conversions,
        AVG(fb_roas) as avg_roas,
        AVG(overall_roas) as avg_overall_roas
      FROM client_daily_metrics
      WHERE client_id = ?
        AND metric_date >= ?
        AND metric_date <= ?
    `, [clientId, startDate, endDate]);

    // Get connected platforms
    const facebookAccounts = await db.all(`
      SELECT ad_account_name, status, last_sync_at
      FROM client_facebook_credentials
      WHERE client_id = ? AND status = 'active'
    `, [clientId]);

    const shopifyStore = await db.get(`
      SELECT store_url, status, last_sync_at
      FROM client_shopify_credentials
      WHERE client_id = ? AND status = 'active'
    `, [clientId]);

    res.json({
      period: { start_date: startDate, end_date: endDate },
      summary: {
        total_revenue: summary?.total_revenue || 0,
        total_orders: summary?.total_orders || 0,
        total_ad_spend: summary?.total_ad_spend || 0,
        total_impressions: summary?.total_impressions || 0,
        total_clicks: summary?.total_clicks || 0,
        total_conversions: summary?.total_conversions || 0,
        avg_roas: summary?.avg_roas || 0,
        avg_overall_roas: summary?.avg_overall_roas || 0
      },
      connected_platforms: {
        facebook: facebookAccounts,
        shopify: shopifyStore
      }
    });
  } catch (error) {
    console.error('Error getting portal metrics:', error);
    res.status(500).json({ error: 'Error al cargar métricas' });
  }
});

/**
 * GET /api/portal/metrics/daily
 * Get daily metrics breakdown
 */
router.get('/daily', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { start_date, end_date } = req.query;

    // Default to last 30 days
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const dailyMetrics = await db.all(`
      SELECT *
      FROM client_daily_metrics
      WHERE client_id = ?
        AND metric_date >= ?
        AND metric_date <= ?
      ORDER BY metric_date ASC
    `, [clientId, startDate, endDate]);

    res.json(dailyMetrics);
  } catch (error) {
    console.error('Error getting daily metrics:', error);
    res.status(500).json({ error: 'Error al cargar métricas diarias' });
  }
});

export default router;
