import express from 'express';
import db from '../config/database.js';
import { assertTaskInOrg, sendTenantError } from '../utils/tenant.js';

const router = express.Router();

// Get all tags
router.get('/', async (req, res) => {
  try {
    const tags = await db.prepare(`
      SELECT t.*, COUNT(tt.task_id) as task_count
      FROM tags t
      LEFT JOIN task_tags tt ON t.id = tt.tag_id
      WHERE t.organization_id = ?
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all(req.orgId);
    res.json(tags);
  } catch (error) {
    return sendTenantError(res, error);
  }
});

// Get tag by ID
router.get('/:id', async (req, res) => {
  try {
    const tag = await db.prepare('SELECT * FROM tags WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new tag
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const result = await db.prepare(`
      INSERT INTO tags (name, color, organization_id)
      VALUES (?, ?, ?)
    `).run(name.trim(), color || '#6366F1', req.orgId);

    const tag = await db.prepare('SELECT * FROM tags WHERE id = ? AND organization_id = ?').get(result.lastInsertRowid, req.orgId);
    res.status(201).json(tag);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Tag name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update tag
router.put('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;

    await db.prepare(`
      UPDATE tags
      SET name = COALESCE(?, name),
          color = COALESCE(?, color)
      WHERE id = ? AND organization_id = ?
    `).run(name?.trim(), color, req.params.id, req.orgId);

    const tag = await db.prepare('SELECT * FROM tags WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Tag name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete tag
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM tags WHERE id = ? AND organization_id = ?').run(req.params.id, req.orgId);
    if (!result.changes) return res.status(404).json({ error: 'Tag not found' });
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tags for a task
router.get('/task/:taskId', async (req, res) => {
  try {
    await assertTaskInOrg(db, req.params.taskId, req.orgId, 'id');
    const tags = await db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ? AND t.organization_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId, req.orgId);
    res.json(tags);
  } catch (error) {
    return sendTenantError(res, error);
  }
});

// Add tag to task
router.post('/task/:taskId/tag/:tagId', async (req, res) => {
  try {
    // Verify task belongs to this organization (404 if foreign)
    await assertTaskInOrg(db, req.params.taskId, req.orgId, 'id');
    // Verify tag belongs to this organization
    const tag = await db.prepare('SELECT id FROM tags WHERE id = ? AND organization_id = ?').get(req.params.tagId, req.orgId);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await db.prepare(`
      INSERT INTO task_tags (task_id, tag_id)
      VALUES (?, ?)
      ON CONFLICT (task_id, tag_id) DO NOTHING
    `).run(req.params.taskId, req.params.tagId);

    const tags = await db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ? AND t.organization_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId, req.orgId);

    res.json(tags);
  } catch (error) {
    return sendTenantError(res, error);
  }
});

// Remove tag from task
router.delete('/task/:taskId/tag/:tagId', async (req, res) => {
  try {
    // Verify task belongs to this organization (404 if foreign)
    await assertTaskInOrg(db, req.params.taskId, req.orgId, 'id');
    // Verify tag belongs to this organization
    const tag = await db.prepare('SELECT id FROM tags WHERE id = ? AND organization_id = ?').get(req.params.tagId, req.orgId);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await db.prepare(`
      DELETE FROM task_tags
      WHERE task_id = ? AND tag_id = ?
    `).run(req.params.taskId, req.params.tagId);

    const tags = await db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ? AND t.organization_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId, req.orgId);

    res.json(tags);
  } catch (error) {
    return sendTenantError(res, error);
  }
});

// Set tags for a task (replaces all existing)
router.put('/task/:taskId', async (req, res) => {
  try {
    const { tagIds } = req.body;

    if (!Array.isArray(tagIds)) {
      return res.status(400).json({ error: 'tagIds must be an array' });
    }

    // Verify task belongs to this organization (404 if foreign)
    await assertTaskInOrg(db, req.params.taskId, req.orgId, 'id');

    // Verify all tags belong to this organization
    if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(',');
      const orgTags = await db.prepare(
        `SELECT id FROM tags WHERE id IN (${placeholders}) AND organization_id = ?`
      ).all(...tagIds, req.orgId);
      if (orgTags.length !== tagIds.length) {
        return res.status(404).json({ error: 'Tag not found' });
      }
    }

    // Remove all existing tags
    await db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(req.params.taskId);

    // Add new tags
    for (const tagId of tagIds) {
      await db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)').run(req.params.taskId, tagId);
    }

    const tags = await db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ? AND t.organization_id = ?
      ORDER BY t.name ASC
    `).all(req.params.taskId, req.orgId);

    res.json(tags);
  } catch (error) {
    return sendTenantError(res, error);
  }
});

export default router;
