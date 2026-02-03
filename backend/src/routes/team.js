import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { teamAuthMiddleware, requireAdmin } from '../middleware/teamAuth.js';

const router = express.Router();

// ========================================
// LEGACY AUTH ENDPOINTS (redirect to /api/auth)
// Kept for backward compatibility during transition
// ========================================

router.post('/auth/bootstrap', async (req, res) => {
  // Forward to auth route
  res.status(301).json({
    error: 'Endpoint moved to /api/auth/bootstrap',
    redirect: '/api/auth/bootstrap'
  });
});

router.post('/auth/login', async (req, res, next) => {
  // Import and delegate to auth login handler
  const { default: authRouter } = await import('./auth.js');
  // Forward request through auth router's login
  req.url = '/login';
  authRouter.handle(req, res, next);
});

router.post('/auth/logout', teamAuthMiddleware, async (req, res) => {
  try {
    // Revoke both token types
    if (req.tokenId) {
      await db.run(`UPDATE user_session_tokens SET status = 'revoked' WHERE id = ?`, [req.tokenId]);
    }
    if (req.teamMember?.tokenId) {
      await db.run(`UPDATE team_session_tokens SET status = 'revoked' WHERE id = ?`, [req.teamMember.tokenId]);
    }
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Team logout error:', error);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

router.get('/auth/me', teamAuthMiddleware, async (req, res) => {
  try {
    // Get organizations for this user
    let organizations = [];
    if (req.user) {
      organizations = await db.all(`
        SELECT o.id, o.name, o.slug, o.logo_url, tm.role
        FROM team_members tm
        JOIN organizations o ON tm.organization_id = o.id
        WHERE tm.user_id = ? AND tm.status = 'active'
        ORDER BY o.name
      `, [req.user.id]);
    }

    res.json({
      user: {
        id: req.teamMember.id,
        userId: req.user?.id || null,
        name: req.teamMember.name,
        email: req.teamMember.email,
        role: req.teamMember.role,
        position: req.teamMember.position,
        permissions: req.teamMember.permissions
      },
      current_org: req.currentOrg || null,
      organizations
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Error al obtener información del usuario' });
  }
});

router.get('/auth/validate', teamAuthMiddleware, async (req, res) => {
  res.json({ valid: true });
});

// ========================================
// PIN MANAGEMENT (requires auth)
// ========================================

/**
 * POST /api/team/:id/set-pin
 * Set PIN for a team member (admin only)
 */
router.post('/:id/set-pin', teamAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const { pin } = req.body;
    const memberId = req.params.id;

    if (!pin || pin.length < 4) {
      return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
    }

    // Check if member exists and belongs to same org
    const member = await db.get(
      'SELECT * FROM team_members WHERE id = ? AND organization_id = ?',
      [memberId, req.orgId]
    );
    if (!member) {
      return res.status(404).json({ error: 'Miembro del equipo no encontrado' });
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Update team_member pin_hash
    await db.run(`
      UPDATE team_members SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [pinHash, memberId]);

    // Also update users table if user_id exists
    if (member.user_id) {
      await db.run(`
        UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [pinHash, member.user_id]);
    }

    res.json({ success: true, message: 'PIN establecido correctamente' });
  } catch (error) {
    console.error('Error setting PIN:', error);
    res.status(500).json({ error: 'Error al establecer el PIN' });
  }
});

/**
 * POST /api/team/change-pin
 * Change own PIN (requires current PIN)
 */
router.post('/change-pin', teamAuthMiddleware, async (req, res) => {
  try {
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'PIN actual y nuevo PIN son requeridos' });
    }

    if (newPin.length < 4) {
      return res.status(400).json({ error: 'El nuevo PIN debe tener al menos 4 caracteres' });
    }

    // Get current member with pin_hash
    const member = await db.get('SELECT * FROM team_members WHERE id = ?', [req.teamMember.id]);

    if (!member.pin_hash) {
      return res.status(400).json({ error: 'No tienes PIN configurado' });
    }

    // Verify current PIN
    const isValidPin = await bcrypt.compare(currentPin, member.pin_hash);
    if (!isValidPin) {
      return res.status(401).json({ error: 'PIN actual incorrecto' });
    }

    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin, 10);

    // Update PIN on team_member
    await db.run(`
      UPDATE team_members SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [newPinHash, req.teamMember.id]);

    // Also update users table if user_id exists
    if (member.user_id) {
      await db.run(`
        UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newPinHash, member.user_id]);
    }

    res.json({ success: true, message: 'PIN actualizado correctamente' });
  } catch (error) {
    console.error('Error changing PIN:', error);
    res.status(500).json({ error: 'Error al cambiar el PIN' });
  }
});

