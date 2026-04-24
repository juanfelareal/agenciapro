import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const taskFilesDir = path.join(__dirname, '../../uploads/task-files');
fs.mkdirSync(taskFilesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: taskFilesDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const router = express.Router();

// Upload a file for a task (multipart). Returns the saved task_files row.
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { task_id, uploaded_by } = req.body;
    if (!task_id) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'task_id is required' });
    }

    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [task_id, req.orgId]
    );
    if (!task) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(404).json({ error: 'Task not found' });
    }

    const publicPath = `/uploads/task-files/${path.basename(req.file.path)}`;

    const result = await db.run(`
      INSERT INTO task_files (task_id, file_name, file_path, file_size, file_type, uploaded_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      task_id,
      req.file.originalname,
      publicPath,
      req.file.size,
      req.file.mimetype,
      uploaded_by ? Number(uploaded_by) : null,
      req.orgId,
    ]);

    const file = await db.get(`
      SELECT tf.*, tm.name as uploaded_by_name
      FROM task_files tf
      LEFT JOIN team_members tm ON tf.uploaded_by = tm.id
      WHERE tf.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json(file);
  } catch (error) {
    console.error('Error uploading task file:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    const { task_id, file_name, file_path, file_size, file_type, description, uploaded_by } = req.body;

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
      INSERT INTO task_files (task_id, file_name, file_path, file_size, file_type, description, uploaded_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [task_id, file_name, file_path, file_size, file_type, description || null, uploaded_by, req.orgId]);

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

// Update an existing task file (title/description, useful for embeds)
router.patch('/:id', async (req, res) => {
  try {
    const { file_name, description } = req.body;
    const file = await db.get(`
      SELECT tf.* FROM task_files tf
      JOIN tasks t ON tf.task_id = t.id
      WHERE tf.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await db.run(`
      UPDATE task_files
      SET file_name = COALESCE(?, file_name),
          description = ?
      WHERE id = ? AND organization_id = ?
    `, [file_name ?? file.file_name, description ?? null, req.params.id, req.orgId]);

    const updated = await db.get(`
      SELECT tf.*, tm.name as uploaded_by_name
      FROM task_files tf
      LEFT JOIN team_members tm ON tf.uploaded_by = tm.id
      WHERE tf.id = ?
    `, [req.params.id]);

    res.json(updated);
  } catch (error) {
    console.error('Error updating file:', error);
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

    await db.run('DELETE FROM task_files WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);

    res.json({ message: 'File deleted successfully', file });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
