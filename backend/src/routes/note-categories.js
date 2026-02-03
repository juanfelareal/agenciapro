import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await db.prepare(`
      SELECT nc.*,
        COUNT(n.id) as note_count
      FROM note_categories nc
      LEFT JOIN notes n ON n.category_id = nc.id AND n.organization_id = ?
      WHERE nc.organization_id = ?
      GROUP BY nc.id
      ORDER BY nc.name ASC
    `).all(req.orgId, req.orgId);

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single category
router.get('/:id', async (req, res) => {
  try {
    const category = await db.prepare('SELECT * FROM note_categories WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.prepare(`
      INSERT INTO note_categories (name, color, organization_id)
      VALUES (?, ?, ?)
    `).run(name, color || '#6366F1', req.orgId);

    const category = await db.prepare('SELECT * FROM note_categories WHERE id = ? AND organization_id = ?').get(result.lastInsertRowid, req.orgId);
    res.status(201).json(category);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;

    await db.prepare(`
      UPDATE note_categories
      SET name = ?, color = ?
      WHERE id = ? AND organization_id = ?
    `).run(name, color || '#6366F1', req.params.id, req.orgId);

    const category = await db.prepare('SELECT * FROM note_categories WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    res.json(category);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM note_categories WHERE id = ? AND organization_id = ?').run(req.params.id, req.orgId);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
