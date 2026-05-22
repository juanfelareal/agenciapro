import express from 'express';
import db from '../config/database.js';

const router = express.Router();

/**
 * Historial de auditoría.
 * Lo usa el MCP para dejar registro de cada borrado: quién, qué y cuándo.
 * teamAuthMiddleware (aplicado en server.js) provee req.orgId / req.teamMember / req.user.
 */

// POST /api/audit-log — registrar un evento.
router.post('/', async (req, res) => {
  try {
    const { action, resource_path, snapshot, source } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'action es requerido' });
    }

    const result = await db.run(
      `INSERT INTO audit_log
        (organization_id, team_member_id, user_name, user_email, action, resource_path, snapshot, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.orgId,
        req.teamMember?.id || null,
        req.teamMember?.name || req.user?.name || null,
        req.teamMember?.email || req.user?.email || null,
        action,
        resource_path || null,
        snapshot != null ? JSON.stringify(snapshot) : null,
        source || 'mcp',
      ]
    );

    const entry = await db.get('SELECT * FROM audit_log WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audit-log — consultar el historial (más reciente primero).
router.get('/', async (req, res) => {
  try {
    const { action, limit } = req.query;
    let sql = 'SELECT * FROM audit_log WHERE organization_id = ?';
    const params = [req.orgId];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Math.min(Number(limit) || 100, 500));

    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
