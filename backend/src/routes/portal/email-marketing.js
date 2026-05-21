import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

// GET /api/portal/email-marketing?start_date=&end_date=
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { start_date, end_date } = req.query;

    let sql = 'SELECT * FROM email_marketing_campaigns WHERE client_id = ?';
    const params = [clientId];
    if (start_date) { sql += ' AND sent_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND sent_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY sent_date DESC';

    const campaigns = await db.all(sql, params);
    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
