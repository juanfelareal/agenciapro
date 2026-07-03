import axios from 'axios';

const GOOGLE_ADS_API_VERSION = 'v18';
const GOOGLE_ADS_API_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Exchange a refresh token for a short-lived access token.
 * Shared by the integration class and the OAuth routes.
 * @param {string} refreshToken
 * @returns {Promise<string>} access_token
 */
export async function getGoogleAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET no configurados en .env');
  }
  const token = refreshToken || process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!token) {
    throw new Error('No hay refresh_token disponible (ni GOOGLE_ADS_REFRESH_TOKEN configurado)');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: token,
    grant_type: 'refresh_token',
  });

  const response = await axios.post(GOOGLE_OAUTH_TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data.access_token;
}

/** Strip dashes/whitespace from a Google Ads customer id (e.g. "123-456-7890" -> "1234567890"). */
function normalizeCustomerId(id) {
  return String(id || '').replace(/[^0-9]/g, '');
}

const micros = (v) => (parseFloat(v) || 0) / 1_000_000;

/**
 * Google Ads Integration
 * Connects to the Google Ads REST API (GAQL) to fetch ad account metrics.
 * Mirrors the surface of FacebookAdsIntegration so the sync service and routes
 * can treat both platforms the same way.
 */
class GoogleAdsIntegration {
  /**
   * @param {string} refreshToken - OAuth refresh token (falls back to GOOGLE_ADS_REFRESH_TOKEN)
   * @param {string} customerId - Google Ads customer id (the account that owns the metrics)
   * @param {string} [loginCustomerId] - Manager (MCC) id used as login-customer-id header
   */
  constructor(refreshToken, customerId, loginCustomerId = null) {
    this.refreshToken = refreshToken;
    this.customerId = normalizeCustomerId(customerId);
    this.loginCustomerId = loginCustomerId
      ? normalizeCustomerId(loginCustomerId)
      : normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
    this._accessToken = null;
  }

  async _getHeaders() {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN no configurado en .env');
    }
    if (!this._accessToken) {
      this._accessToken = await getGoogleAccessToken(this.refreshToken);
    }
    const headers = {
      Authorization: `Bearer ${this._accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    if (this.loginCustomerId) {
      headers['login-customer-id'] = this.loginCustomerId;
    }
    return headers;
  }

  /**
   * Run a GAQL query against this customer and return a flat array of rows.
   * Uses searchStream so we don't have to page manually.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    const headers = await this._getHeaders();
    const url = `${GOOGLE_ADS_API_URL}/customers/${this.customerId}/googleAds:searchStream`;
    const response = await axios.post(url, { query }, { headers });
    // searchStream returns an array of batches, each with a `results` array
    const batches = Array.isArray(response.data) ? response.data : [response.data];
    const rows = [];
    for (const batch of batches) {
      if (batch?.results) rows.push(...batch.results);
    }
    return rows;
  }

  /**
   * Test connection by reading the customer's descriptive name.
   * @returns {Promise<{success: boolean, accountName?: string, error?: string}>}
   */
  async testConnection() {
    try {
      const rows = await this.search(
        'SELECT customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1'
      );
      const c = rows[0]?.customer;
      if (c) {
        return {
          success: true,
          accountName: c.descriptiveName || `Cuenta ${this.customerId}`,
          currency: c.currencyCode,
          timezone: c.timeZone,
        };
      }
      return { success: false, error: 'No se pudo obtener información de la cuenta' };
    } catch (error) {
      const apiError = error.response?.data?.error?.message
        || error.response?.data?.[0]?.error?.message
        || error.message;
      return { success: false, error: apiError };
    }
  }

  _parseDailyRow(row) {
    const m = row.metrics || {};
    const spend = micros(m.costMicros);
    const impressions = parseInt(m.impressions) || 0;
    const clicks = parseInt(m.clicks) || 0;
    const ctr = (parseFloat(m.ctr) || 0) * 100; // GAQL ctr is a 0-1 ratio
    const cpc = micros(m.averageCpc);
    const cpm = micros(m.averageCpm);
    const conversions = parseFloat(m.conversions) || 0;
    const revenue = parseFloat(m.conversionsValue) || 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const costPerConversion = micros(m.costPerConversion);
    return {
      date: row.segments?.date,
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      cpm,
      conversions,
      revenue,
      roas,
      costPerConversion,
    };
  }

  /**
   * Get daily metrics for a date range.
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Promise<Array>}
   */
  async getMetrics(startDate, endDate) {
    const query = `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;
    const rows = await this.search(query);
    return rows.map((row) => this._parseDailyRow(row));
  }

