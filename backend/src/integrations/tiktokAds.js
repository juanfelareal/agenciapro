import axios from 'axios';

const TIKTOK_API_URL = 'https://business-api.tiktok.com/open_api/v1.3';

/**
 * Exchange an OAuth auth_code for a long-lived access token.
 * TikTok access tokens do not expire by default, so we store the access_token
 * directly (no refresh flow). Shared by the OAuth routes.
 * @param {string} authCode
 * @returns {Promise<{accessToken: string, advertiserIds: string[], scope: any}>}
 */
export async function exchangeTikTokAuthCode(authCode) {
  const appId = process.env.TIKTOK_APP_ID;
  const secret = process.env.TIKTOK_APP_SECRET;
  if (!appId || !secret) {
    throw new Error('TIKTOK_APP_ID / TIKTOK_APP_SECRET no configurados en .env');
  }

  const response = await axios.post(`${TIKTOK_API_URL}/oauth2/access_token/`, {
    app_id: appId,
    secret,
    auth_code: authCode,
    grant_type: 'authorization_code',
  }, { headers: { 'Content-Type': 'application/json' } });

  if (response.data?.code !== 0) {
    throw new Error(response.data?.message || 'Error al intercambiar el código de TikTok');
  }

  const data = response.data.data || {};
  return {
    accessToken: data.access_token,
    advertiserIds: data.advertiser_ids || [],
    scope: data.scope || null,
  };
}

/**
 * List advertiser accounts (with names) authorized for an access token.
 * @param {string} accessToken
 * @returns {Promise<Array<{advertiser_id, advertiser_name}>>}
 */
export async function listTikTokAdvertisers(accessToken) {
  const appId = process.env.TIKTOK_APP_ID;
  const secret = process.env.TIKTOK_APP_SECRET;
  if (!appId || !secret) {
    throw new Error('TIKTOK_APP_ID / TIKTOK_APP_SECRET no configurados en .env');
  }

  const response = await axios.get(`${TIKTOK_API_URL}/oauth2/advertiser/get/`, {
    params: { access_token: accessToken, app_id: appId, secret },
    headers: { 'Access-Token': accessToken },
  });

  if (response.data?.code !== 0) {
    throw new Error(response.data?.message || 'Error al listar anunciantes de TikTok');
  }

  const list = response.data.data?.list || [];
  return list.map((a) => ({
    advertiser_id: String(a.advertiser_id),
    advertiser_name: a.advertiser_name || `Anunciante ${a.advertiser_id}`,
  }));
}

const num = (v) => parseFloat(v) || 0;
const int = (v) => parseInt(v) || 0;

/**
 * TikTok Ads Integration
 * Connects to the TikTok Marketing API (v1.3) to fetch ad account metrics.
 * Mirrors the surface of FacebookAdsIntegration / GoogleAdsIntegration so the
 * sync service and routes can treat every ad platform the same way.
 */
class TikTokAdsIntegration {
  /**
   * @param {string} accessToken - TikTok access token (falls back to TIKTOK_SYSTEM_ACCESS_TOKEN)
   * @param {string} advertiserId - TikTok advertiser id
   */
  constructor(accessToken, advertiserId) {
    this.accessToken = accessToken || process.env.TIKTOK_SYSTEM_ACCESS_TOKEN;
    this.advertiserId = String(advertiserId || '');
  }

  _headers() {
    if (!this.accessToken) {
      throw new Error('No hay access_token de TikTok disponible');
    }
    return { 'Access-Token': this.accessToken, 'Content-Type': 'application/json' };
  }

  /**
   * The metrics we request from TikTok's integrated report.
   */
  static get REPORT_METRICS() {
    return [
      'spend',
      'impressions',
      'clicks',
      'ctr',
      'cpc',
      'cpm',
      'conversion',
      'cost_per_conversion',
      'complete_payment',
      'total_complete_payment_rate',
      'total_onsite_shopping_value',
      'complete_payment_roas',
    ];
  }

  /**
   * Test connection by reading the advertiser's info.
   * @returns {Promise<{success: boolean, accountName?: string, error?: string}>}
   */
  async testConnection() {
    try {
      const response = await axios.get(`${TIKTOK_API_URL}/advertiser/info/`, {
        params: {
          advertiser_ids: JSON.stringify([this.advertiserId]),
          fields: JSON.stringify(['name', 'currency', 'timezone', 'status']),
        },
        headers: this._headers(),
      });
      if (response.data?.code !== 0) {
        return { success: false, error: response.data?.message || 'Error desconocido' };
      }
      const info = response.data.data?.list?.[0];
      if (info) {
        return {
          success: true,
          accountName: info.name || `Anunciante ${this.advertiserId}`,
          currency: info.currency,
          timezone: info.timezone,
        };
      }
      return { success: false, error: 'No se pudo obtener información del anunciante' };
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      return { success: false, error: msg };
    }
  }

