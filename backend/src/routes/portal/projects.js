import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/projects
 * Get all projects for the client
 */
router.get('/', clientAuthMiddleware, requirePortalPermission('can_view_projects'), async (req, res) => {
  try {
    const clientId = req.client.id;

    const projects = await db.all(`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND visible_to_client = 1) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND visible_to_client = 1 AND status = 'done') as completed_task_count
      FROM projects p
      WHERE p.client_id = ?
      ORDER BY p.created_at DESC
    `, [clientId]);

    // Calculate progress for each project
    const projectsWithProgress = projects.map(p => ({
      ...p,
      progress: p.task_count > 0 ? Math.round((p.completed_task_count / p.task_count) * 100) : 0
    }));

    res.json({ projects: projectsWithProgress });
  } catch (error) {
    console.error('Error getting portal projects:', error);
    res.status(500).json({ error: 'Error al cargar proyectos' });
  }
});

/**
 * GET /api/portal/projects/:id
 * Get project details
 */
router.get('/:id', clientAuthMiddleware, requirePortalPermission('can_view_projects'), async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.client.id;

    // Get project (verify ownership)
    const project = await db.get(`
      SELECT * FROM projects WHERE id = ? AND client_id = ?
    `, [id, clientId]);

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Get tasks for this project
    const tasks = await db.all(`
      SELECT
        t.*,
        tm.name as assigned_to_name
      FROM tasks t
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE t.project_id = ?
        AND t.visible_to_client = 1
      ORDER BY t.created_at DESC
    `, [id]);

    // Get team members if allowed
    let team = [];
    if (req.client.permissions.can_view_team) {
      team = await db.all(`
        SELECT tm.id, tm.name, tm.position, pt.role
        FROM project_team pt
        JOIN team_members tm ON pt.team_member_id = tm.id
        WHERE pt.project_id = ?
      `, [id]);
    }

    res.json({
      project: {
        ...project,
        progress: tasks.length > 0
          ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
          : 0
      },
      tasks,
      team
    });
  } catch (error) {
    console.error('Error getting portal project:', error);
    res.status(500).json({ error: 'Error al cargar proyecto' });
  }
});

export default router;