  /**
   * Get aggregated metrics for a date range.
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Promise<object>}
   */
  async getAggregatedMetrics(startDate, endDate) {
    const daily = await this.getMetrics(startDate, endDate);
    const totals = daily.reduce(
      (acc, d) => ({
        spend: acc.spend + d.spend,
        impressions: acc.impressions + d.impressions,
        clicks: acc.clicks + d.clicks,
        conversions: acc.conversions + d.conversions,
        revenue: acc.revenue + d.revenue,
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
    );
    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
      cost_per_conversion: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    };
  }

  /**
   * Get campaign-level insights for a date range (on-demand, not stored).
   * Mirrors FacebookAdsIntegration.getAdLevelInsights shape where it makes sense.
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Promise<Array>} Sorted by spend DESC
   */
  async getCampaignInsights(startDate, endDate) {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;
    const rows = await this.search(query);

    const channelLabels = {
      SEARCH: 'Búsqueda',
      DISPLAY: 'Display',
      SHOPPING: 'Shopping',
      VIDEO: 'Video',
      MULTI_CHANNEL: 'Performance Max',
      PERFORMANCE_MAX: 'Performance Max',
      LOCAL: 'Local',
      SMART: 'Smart',
      DISCOVERY: 'Demand Gen',
    };

    // Aggregate by campaign (GAQL returns one row per segment combination)
    const byCampaign = new Map();
    for (const row of rows) {
      const c = row.campaign || {};
      const m = row.metrics || {};
      const id = c.id;
      if (!id) continue;
      if (!byCampaign.has(id)) {
        byCampaign.set(id, {
          campaign_id: String(id),
          campaign_name: c.name || 'Sin nombre',
          campaign_status: c.status || null,
          channel_type: c.advertisingChannelType || null,
          channel_label: channelLabels[c.advertisingChannelType] || c.advertisingChannelType || null,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
        });
      }
      const agg = byCampaign.get(id);
      agg.spend += micros(m.costMicros);
      agg.impressions += parseInt(m.impressions) || 0;
      agg.clicks += parseInt(m.clicks) || 0;
      agg.conversions += parseFloat(m.conversions) || 0;
      agg.revenue += parseFloat(m.conversionsValue) || 0;
    }

    const campaigns = [...byCampaign.values()].map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      cost_per_conversion: c.conversions > 0 ? c.spend / c.conversions : 0,
    }));

    campaigns.sort((a, b) => b.spend - a.spend);
    return campaigns;
  }
}

/**
 * List all Google Ads accounts a refresh token can access, including child
 * accounts under manager (MCC) accounts. Used by the OAuth account picker.
 * @param {string} refreshToken
 * @returns {Promise<Array<{customer_id, name, login_customer_id, is_manager, currency}>>}
 */
export async function listAccessibleCustomers(refreshToken) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN no configurado en .env');
  }
  const accessToken = await getGoogleAccessToken(refreshToken);
  const baseHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };

  // 1. Top-level accessible customers
  const listResp = await axios.get(`${GOOGLE_ADS_API_URL}/customers:listAccessibleCustomers`, {
    headers: baseHeaders,
  });
  const resourceNames = listResp.data?.resourceNames || [];
  const topLevelIds = resourceNames.map((rn) => rn.split('/')[1]).filter(Boolean);

  const accounts = new Map();

  // 2. For each accessible customer, enumerate itself + children via customer_client
  for (const topId of topLevelIds) {
    try {
      const resp = await axios.post(
        `${GOOGLE_ADS_API_URL}/customers/${topId}/googleAds:searchStream`,
        {
          query: `
            SELECT
              customer_client.id,
              customer_client.descriptive_name,
              customer_client.manager,
              customer_client.currency_code,
              customer_client.status
            FROM customer_client
            WHERE customer_client.status = 'ENABLED'
          `,
        },
        { headers: { ...baseHeaders, 'login-customer-id': topId } }
      );
      const batches = Array.isArray(resp.data) ? resp.data : [resp.data];
      for (const batch of batches) {
        for (const row of batch?.results || []) {
          const cc = row.customerClient || {};
          const id = String(cc.id || '');
          if (!id) continue;
          // Skip manager accounts — they don't have spend metrics of their own
          if (cc.manager) continue;
          accounts.set(id, {
            customer_id: id,
            name: cc.descriptiveName || `Cuenta ${id}`,
            // login-customer-id is the manager we queried through (only needed if different)
            login_customer_id: id === topId ? null : topId,
            is_manager: false,
            currency: cc.currencyCode || null,
          });
        }
      }
    } catch (e) {
      // If the customer can't be expanded (e.g. no access), fall back to itself
      if (!accounts.has(topId)) {
        accounts.set(topId, {
          customer_id: topId,
          name: `Cuenta ${topId}`,
          login_customer_id: null,
          is_manager: false,
          currency: null,
        });
      }
    }
  }

  return [...accounts.values()];
}

export default GoogleAdsIntegration;
