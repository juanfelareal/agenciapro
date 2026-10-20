import axios from 'axios';

/**
 * WooCommerce (WordPress) Integration
 *
 * Misma interfaz que ShopifyIntegration para que el resto de Orbit (sync diario,
 * métricas, productos/COGS, top productos) funcione sin cambios:
 *   testConnection, getOrders, calculateMetricsFromOrders, getMetrics, getMetricsAndOrders,
 *   aggregateProductSales, getProductSales, getTopProducts, getProductsWithCosts, getDailyMetrics, getSessions.
 *
 * Auth: REST API de WooCommerce (wc/v3) con consumer key/secret. Se intenta Basic Auth
 * (HTTPS) y, si el hosting elimina el header Authorization, se reintenta con query params.
 *
 * Estados de pedido WooCommerce:
 *   pagados   → processing, completed      ("venta confirmada")
 *   pendientes→ pending, on-hold
 *   excluidos → cancelled, failed, trash, checkout-draft
 *   refunded  → reembolso total: se excluye de confirmados (igual que Shopify "refunded")
 */
const PAID = new Set(['processing', 'completed']);
const PENDING = new Set(['pending', 'on-hold']);
const EXCLUDED = new Set(['cancelled', 'failed', 'trash', 'checkout-draft', 'auto-draft', 'draft']);

// Claves de meta que guardan el costo del producto (plugins más usados)
const COST_META_KEYS = ['_wc_cog_cost', '_alg_wc_cog_cost', 'cost_price', '_cost_price', '_cost', 'cost', '_wc_cog_cost_variable', '_wpr_cost'];

class WooCommerceIntegration {
  constructor(storeUrl, consumerKey, consumerSecret) {
    this.storeUrl = WooCommerceIntegration.normalizeStoreUrl(storeUrl);
    if (!this.storeUrl) throw new Error('URL de la tienda WooCommerce inválida');
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.baseUrl = `${this.storeUrl}/wp-json/wc/v3`;
    this.authMode = 'basic'; // 'basic' | 'query'
  }

