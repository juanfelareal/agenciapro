import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { sendEmail } from '../utils/emailHelper.js';
import { uploadBuffer } from '../utils/blobStorage.js';

/**
 * Novedades: canal interno donde el equipo publica las noticias importantes
 * de las marcas (cambios, urgencias, logros, recordatorios) para que todos
 * estén enterados y quede registrado quién lo vio.
 *
 * Montado en /api/news detrás de teamAuthMiddleware
 * (req.teamMember = { id, name, email, role }, req.orgId = organización).
 */
const router = express.Router();

export const CATEGORIES = ['novedad', 'urgente', 'cambio', 'logro', 'recordatorio'];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

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

const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true';

const parseIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

// Valida que el cliente exista y sea de la organización; devuelve id o null
const resolveClientId = async (clientId, req) => {
  const id = parseIntOrNull(clientId);
  if (id === null) return null;
  const row = await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [id, req.orgId]);
  return row ? row.id : undefined; // undefined = no existe
};

// Primer placeholder (?) es el team_member actual (para is_read)
const SELECT_NEWS = `
  SELECT n.*,
         tm.name AS created_by_name,
         tm.email AS created_by_email,
         COALESCE(NULLIF(c.nickname, ''), NULLIF(c.company, ''), c.name) AS client_name,
         (SELECT COUNT(*) FROM org_news_reads r WHERE r.news_id = n.id)::int AS read_count,
         EXISTS (SELECT 1 FROM org_news_reads r WHERE r.news_id = n.id AND r.team_member_id = ?) AS is_read
  FROM org_news n
  LEFT JOIN team_members tm ON tm.id = n.created_by
  LEFT JOIN clients c ON c.id = n.client_id
`;

const serializeNews = (row) => ({
  ...row,
  images: parseJson(row.images),
  is_pinned: !!row.is_pinned,
  is_read: !!row.is_read,
  read_count: parseInt(row.read_count) || 0,
});

const loadNews = async (id, req) => {
  const row = await db.get(`${SELECT_NEWS} WHERE n.id = ? AND n.organization_id = ?`, [req.teamMember.id, id, req.orgId]);
  return row ? serializeNews(row) : null;
};

const findOwned = async (id, req) =>
  db.get('SELECT * FROM org_news WHERE id = ? AND organization_id = ?', [id, req.orgId]);

const markRead = (newsId, teamMemberId) =>
  db.run(
    'INSERT INTO org_news_reads (news_id, team_member_id) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING news_id',
    [newsId, teamMemberId]
  );

// ─── GET /unread-count — novedades de la org que el usuario no ha leído ───
// Debe declararse antes de '/:id'
router.get('/unread-count', async (req, res) => {
  try {
    const row = await db.get(`
      SELECT COUNT(*)::int AS unread
      FROM org_news n
      WHERE n.organization_id = ?
        AND NOT EXISTS (SELECT 1 FROM org_news_reads r WHERE r.news_id = n.id AND r.team_member_id = ?)
    `, [req.orgId, req.teamMember.id]);
    res.json({ unread: parseInt(row?.unread) || 0 });
  } catch (error) {
    console.error('Error loading news unread count:', error);
    res.status(500).json({ error: 'No se pudo cargar el conteo de novedades' });
  }
});

