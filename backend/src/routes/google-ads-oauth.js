import { Router } from 'express';
import axios from 'axios';
import db from '../config/database.js';
import { listAccessibleCustomers } from '../integrations/googleAds.js';

const router = Router();

// In-memory storage for OAuth state (production should use Redis)
const oauthSessions = new Map();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BACKEND_URL}/api/oauth/google-ads/callback`;

// Scope for the Google Ads API. access_type=offline + prompt=consent forces a refresh_token.
const SCOPES = 'https://www.googleapis.com/auth/adwords';

/**
 * GET /api/oauth/google-ads/url
 * Generate OAuth authorization URL for Google
 */
router.get('/url', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id } = req.query;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id es requerido' });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'GOOGLE_ADS_CLIENT_ID no configurado en .env' });
    }

    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const state = `${client_id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    oauthSessions.set(state, { clientId: client_id, orgId, createdAt: Date.now() });

    // Clean up old sessions (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of oauthSessions.entries()) {
      if (value.createdAt < tenMinutesAgo) oauthSessions.delete(key);
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&state=${state}` +
      `&response_type=code` +
      `&access_type=offline` +
      `&prompt=consent`;

    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oauth/google-ads/callback
 * Handle OAuth callback from Google — exchanges code for a refresh token
 */
router.get('/callback', async (req, res) => {
  const sendError = (msg) => res.send(`
    <html><body><script>
      window.opener.postMessage({ type: 'google_ads_oauth_error', error: ${JSON.stringify(String(msg))} }, '*');
      window.close();
    </script></body></html>
  `);

  try {
    const { code, state, error, error_description } = req.query;

    if (error) return sendError(error_description || error);
    if (!code || !state) return res.status(400).send('Missing code or state');

    const session = oauthSessions.get(state);
    if (!session) return res.status(400).send('Invalid or expired state');

    const clientId = session.clientId;
    oauthSessions.delete(state);

    // Exchange code for tokens
    const params = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const refreshToken = tokenResponse.data.refresh_token;
    if (!refreshToken) {
      return sendError('Google no devolvió un refresh_token. Revoca el acceso de la app en tu cuenta de Google y reconecta.');
    }

    // Store refresh token temporarily with a session id
    const sessionId = `ga_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    oauthSessions.set(sessionId, {
      refreshToken,
      clientId,
      orgId: session.orgId,
      createdAt: Date.now(),
    });

    res.send(`
      <html><body><script>
        window.opener.postMessage({
          type: 'google_ads_oauth_success',
          sessionId: '${sessionId}',
          clientId: '${clientId}'
        }, '*');
        window.close();
      </script></body></html>
    `);
  } catch (err) {
    console.error('Google OAuth callback error:', err.response?.data || err.message);
    sendError(err.response?.data?.error_description || 'Error interno del servidor');
  }
});

/**
 * GET /api/oauth/google-ads/customers
 * List Google Ads accounts available to the authenticated user
 */
router.get('/customers', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id es requerido' });
    }

    const session = oauthSessions.get(session_id);
    if (!session) {
      return res.status(401).json({ error: 'Sesión expirada. Por favor reconecta con Google.' });
    }

    const { refreshToken, clientId } = session;

    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const customers = await listAccessibleCustomers(refreshToken);

    // Mark already-linked accounts
    const linked = await db.prepare(
      'SELECT customer_id FROM client_google_ads_credentials WHERE client_id = ?'
    ).all(clientId);
    const linkedIds = new Set(linked.map((a) => a.customer_id));

    const accounts = customers.map((c) => ({
      id: c.customer_id,
      name: c.name,
      login_customer_id: c.login_customer_id,
      currency: c.currency,
      isLinked: linkedIds.has(c.customer_id),
    }));

    res.json({ clientId, accounts, total: accounts.length });
  } catch (error) {
    console.error('Error fetching Google Ads accounts:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

/**
 * POST /api/oauth/google-ads/link-accounts
 * Link selected Google Ads accounts to the client
 */
router.post('/link-accounts', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id, client_id, accounts } = req.body;

    if (!session_id || !client_id || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: 'session_id, client_id y accounts (array) son requeridos' });
    }

    const session = oauthSessions.get(session_id);
    if (!session) {
      return res.status(401).json({ error: 'Sesión expirada. Por favor reconecta con Google.' });
    }

    const { refreshToken } = session;

    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO client_google_ads_credentials
        (client_id, refresh_token, customer_id, customer_name, login_customer_id, status)
      VALUES (?, ?, ?, ?, ?, 'active')
      ON CONFLICT(client_id, customer_id)
      DO UPDATE SET
        refresh_token = excluded.refresh_token,
        customer_name = excluded.customer_name,
        login_customer_id = excluded.login_customer_id,
        status = 'active',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `);

    const results = [];
    for (const acc of accounts) {
      const customerId = String(acc.id || acc.customer_id || '').replace(/[^0-9]/g, '');
      if (!customerId) continue;
      const name = acc.name || 'Cuenta de Google Ads';
      const loginCustomerId = acc.login_customer_id || null;
      try {
        await insertStmt.run(client_id, refreshToken, customerId, name, loginCustomerId);
        results.push({ customerId, success: true });
      } catch (err) {
        results.push({ customerId, success: false, error: err.message });
      }
    }

    oauthSessions.delete(session_id);

    res.json({
      message: `${results.filter((r) => r.success).length} cuentas vinculadas exitosamente`,
      results,
    });
  } catch (error) {
    console.error('Error linking Google Ads accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oauth/google-ads/unlink/:credentialId
 * Unlink a specific Google Ads account from client
 */
router.delete('/unlink/:credentialId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { credentialId } = req.params;

    const credential = await db.prepare(`
      SELECT cgc.id
      FROM client_google_ads_credentials cgc
      JOIN clients c ON cgc.client_id = c.id
      WHERE cgc.id = ? AND c.organization_id = ?
    `).get(credentialId, orgId);

    if (!credential) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    await db.prepare('DELETE FROM client_google_ads_credentials WHERE id = ? AND organization_id = ?').run(credentialId, orgId);

    res.json({ message: 'Cuenta desvinculada exitosamente' });
  } catch (error) {
    console.error('Error unlinking Google Ads account:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
