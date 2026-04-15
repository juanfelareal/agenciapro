import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/notes/:noteId
 * Get a specific note with comments (portal client)
 */
router.get('/:noteId', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { noteId } = req.params;

    // Verify this note is linked to this client and visible in portal
    const note = await db.get(`
      SELECT n.id, n.title, n.content, n.content_plain, n.color, n.updated_at,
        nc.name as category_name, nc.color as category_color
      FROM notes n
      INNER JOIN note_links nl ON n.id = nl.note_id
      LEFT JOIN note_categories nc ON n.category_id = nc.id
      WHERE n.id = ? AND nl.client_id = ? AND nl.visible_in_portal = 1
    `, [noteId, clientId]);

    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    // Get comments for this note
    const comments = await db.all(`
      SELECT id, parent_id, author_name, author_type, content, quoted_text,
        tab_context, is_resolved, created_at
      FROM note_comments
      WHERE note_id = ?
      ORDER BY created_at ASC
    `, [noteId]);

    res.json({ note, comments });
  } catch (error) {
    console.error('Error fetching portal note:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/portal/notes/:noteId/comments
 * Add a comment to a note (from portal client)
 */
router.post('/:noteId/comments', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { noteId } = req.params;
    const { author_name, content, tab_context, parent_id, quoted_text } = req.body;

    if (!author_name || !content) {
      return res.status(400).json({ error: 'Nombre y comentario son requeridos' });
    }

    // Verify note is linked to this client
    const note = await db.get(`
      SELECT n.id, n.organization_id
      FROM notes n
      INNER JOIN note_links nl ON n.id = nl.note_id
      WHERE n.id = ? AND nl.client_id = ? AND nl.visible_in_portal = 1
    `, [noteId, clientId]);

    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const result = await db.run(`
      INSERT INTO note_comments (note_id, author_name, author_type, content, tab_context, parent_id, quoted_text, organization_id)
      VALUES (?, ?, 'client', ?, ?, ?, ?, ?)
    `, [noteId, author_name, content, tab_context || null, parent_id || null, quoted_text || null, note.organization_id]);

    const comment = await db.get('SELECT * FROM note_comments WHERE id = ?', [result.lastInsertRowid || result.id]);

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating portal comment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/portal/notes/:noteId/comments/:commentId
 * Edit a comment (only client-authored comments)
 */
router.put('/:noteId/comments/:commentId', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { noteId, commentId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'El comentario no puede estar vacío' });
    }

    // Verify note belongs to client
    const note = await db.get(`
      SELECT n.id FROM notes n
      INNER JOIN note_links nl ON n.id = nl.note_id
      WHERE n.id = ? AND nl.client_id = ? AND nl.visible_in_portal = 1
    `, [noteId, clientId]);

    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    // Verify comment exists, belongs to this note, and is client-authored
    const comment = await db.get(
      `SELECT id FROM note_comments WHERE id = ? AND note_id = ? AND author_type = 'client'`,
      [commentId, noteId]
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    await db.run('UPDATE note_comments SET content = ? WHERE id = ?', [content.trim(), commentId]);
    const updated = await db.get('SELECT * FROM note_comments WHERE id = ?', [commentId]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating portal comment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/portal/notes/:noteId/comments/:commentId
 * Delete a comment (only client-authored comments)
 */
router.delete('/:noteId/comments/:commentId', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { noteId, commentId } = req.params;

    // Verify note belongs to client
    const note = await db.get(`
      SELECT n.id FROM notes n
      INNER JOIN note_links nl ON n.id = nl.note_id
      WHERE n.id = ? AND nl.client_id = ? AND nl.visible_in_portal = 1
    `, [noteId, clientId]);

    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    // Verify comment exists, belongs to this note, and is client-authored
    const comment = await db.get(
      `SELECT id FROM note_comments WHERE id = ? AND note_id = ? AND author_type = 'client'`,
      [commentId, noteId]
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    await db.run('DELETE FROM note_comments WHERE id = ?', [commentId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting portal comment:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
