import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// ============================================
// GROUPS CRUD
// ============================================

// List all groups (with member counts and members preview)
router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const groups = await db.all(`
      SELECT
        g.id,
        g.name,
        g.color,
        g.description,
        g.created_at,
        g.updated_at,
        COUNT(DISTINCT m.client_id) AS member_count
      FROM client_groups g
      LEFT JOIN client_group_members m ON m.group_id = g.id
      WHERE g.organization_id = ?
      GROUP BY g.id
      ORDER BY g.name ASC
    `, [orgId]);

    // Attach member ids (lightweight) so the frontend can render chips without an extra call
    for (const g of groups) {
      const members = await db.all(
        `SELECT c.id, c.company
         FROM client_group_members m
         JOIN clients c ON c.id = m.client_id
         WHERE m.group_id = ? AND c.organization_id = ?
         ORDER BY c.company ASC`,
        [g.id, orgId]
      );
      g.members = members;
      g.member_count = Number(g.member_count) || 0;
    }

    res.json(groups);
  } catch (error) {
    console.error('Error listing client groups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get one group with members
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const group = await db.get(
      `SELECT * FROM client_groups WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    group.members = await db.all(
      `SELECT c.id, c.company, c.contact_name, c.email
       FROM client_group_members m
       JOIN clients c ON c.id = m.client_id
       WHERE m.group_id = ? AND c.organization_id = ?
       ORDER BY c.company ASC`,
      [id, orgId]
    );

    res.json(group);
  } catch (error) {
    console.error('Error fetching client group:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create group (optionally with initial member ids)
router.post('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { name, color, description, client_ids = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const result = await db.run(
      `INSERT INTO client_groups (organization_id, name, color, description, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [orgId, name.trim(), color || '#6366F1', description || null, req.teamMember?.id || null]
    );

    const groupId = result.lastInsertRowid;

    if (Array.isArray(client_ids) && client_ids.length > 0) {
      for (const clientId of client_ids) {
        await db.run(
          `INSERT INTO client_group_members (group_id, client_id)
           VALUES (?, ?) ON CONFLICT (group_id, client_id) DO NOTHING`,
          [groupId, clientId]
        );
      }
    }

    const group = await db.get(
      `SELECT * FROM client_groups WHERE id = ? AND organization_id = ?`,
      [groupId, orgId]
    );
    group.members = await db.all(
      `SELECT c.id, c.company FROM client_group_members m
       JOIN clients c ON c.id = m.client_id
       WHERE m.group_id = ? AND c.organization_id = ?
       ORDER BY c.company ASC`,
      [groupId, orgId]
    );

    res.status(201).json(group);
  } catch (error) {
    if (error.code === '23505' || /unique|duplicate/i.test(error.message)) {
      return res.status(409).json({ error: 'Ya existe un grupo con ese nombre' });
    }
    console.error('Error creating client group:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update group
router.put('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const { name, color, description } = req.body;

    const existing = await db.get(
      `SELECT id FROM client_groups WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Grupo no encontrado' });

    await db.run(
      `UPDATE client_groups
       SET name = COALESCE(?, name),
           color = COALESCE(?, color),
           description = COALESCE(?, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [name?.trim(), color, description, id, orgId]
    );

    const group = await db.get(
      `SELECT * FROM client_groups WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    res.json(group);
  } catch (error) {
    if (error.code === '23505' || /unique|duplicate/i.test(error.message)) {
      return res.status(409).json({ error: 'Ya existe un grupo con ese nombre' });
    }
    console.error('Error updating client group:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const result = await db.run(
      `DELETE FROM client_groups WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!result.changes) return res.status(404).json({ error: 'Grupo no encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting client group:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MEMBERS
// ============================================

// Replace full member list (idempotent — useful when editing)
router.put('/:id/clients', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const { client_ids = [] } = req.body;

    const group = await db.get(
      `SELECT id FROM client_groups WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    await db.run(`DELETE FROM client_group_members WHERE group_id = ?`, [id]);

    for (const clientId of client_ids) {
      // Guard: only assign clients from the same org
      const c = await db.get(
        `SELECT id FROM clients WHERE id = ? AND organization_id = ?`,
        [clientId, orgId]
      );
      if (!c) continue;
      await db.run(
        `INSERT INTO client_group_members (group_id, client_id)
         VALUES (?, ?) ON CONFLICT (group_id, client_id) DO NOTHING`,
        [id, clientId]
      );
    }

    const members = await db.all(
      `SELECT c.id, c.company FROM client_group_members m
       JOIN clients c ON c.id = m.client_id
       WHERE m.group_id = ? AND c.organization_id = ?
       ORDER BY c.company ASC`,
      [id, orgId]
    );
    res.json({ success: true, members });
  } catch (error) {
    console.error('Error replacing group members:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a single member
router.post('/:id/clients', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id es requerido' });

    const group = await db.get(
      `SELECT id FROM client_groups WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    const client = await db.get(
      `SELECT id FROM clients WHERE id = ? AND organization_id = ?`,
      [client_id, orgId]
    );
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    await db.run(
      `INSERT INTO client_group_members (group_id, client_id)
       VALUES (?, ?) ON CONFLICT (group_id, client_id) DO NOTHING`,
      [id, client_id]
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error adding group member:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove a single member
router.delete('/:id/clients/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id, clientId } = req.params;

    const group = await db.get(
      `SELECT id FROM client_groups WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });

    await db.run(
      `DELETE FROM client_group_members WHERE group_id = ? AND client_id = ?`,
      [id, clientId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing group member:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
