import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

// GET /api/portal/ugc/creators - List creators assigned to this client
router.get('/creators', clientAuthMiddleware, async (req, res) => {
  try {
    // Check permission
    if (!req.client.permissions?.can_view_ugc) {
      return res.status(403).json({ error: 'No tienes permiso para ver creadores UGC' });
    }

    // Get creators from both ugc_assignments AND ugc_project_creators
    const creators = await db.all(
      `SELECT DISTINCT c.id, c.full_name, c.profile_photo_url, c.bio, c.social_networks, c.industries
       FROM ugc_creators c
       WHERE c.id IN (
         -- Creators from direct assignments
         SELECT a.creator_id FROM ugc_assignments a
         WHERE a.client_id = ? AND a.status NOT IN ('cancelled', 'proposed')
         UNION
         -- Creators from UGC projects
         SELECT pc.creator_id FROM ugc_project_creators pc
         INNER JOIN ugc_projects p ON pc.project_id = p.id
         WHERE p.client_id = ? AND pc.status NOT IN ('rejected')
       )
       ORDER BY c.full_name`,
      [req.client.id, req.client.id]
    );

    res.json(creators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/portal/ugc/creators/:id - Get creator detail (only if assigned to this client)
router.get('/creators/:id', clientAuthMiddleware, async (req, res) => {
  try {
    if (!req.client.permissions?.can_view_ugc) {
      return res.status(403).json({ error: 'No tienes permiso para ver creadores UGC' });
    }

    // Check if creator is assigned to this client
    const hasAssignment = await db.get(
      `SELECT 1 FROM ugc_assignments
       WHERE creator_id = ? AND client_id = ? AND status NOT IN ('cancelled', 'proposed')`,
      [req.params.id, req.client.id]
    );

    if (!hasAssignment) {
      return res.status(404).json({ error: 'Creador no encontrado' });
    }

    // Get creator (limited info - no cedula, address, financial data)
    const creator = await db.get(
      `SELECT id, full_name, profile_photo_url, bio, social_networks, industries
       FROM ugc_creators WHERE id = ?`,
      [req.params.id]
    );

    // Get assignments for this client only
    const assignments = await db.all(
      `SELECT id, title, description, deliverables, start_date, end_date, status, delivery_url, delivered_at
       FROM ugc_assignments
       WHERE creator_id = ? AND client_id = ? AND status NOT IN ('cancelled', 'proposed')
       ORDER BY created_at DESC`,
      [req.params.id, req.client.id]
    );

    res.json({
      ...creator,
      assignments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/portal/ugc/assignments - List assignments for this client
router.get('/assignments', clientAuthMiddleware, async (req, res) => {
  try {
    if (!req.client.permissions?.can_view_ugc) {
      return res.status(403).json({ error: 'No tienes permiso para ver creadores UGC' });
    }

    const { status } = req.query;

    // Get direct assignments
    let directQuery = `
      SELECT a.id, a.title, a.description, a.deliverables, a.start_date, a.end_date,
             a.status, a.delivery_url, a.delivered_at, a.created_at,
             c.id as creator_id, c.full_name as creator_name, c.profile_photo_url as creator_photo,
             'assignment' as source_type, NULL as project_title
      FROM ugc_assignments a
      LEFT JOIN ugc_creators c ON a.creator_id = c.id
      WHERE a.client_id = ? AND a.status NOT IN ('cancelled', 'proposed')
    `;
    const directParams = [req.client.id];

    if (status) {
      directQuery += ' AND a.status = ?';
      directParams.push(status);
    }

    // Get project creator assignments
    let projectQuery = `
      SELECT pc.id, p.title as title, p.description, pc.deliverables, p.start_date, p.deadline as end_date,
             pc.status, pc.delivery_url, pc.delivered_at, pc.created_at,
             c.id as creator_id, c.full_name as creator_name, c.profile_photo_url as creator_photo,
             'project' as source_type, p.title as project_title
      FROM ugc_project_creators pc
      INNER JOIN ugc_projects p ON pc.project_id = p.id
      LEFT JOIN ugc_creators c ON pc.creator_id = c.id
      WHERE p.client_id = ? AND pc.status NOT IN ('rejected')
    `;
    const projectParams = [req.client.id];

    if (status) {
      // Map assignment statuses to project creator statuses
      const statusMap = {
        'accepted': ['confirmed', 'contract_signed'],
        'in_production': ['producing'],
        'delivered': ['delivered_approved', 'delivered_changes'],
        'paid': ['paid']
      };
      const mappedStatuses = statusMap[status] || [status];
      projectQuery += ` AND pc.status IN (${mappedStatuses.map(() => '?').join(',')})`;
      projectParams.push(...mappedStatuses);
    }

    // Combine both queries
    const directAssignments = await db.all(directQuery, directParams);
    const projectAssignments = await db.all(projectQuery, projectParams);

    // Merge and sort by created_at DESC
    const allAssignments = [...directAssignments, ...projectAssignments]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(allAssignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/portal/ugc/assignments/:id - Get assignment detail
router.get('/assignments/:id', clientAuthMiddleware, async (req, res) => {
  try {
    if (!req.client.permissions?.can_view_ugc) {
      return res.status(403).json({ error: 'No tienes permiso para ver creadores UGC' });
    }

    const assignment = await db.get(
      `SELECT a.id, a.title, a.description, a.deliverables, a.start_date, a.end_date,
              a.status, a.delivery_url, a.delivered_at, a.created_at,
              c.id as creator_id, c.full_name as creator_name, c.profile_photo_url as creator_photo,
              c.bio as creator_bio, c.social_networks as creator_social
       FROM ugc_assignments a
       LEFT JOIN ugc_creators c ON a.creator_id = c.id
       WHERE a.id = ? AND a.client_id = ? AND a.status NOT IN ('cancelled', 'proposed')`,
      [req.params.id, req.client.id]
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
