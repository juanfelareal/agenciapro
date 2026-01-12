import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all categories
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT nc.*,
        COUNT(n.id) as note_count
      FROM note_categories nc
      LEFT JOIN notes n ON n.category_id = nc.id
      GROUP BY nc.id
      ORDER BY nc.name ASC
    `).all();

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single category
router.get('/:id', (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM note_categories WHERE id = ?').get(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = db.prepare(`
      INSERT INTO note_categories (name, color)
      VALUES (?, ?)
    `).run(name, color || '#6366F1');

    const category = db.prepare('SELECT * FROM note_categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update category
router.put('/:id', (req, res) => {
  try {
    const { name, color } = req.body;

    db.prepare(`
      UPDATE note_categories
      SET name = ?, color = ?
      WHERE id = ?
    `).run(name, color || '#6366F1', req.params.id);

    const category = db.prepare('SELECT * FROM note_categories WHERE id = ?').get(req.params.id);
    res.json(category);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete category
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM note_categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
