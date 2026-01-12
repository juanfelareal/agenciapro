import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all notes with filters
router.get('/', (req, res) => {
  try {
    const { category_id, folder_id, pinned, search, client_id, project_id, team_member_id, limit = 50 } = req.query;

    let query = `
      SELECT DISTINCT n.*,
        nc.name as category_name,
        nc.color as category_color,
        nf.name as folder_name,
        nf.icon as folder_icon,
        tm.name as creator_name
      FROM notes n
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      LEFT JOIN note_folders nf ON n.folder_id = nf.id
      LEFT JOIN team_members tm ON n.created_by = tm.id
      LEFT JOIN note_links nl ON n.id = nl.note_id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND n.category_id = ?';
      params.push(category_id);
    }
    if (folder_id === 'null' || folder_id === 'root') {
      query += ' AND n.folder_id IS NULL';
    } else if (folder_id) {
      query += ' AND n.folder_id = ?';
      params.push(folder_id);
    }
    if (pinned === 'true') {
      query += ' AND n.is_pinned = 1';
    }
    if (search) {
      query += ' AND (n.title LIKE ? OR n.content_plain LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (client_id) {
      query += ' AND nl.client_id = ?';
      params.push(client_id);
    }
    if (project_id) {
      query += ' AND nl.project_id = ?';
      params.push(project_id);
    }
    if (team_member_id) {
      query += ' AND nl.team_member_id = ?';
      params.push(team_member_id);
    }

    query += ' ORDER BY n.is_pinned DESC, n.updated_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const notes = db.prepare(query).all(...params);

    // Get links for each note
    const notesWithLinks = notes.map(note => {
      const links = db.prepare(`
        SELECT nl.*,
          c.name as client_name,
          c.company as client_company,
          p.name as project_name,
          tm.name as member_name
        FROM note_links nl
        LEFT JOIN clients c ON nl.client_id = c.id
        LEFT JOIN projects p ON nl.project_id = p.id
        LEFT JOIN team_members tm ON nl.team_member_id = tm.id
        WHERE nl.note_id = ?
      `).all(note.id);
      return { ...note, links };
    });

    res.json(notesWithLinks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single note by ID
router.get('/:id', (req, res) => {
  try {
    const note = db.prepare(`
      SELECT n.*,
        nc.name as category_name,
        nc.color as category_color,
        tm.name as creator_name
      FROM notes n
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      LEFT JOIN team_members tm ON n.created_by = tm.id
      WHERE n.id = ?
    `).get(req.params.id);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Get links
    const links = db.prepare(`
      SELECT nl.*,
        c.name as client_name,
        c.company as client_company,
        p.name as project_name,
        tm.name as member_name
      FROM note_links nl
      LEFT JOIN clients c ON nl.client_id = c.id
      LEFT JOIN projects p ON nl.project_id = p.id
      LEFT JOIN team_members tm ON nl.team_member_id = tm.id
      WHERE nl.note_id = ?
    `).all(note.id);

    res.json({ ...note, links });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notes for specific client
router.get('/client/:clientId', (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT DISTINCT n.*,
        nc.name as category_name,
        nc.color as category_color,
        tm.name as creator_name
      FROM notes n
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      LEFT JOIN team_members tm ON n.created_by = tm.id
      INNER JOIN note_links nl ON n.id = nl.note_id
      WHERE nl.client_id = ?
      ORDER BY n.is_pinned DESC, n.updated_at DESC
    `).all(req.params.clientId);

    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notes for specific project
router.get('/project/:projectId', (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT DISTINCT n.*,
        nc.name as category_name,
        nc.color as category_color,
        tm.name as creator_name
      FROM notes n
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      LEFT JOIN team_members tm ON n.created_by = tm.id
      INNER JOIN note_links nl ON n.id = nl.note_id
      WHERE nl.project_id = ?
      ORDER BY n.is_pinned DESC, n.updated_at DESC
    `).all(req.params.projectId);

    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notes for specific team member
router.get('/team/:memberId', (req, res) => {
  try {
    const notes = db.prepare(`
      SELECT DISTINCT n.*,
        nc.name as category_name,
        nc.color as category_color,
        tm.name as creator_name
      FROM notes n
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      LEFT JOIN team_members tm ON n.created_by = tm.id
      INNER JOIN note_links nl ON n.id = nl.note_id
      WHERE nl.team_member_id = ?
      ORDER BY n.is_pinned DESC, n.updated_at DESC
    `).all(req.params.memberId);

    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create note
router.post('/', (req, res) => {
  try {
    const { title, content, content_plain, color, category_id, folder_id, is_pinned, created_by, links } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = db.prepare(`
      INSERT INTO notes (title, content, content_plain, color, category_id, folder_id, is_pinned, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      content ? JSON.stringify(content) : null,
      content_plain || '',
      color || '#FFFFFF',
      category_id || null,
      folder_id || null,
      is_pinned ? 1 : 0,
      created_by || null
    );

    const noteId = result.lastInsertRowid;

    // Add links if provided
    if (links && Array.isArray(links)) {
      const linkStmt = db.prepare(`
        INSERT INTO note_links (note_id, client_id, project_id, team_member_id)
        VALUES (?, ?, ?, ?)
      `);
      links.forEach(link => {
        if (link.client_id || link.project_id || link.team_member_id) {
          linkStmt.run(noteId, link.client_id || null, link.project_id || null, link.team_member_id || null);
        }
      });
    }

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update note
router.put('/:id', (req, res) => {
  try {
    const { title, content, content_plain, color, category_id, folder_id, is_pinned, links } = req.body;

    db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, content_plain = ?, color = ?,
          category_id = ?, folder_id = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title,
      content ? JSON.stringify(content) : null,
      content_plain || '',
      color || '#FFFFFF',
      category_id || null,
      folder_id || null,
      is_pinned ? 1 : 0,
      req.params.id
    );

    // Update links if provided
    if (links !== undefined) {
      // Remove existing links
      db.prepare('DELETE FROM note_links WHERE note_id = ?').run(req.params.id);

      // Add new links
      if (Array.isArray(links)) {
        const linkStmt = db.prepare(`
          INSERT INTO note_links (note_id, client_id, project_id, team_member_id)
          VALUES (?, ?, ?, ?)
        `);
        links.forEach(link => {
          if (link.client_id || link.project_id || link.team_member_id) {
            linkStmt.run(req.params.id, link.client_id || null, link.project_id || null, link.team_member_id || null);
          }
        });
      }
    }

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle pin status
router.put('/:id/pin', (req, res) => {
  try {
    const current = db.prepare('SELECT is_pinned FROM notes WHERE id = ?').get(req.params.id);
    if (!current) {
      return res.status(404).json({ error: 'Note not found' });
    }

    db.prepare(`
      UPDATE notes SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(current.is_pinned ? 0 : 1, req.params.id);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update note color
router.put('/:id/color', (req, res) => {
  try {
    const { color } = req.body;

    db.prepare(`
      UPDATE notes SET color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(color || '#FFFFFF', req.params.id);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add link to note
router.post('/:id/links', (req, res) => {
  try {
    const { client_id, project_id, team_member_id } = req.body;

    if (!client_id && !project_id && !team_member_id) {
      return res.status(400).json({ error: 'At least one entity ID is required' });
    }

    const result = db.prepare(`
      INSERT INTO note_links (note_id, client_id, project_id, team_member_id)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, client_id || null, project_id || null, team_member_id || null);

    const link = db.prepare('SELECT * FROM note_links WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(link);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove link from note
router.delete('/:id/links/:linkId', (req, res) => {
  try {
    db.prepare('DELETE FROM note_links WHERE id = ? AND note_id = ?').run(req.params.linkId, req.params.id);
    res.json({ message: 'Link removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete note
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search notes
router.get('/search/query', (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.json([]);
    }

    const notes = db.prepare(`
      SELECT n.*,
        nc.name as category_name,
        nc.color as category_color,
        tm.name as creator_name
      FROM notes n
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      LEFT JOIN team_members tm ON n.created_by = tm.id
      WHERE n.title LIKE ? OR n.content_plain LIKE ?
      ORDER BY n.is_pinned DESC, n.updated_at DESC
      LIMIT ?
    `).all(`%${q}%`, `%${q}%`, parseInt(limit));

    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
