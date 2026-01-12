import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all subtasks for a task
router.get('/task/:taskId', (req, res) => {
  try {
    const subtasks = db.prepare(`
      SELECT * FROM subtasks
      WHERE task_id = ?
      ORDER BY position ASC, created_at ASC
    `).all(req.params.taskId);
    res.json(subtasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get subtask by ID
router.get('/:id', (req, res) => {
  try {
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id);
    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }
    res.json(subtask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new subtask
router.post('/', (req, res) => {
  try {
    const { task_id, title, position } = req.body;

    if (!task_id || !title) {
      return res.status(400).json({ error: 'Task ID and title are required' });
    }

    // Get max position if not provided
    let newPosition = position;
    if (newPosition === undefined) {
      const maxPos = db.prepare('SELECT MAX(position) as max FROM subtasks WHERE task_id = ?').get(task_id);
      newPosition = (maxPos.max || 0) + 1;
    }

    const result = db.prepare(`
      INSERT INTO subtasks (task_id, title, position)
      VALUES (?, ?, ?)
    `).run(task_id, title, newPosition);

    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(subtask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update subtask
router.put('/:id', (req, res) => {
  try {
    const { title, is_completed, position } = req.body;

    db.prepare(`
      UPDATE subtasks
      SET title = COALESCE(?, title),
          is_completed = COALESCE(?, is_completed),
          position = COALESCE(?, position)
      WHERE id = ?
    `).run(title, is_completed, position, req.params.id);

    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id);
    res.json(subtask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle subtask completion
router.put('/:id/toggle', (req, res) => {
  try {
    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id);
    if (!subtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    const newCompleted = subtask.is_completed ? 0 : 1;
    db.prepare('UPDATE subtasks SET is_completed = ? WHERE id = ?').run(newCompleted, req.params.id);

    const updatedSubtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id);
    res.json(updatedSubtask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder subtasks
router.put('/reorder/:taskId', (req, res) => {
  try {
    const { subtaskIds } = req.body; // Array of subtask IDs in new order

    if (!Array.isArray(subtaskIds)) {
      return res.status(400).json({ error: 'subtaskIds must be an array' });
    }

    const updateStmt = db.prepare('UPDATE subtasks SET position = ? WHERE id = ? AND task_id = ?');
    const transaction = db.transaction(() => {
      subtaskIds.forEach((id, index) => {
        updateStmt.run(index, id, req.params.taskId);
      });
    });
    transaction();

    const subtasks = db.prepare(`
      SELECT * FROM subtasks
      WHERE task_id = ?
      ORDER BY position ASC
    `).all(req.params.taskId);

    res.json(subtasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete subtask
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get subtask progress for a task
router.get('/task/:taskId/progress', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END), 0) as completed
      FROM subtasks
      WHERE task_id = ?
    `).get(req.params.taskId);

    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      total,
      completed,
      progress
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