  /**
   * Map a TikTok report row (metrics object) into the normalized metric shape.
   */
  _parseMetrics(m = {}) {
    const spend = num(m.spend);
    const impressions = int(m.impressions);
    const clicks = int(m.clicks);
    const ctr = num(m.ctr); // TikTok already reports ctr as a percentage
    const cpc = num(m.cpc);
    const cpm = num(m.cpm);
    const conversions = num(m.conversion);
    const costPerConversion = num(m.cost_per_conversion);
    // Revenue: prefer onsite shopping value; fall back to roas * spend
    let revenue = num(m.total_onsite_shopping_value);
    const roasReported = num(m.complete_payment_roas);
    if (revenue === 0 && roasReported > 0) revenue = roasReported * spend;
    const roas = spend > 0 ? revenue / spend : roasReported;
    return {
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
   * Run an integrated report query.
   * @param {object} opts - { dataLevel, dimensions, startDate, endDate }
   * @returns {Promise<Array>} raw report rows
   */
  async _getReport({ dataLevel, dimensions, startDate, endDate }) {
    let page = 1;
    const pageSize = 200;
    let rows = [];
    let totalPages = 1;

    do {
      const response = await axios.get(`${TIKTOK_API_URL}/report/integrated/get/`, {
        params: {
          advertiser_id: this.advertiserId,
          report_type: 'BASIC',
          data_level: dataLevel,
          dimensions: JSON.stringify(dimensions),
          metrics: JSON.stringify(TikTokAdsIntegration.REPORT_METRICS),
          start_date: startDate,
          end_date: endDate,
          page,
          page_size: pageSize,
        },
        headers: this._headers(),
      });

      if (response.data?.code !== 0) {
        throw new Error(response.data?.message || 'Error al obtener reporte de TikTok');
      }

      const data = response.data.data || {};
      rows = rows.concat(data.list || []);
      totalPages = data.page_info?.total_page || 1;
      page += 1;
    } while (page <= totalPages);

    return rows;
  }

  /**
   * Get daily metrics for a date range (account level).
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Promise<Array>}
   */
  async getMetrics(startDate, endDate) {
    const rows = await this._getReport({
      dataLevel: 'AUCTION_ADVERTISER',
      dimensions: ['stat_time_day'],
      startDate,
      endDate,
    });
    return rows.map((row) => ({
      date: (row.dimensions?.stat_time_day || '').split(' ')[0],
      ...this._parseMetrics(row.metrics),
    }));
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
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Promise<Array>} Sorted by spend DESC
   */
  async getCampaignInsights(startDate, endDate) {
    const rows = await this._getReport({
      dataLevel: 'AUCTION_CAMPAIGN',
      dimensions: ['campaign_id'],
      startDate,
      endDate,
    });

    // Fetch campaign names
    let nameById = {};
    try {
      const ids = [...new Set(rows.map((r) => r.dimensions?.campaign_id).filter(Boolean))];
      if (ids.length > 0) {
        const resp = await axios.get(`${TIKTOK_API_URL}/campaign/get/`, {
          params: {
            advertiser_id: this.advertiserId,
            filtering: JSON.stringify({ campaign_ids: ids }),
            fields: JSON.stringify(['campaign_id', 'campaign_name', 'operation_status']),
            page_size: 1000,
          },
          headers: this._headers(),
        });
        for (const c of resp.data?.data?.list || []) {
          nameById[String(c.campaign_id)] = {
            name: c.campaign_name,
            status: c.operation_status,
          };
        }
      }
    } catch (e) {
      // Names are optional
    }

    const campaigns = rows.map((row) => {
      const id = String(row.dimensions?.campaign_id || '');
      const m = this._parseMetrics(row.metrics);
      const meta = nameById[id] || {};
      return {
        campaign_id: id,
        campaign_name: meta.name || `Campaña ${id}`,
        campaign_status: meta.status || null,
        ...m,
        cost_per_conversion: m.conversions > 0 ? m.spend / m.conversions : 0,
      };
    });

    campaigns.sort((a, b) => b.spend - a.spend);
    return campaigns;
  }
}

export default TikTokAdsIntegration;
