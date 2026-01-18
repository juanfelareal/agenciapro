import db from '../config/database.js';

/**
 * Middleware to authenticate team member requests
 * Validates the Bearer token from Authorization header
 */
export const teamAuthMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Token requerido.' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Find the session token
    const tokenRecord = await db.get(`
      SELECT tst.*, tm.name, tm.email, tm.role, tm.position, tm.permissions
      FROM team_session_tokens tst
      JOIN team_members tm ON tst.team_member_id = tm.id
      WHERE tst.token = ?
        AND tst.status = 'active'
        AND tm.status = 'active'
    `, [token]);

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }

    // Check expiration
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      // Mark as expired
      await db.run(`UPDATE team_session_tokens SET status = 'expired' WHERE id = ?`, [tokenRecord.id]);
      return res.status(401).json({ error: 'Sesión expirada. Por favor inicie sesión nuevamente.' });
    }

    // Update last_used_at
    await db.run(`
      UPDATE team_session_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [tokenRecord.id]);

    // Parse permissions if stored as JSON
    let permissions = {};
    if (tokenRecord.permissions) {
      try {
        permissions = JSON.parse(tokenRecord.permissions);
      } catch (e) {
        permissions = {};
      }
    }

    // Attach team member info to request
    req.teamMember = {
      id: tokenRecord.team_member_id,
      name: tokenRecord.name,
      email: tokenRecord.email,
      role: tokenRecord.role,
      position: tokenRecord.position,
      permissions: permissions,
      tokenId: tokenRecord.id
    };

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
