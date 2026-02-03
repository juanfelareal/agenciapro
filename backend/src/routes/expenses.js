import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all expenses
router.get('/', async (req, res) => {
  try {
    const { category, project_id, start_date, end_date } = req.query;
    let query = `
      SELECT e.*, p.name as project_name
      FROM expenses e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.organization_id = ?
    `;
    const params = [req.orgId];

    if (category) {
      query += ' AND e.category = ?';
      params.push(category);
    }

    if (project_id) {
      query += ' AND e.project_id = ?';
      params.push(project_id);
    }

    if (start_date) {
      query += ' AND e.expense_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND e.expense_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY e.expense_date DESC';
    const expenses = await db.prepare(query).all(...params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get expense by ID
router.get('/:id', async (req, res) => {
  try {
    const expense = await db.prepare(`
      SELECT e.*, p.name as project_name
      FROM expenses e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.id = ? AND e.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new expense
router.post('/', async (req, res) => {
  try {
    const { description, category, amount, project_id, expense_date, payment_method, receipt_url, notes } = req.body;

    if (!description || !amount || !expense_date) {
      return res.status(400).json({ error: 'Description, amount, and expense date are required' });
    }

    const result = await db.prepare(`
      INSERT INTO expenses (description, category, amount, project_id, expense_date, payment_method, receipt_url, notes, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(description, category, amount, project_id, expense_date, payment_method, receipt_url, notes, req.orgId);

    // Update project spent amount if project_id is provided (verify project belongs to org)
    if (project_id) {
      await db.prepare(`
        UPDATE projects
        SET spent = spent + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `).run(amount, project_id, req.orgId);
    }

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ? AND organization_id = ?').get(result.lastInsertRowid, req.orgId);
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update expense
router.put('/:id', async (req, res) => {
  try {
    const { description, category, amount, project_id, expense_date, payment_method, receipt_url, notes } = req.body;

    // Get old expense to adjust project spent (scoped to org)
    const oldExpense = await db.prepare('SELECT * FROM expenses WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);

    if (!oldExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await db.prepare(`
      UPDATE expenses
      SET description = ?, category = ?, amount = ?, project_id = ?,
          expense_date = ?, payment_method = ?, receipt_url = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(description, category, amount, project_id, expense_date, payment_method, receipt_url, notes, req.params.id, req.orgId);

    // Adjust project spent amounts (verify projects belong to org)
    if (oldExpense.project_id) {
      await db.prepare('UPDATE projects SET spent = spent - ? WHERE id = ? AND organization_id = ?')
        .run(oldExpense.amount, oldExpense.project_id, req.orgId);
    }

    if (project_id) {
      await db.prepare('UPDATE projects SET spent = spent + ? WHERE id = ? AND organization_id = ?')
        .run(amount, project_id, req.orgId);
    }

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete expense
router.delete('/:id', async (req, res) => {
  try {
    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Adjust project spent amount (verify project belongs to org)
    if (expense.project_id) {
      await db.prepare('UPDATE projects SET spent = spent - ? WHERE id = ? AND organization_id = ?')
        .run(expense.amount, expense.project_id, req.orgId);
    }

    await db.prepare('DELETE FROM expenses WHERE id = ? AND organization_id = ?').run(req.params.id, req.orgId);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get expense summary by category
router.get('/summary/by-category', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM expenses
      WHERE organization_id = ?
    `;
    const params = [req.orgId];

    if (start_date) {
      query += ' AND expense_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND expense_date <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY category ORDER BY total DESC';
    const summary = await db.prepare(query).all(...params);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
