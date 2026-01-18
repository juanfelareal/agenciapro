import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { teamAuthMiddleware, requireAdmin } from '../middleware/teamAuth.js';

const router = express.Router();

/**
 * Generate a secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ========================================
// AUTH ENDPOINTS (no auth required)
// ========================================

/**
 * POST /api/team/auth/bootstrap
 * One-time setup to create first admin with PIN
 * Only works if NO team members have PINs set yet
 */
router.post('/auth/bootstrap', async (req, res) => {
  try {
    const { email, pin, name } = req.body;

    if (!email || !pin) {
      return res.status(400).json({ error: 'Email y PIN son requeridos' });
    }

    if (pin.length < 4) {
      return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
    }

    // Check if any team member already has a PIN set
    const existingWithPin = await db.get(`
      SELECT id FROM team_members WHERE pin_hash IS NOT NULL LIMIT 1
    `);

    if (existingWithPin) {
      return res.status(403).json({
        error: 'Bootstrap ya no está disponible. Ya existen usuarios con PIN configurado.'
      });
    }

    // Check if member exists
    let member = await db.get(`SELECT * FROM team_members WHERE email = ?`, [email.toLowerCase().trim()]);

    if (!member) {
      // Create admin member if doesn't exist
      const result = await db.run(`
        INSERT INTO team_members (name, email, role, status)
        VALUES (?, ?, 'admin', 'active')
        RETURNING id
      `, [name || 'Admin', email.toLowerCase().trim()]);

      member = await db.get(`SELECT * FROM team_members WHERE id = ?`, [result.lastInsertRowid]);
    }

    // Hash the PIN and update
    const pinHash = await bcrypt.hash(pin, 10);
    await db.run(`
      UPDATE team_members SET pin_hash = ?, role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [pinHash, member.id]);

    res.json({
      success: true,
      message: 'PIN de admin establecido correctamente. Ya puedes iniciar sesión.',
      email: member.email
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Error en bootstrap: ' + error.message });
  }
});

/**
 * POST /api/team/auth/login
 * Login with email and PIN
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, pin } = req.body;

    if (!email || !pin) {
      return res.status(400).json({ error: 'Email y PIN son requeridos' });
    }

    // Find team member by email
    const member = await db.get(`
      SELECT * FROM team_members WHERE email = ? AND status = 'active'
    `, [email.toLowerCase().trim()]);

    if (!member) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Check if PIN is set
    if (!member.pin_hash) {
      return res.status(401).json({ error: 'PIN no configurado. Contacta al administrador.' });
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, member.pin_hash);
    if (!isValidPin) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generate session token
    const sessionToken = generateSessionToken();
    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create session
    await db.run(`
      INSERT INTO team_session_tokens (team_member_id, token, status, expires_at, last_used_at)
      VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP)
    `, [member.id, sessionToken, sessionExpires.toISOString()]);

    // Parse permissions
    let permissions = {};
    if (member.permissions) {
      try {
        permissions = JSON.parse(member.permissions);
      } catch (e) {
        permissions = {};
      }
    }

    res.json({
      token: sessionToken,
      expires_at: sessionExpires.toISOString(),
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        position: member.position,
        permissions
      }
    });
  } catch (error) {
    console.error('Team login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/**
 * POST /api/team/auth/logout
 * Logout and invalidate session
 */
router.post('/auth/logout', teamAuthMiddleware, async (req, res) => {
  try {
    await db.run(`
      UPDATE team_session_tokens
      SET status = 'revoked'
      WHERE id = ?
    `, [req.teamMember.tokenId]);

    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Team logout error:', error);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

/**
 * GET /api/team/auth/me
 * Get current user info
 */
router.get('/auth/me', teamAuthMiddleware, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.teamMember.id,
        name: req.teamMember.name,
        email: req.teamMember.email,
        role: req.teamMember.role,
        position: req.teamMember.position,
        permissions: req.teamMember.permissions
      }
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: 'Error al obtener información del usuario' });
  }
});

/**
 * GET /api/team/auth/validate
 * Check if current token is valid
 */
router.get('/auth/validate', teamAuthMiddleware, async (req, res) => {
  res.json({ valid: true });
});

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

    // Check if member exists
    const member = await db.get('SELECT * FROM team_members WHERE id = ?', [memberId]);
    if (!member) {
      return res.status(404).json({ error: 'Miembro del equipo no encontrado' });
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Update member with PIN
    await db.run(`
      UPDATE team_members SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [pinHash, memberId]);

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

    // Update PIN
    await db.run(`
      UPDATE team_members SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [newPinHash, req.teamMember.id]);

    res.json({ success: true, message: 'PIN actualizado correctamente' });
  } catch (error) {
    console.error('Error changing PIN:', error);
    res.status(500).json({ error: 'Error al cambiar el PIN' });
  }
});

// ========================================
// EXISTING TEAM ENDPOINTS
// ========================================

// Get all team members
router.get('/', async (req, res) => {
  try {
    const { status, role } = req.query;
    let query = 'SELECT * FROM team_members WHERE 1=1';
    const params = [];

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

// Get team member by ID
router.get('/:id', async (req, res) => {
  try {
    const member = await db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Get assigned projects
    const projects = await db.prepare(`
      SELECT p.*, pt.role as project_role
      FROM projects p
      JOIN project_team pt ON p.id = pt.project_id
      WHERE pt.team_member_id = ?
    `).all(req.params.id);

    member.projects = projects;
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new team member
router.post('/', async (req, res) => {
  try {
    const { name, email, role, position, status, hire_date, birthday, permissions } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const result = await db.prepare(`
      INSERT INTO team_members (name, email, role, position, status, hire_date, birthday, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      email,
      role || 'member',
      position,
      status || 'active',
      hire_date,
      birthday,
      permissions ? JSON.stringify(permissions) : null
    );

    const member = await db.prepare('SELECT * FROM team_members WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(member);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update team member
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, position, status, hire_date, birthday, permissions } = req.body;

    await db.prepare(`
      UPDATE team_members
      SET name = ?, email = ?, role = ?, position = ?, status = ?,
          hire_date = ?, birthday = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      email,
      role,
      position,
      status,
      hire_date,
      birthday,
      permissions ? JSON.stringify(permissions) : null,
      req.params.id
    );

    const member = await db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    res.json(member);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete team member
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM team_members WHERE id = ?').run(req.params.id);
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
