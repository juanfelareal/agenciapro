import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

// GET /api/portal/reports — list reports the agency has shared with this client
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const reports = await db.all(`
      SELECT id, title, report_type, period_label, period_start, period_end,
             file_name, file_path, file_size, file_type, created_at
      FROM client_reports
      WHERE client_id = ?
      ORDER BY COALESCE(period_start, created_at::text) DESC, created_at DESC
    `, [clientId]);
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
