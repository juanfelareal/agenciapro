import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// List goals for a year
router.get('/', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const goals = await db.prepare(
      'SELECT month, goal_amount FROM monthly_sales_goals WHERE organization_id = ? AND year = ? ORDER BY month'
    ).all(req.orgId, year);
    res.json({ year, goals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert a single month
router.put('/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const { goal_amount } = req.body;
    if (!year || !month || month < 1 || month > 12 || typeof goal_amount !== 'number') {
      return res.status(400).json({ error: 'Invalid year, month, or goal_amount' });
    }
    await db.prepare(`
      INSERT INTO monthly_sales_goals (organization_id, year, month, goal_amount)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (organization_id, year, month)
      DO UPDATE SET goal_amount = EXCLUDED.goal_amount, updated_at = CURRENT_TIMESTAMP
    `).run(req.orgId, year, month, goal_amount);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk upsert for a year: body = { year, goals: [{ month, goal_amount }, ...] }
router.post('/bulk', async (req, res) => {
  try {
    const { year, goals } = req.body;
    if (!year || !Array.isArray(goals)) {
      return res.status(400).json({ error: 'year and goals array are required' });
    }
    for (const g of goals) {
      if (!g.month || g.month < 1 || g.month > 12 || typeof g.goal_amount !== 'number') continue;
      await db.prepare(`
        INSERT INTO monthly_sales_goals (organization_id, year, month, goal_amount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (organization_id, year, month)
        DO UPDATE SET goal_amount = EXCLUDED.goal_amount, updated_at = CURRENT_TIMESTAMP
      `).run(req.orgId, year, g.month, g.goal_amount);
    }
    res.json({ success: true, count: goals.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
