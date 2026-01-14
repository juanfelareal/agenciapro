import express from 'express';
import crypto from 'crypto';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * Generate a secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/portal/auth/login
 * Validate invite code and create session
 */
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código de invitación requerido' });
    }

    // Clean the code (remove spaces, dashes variations)
    const cleanCode = code.toUpperCase().replace(/\s/g, '');

    // Find the invite token
    const invite = await db.get(`
      SELECT cat.*, c.name as client_name, c.company, c.email
      FROM client_access_tokens cat
      JOIN clients c ON cat.client_id = c.id
      WHERE cat.token = ?
        AND cat.token_type = 'invite'
        AND cat.status IN ('pending', 'active')
    `, [cleanCode]);

    if (!invite) {
      return res.status(401).json({ error: 'Código de invitación inválido' });
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await db.run(`UPDATE client_access_tokens SET status = 'expired' WHERE id = ?`, [invite.id]);
      return res.status(401).json({ error: 'El código de invitación ha expirado' });
    }

    // Mark invite as active (if first use)
    if (invite.status === 'pending') {
      await db.run(`
        UPDATE client_access_tokens
        SET status = 'active', activated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [invite.id]);
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session
    await db.run(`
      INSERT INTO client_access_tokens (client_id, token, token_type, status, expires_at, last_used_at)
      VALUES (?, ?, 'session', 'active', ?, CURRENT_TIMESTAMP)
    `, [invite.client_id, sessionToken, sessionExpires.toISOString()]);

    // Get portal settings
    let settings = await db.get(`
      SELECT * FROM client_portal_settings WHERE client_id = ?
    `, [invite.client_id]);

    // Create default settings if not exist
    if (!settings) {
      await db.run(`INSERT INTO client_portal_settings (client_id) VALUES (?)`, [invite.client_id]);
      settings = await db.get(`SELECT * FROM client_portal_settings WHERE client_id = ?`, [invite.client_id]);
    }

    res.json({
      token: sessionToken,
      expires_at: sessionExpires.toISOString(),
      client: {
        id: invite.client_id,
        name: invite.client_name,
        company: invite.company,
        email: invite.email
      },
      permissions: {
        can_view_projects: !!settings.can_view_projects,
        can_view_tasks: !!settings.can_view_tasks,
        can_view_invoices: !!settings.can_view_invoices,
        can_view_metrics: !!settings.can_view_metrics,
        can_approve_tasks: !!settings.can_approve_tasks,
        can_comment_tasks: !!settings.can_comment_tasks,
        can_view_team: !!settings.can_view_team,
        can_download_files: !!settings.can_download_files
      },
      welcome_message: settings.welcome_message
    });
  } catch (error) {
    console.error('Portal login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/**
 * POST /api/portal/auth/logout
 * Invalidate session token
 */
router.post('/logout', clientAuthMiddleware, async (req, res) => {
  try {
    await db.run(`
      UPDATE client_access_tokens
      SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.client.tokenId]);

    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Portal logout error:', error);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

/**
 * GET /api/portal/auth/validate
 * Check if current token is valid
 */
router.get('/validate', clientAuthMiddleware, async (req, res) => {
  res.json({ valid: true });
});

/**
 * GET /api/portal/auth/me
 * Get current client info and permissions
 */
router.get('/me', clientAuthMiddleware, async (req, res) => {
  try {
    // Get settings with welcome message
    const settings = await db.get(`
      SELECT * FROM client_portal_settings WHERE client_id = ?
    `, [req.client.id]);

    res.json({
      client: {
        id: req.client.id,
        name: req.client.name,
        company: req.client.company,
        email: req.client.email
      },
      permissions: {
        can_view_projects: !!req.client.permissions.can_view_projects,
        can_view_tasks: !!req.client.permissions.can_view_tasks,
        can_view_invoices: !!req.client.permissions.can_view_invoices,
        can_view_metrics: !!req.client.permissions.can_view_metrics,
        can_approve_tasks: !!req.client.permissions.can_approve_tasks,
        can_comment_tasks: !!req.client.permissions.can_comment_tasks,
        can_view_team: !!req.client.permissions.can_view_team,
        can_download_files: !!req.client.permissions.can_download_files
      },
      welcome_message: settings?.welcome_message || null
    });
  } catch (error) {
    console.error('Error getting client info:', error);
    res.status(500).json({ error: 'Error al obtener información del cliente' });
  }
});

export default router;
