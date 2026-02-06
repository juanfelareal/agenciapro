import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all files for a task
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

    const files = await db.all(`
      SELECT tf.*, tm.name as uploaded_by_name
      FROM task_files tf
      LEFT JOIN team_members tm ON tf.uploaded_by = tm.id
      WHERE tf.task_id = ?
      ORDER BY tf.created_at DESC
    `, [req.params.taskId]);

    res.json(files);
  } catch (error) {
    console.error('Error getting files:', error);
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

    // Verify task belongs to org directly
    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [task_id, req.orgId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await db.run(`
      INSERT INTO task_files (task_id, file_name, file_path, file_size, file_type, uploaded_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [task_id, file_name, file_path, file_size, file_type, uploaded_by, req.orgId]);

    const file = await db.get(`
      SELECT tf.*, tm.name as uploaded_by_name
      FROM task_files tf
      LEFT JOIN team_members tm ON tf.uploaded_by = tm.id
      WHERE tf.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json(file);
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete file
router.delete('/:id', async (req, res) => {
  try {
    // Verify file belongs to org via task
    const file = await db.get(`
      SELECT tf.* FROM task_files tf
      JOIN tasks t ON tf.task_id = t.id
      WHERE tf.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await db.run('DELETE FROM task_files WHERE id = ?', [req.params.id]);

    res.json({ message: 'File deleted successfully', file });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
