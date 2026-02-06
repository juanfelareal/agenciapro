import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all projects
router.get('/', async (req, res) => {
  try {
    const { status, client_id } = req.query;
    let query = `
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.organization_id = ?
    `;
    const params = [req.orgId];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (client_id) {
      query += ' AND p.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY p.created_at DESC';
    const projects = await db.all(query, params);
    res.json(projects);
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get project by ID with team members
router.get('/:id', async (req, res) => {
  try {
    const project = await db.get(`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ? AND p.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get team members assigned to this project
    const team = await db.all(`
      SELECT tm.*, pt.role as project_role
      FROM team_members tm
      JOIN project_team pt ON tm.id = pt.team_member_id
      WHERE pt.project_id = ?
    `, [req.params.id]);

    project.team = team;
    res.json(project);
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new project (client is optional)
router.post('/', async (req, res) => {
  try {
    const { name, description, client_id, status, budget, start_date, end_date } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Verify client belongs to the same organization (if provided)
    if (client_id) {
      const client = await db.get(
        'SELECT id FROM clients WHERE id = ? AND organization_id = ?',
        [client_id, req.orgId]
      );
      if (!client) {
        return res.status(400).json({ error: 'Client not found in your organization' });
      }
    }

    const result = await db.run(`
      INSERT INTO projects (name, description, client_id, status, budget, spent, start_date, end_date, organization_id)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `, [name, description || null, client_id || null, status || 'planning', budget || 0, start_date || null, end_date || null, req.orgId]);

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const { name, description, client_id, status, budget, spent, start_date, end_date } = req.body;

    // Verify project belongs to this organization
    const existing = await db.get(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify client belongs to the same organization (if provided)
    if (client_id) {
      const client = await db.get(
        'SELECT id FROM clients WHERE id = ? AND organization_id = ?',
        [client_id, req.orgId]
      );
      if (!client) {
        return res.status(400).json({ error: 'Client not found in your organization' });
      }
    }

    await db.run(`
      UPDATE projects
      SET name = ?, description = ?, client_id = ?, status = ?,
          budget = ?, spent = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [name, description || null, client_id || null, status, budget, spent, start_date || null, end_date || null, req.params.id, req.orgId]);

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign team member to project
router.post('/:id/team', async (req, res) => {
  try {
    const { team_member_id, role } = req.body;

    // Verify project belongs to this organization
    const project = await db.get(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify team member belongs to the same organization
    const member = await db.get(
      'SELECT id FROM team_members WHERE id = ? AND organization_id = ?',
      [team_member_id, req.orgId]
    );
    if (!member) {
      return res.status(400).json({ error: 'Team member not found in your organization' });
    }

    await db.run(`
      INSERT INTO project_team (project_id, team_member_id, role, organization_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (project_id, team_member_id) DO UPDATE SET role = EXCLUDED.role
    `, [req.params.id, team_member_id, role, req.orgId]);

    res.json({ message: 'Team member assigned successfully' });
  } catch (error) {
    console.error('Error assigning team member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove team member from project
router.delete('/:id/team/:team_member_id', async (req, res) => {
  try {
    // Verify project belongs to this organization
    const project = await db.get(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await db.run('DELETE FROM project_team WHERE project_id = ? AND team_member_id = ?',
      [req.params.id, req.params.team_member_id]);
    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM projects WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
