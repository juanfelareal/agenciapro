import axios from 'axios';

/**
 * Shopify Integration
 * Connects to Shopify Admin API to fetch store orders and sales metrics
 */
class ShopifyIntegration {
  constructor(storeUrl, accessToken) {
    // Normalize store URL
    this.storeUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.accessToken = accessToken;
    this.apiVersion = '2024-01';
    this.baseUrl = `https://${this.storeUrl}/admin/api/${this.apiVersion}`;
  }

  /**
   * Make authenticated request to Shopify API
   * @param {string} endpoint - API endpoint
   * @param {object} params - Query parameters
   * @returns {Promise<object>}
   */
  async request(endpoint, params = {}) {
    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      },
      params
    });
    return response.data;
  }

  /**
   * Test connection to Shopify API
   * @returns {Promise<{success: boolean, storeName?: string, error?: string}>}
   */
  async testConnection() {
    try {
      const data = await this.request('/shop.json');

      if (data && data.shop) {
        return {
          success: true,
          storeName: data.shop.name,
          email: data.shop.email,
          currency: data.shop.currency,
          timezone: data.shop.iana_timezone
        };
      }

      return { success: false, error: 'No se pudo obtener información de la tienda' };
    } catch (error) {
      const errorMessage = error.response?.data?.errors || error.message;
      return { success: false, error: typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage };
    }
  }

  /**
   * Get orders for a date range with pagination
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>}
   */
  async getOrders(startDate, endDate) {
    const allOrders = [];
    let pageInfo = null;
    let hasNextPage = true;

    // Convert dates to ISO format for Shopify API
    const createdAtMin = `${startDate}T00:00:00-05:00`; // Colombia timezone
    const createdAtMax = `${endDate}T23:59:59-05:00`;

    while (hasNextPage) {
      try {
        const params = pageInfo
          ? { page_info: pageInfo, limit: 250 }
          : {
            created_at_min: createdAtMin,
            created_at_max: createdAtMax,
            status: 'any',
            limit: 250
          };

        const response = await axios.get(`${this.baseUrl}/orders.json`, {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          },
          params
        });

        const orders = response.data.orders || [];
        allOrders.push(...orders);

        // Check for pagination
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);
          pageInfo = match ? match[1] : null;
          hasNextPage = !!pageInfo;
        } else {
          hasNextPage = false;
        }
      } catch (error) {
        console.error('Error fetching Shopify orders:', error.response?.data || error.message);
        throw error;
      }
    }

    return allOrders;
  }

  /**
   * Calculate metrics from orders
   * @param {Array} orders - Shopify orders array
   * @returns {{revenue, orders, aov, refunds, netRevenue}}
   */
  calculateMetricsFromOrders(orders) {
    let totalRevenue = 0;    // total_price (includes shipping + tax)
    let totalSubtotal = 0;   // subtotal_price (products - discounts, no shipping/tax)
    let totalRefunds = 0;
    let totalTax = 0;
    let totalDiscounts = 0;
    let orderCount = 0;
    let pendingOrders = 0;

    orders.forEach(order => {
      // Skip cancelled orders
      if (order.cancelled_at) return;

      // Count pending/unpaid orders
      if (order.financial_status === 'pending' || order.financial_status === 'authorized' || order.financial_status === 'partially_paid') {
        pendingOrders++;
        return; // Don't count in revenue
      }

      // Count paid orders
      if (order.financial_status === 'paid' || order.financial_status === 'partially_refunded') {
        orderCount++;
        totalRevenue += parseFloat(order.total_price) || 0;
        totalSubtotal += parseFloat(order.subtotal_price) || 0;
        totalTax += parseFloat(order.total_tax) || 0;
        totalDiscounts += parseFloat(order.total_discounts) || 0;

        // Calculate refunds
        if (order.refunds && order.refunds.length > 0) {
          order.refunds.forEach(refund => {
            refund.refund_line_items?.forEach(item => {
              totalRefunds += parseFloat(item.subtotal) || 0;
            });
          });
        }
      }
    });

    const netRevenue = totalSubtotal - totalRefunds;  // Fixed: without shipping/tax
    const aov = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      revenue: totalRevenue,       // "Venta Total" = total_price
      orders: orderCount,
      aov,
      refunds: totalRefunds,
      netRevenue,                  // "Venta Neta" = subtotal - refunds (= Shopify "Ventas netas")
      totalTax,
      totalDiscounts,
      pendingOrders                // Pedidos sin pagar
    };
  }

  /**
   * Get sessions count using Shopify GraphQL Admin API (ShopifyQL)
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<number>}
   */
  async getSessions(startDate, endDate) {
    try {
      const query = `{
        shopifyqlQuery(query: "FROM visits SINCE ${startDate} UNTIL ${endDate} SHOW sum(totalSessions)") {
          __typename
          ... on TableResponse {
            tableData {
              rowData
            }
          }
        }
      }`;

      const response = await axios.post(
        `https://${this.storeUrl}/admin/api/${this.apiVersion}/graphql.json`,
        { query },
        {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      const tableData = response.data?.data?.shopifyqlQuery?.tableData;
      if (tableData?.rowData?.length > 0) {
        return parseInt(tableData.rowData[0]) || 0;
      }
      return 0;
    } catch (error) {
      // Graceful: return 0 if scope read_analytics not available (403)
      console.warn(`Could not fetch sessions for ${this.storeUrl}:`, error.response?.status || error.message);
      return 0;
    }
  }

  /**
   * Get metrics for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<{revenue, orders, aov, refunds, netRevenue, totalTax, totalDiscounts, sessions, conversionRate}>}
   */
  async getMetrics(startDate, endDate) {
    const orders = await this.getOrders(startDate, endDate);
    const metrics = this.calculateMetricsFromOrders(orders);
    const sessions = await this.getSessions(startDate, endDate);
    const conversionRate = sessions > 0 ? (metrics.orders / sessions) * 100 : 0;

    return {
      ...metrics,
      sessions,
      conversionRate
    };
  }

  /**
   * Get top selling products from orders in a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {number} limit - Max products to return (default 10)
   * @returns {Promise<Array<{product_id, title, quantity, revenue, orders}>>}
   */
  async getTopProducts(startDate, endDate, limit = 10) {
    const allOrders = await this.getOrders(startDate, endDate);
    const productMap = {};

    allOrders.forEach(order => {
      // Same filters as calculateMetricsFromOrders
      if (order.cancelled_at) return;
      if (order.financial_status !== 'paid' && order.financial_status !== 'partially_refunded') return;

      const orderCounted = new Set();
      (order.line_items || []).forEach(item => {
        const key = item.product_id || item.title;
        if (!productMap[key]) {
          productMap[key] = {
            product_id: item.product_id,
            title: item.title,
            quantity: 0,
            revenue: 0,
            orders: 0,
          };
        }
        productMap[key].quantity += item.quantity || 0;
        productMap[key].revenue += (parseFloat(item.price) || 0) * (item.quantity || 0);
        if (!orderCounted.has(key)) {
          productMap[key].orders += 1;
          orderCounted.add(key);
        }
      });
    });

    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Get daily metrics breakdown for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array<{date, revenue, orders, aov, refunds, netRevenue}>>}
   */
  async getDailyMetrics(startDate, endDate) {
    const orders = await this.getOrders(startDate, endDate);

    // Group orders by date
    const ordersByDate = {};

    orders.forEach(order => {
      if (order.cancelled_at) return;

      const orderDate = order.created_at.split('T')[0];

      if (!ordersByDate[orderDate]) {
        ordersByDate[orderDate] = [];
      }
      ordersByDate[orderDate].push(order);
    });

    // Calculate metrics for each date
    const dailyMetrics = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOrders = ordersByDate[dateStr] || [];
      const metrics = this.calculateMetricsFromOrders(dayOrders);

      dailyMetrics.push({
        date: dateStr,
        ...metrics
      });
    }

    return dailyMetrics;
  }
}

export default ShopifyIntegration;
