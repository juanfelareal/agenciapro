import express from 'express';
import db from '../config/database.js';
import { notifyNewComment, notifyMentions } from '../utils/notificationHelper.js';

const router = express.Router();

// Get all comments for a task
router.get('/task/:taskId', async (req, res) => {
  try {
    const comments = await db.prepare(`
      SELECT tc.*, tm.name as user_name, tm.email as user_email
      FROM task_comments tc
      JOIN team_members tm ON tc.user_id = tm.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at DESC
    `).all(req.params.taskId);

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new comment
router.post('/', async (req, res) => {
  try {
    const { task_id, user_id, comment } = req.body;

    if (!task_id || !user_id || !comment) {
      return res.status(400).json({ error: 'Task ID, user ID and comment are required' });
    }

    const result = await db.prepare(`
      INSERT INTO task_comments (task_id, user_id, comment)
      VALUES (?, ?, ?)
    `).run(task_id, user_id, comment);

    const newComment = await db.prepare(`
      SELECT tc.*, tm.name as user_name, tm.email as user_email
      FROM task_comments tc
      JOIN team_members tm ON tc.user_id = tm.id
      WHERE tc.id = ?
    `).get(result.lastInsertRowid);

    // Get task information for notifications
    const task = await db.prepare('SELECT title FROM tasks WHERE id = ?').get(task_id);

    if (task) {
      // Notify assigned user about new comment
      notifyNewComment(task_id, task.title, result.lastInsertRowid, user_id, comment);

      // Notify mentioned users
      notifyMentions(comment, task_id, task.title, result.lastInsertRowid, user_id);
    }

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update comment
router.put('/:id', async (req, res) => {
  try {
    const { comment } = req.body;

    await db.prepare(`
      UPDATE task_comments
      SET comment = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(comment, req.params.id);

    const updated = await db.prepare(`
      SELECT tc.*, tm.name as user_name
      FROM task_comments tc
      JOIN team_members tm ON tc.user_id = tm.id
      WHERE tc.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete comment
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM task_comments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
