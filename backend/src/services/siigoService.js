import axios from 'axios';
import db from '../config/database.js';

const SIIGO_API_URL = 'https://api.siigo.com/v1';
const SIIGO_AUTH_URL = 'https://api.siigo.com/auth';

class SiigoService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  // Get stored credentials
  getCredentials() {
    return db.prepare('SELECT * FROM siigo_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
  }

  // Save credentials
  saveCredentials(username, accessKey, partnerId = null) {
    const existing = this.getCredentials();
    if (existing) {
      db.prepare(`
        UPDATE siigo_settings
        SET username = ?, access_key = ?, partner_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(username, accessKey, partnerId, existing.id);
      return existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO siigo_settings (username, access_key, partner_id)
        VALUES (?, ?, ?)
      `).run(username, accessKey, partnerId);
      return result.lastInsertRowid;
    }
  }

  // Authenticate and get access token
  async authenticate() {
    const credentials = this.getCredentials();
    if (!credentials) {
      throw new Error('Siigo credentials not configured');
    }

    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(this.tokenExpiresAt);
      if (now < expiresAt) {
        return this.accessToken;
      }
    }

    // Also check database for cached token
    if (credentials.access_token && credentials.token_expires_at) {
      const now = new Date();
      const expiresAt = new Date(credentials.token_expires_at);
      if (now < expiresAt) {
        this.accessToken = credentials.access_token;
        this.tokenExpiresAt = credentials.token_expires_at;
        return this.accessToken;
      }
    }

    try {
      const response = await axios.post(SIIGO_AUTH_URL, {
        username: credentials.username,
        access_key: credentials.access_key
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      this.accessToken = response.data.access_token;
      // Token is valid for 24 hours, set expiry to 23 hours to be safe
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 23);
      this.tokenExpiresAt = expiresAt.toISOString();

      // Save token to database
      db.prepare(`
        UPDATE siigo_settings
        SET access_token = ?, token_expires_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(this.accessToken, this.tokenExpiresAt, credentials.id);

      return this.accessToken;
    } catch (error) {
      console.error('Siigo authentication error:', error.response?.data || error.message);
      throw new Error(`Siigo authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Make authenticated API request
  async apiRequest(method, endpoint, data = null) {
    const token = await this.authenticate();
    const credentials = this.getCredentials();

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
  async getDocumentTypes() {
    const data = await this.apiRequest('GET', '/document-types?type=FV');

    // Cache in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO siigo_document_types (siigo_id, code, name, type, active)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (const doc of data) {
      stmt.run(doc.id, doc.code, doc.name, 'FV');
    }

    return data;
  }

  // ========== PAYMENT TYPES ==========
  async getPaymentTypes() {
    // Fetch all payment types (Siigo returns paginated results)
    const data = await this.apiRequest('GET', '/payment-types');

    // Cache in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO siigo_payment_types (siigo_id, name, type, active)
      VALUES (?, ?, ?, 1)
    `);

    for (const payment of data) {
      stmt.run(payment.id, payment.name, payment.type);
    }

    return data;
  }

  // ========== TAXES ==========
  async getTaxes() {
    const data = await this.apiRequest('GET', '/taxes');

    // Cache in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO siigo_taxes (siigo_id, name, percentage, active)
      VALUES (?, ?, ?, 1)
    `);

    for (const tax of data) {
      stmt.run(tax.id, tax.name, tax.percentage);
    }

    return data;
  }

  // ========== SELLERS ==========
  async getSellers() {
    return await this.apiRequest('GET', '/users?page_size=100');
  }

  async getDefaultSeller() {
    const users = await this.getSellers();
    // Return the first active user/seller
    return users?.results?.[0] || null;
  }

  // ========== PRODUCTS ==========
  async getProducts(page = 1, pageSize = 25) {
    return await this.apiRequest('GET', `/products?page=${page}&page_size=${pageSize}`);
  }

  async createProduct(productData) {
    return await this.apiRequest('POST', '/products', productData);
  }

  // Get or create a default service product for invoices
  async getOrCreateDefaultProduct() {
    // Try to find existing product
    const products = await this.getProducts(1, 100);

    // Look for a service product (type = 'Service' or account_group.id for services)
    let serviceProduct = products?.results?.find(p =>
      p.code === 'SERVICIOS' || p.code === 'SRV001' || p.name?.toLowerCase().includes('servicio')
    );

    if (serviceProduct) {
      return serviceProduct;
    }

    // If no products exist, return the first one available
    if (products?.results?.length > 0) {
      return products.results[0];
    }

    // Create default service product
    const newProduct = await this.createProduct({
      code: 'SERVICIOS',
      name: 'Servicios Profesionales',
      account_group: 1380, // Default income account group
      type: 'Service',
      stock_control: false,
      active: true,
      tax_classification: 'Taxed',
      taxes: [{ id: 12715 }] // IVA 19%
    });

    return newProduct;
  }

  // ========== CUSTOMERS ==========
  async getCustomers(page = 1, pageSize = 25) {
    return await this.apiRequest('GET', `/customers?page=${page}&page_size=${pageSize}`);
  }

  async getCustomerByIdentification(identification) {
    const data = await this.apiRequest('GET', `/customers?identification=${identification}`);
    return data.results?.[0] || null;
  }

  async createCustomer(customerData) {
    return await this.apiRequest('POST', '/customers', customerData);
  }

  async updateCustomer(customerId, customerData) {
    return await this.apiRequest('PUT', `/customers/${customerId}`, customerData);
  }

  // Create or update customer from AgencyPRO client
  async syncCustomer(client) {
    const identification = client.nit || client.company || client.name;

    // Check if customer exists in Siigo
    const existingCustomer = await this.getCustomerByIdentification(identification);

    const customerData = {
      type: 'Customer',
      person_type: client.nit ? 'Company' : 'Person',
      id_type: {
        code: client.nit ? '31' : '13' // 31 = NIT, 13 = Cedula
      },
      identification: identification.replace(/[^0-9]/g, ''), // Only numbers
      name: client.nit ? [client.company || client.name] : client.name.split(' '),
      commercial_name: client.company || client.name,
      contacts: {
        first_name: client.name.split(' ')[0] || client.name,
        last_name: client.name.split(' ').slice(1).join(' ') || '',
        email: client.email || '',
        phone: {
          number: client.phone || ''
        }
      },
      address: {
        city: {
          country_code: 'Co',
          state_code: '11', // Bogota by default
          city_code: '11001'
        }
      }
    };

    let siigoCustomer;
    if (existingCustomer) {
      siigoCustomer = await this.updateCustomer(existingCustomer.id, customerData);
    } else {
      siigoCustomer = await this.createCustomer(customerData);
    }

    // Update client with Siigo ID
    db.prepare('UPDATE clients SET siigo_id = ? WHERE id = ?').run(siigoCustomer.id, client.id);

    return siigoCustomer;
  }

  // ========== INVOICES ==========
  async getInvoices(page = 1, pageSize = 25) {
    return await this.apiRequest('GET', `/invoices?page=${page}&page_size=${pageSize}`);
  }

  async getInvoice(invoiceId) {
    return await this.apiRequest('GET', `/invoices/${invoiceId}`);
  }

  async getInvoicePdf(invoiceId) {
    return await this.apiRequest('GET', `/invoices/${invoiceId}/pdf`);
  }

  async createInvoice(invoiceData) {
    return await this.apiRequest('POST', '/invoices', invoiceData);
  }

  async sendElectronicInvoice(invoiceId) {
    return await this.apiRequest('POST', `/invoices/${invoiceId}/stamp`);
  }

  async sendInvoiceByEmail(invoiceId, email) {
    return await this.apiRequest('POST', `/invoices/${invoiceId}/mail`, {
      mail_to: email
    });
  }

  // Create invoice from AgencyPRO invoice
  async syncInvoice(invoice, client, options = {}) {
    console.log('syncInvoice called with options:', options);
    // Get document type (use cached or fetch)
    let documentTypes = db.prepare('SELECT * FROM siigo_document_types WHERE type = ? LIMIT 1').get('FV');
    if (!documentTypes) {
      await this.getDocumentTypes();
      documentTypes = db.prepare('SELECT * FROM siigo_document_types WHERE type = ? LIMIT 1').get('FV');
    }

    // Get payment type (use cached or use default)
    // Note: Siigo API /payment-types requires document_type param which varies
    // Using default payment type ID 5636 (Contado) if not cached
    let paymentTypes = db.prepare('SELECT * FROM siigo_payment_types LIMIT 1').get();
    // Skip fetching if not cached - use default in invoice creation

    // Get or create a product to use for the invoice
    const product = await this.getOrCreateDefaultProduct();
    console.log('Using product:', product?.code, product?.name);

    // Get default seller
    const seller = await this.getDefaultSeller();
    console.log('Using seller:', seller?.id, seller?.username);

    // Get taxes (use cached or fetch)
    let taxes = db.prepare('SELECT * FROM siigo_taxes WHERE percentage = 19 LIMIT 1').get();
    if (!taxes) {
      await this.getTaxes();
      taxes = db.prepare('SELECT * FROM siigo_taxes WHERE percentage = 19 LIMIT 1').get();
    }

    // Ensure customer exists in Siigo
    let siigoCustomerId = client.siigo_id;
    if (!siigoCustomerId) {
      const siigoCustomer = await this.syncCustomer(client);
      siigoCustomerId = siigoCustomer.id;
    }

    // Calculate tax (round to 2 decimal places for Siigo)
    const isWithIva = invoice.invoice_type !== 'sin_iva';
    const baseAmount = isWithIva
      ? Math.round((invoice.amount / 1.19) * 100) / 100
      : invoice.amount;
    const taxAmount = isWithIva ? Math.round((invoice.amount - baseAmount) * 100) / 100 : 0;

    const invoiceData = {
      document: {
        id: documentTypes?.siigo_id || 24315 // Default FV document type
      },
      date: invoice.issue_date,
      customer: {
        identification: (client.nit || client.company || client.name).replace(/[^0-9]/g, ''),
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
          taxes: isWithIva && taxes ? [
            {
              id: taxes.siigo_id
            }
          ] : []
        }
      ],
      payments: [
        {
          id: paymentTypes?.siigo_id || 5636, // Default payment type
          value: invoice.amount,
          due_date: invoice.due_date || invoice.issue_date
        }
      ],
      stamp: {
        send: options.sendElectronic !== false // Send to DIAN by default
      }
    };

    // Log invoice data for debugging
    console.log('Sending to Siigo:', JSON.stringify(invoiceData, null, 2));

    // Create invoice in Siigo
    const siigoInvoice = await this.createInvoice(invoiceData);

    // Update local invoice with Siigo ID
    db.prepare(`
      UPDATE invoices
      SET siigo_id = ?, siigo_status = 'sent', updated_at = datetime('now')
      WHERE id = ?
    `).run(siigoInvoice.id, invoice.id);

    return siigoInvoice;
  }

  // ========== SYNC ALL REFERENCE DATA ==========
  async syncReferenceData() {
    const results = {
      documentTypes: await this.getDocumentTypes(),
      paymentTypes: await this.getPaymentTypes(),
      taxes: await this.getTaxes()
    };

    // Update last sync time
    const credentials = this.getCredentials();
    if (credentials) {
      db.prepare(`
        UPDATE siigo_settings
        SET last_sync_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(credentials.id);
    }

    return results;
  }

  // Test connection
  async testConnection() {
    try {
      await this.authenticate();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

export default new SiigoService();
