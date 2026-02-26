import axios from 'axios';

const FB_GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

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
            'video_play_actions',
            'video_thruplay_watched_actions',
            'inline_link_clicks'
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
   * Parse add-to-cart actions from actions array
   * @param {Array} actions - Facebook actions array
   * @returns {number}
   */
  parseAddToCart(actions) {
    if (!actions || !Array.isArray(actions)) return 0;
    const entry = actions.find(a => a.action_type === 'add_to_cart' || a.action_type === 'omni_add_to_cart');
    return entry ? parseInt(entry.value) || 0 : 0;
  }

  /**
   * Parse 3-second video views from video_play_actions or actions array
   * (video_3_sec_watched_actions was deprecated in API v20+)
   * @param {Array} videoPlayActions - Facebook video_play_actions array
   * @param {Array} actions - Facebook actions array (fallback)
   * @returns {number}
   */
  parseVideo3SecViews(videoPlayActions, actions) {
    // Try video_play_actions first (contains video_view action type)
    if (videoPlayActions && Array.isArray(videoPlayActions)) {
      const entry = videoPlayActions.find(a => a.action_type === 'video_view');
      if (entry) return parseInt(entry.value) || 0;
    }
    // Fallback: check actions array for video_view
    if (actions && Array.isArray(actions)) {
      const entry = actions.find(a => a.action_type === 'video_view');
      if (entry) return parseInt(entry.value) || 0;
    }
    return 0;
  }

  /**
   * Parse thruplay video views from video_thruplay_watched_actions field
   * @param {Array} videoThruplayActions - Facebook video_thruplay_watched_actions array
   * @param {Array} actions - Facebook actions array (fallback)
   * @returns {number}
   */
  parseThruplayViews(videoThruplayActions, actions) {
    // Primary: use dedicated video_thruplay_watched_actions field
    if (videoThruplayActions && Array.isArray(videoThruplayActions)) {
      const entry = videoThruplayActions.find(a => a.action_type === 'video_view');
      if (entry) return parseInt(entry.value) || 0;
    }
    // Fallback: check actions array for video_view (less reliable)
    if (actions && Array.isArray(actions)) {
      const entry = actions.find(a => a.action_type === 'video_view');
      // Only use this if we didn't find it in video_play_actions
      // to avoid double-counting with 3-sec views
    }
    return 0;
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
      const linkClicks = parseInt(day.inline_link_clicks) || 0;
      const addToCart = this.parseAddToCart(day.actions);
      const video3SecViews = this.parseVideo3SecViews(day.video_play_actions, day.actions);
      const videoThruplayViews = this.parseThruplayViews(day.video_thruplay_watched_actions, day.actions);
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
        linkClicks,
        addToCart,
        video3SecViews,
        videoThruplayViews,
        hookRate,
        holdRate
      };
    });
  }

  /**
   * Get demographic breakdown insights (age × gender) for a date range
   * @param {string} startDate
   * @param {string} endDate
   * @returns {Promise<Array<{age, gender, spend, impressions, clicks, conversions, revenue}>>}
   */
  async getDemographicInsights(startDate, endDate) {
    try {
      const response = await axios.get(`${FB_GRAPH_API_URL}/${this.adAccountId}/insights`, {
        params: {
          access_token: this.accessToken,
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          fields: ['spend', 'impressions', 'clicks', 'actions', 'action_values'].join(','),
          breakdowns: 'age,gender',
          level: 'account',
          limit: 200
        }
      });

      const data = response.data.data || [];
      return data.map(row => ({
        age: row.age,
        gender: row.gender,
        spend: parseFloat(row.spend) || 0,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        conversions: this.parseConversions(row.actions),
        revenue: this.parseRevenue(row.action_values),
      }));
    } catch (error) {
      console.error('Error fetching demographic insights:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get ad-level insights for a date range (on-demand, not stored in DB)
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of ad objects with metrics, sorted by spend DESC
   */
  async getAdLevelInsights(startDate, endDate) {
    let allData = [];
    let url = `${FB_GRAPH_API_URL}/${this.adAccountId}/insights`;
    let params = {
      access_token: this.accessToken,
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      fields: [
        'ad_id',
        'ad_name',
        'adset_name',
        'campaign_name',
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpc',
        'cpm',
        'frequency',
        'unique_ctr',
        'inline_link_clicks',
        'actions',
        'action_values',
        'cost_per_action_type',
        'video_play_actions',
        'video_thruplay_watched_actions'
      ].join(','),
      level: 'ad',
      limit: 500
    };

    // Fetch with pagination
    let hasNext = true;
    while (hasNext) {
      const response = await axios.get(url, { params });
      const data = response.data.data || [];
      allData = allData.concat(data);

      if (response.data.paging?.next) {
        url = response.data.paging.next;
        params = {}; // next URL already contains all params
      } else {
        hasNext = false;
      }
    }

    // Parse each ad's metrics
    const ads = allData.map(ad => {
      const spend = parseFloat(ad.spend) || 0;
      const impressions = parseInt(ad.impressions) || 0;
      const clicks = parseInt(ad.clicks) || 0;
      const ctr = parseFloat(ad.ctr) || 0;
      const cpc = parseFloat(ad.cpc) || 0;
      const cpm = parseFloat(ad.cpm) || 0;
      const frequency = parseFloat(ad.frequency) || 0;
      const uniqueCtr = parseFloat(ad.unique_ctr) || 0;
      const linkClicks = parseInt(ad.inline_link_clicks) || 0;
      const landingPageViews = this.parseLandingPageViews(ad.actions);
      const conversions = this.parseConversions(ad.actions);
      const revenue = this.parseRevenue(ad.action_values);
      const roas = spend > 0 ? revenue / spend : 0;
      const costPerPurchase = this.parseCostPerAction(ad.cost_per_action_type, 'purchase');
      const video3SecViews = this.parseVideo3SecViews(ad.video_play_actions, ad.actions);
      const videoThruplayViews = this.parseThruplayViews(ad.video_thruplay_watched_actions, ad.actions);
      const hookRate = impressions > 0 ? (video3SecViews / impressions) * 100 : 0;
      const holdRate = video3SecViews > 0 ? (videoThruplayViews / video3SecViews) * 100 : 0;

      return {
        ad_id: ad.ad_id,
        ad_name: ad.ad_name,
        adset_name: ad.adset_name,
        campaign_name: ad.campaign_name,
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        cpm,
        frequency,
        unique_ctr: uniqueCtr,
        link_clicks: linkClicks,
        landing_page_views: landingPageViews,
        conversions,
        revenue,
        roas,
        cost_per_purchase: costPerPurchase,
        hook_rate: hookRate,
        hold_rate: holdRate
      };
    });

    // Fetch preview links and adset budgets in chunks of 50
    const adIds = ads.map(a => a.ad_id);
    const adExtras = {};
    for (let i = 0; i < adIds.length; i += 50) {
      const chunk = adIds.slice(i, i + 50);
      try {
        const response = await axios.get(`${FB_GRAPH_API_URL}/`, {
          params: {
            ids: chunk.join(','),
            fields: 'preview_shareable_link,adset{daily_budget,lifetime_budget}',
            access_token: this.accessToken
          }
        });
        for (const [id, data] of Object.entries(response.data)) {
          const dailyBudget = data.adset?.daily_budget ? parseFloat(data.adset.daily_budget) / 100 : 0;
          const lifetimeBudget = data.adset?.lifetime_budget ? parseFloat(data.adset.lifetime_budget) / 100 : 0;
          adExtras[id] = {
            preview_url: data.preview_shareable_link || null,
            budget: dailyBudget || lifetimeBudget || 0,
            budget_type: dailyBudget ? 'daily' : lifetimeBudget ? 'lifetime' : null
          };
        }
      } catch (e) {
        // Extras are optional — don't fail the whole request
      }
    }

    ads.forEach(ad => {
      const extra = adExtras[ad.ad_id] || {};
      ad.preview_url = extra.preview_url || null;
      ad.budget = extra.budget || 0;
      ad.budget_type = extra.budget_type || null;
    });

    // Sort by spend DESC
    ads.sort((a, b) => b.spend - a.spend);

    return ads;
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
