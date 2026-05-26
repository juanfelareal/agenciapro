import express from 'express';
import db from '../config/database.js';

const router = express.Router();

/**
 * Scope: cada team_member ve solo sus propias vistas guardadas.
 * No se comparten entre miembros del equipo — son personales.
 */

// Parse view row from DB into the shape the frontend expects
const hydrate = (row) => {
  if (!row) return null;
  let filters = null;
  try { filters = row.filters ? JSON.parse(row.filters) : null; } catch { filters = null; }
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    view_mode: row.view_mode,
    filters,
    show_my_tasks: !!row.show_my_tasks,
    is_default: !!row.is_default,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

// GET /api/task-views — list my saved views
router.get('/', async (req, res) => {
  try {
    const memberId = req.teamMember?.id;
    if (!memberId) return res.status(401).json({ error: 'No autorizado' });
    const rows = await db.all(
      `SELECT * FROM task_saved_views
       WHERE team_member_id = ? AND organization_id = ?
       ORDER BY sort_order ASC, created_at ASC`,
      [memberId, req.orgId]
    );
    res.json(rows.map(hydrate));
  } catch (error) {
    console.error('Error listing task views:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/task-views — create
router.post('/', async (req, res) => {
  try {
    const memberId = req.teamMember?.id;
    if (!memberId) return res.status(401).json({ error: 'No autorizado' });
    const { name, color, view_mode, filters, show_my_tasks, is_default } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    // If this new view is marked default, clear the flag on the others first
    if (is_default) {
      await db.run(
        `UPDATE task_saved_views SET is_default = 0
         WHERE team_member_id = ? AND organization_id = ?`,
        [memberId, req.orgId]
      );
    }

    // Next sort_order = MAX + 1
    const max = await db.get(
      `SELECT COALESCE(MAX(sort_order), -1) AS m FROM task_saved_views
       WHERE team_member_id = ? AND organization_id = ?`,
      [memberId, req.orgId]
    );

    const result = await db.run(
      `INSERT INTO task_saved_views
         (organization_id, team_member_id, name, color, view_mode, filters,
          show_my_tasks, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.orgId,
        memberId,
        name.trim(),
        color || '#1A1A2E',
        view_mode || null,
        filters ? JSON.stringify(filters) : null,
        show_my_tasks ? 1 : 0,
        is_default ? 1 : 0,
        (Number(max?.m) || -1) + 1,
      ]
    );

    const row = await db.get(`SELECT * FROM task_saved_views WHERE id = ?`, [result.lastInsertRowid]);
    res.status(201).json(hydrate(row));
  } catch (error) {
    console.error('Error creating task view:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/task-views/:id — update name/color/view_mode/filters/show_my_tasks/is_default
router.put('/:id', async (req, res) => {
  try {
    const memberId = req.teamMember?.id;
    if (!memberId) return res.status(401).json({ error: 'No autorizado' });
    const { id } = req.params;

    const existing = await db.get(
      `SELECT * FROM task_saved_views
       WHERE id = ? AND team_member_id = ? AND organization_id = ?`,
      [id, memberId, req.orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Vista no encontrada' });

    const { name, color, view_mode, filters, show_my_tasks, is_default } = req.body || {};

    if (is_default === true) {
      await db.run(
        `UPDATE task_saved_views SET is_default = 0
         WHERE team_member_id = ? AND organization_id = ? AND id <> ?`,
        [memberId, req.orgId, id]
      );
    }

    await db.run(
      `UPDATE task_saved_views
       SET name = COALESCE(?, name),
           color = COALESCE(?, color),
           view_mode = COALESCE(?, view_mode),
           filters = COALESCE(?, filters),
           show_my_tasks = COALESCE(?, show_my_tasks),
           is_default = COALESCE(?, is_default),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND team_member_id = ? AND organization_id = ?`,
      [
        name?.trim() ?? null,
        color ?? null,
        view_mode ?? null,
        filters !== undefined ? (filters ? JSON.stringify(filters) : null) : null,
        show_my_tasks !== undefined ? (show_my_tasks ? 1 : 0) : null,
        is_default !== undefined ? (is_default ? 1 : 0) : null,
        id, memberId, req.orgId,
      ]
    );

    const row = await db.get(`SELECT * FROM task_saved_views WHERE id = ?`, [id]);
    res.json(hydrate(row));
  } catch (error) {
    console.error('Error updating task view:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/task-views/:id
router.delete('/:id', async (req, res) => {
  try {
    const memberId = req.teamMember?.id;
    if (!memberId) return res.status(401).json({ error: 'No autorizado' });
    const result = await db.run(
      `DELETE FROM task_saved_views
       WHERE id = ? AND team_member_id = ? AND organization_id = ?`,
      [req.params.id, memberId, req.orgId]
    );
    if (!result.changes) return res.status(404).json({ error: 'Vista no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task view:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/task-views/reorder — body { ids: [1, 2, 3, ...] }
router.put('/reorder', async (req, res) => {
  try {
    const memberId = req.teamMember?.id;
    if (!memberId) return res.status(401).json({ error: 'No autorizado' });
    const { ids } = req.body || {};
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids debe ser array' });
    for (let i = 0; i < ids.length; i++) {
      await db.run(
        `UPDATE task_saved_views SET sort_order = ?
         WHERE id = ? AND team_member_id = ? AND organization_id = ?`,
        [i, ids[i], memberId, req.orgId]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering task views:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
