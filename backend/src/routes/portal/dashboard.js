import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/dashboard
 * Get portal dashboard summary for client
 */
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;

    // Get projects summary
    const projectsSummary = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM projects
      WHERE client_id = ?
    `, [clientId]);

    // Get tasks summary (from client's projects)
    const tasksSummary = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.requires_client_approval = 1 AND t.client_approval_status = 'pending' THEN 1 ELSE 0 END) as pending_approval
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ?
        AND t.visible_to_client = 1
    `, [clientId]);

    // Get invoices summary
    const invoicesSummary = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status IN ('draft', 'approved', 'invoiced') THEN amount ELSE 0 END) as pending_amount
      FROM invoices
      WHERE client_id = ?
    `, [clientId]);

    // Get recent activity
    const recentTasks = await db.all(`
      SELECT t.id, t.title, t.status, t.updated_at, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ?
        AND t.visible_to_client = 1
      ORDER BY t.updated_at DESC
      LIMIT 5
    `, [clientId]);

    // Get tasks pending approval
    const pendingApproval = await db.all(`
      SELECT t.id, t.title, t.status, t.updated_at, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.client_id = ?
        AND t.visible_to_client = 1
        AND t.requires_client_approval = 1
        AND (t.client_approval_status IS NULL OR t.client_approval_status = 'pending')
      ORDER BY t.updated_at DESC
      LIMIT 10
    `, [clientId]);

    // Get unread notifications count
    const unreadNotifications = await db.get(`
      SELECT COUNT(*) as count
      FROM client_notifications
      WHERE client_id = ? AND is_read = 0
    `, [clientId]);

    res.json({
      projects: {
        total: projectsSummary.total || 0,
        in_progress: projectsSummary.in_progress || 0,
        completed: projectsSummary.completed || 0
      },
      tasks: {
        total: tasksSummary.total || 0,
        completed: tasksSummary.completed || 0,
        pending_approval: tasksSummary.pending_approval || 0
      },
      invoices: {
        total: invoicesSummary.total || 0,
        paid_amount: invoicesSummary.paid_amount || 0,
        pending_amount: invoicesSummary.pending_amount || 0
      },
      recent_tasks: recentTasks,
      pending_approval: pendingApproval,
      unread_notifications: unreadNotifications?.count || 0
    });
  } catch (error) {
    console.error('Error getting portal dashboard:', error);
    res.status(500).json({ error: 'Error al cargar el dashboard' });
  }
});

export default router;
