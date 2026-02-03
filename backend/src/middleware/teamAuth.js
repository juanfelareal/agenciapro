import db from '../config/database.js';

/**
 * Middleware to authenticate team member requests (multi-tenant).
 *
 * Tries new user_session_tokens first, falls back to legacy team_session_tokens.
 *
 * Sets on req:
 *   - req.user       = { id, email, name } (from users table)
 *   - req.orgId       = current_org_id (INTEGER — use this in all queries)
 *   - req.currentOrg  = { id, name, slug, logo_url } (from organizations table)
 *   - req.teamMember  = { id, name, email, role, position, permissions, tokenId }
 *                        (id = team_members.id for FK compat with existing code)
 *   - req.tokenId     = user_session_tokens.id (for session management)
 */
export const teamAuthMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Token requerido.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // --- Try new multi-tenant session first ---
    const newToken = await db.get(`
      SELECT ust.id as token_id, ust.user_id, ust.current_org_id, ust.status, ust.expires_at,
             u.name as user_name, u.email as user_email,
             o.id as org_id, o.name as org_name, o.slug as org_slug, o.logo_url as org_logo_url
      FROM user_session_tokens ust
      JOIN users u ON ust.user_id = u.id
      JOIN organizations o ON ust.current_org_id = o.id
      WHERE ust.token = ?
        AND ust.status = 'active'
    `, [token]);

    if (newToken) {
      // Check expiration
      if (newToken.expires_at && new Date(newToken.expires_at) < new Date()) {
        await db.run(`UPDATE user_session_tokens SET status = 'expired' WHERE id = ?`, [newToken.token_id]);
        return res.status(401).json({ error: 'Sesión expirada. Por favor inicie sesión nuevamente.' });
      }

      // Update last_used_at
      await db.run(`UPDATE user_session_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`, [newToken.token_id]);

      // Get team_member for this user+org (the membership record)
      const membership = await db.get(`
        SELECT id, name, email, role, position, permissions
        FROM team_members
        WHERE user_id = ? AND organization_id = ? AND status = 'active'
      `, [newToken.user_id, newToken.current_org_id]);

      if (!membership) {
        return res.status(401).json({ error: 'No tienes membresía activa en esta organización.' });
      }

      // Parse permissions
      let permissions = {};
      if (membership.permissions) {
        try { permissions = JSON.parse(membership.permissions); } catch (e) { /* ignore */ }
      }

      // Set req properties
      req.user = {
        id: newToken.user_id,
        email: newToken.user_email,
        name: newToken.user_name
      };

      req.orgId = newToken.current_org_id;

      req.currentOrg = {
        id: newToken.org_id,
        name: newToken.org_name,
        slug: newToken.org_slug,
        logo_url: newToken.org_logo_url
      };

      req.teamMember = {
        id: membership.id,
        name: membership.name,
        email: membership.email,
        role: membership.role,
        position: membership.position,
        permissions: permissions,
        tokenId: null // legacy token id not applicable
      };

      req.tokenId = newToken.token_id;

      return next();
    }

    // --- Fallback to legacy team_session_tokens ---
    const legacyToken = await db.get(`
      SELECT tst.*, tm.name, tm.email, tm.role, tm.position, tm.permissions,
             tm.user_id, tm.organization_id
      FROM team_session_tokens tst
      JOIN team_members tm ON tst.team_member_id = tm.id
      WHERE tst.token = ?
        AND tst.status = 'active'
        AND tm.status = 'active'
    `, [token]);

    if (!legacyToken) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }

    // Check expiration
    if (legacyToken.expires_at && new Date(legacyToken.expires_at) < new Date()) {
      await db.run(`UPDATE team_session_tokens SET status = 'expired' WHERE id = ?`, [legacyToken.id]);
      return res.status(401).json({ error: 'Sesión expirada. Por favor inicie sesión nuevamente.' });
    }

    // Update last_used_at
    await db.run(`UPDATE team_session_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`, [legacyToken.id]);

    // Parse permissions
    let permissions = {};
    if (legacyToken.permissions) {
      try { permissions = JSON.parse(legacyToken.permissions); } catch (e) { /* ignore */ }
    }

    // Set req properties (legacy mode: orgId from team_member if available)
    req.user = legacyToken.user_id ? {
      id: legacyToken.user_id,
      email: legacyToken.email,
      name: legacyToken.name
    } : null;

    req.orgId = legacyToken.organization_id || null;

    // Try to get org info if organization_id exists
    if (legacyToken.organization_id) {
      const org = await db.get(`SELECT id, name, slug, logo_url FROM organizations WHERE id = ?`, [legacyToken.organization_id]);
      req.currentOrg = org || null;
    } else {
      req.currentOrg = null;
    }

    req.teamMember = {
      id: legacyToken.team_member_id,
      name: legacyToken.name,
      email: legacyToken.email,
      role: legacyToken.role,
      position: legacyToken.position,
      permissions: permissions,
      tokenId: legacyToken.id
    };

    req.tokenId = null; // no user_session_token id in legacy mode

    next();
  } catch (error) {
    console.error('Team auth error:', error);
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = (req, res, next) => {
  if (!req.teamMember) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (req.teamMember.role !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Se requiere rol de administrador'
    });
  }

  next();
};

/**
 * Middleware to check if user is admin or manager
 */
export const requireManagerOrAbove = (req, res, next) => {
  if (!req.teamMember) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (!['admin', 'manager'].includes(req.teamMember.role)) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Se requiere rol de administrador o manager'
    });
  }

  next();
};

export default teamAuthMiddleware;