// ─── GET /clients — clientes activos para el selector de marca ───
router.get('/clients', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT id, COALESCE(NULLIF(nickname, ''), NULLIF(company, ''), name) AS name
      FROM clients
      WHERE organization_id = ? AND (status IS NULL OR status = 'active')
      ORDER BY LOWER(COALESCE(NULLIF(nickname, ''), NULLIF(company, ''), name)) ASC
    `, [req.orgId]);
    res.json(rows);
  } catch (error) {
    console.error('Error loading clients for news:', error);
    res.status(500).json({ error: 'No se pudieron cargar las marcas' });
  }
});

// ─── POST /upload — sube un pantallazo y devuelve { url } ───
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'La imagen supera el máximo de 8 MB' });
        if (err.code === 'INVALID_IMAGE_TYPE') return res.status(400).json({ error: err.message });
        console.error('Error receiving news image:', err);
        return res.status(400).json({ error: 'No se pudo recibir la imagen' });
      }
      if (!req.file) return res.status(400).json({ error: 'Imagen requerida (campo "file")' });

      const blob = await uploadBuffer('news', req.file);
      res.status(201).json({ url: blob.url });
    } catch (error) {
      console.error('Error uploading news image:', error);
      res.status(500).json({ error: 'No se pudo subir la imagen' });
    }
  });
});

// ─── POST /read-all — marca todas las novedades de la org como leídas ───
router.post('/read-all', async (req, res) => {
  try {
    const result = await db.run(`
      INSERT INTO org_news_reads (news_id, team_member_id)
      SELECT n.id, ? FROM org_news n
      WHERE n.organization_id = ?
        AND NOT EXISTS (SELECT 1 FROM org_news_reads r WHERE r.news_id = n.id AND r.team_member_id = ?)
      ON CONFLICT DO NOTHING
      RETURNING news_id
    `, [req.teamMember.id, req.orgId, req.teamMember.id]);
    res.json({ success: true, marked: result.changes || 0 });
  } catch (error) {
    console.error('Error marking all news as read:', error);
    res.status(500).json({ error: 'No se pudieron marcar las novedades como leídas' });
  }
});

// ─── GET / — feed con filtros y paginación ───
router.get('/', async (req, res) => {
  try {
    const { client_id, category, search, unread, limit, offset } = req.query;
    const params = [req.teamMember.id, req.orgId];
    let where = 'n.organization_id = ?';

    if (client_id === 'general') {
      where += ' AND n.client_id IS NULL';
    } else if (parseIntOrNull(client_id) !== null) {
      where += ' AND n.client_id = ?';
      params.push(parseIntOrNull(client_id));
    }
    if (category && CATEGORIES.includes(category)) { where += ' AND n.category = ?'; params.push(category); }
    if (toBool(unread)) {
      where += ' AND NOT EXISTS (SELECT 1 FROM org_news_reads r WHERE r.news_id = n.id AND r.team_member_id = ?)';
      params.push(req.teamMember.id);
    }
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      where += ' AND (n.title ILIKE ? OR n.body ILIKE ? OR c.nickname ILIKE ? OR c.company ILIKE ? OR c.name ILIKE ?)';
      params.push(term, term, term, term, term);
    }

    const lim = Math.min(Math.max(parseIntOrNull(limit) ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const off = Math.max(parseIntOrNull(offset) ?? 0, 0);
    params.push(lim + 1, off); // pedimos uno extra para saber si hay más

    const rows = await db.all(`
      ${SELECT_NEWS}
      WHERE ${where}
      ORDER BY n.is_pinned DESC, n.created_at DESC, n.id DESC
      LIMIT ? OFFSET ?
    `, params);

    const hasMore = rows.length > lim;
    const items = (hasMore ? rows.slice(0, lim) : rows).map(serializeNews);
    res.set('Access-Control-Expose-Headers', 'X-Has-More');
    res.set('X-Has-More', hasMore ? '1' : '0');
    res.json(items);
  } catch (error) {
    console.error('Error loading news:', error);
    res.status(500).json({ error: 'No se pudieron cargar las novedades' });
  }
});

// ─── POST / — publicar novedad ───

// ─── Notificación por correo a todo el equipo cuando se publica una novedad ───
const CATEGORY_LABELS = { novedad: 'Novedad', urgente: 'Urgente', cambio: 'Cambio', logro: 'Logro', recordatorio: 'Recordatorio' };
const CATEGORY_COLORS = { novedad: '#6B7280', urgente: '#DC2626', cambio: '#2563EB', logro: '#16A34A', recordatorio: '#D97706' };
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function notifyTeamAboutNews(orgId, item) {
  if (!process.env.RESEND_API_KEY && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
    console.warn('[Novedades] Sin configuración de email; no se notifica al equipo');
    return { sent: 0, skipped: 'no-email-config' };
  }
  const members = await db.all(
    `SELECT email, name FROM team_members WHERE organization_id = ? AND status = 'active' AND email IS NOT NULL AND email != ''`,
    [orgId]
  );
  const emails = [...new Set(members.map((m) => String(m.email).trim().toLowerCase()).filter((e) => e.includes('@')))];
  if (!emails.length) return { sent: 0, skipped: 'no-members' };

  const org = await db.get('SELECT name FROM organizations WHERE id = ?', [orgId]);
  const orgName = org?.name || 'LA REAL';
  const frontendUrl = (process.env.FRONTEND_URL || 'https://orbit.larealmarketing.com').split(',')[0].trim().replace(/\/$/, '');
  const link = `${frontendUrl}/app/novedades`;
  const brand = item.client_name || 'General';
  const catLabel = CATEGORY_LABELS[item.category] || 'Novedad';
  const catColor = CATEGORY_COLORS[item.category] || '#6B7280';
  const bodyHtml = item.body ? escapeHtml(item.body).replace(/\n/g, '<br>') : '';
  const imagesHtml = (item.images || []).slice(0, 4).map((u) =>
    `<a href="${escapeHtml(u)}" style="display:inline-block;margin:6px 6px 0 0;"><img src="${escapeHtml(u)}" alt="" style="max-width:260px;max-height:200px;border-radius:10px;border:1px solid #E5E7EB;" /></a>`
  ).join('');
  const when = new Date(item.created_at || Date.now()).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:#1A1A2E;padding:24px 32px;">
    <p style="margin:0;color:#BFFF00;font-size:20px;font-weight:700;">${escapeHtml(orgName)} · Orbit</p>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Nueva novedad para todo el equipo</p>
  </td></tr>
  <tr><td style="padding:28px 32px 8px;">
    <p style="margin:0 0 10px;">
      <span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;color:#fff;background:${catColor};">${escapeHtml(catLabel)}</span>
      <span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;color:#111827;background:#E5E7EB;margin-left:6px;">${escapeHtml(brand)}</span>
    </p>
    <h1 style="margin:0 0 12px;color:#111827;font-size:22px;line-height:1.3;">${escapeHtml(item.title)}</h1>
    ${bodyHtml ? `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${bodyHtml}</p>` : ''}
    ${imagesHtml ? `<div style="margin:0 0 16px;">${imagesHtml}</div>` : ''}
    <p style="margin:0 0 24px;color:#6B7280;font-size:13px;">Publicada por <strong style="color:#111827;">${escapeHtml(item.created_by_name || 'el equipo')}</strong> · ${escapeHtml(when)}</p>
    <a href="${link}" style="display:inline-block;background:#1A1A2E;color:#BFFF00;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:12px;">Ver en Orbit y marcar “Enterado”</a>
  </td></tr>
  <tr><td style="padding:16px 32px 28px;color:#9CA3AF;font-size:12px;line-height:1.5;">Recibes este correo porque haces parte del equipo de ${escapeHtml(orgName)} en Orbit. Las novedades quedan guardadas en la pestaña Novedades.</td></tr>
</table></td></tr></table></body></html>`;

  const from = `Estefania Hernandez <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`;
  const subject = `[Novedad${item.category === 'urgente' ? ' URGENTE' : ''}] ${brand} · ${item.title}`;
  let sent = 0;
  for (let i = 0; i < emails.length; i += 45) {
    const chunk = emails.slice(i, i + 45);
    try {
      await sendEmail({ from, to: chunk, subject, html });
      sent += chunk.length;
    } catch (err) {
      console.error('[Novedades] Error enviando correo al equipo:', err.message);
    }
  }
  return { sent };
}

