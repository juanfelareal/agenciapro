import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { uploadBuffer } from '../utils/blobStorage.js';

/**
 * Mejoras de Orbit: tablero interno donde el equipo registra sugerencias,
 * errores, ideas y preguntas sobre la app, con pantallazos, votos y comentarios.
 *
 * Montado en /api/orbit-feedback detrás de teamAuthMiddleware
 * (req.teamMember = { id, name, email, role }, req.orgId = organización).
 */
const router = express.Router();

export const CATEGORIES = ['mejora', 'error', 'idea', 'pregunta'];
export const STATUSES = ['nueva', 'en_revision', 'en_progreso', 'hecha', 'descartada'];
export const PRIORITIES = ['alta', 'media', 'baja'];
const CLOSED_STATUSES = ['hecha', 'descartada'];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_MIMES.includes((file.mimetype || '').toLowerCase())) {
      const err = new Error('Solo se permiten imágenes PNG, JPG, WEBP o GIF');
      err.code = 'INVALID_IMAGE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

// ─── Helpers ───
const isManager = (req) => ['admin', 'manager'].includes(req.teamMember?.role);
const isAdmin = (req) => req.teamMember?.role === 'admin';

const parseJson = (v, fallback = []) => {
  if (Array.isArray(v)) return v;
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

// Lista de URLs de imágenes saneada (solo strings http/https, máx 12)
const cleanImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
    .map((u) => u.trim())
    .slice(0, 12);
};

const cleanText = (v, max) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
};

const SELECT_FEEDBACK = `
  SELECT f.*,
         tm.name AS created_by_name,
         tm.email AS created_by_email,
         (SELECT COUNT(*) FROM orbit_feedback_comments c WHERE c.feedback_id = f.id)::int AS comments_count,
         (SELECT COUNT(*) FROM orbit_feedback_votes v WHERE v.feedback_id = f.id)::int AS vote_count,
         EXISTS (SELECT 1 FROM orbit_feedback_votes v WHERE v.feedback_id = f.id AND v.team_member_id = ?) AS has_voted
  FROM orbit_feedback f
  LEFT JOIN team_members tm ON tm.id = f.created_by
`;

const serializeFeedback = (row) => ({
  ...row,
  images: parseJson(row.images),
  has_voted: !!row.has_voted,
  votes: parseInt(row.vote_count) || 0,
  comments_count: parseInt(row.comments_count) || 0,
});

const serializeComment = (row) => ({
  ...row,
  images: parseJson(row.images),
});

const loadFeedback = async (id, req) => {
  const row = await db.get(`${SELECT_FEEDBACK} WHERE f.id = ? AND f.organization_id = ?`, [req.teamMember.id, id, req.orgId]);
  return row ? serializeFeedback(row) : null;
};

const findOwned = async (id, req) =>
  db.get('SELECT * FROM orbit_feedback WHERE id = ? AND organization_id = ?', [id, req.orgId]);

