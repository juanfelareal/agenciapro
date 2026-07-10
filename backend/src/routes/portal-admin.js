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
    const orgId = req.orgId;
    const { id } = req.params;

    // Check client exists and belongs to org
    const client = await db.get('SELECT id, name, company FROM clients WHERE id = ? AND organization_id = ?', [id, orgId]);
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
    res.status(500).json({ error: 'Error al obtener configuracion del portal' });
  }
});

/**
 * PUT /api/portal-admin/clients/:id/settings
 * Update portal settings for a client
 */
router.put('/clients/:id/settings', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const {
      can_view_dashboard,
      can_view_projects,
      can_view_tasks,
      can_view_invoices,
      can_view_payment_proofs,
      can_view_metrics,
      can_view_reports,
      can_view_calls,
      can_view_forms,
      can_view_ugc,
      can_view_documents,
      can_approve_tasks,
      can_comment_tasks,
      can_view_team,
      can_download_files,
      welcome_message,
      portal_revenue_metric,
      dashboard_template
    } = req.body;

    // Check client exists and belongs to org
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [id, orgId]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Convert booleans to integers (frontend sends true/false, DB uses INTEGER 0/1)
    const toInt = (val) => val === undefined || val === null ? null : (val ? 1 : 0);

    // Upsert settings
    const existing = await db.get('SELECT id FROM client_portal_settings WHERE client_id = ?', [id]);

    if (existing) {
      await db.run(`
        UPDATE client_portal_settings SET
          can_view_dashboard = COALESCE(?, can_view_dashboard),
          can_view_projects = COALESCE(?, can_view_projects),
          can_view_tasks = COALESCE(?, can_view_tasks),
          can_view_invoices = COALESCE(?, can_view_invoices),
          can_view_payment_proofs = COALESCE(?, can_view_payment_proofs),
          can_view_metrics = COALESCE(?, can_view_metrics),
          can_view_reports = COALESCE(?, can_view_reports),
          can_view_calls = COALESCE(?, can_view_calls),
          can_view_forms = COALESCE(?, can_view_forms),
          can_view_ugc = COALESCE(?, can_view_ugc),
          can_view_documents = COALESCE(?, can_view_documents),
          can_approve_tasks = COALESCE(?, can_approve_tasks),
          can_comment_tasks = COALESCE(?, can_comment_tasks),
          can_view_team = COALESCE(?, can_view_team),
          can_download_files = COALESCE(?, can_download_files),
          welcome_message = COALESCE(?, welcome_message),
          portal_revenue_metric = COALESCE(?, portal_revenue_metric),
          dashboard_template = COALESCE(?, dashboard_template),
          updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `, [
        toInt(can_view_dashboard), toInt(can_view_projects), toInt(can_view_tasks), toInt(can_view_invoices),
        toInt(can_view_payment_proofs), toInt(can_view_metrics), toInt(can_view_reports), toInt(can_view_calls),
        toInt(can_view_forms), toInt(can_view_ugc), toInt(can_view_documents),
        toInt(can_approve_tasks), toInt(can_comment_tasks), toInt(can_view_team), toInt(can_download_files),
        welcome_message, portal_revenue_metric || null, dashboard_template || null, id
      ]);
    } else {
      await db.run(`
        INSERT INTO client_portal_settings (
          client_id, can_view_dashboard, can_view_projects, can_view_tasks, can_view_invoices,
          can_view_payment_proofs, can_view_metrics, can_view_reports, can_view_calls,
          can_view_forms, can_view_ugc, can_view_documents,
          can_approve_tasks, can_comment_tasks, can_view_team, can_download_files,
          welcome_message, portal_revenue_metric, dashboard_template
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        toInt(can_view_dashboard) ?? 1, toInt(can_view_projects) ?? 1, toInt(can_view_tasks) ?? 1, toInt(can_view_invoices) ?? 1,
        toInt(can_view_payment_proofs) ?? 1, toInt(can_view_metrics) ?? 1, toInt(can_view_reports) ?? 1, toInt(can_view_calls) ?? 1,
        toInt(can_view_forms) ?? 1, toInt(can_view_ugc) ?? 0, toInt(can_view_documents) ?? 1,
        toInt(can_approve_tasks) ?? 1, toInt(can_comment_tasks) ?? 1, toInt(can_view_team) ?? 0, toInt(can_download_files) ?? 1,
        welcome_message ?? null, portal_revenue_metric || 'confirmed', dashboard_template || null
      ]);
    }

    const settings = await db.get('SELECT * FROM client_portal_settings WHERE client_id = ?', [id]);
    res.json(settings);
  } catch (error) {
    console.error('Error updating portal settings:', error);
    res.status(500).json({ error: 'Error al actualizar configuracion del portal' });
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
    const orgId = req.orgId;
    const { id } = req.params;
    const { created_by } = req.body || {};

    // Check client exists and belongs to org
    const client = await db.get('SELECT id, name FROM clients WHERE id = ? AND organization_id = ?', [id, orgId]);
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
      return res.status(500).json({ error: 'Error generando codigo unico' });
    }

    // Create invite token (permanent, no expiration)
    await db.run(`
      INSERT INTO client_access_tokens (client_id, token, token_type, status, expires_at, created_by)
      VALUES (?, ?, 'invite', 'active', NULL, ?)
    `, [id, inviteCode, created_by || null]);

    res.json({
      invite_code: inviteCode,
      client_name: client.name,
      portal_url: `/portal/login?code=${inviteCode}`
    });
  } catch (error) {
    console.error('Error generating invite:', error);
    res.status(500).json({ error: 'Error al generar invitacion' });
  }
});

/**
 * GET /api/portal-admin/clients/:id/access
 * List all access tokens for a client
 */
router.get('/clients/:id/access', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;

    // Verify client belongs to org
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [id, orgId]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

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
    const orgId = req.orgId;
    const { id, tokenId } = req.params;

    // Verify client belongs to org
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [id, orgId]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

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
    const orgId = req.orgId;
    const { id } = req.params;
    const { limit = 20 } = req.query;

    // Verify client belongs to org
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [id, orgId]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

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

// =========================================================================
// Client Priorities (admin manages what shows on client portal dashboard)
// =========================================================================

// GET /priorities/:clientId
router.get('/priorities/:clientId', async (req, res) => {
  try {
    const priorities = await db.all(
      'SELECT * FROM client_priorities WHERE client_id = ? AND organization_id = ? ORDER BY position, id',
      [req.params.clientId, req.orgId]
    );
    res.json(priorities);
  } catch (error) {
    console.error('Error getting priorities:', error);
    res.status(500).json({ error: 'Error al obtener prioridades' });
  }
});

// PUT /priorities/:clientId — Replace all priorities (bulk save)
router.put('/priorities/:clientId', async (req, res) => {
  try {
    const { items } = req.body; // [{ title, position }]
    const clientId = req.params.clientId;

    await db.run('DELETE FROM client_priorities WHERE client_id = ? AND organization_id = ?', [clientId, req.orgId]);

    for (const item of (items || [])) {
      if (item.title?.trim()) {
        await db.run(
          'INSERT INTO client_priorities (client_id, title, position, organization_id) VALUES (?, ?, ?, ?)',
          [clientId, item.title.trim(), item.position || 0, req.orgId]
        );
      }
    }

    const priorities = await db.all(
      'SELECT * FROM client_priorities WHERE client_id = ? AND organization_id = ? ORDER BY position, id',
      [clientId, req.orgId]
    );
    res.json(priorities);
  } catch (error) {
    console.error('Error saving priorities:', error);
    res.status(500).json({ error: 'Error al guardar prioridades' });
  }
});

// =========================================================================
// Client Commercial Dates (org-level, multi-client assignment)
// =========================================================================

// GET /commercial-dates — list all commercial dates for the org, grouped with client info
router.get('/commercial-dates', async (req, res) => {
  try {
    const dates = await db.all(`
      SELECT ccd.id, ccd.client_id, ccd.title, ccd.date::text as date,
             ccd.will_participate, ccd.has_offer, ccd.offer_description, ccd.client_notes, ccd.client_response_at,
             c.nickname, c.company, c.name as client_name
      FROM client_commercial_dates ccd
      JOIN clients c ON ccd.client_id = c.id
      WHERE ccd.organization_id = ?
      ORDER BY ccd.date, ccd.title
    `, [req.orgId]);

    // Group by title+date
    const grouped = {};
    for (const d of dates) {
      const key = `${d.title}|||${d.date}`;
      if (!grouped[key]) {
        grouped[key] = { title: d.title, date: d.date, clients: [] };
      }
      grouped[key].clients.push({
        id: d.id,
        client_id: d.client_id,
        nickname: d.nickname,
        company: d.company,
        client_name: d.client_name,
        will_participate: d.will_participate,
        has_offer: d.has_offer,
        offer_description: d.offer_description,
        client_notes: d.client_notes,
        client_response_at: d.client_response_at
      });
    }

    res.json(Object.values(grouped));
  } catch (error) {
    console.error('Error getting commercial dates:', error);
    res.status(500).json({ error: 'Error al obtener fechas comerciales' });
  }
});

// POST /commercial-dates — create for multiple clients
router.post('/commercial-dates', async (req, res) => {
  try {
    const { title, date, client_ids } = req.body;

    if (!title?.trim() || !date || !client_ids?.length) {
      return res.status(400).json({ error: 'Título, fecha y al menos un cliente son requeridos' });
    }

    const trimmedTitle = title.trim();
    let created = 0;

    for (const clientId of client_ids) {
      // Check for existing duplicate
      const existing = await db.get(
        'SELECT id FROM client_commercial_dates WHERE client_id = $1 AND title = $2 AND date = $3::date AND organization_id = $4',
        [clientId, trimmedTitle, date, req.orgId]
      );
      if (existing) continue;

      await db.query(
        'INSERT INTO client_commercial_dates (client_id, title, date, organization_id) VALUES ($1, $2, $3, $4)',
        [clientId, trimmedTitle, date, req.orgId]
      );
      created++;
    }

    res.status(201).json({ message: `Fecha creada para ${created} cliente(s)` });
  } catch (error) {
    console.error('Error creating commercial dates:', error);
    res.status(500).json({ error: 'Error al crear fecha comercial: ' + error.message });
  }
});

// PUT /commercial-dates/group — update a commercial date group (title, date, client assignments)
router.put('/commercial-dates/group', async (req, res) => {
  try {
    const { original_title, original_date, title, date, client_ids } = req.body;
    if (!original_title || !original_date || !title?.trim() || !date || !client_ids) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const trimmedTitle = title.trim();

    // Delete all old entries for this group
    await db.query(
      'DELETE FROM client_commercial_dates WHERE title = $1 AND date = $2::date AND organization_id = $3',
      [original_title, original_date, req.orgId]
    );

    // Insert new entries
    let created = 0;
    for (const clientId of client_ids) {
      try {
        await db.query(
          'INSERT INTO client_commercial_dates (client_id, title, date, organization_id) VALUES ($1, $2, $3, $4)',
          [clientId, trimmedTitle, date, req.orgId]
        );
        created++;
      } catch (e) {
        // skip duplicates
      }
    }

    res.json({ message: `Fecha actualizada para ${created} cliente(s)` });
  } catch (error) {
    console.error('Error updating commercial dates:', error);
    res.status(500).json({ error: 'Error al actualizar fecha comercial' });
  }
});

// DELETE /commercial-dates/group — delete a date group (all clients with same title+date)
router.delete('/commercial-dates/group', async (req, res) => {
  try {
    const { title, date } = req.query;
    if (!title || !date) return res.status(400).json({ error: 'Título y fecha son requeridos' });

    await db.run(
      'DELETE FROM client_commercial_dates WHERE title = ? AND date = ? AND organization_id = ?',
      [title, date, req.orgId]
    );
    res.json({ message: 'Eliminado' });
  } catch (error) {
    console.error('Error deleting commercial dates:', error);
    res.status(500).json({ error: 'Error al eliminar fecha' });
  }
});

// GET /commercial-dates/:clientId — per-client dates (used by portal dashboard)
router.get('/commercial-dates/:clientId', async (req, res) => {
  try {
    const dates = await db.all(
      'SELECT * FROM client_commercial_dates WHERE client_id = ? AND organization_id = ? ORDER BY date',
      [req.params.clientId, req.orgId]
    );
    res.json(dates);
  } catch (error) {
    console.error('Error getting commercial dates:', error);
    res.status(500).json({ error: 'Error al obtener fechas comerciales' });
  }
});

// =========================================================================
// Dashboard Templates
// =========================================================================

/**
 * GET /api/portal-admin/dashboard-templates
 * List all dashboard templates for the organization
 */
router.get('/dashboard-templates', async (req, res) => {
  try {
    const templates = await db.all(
      'SELECT * FROM dashboard_templates WHERE organization_id = ? ORDER BY is_default DESC, name',
      [req.orgId]
    );
    res.json(templates);
  } catch (error) {
    console.error('Error listing dashboard templates:', error);
    res.status(500).json({ error: 'Error al obtener plantillas de dashboard' });
  }
});

/**
 * GET /api/portal-admin/dashboard-templates/:id
 * Get a specific dashboard template
 */
router.get('/dashboard-templates/:id', async (req, res) => {
  try {
    const template = await db.get(
      'SELECT * FROM dashboard_templates WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error getting dashboard template:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

/**
 * POST /api/portal-admin/dashboard-templates
 * Create a new dashboard template
 */
router.post('/dashboard-templates', async (req, res) => {
  try {
    const { name, slug, description, icon, settings, is_default } = req.body;

    if (!name || !slug || !settings) {
      return res.status(400).json({ error: 'Nombre, slug y settings son requeridos' });
    }

    const result = await db.run(`
      INSERT INTO dashboard_templates (name, slug, description, icon, settings, is_default, organization_id)
      VALUES (?, ?, ?, ?, ?::jsonb, ?, ?)
    `, [name, slug, description || null, icon || '📊', JSON.stringify(settings), is_default || false, req.orgId]);

    const template = await db.get('SELECT * FROM dashboard_templates WHERE id = ?', [result.lastID]);
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating dashboard template:', error);
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ya existe una plantilla con ese slug' });
    }
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

/**
 * PUT /api/portal-admin/dashboard-templates/:id
 * Update a dashboard template
 */
router.put('/dashboard-templates/:id', async (req, res) => {
  try {
    const { name, slug, description, icon, settings, is_default } = req.body;

    const template = await db.get(
      'SELECT * FROM dashboard_templates WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    await db.run(`
      UPDATE dashboard_templates SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        settings = COALESCE(?::jsonb, settings),
        is_default = COALESCE(?, is_default),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [
      name, slug, description, icon,
      settings ? JSON.stringify(settings) : null,
      is_default, req.params.id, req.orgId
    ]);

    const updated = await db.get('SELECT * FROM dashboard_templates WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating dashboard template:', error);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  }
});

