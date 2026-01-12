import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all projects
router.get('/', (req, res) => {
  try {
    const { status, client_id } = req.query;
    let query = `
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (client_id) {
      query += ' AND p.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY p.created_at DESC';
    const projects = db.prepare(query).all(...params);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project by ID with team members
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare(`
      SELECT p.*, c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get team members assigned to this project
    const team = db.prepare(`
      SELECT tm.*, pt.role as project_role
      FROM team_members tm
      JOIN project_team pt ON tm.id = pt.team_member_id
      WHERE pt.project_id = ?
    `).all(req.params.id);

    project.team = team;
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new project
router.post('/', (req, res) => {
  try {
    const { name, description, client_id, status, budget, start_date, end_date } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = db.prepare(`
      INSERT INTO projects (name, description, client_id, status, budget, spent, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(name, description, client_id, status || 'planning', budget || 0, start_date, end_date);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const { name, description, client_id, status, budget, spent, start_date, end_date } = req.body;

    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, client_id = ?, status = ?,
          budget = ?, spent = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description, client_id, status, budget, spent, start_date, end_date, req.params.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign team member to project
router.post('/:id/team', (req, res) => {
  try {
    const { team_member_id, role } = req.body;

    db.prepare(`
      INSERT OR REPLACE INTO project_team (project_id, team_member_id, role)
      VALUES (?, ?, ?)
    `).run(req.params.id, team_member_id, role);

    res.json({ message: 'Team member assigned successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove team member from project
router.delete('/:id/team/:team_member_id', (req, res) => {
  try {
    db.prepare('DELETE FROM project_team WHERE project_id = ? AND team_member_id = ?')
      .run(req.params.id, req.params.team_member_id);
    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
