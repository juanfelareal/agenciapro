import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import { teamAuthMiddleware } from '../middleware/teamAuth.js';

const router = express.Router();

// Generate a readable share code (like ABC1-XY23)
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

// Helper: resolve range to dates
function resolveRange(query) {
  const { range, start_date, end_date } = query || {};
  const endDate = end_date || new Date().toISOString().split('T')[0];
  let startDate = start_date;
  if (!startDate && range) {
    const days = parseInt(range) || 30;
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  } else if (!startDate) {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  return { startDate, endDate };
}

// Helper: calculate change
function calcChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ========================================
// AUTHENTICATED ROUTES (Team members)
// ========================================

// Generate share token for a client dashboard
router.post('/clients/:clientId/share', teamAuthMiddleware, async (req, res) => {
  try {
    const { expires_in_days } = req.body;
    const clientId = req.params.clientId;

    // Verify client belongs to org
    const client = await db.get(
      'SELECT * FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, req.orgId]
    );
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Generate unique token
    let token;
    let attempts = 0;
    while (attempts < 10) {
      token = generateShareCode();
      const existing = await db.get('SELECT id FROM dashboard_share_tokens WHERE token = ?', [token]);
      if (!existing) break;
      attempts++;
    }
    if (attempts >= 10) {
      return res.status(500).json({ error: 'Error generando código único' });
    }

    let expiresAt = null;
    if (expires_in_days) {
      const date = new Date();
      date.setDate(date.getDate() + parseInt(expires_in_days));
      expiresAt = date.toISOString();
    }

    const result = await db.run(`
      INSERT INTO dashboard_share_tokens (token, client_id, created_by, expires_at, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `, [token, clientId, req.teamMember.id, expiresAt, req.orgId]);

    const shareToken = await db.get('SELECT * FROM dashboard_share_tokens WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      ...shareToken,
      share_url: `/d/${token}`
    });
  } catch (error) {
    console.error('Error creating dashboard share:', error);
    res.status(500).json({ error: error.message });
  }
});

