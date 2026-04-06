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

    const projectsSummary = await safeQuery(() => db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM projects
      WHERE client_id = ?
    `, [clientId]), { total: 0, in_progress: 0, completed: 0 });

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

    const projectDetails = await safeQuery(() => db.all(`
      SELECT p.id, p.name, p.status, p.due_date,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND visible_to_client = 1) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND visible_to_client = 1 AND status = 'done') as completed_count
      FROM projects p
      WHERE p.client_id = ? AND p.status != 'completed'
      ORDER BY p.updated_at DESC
      LIMIT 5
    `, [clientId]), []);

    const tasksByStatus = await safeQuery(() => db.all(`
      SELECT t.status, COUNT(*) as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ? AND t.visible_to_client = 1
      GROUP BY t.status
    `, [clientId]), []);

    const upcomingDeadlines = await safeQuery(() => db.all(`
      SELECT t.id, t.title, t.due_date, t.status, p.name as project_name, tm.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE p.client_id = ? AND t.visible_to_client = 1
        AND t.due_date IS NOT NULL AND t.due_date >= CURRENT_DATE
        AND t.due_date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY t.due_date ASC
      LIMIT 8
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
      SELECT t.id, t.title, t.due_date, t.status, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ? AND t.visible_to_client = 1
        AND t.status != 'done'
        AND t.due_date IS NOT NULL AND t.due_date >= CURRENT_DATE
      ORDER BY t.due_date ASC
      LIMIT 5
    `, [clientId]), []);

    const commercialDates = await safeQuery(() => db.all(`
      SELECT id, title, date::text as date FROM client_commercial_dates
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
      project_details: projectDetails.map(p => ({
        ...p,
        task_count: parseInt(p.task_count) || 0,
        completed_count: parseInt(p.completed_count) || 0,
        progress: parseInt(p.task_count) > 0 ? Math.round((parseInt(p.completed_count) / parseInt(p.task_count)) * 100) : 0
      })),
      tasks_by_status: tasksByStatus,
      upcoming_deadlines: upcomingDeadlines,
      health_score: healthScore,
      recent_tasks: recentTasks,
      pending_approval: pendingApproval,
      unread_notifications: parseInt(unreadNotifications?.count) || 0,
      priorities,
      commercial_dates: commercialDates,
      assigned_forms: assignedForms
    });
  } catch (error) {
    console.error('Error getting portal dashboard:', error);
    res.status(500).json({ error: 'Error al cargar el dashboard' });
  }
});

export default router;
