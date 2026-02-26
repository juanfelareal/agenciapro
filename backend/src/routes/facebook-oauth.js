import { Router } from 'express';
import db from '../config/database.js';

const router = Router();

// In-memory storage for OAuth state (production should use Redis)
const oauthSessions = new Map();

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BACKEND_URL}/api/oauth/facebook/callback`;

// Permissions needed for Facebook Marketing API
// For development mode, we start with no special scopes
// The user's existing ad account access should be inherited
// Once app is verified, add: ads_read, ads_management, business_management
const SCOPES = 'ads_read';

/**
 * GET /api/oauth/facebook/url
 * Generate OAuth authorization URL for Facebook
 */
router.get('/url', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id } = req.query;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id es requerido' });
    }

    if (!FACEBOOK_APP_ID) {
      return res.status(500).json({ error: 'FACEBOOK_APP_ID no configurado en .env' });
    }

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Generate state for CSRF protection
    const state = `${client_id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store state with client_id and orgId for later verification
    oauthSessions.set(state, {
      clientId: client_id,
      orgId: orgId,
      createdAt: Date.now()
    });

    // Clean up old sessions (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of oauthSessions.entries()) {
      if (value.createdAt < tenMinutesAgo) {
        oauthSessions.delete(key);
      }
    }

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${SCOPES}` +
      `&state=${state}` +
      `&response_type=code`;

    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oauth/facebook/callback
 * Handle OAuth callback from Facebook
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'facebook_oauth_error',
                error: '${error_description || error}'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    // Verify state
    const session = oauthSessions.get(state);
    if (!session) {
      return res.status(400).send('Invalid or expired state');
    }

    const clientId = session.clientId;
    oauthSessions.delete(state);

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${FACEBOOK_APP_ID}` +
      `&client_secret=${FACEBOOK_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'facebook_oauth_error',
                error: '${tokenData.error.message}'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }

    const { access_token } = tokenData;

    // Get long-lived token (60 days instead of 1 hour)
    const longTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${FACEBOOK_APP_ID}` +
      `&client_secret=${FACEBOOK_APP_SECRET}` +
      `&fb_exchange_token=${access_token}`;

    const longTokenResponse = await fetch(longTokenUrl);
    const longTokenData = await longTokenResponse.json();

    const longLivedToken = longTokenData.access_token || access_token;

    // Store token temporarily with session ID
    const sessionId = `fb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    oauthSessions.set(sessionId, {
      accessToken: longLivedToken,
      clientId: clientId,
      orgId: session.orgId,
      createdAt: Date.now()
    });

    // Send success message to parent window
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'facebook_oauth_success',
              sessionId: '${sessionId}',
              clientId: '${clientId}'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'facebook_oauth_error',
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
 * GET /api/oauth/facebook/ad-accounts
 * Get all ad accounts available to the authenticated user
 */
router.get('/ad-accounts', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id es requerido' });
    }

    const session = oauthSessions.get(session_id);
    if (!session) {
      return res.status(401).json({ error: 'Sesion expirada. Por favor reconecta con Facebook.' });
    }

    const { accessToken, clientId } = session;

    // Verify client belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get user's ad accounts
    const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?` +
      `fields=id,name,account_status,currency,timezone_name,business` +
      `&access_token=${accessToken}`;

    const response = await fetch(adAccountsUrl);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    // Get already linked accounts for this client
    const linkedAccounts = await db.prepare(`
      SELECT ad_account_id FROM client_facebook_credentials WHERE client_id = ?
    `).all(clientId);

    const linkedIds = new Set(linkedAccounts.map(a => a.ad_account_id));

    // Format accounts for frontend
    const accounts = (data.data || []).map(account => ({
      id: account.id,
      name: account.name || 'Sin nombre',
      status: account.account_status === 1 ? 'active' : 'inactive',
      currency: account.currency,
      timezone: account.timezone_name,
      business: account.business?.name || null,
      isLinked: linkedIds.has(account.id) || linkedIds.has(account.id.replace('act_', ''))
    }));

    res.json({
      clientId,
      accounts,
      total: accounts.length
    });
  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oauth/facebook/link-accounts
 * Link selected ad accounts to the client
 */
router.post('/link-accounts', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id, client_id, account_ids } = req.body;

    if (!session_id || !client_id || !account_ids || !Array.isArray(account_ids)) {
      return res.status(400).json({
        error: 'session_id, client_id y account_ids (array) son requeridos'
      });
    }

    if (account_ids.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una cuenta' });
    }

    const session = oauthSessions.get(session_id);
    if (!session) {
      return res.status(401).json({ error: 'Sesion expirada. Por favor reconecta con Facebook.' });
    }

    const { accessToken } = session;

    // Verify client exists and belongs to org
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get account details for names
    const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?` +
      `fields=id,name&access_token=${accessToken}`;
    const response = await fetch(adAccountsUrl);
    const data = await response.json();

    const accountsMap = new Map();
    if (data.data) {
      data.data.forEach(acc => {
        accountsMap.set(acc.id, acc.name);
      });
    }

    // Insert or update each selected account
    const insertStmt = db.prepare(`
      INSERT INTO client_facebook_credentials
        (client_id, access_token, ad_account_id, ad_account_name, status)
      VALUES (?, ?, ?, ?, 'active')
      ON CONFLICT(client_id, ad_account_id)
      DO UPDATE SET
        access_token = excluded.access_token,
        ad_account_name = excluded.ad_account_name,
        status = 'active',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `);

    const results = [];
    for (const accountId of account_ids) {
      const accountName = accountsMap.get(accountId) || 'Cuenta de anuncios';
      try {
        await insertStmt.run(client_id, accessToken, accountId, accountName);
        results.push({ accountId, success: true });
      } catch (err) {
        results.push({ accountId, success: false, error: err.message });
      }
    }

    // Clean up session after successful linking
    oauthSessions.delete(session_id);

    res.json({
      message: `${results.filter(r => r.success).length} cuentas vinculadas exitosamente`,
      results
    });
  } catch (error) {
    console.error('Error linking accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oauth/facebook/unlink/:credentialId
 * Unlink a specific Facebook account from client
 */
router.delete('/unlink/:credentialId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { credentialId } = req.params;

    // Verify credential belongs to a client in this org
    const credential = await db.prepare(`
      SELECT cfc.id
      FROM client_facebook_credentials cfc
      JOIN clients c ON cfc.client_id = c.id
      WHERE cfc.id = ? AND c.organization_id = ?
    `).get(credentialId, orgId);

    if (!credential) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    await db.prepare('DELETE FROM client_facebook_credentials WHERE id = ? AND organization_id = ?').run(credentialId, orgId);

    res.json({ message: 'Cuenta desvinculada exitosamente' });
  } catch (error) {
    console.error('Error unlinking account:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
