import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/database.js';

const router = Router();

// In-memory storage for OAuth state (production should use Redis)
const oauthSessions = new Map();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BACKEND_URL}/api/oauth/shopify/callback`;

// Scopes needed for Shopify metrics (orders + reports)
const SCOPES = 'read_orders,read_reports';

/**
 * Verify Shopify HMAC signature on callback
 */
function verifyShopifyHmac(query) {
  const { hmac, ...params } = query;
  if (!hmac) return false;

  // Sort params alphabetically and join with &
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedHmac, 'hex'),
      Buffer.from(hmac, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Normalize store URL to format: mi-tienda.myshopify.com
 */
function normalizeStoreUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase()
    .trim();
}

/**
 * Clean up sessions older than 10 minutes
 */
function cleanOldSessions() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of oauthSessions.entries()) {
    if (value.createdAt < tenMinutesAgo) {
      oauthSessions.delete(key);
    }
  }
}

/**
 * GET /api/oauth/shopify/url
 * Generate OAuth authorization URL for Shopify
 */
router.get('/url', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id, store_url } = req.query;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id es requerido' });
    }

    if (!store_url) {
      return res.status(400).json({ error: 'store_url es requerido' });
    }

    if (!SHOPIFY_API_KEY) {
      return res.status(500).json({ error: 'SHOPIFY_API_KEY no configurado en .env' });
    }

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const normalizedStore = normalizeStoreUrl(store_url);

    // Validate store URL format
    if (!normalizedStore.includes('.myshopify.com')) {
      return res.status(400).json({ error: 'URL de tienda inválida. Debe ser mi-tienda.myshopify.com' });
    }

    // Generate state for CSRF protection
    const state = `${client_id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store state with client_id, orgId, and store URL for later verification
    oauthSessions.set(state, {
      clientId: client_id,
      orgId: orgId,
      storeUrl: normalizedStore,
      createdAt: Date.now()
    });

    // Clean up old sessions
    cleanOldSessions();

    const authUrl = `https://${normalizedStore}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_API_KEY}` +
      `&scope=${SCOPES}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${state}`;

    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error generating Shopify OAuth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oauth/shopify/callback
 * Handle OAuth callback from Shopify (PUBLIC - no auth middleware)
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, shop, state, hmac, timestamp } = req.query;

    // Check for errors (user denied access)
    if (!code || !shop || !state) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'shopify_oauth_error',
                error: 'Autorización cancelada o parámetros faltantes'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    // Verify HMAC signature
    if (!verifyShopifyHmac(req.query)) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'shopify_oauth_error',
                error: 'Firma HMAC inválida'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    // Verify state exists and shop matches
    const session = oauthSessions.get(state);
    if (!session) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'shopify_oauth_error',
                error: 'Sesión expirada o inválida'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const normalizedShop = normalizeStoreUrl(shop);
    if (normalizedShop !== session.storeUrl) {
      oauthSessions.delete(state);
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'shopify_oauth_error',
                error: 'La tienda no coincide con la solicitada'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const clientId = session.clientId;
    oauthSessions.delete(state);

    // Exchange code for permanent access token
    const tokenResponse = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code: code
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'shopify_oauth_error',
                error: 'Error al obtener token de acceso'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    // Store token temporarily with session ID
    const sessionId = `shp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    oauthSessions.set(sessionId, {
      accessToken: tokenData.access_token,
      clientId: clientId,
      orgId: session.orgId,
      shop: normalizedShop,
      createdAt: Date.now()
    });

    // Send success message to parent window
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'shopify_oauth_success',
              sessionId: '${sessionId}',
              clientId: '${clientId}',
              shop: '${normalizedShop}'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Shopify OAuth callback error:', error);
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'shopify_oauth_error',
              error: 'Error interno del servidor'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/oauth/shopify/store-info
 * Get store info after OAuth (protected)
 */
router.get('/store-info', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id es requerido' });
    }

    const session = oauthSessions.get(session_id);
    if (!session) {
      return res.status(401).json({ error: 'Sesión expirada. Por favor reconecta con Shopify.' });
    }

    const { accessToken, clientId, shop } = session;

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get store info from Shopify
    const storeResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    const storeData = await storeResponse.json();

    if (storeData.errors) {
      return res.status(400).json({ error: 'Error al obtener información de la tienda' });
    }

    res.json({
      clientId,
      store: {
        name: storeData.shop.name,
        email: storeData.shop.email,
        currency: storeData.shop.currency,
        url: storeData.shop.myshopify_domain || shop
      }
    });
  } catch (error) {
    console.error('Error fetching store info:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oauth/shopify/link-store
 * Link store to client after confirmation (protected)
 */
router.post('/link-store', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id, client_id } = req.body;

    if (!session_id || !client_id) {
      return res.status(400).json({ error: 'session_id y client_id son requeridos' });
    }

    const session = oauthSessions.get(session_id);
    if (!session) {
      return res.status(401).json({ error: 'Sesión expirada. Por favor reconecta con Shopify.' });
    }

    const { accessToken, shop } = session;

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Upsert into client_shopify_credentials
    await db.prepare(`
      INSERT INTO client_shopify_credentials (client_id, store_url, access_token, status, organization_id)
      VALUES (?, ?, ?, 'active', ?)
      ON CONFLICT(client_id)
      DO UPDATE SET
        store_url = EXCLUDED.store_url,
        access_token = EXCLUDED.access_token,
        status = 'active',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `).run(client_id, shop, accessToken, orgId);

    // Clean up session
    oauthSessions.delete(session_id);

    res.json({ message: 'Tienda vinculada exitosamente' });
  } catch (error) {
    console.error('Error linking Shopify store:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oauth/shopify/unlink/:credentialId
 * Unlink a Shopify store from client (protected)
 */
router.delete('/unlink/:credentialId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { credentialId } = req.params;

    // Verify credential belongs to a client in this org
    const credential = await db.prepare(`
      SELECT csc.id
      FROM client_shopify_credentials csc
      JOIN clients c ON csc.client_id = c.id
      WHERE csc.id = ? AND c.organization_id = ?
    `).get(credentialId, orgId);

    if (!credential) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    await db.prepare('DELETE FROM client_shopify_credentials WHERE id = ? AND organization_id = ?').run(credentialId, orgId);

    res.json({ message: 'Tienda desconectada exitosamente' });
  } catch (error) {
    console.error('Error unlinking Shopify store:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
