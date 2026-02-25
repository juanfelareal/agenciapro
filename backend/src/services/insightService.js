import db from '../config/database.js';
import { askClaude } from './claudeService.js';

/**
 * Generate a weekly AI insight for a client based on their metrics
 */
export async function generateWeeklyInsight(clientId, orgId) {
  try {
    // Current week (last 7 days)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Previous week (7-14 days ago)
    const prevEnd = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const prevStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch current week metrics
    const current = await db.get(`
      SELECT
        COALESCE(SUM(shopify_revenue), 0) as revenue,
        COALESCE(SUM(shopify_orders), 0) as orders,
        COALESCE(SUM(fb_spend), 0) as ad_spend,
        COALESCE(SUM(fb_impressions), 0) as impressions,
        COALESCE(SUM(fb_clicks), 0) as clicks,
        COALESCE(SUM(fb_conversions), 0) as conversions,
        AVG(fb_roas) as roas,
        AVG(overall_roas) as overall_roas,
        COALESCE(SUM(fb_video_3sec_views), 0) as video_3sec_views,
        COALESCE(SUM(fb_video_thruplay_views), 0) as video_thruplay_views,
        COALESCE(SUM(shopify_sessions), 0) as sessions,
        COALESCE(SUM(shopify_total_tax), 0) as total_tax,
        COALESCE(SUM(shopify_total_discounts), 0) as total_discounts
      FROM client_daily_metrics
      WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?
    `, [clientId, startDate, endDate]);

    // Fetch previous week metrics
    const previous = await db.get(`
      SELECT
        COALESCE(SUM(shopify_revenue), 0) as revenue,
        COALESCE(SUM(shopify_orders), 0) as orders,
        COALESCE(SUM(fb_spend), 0) as ad_spend,
        COALESCE(SUM(fb_impressions), 0) as impressions,
        COALESCE(SUM(fb_clicks), 0) as clicks,
        COALESCE(SUM(fb_conversions), 0) as conversions,
        AVG(fb_roas) as roas,
        AVG(overall_roas) as overall_roas,
        COALESCE(SUM(fb_video_3sec_views), 0) as video_3sec_views,
        COALESCE(SUM(fb_video_thruplay_views), 0) as video_thruplay_views,
        COALESCE(SUM(shopify_sessions), 0) as sessions,
        COALESCE(SUM(shopify_total_tax), 0) as total_tax,
        COALESCE(SUM(shopify_total_discounts), 0) as total_discounts
      FROM client_daily_metrics
      WHERE client_id = ? AND metric_date >= ? AND metric_date <= ?
    `, [clientId, prevStart, prevEnd]);

    // Get client info
    const client = await db.get('SELECT name, company FROM clients WHERE id = ?', [clientId]);

    if (!current || (current.revenue === 0 && current.ad_spend === 0)) {
      return null; // No data to analyze
    }

    const metricsSnapshot = { current, previous };

    // Derived metrics for prompt
    const cpm = (current.impressions || 0) > 0 ? ((current.ad_spend || 0) / current.impressions) * 1000 : 0;
    const hookRate = (current.impressions || 0) > 0 ? ((current.video_3sec_views || 0) / current.impressions) * 100 : 0;
    const holdRate = (current.video_3sec_views || 0) > 0 ? ((current.video_thruplay_views || 0) / current.video_3sec_views) * 100 : 0;
    const conversionRate = (current.sessions || 0) > 0 ? ((current.orders || 0) / current.sessions) * 100 : 0;

    const prompt = `Eres un analista de marketing digital para una agencia colombiana. Analiza las métricas semanales de este cliente y genera un insight breve y accionable EN ESPAÑOL.

Cliente: ${client?.company || client?.name || 'Cliente'}

Métricas esta semana (${startDate} a ${endDate}):
- Ingresos Shopify: $${(current.revenue || 0).toLocaleString()} COP
- Pedidos: ${current.orders || 0}
- Inversión Ads: $${(current.ad_spend || 0).toLocaleString()} COP
- Impresiones: ${(current.impressions || 0).toLocaleString()}
- Clics: ${current.clicks || 0}
- Conversiones: ${current.conversions || 0}
- ROAS: ${(current.roas || 0).toFixed(2)}x
- CPM: $${cpm.toFixed(0)} COP
- Sesiones Shopify: ${current.sessions || 0}
- Tasa de conversión: ${conversionRate.toFixed(2)}%${hookRate > 0 ? `\n- Hook Rate (3s video): ${hookRate.toFixed(2)}%` : ''}${holdRate > 0 ? `\n- Hold Rate (thruplay): ${holdRate.toFixed(2)}%` : ''}

Métricas semana anterior (${prevStart} a ${prevEnd}):
- Ingresos: $${(previous?.revenue || 0).toLocaleString()} COP
- Pedidos: ${previous?.orders || 0}
- Inversión Ads: $${(previous?.ad_spend || 0).toLocaleString()} COP
- Conversiones: ${previous?.conversions || 0}
- ROAS: ${(previous?.roas || 0).toFixed(2)}x
- Sesiones Shopify: ${previous?.sessions || 0}

Genera un insight de máximo 3 párrafos con:
1. Resumen del rendimiento (mejoró, empeoró, se mantuvo)
2. Dato más relevante o preocupante
3. Una recomendación concreta

Sé directo y usa lenguaje profesional pero amigable. No uses markdown headers, solo texto plano con saltos de línea.`;

    const insightContent = await askClaude(prompt);

    // Save to database
    await db.run(`
      INSERT INTO ai_insights (client_id, insight_type, content, metrics_snapshot, week_start, week_end, organization_id)
      VALUES (?, 'weekly', ?, ?, ?, ?, ?)
    `, [clientId, insightContent, JSON.stringify(metricsSnapshot), startDate, endDate, orgId]);

    return insightContent;
  } catch (error) {
    console.error(`Error generating insight for client ${clientId}:`, error.message);
    return null;
  }
}

/**
 * Generate insights for all clients that have connected platforms
 */
export async function generateAllWeeklyInsights() {
  try {
    // Get all clients with metrics data
    const clients = await db.all(`
      SELECT DISTINCT c.id, c.organization_id
      FROM clients c
      INNER JOIN client_daily_metrics cdm ON c.id = cdm.client_id
      WHERE cdm.metric_date >= $1
    `, [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]);

    console.log(`📊 Generating weekly insights for ${clients.length} clients...`);

    for (const client of clients) {
      await generateWeeklyInsight(client.id, client.organization_id);
    }

    console.log('✅ Weekly insights generation complete');
  } catch (error) {
    console.error('❌ Error generating weekly insights:', error.message);
  }
}
