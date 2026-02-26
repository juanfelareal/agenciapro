import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/database.js';

const router = Router();

// In-memory storage for OAuth state (production should use Redis)
const oauthSessions = new Map();
// Store callback results for frontend polling (since window.opener is lost in cross-origin redirects)
const callbackResults = new Map();

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
 * Helper: send HTML page that communicates with parent window via postMessage
 * Includes visible fallback text in case window.opener is not available
 */
function sendCallbackPage(res, data) {
  const isSuccess = data.type === 'shopify_oauth_success';
  const jsonData = JSON.stringify(data);
  const statusText = isSuccess ? 'Conectado exitosamente' : `Error: ${data.error}`;
  const statusColor = isSuccess ? '#16a34a' : '#dc2626';

  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AgenciaPro - Shopify</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
  <div style="text-align:center;padding:2rem">
    <p style="color:${statusColor};font-size:1.1rem;font-weight:600">${statusText}</p>
    <p style="color:#6b7280;font-size:0.875rem" id="status">Cerrando ventana...</p>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(${jsonData}, '*');
        setTimeout(function() { window.close(); }, 500);
      } else {
        document.getElementById('status').textContent = 'Puedes cerrar esta ventana y volver a AgenciaPro.';
      }
    } catch(e) {
      document.getElementById('status').textContent = 'Puedes cerrar esta ventana y volver a AgenciaPro.';
    }
  </script>
</body></html>`);
}

/**
 * GET /api/oauth/shopify/callback
 * Handle OAuth callback from Shopify (PUBLIC - no auth middleware)
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, shop, state, hmac, timestamp } = req.query;

    console.log('Shopify OAuth callback received:', { code: code ? 'present' : 'missing', shop, state: state ? 'present' : 'missing', hmac: hmac ? 'present' : 'missing' });

    // Check for errors (user denied access)
    if (!code || !shop || !state) {
      console.log('Shopify callback: missing params');
      return sendCallbackPage(res, { type: 'shopify_oauth_error', error: 'Autorización cancelada o parámetros faltantes' });
    }

    // Verify HMAC signature
    if (!verifyShopifyHmac(req.query)) {
      console.log('Shopify callback: HMAC verification failed');
      return sendCallbackPage(res, { type: 'shopify_oauth_error', error: 'Firma HMAC inválida' });
    }

    // Verify state exists and shop matches
    const session = oauthSessions.get(state);
    if (!session) {
      console.log('Shopify callback: state not found in sessions. Active sessions:', oauthSessions.size);
      return sendCallbackPage(res, { type: 'shopify_oauth_error', error: 'Sesión expirada o inválida. Intenta de nuevo.' });
    }

    const normalizedShop = normalizeStoreUrl(shop);
    if (normalizedShop !== session.storeUrl) {
      console.log('Shopify callback: shop mismatch', { got: normalizedShop, expected: session.storeUrl });
      oauthSessions.delete(state);
      return sendCallbackPage(res, { type: 'shopify_oauth_error', error: 'La tienda no coincide con la solicitada' });
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
    console.log('Shopify token exchange response:', { hasToken: !!tokenData.access_token, scope: tokenData.scope });

    if (!tokenData.access_token) {
      console.log('Shopify callback: no access_token in response', tokenData);
      return sendCallbackPage(res, { type: 'shopify_oauth_error', error: 'Error al obtener token de acceso' });
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

    console.log('Shopify OAuth success for shop:', normalizedShop, 'sessionId:', sessionId);

    // Store result for frontend polling (keyed by original state)
    callbackResults.set(state, {
      type: 'shopify_oauth_success',
      sessionId: sessionId,
      clientId: clientId,
      shop: normalizedShop,
      createdAt: Date.now()
    });

    // Send success message to parent window
    sendCallbackPage(res, {
      type: 'shopify_oauth_success',
      sessionId: sessionId,
      clientId: clientId,
      shop: normalizedShop
    });
  } catch (error) {
    console.error('Shopify OAuth callback error:', error);
    sendCallbackPage(res, { type: 'shopify_oauth_error', error: 'Error interno del servidor: ' + error.message });
  }
});

/**
 * GET /api/oauth/shopify/callback-status
 * Poll for callback result (since window.opener is lost in cross-origin redirects)
 */
router.get('/callback-status', async (req, res) => {
  const { state } = req.query;
  if (!state) {
    return res.status(400).json({ error: 'state es requerido' });
  }

  const result = callbackResults.get(state);
  if (!result) {
    return res.json({ pending: true });
  }

  // Clean up old results (older than 5 minutes) but keep current one for re-polls
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, value] of callbackResults.entries()) {
    if (value.createdAt < fiveMinutesAgo) {
      callbackResults.delete(key);
    }
  }

  res.json({ pending: false, ...result });
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
