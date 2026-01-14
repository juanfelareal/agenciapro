import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';

const router = express.Router();

/**
 * Generate a readable invite code (e.g., ABC1-XY23)
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I, L)
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

/**
 * Generate a secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================
// PORTAL SETTINGS
// ============================================

/**
 * GET /api/portal-admin/clients/:id/settings
 * Get portal settings for a client
 */
router.get('/clients/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;

    // Check client exists
    const client = await db.get('SELECT id, name, company FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get or create settings
    let settings = await db.get('SELECT * FROM client_portal_settings WHERE client_id = ?', [id]);

    if (!settings) {
      // Create default settings
      await db.run(`
        INSERT INTO client_portal_settings (client_id)
        VALUES (?)
      `, [id]);
      settings = await db.get('SELECT * FROM client_portal_settings WHERE client_id = ?', [id]);
    }

    res.json({
      client,
      settings
    });
  } catch (error) {
    console.error('Error getting portal settings:', error);
    res.status(500).json({ error: 'Error al obtener configuración del portal' });
  }
});

/**
 * PUT /api/portal-admin/clients/:id/settings
 * Update portal settings for a client
 */
router.put('/clients/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      can_view_projects,
      can_view_tasks,
      can_view_invoices,
      can_view_metrics,
      can_approve_tasks,
      can_comment_tasks,
      can_view_team,
      can_download_files,
      welcome_message
    } = req.body;

    // Check client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Upsert settings
    const existing = await db.get('SELECT id FROM client_portal_settings WHERE client_id = ?', [id]);

    if (existing) {
      await db.run(`
        UPDATE client_portal_settings SET
          can_view_projects = COALESCE(?, can_view_projects),
          can_view_tasks = COALESCE(?, can_view_tasks),
          can_view_invoices = COALESCE(?, can_view_invoices),
          can_view_metrics = COALESCE(?, can_view_metrics),
          can_approve_tasks = COALESCE(?, can_approve_tasks),
          can_comment_tasks = COALESCE(?, can_comment_tasks),
          can_view_team = COALESCE(?, can_view_team),
          can_download_files = COALESCE(?, can_download_files),
          welcome_message = COALESCE(?, welcome_message),
          updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `, [
        can_view_projects, can_view_tasks, can_view_invoices, can_view_metrics,
        can_approve_tasks, can_comment_tasks, can_view_team, can_download_files,
        welcome_message, id
      ]);
    } else {
      await db.run(`
        INSERT INTO client_portal_settings (
          client_id, can_view_projects, can_view_tasks, can_view_invoices,
          can_view_metrics, can_approve_tasks, can_comment_tasks, can_view_team,
          can_download_files, welcome_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        can_view_projects ?? 1, can_view_tasks ?? 1, can_view_invoices ?? 1,
        can_view_metrics ?? 1, can_approve_tasks ?? 1, can_comment_tasks ?? 1,
        can_view_team ?? 0, can_download_files ?? 1, welcome_message ?? null
      ]);
    }

    const settings = await db.get('SELECT * FROM client_portal_settings WHERE client_id = ?', [id]);
    res.json(settings);
  } catch (error) {
    console.error('Error updating portal settings:', error);
    res.status(500).json({ error: 'Error al actualizar configuración del portal' });
  }
});

// ============================================
// INVITE CODES
// ============================================

/**
 * POST /api/portal-admin/clients/:id/invite
 * Generate an invite code for a client
 */
router.post('/clients/:id/invite', async (req, res) => {
  try {
    const { id } = req.params;
    const { expires_in_days, created_by } = req.body;

    // Check client exists
    const client = await db.get('SELECT id, name FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Generate unique invite code
    let inviteCode;
    let attempts = 0;
    do {
      inviteCode = generateInviteCode();
      const existing = await db.get('SELECT id FROM client_access_tokens WHERE token = ?', [inviteCode]);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Error generando código único' });
    }

    // Calculate expiration (default: 7 days)
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create invite token
    await db.run(`
      INSERT INTO client_access_tokens (client_id, token, token_type, status, expires_at, created_by)
      VALUES (?, ?, 'invite', 'pending', ?, ?)
    `, [id, inviteCode, expiresAt.toISOString(), created_by || null]);

    res.json({
      invite_code: inviteCode,
      client_name: client.name,
      expires_at: expiresAt.toISOString(),
      portal_url: `/portal/login?code=${inviteCode}`
    });
  } catch (error) {
    console.error('Error generating invite:', error);
    res.status(500).json({ error: 'Error al generar invitación' });
  }
});

/**
 * GET /api/portal-admin/clients/:id/access
 * List all access tokens for a client
 */
router.get('/clients/:id/access', async (req, res) => {
  try {
    const { id } = req.params;

    const tokens = await db.all(`
      SELECT
        cat.*,
        tm.name as created_by_name
      FROM client_access_tokens cat
      LEFT JOIN team_members tm ON cat.created_by = tm.id
      WHERE cat.client_id = ?
      ORDER BY cat.created_at DESC
    `, [id]);

    res.json(tokens);
  } catch (error) {
    console.error('Error listing access tokens:', error);
    res.status(500).json({ error: 'Error al listar tokens de acceso' });
  }
});

/**
 * DELETE /api/portal-admin/clients/:id/access/:tokenId
 * Revoke an access token
 */
router.delete('/clients/:id/access/:tokenId', async (req, res) => {
  try {
    const { id, tokenId } = req.params;

    // Verify token belongs to client
    const token = await db.get(
      'SELECT id FROM client_access_tokens WHERE id = ? AND client_id = ?',
      [tokenId, id]
    );

    if (!token) {
      return res.status(404).json({ error: 'Token no encontrado' });
    }

    // Revoke token
    await db.run(
      'UPDATE client_access_tokens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['revoked', tokenId]
    );

    res.json({ success: true, message: 'Acceso revocado exitosamente' });
  } catch (error) {
    console.error('Error revoking access:', error);
    res.status(500).json({ error: 'Error al revocar acceso' });
  }
});

/**
 * GET /api/portal-admin/clients/:id/activity
 * Get client portal activity
 */
router.get('/clients/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    // Get recent comments
    const comments = await db.all(`
      SELECT
        cc.*,
        t.title as task_title
      FROM client_comments cc
      JOIN tasks t ON cc.task_id = t.id
      WHERE cc.client_id = ?
      ORDER BY cc.created_at DESC
      LIMIT ?
    `, [id, parseInt(limit)]);

    // Get recent approvals
    const approvals = await db.all(`
      SELECT
        t.id, t.title, t.client_approval_status, t.client_approval_date, t.client_approval_notes
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ?
        AND t.client_approval_status IS NOT NULL
      ORDER BY t.client_approval_date DESC
      LIMIT ?
    `, [id, parseInt(limit)]);

    res.json({ comments, approvals });
  } catch (error) {
    console.error('Error getting client activity:', error);
    res.status(500).json({ error: 'Error al obtener actividad del cliente' });
  }
});

export { generateSessionToken };
export default router;
