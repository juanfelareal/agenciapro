import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

// GET /api/portal/structured-briefs — list structured briefs visible to this client
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const briefs = await db.all(`
      SELECT
        sb.id,
        sb.title,
        sb.month,
        sb.visible_to_client,
        sb.generated_project_id,
        sb.created_at,
        sb.updated_at,
        c.company as client_company,
        c.name as client_name,
        c.nickname as client_nickname,
        p.name as project_name
      FROM structured_briefs sb
      LEFT JOIN clients c ON sb.client_id = c.id
      LEFT JOIN projects p ON sb.generated_project_id = p.id
      WHERE sb.client_id = ?
        AND sb.visible_to_client = true
      ORDER BY sb.month DESC NULLS LAST, sb.created_at DESC
    `, [clientId]);

    // For each brief, get sections count
    for (const brief of briefs) {
      const sectionsCount = await db.get(`
        SELECT COUNT(*) as count FROM brief_sections WHERE brief_id = ?
      `, [brief.id]);
      brief.sections_count = sectionsCount?.count || 0;
    }

    res.json({ briefs });
  } catch (error) {
    console.error('Error listing portal structured briefs:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/portal/structured-briefs/:id — get full structured brief with sections and tasks
router.get('/:id', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const briefId = req.params.id;

    const brief = await db.get(`
      SELECT
        sb.*,
        c.company as client_company,
        c.name as client_name,
        c.nickname as client_nickname,
        p.name as project_name
      FROM structured_briefs sb
      LEFT JOIN clients c ON sb.client_id = c.id
      LEFT JOIN projects p ON sb.generated_project_id = p.id
      WHERE sb.id = ?
        AND sb.client_id = ?
        AND sb.visible_to_client = true
    `, [briefId, clientId]);

    if (!brief) {
      return res.status(404).json({ error: 'Brief not found or not visible' });
    }

    // Get sections with responsible info
    const sections = await db.all(`
      SELECT
        bs.*,
        tm.name as responsible_name,
        tm.avatar_url as responsible_avatar
      FROM brief_sections bs
      LEFT JOIN team_members tm ON bs.responsible_id = tm.id
      WHERE bs.brief_id = ?
      ORDER BY bs.order_index, bs.id
    `, [briefId]);

    // Get tasks for each section with generated task status
    for (const section of sections) {
      const tasks = await db.all(`
        SELECT
          bst.*,
          t.status as task_status,
          t.title as generated_task_title
        FROM brief_section_tasks bst
        LEFT JOIN tasks t ON bst.generated_task_id = t.id
        WHERE bst.section_id = ?
        ORDER BY bst.id
      `, [section.id]);
      section.tasks = tasks;
    }

    brief.sections = sections;

    res.json({ brief });
  } catch (error) {
    console.error('Error getting portal structured brief:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
