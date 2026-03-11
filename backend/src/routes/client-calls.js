import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all calls for a client
router.get('/:clientId', async (req, res) => {
  try {
    const calls = await db.all(`
      SELECT cc.*, tm.name as created_by_name
      FROM client_calls cc
      LEFT JOIN team_members tm ON cc.created_by = tm.id
      WHERE cc.client_id = ? AND cc.organization_id = ?
      ORDER BY cc.call_date DESC
    `, [req.params.clientId, req.orgId]);
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single call
router.get('/:clientId/:callId', async (req, res) => {
  try {
    const call = await db.get(`
      SELECT cc.*, tm.name as created_by_name
      FROM client_calls cc
      LEFT JOIN team_members tm ON cc.created_by = tm.id
      WHERE cc.id = ? AND cc.client_id = ? AND cc.organization_id = ?
    `, [req.params.callId, req.params.clientId, req.orgId]);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a call
router.post('/:clientId', async (req, res) => {
  try {
    const { title, call_date, duration_minutes, summary, transcription } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const result = await db.run(`
      INSERT INTO client_calls (client_id, title, call_date, duration_minutes, summary, transcription, created_by, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.clientId, title, call_date || new Date().toISOString(), duration_minutes || null, summary || null, transcription || null, req.teamMember?.id || null, req.orgId]);

    const call = await db.get('SELECT * FROM client_calls WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a call
router.put('/:clientId/:callId', async (req, res) => {
  try {
    const { title, call_date, duration_minutes, summary, transcription } = req.body;

    const existing = await db.get(
      'SELECT * FROM client_calls WHERE id = ? AND client_id = ? AND organization_id = ?',
      [req.params.callId, req.params.clientId, req.orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Call not found' });

    await db.run(`
      UPDATE client_calls SET
        title = COALESCE(?, title),
        call_date = COALESCE(?, call_date),
        duration_minutes = COALESCE(?, duration_minutes),
        summary = COALESCE(?, summary),
        transcription = COALESCE(?, transcription),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [title, call_date, duration_minutes, summary, transcription, req.params.callId, req.orgId]);

    const call = await db.get('SELECT * FROM client_calls WHERE id = ?', [req.params.callId]);
    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a call
router.delete('/:clientId/:callId', async (req, res) => {
  try {
    const result = await db.run(
      'DELETE FROM client_calls WHERE id = ? AND client_id = ? AND organization_id = ?',
      [req.params.callId, req.params.clientId, req.orgId]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Call not found' });
    res.json({ message: 'Call deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
