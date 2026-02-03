import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Global search endpoint
router.get('/', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ results: [], query: q });
    }

    const searchTerm = `%${q.trim()}%`;
    const resultLimit = Math.min(parseInt(limit) || 20, 50);

    // Search tasks
    const tasks = await db.prepare(`
      SELECT
        t.id, t.title as name, t.description, 'task' as type,
        t.status, t.priority, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.title LIKE ? OR t.description LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, resultLimit);

    // Search projects
    const projects = await db.prepare(`
      SELECT
        p.id, p.name, p.description, 'project' as type,
        p.status, c.company as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.name LIKE ? OR p.description LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, resultLimit);

    // Search clients
    const clients = await db.prepare(`
      SELECT
        id, name, company as secondary_name, 'client' as type,
        email, phone, status
      FROM clients
      WHERE name LIKE ? OR company LIKE ? OR email LIKE ? OR nit LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, searchTerm, searchTerm, resultLimit);

    // Search team members
    const team = await db.prepare(`
      SELECT
        id, name, email as secondary_name, 'team' as type,
        position, role, status
      FROM team_members
      WHERE name LIKE ? OR email LIKE ? OR position LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, searchTerm, resultLimit);

    // Search invoices
    const invoices = await db.prepare(`
      SELECT
        i.id, i.invoice_number as name, 'invoice' as type,
        i.amount, i.status, c.company as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.invoice_number LIKE ? OR i.notes LIKE ?
      LIMIT ?
    `).all(searchTerm, searchTerm, resultLimit);

    // Combine and format results
    const results = {
      tasks: tasks.map(t => ({
        ...t,
        icon: 'check-square',
        url: `/app/tasks?highlight=${t.id}`,
        subtitle: t.project_name || 'Sin proyecto'
      })),
      projects: projects.map(p => ({
        ...p,
        icon: 'folder-kanban',
        url: `/app/projects/${p.id}`,
        subtitle: p.client_name || 'Sin cliente'
      })),
      clients: clients.map(c => ({
        ...c,
        icon: 'users',
        url: `/app/clients?highlight=${c.id}`,
        subtitle: c.secondary_name || c.email || ''
      })),
      team: team.map(m => ({
        ...m,
        icon: 'user',
        url: `/app/team?highlight=${m.id}`,
        subtitle: m.position || m.role || ''
      })),
      invoices: invoices.map(i => ({
        ...i,
        icon: 'file-text',
        url: `/invoices?highlight=${i.id}`,
        subtitle: i.client_name ? `${i.client_name} - $${i.amount?.toLocaleString('es-CO')}` : `$${i.amount?.toLocaleString('es-CO')}`
      }))
    };

    const totalResults =
      results.tasks.length +
      results.projects.length +
      results.clients.length +
      results.team.length +
      results.invoices.length;

    res.json({
      query: q,
      totalResults,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quick search (returns flat list for autocomplete)
router.get('/quick', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    const resultLimit = Math.min(parseInt(limit) || 10, 20);

    // Combined search with UNION ALL
    const results = await db.prepare(`
      SELECT id, title as name, 'task' as type, status FROM tasks WHERE title LIKE ? LIMIT ?
      UNION ALL
      SELECT id, name, 'project' as type, status FROM projects WHERE name LIKE ? LIMIT ?
      UNION ALL
      SELECT id, COALESCE(company, name) as name, 'client' as type, status FROM clients WHERE name LIKE ? OR company LIKE ? LIMIT ?
      UNION ALL
      SELECT id, name, 'team' as type, status FROM team_members WHERE name LIKE ? LIMIT ?
    `).all(
      searchTerm, resultLimit,
      searchTerm, resultLimit,
      searchTerm, searchTerm, resultLimit,
      searchTerm, resultLimit
    );

    res.json(results.slice(0, resultLimit * 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