// ─── GET /summary — conteo por estado (para badges) ───
// Debe declararse antes de '/:id'
router.get('/summary', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT status, COUNT(*)::int AS count FROM orbit_feedback WHERE organization_id = ? GROUP BY status`,
      [req.orgId]
    );
    const summary = { total: 0 };
    for (const s of STATUSES) summary[s] = 0;
    for (const r of rows) {
      summary[r.status] = parseInt(r.count) || 0;
      summary.total += parseInt(r.count) || 0;
    }
    res.json(summary);
  } catch (error) {
    console.error('Error loading orbit feedback summary:', error);
    res.status(500).json({ error: 'No se pudo cargar el resumen de mejoras' });
  }
});

// ─── POST /upload — sube un pantallazo y devuelve { url } ───
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'La imagen supera el máximo de 8 MB' });
        if (err.code === 'INVALID_IMAGE_TYPE') return res.status(400).json({ error: err.message });
        console.error('Error receiving orbit feedback image:', err);
        return res.status(400).json({ error: 'No se pudo recibir la imagen' });
      }
      if (!req.file) return res.status(400).json({ error: 'Imagen requerida (campo "file")' });

      const blob = await uploadBuffer('orbit-feedback', req.file);
      res.status(201).json({ url: blob.url });
    } catch (error) {
      console.error('Error uploading orbit feedback image:', error);
      res.status(500).json({ error: 'No se pudo subir la imagen' });
    }
  });
});

// ─── GET / — lista con filtros ───
router.get('/', async (req, res) => {
  try {
    const { status, category, search, mine } = req.query;
    const params = [req.teamMember.id, req.orgId];
    let where = 'f.organization_id = ?';

    if (status && STATUSES.includes(status)) { where += ' AND f.status = ?'; params.push(status); }
    if (category && CATEGORIES.includes(category)) { where += ' AND f.category = ?'; params.push(category); }
    if (mine === '1' || mine === 'true') { where += ' AND f.created_by = ?'; params.push(req.teamMember.id); }
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      where += ' AND (f.title ILIKE ? OR f.body ILIKE ? OR f.page ILIKE ?)';
      params.push(term, term, term);
    }

    const rows = await db.all(`
      ${SELECT_FEEDBACK}
      WHERE ${where}
      ORDER BY
        CASE f.status WHEN 'nueva' THEN 0 WHEN 'en_revision' THEN 1 WHEN 'en_progreso' THEN 1 ELSE 2 END ASC,
        vote_count DESC,
        f.created_at DESC,
        f.id DESC
      LIMIT 500
    `, params);

    res.json(rows.map(serializeFeedback));
  } catch (error) {
    console.error('Error loading orbit feedback:', error);
    res.status(500).json({ error: 'No se pudieron cargar las mejoras' });
  }
});

// ─── POST / — crear sugerencia ───
router.post('/', async (req, res) => {
  try {
    const { title, body, category, priority, page, images } = req.body || {};
    const cleanTitle = cleanText(title, 200);
    if (!cleanTitle) return res.status(400).json({ error: 'El título es requerido' });

    const cat = CATEGORIES.includes(category) ? category : 'mejora';
    const prio = PRIORITIES.includes(priority) ? priority : 'media';

    const result = await db.run(`
      INSERT INTO orbit_feedback (organization_id, created_by, title, body, category, priority, page, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.orgId, req.teamMember.id, cleanTitle, cleanText(body, 10000), cat, prio,
      cleanText(page, 120), JSON.stringify(cleanImages(images)),
    ]);

    res.status(201).json(await loadFeedback(result.lastInsertRowid, req));
  } catch (error) {
    console.error('Error creating orbit feedback:', error);
    res.status(500).json({ error: 'No se pudo guardar la sugerencia' });
  }
});

// ─── GET /:id — detalle ───
router.get('/:id', async (req, res) => {
  try {
    const item = await loadFeedback(req.params.id, req);
    if (!item) return res.status(404).json({ error: 'Sugerencia no encontrada' });
    res.json(item);
  } catch (error) {
    console.error('Error loading orbit feedback item:', error);
    res.status(500).json({ error: 'No se pudo cargar la sugerencia' });
  }
});

