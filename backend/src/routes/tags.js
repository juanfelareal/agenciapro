import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all tags
router.get('/', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.*, COUNT(tt.task_id) as task_count
      FROM tags t
      LEFT JOIN task_tags tt ON t.id = tt.tag_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tag by ID
router.get('/:id', (req, res) => {
  try {
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new tag
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const result = db.prepare(`
      INSERT INTO tags (name, color)
      VALUES (?, ?)
    `).run(name.trim(), color || '#6366F1');

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(tag);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Tag name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update tag
router.put('/:id', (req, res) => {
  try {
    const { name, color } = req.body;

    db.prepare(`
      UPDATE tags
      SET name = COALESCE(?, name),
          color = COALESCE(?, color)
      WHERE id = ?
    `).run(name?.trim(), color, req.params.id);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
    res.json(tag);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Tag name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete tag
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tags for a task
router.get('/task/:taskId', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId);
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add tag to task
router.post('/task/:taskId/tag/:tagId', (req, res) => {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO task_tags (task_id, tag_id)
      VALUES (?, ?)
    `).run(req.params.taskId, req.params.tagId);

    const tags = db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId);

    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove tag from task
router.delete('/task/:taskId/tag/:tagId', (req, res) => {
  try {
    db.prepare(`
      DELETE FROM task_tags
      WHERE task_id = ? AND tag_id = ?
    `).run(req.params.taskId, req.params.tagId);

    const tags = db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId);

    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set tags for a task (replaces all existing)
router.put('/task/:taskId', (req, res) => {
  try {
    const { tagIds } = req.body;

    if (!Array.isArray(tagIds)) {
      return res.status(400).json({ error: 'tagIds must be an array' });
    }

    const transaction = db.transaction(() => {
      // Remove all existing tags
      db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(req.params.taskId);

      // Add new tags
      const insertStmt = db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)');
      tagIds.forEach(tagId => {
        insertStmt.run(req.params.taskId, tagId);
      });
    });
    transaction();

    const tags = db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId);

    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
