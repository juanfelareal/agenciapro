import { Router } from 'express';
import db from '../config/database.js';

const router = Router();

// ============================================
// CATEGORIES
// ============================================

router.get('/categories', async (req, res) => {
  try {
    const orgId = req.orgId;
    const categories = await db.prepare(`
      SELECT id, name, color, sort_order FROM ad_tag_categories
      WHERE organization_id = ? ORDER BY sort_order, name
    `).all(orgId);

    // Fetch values for each category
    for (const cat of categories) {
      cat.values = await db.prepare(`
        SELECT id, name, color FROM ad_tag_values
        WHERE category_id = ? AND organization_id = ? ORDER BY name
      `).all(cat.id, orgId);
    }

    res.json(categories);
  } catch (error) {
    console.error('Error fetching ad tag categories:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name es requerido' });

    const maxSort = await db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM ad_tag_categories WHERE organization_id = ?'
    ).get(orgId);

    const result = await db.run(
      'INSERT INTO ad_tag_categories (organization_id, name, color, sort_order) VALUES (?, ?, ?, ?)',
      [orgId, name.trim(), color || '#6366F1', (maxSort?.max_sort ?? -1) + 1]
    );

    res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), color: color || '#6366F1', values: [] });
  } catch (error) {
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error('Error creating ad tag category:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const { name, color } = req.body;

    await db.run(
      'UPDATE ad_tag_categories SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ? AND organization_id = ?',
      [name?.trim() || null, color || null, id, orgId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating ad tag category:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    await db.run('DELETE FROM ad_tag_categories WHERE id = ? AND organization_id = ?', [id, orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting ad tag category:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VALUES
// ============================================

router.post('/categories/:categoryId/values', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { categoryId } = req.params;
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name es requerido' });

    // Verify category belongs to org
    const cat = await db.prepare('SELECT id FROM ad_tag_categories WHERE id = ? AND organization_id = ?').get(categoryId, orgId);
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });

    const result = await db.run(
      'INSERT INTO ad_tag_values (category_id, organization_id, name, color) VALUES (?, ?, ?, ?)',
      [categoryId, orgId, name.trim(), color || null]
    );

    res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), color });
  } catch (error) {
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Ya existe un valor con ese nombre en esta categoría' });
    }
    console.error('Error creating ad tag value:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/values/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const { name, color } = req.body;

    await db.run(
      'UPDATE ad_tag_values SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ? AND organization_id = ?',
      [name?.trim() || null, color || null, id, orgId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating ad tag value:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/values/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    await db.run('DELETE FROM ad_tag_values WHERE id = ? AND organization_id = ?', [id, orgId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting ad tag value:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ASSIGNMENTS
// ============================================

router.get('/assignments/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { clientId } = req.params;

    const assignments = await db.prepare(`
      SELECT ata.ad_id, atv.id as value_id, atv.name as value_name, atv.color as value_color,
             atc.id as category_id, atc.name as category_name, atc.color as category_color
      FROM ad_tag_assignments ata
      JOIN ad_tag_values atv ON ata.tag_value_id = atv.id
      JOIN ad_tag_categories atc ON atv.category_id = atc.id
      WHERE ata.client_id = ? AND ata.organization_id = ?
    `).all(clientId, orgId);

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching ad tag assignments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /assignments/:adId
 * Set all tags for a single ad (replaces existing)
 * Body: { client_id, assignments: [{ category_id, value_id }] }
 */
router.put('/assignments/:adId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { adId } = req.params;
    const { client_id, assignments } = req.body;

    if (!client_id) return res.status(400).json({ error: 'client_id es requerido' });

    // Delete existing assignments for this ad
    await db.run('DELETE FROM ad_tag_assignments WHERE ad_id = ? AND organization_id = ?', [adId, orgId]);

    // Insert new assignments
    if (assignments && assignments.length > 0) {
      for (const a of assignments) {
        if (a.value_id) {
          await db.run(
            'INSERT INTO ad_tag_assignments (organization_id, ad_id, client_id, tag_value_id) VALUES (?, ?, ?, ?) ON CONFLICT (ad_id, tag_value_id) DO NOTHING',
            [orgId, adId, client_id, a.value_id]
          );
        }
      }
    }

    // Return updated assignments
    const updated = await db.prepare(`
      SELECT ata.ad_id, atv.id as value_id, atv.name as value_name, atv.color as value_color,
             atc.id as category_id, atc.name as category_name, atc.color as category_color
      FROM ad_tag_assignments ata
      JOIN ad_tag_values atv ON ata.tag_value_id = atv.id
      JOIN ad_tag_categories atc ON atv.category_id = atc.id
      WHERE ata.ad_id = ? AND ata.organization_id = ?
    `).all(adId, orgId);

    res.json(updated);
  } catch (error) {
    console.error('Error setting ad tags:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /assignments/bulk
 * Bulk assign tags to multiple ads
 * Body: { client_id, ad_ids: [...], assignments: [{ category_id, value_id }] }
 */
router.post('/assignments/bulk', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id, ad_ids, assignments } = req.body;

    if (!client_id || !ad_ids?.length || !assignments?.length) {
      return res.status(400).json({ error: 'client_id, ad_ids y assignments son requeridos' });
    }

    for (const adId of ad_ids) {
      for (const a of assignments) {
        if (a.value_id) {
          await db.run(
            'INSERT INTO ad_tag_assignments (organization_id, ad_id, client_id, tag_value_id) VALUES (?, ?, ?, ?) ON CONFLICT (ad_id, tag_value_id) DO NOTHING',
            [orgId, adId, client_id, a.value_id]
          );
        }
      }
    }

    res.json({ success: true, tagged: ad_ids.length });
  } catch (error) {
    console.error('Error bulk assigning ad tags:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
