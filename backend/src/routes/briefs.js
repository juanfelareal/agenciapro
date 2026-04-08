import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all briefs (optionally filter by client_id)
router.get('/', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = `
      SELECT b.*, c.company as client_company, c.nickname as client_nickname, c.name as client_name
      FROM briefs b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.organization_id = ?
    `;
    const params = [req.orgId];

    if (client_id) {
      query += ' AND b.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY b.updated_at DESC';
    const briefs = await db.prepare(query).all(...params);
    res.json(briefs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single brief
router.get('/:id', async (req, res) => {
  try {
    const brief = await db.prepare(`
      SELECT b.*, c.company as client_company, c.nickname as client_nickname, c.name as client_name
      FROM briefs b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ? AND b.organization_id = ?
    `).get(req.params.id, req.orgId);
    if (!brief) return res.status(404).json({ error: 'Brief not found' });
    res.json(brief);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create brief
router.post('/', async (req, res) => {
  try {
    const { client_id, title, html_content, visible_to_client } = req.body;
    if (!client_id || !title) return res.status(400).json({ error: 'client_id and title are required' });

    const result = await db.prepare(`
      INSERT INTO briefs (client_id, title, html_content, visible_to_client, organization_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(client_id, title, html_content || '', visible_to_client ? 1 : 0, req.orgId, req.teamMember?.id || null);

    const brief = await db.prepare('SELECT * FROM briefs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(brief);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update brief
router.put('/:id', async (req, res) => {
  try {
    const { title, html_content, visible_to_client, client_id } = req.body;

    const existing = await db.prepare('SELECT * FROM briefs WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);
    if (!existing) return res.status(404).json({ error: 'Brief not found' });

    await db.prepare(`
      UPDATE briefs SET
        title = COALESCE(?, title),
        html_content = COALESCE(?, html_content),
        visible_to_client = COALESCE(?, visible_to_client),
        client_id = COALESCE(?, client_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      title !== undefined ? title : null,
      html_content !== undefined ? html_content : null,
      visible_to_client !== undefined ? (visible_to_client ? 1 : 0) : null,
      client_id !== undefined ? client_id : null,
      req.params.id, req.orgId
    );

    const brief = await db.prepare('SELECT * FROM briefs WHERE id = ?').get(req.params.id);
    res.json(brief);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete brief
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM briefs WHERE id = ? AND organization_id = ?').run(req.params.id, req.orgId);
    if (result.changes === 0) return res.status(404).json({ error: 'Brief not found' });
    res.json({ message: 'Brief deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
