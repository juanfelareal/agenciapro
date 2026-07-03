import { Router } from 'express';
import db from '../config/database.js';
import { exchangeTikTokAuthCode, listTikTokAdvertisers } from '../integrations/tiktokAds.js';

const router = Router();

// In-memory storage for OAuth state (production should use Redis)
const oauthSessions = new Map();

const TIKTOK_APP_ID = process.env.TIKTOK_APP_ID;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BACKEND_URL}/api/oauth/tiktok/callback`;

/**
 * GET /api/oauth/tiktok/url
 * Generate OAuth authorization URL for TikTok for Business
 */
router.get('/url', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id } = req.query;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id es requerido' });
    }
    if (!TIKTOK_APP_ID) {
      return res.status(500).json({ error: 'TIKTOK_APP_ID no configurado en .env' });
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

    const authUrl = `https://business-api.tiktok.com/portal/auth?` +
      `app_id=${encodeURIComponent(TIKTOK_APP_ID)}` +
      `&state=${state}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error generating TikTok OAuth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oauth/tiktok/callback
 * Handle OAuth callback from TikTok — exchanges auth_code for an access token
 */
router.get('/callback', async (req, res) => {
  const sendError = (msg) => res.send(`
    <html><body><script>
      window.opener.postMessage({ type: 'tiktok_oauth_error', error: ${JSON.stringify(String(msg))} }, '*');
      window.close();
    </script></body></html>
  `);

  try {
    // TikTok returns the code as auth_code (sometimes code) plus state
    const authCode = req.query.auth_code || req.query.code;
    const { state, error, error_description } = req.query;

    if (error) return sendError(error_description || error);
    if (!authCode || !state) return res.status(400).send('Missing auth_code or state');

    const session = oauthSessions.get(state);
    if (!session) return res.status(400).send('Invalid or expired state');

    const clientId = session.clientId;
    oauthSessions.delete(state);

    const { accessToken } = await exchangeTikTokAuthCode(authCode);
    if (!accessToken) {
      return sendError('TikTok no devolvió un access_token.');
    }

    const sessionId = `tt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    oauthSessions.set(sessionId, {
      accessToken,
      clientId,
      orgId: session.orgId,
      createdAt: Date.now(),
    });

    res.send(`
      <html><body><script>
        window.opener.postMessage({
          type: 'tiktok_oauth_success',
          sessionId: '${sessionId}',
          clientId: '${clientId}'
        }, '*');
        window.close();
      </script></body></html>
    `);
  } catch (err) {
    console.error('TikTok OAuth callback error:', err.response?.data || err.message);
    sendError(err.response?.data?.message || 'Error interno del servidor');
  }
});

/**
 * GET /api/oauth/tiktok/advertisers
 * List TikTok advertiser accounts available to the authenticated user
 */
router.get('/advertisers', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id es requerido' });
    }

    const session = oauthSessions.get(session_id);
    if (!session) {
      return res.status(401).json({ error: 'Sesión expirada. Por favor reconecta con TikTok.' });
    }

    const { accessToken, clientId } = session;

    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(clientId, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const advertisers = await listTikTokAdvertisers(accessToken);

    const linked = await db.prepare(
      'SELECT advertiser_id FROM client_tiktok_credentials WHERE client_id = ?'
    ).all(clientId);
    const linkedIds = new Set(linked.map((a) => a.advertiser_id));

    const accounts = advertisers.map((a) => ({
      id: a.advertiser_id,
      name: a.advertiser_name,
      isLinked: linkedIds.has(a.advertiser_id),
    }));

    res.json({ clientId, accounts, total: accounts.length });
  } catch (error) {
    console.error('Error fetching TikTok advertisers:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

/**
 * POST /api/oauth/tiktok/link-accounts
 * Link selected TikTok advertiser accounts to the client
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
      return res.status(401).json({ error: 'Sesión expirada. Por favor reconecta con TikTok.' });
    }

    const { accessToken } = session;

    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, orgId);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO client_tiktok_credentials
        (client_id, access_token, advertiser_id, advertiser_name, status)
      VALUES (?, ?, ?, ?, 'active')
      ON CONFLICT(client_id, advertiser_id)
      DO UPDATE SET
        access_token = excluded.access_token,
        advertiser_name = excluded.advertiser_name,
        status = 'active',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `);

    const results = [];
    for (const acc of accounts) {
      const advertiserId = String(acc.id || acc.advertiser_id || '');
      if (!advertiserId) continue;
      const name = acc.name || 'Anunciante de TikTok';
      try {
        await insertStmt.run(client_id, accessToken, advertiserId, name);
        results.push({ advertiserId, success: true });
      } catch (err) {
        results.push({ advertiserId, success: false, error: err.message });
      }
    }

    oauthSessions.delete(session_id);

    res.json({
      message: `${results.filter((r) => r.success).length} cuentas vinculadas exitosamente`,
      results,
    });
  } catch (error) {
    console.error('Error linking TikTok accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oauth/tiktok/unlink/:credentialId
 * Unlink a specific TikTok account from client
 */
router.delete('/unlink/:credentialId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { credentialId } = req.params;

    const credential = await db.prepare(`
      SELECT ctc.id
      FROM client_tiktok_credentials ctc
      JOIN clients c ON ctc.client_id = c.id
      WHERE ctc.id = ? AND c.organization_id = ?
    `).get(credentialId, orgId);

    if (!credential) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    await db.prepare('DELETE FROM client_tiktok_credentials WHERE id = ? AND organization_id = ?').run(credentialId, orgId);

    res.json({ message: 'Cuenta desvinculada exitosamente' });
  } catch (error) {
    console.error('Error unlinking TikTok account:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