// ─── PUT /:id — editar (autor) / cambiar estado (admin o manager) ───
router.put('/:id', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Sugerencia no encontrada' });

    const b = req.body || {};
    const isAuthor = existing.created_by === req.teamMember.id;
    const canModerate = isManager(req);

    const contentKeys = ['title', 'body', 'category', 'priority', 'page', 'images'];
    const touchesContent = contentKeys.some((k) => b[k] !== undefined);
    const touchesStatus = b.status !== undefined;

    if (!touchesContent && !touchesStatus) return res.status(400).json({ error: 'Nada que actualizar' });
    if (touchesContent && !isAuthor && !isAdmin(req)) {
      return res.status(403).json({ error: 'Solo quien creó la sugerencia puede editarla' });
    }
    if (touchesStatus && !canModerate) {
      return res.status(403).json({ error: 'Solo admins o managers pueden cambiar el estado' });
    }

    let title = existing.title;
    if (b.title !== undefined) {
      title = cleanText(b.title, 200);
      if (!title) return res.status(400).json({ error: 'El título es requerido' });
    }
    const body = b.body !== undefined ? cleanText(b.body, 10000) : existing.body;
    const category = b.category !== undefined ? (CATEGORIES.includes(b.category) ? b.category : existing.category) : existing.category;
    const priority = b.priority !== undefined ? (PRIORITIES.includes(b.priority) ? b.priority : existing.priority) : existing.priority;
    const page = b.page !== undefined ? cleanText(b.page, 120) : existing.page;
    const images = b.images !== undefined ? cleanImages(b.images) : parseJson(existing.images);

    let status = existing.status;
    let resolvedAt = existing.resolved_at;
    if (touchesStatus) {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Estado inválido' });
      status = b.status;
      if (status !== existing.status) {
        resolvedAt = status === 'hecha' ? new Date().toISOString() : (CLOSED_STATUSES.includes(status) ? resolvedAt : null);
      }
    }

    await db.run(`
      UPDATE orbit_feedback
      SET title = ?, body = ?, category = ?, priority = ?, page = ?, images = ?, status = ?, resolved_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [title, body, category, priority, page, JSON.stringify(images), status, resolvedAt, existing.id, req.orgId]);

    res.json(await loadFeedback(existing.id, req));
  } catch (error) {
    console.error('Error updating orbit feedback:', error);
    res.status(500).json({ error: 'No se pudo actualizar la sugerencia' });
  }
});

// ─── DELETE /:id — autor o admin (comentarios y votos en cascada) ───
router.delete('/:id', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Sugerencia no encontrada' });
    if (existing.created_by !== req.teamMember.id && !isAdmin(req)) {
      return res.status(403).json({ error: 'Solo quien la creó o un admin puede eliminarla' });
    }
    await db.run('DELETE FROM orbit_feedback WHERE id = ? AND organization_id = ?', [existing.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting orbit feedback:', error);
    res.status(500).json({ error: 'No se pudo eliminar la sugerencia' });
  }
});

// ─── POST /:id/vote — toggle +1 ───
router.post('/:id/vote', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Sugerencia no encontrada' });

    const removed = await db.run(
      'DELETE FROM orbit_feedback_votes WHERE feedback_id = ? AND team_member_id = ?',
      [existing.id, req.teamMember.id]
    );
    let hasVoted = false;
    if (!removed.changes) {
      await db.run(
        'INSERT INTO orbit_feedback_votes (feedback_id, team_member_id) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING feedback_id',
        [existing.id, req.teamMember.id]
      );
      hasVoted = true;
    }
    // Mantener el contador desnormalizado al día
    await db.run(`
      UPDATE orbit_feedback SET votes = (SELECT COUNT(*) FROM orbit_feedback_votes WHERE feedback_id = ?) WHERE id = ?
    `, [existing.id, existing.id]);

    const item = await loadFeedback(existing.id, req);
    res.json({ id: item.id, votes: item.votes, has_voted: hasVoted });
  } catch (error) {
    console.error('Error toggling orbit feedback vote:', error);
    res.status(500).json({ error: 'No se pudo registrar el voto' });
  }
});

// ─── Comentarios ───
router.get('/:id/comments', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Sugerencia no encontrada' });

    const rows = await db.all(`
      SELECT c.*, tm.name AS created_by_name, tm.email AS created_by_email
      FROM orbit_feedback_comments c
      LEFT JOIN team_members tm ON tm.id = c.created_by
      WHERE c.feedback_id = ? AND c.organization_id = ?
      ORDER BY c.created_at ASC, c.id ASC
    `, [existing.id, req.orgId]);
    res.json(rows.map(serializeComment));
  } catch (error) {
    console.error('Error loading orbit feedback comments:', error);
    res.status(500).json({ error: 'No se pudieron cargar los comentarios' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Sugerencia no encontrada' });

    const { body, images } = req.body || {};
    const cleanBody = cleanText(body, 10000);
    const imgs = cleanImages(images);
    if (!cleanBody && !imgs.length) return res.status(400).json({ error: 'El comentario necesita texto o una imagen' });

    const result = await db.run(`
      INSERT INTO orbit_feedback_comments (feedback_id, organization_id, created_by, body, images)
      VALUES (?, ?, ?, ?, ?)
    `, [existing.id, req.orgId, req.teamMember.id, cleanBody || '', JSON.stringify(imgs)]);

    await db.run('UPDATE orbit_feedback SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [existing.id]);

    const row = await db.get(`
      SELECT c.*, tm.name AS created_by_name, tm.email AS created_by_email
      FROM orbit_feedback_comments c
      LEFT JOIN team_members tm ON tm.id = c.created_by
      WHERE c.id = ?
    `, [result.lastInsertRowid]);
    res.status(201).json(serializeComment(row));
  } catch (error) {
    console.error('Error creating orbit feedback comment:', error);
    res.status(500).json({ error: 'No se pudo guardar el comentario' });
  }
});

router.delete('/comments/:commentId', async (req, res) => {
  try {
    const comment = await db.get(
      'SELECT * FROM orbit_feedback_comments WHERE id = ? AND organization_id = ?',
      [req.params.commentId, req.orgId]
    );
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });
    if (comment.created_by !== req.teamMember.id && !isAdmin(req)) {
      return res.status(403).json({ error: 'Solo quien lo escribió o un admin puede eliminarlo' });
    }
    await db.run('DELETE FROM orbit_feedback_comments WHERE id = ?', [comment.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting orbit feedback comment:', error);
    res.status(500).json({ error: 'No se pudo eliminar el comentario' });
  }
});

export default router;