router.post('/', async (req, res) => {
  try {
    const { title, body, client_id, category, is_pinned, images } = req.body || {};
    const cleanTitle = cleanText(title, 200);
    if (!cleanTitle) return res.status(400).json({ error: 'El título es requerido' });

    const cat = CATEGORIES.includes(category) ? category : 'novedad';
    const clientId = await resolveClientId(client_id, req);
    if (clientId === undefined) return res.status(400).json({ error: 'La marca seleccionada no existe' });

    const result = await db.run(`
      INSERT INTO org_news (organization_id, created_by, title, body, client_id, category, is_pinned, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.orgId, req.teamMember.id, cleanTitle, cleanText(body, 20000), clientId, cat,
      toBool(is_pinned), JSON.stringify(cleanImages(images)),
    ]);

    // El autor queda como leído automáticamente
    await markRead(result.lastInsertRowid, req.teamMember.id);

    const created = await loadNews(result.lastInsertRowid, req);
    // Correo a todo el equipo (en segundo plano: no bloquea ni falla la publicación)
    notifyTeamAboutNews(req.orgId, created)
      .then((r) => console.log(`[Novedades] Correo enviado a ${r.sent} personas del equipo`))
      .catch((err) => console.error('[Novedades] No se pudo notificar al equipo:', err.message));
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ error: 'No se pudo publicar la novedad' });
  }
});

// ─── GET /:id — detalle ───
router.get('/:id', async (req, res) => {
  try {
    const item = await loadNews(req.params.id, req);
    if (!item) return res.status(404).json({ error: 'Novedad no encontrada' });
    res.json(item);
  } catch (error) {
    console.error('Error loading news item:', error);
    res.status(500).json({ error: 'No se pudo cargar la novedad' });
  }
});

// ─── PUT /:id — editar (autor, admin o manager) ───
router.put('/:id', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Novedad no encontrada' });

    const isAuthor = existing.created_by === req.teamMember.id;
    if (!isAuthor && !isManager(req)) {
      return res.status(403).json({ error: 'Solo quien publicó la novedad, un admin o un manager puede editarla' });
    }

    const b = req.body || {};
    const keys = ['title', 'body', 'client_id', 'category', 'is_pinned', 'images'];
    if (!keys.some((k) => b[k] !== undefined)) return res.status(400).json({ error: 'Nada que actualizar' });

    let title = existing.title;
    if (b.title !== undefined) {
      title = cleanText(b.title, 200);
      if (!title) return res.status(400).json({ error: 'El título es requerido' });
    }
    const body = b.body !== undefined ? cleanText(b.body, 20000) : existing.body;
    const category = b.category !== undefined ? (CATEGORIES.includes(b.category) ? b.category : existing.category) : existing.category;
    const isPinned = b.is_pinned !== undefined ? toBool(b.is_pinned) : !!existing.is_pinned;
    const images = b.images !== undefined ? cleanImages(b.images) : parseJson(existing.images);

    let clientId = existing.client_id;
    if (b.client_id !== undefined) {
      clientId = await resolveClientId(b.client_id, req);
      if (clientId === undefined) return res.status(400).json({ error: 'La marca seleccionada no existe' });
    }

    await db.run(`
      UPDATE org_news
      SET title = ?, body = ?, client_id = ?, category = ?, is_pinned = ?, images = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [title, body, clientId, category, isPinned, JSON.stringify(images), existing.id, req.orgId]);

    res.json(await loadNews(existing.id, req));
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ error: 'No se pudo actualizar la novedad' });
  }
});

