import { Router } from 'express';
import db from '../config/database.js';
import { syncClientForDate, syncClientDateRange, syncAllClientsForDate } from '../services/metricsSyncService.js';

const router = Router();

// ============================================
// GET METRICS
// ============================================

/**
 * GET /api/client-metrics/:clientId
 * Get aggregated metrics for a client within a date range
 */
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
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
        AVG(fb_cpc) as avg_cpc
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
      ticket_promedio: totalOrders > 0 ? totalRevenue / totalOrders : 0
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
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date y end_date son requeridos' });
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
        ad_spend_percentage
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
        AVG(m.fb_ctr) as avg_ctr
      FROM clients c
      INNER JOIN client_daily_metrics m ON c.id = m.client_id
      WHERE m.metric_date BETWEEN ? AND ?
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `).all(start_date, end_date);

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
        ticket_promedio: totalOrders > 0 ? totalRevenue / totalOrders : 0
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
      WHERE c.status = 'active'
      ORDER BY c.name
    `).all();

    res.json(clients);
  } catch (error) {
    console.error('Error fetching client summary:', error);
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
    const { clientId } = req.params;
    const { start_date, end_date } = req.body;

    // Default to yesterday if no dates provided
    let startDate = start_date;
    let endDate = end_date;

    if (!startDate || !endDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = yesterday.toISOString().split('T')[0];
      endDate = startDate;
    }

    const result = await syncClientDateRange(parseInt(clientId), startDate, endDate);

    if (result.success) {
      res.json({
        message: `Sincronización completada: ${result.recordsProcessed} días procesados`,
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
 * Manually sync metrics for all clients (yesterday)
 */
router.post('/sync-all', async (req, res) => {
  try {
    const { date } = req.body;

    const result = await syncAllClientsForDate(date);

    res.json({
      message: `Sincronización completada: ${result.clientsSynced} clientes sincronizados`,
      clientsSynced: result.clientsSynced,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error syncing all clients:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
