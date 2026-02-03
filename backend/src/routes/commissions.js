import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get monthly report with totals
router.get('/report/monthly', async (req, res) => {
  try {
    const { month, year } = req.query;

    let query = `
      SELECT
        c.*,
        tm.name as team_member_name,
        tm.position as team_member_position,
        cl.name as client_name,
        cl.company as client_company
      FROM commissions c
      JOIN team_members tm ON c.team_member_id = tm.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.organization_id = ?
    `;
    const params = [req.orgId];

    if (month) {
      query += ' AND c.month = ?';
      params.push(month);
    }

    if (year) {
      query += ' AND c.year = ?';
      params.push(year);
    }

    query += ' ORDER BY tm.name ASC, cl.name ASC';

    const commissions = await db.prepare(query).all(...params);

    // Calculate totals
    const totals = {
      total_net_sales: commissions.reduce((sum, c) => sum + c.net_sales, 0),
      total_commissions: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
      pending_amount: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0),
      approved_amount: commissions.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.commission_amount, 0),
      paid_amount: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
      count: commissions.length
    };

    res.json({ commissions, totals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all commissions
router.get('/', async (req, res) => {
  try {
    const { month, year, team_member_id, client_id, status } = req.query;

    let query = `
      SELECT
        c.*,
        tm.name as team_member_name,
        tm.position as team_member_position,
        cl.name as client_name,
        cl.company as client_company
      FROM commissions c
      JOIN team_members tm ON c.team_member_id = tm.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.organization_id = ?
    `;
    const params = [req.orgId];

    if (month) {
      query += ' AND c.month = ?';
      params.push(month);
    }

    if (year) {
      query += ' AND c.year = ?';
      params.push(year);
    }

    if (team_member_id) {
      query += ' AND c.team_member_id = ?';
      params.push(team_member_id);
    }

    if (client_id) {
      query += ' AND c.client_id = ?';
      params.push(client_id);
    }

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.year DESC, c.month DESC, tm.name ASC';

    const commissions = await db.prepare(query).all(...params);
    res.json(commissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get commission by ID
router.get('/:id', async (req, res) => {
  try {
    const commission = await db.prepare(`
      SELECT
        c.*,
        tm.name as team_member_name,
        tm.position as team_member_position,
        cl.name as client_name,
        cl.company as client_company
      FROM commissions c
      JOIN team_members tm ON c.team_member_id = tm.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = ? AND c.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    res.json(commission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create commission
router.post('/', async (req, res) => {
  try {
    const { team_member_id, client_id, otros, month, year, net_sales, commission_amount, status, notes } = req.body;

    if (!team_member_id || !month || !year || net_sales === undefined || commission_amount === undefined) {
      return res.status(400).json({ error: 'Team member, month, year, net sales, and commission amount are required' });
    }

    // Validate month
    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }

    // Check if team member exists in this org
    const teamMember = await db.prepare('SELECT id FROM team_members WHERE id = ? AND organization_id = ?').get(team_member_id, req.orgId);
    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check if client exists in this org (if provided)
    if (client_id) {
      const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').get(client_id, req.orgId);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
    }

    const result = await db.prepare(`
      INSERT INTO commissions (team_member_id, client_id, otros, month, year, net_sales, commission_amount, status, notes, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      team_member_id,
      client_id || null,
      otros || null,
      month,
      year,
      net_sales,
      commission_amount,
      status || 'pending',
      notes,
      req.orgId
    );

    const commission = await db.prepare(`
      SELECT
        c.*,
        tm.name as team_member_name,
        tm.position as team_member_position,
        cl.name as client_name,
        cl.company as client_company
      FROM commissions c
      JOIN team_members tm ON c.team_member_id = tm.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = ? AND c.organization_id = ?
    `).get(result.lastInsertRowid, req.orgId);

    res.status(201).json(commission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update commission
router.put('/:id', async (req, res) => {
  try {
    const { team_member_id, client_id, otros, month, year, net_sales, commission_amount, status, notes } = req.body;

    // Validate month if provided
    if (month && (month < 1 || month > 12)) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }

    await db.prepare(`
      UPDATE commissions
      SET team_member_id = ?, client_id = ?, otros = ?, month = ?, year = ?, net_sales = ?,
          commission_amount = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      team_member_id,
      client_id || null,
      otros || null,
      month,
      year,
      net_sales,
      commission_amount,
      status,
      notes,
      req.params.id,
      req.orgId
    );

    const commission = await db.prepare(`
      SELECT
        c.*,
        tm.name as team_member_name,
        tm.position as team_member_position,
        cl.name as client_name,
        cl.company as client_company
      FROM commissions c
      JOIN team_members tm ON c.team_member_id = tm.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = ? AND c.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    res.json(commission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update commission status only
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['pending', 'approved', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (pending, approved, paid) is required' });
    }

    await db.prepare(`
      UPDATE commissions
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(status, req.params.id, req.orgId);

    const commission = await db.prepare(`
      SELECT
        c.*,
        tm.name as team_member_name,
        tm.position as team_member_position,
        cl.name as client_name,
        cl.company as client_company
      FROM commissions c
      JOIN team_members tm ON c.team_member_id = tm.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = ? AND c.organization_id = ?
    `).get(req.params.id, req.orgId);

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    // Create notification when commission is approved
    if (status === 'approved') {
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const monthName = months[commission.month - 1];

      const formattedAmount = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(commission.commission_amount);

      await db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        commission.team_member_id,
        'commission_approved',
        'Comisión Aprobada',
        `Tu comisión de ${formattedAmount} para ${monthName} ${commission.year} ha sido aprobada.`,
        'commission',
        commission.id,
        req.orgId
      );
    }

    res.json(commission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete commission
router.delete('/:id', async (req, res) => {
  try {
    const commission = await db.prepare('SELECT id FROM commissions WHERE id = ? AND organization_id = ?').get(req.params.id, req.orgId);

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    await db.prepare('DELETE FROM commissions WHERE id = ? AND organization_id = ?').run(req.params.id, req.orgId);
    res.json({ message: 'Commission deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
