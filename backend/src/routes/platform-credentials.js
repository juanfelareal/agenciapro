import { Router } from 'express';
import db from '../config/database.js';
import FacebookAdsIntegration from '../integrations/facebookAds.js';
import ShopifyIntegration from '../integrations/shopify.js';

const router = Router();

// ============================================
// GET CREDENTIALS BY CLIENT
// ============================================

/**
 * GET /api/platform-credentials/client/:clientId
 * Get all platform credentials for a client
 */
router.get('/client/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get all Facebook accounts for this client (can have multiple)
    const facebook = await db.prepare(`
      SELECT id, client_id, ad_account_id, ad_account_name, status, last_sync_at, last_error, created_at
      FROM client_facebook_credentials
      WHERE client_id = ?
    `).all(clientId);

    const shopify = await db.prepare(`
      SELECT id, client_id, store_url, status, last_sync_at, last_error, created_at
      FROM client_shopify_credentials
      WHERE client_id = ?
    `).get(clientId);

    res.json({
      facebook: facebook || [],
      shopify: shopify || null
    });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FACEBOOK ADS CREDENTIALS
// ============================================

/**
 * POST /api/platform-credentials/facebook
 * Connect Facebook Ads account to client
 */
router.post('/facebook', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id, access_token, ad_account_id } = req.body;
    const systemToken = process.env.FACEBOOK_SYSTEM_USER_TOKEN;

    if (!client_id || !ad_account_id) {
      return res.status(400).json({ error: 'client_id y ad_account_id son requeridos' });
    }

    // Use system user token as fallback
    const tokenToUse = access_token || systemToken;
    if (!tokenToUse) {
      return res.status(400).json({ error: 'access_token es requerido (o configura FACEBOOK_SYSTEM_USER_TOKEN)' });
    }

    // Check if client exists and belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Check if already exists
    const existing = await db.prepare('SELECT id FROM client_facebook_credentials WHERE client_id = ?').get(client_id);

    if (existing) {
      // Update existing
      await db.prepare(`
        UPDATE client_facebook_credentials
        SET access_token = ?, ad_account_id = ?, status = 'active', last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `).run(tokenToUse, ad_account_id, client_id);

      res.json({ message: 'Credenciales de Facebook actualizadas', id: existing.id });
    } else {
      // Insert new
      const result = await db.prepare(`
        INSERT INTO client_facebook_credentials (client_id, access_token, ad_account_id)
        VALUES (?, ?, ?)
      `).run(client_id, tokenToUse, ad_account_id);

      res.status(201).json({ message: 'Facebook Ads conectado exitosamente', id: result.lastInsertRowid });
    }
  } catch (error) {
    console.error('Error saving Facebook credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/platform-credentials/facebook/:id/test
 * Test Facebook Ads connection
 */
router.post('/facebook/:id/test', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;

    // Verify credential belongs to a client in this org
    const credentials = await db.prepare(`
      SELECT cfc.access_token, cfc.ad_account_id
      FROM client_facebook_credentials cfc
      JOIN clients c ON cfc.client_id = c.id
      WHERE cfc.id = ? AND c.organization_id = ?
    `).get(id, orgId);

    if (!credentials) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

    const tokenForTest = credentials.access_token || process.env.FACEBOOK_SYSTEM_USER_TOKEN;
    const facebook = new FacebookAdsIntegration(tokenForTest, credentials.ad_account_id);
    const result = await facebook.testConnection();

    if (result.success) {
      // Update status to active
      await db.prepare(`
        UPDATE client_facebook_credentials
        SET status = 'active', last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);
    } else {
      // Update status to error
      await db.prepare(`
        UPDATE client_facebook_credentials
        SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(result.error, id);
    }

    res.json(result);
  } catch (error) {
    console.error('Error testing Facebook connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/platform-credentials/facebook/:id
 * Disconnect Facebook Ads from client
 */
router.delete('/facebook/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;

    // Verify credential belongs to a client in this org
    const credential = await db.prepare(`
      SELECT cfc.id
      FROM client_facebook_credentials cfc
      JOIN clients c ON cfc.client_id = c.id
      WHERE cfc.id = ? AND c.organization_id = ?
    `).get(id, orgId);

    if (!credential) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

    await db.prepare('DELETE FROM client_facebook_credentials WHERE id = ? AND organization_id = ?').run(id, orgId);

    res.json({ message: 'Facebook Ads desconectado exitosamente' });
  } catch (error) {
    console.error('Error deleting Facebook credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SHOPIFY CREDENTIALS
// ============================================

/**
 * POST /api/platform-credentials/shopify
 * Connect Shopify store to client
 */
router.post('/shopify', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id, store_url, access_token } = req.body;

    if (!client_id || !store_url || !access_token) {
      return res.status(400).json({ error: 'client_id, store_url y access_token son requeridos' });
    }

    // Check if client exists and belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Normalize store URL
    const normalizedUrl = store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Check if already exists
    const existing = await db.prepare('SELECT id FROM client_shopify_credentials WHERE client_id = ?').get(client_id);

    if (existing) {
      // Update existing
      await db.prepare(`
        UPDATE client_shopify_credentials
        SET store_url = ?, access_token = ?, status = 'active', last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `).run(normalizedUrl, access_token, client_id);

      res.json({ message: 'Credenciales de Shopify actualizadas', id: existing.id });
    } else {
      // Insert new
      const result = await db.prepare(`
        INSERT INTO client_shopify_credentials (client_id, store_url, access_token)
        VALUES (?, ?, ?)
      `).run(client_id, normalizedUrl, access_token);

      res.status(201).json({ message: 'Shopify conectado exitosamente', id: result.lastInsertRowid });
    }
  } catch (error) {
    console.error('Error saving Shopify credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/platform-credentials/shopify/:id/test
 * Test Shopify connection
 */
router.post('/shopify/:id/test', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;

    // Verify credential belongs to a client in this org
    const credentials = await db.prepare(`
      SELECT csc.store_url, csc.access_token
      FROM client_shopify_credentials csc
      JOIN clients c ON csc.client_id = c.id
      WHERE csc.id = ? AND c.organization_id = ?
    `).get(id, orgId);

    if (!credentials) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

    const shopify = new ShopifyIntegration(credentials.store_url, credentials.access_token);
    const result = await shopify.testConnection();

    if (result.success) {
      // Update status to active
      await db.prepare(`
        UPDATE client_shopify_credentials
        SET status = 'active', last_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);
    } else {
      // Update status to error
      await db.prepare(`
        UPDATE client_shopify_credentials
        SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(result.error, id);
    }

    res.json(result);
  } catch (error) {
    console.error('Error testing Shopify connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/platform-credentials/shopify/:id
 * Disconnect Shopify from client
 */
router.delete('/shopify/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;

    // Verify credential belongs to a client in this org
    const credential = await db.prepare(`
      SELECT csc.id
      FROM client_shopify_credentials csc
      JOIN clients c ON csc.client_id = c.id
      WHERE csc.id = ? AND c.organization_id = ?
    `).get(id, orgId);

    if (!credential) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

    await db.prepare('DELETE FROM client_shopify_credentials WHERE id = ? AND organization_id = ?').run(id, orgId);

    res.json({ message: 'Shopify desconectado exitosamente' });
  } catch (error) {
    console.error('Error deleting Shopify credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
