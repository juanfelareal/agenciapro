import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/dashboard
 * Get portal dashboard summary for client (CEO Dashboard)
 */
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;

    // Helper to safely run queries — if one fails, return default instead of crashing
    const safeQuery = async (fn, defaultVal) => {
      try { return await fn(); } catch (e) { console.error('Dashboard query error:', e.message); return defaultVal; }
    };

    // Aggregate project state from task progress (a project is "completado"
    // only when it has tasks AND all of them are done; everything else,
    // including projects with no tasks yet, counts as "en curso").
    const allProjectsRaw = await safeQuery(() => db.all(`
      SELECT p.id, p.name, p.end_date, p.updated_at,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND visible_to_client = 1) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND visible_to_client = 1 AND status = 'done') as completed_count
      FROM projects p
      WHERE p.client_id = ?
      ORDER BY p.updated_at DESC
    `, [clientId]), []);

    const allProjects = allProjectsRaw.map((p) => {
      const taskCount = parseInt(p.task_count) || 0;
      const completedCount = parseInt(p.completed_count) || 0;
      return {
        ...p,
        task_count: taskCount,
        completed_count: completedCount,
        progress: taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0,
        is_completed: taskCount > 0 && completedCount === taskCount,
      };
    });

    const projectsCompleted = allProjects.filter((p) => p.is_completed).length;
    const projectsActive = allProjects.length - projectsCompleted;
    const projectsSummary = {
      total: allProjects.length,
      in_progress: projectsActive,
      completed: projectsCompleted,
    };

    const tasksSummary = await safeQuery(() => db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.requires_client_approval = 1 AND (t.client_approval_status IS NULL OR t.client_approval_status = 'pending') THEN 1 ELSE 0 END) as pending_approval
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ?
        AND t.visible_to_client = 1
    `, [clientId]), { total: 0, completed: 0, pending_approval: 0 });

    const invoicesSummary = await safeQuery(() => db.get(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status IN ('draft', 'approved', 'invoiced') THEN amount ELSE 0 END), 0) as pending_amount,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status IN ('approved', 'invoiced') THEN 1 ELSE 0 END) as pending_count
      FROM invoices
      WHERE client_id = ?
    `, [clientId]), { total: 0, paid_amount: 0, pending_amount: 0, paid_count: 0, pending_count: 0 });

    // Show active (not all-tasks-done) projects in the dashboard summary card
    const projectDetails = allProjects.filter((p) => !p.is_completed).slice(0, 6);

    const tasksByStatus = await safeQuery(() => db.all(`
      SELECT t.status, COUNT(*) as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ? AND t.visible_to_client = 1
      GROUP BY t.status
    `, [clientId]), []);

    // Tareas no completadas con fecha de entrega — incluye atrasadas para
    // que el cliente las vea (el frontend marca las vencidas como 'Atrasada').
    // Orden: futuras primero por proximidad, luego atrasadas más recientes.
    const upcomingDeadlines = await safeQuery(() => db.all(`
      SELECT t.id, t.title, t.due_date::text as due_date, t.status, p.name as project_name, tm.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE p.client_id = ? AND t.visible_to_client = 1
        AND t.due_date IS NOT NULL
        AND t.status != 'done'
      ORDER BY
        CASE WHEN t.due_date::date >= CURRENT_DATE THEN 0 ELSE 1 END,
        CASE WHEN t.due_date::date >= CURRENT_DATE THEN t.due_date::date END ASC NULLS LAST,
        t.due_date::date DESC
      LIMIT 12
    `, [clientId]), []);

    const recentTasks = await safeQuery(() => db.all(`
      SELECT t.id, t.title, t.status, t.updated_at, t.client_approval_status, p.name as project_name, tm.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE p.client_id = ?
        AND t.visible_to_client = 1
      ORDER BY t.updated_at DESC
      LIMIT 10
    `, [clientId]), []);

    const pendingApproval = await safeQuery(() => db.all(`
      SELECT t.id, t.title, t.status, t.updated_at, p.name as project_name, tm.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE p.client_id = ?
        AND t.visible_to_client = 1
        AND t.requires_client_approval = 1
        AND (t.client_approval_status IS NULL OR t.client_approval_status = 'pending')
      ORDER BY t.updated_at DESC
      LIMIT 10
    `, [clientId]), []);

    const unreadNotifications = await safeQuery(() => db.get(`
      SELECT COUNT(*) as count
      FROM client_notifications
      WHERE client_id = ? AND is_read = 0
    `, [clientId]), { count: 0 });

    const priorities = await safeQuery(() => db.all(`
      SELECT t.id, t.title, t.due_date::text as due_date, t.status, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ? AND t.visible_to_client = 1
        AND t.status != 'done'
      ORDER BY
        CASE WHEN t.due_date IS NOT NULL AND t.due_date >= CURRENT_DATE THEN 0 ELSE 1 END,
        t.due_date ASC NULLS LAST,
        t.updated_at DESC
      LIMIT 8
    `, [clientId]), []);

    const clientNotes = await safeQuery(() => db.all(`
      SELECT n.id, n.title, n.content, n.content_plain, n.color, n.updated_at,
        nc.name as category_name, nc.color as category_color
      FROM notes n
      INNER JOIN note_links nl ON n.id = nl.note_id
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      WHERE nl.client_id = ? AND nl.visible_in_portal = 1
      ORDER BY n.is_pinned DESC, n.updated_at DESC
    `, [clientId]), []);

    const commercialDates = await safeQuery(() => db.all(`
      SELECT id, title, date::text as date, will_participate, has_offer, offer_description, client_notes, client_response_at
      FROM client_commercial_dates
      WHERE client_id = ? AND date >= CURRENT_DATE
      ORDER BY date ASC
    `, [clientId]), []);

    const assignedForms = await safeQuery(() => db.all(`
      SELECT fa.id, fa.status, fa.share_token, fa.created_at,
        f.title as form_title, f.description as form_description
      FROM form_assignments fa
      JOIN forms f ON fa.form_id = f.id
      WHERE fa.client_id = ? AND f.status = 'published'
      ORDER BY fa.created_at DESC
    `, [clientId]), []);

    const clientBriefs = await safeQuery(() => db.all(`
      SELECT id, title, html_content, updated_at
      FROM briefs
      WHERE client_id = ? AND visible_to_client != 0
      ORDER BY updated_at DESC
    `, [clientId]), []);

    // Calculate health score
    const totalTasks = parseInt(tasksSummary.total) || 0;
    const completedTasks = parseInt(tasksSummary.completed) || 0;
    const healthScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      projects: {
        total: parseInt(projectsSummary.total) || 0,
        in_progress: parseInt(projectsSummary.in_progress) || 0,
        completed: parseInt(projectsSummary.completed) || 0
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending_approval: parseInt(tasksSummary.pending_approval) || 0
      },
      invoices: {
        total: parseInt(invoicesSummary.total) || 0,
        paid_amount: parseFloat(invoicesSummary.paid_amount) || 0,
        pending_amount: parseFloat(invoicesSummary.pending_amount) || 0,
        paid_count: parseInt(invoicesSummary.paid_count) || 0,
        pending_count: parseInt(invoicesSummary.pending_count) || 0
      },
      project_details: projectDetails,
      tasks_by_status: tasksByStatus,
      upcoming_deadlines: upcomingDeadlines,
      health_score: healthScore,
      recent_tasks: recentTasks,
      pending_approval: pendingApproval,
      unread_notifications: parseInt(unreadNotifications?.count) || 0,
      priorities,
      client_notes: clientNotes,
      commercial_dates: commercialDates,
      assigned_forms: assignedForms,
      client_briefs: clientBriefs
    });
  } catch (error) {
    console.error('Error getting portal dashboard:', error);
    res.status(500).json({ error: 'Error al cargar el dashboard' });
  }
});

/**
 * PUT /api/portal/dashboard/commercial-dates/:id
 * Client responds to a commercial date (participate, offer)
 */
router.put('/commercial-dates/:id', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { id } = req.params;
    const { will_participate, has_offer, offer_description, client_notes } = req.body;

    // Verify the date belongs to this client
    const cd = await db.get('SELECT id FROM client_commercial_dates WHERE id = ? AND client_id = ?', [id, clientId]);
    if (!cd) {
      return res.status(404).json({ error: 'Fecha no encontrada' });
    }

    await db.run(`
      UPDATE client_commercial_dates
      SET will_participate = ?, has_offer = ?, offer_description = ?, client_notes = ?, client_response_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [will_participate, has_offer ? true : false, has_offer ? (offer_description || null) : null, client_notes || null, id]);

    const updated = await db.get('SELECT id, will_participate, has_offer, offer_description, client_notes, client_response_at FROM client_commercial_dates WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating commercial date response:', error);
    res.status(500).json({ error: 'Error al guardar respuesta' });
  }
});

export default router;
