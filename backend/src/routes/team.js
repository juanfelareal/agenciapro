import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { teamAuthMiddleware, requireAdmin } from '../middleware/teamAuth.js';
import { sendWelcomeEmail } from '../utils/emailHelper.js';

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
 * PUT /api/team/org-logo
 * Update organization logo (admin only)
 */
router.put('/org-logo', teamAuthMiddleware, requireAdmin, async (req, res) => {
  try {
    const { logo_url } = req.body;

    if (logo_url && logo_url.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'La imagen es demasiado grande. Máximo 1.5MB.' });
    }

    await db.run(
      'UPDATE organizations SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [logo_url || null, req.orgId]
    );

    res.json({ success: true, message: 'Logo actualizado correctamente', logo_url: logo_url || null });
  } catch (error) {
    console.error('Error updating org logo:', error);
    res.status(500).json({ error: 'Error al actualizar el logo' });
  }
});

/**
 * PUT /api/team/profile
 * Update own name and position
 */
router.put('/profile', teamAuthMiddleware, async (req, res) => {
  try {
    const { name, position } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const trimmedName = name.trim();
    const trimmedPosition = position?.trim() || null;

    // Update team_member record
    await db.run(
      'UPDATE team_members SET name = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [trimmedName, trimmedPosition, req.teamMember.id]
    );

    // Also update the users table name if user_id exists
    const member = await db.get('SELECT user_id FROM team_members WHERE id = ?', [req.teamMember.id]);
    if (member?.user_id) {
      await db.run('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [trimmedName, member.user_id]);
    }

    res.json({ success: true, message: 'Perfil actualizado correctamente' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
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
    const { name, email, role, position, status, hire_date, birthday, permissions, pin, send_email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const emailLower = email.toLowerCase().trim();

    // Hash PIN if provided
    let pinHash = null;
    if (pin) {
      if (pin.length < 4) {
        return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
      }
      pinHash = await bcrypt.hash(pin, 10);
    }

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

    // Update user pin_hash if PIN was provided
    if (pinHash) {
      await db.run('UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pinHash, user.id]);
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
      INSERT INTO team_members (name, email, role, position, status, hire_date, birthday, permissions, pin_hash, user_id, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      name, emailLower, role || 'member', position, status || 'active',
      hire_date, birthday, permissions ? JSON.stringify(permissions) : null,
      pinHash, user.id, req.orgId
    ]);

    const member = await db.get('SELECT * FROM team_members WHERE id = ?', [result.lastInsertRowid]);

    // Send welcome email if requested
    if (send_email && pin) {
      try {
        const org = await db.get('SELECT name FROM organizations WHERE id = ?', [req.orgId]);
        const loginUrl = (process.env.FRONTEND_URL || 'https://agencia.larealmarketing.com') + '/login';
        await sendWelcomeEmail({
          to: emailLower,
          memberName: name,
          email: emailLower,
          pin,
          orgName: org?.name || 'La organización',
          loginUrl,
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail the member creation, just log the error
      }
    }

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

/**
 * POST /api/team/leave-org
 * Leave current organization (removes team_member record)
 */
router.post('/leave-org', teamAuthMiddleware, async (req, res) => {
  try {
    const memberId = req.teamMember.id;
    const orgId = req.orgId;

    // Check if user is the only admin in this org
    if (req.teamMember.role === 'admin') {
      const adminCount = await db.get(
        `SELECT COUNT(*) as count FROM team_members WHERE organization_id = ? AND role = 'admin' AND status = 'active'`,
        [orgId]
      );
      if (adminCount.count <= 1) {
        return res.status(400).json({
          error: 'No puedes salir porque eres el único administrador de esta organización. Asigna otro administrador primero.'
        });
      }
    }

    // Delete the team_member record
    await db.run('DELETE FROM team_members WHERE id = ? AND organization_id = ?', [memberId, orgId]);

    // Revoke current session tokens
    if (req.tokenId) {
      await db.run(`UPDATE user_session_tokens SET status = 'revoked' WHERE id = ?`, [req.tokenId]);
    }
    if (req.teamMember?.tokenId) {
      await db.run(`UPDATE team_session_tokens SET status = 'revoked' WHERE id = ?`, [req.teamMember.tokenId]);
    }

    res.json({ success: true, message: 'Has salido de la organización exitosamente' });
  } catch (error) {
    console.error('Error leaving org:', error);
    res.status(500).json({ error: 'Error al salir de la organización' });
  }
});

export default router;
