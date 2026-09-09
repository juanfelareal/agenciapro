import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

// GET /api/portal/email-marketing?year=&month=
// Returns monthly email metrics from client_monthly_email_metrics table
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { year, month, start_date, end_date } = req.query;

    // If year/month provided, get that specific month
    // Otherwise, get all available months for this client
    let sql, params;

    if (year && month) {
      sql = `
        SELECT * FROM client_monthly_email_metrics
        WHERE client_id = ? AND year = ? AND month = ?
      `;
      params = [clientId, parseInt(year), parseInt(month)];
    } else if (start_date && end_date) {
      // Parse dates to get year/month range
      const startParts = start_date.split('-');
      const endParts = end_date.split('-');
      const startYear = parseInt(startParts[0]);
      const startMonth = parseInt(startParts[1]);
      const endYear = parseInt(endParts[0]);
      const endMonth = parseInt(endParts[1]);

      sql = `
        SELECT * FROM client_monthly_email_metrics
        WHERE client_id = ?
          AND ((year > ? OR (year = ? AND month >= ?))
          AND (year < ? OR (year = ? AND month <= ?)))
        ORDER BY year DESC, month DESC
      `;
      params = [clientId, startYear, startYear, startMonth, endYear, endYear, endMonth];
    } else {
      // Get last 12 months by default
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      sql = `
        SELECT * FROM client_monthly_email_metrics
        WHERE client_id = ?
        ORDER BY year DESC, month DESC
        LIMIT 12
      `;
      params = [clientId];
    }

    const months = await db.all(sql, params);

    // Calculate totals across all months
    const totals = months.reduce((acc, m) => ({
      campaigns_revenue: acc.campaigns_revenue + (m.campaigns_revenue || 0),
      campaigns_deliveries: acc.campaigns_deliveries + (m.campaigns_deliveries || 0),
      campaigns_opens: acc.campaigns_opens + (m.campaigns_opens || 0),
      campaigns_clicks: acc.campaigns_clicks + (m.campaigns_clicks || 0),
      campaigns_conversions: acc.campaigns_conversions + (m.campaigns_conversions || 0),
      flows_revenue: acc.flows_revenue + (m.flows_revenue || 0),
      flows_deliveries: acc.flows_deliveries + (m.flows_deliveries || 0),
      flows_opens: acc.flows_opens + (m.flows_opens || 0),
      flows_clicks: acc.flows_clicks + (m.flows_clicks || 0),
      flows_conversions: acc.flows_conversions + (m.flows_conversions || 0),
      master_segment_size: m.master_segment_size || acc.master_segment_size, // Use most recent
      monthly_subscriptions: acc.monthly_subscriptions + (m.monthly_subscriptions || 0),
      monthly_unsubscribes: acc.monthly_unsubscribes + (m.monthly_unsubscribes || 0),
    }), {
      campaigns_revenue: 0, campaigns_deliveries: 0, campaigns_opens: 0,
      campaigns_clicks: 0, campaigns_conversions: 0,
      flows_revenue: 0, flows_deliveries: 0, flows_opens: 0,
      flows_clicks: 0, flows_conversions: 0,
      master_segment_size: 0, monthly_subscriptions: 0, monthly_unsubscribes: 0,
    });

    res.json({ months, totals });
  } catch (error) {
    console.error('Error fetching portal email marketing:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
