import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all team members
router.get('/', (req, res) => {
  try {
    const { status, role } = req.query;
    let query = 'SELECT * FROM team_members WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    query += ' ORDER BY created_at DESC';
    const members = db.prepare(query).all(...params);
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get team member by ID
router.get('/:id', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Get assigned projects
    const projects = db.prepare(`
      SELECT p.*, pt.role as project_role
      FROM projects p
      JOIN project_team pt ON p.id = pt.project_id
      WHERE pt.team_member_id = ?
    `).all(req.params.id);

    member.projects = projects;
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new team member
router.post('/', (req, res) => {
  try {
    const { name, email, role, position, status, hire_date, birthday, permissions } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const result = db.prepare(`
      INSERT INTO team_members (name, email, role, position, status, hire_date, birthday, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      email,
      role || 'member',
      position,
      status || 'active',
      hire_date,
      birthday,
      permissions ? JSON.stringify(permissions) : null
    );

    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(member);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update team member
router.put('/:id', (req, res) => {
  try {
    const { name, email, role, position, status, hire_date, birthday, permissions } = req.body;

    db.prepare(`
      UPDATE team_members
      SET name = ?, email = ?, role = ?, position = ?, status = ?,
          hire_date = ?, birthday = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      email,
      role,
      position,
      status,
      hire_date,
      birthday,
      permissions ? JSON.stringify(permissions) : null,
      req.params.id
    );

    const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
    res.json(member);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete team member
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM team_members WHERE id = ?').run(req.params.id);
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
