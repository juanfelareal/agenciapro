import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all expenses
router.get('/', (req, res) => {
  try {
    const { category, project_id, start_date, end_date } = req.query;
    let query = `
      SELECT e.*, p.name as project_name
      FROM expenses e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

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
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get expense by ID
router.get('/:id', (req, res) => {
  try {
    const expense = db.prepare(`
      SELECT e.*, p.name as project_name
      FROM expenses e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.id = ?
    `).get(req.params.id);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new expense
router.post('/', (req, res) => {
  try {
    const { description, category, amount, project_id, expense_date, payment_method, receipt_url, notes } = req.body;

    if (!description || !amount || !expense_date) {
      return res.status(400).json({ error: 'Description, amount, and expense date are required' });
    }

    const result = db.prepare(`
      INSERT INTO expenses (description, category, amount, project_id, expense_date, payment_method, receipt_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(description, category, amount, project_id, expense_date, payment_method, receipt_url, notes);

    // Update project spent amount if project_id is provided
    if (project_id) {
      db.prepare(`
        UPDATE projects
        SET spent = spent + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amount, project_id);
    }

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update expense
router.put('/:id', (req, res) => {
  try {
    const { description, category, amount, project_id, expense_date, payment_method, receipt_url, notes } = req.body;

    // Get old expense to adjust project spent
    const oldExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);

    db.prepare(`
      UPDATE expenses
      SET description = ?, category = ?, amount = ?, project_id = ?,
          expense_date = ?, payment_method = ?, receipt_url = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(description, category, amount, project_id, expense_date, payment_method, receipt_url, notes, req.params.id);

    // Adjust project spent amounts
    if (oldExpense.project_id) {
      db.prepare('UPDATE projects SET spent = spent - ? WHERE id = ?')
        .run(oldExpense.amount, oldExpense.project_id);
    }

    if (project_id) {
      db.prepare('UPDATE projects SET spent = spent + ? WHERE id = ?')
        .run(amount, project_id);
    }

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete expense
router.delete('/:id', (req, res) => {
  try {
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);

    // Adjust project spent amount
    if (expense.project_id) {
      db.prepare('UPDATE projects SET spent = spent - ? WHERE id = ?')
        .run(expense.amount, expense.project_id);
    }

    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get expense summary by category
router.get('/summary/by-category', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM expenses
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND expense_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND expense_date <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY category ORDER BY total DESC';
    const summary = db.prepare(query).all(...params);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
