import express from 'express';
import db from '../config/database.js';
import { notifyNewComment, notifyMentions } from '../utils/notificationHelper.js';

const router = express.Router();

// Get all comments for a task
router.get('/task/:taskId', async (req, res) => {
  try {
    // Verify task belongs to org via project
    const task = await db.prepare(`
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.organization_id = ?
    `).get(req.params.taskId, req.orgId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

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

    // Verify task belongs to org via project
    const task = await db.prepare(`
      SELECT t.id, t.title FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.organization_id = ?
    `).get(task_id, req.orgId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
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

    // Notify assigned user about new comment
    notifyNewComment(task_id, task.title, result.lastInsertRowid, user_id, comment);

    // Notify mentioned users
    notifyMentions(comment, task_id, task.title, result.lastInsertRowid, user_id);

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update comment
router.put('/:id', async (req, res) => {
  try {
    const { comment } = req.body;

    // Verify comment belongs to org via task→project chain
    const existing = await db.prepare(`
      SELECT tc.id FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE tc.id = ? AND p.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }

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
    // Verify comment belongs to org via task→project chain
    const existing = await db.prepare(`
      SELECT tc.id FROM task_comments tc
      JOIN tasks t ON tc.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE tc.id = ? AND p.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    await db.prepare('DELETE FROM task_comments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
