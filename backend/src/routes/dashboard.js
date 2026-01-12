import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const { start, end } = req.query;
    const stats = {
      clients: {},
      projects: {},
      tasks: {},
      finances: {},
      period: { start, end }
    };

    // Build date filter
    let dateFilter = '';
    const params = [];

    if (start && end) {
      dateFilter = ' WHERE created_at >= ? AND created_at <= ?';
      params.push(start, end);
    }

    // Client stats - clients don't filter by date, show current status
    const clientStats = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(contract_value) as total_contract_value
      FROM clients
    `).get();
    stats.clients = clientStats;

    // Project stats
    const projectQuery = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(budget) as total_budget,
        SUM(spent) as total_spent
      FROM projects
      ${dateFilter}
    `;
    const projectStats = params.length > 0
      ? await db.prepare(projectQuery).get(...params)
      : await db.prepare(projectQuery).get();
    stats.projects = projectStats;

    // Task stats
    const taskQuery = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
      FROM tasks
      ${dateFilter}
    `;
    const taskStats = params.length > 0
      ? await db.prepare(taskQuery).get(...params)
      : await db.prepare(taskQuery).get();
    stats.tasks = taskStats;

    // Finance stats - filter by paid_date for paid invoices, issue_date for total invoiced
    let invoiceQuery, expenseQuery;

    if (start && end) {
      invoiceQuery = `
        SELECT
          COUNT(*) as total_invoices,
          SUM(amount) as total_invoiced,
          SUM(CASE WHEN status = 'paid' AND paid_date >= ? AND paid_date <= ? THEN amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN (status = 'sent' OR status = 'overdue') AND issue_date >= ? AND issue_date <= ? THEN amount ELSE 0 END) as total_pending
        FROM invoices
        WHERE issue_date >= ? AND issue_date <= ?
      `;
      expenseQuery = `
        SELECT
          COUNT(*) as total_expenses,
          SUM(amount) as total_expenses_amount
        FROM expenses
        WHERE expense_date >= ? AND expense_date <= ?
      `;

      const invoiceStats = await db.prepare(invoiceQuery).get(start, end, start, end, start, end);
      const expenseStats = await db.prepare(expenseQuery).get(start, end);

      stats.finances = {
        ...invoiceStats,
        ...expenseStats,
        net_income: (invoiceStats.total_paid || 0) - (expenseStats.total_expenses_amount || 0),
      };
    } else {
      invoiceQuery = `
        SELECT
          COUNT(*) as total_invoices,
          SUM(amount) as total_invoiced,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status = 'sent' OR status = 'overdue' THEN amount ELSE 0 END) as total_pending
        FROM invoices
      `;
      expenseQuery = `
        SELECT
          COUNT(*) as total_expenses,
          SUM(amount) as total_expenses_amount
        FROM expenses
      `;

      const invoiceStats = await db.prepare(invoiceQuery).get();
      const expenseStats = await db.prepare(expenseQuery).get();

      stats.finances = {
        ...invoiceStats,
        ...expenseStats,
        net_income: (invoiceStats.total_paid || 0) - (expenseStats.total_expenses_amount || 0),
      };
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent activity
router.get('/recent-activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const recentProjects = await db.prepare(`
      SELECT 'project' as type, id, name as title, status, created_at
      FROM projects
      ORDER BY created_at DESC
      LIMIT ?
    `).all(Math.ceil(limit / 3));

    const recentTasks = await db.prepare(`
      SELECT 'task' as type, id, title, status, created_at
      FROM tasks
      ORDER BY created_at DESC
      LIMIT ?
    `).all(Math.ceil(limit / 3));

    const recentInvoices = await db.prepare(`
      SELECT 'invoice' as type, id, invoice_number as title, status, created_at
      FROM invoices
      ORDER BY created_at DESC
      LIMIT ?
    `).all(Math.ceil(limit / 3));

    const activity = [...recentProjects, ...recentTasks, ...recentInvoices]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming tasks
router.get('/upcoming-tasks', async (req, res) => {
  try {
    const tasks = await db.prepare(`
      SELECT t.*, p.name as project_name, tm.name as assigned_to_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE t.status != 'done'
        AND t.due_date IS NOT NULL
        AND t.due_date >= date('now')
      ORDER BY t.due_date ASC
      LIMIT 10
    `).all();

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get overdue invoices
router.get('/overdue-invoices', async (req, res) => {
  try {
    const invoices = await db.prepare(`
      SELECT i.*, c.name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.status IN ('sent', 'overdue')
        AND i.due_date < date('now')
      ORDER BY i.due_date ASC
    `).all();

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly revenue trend
router.get('/revenue-trend', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;

    const revenue = await db.prepare(`
      SELECT
        strftime('%Y-%m', paid_date) as month,
        SUM(amount) as revenue
      FROM invoices
      WHERE status = 'paid'
        AND paid_date >= date('now', '-' || ? || ' months')
      GROUP BY month
      ORDER BY month DESC
    `).all(months);

    const expenses = await db.prepare(`
      SELECT
        strftime('%Y-%m', expense_date) as month,
        SUM(amount) as expenses
      FROM expenses
      WHERE expense_date >= date('now', '-' || ? || ' months')
      GROUP BY month
      ORDER BY month DESC
    `).all(months);

    const trend = revenue.map(r => {
      const exp = expenses.find(e => e.month === r.month);
      return {
        month: r.month,
        revenue: r.revenue,
        expenses: exp ? exp.expenses : 0,
        profit: r.revenue - (exp ? exp.expenses : 0),
      };
    });

    res.json(trend);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
