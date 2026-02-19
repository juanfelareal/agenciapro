import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import { teamAuthMiddleware } from '../middleware/teamAuth.js';

const router = express.Router();

// Generate a readable share code (like ABC1-XY23)
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, 1, I, L
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

// ========================================
// AUTHENTICATED ROUTES (Team members)
// ========================================

// Generate share token for a note
router.post('/:id/share', teamAuthMiddleware, async (req, res) => {
  try {
    const { allow_comments = true, allow_edits = false, expires_in_days } = req.body;

    // Verify note exists and belongs to this org
    const note = await db.get(
      'SELECT * FROM notes WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );

    if (!note) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    // Don't allow sharing private notes
    if (note.visibility === 'private') {
      return res.status(400).json({ error: 'No se pueden compartir notas privadas' });
    }

    // Generate unique token
    let token;
    let attempts = 0;
    while (attempts < 10) {
      token = generateShareCode();
      const existing = await db.get('SELECT id FROM note_share_tokens WHERE token = ?', [token]);
      if (!existing) break;
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Error generando código único' });
    }

    // Calculate expiration if provided
    let expiresAt = null;
    if (expires_in_days) {
      const date = new Date();
      date.setDate(date.getDate() + parseInt(expires_in_days));
      expiresAt = date.toISOString();
    }

    // Create token
    const result = await db.run(`
      INSERT INTO note_share_tokens (note_id, token, allow_comments, allow_edits, created_by, expires_at, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      req.params.id,
      token,
      allow_comments ? 1 : 0,
      allow_edits ? 1 : 0,
      req.teamMember.id,
      expiresAt,
      req.orgId
    ]);

    const shareToken = await db.get('SELECT * FROM note_share_tokens WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      ...shareToken,
      share_url: `/share/${token}`
    });
  } catch (error) {
    console.error('Error creating share token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all share tokens for a note
router.get('/:id/shares', teamAuthMiddleware, async (req, res) => {
  try {
    const tokens = await db.all(`
      SELECT nst.*, tm.name as created_by_name
      FROM note_share_tokens nst
      LEFT JOIN team_members tm ON nst.created_by = tm.id
      WHERE nst.note_id = ? AND nst.organization_id = ?
      ORDER BY nst.created_at DESC
    `, [req.params.id, req.orgId]);

    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revoke a share token
router.delete('/:id/share/:tokenId', teamAuthMiddleware, async (req, res) => {
  try {
    await db.run(`
      UPDATE note_share_tokens
      SET status = 'revoked'
      WHERE id = ? AND note_id = ? AND organization_id = ?
    `, [req.params.tokenId, req.params.id, req.orgId]);

    res.json({ message: 'Enlace revocado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comments for a note (internal view)
router.get('/:id/comments', teamAuthMiddleware, async (req, res) => {
  try {
    const comments = await db.all(`
      SELECT nc.*, tm.name as resolved_by_name
      FROM note_comments nc
      LEFT JOIN team_members tm ON nc.resolved_by = tm.id
      WHERE nc.note_id = ? AND nc.organization_id = ?
      ORDER BY nc.created_at DESC
    `, [req.params.id, req.orgId]);

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve a comment
router.put('/:id/comments/:commentId/resolve', teamAuthMiddleware, async (req, res) => {
  try {
    await db.run(`
      UPDATE note_comments
      SET is_resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ? AND note_id = ? AND organization_id = ?
    `, [req.teamMember.id, req.params.commentId, req.params.id, req.orgId]);

    res.json({ message: 'Comentario resuelto' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unresolve a comment
router.put('/:id/comments/:commentId/unresolve', teamAuthMiddleware, async (req, res) => {
  try {
    await db.run(`
      UPDATE note_comments
      SET is_resolved = 0, resolved_by = NULL, resolved_at = NULL
      WHERE id = ? AND note_id = ? AND organization_id = ?
    `, [req.params.commentId, req.params.id, req.orgId]);

    res.json({ message: 'Comentario reabierto' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reply to a comment (team members)
router.post('/:id/comments/:commentId/reply', teamAuthMiddleware, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Contenido es requerido' });
    }

    // Verify the parent comment exists and belongs to this note/org
    const parentComment = await db.get(`
      SELECT * FROM note_comments
      WHERE id = ? AND note_id = ? AND organization_id = ?
    `, [req.params.commentId, req.params.id, req.orgId]);

    if (!parentComment) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    const result = await db.run(`
      INSERT INTO note_comments (note_id, parent_id, author_name, author_type, content, organization_id)
      VALUES (?, ?, ?, 'team', ?, ?)
    `, [
      req.params.id,
      req.params.commentId,
      req.teamMember.name,
      content,
      req.orgId
    ]);

    const reply = await db.get('SELECT * FROM note_comments WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get client edits for a note
router.get('/:id/edits', teamAuthMiddleware, async (req, res) => {
  try {
    const edits = await db.all(`
      SELECT nce.*, tm.name as reviewed_by_name
      FROM note_client_edits nce
      LEFT JOIN team_members tm ON nce.reviewed_by = tm.id
      WHERE nce.note_id = ? AND nce.organization_id = ?
      ORDER BY nce.created_at DESC
    `, [req.params.id, req.orgId]);

    res.json(edits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept or reject a client edit
router.put('/:id/edits/:editId', teamAuthMiddleware, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "accepted" or "rejected"' });
    }

    await db.run(`
      UPDATE note_client_edits
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND note_id = ? AND organization_id = ?
    `, [action, req.teamMember.id, req.params.editId, req.params.id, req.orgId]);

    res.json({ message: action === 'accepted' ? 'Edición aceptada' : 'Edición rechazada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PUBLIC ROUTES (No authentication)
// ========================================

// Get note by share token (public)
router.get('/public/:token', async (req, res) => {
  try {
    // Find the share token
    const shareToken = await db.get(`
      SELECT nst.*, n.title, n.content, n.content_plain, n.color
      FROM note_share_tokens nst
      JOIN notes n ON nst.note_id = n.id
      WHERE nst.token = ? AND nst.status = 'active'
    `, [req.params.token]);

    if (!shareToken) {
      return res.status(404).json({ error: 'Enlace no válido o expirado' });
    }

    // Check expiration
    if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }

    // Update access count and last accessed
    await db.run(`
      UPDATE note_share_tokens
      SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [shareToken.id]);

    // Get comments for this note
    const comments = await db.all(`
      SELECT * FROM note_comments
      WHERE note_id = ? AND share_token_id = ?
      ORDER BY created_at DESC
    `, [shareToken.note_id, shareToken.id]);

    res.json({
      note: {
        id: shareToken.note_id,
        title: shareToken.title,
        content: shareToken.content,
        content_plain: shareToken.content_plain,
        color: shareToken.color
      },
      permissions: {
        allow_comments: shareToken.allow_comments === 1,
        allow_edits: shareToken.allow_edits === 1
      },
      comments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment via public link (supports replies with parent_id)
router.post('/public/:token/comments', async (req, res) => {
  try {
    const { author_name, content, selection_from, selection_to, quoted_text, parent_id } = req.body;

    if (!author_name || !content) {
      return res.status(400).json({ error: 'Nombre y contenido son requeridos' });
    }

    // Find the share token
    const shareToken = await db.get(`
      SELECT * FROM note_share_tokens
      WHERE token = ? AND status = 'active'
    `, [req.params.token]);

    if (!shareToken) {
      return res.status(404).json({ error: 'Enlace no válido' });
    }

    if (!shareToken.allow_comments) {
      return res.status(403).json({ error: 'Los comentarios no están habilitados' });
    }

    // Check expiration
    if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }

    const result = await db.run(`
      INSERT INTO note_comments (note_id, share_token_id, parent_id, author_name, author_type, content, selection_from, selection_to, quoted_text, organization_id)
      VALUES (?, ?, ?, ?, 'client', ?, ?, ?, ?, ?)
    `, [
      shareToken.note_id,
      shareToken.id,
      parent_id || null,
      author_name,
      content,
      selection_from || null,
      selection_to || null,
      quoted_text || null,
      shareToken.organization_id
    ]);

    const comment = await db.get('SELECT * FROM note_comments WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comments via public link
router.get('/public/:token/comments', async (req, res) => {
  try {
    const shareToken = await db.get(`
      SELECT * FROM note_share_tokens
      WHERE token = ? AND status = 'active'
    `, [req.params.token]);

    if (!shareToken) {
      return res.status(404).json({ error: 'Enlace no válido' });
    }

    const comments = await db.all(`
      SELECT * FROM note_comments
      WHERE note_id = ?
      ORDER BY created_at DESC
    `, [shareToken.note_id]);

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save client edit via public link
router.post('/public/:token/edits', async (req, res) => {
  try {
    const { author_name, content_json } = req.body;

    if (!author_name || !content_json) {
      return res.status(400).json({ error: 'Nombre y contenido son requeridos' });
    }

    // Find the share token
    const shareToken = await db.get(`
      SELECT * FROM note_share_tokens
      WHERE token = ? AND status = 'active'
    `, [req.params.token]);

    if (!shareToken) {
      return res.status(404).json({ error: 'Enlace no válido' });
    }

    if (!shareToken.allow_edits) {
      return res.status(403).json({ error: 'Las ediciones no están habilitadas' });
    }

    // Check expiration
    if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado' });
    }

    const result = await db.run(`
      INSERT INTO note_client_edits (note_id, share_token_id, author_name, content_json, organization_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      shareToken.note_id,
      shareToken.id,
      author_name,
      typeof content_json === 'string' ? content_json : JSON.stringify(content_json),
      shareToken.organization_id
    ]);

    const edit = await db.get('SELECT * FROM note_client_edits WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(edit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
