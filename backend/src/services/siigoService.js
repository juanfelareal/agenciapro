import axios from 'axios';
import db from '../config/database.js';

const SIIGO_API_URL = 'https://api.siigo.com/v1';
const SIIGO_AUTH_URL = 'https://api.siigo.com/auth';

class SiigoService {
  constructor() {
    // Per-org token cache: { orgId: { accessToken, tokenExpiresAt } }
    this.tokenCache = {};
  }

  // Get stored credentials for an organization
  async getCredentials(orgId) {
    return await db.prepare(
      'SELECT * FROM siigo_settings WHERE is_active = 1 AND organization_id = ? ORDER BY id DESC LIMIT 1'
    ).get(orgId);
  }

  // Save credentials
  async saveCredentials(username, accessKey, partnerId = null, orgId) {
    const existing = await this.getCredentials(orgId);
    if (existing) {
      await db.prepare(`
        UPDATE siigo_settings
        SET username = ?, access_key = ?, partner_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(username, accessKey, partnerId, existing.id);
      return existing.id;
    } else {
      const result = await db.prepare(`
        INSERT INTO siigo_settings (username, access_key, partner_id, organization_id)
        VALUES (?, ?, ?, ?)
      `).run(username, accessKey, partnerId, orgId);
      return result.lastInsertRowid;
    }
  }

  // Authenticate and get access token
  async authenticate(orgId) {
    const credentials = await this.getCredentials(orgId);
    if (!credentials) {
      throw new Error('Siigo credentials not configured');
    }

    // Check in-memory cache for this org
    const cached = this.tokenCache[orgId];
    if (cached?.accessToken && cached?.tokenExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(cached.tokenExpiresAt);
      if (now < expiresAt) {
        return cached.accessToken;
      }
    }

    // Check database for cached token
    if (credentials.access_token && credentials.token_expires_at) {
      const now = new Date();
      const expiresAt = new Date(credentials.token_expires_at);
      if (now < expiresAt) {
        this.tokenCache[orgId] = {
          accessToken: credentials.access_token,
          tokenExpiresAt: credentials.token_expires_at
        };
        return credentials.access_token;
      }
    }

    try {
      const authHeaders = { 'Content-Type': 'application/json' };
      if (credentials.partner_id) {
        authHeaders['Partner-Id'] = credentials.partner_id;
      }

      const response = await axios.post(SIIGO_AUTH_URL, {
        username: credentials.username,
        access_key: credentials.access_key
      }, {
        headers: authHeaders
      });

      const accessToken = response.data.access_token;
      // Token is valid for 24 hours, set expiry to 23 hours to be safe
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 23);
      const tokenExpiresAt = expiresAt.toISOString();

      // Cache in memory
      this.tokenCache[orgId] = { accessToken, tokenExpiresAt };

      // Save token to database
      await db.prepare(`
        UPDATE siigo_settings
        SET access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(accessToken, tokenExpiresAt, credentials.id);

      return accessToken;
    } catch (error) {
      console.error('Siigo authentication error:', error.response?.data || error.message);
      throw new Error(`Siigo authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Make authenticated API request
  async apiRequest(orgId, method, endpoint, data = null) {
    const token = await this.authenticate(orgId);
    const credentials = await this.getCredentials(orgId);

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Add Partner-Id if available
      if (credentials?.partner_id) {
        headers['Partner-Id'] = credentials.partner_id;
      }

      const config = {
        method,
        url: `${SIIGO_API_URL}${endpoint}`,
        headers
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Siigo API error (${method} ${endpoint}):`, error.response?.data || error.message);
      throw new Error(error.response?.data?.Errors?.[0]?.Message || error.response?.data?.message || error.message);
    }
  }

  // ========== DOCUMENT TYPES ==========
  async getDocumentTypes(orgId) {
    const data = await this.apiRequest(orgId, 'GET', '/document-types?type=FV');

    for (const doc of data) {
      await db.prepare(`
        INSERT INTO siigo_document_types (siigo_id, code, name, type, active, organization_id)
        VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT (siigo_id, organization_id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, type = EXCLUDED.type, active = 1
      `).run(doc.id, doc.code, doc.name, 'FV', orgId);
    }

    return data;
  }

  // ========== PAYMENT TYPES ==========
  async getPaymentTypes(orgId) {
    const data = await this.apiRequest(orgId, 'GET', '/payment-types?document_type=FV');

    for (const payment of data) {
      await db.prepare(`
        INSERT INTO siigo_payment_types (siigo_id, name, type, active, organization_id)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT (siigo_id, organization_id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, active = 1
      `).run(payment.id, payment.name, payment.type, orgId);
    }

    return data;
  }

  // ========== TAXES ==========
  async getTaxes(orgId) {
    const data = await this.apiRequest(orgId, 'GET', '/taxes');

    for (const tax of data) {
      await db.prepare(`
        INSERT INTO siigo_taxes (siigo_id, name, percentage, active, organization_id)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT (siigo_id, organization_id) DO UPDATE SET name = EXCLUDED.name, percentage = EXCLUDED.percentage, active = 1
      `).run(tax.id, tax.name, tax.percentage, orgId);
    }

    return data;
  }

  // ========== SELLERS ==========
  async getSellers(orgId) {
    return await this.apiRequest(orgId, 'GET', '/users?page_size=100');
  }

  async getDefaultSeller(orgId) {
    const users = await this.getSellers(orgId);
    return users?.results?.[0] || null;
  }

  // ========== PRODUCTS ==========
  async getProducts(orgId, page = 1, pageSize = 25) {
    return await this.apiRequest(orgId, 'GET', `/products?page=${page}&page_size=${pageSize}`);
  }

  async createProduct(orgId, productData) {
    return await this.apiRequest(orgId, 'POST', '/products', productData);
  }

  async getOrCreateDefaultProduct(orgId) {
    const products = await this.getProducts(orgId, 1, 100);

    let serviceProduct = products?.results?.find(p =>
      p.code === 'SERVICIOS' || p.code === 'SRV001' || p.name?.toLowerCase().includes('servicio')
    );

    if (serviceProduct) {
      return serviceProduct;
    }

    if (products?.results?.length > 0) {
      return products.results[0];
    }

    const newProduct = await this.createProduct(orgId, {
      code: 'SERVICIOS',
      name: 'Servicios Profesionales',
      account_group: 1380,
      type: 'Service',
      stock_control: false,
      active: true,
      tax_classification: 'Taxed',
      taxes: [{ id: 12715 }]
    });

    return newProduct;
  }

  // ========== CUSTOMERS ==========
  async getCustomers(orgId, page = 1, pageSize = 25) {
    return await this.apiRequest(orgId, 'GET', `/customers?page=${page}&page_size=${pageSize}`);
  }

  async getCustomerByIdentification(orgId, identification) {
    const data = await this.apiRequest(orgId, 'GET', `/customers?identification=${identification}`);
    return data.results?.[0] || null;
  }

  async createCustomer(orgId, customerData) {
    return await this.apiRequest(orgId, 'POST', '/customers', customerData);
  }

  async updateCustomer(orgId, customerId, customerData) {
    return await this.apiRequest(orgId, 'PUT', `/customers/${customerId}`, customerData);
  }

  async syncCustomer(orgId, client) {
    // Extract numeric identification from NIT or fallback
    const rawNit = client.nit || '';
    const numericNit = rawNit.replace(/[^0-9]/g, '');
    const hasNit = numericNit.length > 0;

    // Determine if company or person
    const isCompany = hasNit || (client.company && client.company !== client.name);

    // Build identification: prefer numeric NIT, otherwise generate from company/name
    const identification = hasNit ? numericNit : (client.company || client.name || '').replace(/[^0-9a-zA-Z]/g, '').substring(0, 20);

    const existingCustomer = await this.getCustomerByIdentification(orgId, identification);

    // Build name array - Siigo expects array format
    const displayName = client.name || client.company || '';
    const nameParts = displayName.trim().split(' ').filter(Boolean);
    const nameArray = isCompany
      ? [client.company || displayName]
      : nameParts.length > 0 ? nameParts : [displayName || 'Cliente'];

    const customerData = {
      type: 'Customer',
      person_type: isCompany ? 'Company' : 'Person',
      id_type: {
        code: isCompany ? '31' : '13'
      },
      identification,
      name: nameArray,
      commercial_name: client.company || displayName,
      contacts: [{
        first_name: nameParts[0] || displayName || 'Cliente',
        last_name: nameParts.slice(1).join(' ') || '',
        email: client.email || '',
        phone: {
          number: client.phone || ''
        }
      }],
      address: {
        city: {
          country_code: 'Co',
          state_code: '11',
          city_code: '11001'
        }
      }
    };

    let siigoCustomer;
    if (existingCustomer) {
      siigoCustomer = await this.updateCustomer(orgId, existingCustomer.id, customerData);
    } else {
      siigoCustomer = await this.createCustomer(orgId, customerData);
    }

    await db.prepare('UPDATE clients SET siigo_id = ? WHERE id = ? AND organization_id = ?').run(siigoCustomer.id, client.id, orgId);

    return siigoCustomer;
  }

  // ========== INVOICES ==========
  async getInvoices(orgId, page = 1, pageSize = 25) {
    return await this.apiRequest(orgId, 'GET', `/invoices?page=${page}&page_size=${pageSize}`);
  }

  async getInvoice(orgId, invoiceId) {
    return await this.apiRequest(orgId, 'GET', `/invoices/${invoiceId}`);
  }

  async getInvoicePdf(orgId, invoiceId) {
    return await this.apiRequest(orgId, 'GET', `/invoices/${invoiceId}/pdf`);
  }

  async createInvoice(orgId, invoiceData) {
    return await this.apiRequest(orgId, 'POST', '/invoices', invoiceData);
  }

  async sendElectronicInvoice(orgId, invoiceId) {
    return await this.apiRequest(orgId, 'POST', `/invoices/${invoiceId}/stamp`);
  }

  async sendInvoiceByEmail(orgId, invoiceId, email) {
    return await this.apiRequest(orgId, 'POST', `/invoices/${invoiceId}/mail`, {
      mail_to: Array.isArray(email) ? email : [email]
    });
  }

  async syncInvoice(orgId, invoice, client, options = {}) {
    // Get document type (use cached or fetch)
    let documentTypes = await db.prepare(
      'SELECT * FROM siigo_document_types WHERE type = ? AND organization_id = ? LIMIT 1'
    ).get('FV', orgId);
    if (!documentTypes) {
      await this.getDocumentTypes(orgId);
      documentTypes = await db.prepare(
        'SELECT * FROM siigo_document_types WHERE type = ? AND organization_id = ? LIMIT 1'
      ).get('FV', orgId);
    }

    // Get payment type (use cached or use default)
    let paymentTypes = await db.prepare(
      'SELECT * FROM siigo_payment_types WHERE organization_id = ? LIMIT 1'
    ).get(orgId);

    // Get product: use specific code if provided, otherwise default
    let product;
    if (invoice.siigo_product_code) {
      const products = await this.getProducts(orgId, 1, 100);
      product = products?.results?.find(p => p.code === invoice.siigo_product_code);
    }
    if (!product) {
      product = await this.getOrCreateDefaultProduct(orgId);
    }

    // Get default seller
    const seller = await this.getDefaultSeller(orgId);

    // Get taxes (use cached or fetch)
    let taxes = await db.prepare(
      'SELECT * FROM siigo_taxes WHERE percentage = 19 AND organization_id = ? LIMIT 1'
    ).get(orgId);
    if (!taxes) {
      await this.getTaxes(orgId);
      taxes = await db.prepare(
        'SELECT * FROM siigo_taxes WHERE percentage = 19 AND organization_id = ? LIMIT 1'
      ).get(orgId);
    }

    // Ensure customer exists in Siigo
    let siigoCustomerId = client.siigo_id;
    if (!siigoCustomerId) {
      const siigoCustomer = await this.syncCustomer(orgId, client);
      siigoCustomerId = siigoCustomer.id;
    }

    // Build the same identification used in syncCustomer
    const rawNit = client.nit || '';
    const numericNit = rawNit.replace(/[^0-9]/g, '');
    const hasNit = numericNit.length > 0;
    const isCompany = hasNit || (client.company && client.company !== client.name);
    const customerIdentification = hasNit
      ? numericNit
      : (client.company || client.name || '').replace(/[^0-9a-zA-Z]/g, '').substring(0, 20);

    // Calculate tax (round to 2 decimal places for Siigo)
    const isWithIva = invoice.invoice_type !== 'sin_iva';
    const baseAmount = isWithIva
      ? Math.round((invoice.amount / 1.19) * 100) / 100
      : invoice.amount;

    const invoiceData = {
      document: {
        id: documentTypes?.siigo_id || 24315
      },
      date: invoice.issue_date,
      customer: {
        person_type: isCompany ? 'Company' : 'Person',
        id_type: {
          code: isCompany ? '31' : '13'
        },
        identification: customerIdentification,
        branch_office: 0
      },
      seller: options.sellerId || seller?.id,
      observations: invoice.notes || `Factura ${invoice.invoice_number} - ${client.company || client.name}`,
      items: [
        {
          code: product?.code || 'SRV001',
          description: invoice.notes || `Servicios profesionales - ${invoice.invoice_number}`,
          quantity: 1,
          price: baseAmount,
          discount: 0,
          taxes: isWithIva && taxes ? [{ id: taxes.siigo_id }] : []
        }
      ],
      payments: [
        {
          id: paymentTypes?.siigo_id || 5636,
          value: invoice.amount,
          due_date: invoice.due_date || invoice.issue_date
        }
      ],
      stamp: {
        send: options.sendElectronic !== false
      }
    };

    const siigoInvoice = await this.createInvoice(orgId, invoiceData);

    await db.prepare(`
      UPDATE invoices
      SET siigo_id = ?, siigo_status = 'sent', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(siigoInvoice.id, invoice.id, orgId);

    return siigoInvoice;
  }

  // ========== SYNC ALL REFERENCE DATA ==========
  async syncReferenceData(orgId) {
    const results = {
      documentTypes: await this.getDocumentTypes(orgId),
      paymentTypes: await this.getPaymentTypes(orgId),
      taxes: await this.getTaxes(orgId)
    };

    const credentials = await this.getCredentials(orgId);
    if (credentials) {
      await db.prepare(`
        UPDATE siigo_settings
        SET last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(credentials.id);
    }

    return results;
  }

  // Test connection
  async testConnection(orgId) {
    try {
      await this.authenticate(orgId);
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

export default new SiigoService();
