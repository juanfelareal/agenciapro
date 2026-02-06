import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all subtasks for a task
router.get('/task/:taskId', async (req, res) => {
  try {
    // Verify task belongs to org directly
    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [req.params.taskId, req.orgId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const subtasks = await db.all(`
      SELECT * FROM subtasks
      WHERE task_id = ?
      ORDER BY position ASC, created_at ASC
    `, [req.params.taskId]);
    res.json(subtasks);
  } catch (error) {
    console.error('Error getting subtasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subtask by ID
router.get('/:id', async (req, res) => {
  try {
    const subtask = await db.get(`
      SELECT s.* FROM subtasks s
      JOIN tasks t ON s.task_id = t.id
      WHERE s.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }
    res.json(subtask);
  } catch (error) {
    console.error('Error getting subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new subtask
router.post('/', async (req, res) => {
  try {
    const { task_id, title, position } = req.body;

    if (!task_id || !title) {
      return res.status(400).json({ error: 'Task ID and title are required' });
    }

    // Verify task belongs to org directly
    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [task_id, req.orgId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get max position if not provided
    let newPosition = position;
    if (newPosition === undefined) {
      const maxPos = await db.get('SELECT MAX(position) as max FROM subtasks WHERE task_id = ?', [task_id]);
      newPosition = (maxPos?.max || 0) + 1;
    }

    const result = await db.run(`
      INSERT INTO subtasks (task_id, title, position, organization_id)
      VALUES (?, ?, ?, ?)
    `, [task_id, title, newPosition, req.orgId]);

    const subtask = await db.get('SELECT * FROM subtasks WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(subtask);
  } catch (error) {
    console.error('Error creating subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update subtask
router.put('/:id', async (req, res) => {
  try {
    const { title, is_completed, position } = req.body;

    // Verify subtask belongs to org via task
    const existing = await db.get(`
      SELECT s.id FROM subtasks s
      JOIN tasks t ON s.task_id = t.id
      WHERE s.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!existing) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    await db.run(`
      UPDATE subtasks
      SET title = COALESCE(?, title),
          is_completed = COALESCE(?, is_completed),
          position = COALESCE(?, position)
      WHERE id = ?
    `, [title, is_completed, position, req.params.id]);

    const subtask = await db.get('SELECT * FROM subtasks WHERE id = ?', [req.params.id]);
    res.json(subtask);
  } catch (error) {
    console.error('Error updating subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle subtask completion
router.put('/:id/toggle', async (req, res) => {
  try {
    const subtask = await db.get(`
      SELECT s.* FROM subtasks s
      JOIN tasks t ON s.task_id = t.id
      WHERE s.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    const newCompleted = subtask.is_completed ? 0 : 1;
    await db.run('UPDATE subtasks SET is_completed = ? WHERE id = ?', [newCompleted, req.params.id]);

    const updatedSubtask = await db.get('SELECT * FROM subtasks WHERE id = ?', [req.params.id]);
    res.json(updatedSubtask);
  } catch (error) {
    console.error('Error toggling subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorder subtasks
router.put('/reorder/:taskId', async (req, res) => {
  try {
    const { subtaskIds } = req.body; // Array of subtask IDs in new order

    if (!Array.isArray(subtaskIds)) {
      return res.status(400).json({ error: 'subtaskIds must be an array' });
    }

    // Verify task belongs to org directly
    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [req.params.taskId, req.orgId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update positions sequentially
    for (let index = 0; index < subtaskIds.length; index++) {
      await db.run('UPDATE subtasks SET position = ? WHERE id = ? AND task_id = ?',
        [index, subtaskIds[index], req.params.taskId]);
    }

    const subtasks = await db.all(`
      SELECT * FROM subtasks
      WHERE task_id = ?
      ORDER BY position ASC
    `, [req.params.taskId]);

    res.json(subtasks);
  } catch (error) {
    console.error('Error reordering subtasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete subtask
router.delete('/:id', async (req, res) => {
  try {
    // Verify subtask belongs to org via task
    const existing = await db.get(`
      SELECT s.id FROM subtasks s
      JOIN tasks t ON s.task_id = t.id
      WHERE s.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!existing) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    await db.run('DELETE FROM subtasks WHERE id = ?', [req.params.id]);
    res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subtask progress for a task
router.get('/task/:taskId/progress', async (req, res) => {
  try {
    // Verify task belongs to org directly
    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [req.params.taskId, req.orgId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const stats = await db.get(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END), 0) as completed
      FROM subtasks
      WHERE task_id = ?
    `, [req.params.taskId]);

    const total = stats?.total || 0;
    const completed = stats?.completed || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      total,
      completed,
      progress
    });
  } catch (error) {
    console.error('Error getting subtask progress:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
