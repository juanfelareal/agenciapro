import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all automations
router.get('/', async (req, res) => {
  try {
    const automations = await db.prepare(`
      SELECT a.*, p.name as project_name
      FROM automations a
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE a.organization_id = ?
      ORDER BY a.created_at DESC
    `).all(req.orgId);
    res.json(automations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get automations by project
router.get('/project/:projectId', async (req, res) => {
  try {
    // Verify project belongs to this organization
    const project = await db.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(req.params.projectId, req.orgId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const automations = await db.prepare(`
      SELECT a.*, p.name as project_name
      FROM automations a
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE a.project_id = ? AND a.organization_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.projectId, req.orgId);
    res.json(automations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single automation
router.get('/:id', async (req, res) => {
  try {
    const automation = await db.prepare(`
      SELECT a.*, p.name as project_name
      FROM automations a
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE a.id = ? AND a.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create automation
router.post('/', async (req, res) => {
  try {
    const { project_id, name, trigger_type, trigger_conditions, action_type, action_params, is_active } = req.body;

    if (!name || !trigger_type || !action_type) {
      return res.status(400).json({ error: 'Name, trigger type, and action type are required' });
    }

    // Verify project belongs to this organization if provided
    if (project_id) {
      const project = await db.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(project_id, req.orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const result = await db.prepare(`
      INSERT INTO automations (project_id, name, trigger_type, trigger_conditions, action_type, action_params, is_active, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id || null,
      name,
      trigger_type,
      trigger_conditions ? JSON.stringify(trigger_conditions) : null,
      action_type,
      action_params ? JSON.stringify(action_params) : null,
      is_active !== false ? 1 : 0,
      req.orgId
    );

    const automation = await db.prepare('SELECT * FROM automations WHERE id = ? AND organization_id = ?').get(result.lastInsertRowid, req.orgId);
    res.status(201).json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update automation
router.put('/:id', async (req, res) => {
  try {
    const { project_id, name, trigger_type, trigger_conditions, action_type, action_params, is_active } = req.body;

    // Verify project belongs to this organization if provided
    if (project_id) {
      const project = await db.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(project_id, req.orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    await db.prepare(`
      UPDATE automations
      SET project_id = ?, name = ?, trigger_type = ?, trigger_conditions = ?,
          action_type = ?, action_params = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      project_id || null,
      name,
      trigger_type,
      trigger_conditions ? JSON.stringify(trigger_conditions) : null,
      action_type,
      action_params ? JSON.stringify(action_params) : null,
      is_active !== false ? 1 : 0,
      req.params.id,
      req.orgId
    );

    const automation = await db.prepare('SELECT * FROM automations WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle automation active status
router.put('/:id/toggle', async (req, res) => {
  try {
    const current = await db.prepare('SELECT is_active FROM automations WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    if (!current) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    await db.prepare(`
      UPDATE automations SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?
    `).run(current.is_active ? 0 : 1, req.params.id, req.orgId);

    const automation = await db.prepare('SELECT * FROM automations WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    res.json(automation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete automation
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM automations WHERE id = ? AND organization_id = ?').run(req.params.id, req.orgId);
    res.json({ message: 'Automation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
