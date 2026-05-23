import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/reference-ads
 * Returns reference ads visible to the logged-in client.
 * Visible = directly assigned OR assigned via any group the client belongs to.
 */
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;

    // Resolve client's organization (defensive: ads must be within same org)
    const client = await db.get(
      `SELECT id, organization_id FROM clients WHERE id = ?`,
      [clientId]
    );
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const ads = await db.all(
      `SELECT DISTINCT r.id, r.url, r.title, r.notes, r.platform,
              r.thumbnail_url, r.created_at, r.updated_at
       FROM reference_ads r
       LEFT JOIN reference_ad_clients rc ON rc.reference_ad_id = r.id
       LEFT JOIN reference_ad_groups rg ON rg.reference_ad_id = r.id
       LEFT JOIN client_group_members m ON m.group_id = rg.group_id
       WHERE r.organization_id = ?
         AND (rc.client_id = ? OR m.client_id = ?)
       ORDER BY r.created_at DESC`,
      [client.organization_id, clientId, clientId]
    );

    res.json(ads);
  } catch (error) {
    console.error('Error fetching portal reference ads:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