  /** https://mitienda.com (sin barra final, siempre https) */
  static normalizeStoreUrl(url) {
    if (!url) return '';
    let u = String(url).trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    u = u.replace(/\/+$/, '').replace(/\/wp-json.*$/i, '').replace(/\/wp-admin.*$/i, '');
    try {
      const parsed = new URL(u);
      parsed.protocol = 'https:';
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch {
      return '';
    }
  }

  async request(endpoint, params = {}, { full = false } = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const doRequest = (mode) => axios.get(url, {
      timeout: 60000,
      params: mode === 'query' ? { ...params, consumer_key: this.consumerKey, consumer_secret: this.consumerSecret } : params,
      auth: mode === 'basic' ? { username: this.consumerKey, password: this.consumerSecret } : undefined,
      headers: { Accept: 'application/json', 'User-Agent': 'Orbit-LAREAL/1.0' },
    });
    try {
      const res = await doRequest(this.authMode);
      return full ? res : res.data;
    } catch (error) {
      const status = error.response?.status;
      // Algunos hostings quitan el header Authorization → reintentar con query params
      if (this.authMode === 'basic' && (status === 401 || status === 403)) {
        this.authMode = 'query';
        const res = await doRequest('query');
        return full ? res : res.data;
      }
      throw error;
    }
  }

  static errorMessage(error) {
    const data = error.response?.data;
    const msg = data?.message || (typeof data === 'string' && data.length < 300 ? data : null) || error.message;
    if (error.response?.status === 401) return `Credenciales rechazadas (401): ${msg}`;
    if (error.response?.status === 404) return 'No se encontró la API de WooCommerce (/wp-json/wc/v3). ¿Es una tienda WooCommerce con enlaces permanentes activos?';
    return msg;
  }

  async testConnection() {
    try {
      const sys = await this.request('/system_status');
      const settings = sys?.settings || {};
      const env = sys?.environment || {};
      return {
        success: true,
        storeName: env.site_title || env.home_url || this.storeUrl,
        currency: settings.currency || null,
        timezone: env.timezone || null,
        wcVersion: env.version || null,
        wpVersion: env.wp_version || null,
      };
    } catch (error) {
      // system_status requiere permisos de admin: probamos con un endpoint de solo lectura
      try {
        const res = await this.request('/orders', { per_page: 1 }, { full: true });
        return {
          success: true,
          storeName: this.storeUrl.replace(/^https?:\/\//, ''),
          currency: null,
          timezone: null,
          totalOrders: Number(res.headers?.['x-wp-total']) || null,
        };
      } catch (err2) {
        return { success: false, error: WooCommerceIntegration.errorMessage(err2) };
      }
    }
  }

  /**
   * Pedidos creados en el rango (fechas en la zona horaria de la tienda). Paginación por página.
   */
  async getOrders(startDate, endDate) {
    const all = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await this.request('/orders', {
        after: `${startDate}T00:00:00`,
        before: `${endDate}T23:59:59`,
        status: 'any',
        per_page: 100,
        page,
        orderby: 'date',
        order: 'asc',
      }, { full: true });
      const orders = Array.isArray(res.data) ? res.data : [];
      all.push(...orders);
      totalPages = Number(res.headers?.['x-wp-totalpages']) || 1;
      page += 1;
    } while (page <= totalPages && page <= 200);
    return all;
  }

  static orderDate(order) {
    return String(order.date_created || order.date_created_gmt || '').slice(0, 10);
  }

  static refundTotal(order) {
    return (order.refunds || []).reduce((s, r) => s + Math.abs(parseFloat(r.total) || 0), 0);
  }

  /** Misma forma de retorno que ShopifyIntegration.calculateMetricsFromOrders */
  calculateMetricsFromOrders(orders) {
    let confirmedRevenue = 0;
    let confirmedProductNet = 0;
    let allOrdersRevenue = 0;
    let totalRefunds = 0;
    let shippingCollected = 0;
    let totalTax = 0;
    let totalDiscounts = 0;
    let confirmedOrderCount = 0;
    let pendingOrders = 0;
    let allOrderCount = 0;
    const uniqueCustomers = new Set();

    for (const order of orders) {
      const status = String(order.status || '').toLowerCase();
      if (EXCLUDED.has(status)) continue;

      const total = parseFloat(order.total) || 0;
      allOrdersRevenue += total;
      allOrderCount += 1;

      if (PENDING.has(status)) { pendingOrders += 1; continue; }
      if (!PAID.has(status)) continue; // refunded u otros estados personalizados

      confirmedOrderCount += 1;
      confirmedRevenue += total;
      shippingCollected += (parseFloat(order.shipping_total) || 0);
      totalTax += (parseFloat(order.total_tax) || 0);
      totalDiscounts += (parseFloat(order.discount_total) || 0);
      // Venta neta: líneas de producto (ya con descuento, sin impuesto ni envío)
      confirmedProductNet += (order.line_items || []).reduce((s, li) => s + (parseFloat(li.total) || 0), 0);
      totalRefunds += WooCommerceIntegration.refundTotal(order);

      const customerKey = order.customer_id ? `c:${order.customer_id}` : (order.billing?.email ? `e:${order.billing.email.toLowerCase()}` : null);
      if (customerKey) uniqueCustomers.add(customerKey);
    }

    const confirmedNetRevenue = confirmedProductNet - totalRefunds;
    const aov = confirmedOrderCount > 0 ? confirmedRevenue / confirmedOrderCount : 0;

    return {
      revenue: confirmedRevenue,
      orders: confirmedOrderCount,
      aov,
      refunds: totalRefunds,
      netRevenue: confirmedNetRevenue,
      totalTax,
      totalDiscounts,
      totalDiscountsNet: totalDiscounts, // discount_total en Woo ya viene sin impuesto
      pendingOrders,
      allOrdersRevenue,
      allOrderCount,
      customers: uniqueCustomers.size,
      shippingCollected,
    };
  }

  /** WooCommerce no expone sesiones por API (sin analytics): 0 */
  async getSessions() { return 0; }
  async getSessionsWithDiagnostics() { return { sessions: 0, source: 'woocommerce', error: 'WooCommerce no expone sesiones por API' }; }

  async getMetrics(startDate, endDate) {
    const orders = await this.getOrders(startDate, endDate);
    return { ...this.calculateMetricsFromOrders(orders), sessions: 0, conversionRate: 0 };
  }

  async getMetricsAndOrders(startDate, endDate) {
    const orders = await this.getOrders(startDate, endDate);
    return { metrics: { ...this.calculateMetricsFromOrders(orders), sessions: 0, conversionRate: 0 }, orders };
  }

  /**
   * Unidades / ingreso por producto-variación por día (pedidos pagados).
   * Claves compatibles con shopify_products: shopify_variant_id = variation_id || product_id.
   */
  aggregateProductSales(orders) {
    const map = {};
    for (const order of orders) {
      const status = String(order.status || '').toLowerCase();
      if (!PAID.has(status)) continue;
      const date = WooCommerceIntegration.orderDate(order);
      const seenInOrder = new Set();
      for (const li of order.line_items || []) {
        const variantId = String(li.variation_id || li.product_id || `custom:${li.name || 'item'}`);
        const key = `${date}|${variantId}`;
        if (!map[key]) {
          map[key] = {
            date,
            shopify_variant_id: variantId,
            shopify_product_id: String(li.product_id || variantId),
            title: li.parent_name || li.name || 'Producto',
            variant_title: li.variation_id && li.name && li.parent_name && li.name !== li.parent_name ? li.name.replace(li.parent_name, '').replace(/^[\s\-–,]+/, '') || null : null,
            sku: li.sku || null,
            units: 0,
            revenue: 0,
            orders: 0,
          };
        }
        map[key].units += Number(li.quantity) || 0;
        map[key].revenue += parseFloat(li.total) || 0;
        if (!seenInOrder.has(key)) { map[key].orders += 1; seenInOrder.add(key); }
      }
    }
    return Object.values(map);
  }

  async getProductSales(startDate, endDate) {
    const orders = await this.getOrders(startDate, endDate);
    return this.aggregateProductSales(orders);
  }

  async getTopProducts(startDate, endDate, limit = 10) {
    const orders = await this.getOrders(startDate, endDate);
    const productMap = {};
    for (const order of orders) {
      if (!PAID.has(String(order.status || '').toLowerCase())) continue;
      const counted = new Set();
      for (const li of order.line_items || []) {
        const key = li.product_id || li.name;
        if (!productMap[key]) productMap[key] = { product_id: li.product_id, title: li.parent_name || li.name, quantity: 0, revenue: 0, orders: 0 };
        productMap[key].quantity += Number(li.quantity) || 0;
        productMap[key].revenue += parseFloat(li.total) || 0;
        if (!counted.has(key)) { productMap[key].orders += 1; counted.add(key); }
      }
    }
    return Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  static costFromMeta(metaData) {
    for (const key of COST_META_KEYS) {
      const m = (metaData || []).find((x) => x.key === key && x.value !== '' && x.value !== null && x.value !== undefined);
      if (m) { const v = parseFloat(String(m.value).replace(',', '.')); if (!Number.isNaN(v)) return v; }
    }
    return null;
  }

  async listAll(endpoint, params = {}) {
    const out = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await this.request(endpoint, { per_page: 100, page, ...params }, { full: true });
      out.push(...(Array.isArray(res.data) ? res.data : []));
      totalPages = Number(res.headers?.['x-wp-totalpages']) || 1;
      page += 1;
    } while (page <= totalPages && page <= 100);
    return out;
  }

  /**
   * Catálogo (productos simples + variaciones) con el costo si algún plugin de COGS lo guarda en meta.
   * Mismos campos que Shopify para reutilizar shopify_products.
   */
  async getProductsWithCosts() {
    const products = await this.listAll('/products', { status: 'any' });
    const out = [];
    for (const p of products) {
      const base = {
        shopify_product_id: String(p.id),
        title: p.name,
        image_url: p.images?.[0]?.src || null,
        status: p.status === 'publish' ? 'active' : (p.status || null),
      };
      if (p.type === 'variable' && Array.isArray(p.variations) && p.variations.length) {
        let variations = [];
        try { variations = await this.listAll(`/products/${p.id}/variations`, { status: 'any' }); } catch { variations = []; }
        for (const v of variations) {
          out.push({
            ...base,
            shopify_variant_id: String(v.id),
            sku: v.sku || p.sku || null,
            variant_title: (v.attributes || []).map((a) => a.option).filter(Boolean).join(' / ') || null,
            price: parseFloat(v.price) || parseFloat(p.price) || 0,
            cost: WooCommerceIntegration.costFromMeta(v.meta_data) ?? WooCommerceIntegration.costFromMeta(p.meta_data),
            image_url: v.image?.src || base.image_url,
          });
        }
        if (variations.length) continue;
      }
      out.push({
        ...base,
        shopify_variant_id: String(p.id),
        sku: p.sku || null,
        variant_title: null,
        price: parseFloat(p.price) || 0,
        cost: WooCommerceIntegration.costFromMeta(p.meta_data),
      });
    }
    return out;
  }

  /** COGS por día a partir de un mapa variantId → costo (misma firma que Shopify) */
  async calculateCOGS(startDate, endDate, productCostMap) {
    const orders = await this.getOrders(startDate, endDate);
    const cogsPerDay = {};
    const productsWithoutCost = new Set();
    let totalCogs = 0;
    let totalUnits = 0;
    for (const order of orders) {
      if (!PAID.has(String(order.status || '').toLowerCase())) continue;
      const date = WooCommerceIntegration.orderDate(order);
      if (!cogsPerDay[date]) cogsPerDay[date] = { cogs: 0, units: 0, orders: 0 };
      cogsPerDay[date].orders += 1;
      for (const li of order.line_items || []) {
        const variantId = String(li.variation_id || li.product_id);
        const qty = Number(li.quantity) || 0;
        const cost = productCostMap[variantId];
        if (cost !== undefined && cost !== null) {
          cogsPerDay[date].cogs += cost * qty; cogsPerDay[date].units += qty; totalCogs += cost * qty; totalUnits += qty;
        } else {
          productsWithoutCost.add(li.name || `Producto ${variantId}`);
        }
      }
    }
    const dailyCogs = Object.entries(cogsPerDay).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date));
    return { dailyCogs, totalCogs, totalUnits, productsWithoutCost: Array.from(productsWithoutCost) };
  }

  async getDailyMetrics(startDate, endDate) {
    const orders = await this.getOrders(startDate, endDate);
    const byDate = {};
    for (const o of orders) {
      const d = WooCommerceIntegration.orderDate(o);
      (byDate[d] = byDate[d] || []).push(o);
    }
    const out = [];
    for (let d = new Date(`${startDate}T12:00:00`); d.toISOString().slice(0, 10) <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, ...this.calculateMetricsFromOrders(byDate[key] || []), sessions: 0, conversionRate: 0 });
    }
    return out;
  }
}

export default WooCommerceIntegration;