// ========================================
// TEAM MEMBER CRUD (org-scoped)
// ========================================

// Get all team members (for current org)
router.get('/', teamAuthMiddleware, async (req, res) => {
  try {
    const { status, role } = req.query;
    let query = 'SELECT * FROM team_members WHERE organization_id = ?';
    const params = [req.orgId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    query += ' ORDER BY created_at DESC';
    const members = await db.prepare(query).all(...params);
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get team member by ID (org-scoped)
router.get('/:id', teamAuthMiddleware, async (req, res) => {
  try {
    const member = await db.get(
      'SELECT * FROM team_members WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Get assigned projects (org-scoped)
    const projects = await db.all(`
      SELECT p.*, pt.role as project_role
      FROM projects p
      JOIN project_team pt ON p.id = pt.project_id
      WHERE pt.team_member_id = ? AND p.organization_id = ?
    `, [req.params.id, req.orgId]);

    member.projects = projects;
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new team member (in current org)
router.post('/', teamAuthMiddleware, async (req, res) => {
  try {
    const { name, email, role, position, status, hire_date, birthday, permissions } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if a user with this email already exists
    let user = await db.get('SELECT id FROM users WHERE email = ?', [emailLower]);
    if (!user) {
      // Create user record
      const userResult = await db.run(`
        INSERT INTO users (email, name)
        VALUES (?, ?)
        RETURNING id
      `, [emailLower, name]);
      user = { id: userResult.lastInsertRowid };
    }

    // Check if membership already exists in this org
    const existingMembership = await db.get(
      'SELECT id FROM team_members WHERE user_id = ? AND organization_id = ?',
      [user.id, req.orgId]
    );
    if (existingMembership) {
      return res.status(400).json({ error: 'Este usuario ya es miembro de esta organización' });
    }

    const result = await db.run(`
      INSERT INTO team_members (name, email, role, position, status, hire_date, birthday, permissions, user_id, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      name, emailLower, role || 'member', position, status || 'active',
      hire_date, birthday, permissions ? JSON.stringify(permissions) : null,
      user.id, req.orgId
    ]);

    const member = await db.get('SELECT * FROM team_members WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(member);
  } catch (error) {
    if (error.message?.includes('UNIQUE') || error.message?.includes('unique')) {
      return res.status(400).json({ error: 'Este usuario ya es miembro de esta organización' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update team member (org-scoped)
router.put('/:id', teamAuthMiddleware, async (req, res) => {
  try {
    const { name, email, role, position, status, hire_date, birthday, permissions } = req.body;

    // Verify member belongs to this org
    const existing = await db.get(
      'SELECT * FROM team_members WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    await db.run(`
      UPDATE team_members
      SET name = ?, email = ?, role = ?, position = ?, status = ?,
          hire_date = ?, birthday = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [
      name, email, role, position, status,
      hire_date, birthday, permissions ? JSON.stringify(permissions) : null,
      req.params.id, req.orgId
    ]);

    const member = await db.get('SELECT * FROM team_members WHERE id = ?', [req.params.id]);
    res.json(member);
  } catch (error) {
    if (error.message?.includes('UNIQUE') || error.message?.includes('unique')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete team member (org-scoped)
router.delete('/:id', teamAuthMiddleware, async (req, res) => {
  try {
    const result = await db.run(
      'DELETE FROM team_members WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