/**
 * DELETE /api/portal-admin/dashboard-templates/:id
 * Delete a dashboard template
 */
router.delete('/dashboard-templates/:id', async (req, res) => {
  try {
    const template = await db.get(
      'SELECT * FROM dashboard_templates WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    await db.run('DELETE FROM dashboard_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Plantilla eliminada' });
  } catch (error) {
    console.error('Error deleting dashboard template:', error);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

/**
 * POST /api/portal-admin/clients/:id/apply-template
 * Apply a dashboard template to a client (updates all portal settings at once)
 */
router.post('/clients/:id/apply-template', async (req, res) => {
  try {
    const { template_slug } = req.body;
    const clientId = req.params.id;

    // Verify client belongs to org
    const client = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [clientId, req.orgId]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Get template
    const template = await db.get(
      'SELECT * FROM dashboard_templates WHERE slug = ? AND organization_id = ?',
      [template_slug, req.orgId]
    );
    if (!template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const settings = typeof template.settings === 'string' ? JSON.parse(template.settings) : template.settings;

    // Convert booleans to integers
    const toInt = (val) => val ? 1 : 0;

    // Check if settings exist
    const existing = await db.get('SELECT id FROM client_portal_settings WHERE client_id = ?', [clientId]);

    if (existing) {
      await db.run(`
        UPDATE client_portal_settings SET
          can_view_dashboard = ?,
          can_view_projects = ?,
          can_view_tasks = ?,
          can_view_invoices = ?,
          can_view_payment_proofs = ?,
          can_view_metrics = ?,
          can_view_reports = ?,
          can_view_calls = ?,
          can_view_forms = ?,
          can_view_ugc = ?,
          can_view_documents = ?,
          dashboard_template = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `, [
        toInt(settings.can_view_dashboard),
        toInt(settings.can_view_projects),
        toInt(settings.can_view_tasks ?? settings.can_view_projects),
        toInt(settings.can_view_invoices),
        toInt(settings.can_view_payment_proofs ?? settings.can_view_invoices),
        toInt(settings.can_view_metrics),
        toInt(settings.can_view_reports),
        toInt(settings.can_view_calls),
        toInt(settings.can_view_forms),
        toInt(settings.can_view_ugc),
        toInt(settings.can_view_documents),
        template_slug,
        clientId
      ]);
    } else {
      await db.run(`
        INSERT INTO client_portal_settings (
          client_id, can_view_dashboard, can_view_projects, can_view_tasks, can_view_invoices,
          can_view_payment_proofs, can_view_metrics, can_view_reports, can_view_calls,
          can_view_forms, can_view_ugc, can_view_documents, dashboard_template
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        clientId,
        toInt(settings.can_view_dashboard),
        toInt(settings.can_view_projects),
        toInt(settings.can_view_tasks ?? settings.can_view_projects),
        toInt(settings.can_view_invoices),
        toInt(settings.can_view_payment_proofs ?? settings.can_view_invoices),
        toInt(settings.can_view_metrics),
        toInt(settings.can_view_reports),
        toInt(settings.can_view_calls),
        toInt(settings.can_view_forms),
        toInt(settings.can_view_ugc),
        toInt(settings.can_view_documents),
        template_slug
      ]);
    }

    const updatedSettings = await db.get('SELECT * FROM client_portal_settings WHERE client_id = ?', [clientId]);
    res.json({
      success: true,
      message: `Plantilla "${template.name}" aplicada exitosamente`,
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: 'Error al aplicar plantilla' });
  }
});

export { generateSessionToken };
export default router;
