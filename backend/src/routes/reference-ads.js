import express from 'express';
import db from '../config/database.js';

const router = express.Router();

const VALID_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'web', 'other'];

// Helper: detect platform from URL when not provided
function detectPlatform(url = '') {
  const u = url.toLowerCase();
  if (u.includes('facebook.com') || u.includes('fb.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
  if (u.includes('linkedin.com')) return 'linkedin';
  return 'web';
}

// Hydrate a single ad with assigned clients + groups (and resolved audience)
async function hydrateAd(ad, orgId) {
  const clientLinks = await db.all(
    `SELECT c.id, c.company
     FROM reference_ad_clients rac
     JOIN clients c ON c.id = rac.client_id
     WHERE rac.reference_ad_id = ? AND c.organization_id = ?
     ORDER BY c.company ASC`,
    [ad.id, orgId]
  );
  const groupLinks = await db.all(
    `SELECT g.id, g.name, g.color
     FROM reference_ad_groups rag
     JOIN client_groups g ON g.id = rag.group_id
     WHERE rag.reference_ad_id = ? AND g.organization_id = ?
     ORDER BY g.name ASC`,
    [ad.id, orgId]
  );

  // Resolve full audience (deduped client ids = direct + via groups)
  const audienceIdsRows = await db.all(
    `SELECT DISTINCT client_id FROM (
       SELECT client_id FROM reference_ad_clients WHERE reference_ad_id = ?
       UNION
       SELECT m.client_id
       FROM reference_ad_groups rag
       JOIN client_group_members m ON m.group_id = rag.group_id
       WHERE rag.reference_ad_id = ?
     ) audience`,
    [ad.id, ad.id]
  );

  return {
    ...ad,
    clients: clientLinks,
    groups: groupLinks,
    audience_count: audienceIdsRows.length
  };
}

// List all reference ads (most recent first)
router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { client_id, group_id, platform } = req.query;

    let sql = `
      SELECT DISTINCT r.*
      FROM reference_ads r
      LEFT JOIN reference_ad_clients rc ON rc.reference_ad_id = r.id
      LEFT JOIN reference_ad_groups rg ON rg.reference_ad_id = r.id
      WHERE r.organization_id = ?
    `;
    const params = [orgId];

    if (client_id) {
      sql += ` AND (rc.client_id = ? OR rg.group_id IN (
        SELECT group_id FROM client_group_members WHERE client_id = ?
      ))`;
      params.push(client_id, client_id);
    }
    if (group_id) {
      sql += ` AND rg.group_id = ?`;
      params.push(group_id);
    }
    if (platform) {
      sql += ` AND r.platform = ?`;
      params.push(platform);
    }

    sql += ` ORDER BY r.created_at DESC`;

    const ads = await db.all(sql, params);
    const hydrated = [];
    for (const ad of ads) hydrated.push(await hydrateAd(ad, orgId));
    res.json(hydrated);
  } catch (error) {
    console.error('Error listing reference ads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const ad = await db.get(
      `SELECT * FROM reference_ads WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!ad) return res.status(404).json({ error: 'Anuncio referente no encontrado' });
    res.json(await hydrateAd(ad, orgId));
  } catch (error) {
    console.error('Error fetching reference ad:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create
router.post('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const {
      url,
      title,
      notes,
      platform,
      thumbnail_url,
      client_ids = [],
      group_ids = []
    } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'La URL es requerida' });
    }

    const finalPlatform = (platform && VALID_PLATFORMS.includes(platform))
      ? platform
      : detectPlatform(url);

    const result = await db.run(
      `INSERT INTO reference_ads
         (organization_id, url, title, notes, platform, thumbnail_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        url.trim(),
        title?.trim() || null,
        notes?.trim() || null,
        finalPlatform,
        thumbnail_url?.trim() || null,
        req.teamMember?.id || null
      ]
    );

    const adId = result.lastInsertRowid;

    // Assign clients (guard against cross-org)
    for (const clientId of (client_ids || [])) {
      const c = await db.get(
        `SELECT id FROM clients WHERE id = ? AND organization_id = ?`,
        [clientId, orgId]
      );
      if (!c) continue;
      await db.run(
        `INSERT INTO reference_ad_clients (reference_ad_id, client_id)
         VALUES (?, ?) ON CONFLICT (reference_ad_id, client_id) DO NOTHING`,
        [adId, clientId]
      );
    }

    // Assign groups
    for (const groupId of (group_ids || [])) {
      const g = await db.get(
        `SELECT id FROM client_groups WHERE id = ? AND organization_id = ?`,
        [groupId, orgId]
      );
      if (!g) continue;
      await db.run(
        `INSERT INTO reference_ad_groups (reference_ad_id, group_id)
         VALUES (?, ?) ON CONFLICT (reference_ad_id, group_id) DO NOTHING`,
        [adId, groupId]
      );
    }

    const ad = await db.get(
      `SELECT * FROM reference_ads WHERE id = ? AND organization_id = ?`,
      [adId, orgId]
    );
    res.status(201).json(await hydrateAd(ad, orgId));
  } catch (error) {
    console.error('Error creating reference ad:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update (full upsert of assignments when client_ids/group_ids are provided)
router.put('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const {
      url,
      title,
      notes,
      platform,
      thumbnail_url,
      client_ids,
      group_ids
    } = req.body;

    const existing = await db.get(
      `SELECT id FROM reference_ads WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Anuncio referente no encontrado' });

    const finalPlatform = (platform && VALID_PLATFORMS.includes(platform))
      ? platform
      : (platform ? detectPlatform(platform) : null);

    await db.run(
      `UPDATE reference_ads
       SET url = COALESCE(?, url),
           title = COALESCE(?, title),
           notes = COALESCE(?, notes),
           platform = COALESCE(?, platform),
           thumbnail_url = COALESCE(?, thumbnail_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [
        url?.trim(),
        title?.trim(),
        notes?.trim(),
        finalPlatform,
        thumbnail_url?.trim(),
        id,
        orgId
      ]
    );

    if (Array.isArray(client_ids)) {
      await db.run(`DELETE FROM reference_ad_clients WHERE reference_ad_id = ?`, [id]);
      for (const clientId of client_ids) {
        const c = await db.get(
          `SELECT id FROM clients WHERE id = ? AND organization_id = ?`,
          [clientId, orgId]
        );
        if (!c) continue;
        await db.run(
          `INSERT INTO reference_ad_clients (reference_ad_id, client_id)
           VALUES (?, ?) ON CONFLICT (reference_ad_id, client_id) DO NOTHING`,
          [id, clientId]
        );
      }
    }

    if (Array.isArray(group_ids)) {
      await db.run(`DELETE FROM reference_ad_groups WHERE reference_ad_id = ?`, [id]);
      for (const groupId of group_ids) {
        const g = await db.get(
          `SELECT id FROM client_groups WHERE id = ? AND organization_id = ?`,
          [groupId, orgId]
        );
        if (!g) continue;
        await db.run(
          `INSERT INTO reference_ad_groups (reference_ad_id, group_id)
           VALUES (?, ?) ON CONFLICT (reference_ad_id, group_id) DO NOTHING`,
          [id, groupId]
        );
      }
    }

    const ad = await db.get(
      `SELECT * FROM reference_ads WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    res.json(await hydrateAd(ad, orgId));
  } catch (error) {
    console.error('Error updating reference ad:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const result = await db.run(
      `DELETE FROM reference_ads WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!result.changes) return res.status(404).json({ error: 'Anuncio referente no encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reference ad:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
