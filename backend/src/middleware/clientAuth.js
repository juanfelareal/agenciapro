import db from '../config/database.js';

/**
 * Middleware to authenticate client portal requests
 * Validates the Bearer token from Authorization header
 */
export const clientAuthMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Token requerido.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Find the session token
    const tokenRecord = await db.get(`
      SELECT cat.*, c.name as client_name, c.company, c.email
      FROM client_access_tokens cat
      JOIN clients c ON cat.client_id = c.id
      WHERE cat.token = ?
        AND cat.token_type = 'session'
        AND cat.status = 'active'
    `, [token]);

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }

    // Check expiration
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      // Mark as expired
      await db.run(`UPDATE client_access_tokens SET status = 'expired' WHERE id = ?`, [tokenRecord.id]);
      return res.status(401).json({ error: 'Sesión expirada. Por favor inicie sesión nuevamente.' });
    }

    // Get portal settings for this client
    const settings = await db.get(`
      SELECT * FROM client_portal_settings WHERE client_id = ?
    `, [tokenRecord.client_id]);

    // Update last_used_at
    await db.run(`
      UPDATE client_access_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [tokenRecord.id]);

    // Attach client info to request
    req.client = {
      id: tokenRecord.client_id,
      name: tokenRecord.client_name,
      company: tokenRecord.company,
      email: tokenRecord.email,
      tokenId: tokenRecord.id,
      permissions: settings || {
        can_view_projects: true,
        can_view_tasks: true,
        can_view_invoices: true,
        can_view_metrics: true,
        can_approve_tasks: true,
        can_comment_tasks: true,
        can_view_team: false,
        can_download_files: true,
      }
    };

    next();
  } catch (error) {
    console.error('Client auth error:', error);
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

/**
 * Middleware to check specific portal permissions
 * @param {string} permission - The permission to check (e.g., 'can_view_projects')
 */
export const requirePortalPermission = (permission) => {
  return (req, res, next) => {
    if (!req.client) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const hasPermission = req.client.permissions[permission];
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: `No tiene permiso para: ${permission}`
      });
    }

    next();
  };
};

export default clientAuthMiddleware;
