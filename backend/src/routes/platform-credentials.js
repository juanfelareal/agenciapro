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
router.get('/client/:clientId', (req, res) => {
  try {
    const { clientId } = req.params;

    // Get all Facebook accounts for this client (can have multiple)
    const facebook = db.prepare(`
      SELECT id, client_id, ad_account_id, ad_account_name, status, last_sync_at, last_error, created_at
      FROM client_facebook_credentials
      WHERE client_id = ?
    `).all(clientId);

    const shopify = db.prepare(`
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
router.post('/facebook', (req, res) => {
  try {
    const { client_id, access_token, ad_account_id } = req.body;

    if (!client_id || !access_token || !ad_account_id) {
      return res.status(400).json({ error: 'client_id, access_token y ad_account_id son requeridos' });
    }

    // Check if client exists
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(client_id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Check if already exists
    const existing = db.prepare('SELECT id FROM client_facebook_credentials WHERE client_id = ?').get(client_id);

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE client_facebook_credentials
        SET access_token = ?, ad_account_id = ?, status = 'active', last_error = NULL, updated_at = datetime('now')
        WHERE client_id = ?
      `).run(access_token, ad_account_id, client_id);

      res.json({ message: 'Credenciales de Facebook actualizadas', id: existing.id });
    } else {
      // Insert new
      const result = db.prepare(`
        INSERT INTO client_facebook_credentials (client_id, access_token, ad_account_id)
        VALUES (?, ?, ?)
      `).run(client_id, access_token, ad_account_id);

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
    const { id } = req.params;

    const credentials = db.prepare(`
      SELECT access_token, ad_account_id
      FROM client_facebook_credentials
      WHERE id = ?
    `).get(id);

    if (!credentials) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

    const facebook = new FacebookAdsIntegration(credentials.access_token, credentials.ad_account_id);
    const result = await facebook.testConnection();

    if (result.success) {
      // Update status to active
      db.prepare(`
        UPDATE client_facebook_credentials
        SET status = 'active', last_error = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(id);
    } else {
      // Update status to error
      db.prepare(`
        UPDATE client_facebook_credentials
        SET status = 'error', last_error = ?, updated_at = datetime('now')
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
router.delete('/facebook/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM client_facebook_credentials WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

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
router.post('/shopify', (req, res) => {
  try {
    const { client_id, store_url, access_token } = req.body;

    if (!client_id || !store_url || !access_token) {
      return res.status(400).json({ error: 'client_id, store_url y access_token son requeridos' });
    }

    // Check if client exists
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(client_id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Normalize store URL
    const normalizedUrl = store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Check if already exists
    const existing = db.prepare('SELECT id FROM client_shopify_credentials WHERE client_id = ?').get(client_id);

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE client_shopify_credentials
        SET store_url = ?, access_token = ?, status = 'active', last_error = NULL, updated_at = datetime('now')
        WHERE client_id = ?
      `).run(normalizedUrl, access_token, client_id);

      res.json({ message: 'Credenciales de Shopify actualizadas', id: existing.id });
    } else {
      // Insert new
      const result = db.prepare(`
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
    const { id } = req.params;

    const credentials = db.prepare(`
      SELECT store_url, access_token
      FROM client_shopify_credentials
      WHERE id = ?
    `).get(id);

    if (!credentials) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

    const shopify = new ShopifyIntegration(credentials.store_url, credentials.access_token);
    const result = await shopify.testConnection();

    if (result.success) {
      // Update status to active
      db.prepare(`
        UPDATE client_shopify_credentials
        SET status = 'active', last_error = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(id);
    } else {
      // Update status to error
      db.prepare(`
        UPDATE client_shopify_credentials
        SET status = 'error', last_error = ?, updated_at = datetime('now')
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
router.delete('/shopify/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM client_shopify_credentials WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Credenciales no encontradas' });
    }

    res.json({ message: 'Shopify desconectado exitosamente' });
  } catch (error) {
    console.error('Error deleting Shopify credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
