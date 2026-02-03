import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Productivity Report
// Tasks completed per user, by status, completion rates
router.get('/productivity', async (req, res) => {
  try {
    const { start_date, end_date, project_id, user_id } = req.query;
    const orgId = req.orgId;

    // Build date filter
    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND t.created_at::DATE >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND t.created_at::DATE <= ?';
      params.push(end_date);
    }

    // Tasks by status
    const tasksByStatus = await db.prepare(`
      SELECT t.status, COUNT(*) as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = ? ${dateFilter}
      ${project_id ? ' AND t.project_id = ?' : ''}
      ${user_id ? ' AND t.assigned_to = ?' : ''}
      GROUP BY t.status
    `).all(orgId, ...params, ...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

    // Tasks completed per user
    const tasksPerUser = await db.prepare(`
      SELECT tm.id, tm.name,
             COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed,
             COUNT(*) as total
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE tm.status = 'active' AND tm.organization_id = ?
      ${dateFilter.replace(/t\./g, 't.')}
      ${project_id ? ' AND t.project_id = ?' : ''}
      GROUP BY tm.id, tm.name
      ORDER BY completed DESC
    `).all(orgId, ...params, ...(project_id ? [project_id] : []));

    // On-time vs overdue completion
    const completionStats = await db.prepare(`
      SELECT
        COUNT(CASE WHEN t.status = 'done' AND (t.due_date IS NULL OR t.updated_at::DATE <= t.due_date::DATE) THEN 1 END) as on_time,
        COUNT(CASE WHEN t.status = 'done' AND t.due_date IS NOT NULL AND t.updated_at::DATE > t.due_date::DATE THEN 1 END) as late,
        COUNT(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date::DATE < CURRENT_DATE THEN 1 END) as overdue
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = ? ${dateFilter}
      ${project_id ? ' AND t.project_id = ?' : ''}
      ${user_id ? ' AND t.assigned_to = ?' : ''}
    `).get(orgId, ...params, ...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

    // Tasks by priority
    const tasksByPriority = await db.prepare(`
      SELECT t.priority, COUNT(*) as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = ? ${dateFilter}
      ${project_id ? ' AND t.project_id = ?' : ''}
      ${user_id ? ' AND t.assigned_to = ?' : ''}
      GROUP BY t.priority
    `).all(orgId, ...params, ...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

    // Weekly trend (tasks completed in the last 8 weeks)
    const weeklyTrend = await db.prepare(`
      SELECT
        TO_CHAR(t.updated_at, 'IYYY-IW') as week,
        COUNT(*) as completed
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.status = 'done'
      AND t.updated_at::DATE >= CURRENT_DATE - INTERVAL '8 weeks'
      AND p.organization_id = ?
      ${project_id ? ' AND t.project_id = ?' : ''}
      ${user_id ? ' AND t.assigned_to = ?' : ''}
      GROUP BY week
      ORDER BY week
    `).all(orgId, ...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

    res.json({
      tasksByStatus,
      tasksPerUser,
      completionStats,
      tasksByPriority,
      weeklyTrend,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Financial Report
// Revenue, invoices, expenses summary
router.get('/financial', async (req, res) => {
  try {
    const { start_date, end_date, client_id } = req.query;
    const orgId = req.orgId;

    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND created_at::DATE >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND created_at::DATE <= ?';
      params.push(end_date);
    }

    // Revenue by client
    const revenueByClient = await db.prepare(`
      SELECT c.id, c.name, SUM(i.amount) as total_revenue, COUNT(i.id) as invoice_count
      FROM clients c
      LEFT JOIN invoices i ON i.client_id = c.id AND i.status = 'paid'
      WHERE c.organization_id = ?
      ${dateFilter.replace(/created_at/g, 'i.created_at')}
      GROUP BY c.id, c.name
      HAVING total_revenue > 0
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all(orgId, ...params);

    // Revenue by month (last 12 months)
    const revenueByMonth = await db.prepare(`
      SELECT
        TO_CHAR(issue_date, 'YYYY-MM') as month,
        SUM(amount) as revenue
      FROM invoices
      WHERE status = 'paid'
      AND issue_date::DATE >= CURRENT_DATE - INTERVAL '12 months'
      AND organization_id = ?
      ${client_id ? ' AND client_id = ?' : ''}
      GROUP BY month
      ORDER BY month
    `).all(orgId, ...(client_id ? [client_id] : []));

    // Invoice summary by status
    const invoiceSummary = await db.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(amount) as total
      FROM invoices i
      WHERE i.organization_id = ? ${dateFilter.replace(/created_at/g, 'i.created_at')}
      ${client_id ? ' AND client_id = ?' : ''}
      GROUP BY status
    `).all(orgId, ...params, ...(client_id ? [client_id] : []));

    // Expenses by category
    const expensesByCategory = await db.prepare(`
      SELECT
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses e
      WHERE e.organization_id = ? ${dateFilter.replace(/created_at/g, 'e.created_at')}
      GROUP BY category
      ORDER BY total DESC
    `).all(orgId, ...params);

    // Monthly expenses (last 12 months)
    const expensesByMonth = await db.prepare(`
      SELECT
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        SUM(amount) as total
      FROM expenses
      WHERE expense_date::DATE >= CURRENT_DATE - INTERVAL '12 months'
      AND organization_id = ?
      GROUP BY month
      ORDER BY month
    `).all(orgId);

    // Profit calculation (last 12 months)
    const totalRevenueResult = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM invoices
      WHERE status = 'paid'
      AND issue_date::DATE >= CURRENT_DATE - INTERVAL '12 months'
      AND organization_id = ?
    `).get(orgId);
    const totalRevenue = totalRevenueResult.total;

    const totalExpensesResult = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_date::DATE >= CURRENT_DATE - INTERVAL '12 months'
      AND organization_id = ?
    `).get(orgId);
    const totalExpenses = totalExpensesResult.total;

    // Outstanding invoices
    const outstandingInvoices = await db.prepare(`
      SELECT
        COUNT(*) as count,
        SUM(amount) as total
      FROM invoices
      WHERE status IN ('draft', 'approved', 'invoiced')
      AND organization_id = ?
    `).get(orgId);

    res.json({
      revenueByClient,
      revenueByMonth,
      invoiceSummary,
      expensesByCategory,
      expensesByMonth,
      profitSummary: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(2) : 0,
      },
      outstandingInvoices,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Projects Report
// Project health, progress, budget tracking
router.get('/projects', async (req, res) => {
  try {
    const { status } = req.query;
    const orgId = req.orgId;

    // Projects overview
    const projectsOverview = await db.prepare(`
      SELECT
        p.*,
        c.name as client_name,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
        COALESCE(SUM(CASE WHEN e.project_id = p.id THEN e.amount ELSE 0 END), 0) as actual_spending
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN tasks t ON t.project_id = p.id
      LEFT JOIN expenses e ON e.project_id = p.id
      WHERE p.organization_id = ?
      ${status ? ' AND p.status = ?' : ''}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(orgId, ...(status ? [status] : []));

    // Projects by status
    const projectsByStatus = await db.prepare(`
      SELECT status, COUNT(*) as count
      FROM projects
      WHERE organization_id = ?
      GROUP BY status
    `).all(orgId);

    // Projects by client
    const projectsByClient = await db.prepare(`
      SELECT c.id, c.name, COUNT(p.id) as project_count
      FROM clients c
      LEFT JOIN projects p ON p.client_id = c.id
      WHERE c.organization_id = ?
      GROUP BY c.id, c.name
      HAVING project_count > 0
      ORDER BY project_count DESC
      LIMIT 10
    `).all(orgId);

    // Overdue projects (past end_date but not completed)
    const overdueProjects = await db.prepare(`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.organization_id = ?
      AND p.status NOT IN ('completed', 'cancelled')
      AND p.end_date IS NOT NULL
      AND p.end_date::DATE < CURRENT_DATE
    `).all(orgId);

    // Budget utilization
    const budgetUtilization = await db.prepare(`
      SELECT
        p.id,
        p.name,
        p.budget,
        COALESCE(SUM(e.amount), 0) as spent
      FROM projects p
      LEFT JOIN expenses e ON e.project_id = p.id
      WHERE p.budget > 0 AND p.organization_id = ?
      GROUP BY p.id
      ORDER BY (COALESCE(SUM(e.amount), 0) / p.budget) DESC
    `).all(orgId);

    res.json({
      projectsOverview,
      projectsByStatus,
      projectsByClient,
      overdueProjects,
      budgetUtilization,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Team Report
// Team member performance, workload distribution
router.get('/team', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const orgId = req.orgId;

    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND t.created_at::DATE >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND t.created_at::DATE <= ?';
      params.push(end_date);
    }

    // Team member performance
    const teamPerformance = await db.prepare(`
      SELECT
        tm.id,
        tm.name,
        tm.role,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN t.status = 'todo' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND t.due_date::DATE < CURRENT_DATE THEN 1 END) as overdue_tasks
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id ${dateFilter}
      WHERE tm.status = 'active' AND tm.organization_id = ?
      GROUP BY tm.id
      ORDER BY completed_tasks DESC
    `).all(...params, orgId);

    // Workload distribution (current active tasks)
    const workloadDistribution = await db.prepare(`
      SELECT
        tm.id,
        tm.name,
        COUNT(t.id) as active_tasks,
        SUM(COALESCE(t.estimated_hours, 0)) as estimated_hours
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id AND t.status NOT IN ('done')
      WHERE tm.status = 'active' AND tm.organization_id = ?
      GROUP BY tm.id
      ORDER BY active_tasks DESC
    `).all(orgId);

    // Tasks by priority per team member
    const tasksByPriorityPerMember = await db.prepare(`
      SELECT
        tm.id,
        tm.name,
        COUNT(CASE WHEN t.priority = 'urgent' THEN 1 END) as urgent,
        COUNT(CASE WHEN t.priority = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN t.priority = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN t.priority = 'low' THEN 1 END) as low
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id AND t.status NOT IN ('done')
      WHERE tm.status = 'active' AND tm.organization_id = ?
      GROUP BY tm.id
    `).all(orgId);

    // Completion rate by member (last 30 days)
    const completionRates = await db.prepare(`
      SELECT
        tm.id,
        tm.name,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) * 100.0 /
          NULLIF(COUNT(t.id), 0) as completion_rate
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id
        AND t.created_at::DATE >= CURRENT_DATE - INTERVAL '30 days'
      WHERE tm.status = 'active' AND tm.organization_id = ?
      GROUP BY tm.id
      HAVING COUNT(t.id) > 0
      ORDER BY completion_rate DESC
    `).all(orgId);

    // Unassigned tasks
    const unassignedTasks = await db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.assigned_to IS NULL
      AND t.status != 'done'
      AND p.organization_id = ?
    `).get(orgId);

    res.json({
      teamPerformance,
      workloadDistribution,
      tasksByPriorityPerMember,
      completionRates,
      unassignedTasks: unassignedTasks.count,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
