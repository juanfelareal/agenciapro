import express from 'express';
import db from '../config/database.js';
import siigoService from '../services/siigoService.js';

const router = express.Router();

// ========== SETTINGS ==========

// Get Siigo settings (without sensitive data)
router.get('/settings', async (req, res) => {
  try {
    const orgId = req.orgId;
    const settings = await db.prepare(`
      SELECT id, username, partner_id, is_active, last_sync_at, created_at, updated_at,
             CASE WHEN access_token IS NOT NULL THEN 1 ELSE 0 END as has_token,
             token_expires_at
      FROM siigo_settings
      WHERE is_active = 1 AND organization_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(orgId);

    res.json(settings || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save Siigo credentials
router.post('/settings', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { username, access_key, partner_id } = req.body;

    if (!username || !access_key) {
      return res.status(400).json({ error: 'Username and access_key are required' });
    }

    // Save credentials with org context
    const settingsId = siigoService.saveCredentials(username, access_key, partner_id, orgId);

    // Test connection
    const testResult = await siigoService.testConnection();

    if (!testResult.success) {
      return res.status(400).json({ error: `Invalid credentials: ${testResult.message}` });
    }

    // Sync reference data on successful connection (only if partner_id is provided)
    if (partner_id) {
      try {
        await siigoService.syncReferenceData();
      } catch (syncError) {
        console.error('Error syncing reference data:', syncError.message);
      }
    }

    res.json({
      success: true,
      message: 'Siigo credentials saved and verified',
      settingsId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Siigo connection
router.post('/test-connection', async (req, res) => {
  try {
    const result = await siigoService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== REFERENCE DATA ==========

// Sync all reference data from Siigo
router.post('/sync-reference-data', async (req, res) => {
  try {
    const data = await siigoService.syncReferenceData();
    res.json({
      success: true,
      documentTypes: data.documentTypes?.length || 0,
      paymentTypes: data.paymentTypes?.length || 0,
      taxes: data.taxes?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cached document types
router.get('/document-types', async (req, res) => {
  try {
    const orgId = req.orgId;
    const types = await db.prepare('SELECT * FROM siigo_document_types WHERE active = 1 AND organization_id = ?').all(orgId);
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cached payment types
router.get('/payment-types', async (req, res) => {
  try {
    const orgId = req.orgId;
    const types = await db.prepare('SELECT * FROM siigo_payment_types WHERE active = 1 AND organization_id = ?').all(orgId);
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cached taxes
router.get('/taxes', async (req, res) => {
  try {
    const orgId = req.orgId;
    const taxes = await db.prepare('SELECT * FROM siigo_taxes WHERE active = 1 AND organization_id = ?').all(orgId);
    res.json(taxes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CUSTOMERS ==========

// Sync a client to Siigo
router.post('/customers/sync/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const client = await db.prepare('SELECT * FROM clients WHERE id = ? AND organization_id = ?').get(req.params.clientId, orgId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const siigoCustomer = await siigoService.syncCustomer(client);
    res.json({
      success: true,
      siigoCustomer,
      message: 'Client synced to Siigo successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Siigo customers
router.get('/customers', async (req, res) => {
  try {
    const { page = 1, page_size = 25 } = req.query;
    const customers = await siigoService.getCustomers(page, page_size);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== INVOICES ==========

// Get Siigo invoices
router.get('/invoices', async (req, res) => {
  try {
    const { page = 1, page_size = 25 } = req.query;
    const invoices = await siigoService.getInvoices(page, page_size);
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send invoice to Siigo
router.post('/invoices/sync/:invoiceId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { sendElectronic = true } = req.body || {};

    // Get invoice with client info, verify org ownership
    const invoice = await db.prepare(`
      SELECT i.*, c.id as client_id, c.name as client_name, c.email as client_email,
             c.company as client_company, c.nit as client_nit, c.phone as client_phone,
             c.siigo_id as client_siigo_id
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = ? AND c.organization_id = ?
    `).get(req.params.invoiceId, orgId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check if already sent to Siigo
    if (invoice.siigo_id) {
      return res.status(400).json({
        error: 'Invoice already sent to Siigo',
        siigo_id: invoice.siigo_id
      });
    }

    // Prepare client object
    const client = {
      id: invoice.client_id,
      name: invoice.client_name,
      email: invoice.client_email,
      company: invoice.client_company,
      nit: invoice.client_nit,
      phone: invoice.client_phone,
      siigo_id: invoice.client_siigo_id
    };

    // Send to Siigo
    const siigoInvoice = await siigoService.syncInvoice(invoice, client, { sendElectronic });

    res.json({
      success: true,
      siigoInvoice,
      message: 'Invoice sent to Siigo successfully'
    });
  } catch (error) {
    // Update invoice status to error
    await db.prepare(`
      UPDATE invoices SET siigo_status = 'error', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.invoiceId);

    res.status(500).json({ error: error.message });
  }
});

// Get invoice PDF from Siigo
router.get('/invoices/:invoiceId/pdf', async (req, res) => {
  try {
    const orgId = req.orgId;
    const invoice = await db.prepare(`
      SELECT i.siigo_id
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = ? AND c.organization_id = ?
    `).get(req.params.invoiceId, orgId);

    if (!invoice?.siigo_id) {
      return res.status(404).json({ error: 'Invoice not found in Siigo' });
    }

    const pdfData = await siigoService.getInvoicePdf(invoice.siigo_id);
    res.json(pdfData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send invoice by email
router.post('/invoices/:invoiceId/send-email', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { email } = req.body;
    const invoice = await db.prepare(`
      SELECT i.siigo_id, c.email as client_email
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = ? AND c.organization_id = ?
    `).get(req.params.invoiceId, orgId);

    if (!invoice?.siigo_id) {
      return res.status(404).json({ error: 'Invoice not found in Siigo' });
    }

    const targetEmail = email || invoice.client_email;
    if (!targetEmail) {
      return res.status(400).json({ error: 'No email address provided' });
    }

    await siigoService.sendInvoiceByEmail(invoice.siigo_id, targetEmail);
    res.json({ success: true, message: `Invoice sent to ${targetEmail}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== BULK OPERATIONS ==========

// Sync multiple invoices to Siigo
router.post('/invoices/sync-bulk', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { invoiceIds, sendElectronic = true } = req.body || {};

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ error: 'invoiceIds array is required' });
    }

    const results = {
      success: [],
      errors: []
    };

    for (const invoiceId of invoiceIds) {
      try {
        const invoice = await db.prepare(`
          SELECT i.*, c.id as client_id, c.name as client_name, c.email as client_email,
                 c.company as client_company, c.nit as client_nit, c.phone as client_phone,
                 c.siigo_id as client_siigo_id
          FROM invoices i
          JOIN clients c ON i.client_id = c.id
          WHERE i.id = ? AND c.organization_id = ?
        `).get(invoiceId, orgId);

        if (!invoice) {
          results.errors.push({ invoiceId, error: 'Invoice not found' });
          continue;
        }

        if (invoice.siigo_id) {
          results.errors.push({ invoiceId, error: 'Already sent to Siigo' });
          continue;
        }

        const client = {
          id: invoice.client_id,
          name: invoice.client_name,
          email: invoice.client_email,
          company: invoice.client_company,
          nit: invoice.client_nit,
          phone: invoice.client_phone,
          siigo_id: invoice.client_siigo_id
        };

        const siigoInvoice = await siigoService.syncInvoice(invoice, client, { sendElectronic });
        results.success.push({ invoiceId, siigoId: siigoInvoice.id });
      } catch (error) {
        results.errors.push({ invoiceId, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
