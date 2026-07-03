import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';
import FacebookAdsIntegration from '../../integrations/facebookAds.js';
import GoogleAdsIntegration from '../../integrations/googleAds.js';
import TikTokAdsIntegration from '../../integrations/tiktokAds.js';
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

    // Get portal revenue metric setting
    const portalSettings = await db.get(
      'SELECT portal_revenue_metric FROM client_portal_settings WHERE client_id = ?',
      [clientId]
    );
    const revenueMetric = portalSettings?.portal_revenue_metric || 'confirmed';

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
        COALESCE(SUM(ga_spend), 0) as total_google_spend,
        COALESCE(SUM(ga_impressions), 0) as total_google_impressions,
        COALESCE(SUM(ga_clicks), 0) as total_google_clicks,
        COALESCE(SUM(ga_conversions), 0) as total_google_conversions,
        COALESCE(SUM(ga_revenue), 0) as total_google_revenue,
        COALESCE(SUM(tt_spend), 0) as total_tiktok_spend,
        COALESCE(SUM(tt_impressions), 0) as total_tiktok_impressions,
        COALESCE(SUM(tt_clicks), 0) as total_tiktok_clicks,
        COALESCE(SUM(tt_conversions), 0) as total_tiktok_conversions,
        COALESCE(SUM(tt_revenue), 0) as total_tiktok_revenue,
        COALESCE(SUM(shopify_customers), 0) as total_customers,
        COALESCE(SUM(fb_video_3sec_views), 0) as total_video_3sec_views,
        COALESCE(SUM(fb_video_thruplay_views), 0) as total_video_thruplay_views,
        COALESCE(SUM(fb_landing_page_views), 0) as total_landing_page_views,
        COALESCE(SUM(shopify_total_tax), 0) as total_tax,
        COALESCE(SUM(shopify_total_discounts), 0) as total_discounts,
        COALESCE(SUM(shopify_sessions), 0) as total_sessions,
        COALESCE(SUM(shopify_pending_orders), 0) as total_pending_orders,
        COALESCE(SUM(fb_link_clicks), 0) as total_link_clicks,
        COALESCE(SUM(fb_add_to_cart), 0) as total_add_to_cart,
        COALESCE(SUM(shopify_all_orders_revenue), 0) as total_all_orders_revenue,
        COALESCE(SUM(shopify_all_orders_count), 0) as total_all_orders_count,
        COALESCE(SUM(shopify_net_revenue), 0) as total_net_revenue,
        COALESCE(SUM(shopify_refunds), 0) as total_refunds
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
        COALESCE(SUM(ga_spend), 0) as total_google_spend,
        COALESCE(SUM(ga_impressions), 0) as total_google_impressions,
        COALESCE(SUM(ga_clicks), 0) as total_google_clicks,
        COALESCE(SUM(ga_conversions), 0) as total_google_conversions,
        COALESCE(SUM(ga_revenue), 0) as total_google_revenue,
        COALESCE(SUM(tt_spend), 0) as total_tiktok_spend,
        COALESCE(SUM(tt_impressions), 0) as total_tiktok_impressions,
        COALESCE(SUM(tt_clicks), 0) as total_tiktok_clicks,
        COALESCE(SUM(tt_conversions), 0) as total_tiktok_conversions,
        COALESCE(SUM(tt_revenue), 0) as total_tiktok_revenue,
        COALESCE(SUM(shopify_customers), 0) as total_customers,
        COALESCE(SUM(fb_video_3sec_views), 0) as total_video_3sec_views,
        COALESCE(SUM(fb_video_thruplay_views), 0) as total_video_thruplay_views,
        COALESCE(SUM(fb_landing_page_views), 0) as total_landing_page_views,
        COALESCE(SUM(shopify_total_tax), 0) as total_tax,
        COALESCE(SUM(shopify_total_discounts), 0) as total_discounts,
        COALESCE(SUM(shopify_sessions), 0) as total_sessions,
        COALESCE(SUM(shopify_pending_orders), 0) as total_pending_orders,
        COALESCE(SUM(fb_link_clicks), 0) as total_link_clicks,
        COALESCE(SUM(fb_add_to_cart), 0) as total_add_to_cart,
        COALESCE(SUM(shopify_all_orders_revenue), 0) as total_all_orders_revenue,
        COALESCE(SUM(shopify_all_orders_count), 0) as total_all_orders_count,
        COALESCE(SUM(shopify_net_revenue), 0) as total_net_revenue,
        COALESCE(SUM(shopify_refunds), 0) as total_refunds
      FROM client_daily_metrics
      WHERE client_id = ?
        AND metric_date >= ?
        AND metric_date <= ?
    `, [clientId, prevStart, prevEnd]) : null;

    // Derived metrics — parseFloat needed because pg driver returns SUM() as string
    const p = (v) => parseFloat(v) || 0;
    const fbSpend = p(current?.total_ad_spend);
    const fbConversions = p(current?.total_conversions);
    const fbClicks = p(current?.total_clicks);
    const fbImpressions = p(current?.total_impressions);
    const cpa = fbConversions > 0 ? fbSpend / fbConversions : 0;
    const ctr = fbImpressions > 0 ? (fbClicks / fbImpressions) * 100 : 0;
    const roas = p(current?.avg_roas);
    const revenue = p(current?.total_revenue);
    const orders = p(current?.total_orders);
    const aov = orders > 0 ? revenue / orders : 0;
    // El daily metric guarda "clientes únicos por día" — sumarlos a través
    // del período double-cuenta clientes que ordenaron en varios días.
    // Como invariante de negocio clientes ≤ pedidos siempre, lo cap-eamos
    // al número de pedidos confirmados del período. Es una aproximación
    // segura por defecto que evita el bug visible "85 clientes / 66 pedidos".
    const customersRaw = p(current?.total_customers);
    const customers = orders > 0 ? Math.min(customersRaw, orders) : customersRaw;
    const landingPageViews = p(current?.total_landing_page_views);
    const linkClicks = p(current?.total_link_clicks);
    const addToCart = p(current?.total_add_to_cart);
    const video3sec = p(current?.total_video_3sec_views);
    const thruplay = p(current?.total_video_thruplay_views);
    const totalTax = p(current?.total_tax);
    const totalDiscounts = p(current?.total_discounts);
    const sessions = p(current?.total_sessions);
    const cpm = fbImpressions > 0 ? (fbSpend / fbImpressions) * 1000 : 0;
    const costPerPurchase = fbConversions > 0 ? fbSpend / fbConversions : 0;
    const costPerLPV = landingPageViews > 0 ? fbSpend / landingPageViews : 0;
    const hookRate = fbImpressions > 0 ? (video3sec / fbImpressions) * 100 : 0;
    const holdRate = video3sec > 0 ? (thruplay / video3sec) * 100 : 0;
    const conversionRate = sessions > 0 ? (orders / sessions) * 100 : 0;
    const pendingOrders = p(current?.total_pending_orders);

    // Google Ads (current)
    const gaSpend = p(current?.total_google_spend);
    const gaImpressions = p(current?.total_google_impressions);
    const gaClicks = p(current?.total_google_clicks);
    const gaConversions = p(current?.total_google_conversions);
    const gaRevenue = p(current?.total_google_revenue);
    const gaCtr = gaImpressions > 0 ? (gaClicks / gaImpressions) * 100 : 0;
    const gaCpc = gaClicks > 0 ? gaSpend / gaClicks : 0;
    const gaCpm = gaImpressions > 0 ? (gaSpend / gaImpressions) * 1000 : 0;
    const gaRoas = gaSpend > 0 ? gaRevenue / gaSpend : 0;
    const gaCostPerConversion = gaConversions > 0 ? gaSpend / gaConversions : 0;
    // Google Ads (previous)
    const prevGaSpend = p(previous?.total_google_spend);
    const prevGaImpressions = p(previous?.total_google_impressions);
    const prevGaClicks = p(previous?.total_google_clicks);
    const prevGaConversions = p(previous?.total_google_conversions);
    const prevGaRevenue = p(previous?.total_google_revenue);
    const prevGaCtr = prevGaImpressions > 0 ? (prevGaClicks / prevGaImpressions) * 100 : 0;
    const prevGaRoas = prevGaSpend > 0 ? prevGaRevenue / prevGaSpend : 0;
    const prevGaCostPerConversion = prevGaConversions > 0 ? prevGaSpend / prevGaConversions : 0;
    // TikTok Ads (current)
    const ttSpend = p(current?.total_tiktok_spend);
    const ttImpressions = p(current?.total_tiktok_impressions);
    const ttClicks = p(current?.total_tiktok_clicks);
    const ttConversions = p(current?.total_tiktok_conversions);
    const ttRevenue = p(current?.total_tiktok_revenue);
    const ttCtr = ttImpressions > 0 ? (ttClicks / ttImpressions) * 100 : 0;
    const ttCpc = ttClicks > 0 ? ttSpend / ttClicks : 0;
    const ttCpm = ttImpressions > 0 ? (ttSpend / ttImpressions) * 1000 : 0;
    const ttRoas = ttSpend > 0 ? ttRevenue / ttSpend : 0;
    const ttCostPerConversion = ttConversions > 0 ? ttSpend / ttConversions : 0;
    // TikTok Ads (previous)
    const prevTtSpend = p(previous?.total_tiktok_spend);
    const prevTtImpressions = p(previous?.total_tiktok_impressions);
    const prevTtClicks = p(previous?.total_tiktok_clicks);
    const prevTtConversions = p(previous?.total_tiktok_conversions);
    const prevTtRevenue = p(previous?.total_tiktok_revenue);
    const prevTtCtr = prevTtImpressions > 0 ? (prevTtClicks / prevTtImpressions) * 100 : 0;
    const prevTtRoas = prevTtSpend > 0 ? prevTtRevenue / prevTtSpend : 0;
    const prevTtCostPerConversion = prevTtConversions > 0 ? prevTtSpend / prevTtConversions : 0;
    // Blended ad spend across Meta + Google + TikTok
    const totalAdSpend = fbSpend + gaSpend + ttSpend;

    // Previous derived
    const prevSpend = p(previous?.total_ad_spend);
    const prevTotalAdSpend = prevSpend + prevGaSpend + prevTtSpend;
    const prevConversions = p(previous?.total_conversions);
    const prevClicks = p(previous?.total_clicks);
    const prevImpressions = p(previous?.total_impressions);
    const prevCpa = prevConversions > 0 ? prevSpend / prevConversions : 0;
    const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
    const prevRoas = p(previous?.avg_roas);
    const prevRevenue = p(previous?.total_revenue);
    const prevOrders = p(previous?.total_orders);
    const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;
    const prevCustomersRaw = p(previous?.total_customers);
    const prevCustomers = prevOrders > 0 ? Math.min(prevCustomersRaw, prevOrders) : prevCustomersRaw;
    const prevLandingPageViews = p(previous?.total_landing_page_views);
    const prevVideo3sec = p(previous?.total_video_3sec_views);
    const prevThruplay = p(previous?.total_video_thruplay_views);
    const prevTotalTax = p(previous?.total_tax);
    const prevTotalDiscounts = p(previous?.total_discounts);
    const prevSessions = p(previous?.total_sessions);
    const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
    const prevCostPerPurchase = prevConversions > 0 ? prevSpend / prevConversions : 0;
    const prevCostPerLPV = prevLandingPageViews > 0 ? prevSpend / prevLandingPageViews : 0;
    const prevHookRate = prevImpressions > 0 ? (prevVideo3sec / prevImpressions) * 100 : 0;
    const prevHoldRate = prevVideo3sec > 0 ? (prevThruplay / prevVideo3sec) * 100 : 0;
    const prevConversionRate = prevSessions > 0 ? (prevOrders / prevSessions) * 100 : 0;
    const prevPendingOrders = p(previous?.total_pending_orders);

    // Connected platforms
    const facebookAccounts = await db.all(`
      SELECT ad_account_name, status, last_sync_at
      FROM client_facebook_credentials
      WHERE client_id = ? AND status = 'active'
    `, [clientId]);

    const googleAccounts = await db.all(`
      SELECT customer_name, status, last_sync_at
      FROM client_google_ads_credentials
      WHERE client_id = ? AND status = 'active'
    `, [clientId]);

    const tiktokAccounts = await db.all(`
      SELECT advertiser_name, status, last_sync_at
      FROM client_tiktok_credentials
      WHERE client_id = ? AND status = 'active'
    `, [clientId]);

    const shopifyStore = await db.get(`
      SELECT store_url, status, last_sync_at
      FROM client_shopify_credentials
      WHERE client_id = ? AND status = 'active'
    `, [clientId]);

    const hasComparison = previous !== null;

    // Most recent successful sync across this client's connected platforms
    const allSyncTimes = [
      ...facebookAccounts.map(a => a.last_sync_at).filter(Boolean),
      ...googleAccounts.map(a => a.last_sync_at).filter(Boolean),
      ...tiktokAccounts.map(a => a.last_sync_at).filter(Boolean),
      shopifyStore?.last_sync_at,
    ].filter(Boolean);
    const lastSyncAt = allSyncTimes.length
      ? allSyncTimes.reduce((max, t) => (new Date(t) > new Date(max) ? t : max))
      : null;

    // Build structured response
    const response = {
      period: { start_date: startDate, end_date: endDate },
      has_comparison: hasComparison,
      revenue_metric: revenueMetric,
      last_sync_at: lastSyncAt,
      connected_platforms: {
        facebook: facebookAccounts,
        google_ads: googleAccounts,
        tiktok: tiktokAccounts,
        shopify: shopifyStore
      }
    };

    // Include tiktok object if there's TikTok data or credentials
    if (tiktokAccounts.length > 0 || ttSpend > 0 || ttImpressions > 0) {
      response.tiktok = {
        spend: ttSpend,
        impressions: ttImpressions,
        clicks: ttClicks,
        ctr: ttCtr,
        cpc: ttCpc,
        cpm: ttCpm,
        conversions: ttConversions,
        revenue: ttRevenue,
        roas: ttRoas,
        cost_per_conversion: ttCostPerConversion,
        ...(hasComparison && {
          spend_change: calcChange(ttSpend, prevTtSpend),
          impressions_change: calcChange(ttImpressions, prevTtImpressions),
          clicks_change: calcChange(ttClicks, prevTtClicks),
          ctr_change: calcChange(ttCtr, prevTtCtr),
          conversions_change: calcChange(ttConversions, prevTtConversions),
          roas_change: calcChange(ttRoas, prevTtRoas),
          cost_per_conversion_change: calcChange(ttCostPerConversion, prevTtCostPerConversion),
        }),
      };
    }

    // Include google object if there's Google data or credentials
    if (googleAccounts.length > 0 || gaSpend > 0 || gaImpressions > 0) {
      response.google = {
        spend: gaSpend,
        impressions: gaImpressions,
        clicks: gaClicks,
        ctr: gaCtr,
        cpc: gaCpc,
        cpm: gaCpm,
        conversions: gaConversions,
        revenue: gaRevenue,
        roas: gaRoas,
        cost_per_conversion: gaCostPerConversion,
        ...(hasComparison && {
          spend_change: calcChange(gaSpend, prevGaSpend),
          impressions_change: calcChange(gaImpressions, prevGaImpressions),
          clicks_change: calcChange(gaClicks, prevGaClicks),
          ctr_change: calcChange(gaCtr, prevGaCtr),
          conversions_change: calcChange(gaConversions, prevGaConversions),
          roas_change: calcChange(gaRoas, prevGaRoas),
          cost_per_conversion_change: calcChange(gaCostPerConversion, prevGaCostPerConversion),
        }),
      };
    }

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
        landing_page_views: landingPageViews,
        link_clicks: linkClicks,
        add_to_cart: addToCart,
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
      // Select revenue value based on portal_revenue_metric setting
      const allOrdersRevenue = current?.total_all_orders_revenue || 0;
      const netConfirmedRevenue = current?.total_net_revenue || 0;
      const prevAllOrdersRevenue = previous?.total_all_orders_revenue || 0;
      const prevNetConfirmedRevenue = previous?.total_net_revenue || 0;

      let portalRevenue, prevPortalRevenue, portalRevenueLabel;
      if (revenueMetric === 'total') {
        portalRevenue = allOrdersRevenue;
        prevPortalRevenue = prevAllOrdersRevenue;
        portalRevenueLabel = 'Venta Total';
      } else if (revenueMetric === 'net_confirmed') {
        portalRevenue = netConfirmedRevenue;
        prevPortalRevenue = prevNetConfirmedRevenue;
        portalRevenueLabel = 'Venta Neta Confirmada';
      } else {
        portalRevenue = revenue;
        prevPortalRevenue = prevRevenue;
        portalRevenueLabel = 'Venta Total Confirmada';
      }

      const netRevenue = p(current?.total_net_revenue);
      const refunds = p(current?.total_refunds);
      const prevNetRevenue = p(previous?.total_net_revenue);
      const prevRefunds = p(previous?.total_refunds);

      response.shopify = {
        revenue: portalRevenue,
        revenue_label: portalRevenueLabel,
        orders: orders,
        aov: aov,
        customers: customers,
        total_tax: totalTax,
        total_discounts: totalDiscounts,
        sessions: sessions,
        conversion_rate: conversionRate,
        pending_orders: pendingOrders,
        net_revenue: netRevenue,
        refunds: refunds,
        ...(hasComparison && {
          revenue_change: calcChange(portalRevenue, prevPortalRevenue),
          orders_change: calcChange(orders, prevOrders),
          aov_change: calcChange(aov, prevAov),
          customers_change: calcChange(customers, prevCustomers),
          total_tax_change: calcChange(totalTax, prevTotalTax),
          total_discounts_change: calcChange(totalDiscounts, prevTotalDiscounts),
          sessions_change: calcChange(sessions, prevSessions),
          conversion_rate_change: calcChange(conversionRate, prevConversionRate),
          pending_orders_change: calcChange(pendingOrders, prevPendingOrders),
          net_revenue_change: calcChange(netRevenue, prevNetRevenue),
          refunds_change: calcChange(refunds, prevRefunds),
        }),
      };
    }

    // Blended metrics (when both platforms have data)
    // Use the portal-configured revenue for blended too
    const blendedRevenue = response.shopify?.revenue || revenue;
    const prevBlendedRevenue = response.shopify ? (revenueMetric === 'total' ? (previous?.total_all_orders_revenue || 0) : revenueMetric === 'net_confirmed' ? (previous?.total_net_revenue || 0) : prevRevenue) : prevRevenue;
    if ((response.facebook || response.google || response.tiktok) && response.shopify && blendedRevenue > 0 && totalAdSpend > 0) {
      const overallRoas = blendedRevenue / totalAdSpend;
      const costPerOrder = orders > 0 ? totalAdSpend / orders : 0;
      const adSpendPercentage = blendedRevenue > 0 ? (totalAdSpend / blendedRevenue) * 100 : 0;
      const marginAfterAds = blendedRevenue - totalAdSpend;

      const prevOverallRoas = prevBlendedRevenue > 0 && prevTotalAdSpend > 0 ? prevBlendedRevenue / prevTotalAdSpend : 0;
      const prevCostPerOrder = prevOrders > 0 ? prevTotalAdSpend / prevOrders : 0;
      const prevAdSpendPercentage = prevBlendedRevenue > 0 ? (prevTotalAdSpend / prevBlendedRevenue) * 100 : 0;
      const prevMarginAfterAds = prevBlendedRevenue - prevTotalAdSpend;

      response.blended = {
        total_revenue: blendedRevenue,
        total_ad_spend: totalAdSpend,
        fb_spend: fbSpend,
        google_spend: gaSpend,
        tiktok_spend: ttSpend,
        overall_roas: overallRoas,
        cost_per_order: costPerOrder,
        ad_spend_percentage: adSpendPercentage,
        margin_after_ads: marginAfterAds,
        ...(hasComparison && {
          total_revenue_change: calcChange(blendedRevenue, prevBlendedRevenue),
          total_ad_spend_change: calcChange(totalAdSpend, prevTotalAdSpend),
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

    // Merge persisted tags into ads (read-only for portal)
    if (ads.length > 0) {
      const adIds = ads.map(a => a.ad_id);
      const placeholders = adIds.map((_, i) => `$${i + 1}`).join(',');
      const tagRows = await db.prepare(`
        SELECT ata.ad_id, atv.id as value_id, atv.name as value_name, atv.color as value_color,
               atc.id as category_id, atc.name as category_name, atc.color as category_color
        FROM ad_tag_assignments ata
        JOIN ad_tag_values atv ON ata.tag_value_id = atv.id
        JOIN ad_tag_categories atc ON atv.category_id = atc.id
        WHERE ata.ad_id IN (${placeholders}) AND ata.client_id = $${adIds.length + 1}
      `).all(...adIds, clientId);

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
    console.error('Error fetching portal ad-level insights:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar anuncios' });
  }
});

/**
 * GET /api/portal/metrics/google-campaigns
 * Get Google Ads campaign-level insights (on-demand from Google Ads API)
 */
router.get('/google-campaigns', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate } = resolveRange(req.query);

    const gaCred = await db.get(
      'SELECT refresh_token, customer_id, login_customer_id FROM client_google_ads_credentials WHERE client_id = ?',
      [clientId]
    );

    if (!gaCred || !gaCred.customer_id) {
      return res.json({ campaigns: [], message: 'Sin conexión Google Ads' });
    }

    const refreshToken = gaCred.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN;
    if (!refreshToken) {
      return res.json({ campaigns: [], message: 'Sin token de acceso Google Ads' });
    }

    const google = new GoogleAdsIntegration(refreshToken, gaCred.customer_id, gaCred.login_customer_id);
    const campaigns = await google.getCampaignInsights(startDate, endDate);

    res.json({ campaigns });
  } catch (error) {
    console.error('Error fetching portal Google Ads campaigns:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar campañas de Google Ads' });
  }
});

/**
 * GET /api/portal/metrics/tiktok-campaigns
 * Get TikTok Ads campaign-level insights (on-demand from TikTok API)
 */
router.get('/tiktok-campaigns', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate } = resolveRange(req.query);

    const ttCred = await db.get(
      'SELECT access_token, advertiser_id FROM client_tiktok_credentials WHERE client_id = ?',
      [clientId]
    );

    if (!ttCred || !ttCred.advertiser_id) {
      return res.json({ campaigns: [], message: 'Sin conexión TikTok' });
    }

    const accessToken = ttCred.access_token || process.env.TIKTOK_SYSTEM_ACCESS_TOKEN;
    if (!accessToken) {
      return res.json({ campaigns: [], message: 'Sin token de acceso TikTok' });
    }

    const tiktok = new TikTokAdsIntegration(accessToken, ttCred.advertiser_id);
    const campaigns = await tiktok.getCampaignInsights(startDate, endDate);

    res.json({ campaigns });
  } catch (error) {
    console.error('Error fetching portal TikTok campaigns:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar campañas de TikTok' });
  }
});

/**
 * GET /api/portal/metrics/ads/:adId/preview
 * Get embeddable HTML preview for a Facebook ad
 */
const ALLOWED_PREVIEW_FORMATS = new Set([
  'MOBILE_FEED_STANDARD',
  'DESKTOP_FEED_STANDARD',
  'INSTAGRAM_STANDARD',
  'INSTAGRAM_STORY',
  'INSTAGRAM_REELS',
  'FACEBOOK_REELS_MOBILE',
  'FACEBOOK_STORY_MOBILE'
]);

router.get('/ads/:adId/preview', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { adId } = req.params;
    const format = ALLOWED_PREVIEW_FORMATS.has(req.query.format)
      ? req.query.format
      : 'MOBILE_FEED_STANDARD';

    const fbCred = await db.get(
      'SELECT access_token, ad_account_id FROM client_facebook_credentials WHERE client_id = ?',
      [clientId]
    );
    if (!fbCred || !fbCred.ad_account_id) {
      return res.status(404).json({ error: 'Sin conexión Facebook' });
    }

    const accessToken = fbCred.access_token || process.env.FACEBOOK_SYSTEM_USER_TOKEN;
    if (!accessToken) {
      return res.status(404).json({ error: 'Sin token de acceso Facebook' });
    }

    const fb = new FacebookAdsIntegration(accessToken, fbCred.ad_account_id);
    const html = await fb.getAdPreview(adId, format);

    if (!html) {
      return res.status(404).json({ error: 'Vista previa no disponible para este formato' });
    }

    res.json({ html, format });
  } catch (error) {
    console.error('Error fetching ad preview:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar vista previa' });
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

/**
 * GET /api/portal/metrics/channels
 * Get sales by attribution channel (on-demand)
 */
router.get('/channels', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate } = resolveRange(req.query);

    const shopifyCred = await db.get(
      'SELECT store_url, access_token FROM client_shopify_credentials WHERE client_id = ? AND status = ?',
      [clientId, 'active']
    );

    if (!shopifyCred || !shopifyCred.store_url || !shopifyCred.access_token) {
      return res.json({ channels: [], message: 'Sin conexión Shopify' });
    }

    const shopify = new ShopifyIntegration(shopifyCred.store_url, shopifyCred.access_token);
    const channels = await shopify.getSalesByChannel(startDate, endDate);

    res.json({ channels });
  } catch (error) {
    console.error('Error fetching channels:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar canales' });
  }
});

/**
 * GET /api/portal/metrics/categories
 * Get sales by Shopify collection (on-demand)
 */
router.get('/categories', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate } = resolveRange(req.query);

    const shopifyCred = await db.get(
      'SELECT store_url, access_token FROM client_shopify_credentials WHERE client_id = ? AND status = ?',
      [clientId, 'active']
    );

    if (!shopifyCred || !shopifyCred.store_url || !shopifyCred.access_token) {
      return res.json({ categories: [], message: 'Sin conexión Shopify' });
    }

    const shopify = new ShopifyIntegration(shopifyCred.store_url, shopifyCred.access_token);
    const categories = await shopify.getSalesByCollection(startDate, endDate);

    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al cargar categorías' });
  }
});

/**
 * GET /api/portal/metrics/demographics
 * Get demographic breakdown: Meta age/gender + Shopify regions + brand avatar
 */
router.get('/demographics', clientAuthMiddleware, requirePortalPermission('can_view_metrics'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { startDate, endDate } = resolveRange(req.query);

    const response = { facebook: null, shopify: null, avatar: null };

    // Facebook demographics (age × gender)
    const fbCred = await db.get(
      'SELECT access_token, ad_account_id FROM client_facebook_credentials WHERE client_id = ?',
      [clientId]
    );
    if (fbCred?.ad_account_id) {
      const accessToken = fbCred.access_token || process.env.FACEBOOK_SYSTEM_USER_TOKEN;
      if (accessToken) {
        const fb = new FacebookAdsIntegration(accessToken, fbCred.ad_account_id);
        const ageGender = await fb.getDemographicInsights(startDate, endDate);
        response.facebook = { age_gender: ageGender };
      }
    }

    // Shopify regions (orders by city)
    const shopifyCred = await db.get(
      'SELECT store_url, access_token FROM client_shopify_credentials WHERE client_id = ? AND status = ?',
      [clientId, 'active']
    );
    if (shopifyCred?.store_url && shopifyCred?.access_token) {
      const shopify = new ShopifyIntegration(shopifyCred.store_url, shopifyCred.access_token);
      const regions = await shopify.getOrdersByRegion(startDate, endDate);
      response.shopify = { regions };
    }

    // Build brand avatar
    const avatar = {};
    if (response.facebook?.age_gender?.length) {
      // Aggregate by gender
      const genderTotals = {};
      const ageTotals = {};
      let totalConversions = 0;
      for (const row of response.facebook.age_gender) {
        const g = row.gender === 'female' ? 'Mujer' : row.gender === 'male' ? 'Hombre' : row.gender;
        genderTotals[g] = (genderTotals[g] || 0) + row.conversions;
        ageTotals[row.age] = (ageTotals[row.age] || 0) + row.conversions;
        totalConversions += row.conversions;
      }
      const topGender = Object.entries(genderTotals).sort((a, b) => b[1] - a[1])[0];
      const topAge = Object.entries(ageTotals).sort((a, b) => b[1] - a[1])[0];
      if (topGender) avatar.top_gender = topGender[0];
      if (topAge) avatar.top_age_range = topAge[0];
      avatar.total_conversions = totalConversions;
      if (topGender && topAge && totalConversions > 0) {
        avatar.gender_confidence = ((topGender[1] / totalConversions) * 100).toFixed(1);
        avatar.age_confidence = ((topAge[1] / totalConversions) * 100).toFixed(1);
      }
    }
    if (response.shopify?.regions?.length) {
      const top = response.shopify.regions[0];
      avatar.top_city = top.city;
      avatar.top_province = top.province;
      const totalOrders = response.shopify.regions.reduce((s, r) => s + r.orders, 0);
      avatar.city_confidence = totalOrders > 0 ? ((top.orders / totalOrders) * 100).toFixed(1) : 0;
    }
    // Build summary string
    const parts = [];
    if (avatar.top_gender) parts.push(avatar.top_gender);
    if (avatar.top_age_range) parts.push(`${avatar.top_age_range} años`);
    if (avatar.top_city) parts.push(avatar.top_city);
    avatar.summary = parts.join(', ') || 'Sin datos suficientes';

    response.avatar = avatar;
    res.json(response);
  } catch (error) {
    console.error('Error getting demographics:', error);
    res.status(500).json({ error: 'Error al cargar datos demográficos' });
  }
});

export default router;
