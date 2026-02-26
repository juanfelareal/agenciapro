import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';
import FacebookAdsIntegration from '../../integrations/facebookAds.js';
import ShopifyIntegration from '../../integrations/shopify.js';

const router = express.Router();

/**
 * Helper: Convert range shorthand ('7d','30d','90d') to start_date/end_date
 * Also returns the previous period for comparison
 */
function resolveRange(query) {
  const { range, start_date, end_date, compare_mode, compare_start, compare_end } = query;

  const endDate = end_date || new Date().toISOString().split('T')[0];
  let startDate = start_date;

  if (!startDate && range) {
    const days = parseInt(range) || 30;
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  } else if (!startDate) {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  // No comparison
  if (compare_mode === 'none') {
    return { startDate, endDate, prevStart: null, prevEnd: null };
  }

  // Custom comparison dates
  if (compare_start && compare_end) {
    return { startDate, endDate, prevStart: compare_start, prevEnd: compare_end };
  }

  // Default: previous period (same duration, shifted back)
  const msStart = new Date(startDate).getTime();
  const msEnd = new Date(endDate).getTime();
  const duration = msEnd - msStart;
  const prevEnd = new Date(msStart - 1).toISOString().split('T')[0]; // day before current start
  const prevStart = new Date(msStart - duration - 86400000).toISOString().split('T')[0];

  return { startDate, endDate, prevStart, prevEnd };
}

/**
 * Helper: Calculate percentage change
 */
function calcChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * GET /api/portal/metrics
 * Get metrics summary for the client — restructured with _change fields
 */
router.get('/', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate, prevStart, prevEnd } = resolveRange(req.query);

    // Current period aggregated metrics
    const current = await db.get(`
      SELECT
        COALESCE(SUM(shopify_revenue), 0) as total_revenue,
        COALESCE(SUM(shopify_orders), 0) as total_orders,
        COALESCE(SUM(fb_spend), 0) as total_ad_spend,
        COALESCE(SUM(fb_impressions), 0) as total_impressions,
        COALESCE(SUM(fb_clicks), 0) as total_clicks,
        COALESCE(SUM(fb_conversions), 0) as total_conversions,
        AVG(fb_roas) as avg_roas,
        AVG(overall_roas) as avg_overall_roas,
        COALESCE(SUM(shopify_customers), 0) as total_customers,
        COALESCE(SUM(fb_video_3sec_views), 0) as total_video_3sec_views,
        COALESCE(SUM(fb_video_thruplay_views), 0) as total_video_thruplay_views,
        COALESCE(SUM(fb_landing_page_views), 0) as total_landing_page_views,
        COALESCE(SUM(shopify_total_tax), 0) as total_tax,
        COALESCE(SUM(shopify_total_discounts), 0) as total_discounts,
        COALESCE(SUM(shopify_sessions), 0) as total_sessions,
        COALESCE(SUM(shopify_pending_orders), 0) as total_pending_orders
      FROM client_daily_metrics
      WHERE client_id = ?
        AND metric_date >= ?
        AND metric_date <= ?
    `, [clientId, startDate, endDate]);

    // Previous period aggregated metrics (skip when no comparison)
    const previous = prevStart ? await db.get(`
      SELECT
        COALESCE(SUM(shopify_revenue), 0) as total_revenue,
        COALESCE(SUM(shopify_orders), 0) as total_orders,
        COALESCE(SUM(fb_spend), 0) as total_ad_spend,
        COALESCE(SUM(fb_impressions), 0) as total_impressions,
        COALESCE(SUM(fb_clicks), 0) as total_clicks,
        COALESCE(SUM(fb_conversions), 0) as total_conversions,
        AVG(fb_roas) as avg_roas,
        COALESCE(SUM(shopify_customers), 0) as total_customers,
        COALESCE(SUM(fb_video_3sec_views), 0) as total_video_3sec_views,
        COALESCE(SUM(fb_video_thruplay_views), 0) as total_video_thruplay_views,
        COALESCE(SUM(fb_landing_page_views), 0) as total_landing_page_views,
        COALESCE(SUM(shopify_total_tax), 0) as total_tax,
        COALESCE(SUM(shopify_total_discounts), 0) as total_discounts,
        COALESCE(SUM(shopify_sessions), 0) as total_sessions,
        COALESCE(SUM(shopify_pending_orders), 0) as total_pending_orders
      FROM client_daily_metrics
      WHERE client_id = ?
        AND metric_date >= ?
        AND metric_date <= ?
    `, [clientId, prevStart, prevEnd]) : null;

    // Derived metrics
    const fbSpend = current?.total_ad_spend || 0;
    const fbConversions = current?.total_conversions || 0;
    const fbClicks = current?.total_clicks || 0;
    const fbImpressions = current?.total_impressions || 0;
    const cpa = fbConversions > 0 ? fbSpend / fbConversions : 0;
    const ctr = fbImpressions > 0 ? (fbClicks / fbImpressions) * 100 : 0;
    const roas = current?.avg_roas || 0;
    const revenue = current?.total_revenue || 0;
    const orders = current?.total_orders || 0;
    const aov = orders > 0 ? revenue / orders : 0;
    const customers = current?.total_customers || 0;
    const landingPageViews = current?.total_landing_page_views || 0;
    const video3sec = current?.total_video_3sec_views || 0;
    const thruplay = current?.total_video_thruplay_views || 0;
    const totalTax = current?.total_tax || 0;
    const totalDiscounts = current?.total_discounts || 0;
    const sessions = current?.total_sessions || 0;
    const cpm = fbImpressions > 0 ? (fbSpend / fbImpressions) * 1000 : 0;
    const costPerPurchase = fbConversions > 0 ? fbSpend / fbConversions : 0;
    const costPerLPV = landingPageViews > 0 ? fbSpend / landingPageViews : 0;
    const hookRate = fbImpressions > 0 ? (video3sec / fbImpressions) * 100 : 0;
    const holdRate = video3sec > 0 ? (thruplay / video3sec) * 100 : 0;
    const conversionRate = sessions > 0 ? (orders / sessions) * 100 : 0;
    const pendingOrders = current?.total_pending_orders || 0;

    // Previous derived
    const prevSpend = previous?.total_ad_spend || 0;
    const prevConversions = previous?.total_conversions || 0;
    const prevClicks = previous?.total_clicks || 0;
    const prevImpressions = previous?.total_impressions || 0;
    const prevCpa = prevConversions > 0 ? prevSpend / prevConversions : 0;
    const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
    const prevRoas = previous?.avg_roas || 0;
    const prevRevenue = previous?.total_revenue || 0;
    const prevOrders = previous?.total_orders || 0;
    const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;
    const prevCustomers = previous?.total_customers || 0;
    const prevLandingPageViews = previous?.total_landing_page_views || 0;
    const prevVideo3sec = previous?.total_video_3sec_views || 0;
    const prevThruplay = previous?.total_video_thruplay_views || 0;
    const prevTotalTax = previous?.total_tax || 0;
    const prevTotalDiscounts = previous?.total_discounts || 0;
    const prevSessions = previous?.total_sessions || 0;
    const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
    const prevCostPerPurchase = prevConversions > 0 ? prevSpend / prevConversions : 0;
    const prevCostPerLPV = prevLandingPageViews > 0 ? prevSpend / prevLandingPageViews : 0;
    const prevHookRate = prevImpressions > 0 ? (prevVideo3sec / prevImpressions) * 100 : 0;
    const prevHoldRate = prevVideo3sec > 0 ? (prevThruplay / prevVideo3sec) * 100 : 0;
    const prevConversionRate = prevSessions > 0 ? (prevOrders / prevSessions) * 100 : 0;
    const prevPendingOrders = previous?.total_pending_orders || 0;

    // Connected platforms
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

    const hasComparison = previous !== null;

    // Build structured response
    const response = {
      period: { start_date: startDate, end_date: endDate },
      has_comparison: hasComparison,
      connected_platforms: {
        facebook: facebookAccounts,
        shopify: shopifyStore
      }
    };

    // Include facebook object if there's FB data or FB credentials
    if (facebookAccounts.length > 0 || fbSpend > 0 || fbImpressions > 0) {
      response.facebook = {
        spend: fbSpend,
        impressions: fbImpressions,
        clicks: fbClicks,
        ctr: ctr,
        conversions: fbConversions,
        cpa: cpa,
        roas: roas,
        cpm: cpm,
        cost_per_purchase: costPerPurchase,
        cost_per_landing_page_view: costPerLPV,
        hook_rate: hookRate,
        hold_rate: holdRate,
        ...(hasComparison && {
          spend_change: calcChange(fbSpend, prevSpend),
          impressions_change: calcChange(fbImpressions, prevImpressions),
          clicks_change: calcChange(fbClicks, prevClicks),
          ctr_change: calcChange(ctr, prevCtr),
          conversions_change: calcChange(fbConversions, prevConversions),
          cpa_change: calcChange(cpa, prevCpa),
          roas_change: calcChange(roas, prevRoas),
          cpm_change: calcChange(cpm, prevCpm),
          cost_per_purchase_change: calcChange(costPerPurchase, prevCostPerPurchase),
          cost_per_landing_page_view_change: calcChange(costPerLPV, prevCostPerLPV),
          hook_rate_change: calcChange(hookRate, prevHookRate),
          hold_rate_change: calcChange(holdRate, prevHoldRate),
        }),
      };
    }

    // Include shopify object if there's Shopify data or credentials
    if (shopifyStore || revenue > 0 || orders > 0) {
      response.shopify = {
        revenue: revenue,
        orders: orders,
        aov: aov,
        customers: customers,
        total_tax: totalTax,
        total_discounts: totalDiscounts,
        sessions: sessions,
        conversion_rate: conversionRate,
        pending_orders: pendingOrders,
        ...(hasComparison && {
          revenue_change: calcChange(revenue, prevRevenue),
          orders_change: calcChange(orders, prevOrders),
          aov_change: calcChange(aov, prevAov),
          customers_change: calcChange(customers, prevCustomers),
          total_tax_change: calcChange(totalTax, prevTotalTax),
          total_discounts_change: calcChange(totalDiscounts, prevTotalDiscounts),
          sessions_change: calcChange(sessions, prevSessions),
          conversion_rate_change: calcChange(conversionRate, prevConversionRate),
          pending_orders_change: calcChange(pendingOrders, prevPendingOrders),
        }),
      };
    }

    // Blended metrics (when both platforms have data)
    if (response.facebook && response.shopify && revenue > 0 && fbSpend > 0) {
      const overallRoas = revenue / fbSpend;
      const costPerOrder = orders > 0 ? fbSpend / orders : 0;
      const adSpendPercentage = revenue > 0 ? (fbSpend / revenue) * 100 : 0;
      const marginAfterAds = revenue - fbSpend;

      const prevOverallRoas = prevRevenue > 0 && prevSpend > 0 ? prevRevenue / prevSpend : 0;
      const prevCostPerOrder = prevOrders > 0 ? prevSpend / prevOrders : 0;
      const prevAdSpendPercentage = prevRevenue > 0 ? (prevSpend / prevRevenue) * 100 : 0;
      const prevMarginAfterAds = prevRevenue - prevSpend;

      response.blended = {
        total_revenue: revenue,
        total_ad_spend: fbSpend,
        overall_roas: overallRoas,
        cost_per_order: costPerOrder,
        ad_spend_percentage: adSpendPercentage,
        margin_after_ads: marginAfterAds,
        ...(hasComparison && {
          total_revenue_change: calcChange(revenue, prevRevenue),
          total_ad_spend_change: calcChange(fbSpend, prevSpend),
          overall_roas_change: calcChange(overallRoas, prevOverallRoas),
          cost_per_order_change: calcChange(costPerOrder, prevCostPerOrder),
          ad_spend_percentage_change: calcChange(adSpendPercentage, prevAdSpendPercentage),
          margin_after_ads_change: calcChange(marginAfterAds, prevMarginAfterAds),
        }),
      };
    }

    res.json(response);
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
    const { startDate, endDate } = resolveRange(req.query);

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

/**
 * GET /api/portal/metrics/ads
 * Get ad-level insights (on-demand from Facebook API)
 */
router.get('/ads', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate } = resolveRange(req.query);

    // Get Facebook credentials
    const fbCred = await db.get(
      'SELECT access_token, ad_account_id FROM client_facebook_credentials WHERE client_id = ?',
      [clientId]
    );

    if (!fbCred || !fbCred.ad_account_id) {
      return res.json({ ads: [], message: 'Sin conexión Facebook' });
    }

    const accessToken = fbCred.access_token || process.env.FACEBOOK_SYSTEM_USER_TOKEN;
    if (!accessToken) {
      return res.json({ ads: [], message: 'Sin token de acceso Facebook' });
    }

    const fb = new FacebookAdsIntegration(accessToken, fbCred.ad_account_id);
    const ads = await fb.getAdLevelInsights(startDate, endDate);

    res.json({ ads });
  } catch (error) {
    console.error('Error fetching portal ad-level insights:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar anuncios' });
  }
});

/**
 * GET /api/portal/metrics/insight
 * Get latest AI insight for the client
 */
router.get('/insight', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;

    const insight = await db.get(`
      SELECT * FROM ai_insights
      WHERE client_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [clientId]);

    res.json(insight || null);
  } catch (error) {
    console.error('Error getting insight:', error);
    res.status(500).json({ error: 'Error al cargar insight' });
  }
});

/**
 * GET /api/portal/metrics/top-products
 * Get top selling products from Shopify (on-demand)
 */
router.get('/top-products', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate } = resolveRange(req.query);

    // Get Shopify credentials
    const shopifyCred = await db.get(
      'SELECT store_url, access_token FROM client_shopify_credentials WHERE client_id = ? AND status = ?',
      [clientId, 'active']
    );

    if (!shopifyCred || !shopifyCred.store_url || !shopifyCred.access_token) {
      return res.json({ products: [], message: 'Sin conexión Shopify' });
    }

    const shopify = new ShopifyIntegration(shopifyCred.store_url, shopifyCred.access_token);
    const products = await shopify.getTopProducts(startDate, endDate, 10);

    res.json({ products });
  } catch (error) {
    console.error('Error fetching top products:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar productos' });
  }
});

export default router;