// ─── DELETE /:id — autor o admin (lecturas en cascada) ───
router.delete('/:id', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Novedad no encontrada' });
    if (existing.created_by !== req.teamMember.id && !isAdmin(req)) {
      return res.status(403).json({ error: 'Solo quien la publicó o un admin puede eliminarla' });
    }
    await db.run('DELETE FROM org_news WHERE id = ? AND organization_id = ?', [existing.id, req.orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({ error: 'No se pudo eliminar la novedad' });
  }
});

// ─── POST /:id/read — marca leída por el usuario actual (idempotente) ───
router.post('/:id/read', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Novedad no encontrada' });
    await markRead(existing.id, req.teamMember.id);
    const item = await loadNews(existing.id, req);
    res.json({ id: item.id, is_read: true, read_count: item.read_count });
  } catch (error) {
    console.error('Error marking news as read:', error);
    res.status(500).json({ error: 'No se pudo marcar la novedad como leída' });
  }
});

// ─── GET /:id/reads — "Visto por" ───
router.get('/:id/reads', async (req, res) => {
  try {
    const existing = await findOwned(req.params.id, req);
    if (!existing) return res.status(404).json({ error: 'Novedad no encontrada' });
    const rows = await db.all(`
      SELECT r.team_member_id, tm.name, r.read_at
      FROM org_news_reads r
      LEFT JOIN team_members tm ON tm.id = r.team_member_id
      WHERE r.news_id = ?
      ORDER BY r.read_at ASC
    `, [existing.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error loading news reads:', error);
    res.status(500).json({ error: 'No se pudo cargar quién la ha visto' });
  }
});

export default router;
