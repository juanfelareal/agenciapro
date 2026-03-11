import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

// Get all calls for the authenticated client
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const calls = await db.all(`
      SELECT id, title, call_date, duration_minutes, summary,
        CASE WHEN transcription IS NOT NULL AND transcription != '' THEN 1 ELSE 0 END as has_transcription,
        created_at
      FROM client_calls
      WHERE client_id = ?
      ORDER BY call_date DESC
    `, [req.client.id]);
    res.json({ calls });
  } catch (error) {
    console.error('Error getting portal calls:', error);
    res.status(500).json({ error: 'Error al cargar llamadas' });
  }
});

// Get single call detail
router.get('/:id', clientAuthMiddleware, async (req, res) => {
  try {
    const call = await db.get(`
      SELECT id, title, call_date, duration_minutes, summary, transcription, created_at
      FROM client_calls
      WHERE id = ? AND client_id = ?
    `, [req.params.id, req.client.id]);

    if (!call) return res.status(404).json({ error: 'Llamada no encontrada' });
    res.json({ call });
  } catch (error) {
    console.error('Error getting portal call:', error);
    res.status(500).json({ error: 'Error al cargar llamada' });
  }
});

export default router;
