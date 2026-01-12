import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Helper function to generate slug
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
};

// ============================================
// SOP CATEGORIES
// ============================================

// Get all categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT sc.*,
        (SELECT COUNT(*) FROM sops WHERE category_id = sc.id) as sop_count
      FROM sop_categories sc
      ORDER BY sc.position ASC, sc.name ASC
    `).all();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create category
router.post('/categories', (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    // Get max position
    const maxPos = db.prepare('SELECT MAX(position) as max FROM sop_categories').get();
    const position = (maxPos.max || 0) + 1;

    const result = db.prepare(`
      INSERT INTO sop_categories (name, description, color, icon, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description, color || '#6366F1', icon || 'folder', position);

    const category = db.prepare('SELECT * FROM sop_categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update category
router.put('/categories/:id', (req, res) => {
  try {
    const { name, description, color, icon, position } = req.body;

    db.prepare(`
      UPDATE sop_categories
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          color = COALESCE(?, color),
          icon = COALESCE(?, icon),
          position = COALESCE(?, position)
      WHERE id = ?
    `).run(name, description, color, icon, position, req.params.id);

    const category = db.prepare('SELECT * FROM sop_categories WHERE id = ?').get(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category
router.delete('/categories/:id', (req, res) => {
  try {
    // Check if category has SOPs
    const sopCount = db.prepare('SELECT COUNT(*) as count FROM sops WHERE category_id = ?').get(req.params.id);
    if (sopCount.count > 0) {
      return res.status(400).json({
        error: `No se puede eliminar. Hay ${sopCount.count} SOP(s) en esta categoría.`
      });
    }

    const result = db.prepare('DELETE FROM sop_categories WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SOPs
// ============================================

// Get all SOPs (with filters)
router.get('/', (req, res) => {
  try {
    const { category_id, status, search } = req.query;
    let query = `
      SELECT s.*,
        sc.name as category_name,
        sc.color as category_color,
        tm.name as author_name
      FROM sops s
      LEFT JOIN sop_categories sc ON s.category_id = sc.id
      LEFT JOIN team_members tm ON s.created_by = tm.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND s.category_id = ?';
      params.push(category_id);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (s.title LIKE ? OR s.description LIKE ? OR s.content LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY s.is_pinned DESC, s.updated_at DESC';

    const sops = db.prepare(query).all(...params);
    res.json(sops);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get SOP by ID or slug
router.get('/:identifier', (req, res) => {
  try {
    const { identifier } = req.params;
    const isNumeric = /^\d+$/.test(identifier);

    let sop;
    if (isNumeric) {
      sop = db.prepare(`
        SELECT s.*,
          sc.name as category_name,
          sc.color as category_color,
          tm.name as author_name
        FROM sops s
        LEFT JOIN sop_categories sc ON s.category_id = sc.id
        LEFT JOIN team_members tm ON s.created_by = tm.id
        WHERE s.id = ?
      `).get(identifier);
    } else {
      sop = db.prepare(`
        SELECT s.*,
          sc.name as category_name,
          sc.color as category_color,
          tm.name as author_name
        FROM sops s
        LEFT JOIN sop_categories sc ON s.category_id = sc.id
        LEFT JOIN team_members tm ON s.created_by = tm.id
        WHERE s.slug = ?
      `).get(identifier);
    }

    if (!sop) {
      return res.status(404).json({ error: 'SOP no encontrado' });
    }

    // Increment view count
    db.prepare('UPDATE sops SET view_count = view_count + 1 WHERE id = ?').run(sop.id);

    res.json(sop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create SOP
router.post('/', (req, res) => {
  try {
    const { title, description, content, steps, editor_mode, category_id, created_by, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'El título es requerido' });
    }

    // Generate unique slug
    let slug = generateSlug(title);
    const existingSlug = db.prepare('SELECT id FROM sops WHERE slug = ?').get(slug);
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const result = db.prepare(`
      INSERT INTO sops (title, slug, description, content, steps, editor_mode, category_id, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, slug, description, content, steps, editor_mode || 'freeform', category_id, created_by, status || 'draft');

    const sop = db.prepare(`
      SELECT s.*,
        sc.name as category_name,
        sc.color as category_color,
        tm.name as author_name
      FROM sops s
      LEFT JOIN sop_categories sc ON s.category_id = sc.id
      LEFT JOIN team_members tm ON s.created_by = tm.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(sop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update SOP
router.put('/:id', (req, res) => {
  try {
    const { title, description, content, steps, editor_mode, category_id, status, is_pinned } = req.body;
    const { id } = req.params;

    // Get current SOP
    const currentSop = db.prepare('SELECT * FROM sops WHERE id = ?').get(id);
    if (!currentSop) {
      return res.status(404).json({ error: 'SOP no encontrado' });
    }

    // Save revision if content or steps changed
    const contentChanged = content && content !== currentSop.content;
    const stepsChanged = steps && steps !== currentSop.steps;
    if (contentChanged || stepsChanged) {
      db.prepare(`
        INSERT INTO sop_revisions (sop_id, content, version, changed_by, change_notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, currentSop.content || currentSop.steps, currentSop.version, req.body.changed_by, 'Actualización de contenido');
    }

    // Update slug if title changed
    let slug = currentSop.slug;
    if (title && title !== currentSop.title) {
      slug = generateSlug(title);
      const existingSlug = db.prepare('SELECT id FROM sops WHERE slug = ? AND id != ?').get(slug, id);
      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    // Update published_at if status changed to published
    let publishedAt = currentSop.published_at;
    if (status === 'published' && currentSop.status !== 'published') {
      publishedAt = new Date().toISOString();
    }

    db.prepare(`
      UPDATE sops
      SET title = COALESCE(?, title),
          slug = ?,
          description = COALESCE(?, description),
          content = COALESCE(?, content),
          steps = COALESCE(?, steps),
          editor_mode = COALESCE(?, editor_mode),
          category_id = COALESCE(?, category_id),
          status = COALESCE(?, status),
          is_pinned = COALESCE(?, is_pinned),
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP,
          published_at = ?
      WHERE id = ?
    `).run(title, slug, description, content, steps, editor_mode, category_id, status, is_pinned, publishedAt, id);

    const sop = db.prepare(`
      SELECT s.*,
        sc.name as category_name,
        sc.color as category_color,
        tm.name as author_name
      FROM sops s
      LEFT JOIN sop_categories sc ON s.category_id = sc.id
      LEFT JOIN team_members tm ON s.created_by = tm.id
      WHERE s.id = ?
    `).get(id);

    res.json(sop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle pin status
router.put('/:id/pin', (req, res) => {
  try {
    const sop = db.prepare('SELECT is_pinned FROM sops WHERE id = ?').get(req.params.id);
    if (!sop) {
      return res.status(404).json({ error: 'SOP no encontrado' });
    }

    db.prepare('UPDATE sops SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(sop.is_pinned ? 0 : 1, req.params.id);

    const updated = db.prepare('SELECT * FROM sops WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete SOP
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM sops WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'SOP no encontrado' });
    }
    res.json({ message: 'SOP eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get SOP revision history
router.get('/:id/revisions', (req, res) => {
  try {
    const revisions = db.prepare(`
      SELECT sr.*, tm.name as changed_by_name
      FROM sop_revisions sr
      LEFT JOIN team_members tm ON sr.changed_by = tm.id
      WHERE sr.sop_id = ?
      ORDER BY sr.version DESC
    `).all(req.params.id);

    res.json(revisions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
