import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/invoices
 * Get all invoices for the client
 */
router.get('/', clientAuthMiddleware, requirePortalPermission('can_view_invoices'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { status } = req.query;

    let query = `
      SELECT
        i.*,
        p.name as project_name
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.client_id = ?
    `;
    const params = [clientId];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    query += ' ORDER BY i.issue_date DESC';

    const invoices = await db.all(query, params);

    // Calculate totals
    const totals = await db.get(`
      SELECT
        SUM(amount) as total,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid,
        SUM(CASE WHEN status IN ('draft', 'approved', 'invoiced') THEN amount ELSE 0 END) as pending
      FROM invoices
      WHERE client_id = ?
    `, [clientId]);

    res.json({
      invoices,
      summary: {
        total: totals?.total || 0,
        paid: totals?.paid || 0,
        pending: totals?.pending || 0
      }
    });
  } catch (error) {
    console.error('Error getting portal invoices:', error);
    res.status(500).json({ error: 'Error al cargar facturas' });
  }
});

/**
 * GET /api/portal/invoices/:id
 * Get invoice details
 */
router.get('/:id', clientAuthMiddleware, requirePortalPermission('can_view_invoices'), async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.client.id;

    const invoice = await db.get(`
      SELECT
        i.*,
        p.name as project_name,
        c.name as client_name,
        c.company,
        c.nit,
        c.email
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      JOIN clients c ON i.client_id = c.id
      WHERE i.id = ? AND i.client_id = ?
    `, [id, clientId]);

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    // Get status history
    const history = await db.all(`
      SELECT
        ish.*,
        tm.name as changed_by_name
      FROM invoice_status_history ish
      LEFT JOIN team_members tm ON ish.changed_by = tm.id
      WHERE ish.invoice_id = ?
      ORDER BY ish.changed_at DESC
    `, [id]);

    res.json({
      ...invoice,
      history
    });
  } catch (error) {
    console.error('Error getting portal invoice:', error);
    res.status(500).json({ error: 'Error al cargar factura' });
  }
});

export default router;
