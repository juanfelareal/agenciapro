import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all folders (with hierarchy)
router.get('/', (req, res) => {
  try {
    const folders = db.prepare(`
      SELECT nf.*,
        (SELECT COUNT(*) FROM notes WHERE folder_id = nf.id) as note_count,
        (SELECT COUNT(*) FROM note_folders WHERE parent_id = nf.id) as subfolder_count
      FROM note_folders nf
      ORDER BY nf.position ASC, nf.name ASC
    `).all();

    // Build tree structure
    const buildTree = (parentId = null) => {
      return folders
        .filter(f => f.parent_id === parentId)
        .map(folder => ({
          ...folder,
          children: buildTree(folder.id)
        }));
    };

    res.json(buildTree());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get flat list of all folders (for dropdown selects)
router.get('/flat', (req, res) => {
  try {
    const folders = db.prepare(`
      SELECT nf.*,
        (SELECT COUNT(*) FROM notes WHERE folder_id = nf.id) as note_count
      FROM note_folders nf
      ORDER BY nf.position ASC, nf.name ASC
    `).all();

    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single folder by ID
router.get('/:id', (req, res) => {
  try {
    const folder = db.prepare(`
      SELECT nf.*,
        (SELECT COUNT(*) FROM notes WHERE folder_id = nf.id) as note_count,
        (SELECT COUNT(*) FROM note_folders WHERE parent_id = nf.id) as subfolder_count
      FROM note_folders nf
      WHERE nf.id = ?
    `).get(req.params.id);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Get subfolders
    const subfolders = db.prepare(`
      SELECT * FROM note_folders WHERE parent_id = ? ORDER BY position ASC, name ASC
    `).all(req.params.id);

    // Get notes in folder
    const notes = db.prepare(`
      SELECT n.*,
        nc.name as category_name,
        nc.color as category_color
      FROM notes n
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      WHERE n.folder_id = ?
      ORDER BY n.is_pinned DESC, n.updated_at DESC
    `).all(req.params.id);

    res.json({ ...folder, subfolders, notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create folder
router.post('/', (req, res) => {
  try {
    const { name, parent_id, icon, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Get next position
    const maxPosition = db.prepare(`
      SELECT MAX(position) as max FROM note_folders WHERE parent_id ${parent_id ? '= ?' : 'IS NULL'}
    `).get(parent_id || undefined);

    const position = (maxPosition?.max || 0) + 1;

    const result = db.prepare(`
      INSERT INTO note_folders (name, parent_id, icon, color, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, parent_id || null, icon || '📁', color || '#6366F1', position);

    const folder = db.prepare('SELECT * FROM note_folders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update folder
router.put('/:id', (req, res) => {
  try {
    const { name, parent_id, icon, color, position } = req.body;

    // Prevent folder from being its own parent
    if (parent_id && parseInt(parent_id) === parseInt(req.params.id)) {
      return res.status(400).json({ error: 'Folder cannot be its own parent' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      params.push(parent_id || null);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(icon);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }
    if (position !== undefined) {
      updates.push('position = ?');
      params.push(position);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    db.prepare(`UPDATE note_folders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const folder = db.prepare('SELECT * FROM note_folders WHERE id = ?').get(req.params.id);
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete folder (moves notes to parent or root)
router.delete('/:id', (req, res) => {
  try {
    const folder = db.prepare('SELECT * FROM note_folders WHERE id = ?').get(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Move notes to parent folder (or null for root)
    db.prepare('UPDATE notes SET folder_id = ? WHERE folder_id = ?').run(folder.parent_id, req.params.id);

    // Move subfolders to parent folder
    db.prepare('UPDATE note_folders SET parent_id = ? WHERE parent_id = ?').run(folder.parent_id, req.params.id);

    // Delete folder
    db.prepare('DELETE FROM note_folders WHERE id = ?').run(req.params.id);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder folders
router.put('/reorder', (req, res) => {
  try {
    const { folders } = req.body; // Array of { id, position, parent_id }

    if (!Array.isArray(folders)) {
      return res.status(400).json({ error: 'Folders array is required' });
    }

    const updateStmt = db.prepare(`
      UPDATE note_folders SET position = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);

    db.transaction(() => {
      folders.forEach(({ id, position, parent_id }) => {
        updateStmt.run(position, parent_id || null, id);
      });
    })();

    res.json({ message: 'Folders reordered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
