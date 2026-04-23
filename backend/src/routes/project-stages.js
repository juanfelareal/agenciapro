import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// List stages for the current organization
router.get('/', async (req, res) => {
  try {
    const stages = await db.all(
      `SELECT s.*, COUNT(p.id) as project_count
       FROM project_stages s
       LEFT JOIN projects p ON p.stage_id = s.id
       WHERE s.organization_id = ?
       GROUP BY s.id
       ORDER BY s.order_index ASC, s.name ASC`,
      [req.orgId]
    );
    res.json(stages);
  } catch (error) {
    console.error('Error getting stages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new stage
router.post('/', async (req, res) => {
  try {
    const { name, color, order_index } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Stage name is required' });
    }

    const trimmed = name.trim();
    const existing = await db.get(
      'SELECT id FROM project_stages WHERE organization_id = ? AND LOWER(name) = LOWER(?)',
      [req.orgId, trimmed]
    );
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una etapa con ese nombre' });
    }

    const result = await db.run(
      `INSERT INTO project_stages (name, color, order_index, organization_id)
       VALUES (?, ?, ?, ?)`,
      [trimmed, color || null, order_index ?? 0, req.orgId]
    );

    const stage = await db.get(
      'SELECT * FROM project_stages WHERE id = ? AND organization_id = ?',
      [result.lastInsertRowid, req.orgId]
    );
    res.status(201).json(stage);
  } catch (error) {
    console.error('Error creating stage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update stage
router.put('/:id', async (req, res) => {
  try {
    const { name, color, order_index } = req.body;

    await db.run(
      `UPDATE project_stages
       SET name = COALESCE(?, name),
           color = COALESCE(?, color),
           order_index = COALESCE(?, order_index)
       WHERE id = ? AND organization_id = ?`,
      [name?.trim(), color, order_index, req.params.id, req.orgId]
    );

    const stage = await db.get(
      'SELECT * FROM project_stages WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    res.json(stage);
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete stage (projects using it have stage_id set to NULL via FK)
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run(
      'DELETE FROM project_stages WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    res.json({ message: 'Stage deleted' });
  } catch (error) {
    console.error('Error deleting stage:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
