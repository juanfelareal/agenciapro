import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all columns for a project/board
router.get('/project/:projectId', async (req, res) => {
  try {
    const columns = await db.prepare(`
      SELECT * FROM board_columns
      WHERE project_id = ?
      ORDER BY column_order ASC
    `).all(req.params.projectId);

    res.json(columns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get column by ID
router.get('/:id', async (req, res) => {
  try {
    const column = await db.prepare('SELECT * FROM board_columns WHERE id = ?').get(req.params.id);
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }
    res.json(column);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new column
router.post('/', async (req, res) => {
  try {
    const { project_id, column_name, column_type, column_order, settings } = req.body;

    if (!project_id || !column_name || !column_type) {
      return res.status(400).json({ error: 'Project ID, column name and type are required' });
    }

    const result = await db.prepare(`
      INSERT INTO board_columns (project_id, column_name, column_type, column_order, settings)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      project_id,
      column_name,
      column_type,
      column_order || 0,
      settings ? JSON.stringify(settings) : null
    );

    const column = await db.prepare('SELECT * FROM board_columns WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(column);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update column
router.put('/:id', async (req, res) => {
  try {
    const { column_name, column_type, column_order, settings } = req.body;

    await db.prepare(`
      UPDATE board_columns
      SET column_name = ?, column_type = ?, column_order = ?, settings = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      column_name,
      column_type,
      column_order,
      settings ? JSON.stringify(settings) : null,
      req.params.id
    );

    const column = await db.prepare('SELECT * FROM board_columns WHERE id = ?').get(req.params.id);
    res.json(column);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete column
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM board_columns WHERE id = ?').run(req.params.id);
    res.json({ message: 'Column deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get column values for a task
router.get('/values/task/:taskId', async (req, res) => {
  try {
    const values = await db.prepare(`
      SELECT bcv.*, bc.column_name, bc.column_type, bc.settings
      FROM board_column_values bcv
      JOIN board_columns bc ON bcv.column_id = bc.id
      WHERE bcv.task_id = ?
    `).all(req.params.taskId);

    res.json(values);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set/Update column value for a task
router.post('/values', async (req, res) => {
  try {
    const { task_id, column_id, value } = req.body;

    if (!task_id || !column_id) {
      return res.status(400).json({ error: 'Task ID and Column ID are required' });
    }

    // Upsert (insert or update)
    const existing = await db.prepare(`
      SELECT id FROM board_column_values
      WHERE task_id = ? AND column_id = ?
    `).get(task_id, column_id);

    if (existing) {
      await db.prepare(`
        UPDATE board_column_values
        SET value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE task_id = ? AND column_id = ?
      `).run(value, task_id, column_id);
    } else {
      await db.prepare(`
        INSERT INTO board_column_values (task_id, column_id, value)
        VALUES (?, ?, ?)
      `).run(task_id, column_id, value);
    }

    const result = await db.prepare(`
      SELECT bcv.*, bc.column_name, bc.column_type
      FROM board_column_values bcv
      JOIN board_columns bc ON bcv.column_id = bc.id
      WHERE bcv.task_id = ? AND bcv.column_id = ?
    `).get(task_id, column_id);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
