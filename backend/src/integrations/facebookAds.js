import axios from 'axios';

const FB_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Facebook Ads Integration
 * Connects to Facebook Marketing API to fetch ad account metrics
 */
class FacebookAdsIntegration {
  constructor(accessToken, adAccountId) {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  }

  /**
   * Test connection to Facebook Ads API
   * @returns {Promise<{success: boolean, accountName?: string, error?: string}>}
   */
  async testConnection() {
    try {
      const response = await axios.get(`${FB_GRAPH_API_URL}/${this.adAccountId}`, {
        params: {
          access_token: this.accessToken,
          fields: 'name,account_status,currency,timezone_name'
        }
      });

      if (response.data && response.data.name) {
        return {
          success: true,
          accountName: response.data.name,
          currency: response.data.currency,
          timezone: response.data.timezone_name,
          accountStatus: response.data.account_status
        };
      }

      return { success: false, error: 'No se pudo obtener información de la cuenta' };
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get ad insights for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>}
   */
  async getInsights(startDate, endDate) {
    try {
      const response = await axios.get(`${FB_GRAPH_API_URL}/${this.adAccountId}/insights`, {
        params: {
          access_token: this.accessToken,
          time_range: JSON.stringify({
            since: startDate,
            until: endDate
          }),
          time_increment: 1, // Daily breakdown
          fields: [
            'date_start',
            'date_stop',
            'spend',
            'impressions',
            'clicks',
            'ctr',
            'cpc',
            'cpm',
            'actions',
            'action_values',
            'cost_per_action_type',
            'video_3_sec_watched_actions',
            'video_thruplay_watched_actions'
          ].join(','),
          level: 'account'
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching Facebook insights:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Parse Facebook actions to extract purchase conversions
   * @param {Array} actions - Facebook actions array
   * @returns {number}
   */
  parseConversions(actions) {
    if (!actions || !Array.isArray(actions)) return 0;

    const purchaseAction = actions.find(action =>
      action.action_type === 'purchase' ||
      action.action_type === 'omni_purchase'
    );

    return purchaseAction ? parseFloat(purchaseAction.value) || 0 : 0;
  }

  /**
   * Parse Facebook action values to extract purchase revenue
   * @param {Array} actionValues - Facebook action_values array
   * @returns {number}
   */
  parseRevenue(actionValues) {
    if (!actionValues || !Array.isArray(actionValues)) return 0;

    const purchaseValue = actionValues.find(action =>
      action.action_type === 'purchase' ||
      action.action_type === 'omni_purchase'
    );

    return purchaseValue ? parseFloat(purchaseValue.value) || 0 : 0;
  }

  /**
   * Parse cost per action by action type (e.g., 'purchase', 'landing_page_view')
   * @param {Array} costPerActionType - Facebook cost_per_action_type array
   * @param {string} actionType - The action type to look for
   * @returns {number}
   */
  parseCostPerAction(costPerActionType, actionType) {
    if (!costPerActionType || !Array.isArray(costPerActionType)) return 0;
    const entry = costPerActionType.find(a => a.action_type === actionType);
    return entry ? parseFloat(entry.value) || 0 : 0;
  }

  /**
   * Parse landing page views from actions array
   * @param {Array} actions - Facebook actions array
   * @returns {number}
   */
  parseLandingPageViews(actions) {
    if (!actions || !Array.isArray(actions)) return 0;
    const entry = actions.find(a => a.action_type === 'landing_page_view');
    return entry ? parseInt(entry.value) || 0 : 0;
  }

  /**
   * Parse 3-second video views
   * @param {Array} videoActions - Facebook video_3_sec_watched_actions array
   * @returns {number}
   */
  parseVideo3SecViews(videoActions) {
    if (!videoActions || !Array.isArray(videoActions)) return 0;
    return videoActions.reduce((sum, a) => sum + (parseInt(a.value) || 0), 0);
  }

  /**
   * Parse thruplay video views
   * @param {Array} thruplayActions - Facebook video_thruplay_watched_actions array
   * @returns {number}
   */
  parseThruplayViews(thruplayActions) {
    if (!thruplayActions || !Array.isArray(thruplayActions)) return 0;
    return thruplayActions.reduce((sum, a) => sum + (parseInt(a.value) || 0), 0);
  }

  /**
   * Get metrics for a date range with calculated values
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array<{date, spend, impressions, clicks, ctr, cpc, conversions, revenue, roas}>>}
   */
  async getMetrics(startDate, endDate) {
    const insights = await this.getInsights(startDate, endDate);

    return insights.map(day => {
      const spend = parseFloat(day.spend) || 0;
      const impressions = parseInt(day.impressions) || 0;
      const clicks = parseInt(day.clicks) || 0;
      const ctr = parseFloat(day.ctr) || 0;
      const cpc = parseFloat(day.cpc) || 0;
      const cpm = parseFloat(day.cpm) || 0;
      const conversions = this.parseConversions(day.actions);
      const revenue = this.parseRevenue(day.action_values);
      const roas = spend > 0 ? revenue / spend : 0;
      const costPerPurchase = this.parseCostPerAction(day.cost_per_action_type, 'purchase');
      const costPerLandingPageView = this.parseCostPerAction(day.cost_per_action_type, 'landing_page_view');
      const landingPageViews = this.parseLandingPageViews(day.actions);
      const video3SecViews = this.parseVideo3SecViews(day.video_3_sec_watched_actions);
      const videoThruplayViews = this.parseThruplayViews(day.video_thruplay_watched_actions);
      const hookRate = impressions > 0 ? (video3SecViews / impressions) * 100 : 0;
      const holdRate = video3SecViews > 0 ? (videoThruplayViews / video3SecViews) * 100 : 0;

      return {
        date: day.date_start,
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        cpm,
        conversions,
        revenue,
        roas,
        costPerPurchase,
        costPerLandingPageView,
        landingPageViews,
        video3SecViews,
        videoThruplayViews,
        hookRate,
        holdRate
      };
    });
  }

  /**
   * Get aggregated metrics for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<{spend, impressions, clicks, ctr, cpc, conversions, revenue, roas}>}
   */
  async getAggregatedMetrics(startDate, endDate) {
    const dailyMetrics = await this.getMetrics(startDate, endDate);

    const totals = dailyMetrics.reduce((acc, day) => ({
      spend: acc.spend + day.spend,
      impressions: acc.impressions + day.impressions,
      clicks: acc.clicks + day.clicks,
      conversions: acc.conversions + day.conversions,
      revenue: acc.revenue + day.revenue
    }), {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0
    });

    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      roas: totals.spend > 0 ? totals.revenue / totals.spend : 0
    };
  }
}

export default FacebookAdsIntegration;
