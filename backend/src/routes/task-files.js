import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all files for a task
router.get('/task/:taskId', (req, res) => {
  try {
    const files = db.prepare(`
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
router.post('/', (req, res) => {
  try {
    const { task_id, file_name, file_path, file_size, file_type, uploaded_by } = req.body;

    if (!task_id || !file_name || !file_path) {
      return res.status(400).json({ error: 'Task ID, file name and file path are required' });
    }

    const result = db.prepare(`
      INSERT INTO task_files (task_id, file_name, file_path, file_size, file_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(task_id, file_name, file_path, file_size, file_type, uploaded_by);

    const file = db.prepare(`
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
router.delete('/:id', (req, res) => {
  try {
    // Get file info before deleting
    const file = db.prepare('SELECT * FROM task_files WHERE id = ?').get(req.params.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare('DELETE FROM task_files WHERE id = ?').run(req.params.id);

    res.json({ message: 'File deleted successfully', file });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
