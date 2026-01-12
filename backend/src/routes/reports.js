import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Productivity Report
// Tasks completed per user, by status, completion rates
router.get('/productivity', (req, res) => {
  try {
    const { start_date, end_date, project_id, user_id } = req.query;

    // Build date filter
    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND date(t.created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND date(t.created_at) <= ?';
      params.push(end_date);
    }

    // Tasks by status
    const tasksByStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks t
      WHERE 1=1 ${dateFilter}
      ${project_id ? ' AND t.project_id = ?' : ''}
      ${user_id ? ' AND t.assigned_to = ?' : ''}
      GROUP BY status
    `).all(...params, ...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

    // Tasks completed per user
    const tasksPerUser = db.prepare(`
      SELECT tm.id, tm.name,
             COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed,
             COUNT(*) as total
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id
      WHERE tm.status = 'active'
      ${dateFilter.replace(/t\./g, 't.')}
      ${project_id ? ' AND t.project_id = ?' : ''}
      GROUP BY tm.id, tm.name
      ORDER BY completed DESC
    `).all(...params, ...(project_id ? [project_id] : []));

    // On-time vs overdue completion
    const completionStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'done' AND (due_date IS NULL OR date(updated_at) <= date(due_date)) THEN 1 END) as on_time,
        COUNT(CASE WHEN status = 'done' AND due_date IS NOT NULL AND date(updated_at) > date(due_date) THEN 1 END) as late,
        COUNT(CASE WHEN status != 'done' AND due_date IS NOT NULL AND date(due_date) < date('now') THEN 1 END) as overdue
      FROM tasks t
      WHERE 1=1 ${dateFilter}
      ${project_id ? ' AND project_id = ?' : ''}
      ${user_id ? ' AND assigned_to = ?' : ''}
    `).get(...params, ...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

    // Tasks by priority
    const tasksByPriority = db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM tasks t
      WHERE 1=1 ${dateFilter}
      ${project_id ? ' AND t.project_id = ?' : ''}
      ${user_id ? ' AND t.assigned_to = ?' : ''}
      GROUP BY priority
    `).all(...params, ...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

    // Weekly trend (tasks completed in the last 8 weeks)
    const weeklyTrend = db.prepare(`
      SELECT
        strftime('%Y-%W', updated_at) as week,
        COUNT(*) as completed
      FROM tasks
      WHERE status = 'done'
      AND date(updated_at) >= date('now', '-8 weeks')
      ${project_id ? ' AND project_id = ?' : ''}
      ${user_id ? ' AND assigned_to = ?' : ''}
      GROUP BY week
      ORDER BY week
    `).all(...(project_id ? [project_id] : []), ...(user_id ? [user_id] : []));

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
router.get('/financial', (req, res) => {
  try {
    const { start_date, end_date, client_id } = req.query;

    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND date(created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND date(created_at) <= ?';
      params.push(end_date);
    }

    // Revenue by client
    const revenueByClient = db.prepare(`
      SELECT c.id, c.name, SUM(i.amount) as total_revenue, COUNT(i.id) as invoice_count
      FROM clients c
      LEFT JOIN invoices i ON i.client_id = c.id AND i.status = 'paid'
      ${dateFilter.replace(/created_at/g, 'i.created_at')}
      GROUP BY c.id, c.name
      HAVING total_revenue > 0
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all(...params);

    // Revenue by month (last 12 months)
    const revenueByMonth = db.prepare(`
      SELECT
        strftime('%Y-%m', issue_date) as month,
        SUM(amount) as revenue
      FROM invoices
      WHERE status = 'paid'
      AND date(issue_date) >= date('now', '-12 months')
      ${client_id ? ' AND client_id = ?' : ''}
      GROUP BY month
      ORDER BY month
    `).all(...(client_id ? [client_id] : []));

    // Invoice summary by status
    const invoiceSummary = db.prepare(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(amount) as total
      FROM invoices i
      WHERE 1=1 ${dateFilter.replace(/created_at/g, 'i.created_at')}
      ${client_id ? ' AND client_id = ?' : ''}
      GROUP BY status
    `).all(...params, ...(client_id ? [client_id] : []));

    // Expenses by category
    const expensesByCategory = db.prepare(`
      SELECT
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses e
      WHERE 1=1 ${dateFilter.replace(/created_at/g, 'e.created_at')}
      GROUP BY category
      ORDER BY total DESC
    `).all(...params);

    // Monthly expenses (last 12 months)
    const expensesByMonth = db.prepare(`
      SELECT
        strftime('%Y-%m', expense_date) as month,
        SUM(amount) as total
      FROM expenses
      WHERE date(expense_date) >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all();

    // Profit calculation (last 12 months)
    const totalRevenue = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM invoices
      WHERE status = 'paid'
      AND date(issue_date) >= date('now', '-12 months')
    `).get().total;

    const totalExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE date(expense_date) >= date('now', '-12 months')
    `).get().total;

    // Outstanding invoices
    const outstandingInvoices = db.prepare(`
      SELECT
        COUNT(*) as count,
        SUM(amount) as total
      FROM invoices
      WHERE status IN ('draft', 'approved', 'invoiced')
    `).get();

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
router.get('/projects', (req, res) => {
  try {
    const { status } = req.query;

    // Projects overview
    const projectsOverview = db.prepare(`
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
      WHERE 1=1
      ${status ? ' AND p.status = ?' : ''}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(...(status ? [status] : []));

    // Projects by status
    const projectsByStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM projects
      GROUP BY status
    `).all();

    // Projects by client
    const projectsByClient = db.prepare(`
      SELECT c.id, c.name, COUNT(p.id) as project_count
      FROM clients c
      LEFT JOIN projects p ON p.client_id = c.id
      GROUP BY c.id, c.name
      HAVING project_count > 0
      ORDER BY project_count DESC
      LIMIT 10
    `).all();

    // Overdue projects (past end_date but not completed)
    const overdueProjects = db.prepare(`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.status NOT IN ('completed', 'cancelled')
      AND p.end_date IS NOT NULL
      AND date(p.end_date) < date('now')
    `).all();

    // Budget utilization
    const budgetUtilization = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.budget,
        COALESCE(SUM(e.amount), 0) as spent
      FROM projects p
      LEFT JOIN expenses e ON e.project_id = p.id
      WHERE p.budget > 0
      GROUP BY p.id
      ORDER BY (COALESCE(SUM(e.amount), 0) / p.budget) DESC
    `).all();

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
router.get('/team', (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND date(t.created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND date(t.created_at) <= ?';
      params.push(end_date);
    }

    // Team member performance
    const teamPerformance = db.prepare(`
      SELECT
        tm.id,
        tm.name,
        tm.role,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN t.status = 'todo' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN t.status != 'done' AND t.due_date IS NOT NULL AND date(t.due_date) < date('now') THEN 1 END) as overdue_tasks
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id ${dateFilter}
      WHERE tm.status = 'active'
      GROUP BY tm.id
      ORDER BY completed_tasks DESC
    `).all(...params);

    // Workload distribution (current active tasks)
    const workloadDistribution = db.prepare(`
      SELECT
        tm.id,
        tm.name,
        COUNT(t.id) as active_tasks,
        SUM(COALESCE(t.estimated_hours, 0)) as estimated_hours
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id AND t.status NOT IN ('done')
      WHERE tm.status = 'active'
      GROUP BY tm.id
      ORDER BY active_tasks DESC
    `).all();

    // Tasks by priority per team member
    const tasksByPriorityPerMember = db.prepare(`
      SELECT
        tm.id,
        tm.name,
        COUNT(CASE WHEN t.priority = 'urgent' THEN 1 END) as urgent,
        COUNT(CASE WHEN t.priority = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN t.priority = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN t.priority = 'low' THEN 1 END) as low
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id AND t.status NOT IN ('done')
      WHERE tm.status = 'active'
      GROUP BY tm.id
    `).all();

    // Completion rate by member (last 30 days)
    const completionRates = db.prepare(`
      SELECT
        tm.id,
        tm.name,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) * 100.0 /
          NULLIF(COUNT(t.id), 0) as completion_rate
      FROM team_members tm
      LEFT JOIN tasks t ON t.assigned_to = tm.id
        AND date(t.created_at) >= date('now', '-30 days')
      WHERE tm.status = 'active'
      GROUP BY tm.id
      HAVING COUNT(t.id) > 0
      ORDER BY completion_rate DESC
    `).all();

    // Unassigned tasks
    const unassignedTasks = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE assigned_to IS NULL
      AND status != 'done'
    `).get();

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
