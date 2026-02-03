import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { teamAuthMiddleware } from '../middleware/teamAuth.js';

const router = express.Router();

/**
 * Generate a secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ========================================
// PUBLIC AUTH ENDPOINTS (no auth required)
// ========================================

/**
 * POST /api/auth/bootstrap
 * One-time setup to create first admin with PIN
 * Creates user + org "LA REAL" + team_member
 */
router.post('/bootstrap', async (req, res) => {
  try {
    const { email, pin, name } = req.body;

    if (!email || !pin) {
      return res.status(400).json({ error: 'Email y PIN son requeridos' });
    }

    if (pin.length < 4) {
      return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
    }

    // Check if any user already has a PIN set
    const existingWithPin = await db.get(`
      SELECT id FROM users WHERE pin_hash IS NOT NULL LIMIT 1
    `);

    if (existingWithPin) {
      return res.status(403).json({
        error: 'Bootstrap ya no está disponible. Ya existen usuarios con PIN configurado.'
      });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    const emailLower = email.toLowerCase().trim();
    const userName = name || 'Admin';

    // Create or get user
    let user = await db.get(`SELECT * FROM users WHERE email = ?`, [emailLower]);
    if (!user) {
      const userResult = await db.run(`
        INSERT INTO users (email, name, pin_hash)
        VALUES (?, ?, ?)
        RETURNING id
      `, [emailLower, userName, pinHash]);
      user = await db.get(`SELECT * FROM users WHERE id = ?`, [userResult.lastInsertRowid]);
    } else {
      await db.run(`UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [pinHash, user.id]);
    }

    // Create default org if none exists
    let org = await db.get(`SELECT * FROM organizations LIMIT 1`);
    if (!org) {
      const orgResult = await db.run(`
        INSERT INTO organizations (name, slug, plan)
        VALUES ('LA REAL', 'la-real', 'free')
        RETURNING id
      `);
      org = await db.get(`SELECT * FROM organizations WHERE id = ?`, [orgResult.lastInsertRowid]);
    }

    // Create or update team_member
    let member = await db.get(`SELECT * FROM team_members WHERE email = ?`, [emailLower]);
    if (!member) {
      await db.run(`
        INSERT INTO team_members (name, email, role, status, user_id, organization_id, pin_hash)
        VALUES (?, ?, 'admin', 'active', ?, ?, ?)
      `, [userName, emailLower, user.id, org.id, pinHash]);
    } else {
      await db.run(`
        UPDATE team_members SET pin_hash = ?, role = 'admin', user_id = ?, organization_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [pinHash, user.id, org.id, member.id]);
    }

    res.json({
      success: true,
      message: 'PIN de admin establecido correctamente. Ya puedes iniciar sesión.',
      email: emailLower
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Error en bootstrap: ' + error.message });
  }
});

/**
 * POST /api/auth/login
 * Login with email + PIN
 * Returns token, user info, and organizations list
 */
router.post('/login', async (req, res) => {
  try {
    const { email, pin } = req.body;

    if (!email || !pin) {
      return res.status(400).json({ error: 'Email y PIN son requeridos' });
    }

    const emailLower = email.toLowerCase().trim();

    // Find user by email
    const user = await db.get(`SELECT * FROM users WHERE email = ?`, [emailLower]);

    if (!user) {
      // Fallback: try legacy team_members login for non-migrated instances
      return await legacyLogin(req, res, emailLower, pin);
    }

    if (!user.pin_hash) {
      return res.status(401).json({ error: 'PIN no configurado. Contacta al administrador.' });
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, user.pin_hash);
    if (!isValidPin) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Get organizations this user belongs to
    const memberships = await db.all(`
      SELECT tm.id as team_member_id, tm.role, tm.position, tm.permissions,
             o.id as org_id, o.name as org_name, o.slug as org_slug, o.logo_url as org_logo_url
      FROM team_members tm
      JOIN organizations o ON tm.organization_id = o.id
      WHERE tm.user_id = ? AND tm.status = 'active'
      ORDER BY o.name
    `, [user.id]);

    if (memberships.length === 0) {
      return res.status(401).json({ error: 'No perteneces a ninguna organización activa.' });
    }

    // Auto-select first org (or only org)
    const currentOrg = memberships[0];

    // Generate session token
    const sessionToken = generateSessionToken();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session with current_org_id
    await db.run(`
      INSERT INTO user_session_tokens (user_id, current_org_id, token, status, expires_at, last_used_at)
      VALUES (?, ?, ?, 'active', ?, CURRENT_TIMESTAMP)
    `, [user.id, currentOrg.org_id, sessionToken, sessionExpires.toISOString()]);

    // Also create legacy session for backward compat during transition
    await db.run(`
      INSERT INTO team_session_tokens (team_member_id, token, status, expires_at, last_used_at)
      VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP)
    `, [currentOrg.team_member_id, sessionToken, sessionExpires.toISOString()]);

    // Parse permissions
    let permissions = {};
    if (currentOrg.permissions) {
      try { permissions = JSON.parse(currentOrg.permissions); } catch (e) { /* ignore */ }
    }

    const organizations = memberships.map(m => ({
      id: m.org_id,
      name: m.org_name,
      slug: m.org_slug,
      logo_url: m.org_logo_url,
      role: m.role
    }));

    res.json({
      token: sessionToken,
      expires_at: sessionExpires.toISOString(),
      user: {
        id: currentOrg.team_member_id, // team_members.id for FK compat
        userId: user.id,               // users.id
        name: user.name,
        email: user.email,
        role: currentOrg.role,
        position: currentOrg.position,
        permissions
      },
      current_org: {
        id: currentOrg.org_id,
        name: currentOrg.org_name,
        slug: currentOrg.org_slug,
        logo_url: currentOrg.org_logo_url
      },
      organizations
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/**
 * Legacy login fallback for instances that haven't run migration yet
 */
async function legacyLogin(req, res, emailLower, pin) {
  const member = await db.get(`
    SELECT * FROM team_members WHERE email = ? AND status = 'active'
  `, [emailLower]);

  if (!member) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  if (!member.pin_hash) {
    return res.status(401).json({ error: 'PIN no configurado. Contacta al administrador.' });
  }

  const isValidPin = await bcrypt.compare(pin, member.pin_hash);
  if (!isValidPin) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const sessionToken = generateSessionToken();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.run(`
    INSERT INTO team_session_tokens (team_member_id, token, status, expires_at, last_used_at)
    VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP)
  `, [member.id, sessionToken, sessionExpires.toISOString()]);

  let permissions = {};
  if (member.permissions) {
    try { permissions = JSON.parse(member.permissions); } catch (e) { /* ignore */ }
  }

  // Return response compatible with new format (no org info in legacy mode)
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
    },
    current_org: null,
    organizations: []
  });
}

/**
 * POST /api/auth/select-org
 * Switch to a different organization (requires auth)
 */
router.post('/select-org', teamAuthMiddleware, async (req, res) => {
  try {
    const { org_id } = req.body;

    if (!org_id) {
      return res.status(400).json({ error: 'org_id es requerido' });
    }

    // Verify user has membership in this org
    const membership = await db.get(`
      SELECT tm.*, o.name as org_name, o.slug as org_slug, o.logo_url as org_logo_url
      FROM team_members tm
      JOIN organizations o ON tm.organization_id = o.id
      WHERE tm.user_id = ? AND tm.organization_id = ? AND tm.status = 'active'
    `, [req.user.id, org_id]);

    if (!membership) {
      return res.status(403).json({ error: 'No tienes acceso a esta organización.' });
    }

    // Update session's current_org_id
    await db.run(`
      UPDATE user_session_tokens SET current_org_id = ? WHERE id = ?
    `, [org_id, req.tokenId]);

    // Parse permissions
    let permissions = {};
    if (membership.permissions) {
      try { permissions = JSON.parse(membership.permissions); } catch (e) { /* ignore */ }
    }

    res.json({
      success: true,
      user: {
        id: membership.id,
        userId: req.user.id,
        name: membership.name,
        email: membership.email,
        role: membership.role,
        position: membership.position,
        permissions
      },
      current_org: {
        id: org_id,
        name: membership.org_name,
        slug: membership.org_slug,
        logo_url: membership.org_logo_url
      }
    });
  } catch (error) {
    console.error('Select org error:', error);
    res.status(500).json({ error: 'Error al cambiar de organización' });
  }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', teamAuthMiddleware, async (req, res) => {
  try {
    // Revoke user_session_token
    if (req.tokenId) {
      await db.run(`UPDATE user_session_tokens SET status = 'revoked' WHERE id = ?`, [req.tokenId]);
    }
    // Also revoke legacy token if it exists
    if (req.teamMember?.tokenId) {
      await db.run(`UPDATE team_session_tokens SET status = 'revoked' WHERE id = ?`, [req.teamMember.tokenId]);
    }

    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info + org info
 */
router.get('/me', teamAuthMiddleware, async (req, res) => {
  try {
    // Get all organizations for this user
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

/**
 * GET /api/auth/validate
 * Check if current token is valid
 */
router.get('/validate', teamAuthMiddleware, async (req, res) => {
  res.json({ valid: true });
});

// ========================================
// REGISTRATION (public)
// ========================================

/**
 * POST /api/auth/register
 * Register a new user + organization
 * Creates user, org, and admin membership in a single transaction
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, pin, org_name, logo_base64, onboarding } = req.body;

    if (!name || !email || !pin || !org_name) {
      return res.status(400).json({ error: 'Nombre, email, PIN y nombre de organizacion son requeridos' });
    }

    if (pin.length < 4) {
      return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
    }

    // Validate logo_base64 if provided
    let logoUrl = null;
    if (logo_base64) {
      if (!logo_base64.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Logo invalido: debe ser una imagen en base64' });
      }
      if (logo_base64.length > 700000) {
        return res.status(400).json({ error: 'Logo demasiado grande: max 500KB' });
      }
      logoUrl = logo_base64;
    }

    // Build settings with onboarding data
    let settings = null;
    if (onboarding && typeof onboarding === 'object') {
      settings = JSON.stringify({
        onboarding: {
          business_type: onboarding.business_type || null,
          team_size: onboarding.team_size || null,
          goals: onboarding.goals || [],
          alternatives: onboarding.alternatives || [],
          how_found_us: onboarding.how_found_us || null,
          completed_at: new Date().toISOString()
        }
      });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [emailLower]);
    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe una cuenta con este email' });
    }

    // Generate slug from org name
    let slug = generateSlug(org_name);
    // Check uniqueness and add number if needed
    const existingSlug = await db.get('SELECT id FROM organizations WHERE slug = ?', [slug]);
    if (existingSlug) {
      slug = slug + '-' + Date.now().toString(36);
    }

    const pinHash = await bcrypt.hash(pin, 10);

    // Create user
    const userResult = await db.run(`
      INSERT INTO users (email, name, pin_hash)
      VALUES (?, ?, ?)
      RETURNING id
    `, [emailLower, name, pinHash]);
    const userId = userResult.lastInsertRowid;

    // Create organization with optional logo and settings
    const orgResult = await db.run(`
      INSERT INTO organizations (name, slug, plan, logo_url, settings)
      VALUES (?, ?, 'free', ?, ?)
      RETURNING id
    `, [org_name, slug, logoUrl, settings]);
    const orgId = orgResult.lastInsertRowid;

    // Create admin membership
    await db.run(`
      INSERT INTO team_members (name, email, role, status, user_id, organization_id, pin_hash)
      VALUES (?, ?, 'admin', 'active', ?, ?, ?)
    `, [name, emailLower, userId, orgId, pinHash]);

    // Auto-login: create session
    const sessionToken = generateSessionToken();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.run(`
      INSERT INTO user_session_tokens (user_id, current_org_id, token, status, expires_at, last_used_at)
      VALUES (?, ?, ?, 'active', ?, CURRENT_TIMESTAMP)
    `, [userId, orgId, sessionToken, sessionExpires.toISOString()]);

    // Get the team member we just created
    const member = await db.get(`
      SELECT id, name, email, role, position, permissions
      FROM team_members WHERE user_id = ? AND organization_id = ?
    `, [userId, orgId]);

    res.status(201).json({
      token: sessionToken,
      expires_at: sessionExpires.toISOString(),
      user: {
        id: member.id,
        userId: userId,
        name: name,
        email: emailLower,
        role: 'admin',
        position: null,
        permissions: {}
      },
      current_org: {
        id: orgId,
        name: org_name,
        slug: slug,
        logo_url: logoUrl
      },
      organizations: [{
        id: orgId,
        name: org_name,
        slug: slug,
        logo_url: logoUrl,
        role: 'admin'
      }]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error al registrar: ' + error.message });
  }
});

/**
 * POST /api/team/invite (via auth routes)
 * Invite a user to the current organization
 * Admin creates a user (without PIN) + membership
 * User sets PIN on first login
 */
router.post('/invite', teamAuthMiddleware, async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    // Only admin can invite
    if (req.teamMember.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden invitar miembros' });
    }

    const emailLower = email.toLowerCase().trim();

    // Create or get user
    let user = await db.get('SELECT id FROM users WHERE email = ?', [emailLower]);
    if (!user) {
      const userResult = await db.run(`
        INSERT INTO users (email, name)
        VALUES (?, ?)
        RETURNING id
      `, [emailLower, name]);
      user = { id: userResult.lastInsertRowid };
    }

    // Check if membership already exists
    const existingMembership = await db.get(
      'SELECT id FROM team_members WHERE user_id = ? AND organization_id = ?',
      [user.id, req.orgId]
    );
    if (existingMembership) {
      return res.status(400).json({ error: 'Este usuario ya es miembro de esta organización' });
    }

    // Create membership (no PIN — user sets it on first login)
    const result = await db.run(`
      INSERT INTO team_members (name, email, role, status, user_id, organization_id)
      VALUES (?, ?, ?, 'active', ?, ?)
      RETURNING id
    `, [name, emailLower, role || 'member', user.id, req.orgId]);

    const member = await db.get('SELECT * FROM team_members WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      success: true,
      message: `${name} ha sido invitado. Debe configurar su PIN para acceder.`,
      member
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Error al invitar: ' + error.message });
  }
});

export default router;