// List share tokens for a client dashboard
router.get('/clients/:clientId/shares', teamAuthMiddleware, async (req, res) => {
  try {
    const tokens = await db.all(`
      SELECT dst.*, tm.name as created_by_name
      FROM dashboard_share_tokens dst
      LEFT JOIN team_members tm ON dst.created_by = tm.id
      WHERE dst.client_id = ? AND dst.organization_id = ?
      ORDER BY dst.created_at DESC
    `, [req.params.clientId, req.orgId]);

    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revoke a share token
router.delete('/clients/:clientId/share/:tokenId', teamAuthMiddleware, async (req, res) => {
  try {
    await db.run(`
      UPDATE dashboard_share_tokens
      SET status = 'revoked'
      WHERE id = ? AND client_id = ? AND organization_id = ?
    `, [req.params.tokenId, req.params.clientId, req.orgId]);

    res.json({ message: 'Enlace revocado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PUBLIC ROUTES (No authentication)
// ========================================

// Get dashboard data by share token (public)
router.get('/public/:token', async (req, res) => {
  try {
    const shareToken = await db.get(`
      SELECT dst.*, c.name as client_name, c.company as client_company
      FROM dashboard_share_tokens dst
      JOIN clients c ON dst.client_id = c.id
      WHERE dst.token = ? AND dst.status = 'active'
    `, [req.params.token]);

    if (!shareToken) {
      return res.status(404).json({ error: 'Enlace no válido o expirado' });
    }

    if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }

    // Update access count
    await db.run(`
      UPDATE dashboard_share_tokens
      SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [shareToken.id]);

    const clientId = shareToken.client_id;
    const { range } = req.query;
    const { startDate, endDate } = resolveRange({ range: range || '30d' });

    // Previous period
    const msStart = new Date(startDate).getTime();
    const msEnd = new Date(endDate).getTime();
    const duration = msEnd - msStart;
    const prevEnd = new Date(msStart - 1).toISOString().split('T')[0];
    const prevStart = new Date(msStart - duration - 86400000).toISOString().split('T')[0];

    // Current metrics
    const current = await db.get(`
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
        COALESCE(SUM(shopify_sessions), 0) as total_sessions
      FROM client_daily_metrics
      WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?
    `, [clientId, startDate, endDate]);

    const previous = await db.get(`
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
        COALESCE(SUM(shopify_sessions), 0) as total_sessions
      FROM client_daily_metrics
      WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?
    `, [clientId, prevStart, prevEnd]);

    // Daily data for charts
    const dailyData = await db.all(`
      SELECT * FROM client_daily_metrics
      WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?
      ORDER BY metric_date ASC
    `, [clientId, startDate, endDate]);

    // AI Insight
    const insight = await db.get(`
      SELECT * FROM ai_insights
      WHERE client_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [clientId]);

    // Build response
    const fbSpend = current?.total_ad_spend || 0;
    const fbConversions = current?.total_conversions || 0;
    const fbClicks = current?.total_clicks || 0;
    const fbImpressions = current?.total_impressions || 0;
    const revenue = current?.total_revenue || 0;
    const orders = current?.total_orders || 0;
    const landingPageViews = current?.total_landing_page_views || 0;
    const video3sec = current?.total_video_3sec_views || 0;
    const thruplay = current?.total_video_thruplay_views || 0;
    const totalTax = current?.total_tax || 0;
    const totalDiscounts = current?.total_discounts || 0;
    const sessions = current?.total_sessions || 0;

    const response = {
      client: {
        name: shareToken.client_name,
        company: shareToken.client_company,
      },
      period: { start_date: startDate, end_date: endDate },
      dailyData,
      insight: insight?.content || null,
    };

    if (fbSpend > 0 || fbImpressions > 0) {
      const ctr = fbImpressions > 0 ? (fbClicks / fbImpressions) * 100 : 0;
      const cpa = fbConversions > 0 ? fbSpend / fbConversions : 0;
      const prevSpend = previous?.total_ad_spend || 0;
      const prevImpressions = previous?.total_impressions || 0;
      const prevClicks = previous?.total_clicks || 0;
      const prevConversions = previous?.total_conversions || 0;
      const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
      const prevCpa = prevConversions > 0 ? prevSpend / prevConversions : 0;

      response.facebook = {
        spend: fbSpend,
        spend_change: calcChange(fbSpend, prevSpend),
        impressions: fbImpressions,
        impressions_change: calcChange(fbImpressions, prevImpressions),
        clicks: fbClicks,
        clicks_change: calcChange(fbClicks, prevClicks),
        ctr: ctr,
        ctr_change: calcChange(ctr, prevCtr),
        conversions: fbConversions,
        conversions_change: calcChange(fbConversions, prevConversions),
        cpa: cpa,
        cpa_change: calcChange(cpa, prevCpa),
        roas: current?.avg_roas || 0,
        roas_change: calcChange(current?.avg_roas || 0, previous?.avg_roas || 0),
        cpm: fbImpressions > 0 ? (fbSpend / fbImpressions) * 1000 : 0,
        cpm_change: calcChange(fbImpressions > 0 ? (fbSpend / fbImpressions) * 1000 : 0, prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0),
        cost_per_purchase: fbConversions > 0 ? fbSpend / fbConversions : 0,
        cost_per_purchase_change: calcChange(fbConversions > 0 ? fbSpend / fbConversions : 0, prevConversions > 0 ? prevSpend / prevConversions : 0),
        hook_rate: fbImpressions > 0 ? (video3sec / fbImpressions) * 100 : 0,
        hook_rate_change: calcChange(fbImpressions > 0 ? (video3sec / fbImpressions) * 100 : 0, prevImpressions > 0 ? ((previous?.total_video_3sec_views || 0) / prevImpressions) * 100 : 0),
        hold_rate: video3sec > 0 ? (thruplay / video3sec) * 100 : 0,
        hold_rate_change: calcChange(video3sec > 0 ? (thruplay / video3sec) * 100 : 0, (previous?.total_video_3sec_views || 0) > 0 ? ((previous?.total_video_thruplay_views || 0) / (previous?.total_video_3sec_views || 1)) * 100 : 0),
      };
    }

    if (revenue > 0 || orders > 0) {
      const aov = orders > 0 ? revenue / orders : 0;
      const prevRevenue = previous?.total_revenue || 0;
      const prevOrders = previous?.total_orders || 0;
      const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;

      response.shopify = {
        revenue: revenue,
        revenue_change: calcChange(revenue, prevRevenue),
        orders: orders,
        orders_change: calcChange(orders, prevOrders),
        aov: aov,
        aov_change: calcChange(aov, prevAov),
        customers: current?.total_customers || 0,
        customers_change: calcChange(current?.total_customers || 0, previous?.total_customers || 0),
        total_tax: totalTax,
        total_tax_change: calcChange(totalTax, previous?.total_tax || 0),
        total_discounts: totalDiscounts,
        total_discounts_change: calcChange(totalDiscounts, previous?.total_discounts || 0),
        sessions: sessions,
        sessions_change: calcChange(sessions, previous?.total_sessions || 0),
        conversion_rate: sessions > 0 ? (orders / sessions) * 100 : 0,
        conversion_rate_change: calcChange(sessions > 0 ? (orders / sessions) * 100 : 0, (previous?.total_sessions || 0) > 0 ? ((previous?.total_orders || 0) / (previous?.total_sessions || 1)) * 100 : 0),
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Error getting public dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
