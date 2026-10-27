import express from 'express';
import crypto from 'crypto';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';
import { normalizeBranding } from '../../utils/branding.js'; // [branding]
import { loginThrottle } from '../../middleware/loginThrottle.js';

const router = express.Router();

/**
 * [branding] Agencia dueña del cliente: nombre, logo y marca (acento, tema…)
 * para que el portal se vea con la identidad de la agencia.
 */
async function getAgencyForClient(clientId) {
  try {
    const org = await db.get(`
      SELECT o.name, o.logo_url, o.branding
      FROM clients c
      JOIN organizations o ON o.id = c.organization_id
      WHERE c.id = ?
    `, [clientId]);
    if (!org) return null;
    const branding = normalizeBranding(org.branding, { logo_url: org.logo_url });
    return { name: org.name, logo_url: branding.logo_url || org.logo_url || null, branding };
  } catch (e) {
    console.error('Portal agency branding lookup failed:', e.message);
    return null;
  }
}

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
router.post('/login', loginThrottle({ emailField: 'code' }), async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código de invitación requerido' });
    }

    // Clean the code (remove spaces, dashes variations)
    const cleanCode = code.toUpperCase().replace(/\s/g, '');

    // Find the invite token
    const invite = await db.get(`
      SELECT cat.*, c.name as client_name, c.nickname as client_nickname, c.company, c.email, c.logo_url as client_logo_url,
             c.organization_id as client_org_id
      FROM client_access_tokens cat
      JOIN clients c ON cat.client_id = c.id
      WHERE cat.token = ?
        AND cat.token_type = 'invite'
        AND cat.status IN ('pending', 'active')
    `, [cleanCode]);

    if (!invite) {
      req.loginThrottle?.fail();
      return res.status(401).json({ error: 'Código de invitación inválido' });
    }

    // Generate session token (permanent, no expiration)
    const sessionToken = generateSessionToken();

    // Create session
    // La sesión hereda la organización del cliente (nunca NULL: el backfill de arranque la asignaría a la org 1)
    const clientOrgId = invite.client_org_id || invite.organization_id || null;
    await db.run(`
      INSERT INTO client_access_tokens (client_id, token, token_type, status, expires_at, last_used_at, organization_id)
      VALUES (?, ?, 'session', 'active', NULL, CURRENT_TIMESTAMP, ?)
    `, [invite.client_id, sessionToken, clientOrgId]);

    // Get portal settings
    let settings = await db.get(`
      SELECT * FROM client_portal_settings WHERE client_id = ?
    `, [invite.client_id]);

    // Create default settings if not exist
    if (!settings) {
      await db.run(`INSERT INTO client_portal_settings (client_id, organization_id) VALUES (?, ?)`, [invite.client_id, clientOrgId]);
      settings = await db.get(`SELECT * FROM client_portal_settings WHERE client_id = ?`, [invite.client_id]);
    }

    // Helper to default to true for backwards compatibility (new fields may be null)
    const toBool = (val, defaultVal = true) => val === null || val === undefined ? defaultVal : !!val;
    const agency = await getAgencyForClient(invite.client_id); // [branding]

    res.json({
      token: sessionToken,
      client: {
        id: invite.client_id,
        name: invite.client_name,
        nickname: invite.client_nickname,
        company: invite.company,
        email: invite.email,
        logo_url: invite.client_logo_url || null
      },
      agency, // [branding] { name, logo_url, branding }
      permissions: {
        can_view_dashboard: toBool(settings.can_view_dashboard),
        can_view_projects: toBool(settings.can_view_projects),
        can_view_tasks: toBool(settings.can_view_tasks),
        can_view_invoices: toBool(settings.can_view_invoices),
        can_view_payment_proofs: toBool(settings.can_view_payment_proofs),
        can_view_metrics: toBool(settings.can_view_metrics),
        can_view_reports: toBool(settings.can_view_reports),
        can_view_calls: toBool(settings.can_view_calls),
        can_view_forms: toBool(settings.can_view_forms),
        can_view_ugc: toBool(settings.can_view_ugc, false), // UGC defaults to false
        can_view_documents: toBool(settings.can_view_documents),
        can_approve_tasks: toBool(settings.can_approve_tasks),
        can_comment_tasks: toBool(settings.can_comment_tasks),
        can_view_team: toBool(settings.can_view_team, false), // Team defaults to false
        can_download_files: toBool(settings.can_download_files),
        can_view_financials: toBool(settings.can_view_financials, false),
        financials_editable: toBool(settings.financials_editable, false),
        scenarios_enabled: toBool(settings.scenarios_enabled, false)
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

    // Helper to default to true for backwards compatibility (new fields may be null)
    const toBool = (val, defaultVal = true) => val === null || val === undefined ? defaultVal : !!val;
    const p = req.client.permissions;
    const agency = await getAgencyForClient(req.client.id); // [branding]

    res.json({
      client: {
        id: req.client.id,
        name: req.client.name,
        nickname: req.client.nickname,
        company: req.client.company,
        email: req.client.email,
        logo_url: req.client.logo_url || null
      },
      agency, // [branding] { name, logo_url, branding }
      permissions: {
        can_view_dashboard: toBool(p.can_view_dashboard),
        can_view_projects: toBool(p.can_view_projects),
        can_view_tasks: toBool(p.can_view_tasks),
        can_view_invoices: toBool(p.can_view_invoices),
        can_view_payment_proofs: toBool(p.can_view_payment_proofs),
        can_view_metrics: toBool(p.can_view_metrics),
        can_view_reports: toBool(p.can_view_reports),
        can_view_calls: toBool(p.can_view_calls),
        can_view_forms: toBool(p.can_view_forms),
        can_view_ugc: toBool(p.can_view_ugc, false),
        can_view_documents: toBool(p.can_view_documents),
        can_approve_tasks: toBool(p.can_approve_tasks),
        can_comment_tasks: toBool(p.can_comment_tasks),
        can_view_team: toBool(p.can_view_team, false),
        can_download_files: toBool(p.can_download_files),
        can_view_financials: toBool(p.can_view_financials, false),
        financials_editable: toBool(p.financials_editable, false),
        scenarios_enabled: toBool(p.scenarios_enabled, false)
      },
      welcome_message: settings?.welcome_message || null
    });
  } catch (error) {
    console.error('Error getting client info:', error);
    res.status(500).json({ error: 'Error al obtener información del cliente' });
  }
});

export default router;
