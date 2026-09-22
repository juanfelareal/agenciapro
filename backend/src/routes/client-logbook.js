import express from 'express';
import db from '../config/database.js';

/**
 * Bitácora por cliente: registro cronológico de cambios y sucesos de la marca
 * (cambios en pauta, web, creativos, promociones, incidentes, reuniones, insights)
 * con acciones a tomar, responsable y fecha límite.
 */
const router = express.Router();

export const ENTRY_TYPES = ['cambio_pauta', 'cambio_web', 'creativo', 'promocion', 'incidente', 'reunion', 'insight', 'otro'];
export const IMPACT_LEVELS = ['alto', 'medio', 'bajo'];

const parseJson = (v, fallback = []) => {
  if (Array.isArray(v)) return v;
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

const verifyClient = async (clientId, orgId) =>
  !!(await db.get('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [clientId, orgId]));

const loadActions = async (entryIds, orgId) => {
  if (!entryIds.length) return {};
  const placeholders = entryIds.map(() => '?').join(',');
  const rows = await db.all(`
    SELECT a.*, tm.name as assignee_name, dtm.name as done_by_name
    FROM client_logbook_actions a
    LEFT JOIN team_members tm ON a.assignee_id = tm.id
    LEFT JOIN team_members dtm ON a.done_by = dtm.id
    WHERE a.entry_id IN (${placeholders}) AND a.organization_id = ?
    ORDER BY a.is_done ASC, a.due_date ASC NULLS LAST, a.id ASC
  `, [...entryIds, orgId]);
  const byEntry = {};
  for (const r of rows) {
    (byEntry[r.entry_id] ||= []).push({ ...r, is_done: !!r.is_done });
  }
  return byEntry;
};

const loadEntry = async (entryId, orgId) => {
  const entry = await db.get(`
    SELECT e.*, tm.name as created_by_name
    FROM client_logbook_entries e
    LEFT JOIN team_members tm ON e.created_by = tm.id
    WHERE e.id = ? AND e.organization_id = ?
  `, [entryId, orgId]);
  if (!entry) return null;
  const actions = await loadActions([entry.id], orgId);
  return { ...entry, platforms: parseJson(entry.platforms), is_pinned: !!entry.is_pinned, actions: actions[entry.id] || [] };
};

// ─── Summary for badges: entries + pending actions per client (org-wide) ───
// Must be declared before '/:clientId'
router.get('/summary/all', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT e.client_id,
             COUNT(DISTINCT e.id) as entries,
             COUNT(a.id) FILTER (WHERE a.is_done = 0) as pending_actions,
             MAX(e.event_at) as last_event_at
      FROM client_logbook_entries e
      LEFT JOIN client_logbook_actions a ON a.entry_id = e.id
      WHERE e.organization_id = ?
      GROUP BY e.client_id
    `, [req.orgId]);
    const summary = {};
    for (const r of rows) {
      summary[r.client_id] = {
        entries: parseInt(r.entries) || 0,
        pending_actions: parseInt(r.pending_actions) || 0,
        last_event_at: r.last_event_at,
      };
    }
    res.json(summary);
  } catch (error) {
    console.error('Error loading logbook summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── List entries of a client ───
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { type, limit } = req.query;
    const params = [clientId, req.orgId];
    let where = 'e.client_id = ? AND e.organization_id = ?';
    if (type && ENTRY_TYPES.includes(type)) { where += ' AND e.entry_type = ?'; params.push(type); }
    const lim = Math.min(parseInt(limit) || 200, 500);

    const entries = await db.all(`
      SELECT e.*, tm.name as created_by_name
      FROM client_logbook_entries e
      LEFT JOIN team_members tm ON e.created_by = tm.id
      WHERE ${where}
      ORDER BY e.is_pinned DESC, e.event_at DESC, e.id DESC
      LIMIT ${lim}
    `, params);

    const actions = await loadActions(entries.map(e => e.id), req.orgId);
    res.json(entries.map(e => ({
      ...e,
      platforms: parseJson(e.platforms),
      is_pinned: !!e.is_pinned,
      actions: actions[e.id] || [],
    })));
  } catch (error) {
    console.error('Error loading logbook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Create entry (with optional initial actions) ───
router.post('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!(await verifyClient(clientId, req.orgId))) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { title, description, entry_type, event_at, platforms, impact, link_url, is_pinned, actions } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });

    const type = ENTRY_TYPES.includes(entry_type) ? entry_type : 'otro';
    const impactLevel = IMPACT_LEVELS.includes(impact) ? impact : null;
    const eventAt = event_at ? new Date(event_at) : new Date();
    if (Number.isNaN(eventAt.getTime())) return res.status(400).json({ error: 'event_at inválido' });

    const result = await db.run(`
      INSERT INTO client_logbook_entries
        (client_id, organization_id, created_by, entry_type, title, description, event_at, platforms, impact, link_url, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clientId, req.orgId, req.teamMember?.id || null, type, title.trim(), description || null,
      eventAt.toISOString(), JSON.stringify(Array.isArray(platforms) ? platforms : []), impactLevel,
      link_url || null, is_pinned ? 1 : 0,
    ]);
    const entryId = result.lastInsertRowid;

    for (const a of Array.isArray(actions) ? actions : []) {
      if (!a?.description || !a.description.trim()) continue;
      await db.run(`
        INSERT INTO client_logbook_actions (entry_id, organization_id, description, assignee_id, due_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [entryId, req.orgId, a.description.trim(), a.assignee_id || null, a.due_date || null, req.teamMember?.id || null]);
    }

    res.status(201).json(await loadEntry(entryId, req.orgId));
  } catch (error) {
    console.error('Error creating logbook entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Update entry ───
router.put('/:clientId/:entryId', async (req, res) => {
  try {
    const { clientId, entryId } = req.params;
    const existing = await db.get(
      'SELECT * FROM client_logbook_entries WHERE id = ? AND client_id = ? AND organization_id = ?',
      [entryId, clientId, req.orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Entrada no encontrada' });

    const b = req.body;
    const type = b.entry_type !== undefined ? (ENTRY_TYPES.includes(b.entry_type) ? b.entry_type : 'otro') : existing.entry_type;
    const impactLevel = b.impact !== undefined ? (IMPACT_LEVELS.includes(b.impact) ? b.impact : null) : existing.impact;
    let eventAt = existing.event_at;
    if (b.event_at !== undefined) {
      const d = new Date(b.event_at);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'event_at inválido' });
      eventAt = d.toISOString();
    }

    await db.run(`
      UPDATE client_logbook_entries
      SET title = ?, description = ?, entry_type = ?, event_at = ?, platforms = ?, impact = ?, link_url = ?, is_pinned = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      b.title !== undefined ? String(b.title).trim() : existing.title,
      b.description !== undefined ? (b.description || null) : existing.description,
      type, eventAt,
      b.platforms !== undefined ? JSON.stringify(Array.isArray(b.platforms) ? b.platforms : []) : existing.platforms,
      impactLevel,
      b.link_url !== undefined ? (b.link_url || null) : existing.link_url,
      b.is_pinned !== undefined ? (b.is_pinned ? 1 : 0) : existing.is_pinned,
      entryId,
    ]);

    res.json(await loadEntry(entryId, req.orgId));
  } catch (error) {
    console.error('Error updating logbook entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Delete entry (actions cascade) ───
router.delete('/:clientId/:entryId', async (req, res) => {
  try {
    const { clientId, entryId } = req.params;
    const result = await db.run(
      'DELETE FROM client_logbook_entries WHERE id = ? AND client_id = ? AND organization_id = ?',
      [entryId, clientId, req.orgId]
    );
    if (!result.changes) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting logbook entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Actions ───
router.post('/:clientId/:entryId/actions', async (req, res) => {
  try {
    const { clientId, entryId } = req.params;
    const entry = await db.get(
      'SELECT id FROM client_logbook_entries WHERE id = ? AND client_id = ? AND organization_id = ?',
      [entryId, clientId, req.orgId]
    );
    if (!entry) return res.status(404).json({ error: 'Entrada no encontrada' });

    const { description, assignee_id, due_date } = req.body;
    if (!description || !description.trim()) return res.status(400).json({ error: 'La acción necesita descripción' });

    await db.run(`
      INSERT INTO client_logbook_actions (entry_id, organization_id, description, assignee_id, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [entryId, req.orgId, description.trim(), assignee_id || null, due_date || null, req.teamMember?.id || null]);

    res.status(201).json(await loadEntry(entryId, req.orgId));
  } catch (error) {
    console.error('Error creating logbook action:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:clientId/:entryId/actions/:actionId', async (req, res) => {
  try {
    const { clientId, entryId, actionId } = req.params;
    const action = await db.get(`
      SELECT a.* FROM client_logbook_actions a
      JOIN client_logbook_entries e ON e.id = a.entry_id
      WHERE a.id = ? AND a.entry_id = ? AND e.client_id = ? AND a.organization_id = ?
    `, [actionId, entryId, clientId, req.orgId]);
    if (!action) return res.status(404).json({ error: 'Acción no encontrada' });

    const b = req.body;
    const isDone = b.is_done !== undefined ? (b.is_done ? 1 : 0) : action.is_done;
    const doneChanged = b.is_done !== undefined && (isDone !== action.is_done);

    await db.run(`
      UPDATE client_logbook_actions
      SET description = ?, assignee_id = ?, due_date = ?, is_done = ?,
          done_at = ?, done_by = ?
      WHERE id = ?
    `, [
      b.description !== undefined ? String(b.description).trim() : action.description,
      b.assignee_id !== undefined ? (b.assignee_id || null) : action.assignee_id,
      b.due_date !== undefined ? (b.due_date || null) : action.due_date,
      isDone,
      doneChanged ? (isDone ? new Date().toISOString() : null) : action.done_at,
      doneChanged ? (isDone ? (req.teamMember?.id || null) : null) : action.done_by,
      actionId,
    ]);

    res.json(await loadEntry(entryId, req.orgId));
  } catch (error) {
    console.error('Error updating logbook action:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:clientId/:entryId/actions/:actionId', async (req, res) => {
  try {
    const { clientId, entryId, actionId } = req.params;
    const result = await db.run(`
      DELETE FROM client_logbook_actions a
      USING client_logbook_entries e
      WHERE a.entry_id = e.id AND a.id = ? AND a.entry_id = ? AND e.client_id = ? AND a.organization_id = ?
    `, [actionId, entryId, clientId, req.orgId]);
    if (!result.changes) return res.status(404).json({ error: 'Acción no encontrada' });
    res.json(await loadEntry(entryId, req.orgId));
  } catch (error) {
    console.error('Error deleting logbook action:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
