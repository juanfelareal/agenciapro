import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all files for a task
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

    const files = await db.prepare(`
      SELECT tf.*, tm.name as uploaded_by_name
      FROM task_files tf
      LEFT JOIN team_members tm ON tf.uploaded_by = tm.id
      WHERE tf.task_id = ?
      ORDER BY tf.created_at DESC
    `).all(req.params.taskId);

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add file reference (actual upload would be handled separately)
router.post('/', async (req, res) => {
  try {
    const { task_id, file_name, file_path, file_size, file_type, uploaded_by } = req.body;

    if (!task_id || !file_name || !file_path) {
      return res.status(400).json({ error: 'Task ID, file name and file path are required' });
    }

    // Verify task belongs to org via project
    const task = await db.prepare(`
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.organization_id = ?
    `).get(task_id, req.orgId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await db.prepare(`
      INSERT INTO task_files (task_id, file_name, file_path, file_size, file_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(task_id, file_name, file_path, file_size, file_type, uploaded_by);

    const file = await db.prepare(`
      SELECT tf.*, tm.name as uploaded_by_name
      FROM task_files tf
      LEFT JOIN team_members tm ON tf.uploaded_by = tm.id
      WHERE tf.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file
router.delete('/:id', async (req, res) => {
  try {
    // Verify file belongs to org via task→project chain
    const file = await db.prepare(`
      SELECT tf.* FROM task_files tf
      JOIN tasks t ON tf.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE tf.id = ? AND p.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await db.prepare('DELETE FROM task_files WHERE id = ?').run(req.params.id);

    res.json({ message: 'File deleted successfully', file });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
