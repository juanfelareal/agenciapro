import express from 'express';
import db from '../config/database.js';
import { notifyNewComment, notifyMentions } from '../utils/notificationHelper.js';

const router = express.Router();

// Get all comments for a task
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

    const comments = await db.all(`
      SELECT tc.*, tm.name as user_name, tm.email as user_email
      FROM task_comments tc
      JOIN team_members tm ON tc.user_id = tm.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at DESC
    `, [req.params.taskId]);

    res.json(comments);
  } catch (error) {
    console.error('Error getting comments:', error);
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

    // Verify task belongs to org directly
    const task = await db.get(
      'SELECT id, title FROM tasks WHERE id = ? AND organization_id = ?',
      [task_id, req.orgId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await db.run(`
      INSERT INTO task_comments (task_id, user_id, comment, organization_id)
      VALUES (?, ?, ?, ?)
    `, [task_id, user_id, comment, req.orgId]);

    const newComment = await db.get(`
      SELECT tc.*, tm.name as user_name, tm.email as user_email
      FROM task_comments tc
      JOIN team_members tm ON tc.user_id = tm.id
      WHERE tc.id = ?
    `, [result.lastInsertRowid]);

    // Notify assigned user about new comment
    notifyNewComment(task_id, task.title, result.lastInsertRowid, user_id, comment);

    // Notify mentioned users
    notifyMentions(comment, task_id, task.title, result.lastInsertRowid, user_id);

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update comment
router.put('/:id', async (req, res) => {
  try {
    const { comment } = req.body;

    // Verify comment belongs to org via task
    const existing = await db.get(`
      SELECT tc.id FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      WHERE tc.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    await db.run(`
      UPDATE task_comments
      SET comment = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [comment, req.params.id]);

    const updated = await db.get(`
      SELECT tc.*, tm.name as user_name
      FROM task_comments tc
      JOIN team_members tm ON tc.user_id = tm.id
      WHERE tc.id = ?
    `, [req.params.id]);

    res.json(updated);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete comment
router.delete('/:id', async (req, res) => {
  try {
    // Verify comment belongs to org via task
    const existing = await db.get(`
      SELECT tc.id FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      WHERE tc.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    await db.run('DELETE FROM task_comments WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
