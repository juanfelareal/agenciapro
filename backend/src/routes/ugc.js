import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import googleDriveService from '../services/googleDrive.js';

const router = express.Router();

// Helper function to generate contract token
function generateContractToken() {
  return crypto.randomBytes(16).toString('hex');
}

// ========================================
// MIGRATION ENDPOINT (temporary)
// ========================================

// POST /api/ugc/migrate-statuses - Force migrate project creator statuses
router.post('/migrate-statuses', async (req, res) => {
  try {
    // Drop old constraint if exists
    await db.run(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ugc_project_creators_status_check') THEN
          ALTER TABLE ugc_project_creators DROP CONSTRAINT ugc_project_creators_status_check;
        END IF;
      END $$
    `);

    // Update old statuses to new ones
    await db.run(`UPDATE ugc_project_creators SET status = 'presented' WHERE status = 'contacted'`);
    await db.run(`UPDATE ugc_project_creators SET status = 'delivered_approved' WHERE status = 'delivered'`);

    // Add new constraint
    await db.run(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ugc_project_creators_status_check') THEN
          ALTER TABLE ugc_project_creators ADD CONSTRAINT ugc_project_creators_status_check
          CHECK(status IN ('presented', 'brand_approved', 'negotiating', 'confirmed', 'contract_signed', 'rejected', 'producing', 'delivered_approved', 'delivered_changes', 'paid'));
        END IF;
      END $$
    `);

    // Update default
    await db.run(`ALTER TABLE ugc_project_creators ALTER COLUMN status SET DEFAULT 'presented'`);

    res.json({ success: true, message: 'Migration completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// STAGES (Pipeline)
// ========================================

// GET /api/ugc/stages - List all stages
router.get('/stages', async (req, res) => {
  try {
    const stages = await db.all(
      'SELECT * FROM ugc_creator_stages WHERE organization_id = ? ORDER BY position',
      [req.orgId]
    );
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/stages - Create stage
router.post('/stages', async (req, res) => {
  try {
    const { name, color, description } = req.body;

    // Get max position
    const maxPos = await db.get(
      'SELECT COALESCE(MAX(position), -1) as max_pos FROM ugc_creator_stages WHERE organization_id = ?',
      [req.orgId]
    );

    const result = await db.run(
      'INSERT INTO ugc_creator_stages (name, position, color, description, organization_id) VALUES (?, ?, ?, ?, ?)',
      [name, (maxPos?.max_pos || 0) + 1, color || '#6B7280', description, req.orgId]
    );

    const stage = await db.get('SELECT * FROM ugc_creator_stages WHERE id = ?', [result.lastID]);
    res.status(201).json(stage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ugc/stages/:id - Update stage
router.put('/stages/:id', async (req, res) => {
  try {
    const { name, color, description } = req.body;

    await db.run(
      'UPDATE ugc_creator_stages SET name = ?, color = ?, description = ? WHERE id = ? AND organization_id = ?',
      [name, color, description, req.params.id, req.orgId]
    );

    const stage = await db.get('SELECT * FROM ugc_creator_stages WHERE id = ?', [req.params.id]);
    res.json(stage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ugc/stages/reorder - Reorder stages
router.put('/stages/reorder', async (req, res) => {
  try {
    const { stages } = req.body; // Array of { id, position }

    for (const stage of stages) {
      await db.run(
        'UPDATE ugc_creator_stages SET position = ? WHERE id = ? AND organization_id = ?',
        [stage.position, stage.id, req.orgId]
      );
    }

    const updated = await db.all(
      'SELECT * FROM ugc_creator_stages WHERE organization_id = ? ORDER BY position',
      [req.orgId]
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/stages/:id - Delete stage
router.delete('/stages/:id', async (req, res) => {
  try {
    // Move creators to null stage first
    await db.run(
      'UPDATE ugc_creators SET stage_id = NULL WHERE stage_id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );

    await db.run(
      'DELETE FROM ugc_creator_stages WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );

    res.json({ message: 'Stage deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// INDUSTRIES
// ========================================

// GET /api/ugc/industries - List industries
router.get('/industries', async (req, res) => {
  try {
    const industries = await db.all(
      'SELECT * FROM ugc_industries WHERE organization_id = ? ORDER BY name',
      [req.orgId]
    );
    res.json(industries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/industries - Create industry
router.post('/industries', async (req, res) => {
  try {
    const { name, icon } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const result = await db.run(
      'INSERT INTO ugc_industries (name, slug, icon, organization_id) VALUES (?, ?, ?, ?)',
      [name, slug, icon, req.orgId]
    );

    const industry = await db.get('SELECT * FROM ugc_industries WHERE id = ?', [result.lastID]);
    res.status(201).json(industry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/industries/:id - Delete industry
router.delete('/industries/:id', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM ugc_industries WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    res.json({ message: 'Industry deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CREATORS
// ========================================

// GET /api/ugc/creators - List creators
router.get('/creators', async (req, res) => {
  try {
    const { stage_id, industry, city, department, search } = req.query;

    let query = `
      SELECT c.*, s.name as stage_name, s.color as stage_color
      FROM ugc_creators c
      LEFT JOIN ugc_creator_stages s ON c.stage_id = s.id
      WHERE c.organization_id = ?
    `;
    const params = [req.orgId];

    if (stage_id) {
      query += ' AND c.stage_id = ?';
      params.push(stage_id);
    }

    if (industry) {
      query += ' AND ? = ANY(c.industries)';
      params.push(industry);
    }

    if (department) {
      query += ' AND LOWER(c.department) = LOWER(?)';
      params.push(department);
    }

    if (city) {
      query += ' AND LOWER(c.city) = LOWER(?)';
      params.push(city);
    }

    if (search) {
      query += ' AND (LOWER(c.full_name) LIKE LOWER(?) OR c.phone LIKE ? OR LOWER(c.email) LIKE LOWER(?))';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY c.created_at DESC';

    const creators = await db.all(query, params);
    res.json(creators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ugc/creators/:id - Get creator detail
router.get('/creators/:id', async (req, res) => {
  try {
    const creator = await db.get(
      `SELECT c.*, s.name as stage_name, s.color as stage_color
       FROM ugc_creators c
       LEFT JOIN ugc_creator_stages s ON c.stage_id = s.id
       WHERE c.id = ? AND c.organization_id = ?`,
      [req.params.id, req.orgId]
    );

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Get assignments
    const assignments = await db.all(
      `SELECT a.*, cl.company as client_name
       FROM ugc_assignments a
       LEFT JOIN clients cl ON a.client_id = cl.id
       WHERE a.creator_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    // Get payments
    const payments = await db.all(
      'SELECT * FROM ugc_creator_payments WHERE creator_id = ? ORDER BY payment_date DESC',
      [req.params.id]
    );

    // Calculate totals
    const totalEarned = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPending = assignments
      .filter(a => a.status !== 'paid' && a.status !== 'cancelled')
      .reduce((sum, a) => sum + (a.agreed_value || 0), 0);

    res.json({
      ...creator,
      assignments,
      payments,
      stats: {
        total_assignments: assignments.length,
        active_assignments: assignments.filter(a => ['accepted', 'in_production'].includes(a.status)).length,
        total_earned: totalEarned,
        total_pending: totalPending
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/creators - Create creator manually
router.post('/creators', async (req, res) => {
  try {
    const {
      full_name, email, phone, cedula, social_networks,
      address, city, department, postal_code, shipping_notes,
      industries, bio, portfolio_url, profile_photo_url, stage_id, notes, source
    } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
    }

    const result = await db.run(
      `INSERT INTO ugc_creators (
        full_name, email, phone, cedula, social_networks,
        address, city, department, postal_code, shipping_notes,
        industries, bio, portfolio_url, profile_photo_url, stage_id, notes, source, organization_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name, email, phone, cedula, JSON.stringify(social_networks || {}),
        address, city, department, postal_code, shipping_notes,
        industries || [], bio, portfolio_url, profile_photo_url, stage_id, notes, source || 'manual', req.orgId
      ]
    );

    const creator = await db.get('SELECT * FROM ugc_creators WHERE id = ?', [result.lastID]);
    res.status(201).json(creator);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ugc/creators/:id - Update creator
router.put('/creators/:id', async (req, res) => {
  try {
    const {
      full_name, email, phone, cedula, social_networks,
      address, city, department, postal_code, shipping_notes,
      industries, bio, portfolio_url, profile_photo_url, stage_id, notes
    } = req.body;

    await db.run(
      `UPDATE ugc_creators SET
        full_name = ?, email = ?, phone = ?, cedula = ?, social_networks = ?,
        address = ?, city = ?, department = ?, postal_code = ?, shipping_notes = ?,
        industries = ?, bio = ?, portfolio_url = ?, profile_photo_url = ?, stage_id = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?`,
      [
        full_name, email, phone, cedula, JSON.stringify(social_networks || {}),
        address, city, department, postal_code, shipping_notes,
        industries || [], bio, portfolio_url, profile_photo_url, stage_id, notes,
        req.params.id, req.orgId
      ]
    );

    const creator = await db.get('SELECT * FROM ugc_creators WHERE id = ?', [req.params.id]);
    res.json(creator);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/ugc/creators/:id/stage - Move creator to another stage
router.patch('/creators/:id/stage', async (req, res) => {
  try {
    const { stage_id } = req.body;

    await db.run(
      'UPDATE ugc_creators SET stage_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?',
      [stage_id, req.params.id, req.orgId]
    );

    const creator = await db.get(
      `SELECT c.*, s.name as stage_name, s.color as stage_color
       FROM ugc_creators c
       LEFT JOIN ugc_creator_stages s ON c.stage_id = s.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    res.json(creator);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/creators/:id - Delete creator
router.delete('/creators/:id', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM ugc_creators WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    res.json({ message: 'Creator deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/creators/:id/fetch-instagram - Fetch Instagram profile picture via unavatar.io
router.post('/creators/:id/fetch-instagram', async (req, res) => {
  try {
    const creator = await db.get(
      'SELECT * FROM ugc_creators WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const socialNetworks = typeof creator.social_networks === 'string'
      ? JSON.parse(creator.social_networks)
      : creator.social_networks;

    const instagramUsername = socialNetworks?.instagram?.replace('@', '').trim();

    if (!instagramUsername) {
      return res.status(400).json({ error: 'No Instagram username found' });
    }

    // Use unavatar.io service to get Instagram profile picture
    // This service handles the scraping and caching for us
    const profilePictureUrl = `https://unavatar.io/instagram/${instagramUsername}`;

    // Verify the URL works by making a HEAD request
    const response = await fetch(profilePictureUrl, { method: 'HEAD' });

    if (!response.ok) {
      return res.status(404).json({ error: 'Instagram profile not found' });
    }

    // Update creator with the profile picture URL
    await db.run(
      'UPDATE ugc_creators SET profile_photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [profilePictureUrl, req.params.id]
    );

    const updatedCreator = await db.get('SELECT * FROM ugc_creators WHERE id = ?', [req.params.id]);
    res.json(updatedCreator);
  } catch (error) {
    console.error('Error fetching Instagram:', error);
    res.status(500).json({ error: 'Error fetching Instagram profile' });
  }
});

// POST /api/ugc/fetch-all-instagram - Fetch Instagram photos for all creators without profile photo
router.post('/fetch-all-instagram', async (req, res) => {
  try {
    const creators = await db.all(
      `SELECT * FROM ugc_creators
       WHERE organization_id = ?
       AND (profile_photo_url IS NULL OR profile_photo_url = '')
       AND social_networks IS NOT NULL`,
      [req.orgId]
    );

    const results = { updated: 0, failed: 0, skipped: 0 };

    for (const creator of creators) {
      const socialNetworks = typeof creator.social_networks === 'string'
        ? JSON.parse(creator.social_networks)
        : creator.social_networks;

      // Clean username - remove @, trim, and get first word only
      let instagramUsername = socialNetworks?.instagram?.replace('@', '').trim().split(' ')[0];

      if (!instagramUsername) {
        results.skipped++;
        continue;
      }

      try {
        // Direct fetch with browser-like headers
        const response = await fetch(`https://www.instagram.com/${instagramUsername}/`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          results.failed++;
          continue;
        }

        const html = await response.text();

        // Extract og:image - profile picture
        const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

        if (ogImageMatch && ogImageMatch[1]) {
          // Decode HTML entities in the URL
          const profilePictureUrl = ogImageMatch[1].replace(/&amp;/g, '&');

          await db.run(
            'UPDATE ugc_creators SET profile_photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [profilePictureUrl, creator.id]
          );
          results.updated++;
        } else {
          results.failed++;
        }

        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (err) {
        console.error(`Error fetching Instagram for ${instagramUsername}:`, err.message);
        results.failed++;
      }
    }

    res.json({ message: 'Instagram fetch completed', ...results, total: creators.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ASSIGNMENTS
// ========================================

// GET /api/ugc/assignments - List assignments
router.get('/assignments', async (req, res) => {
  try {
    const { creator_id, client_id, status } = req.query;

    let query = `
      SELECT a.*,
             c.full_name as creator_name, c.phone as creator_phone, c.profile_photo_url as creator_photo,
             cl.company as client_name
      FROM ugc_assignments a
      LEFT JOIN ugc_creators c ON a.creator_id = c.id
      LEFT JOIN clients cl ON a.client_id = cl.id
      WHERE a.organization_id = ?
    `;
    const params = [req.orgId];

    if (creator_id) {
      query += ' AND a.creator_id = ?';
      params.push(creator_id);
    }

    if (client_id) {
      query += ' AND a.client_id = ?';
      params.push(client_id);
    }

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    query += ' ORDER BY a.created_at DESC';

    const assignments = await db.all(query, params);
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ugc/assignments/:id - Get assignment detail
router.get('/assignments/:id', async (req, res) => {
  try {
    const assignment = await db.get(
      `SELECT a.*,
              c.full_name as creator_name, c.phone as creator_phone, c.email as creator_email,
              c.profile_photo_url as creator_photo, c.social_networks as creator_social,
              cl.company as client_name, cl.email as client_email
       FROM ugc_assignments a
       LEFT JOIN ugc_creators c ON a.creator_id = c.id
       LEFT JOIN clients cl ON a.client_id = cl.id
       WHERE a.id = ? AND a.organization_id = ?`,
      [req.params.id, req.orgId]
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Get related payments
    const payments = await db.all(
      'SELECT * FROM ugc_creator_payments WHERE assignment_id = ? ORDER BY payment_date DESC',
      [req.params.id]
    );

    res.json({ ...assignment, payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/assignments - Create assignment
router.post('/assignments', async (req, res) => {
  try {
    const {
      creator_id, client_id, project_id, title, description, deliverables,
      start_date, end_date, agreed_value, currency, status, notes
    } = req.body;

    if (!creator_id || !client_id || !title) {
      return res.status(400).json({ error: 'Creador, cliente y título son obligatorios' });
    }

    const result = await db.run(
      `INSERT INTO ugc_assignments (
        creator_id, client_id, project_id, title, description, deliverables,
        start_date, end_date, agreed_value, currency, status, notes,
        organization_id, assigned_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        creator_id, client_id, project_id || null, title, description, deliverables,
        start_date, end_date, agreed_value || 0, currency || 'COP', status || 'proposed', notes,
        req.orgId, req.user?.id
      ]
    );

    // If project_id is provided, also add creator to project Kanban if not already there
    if (project_id) {
      const existingProjectCreator = await db.get(
        'SELECT id FROM ugc_project_creators WHERE project_id = ? AND creator_id = ?',
        [project_id, creator_id]
      );

      if (!existingProjectCreator) {
        // Map assignment status to project creator status
        const statusMap = {
          'proposed': 'negotiating',
          'accepted': 'confirmed',
          'in_production': 'producing',
          'delivered': 'delivered_approved',
          'paid': 'paid',
          'cancelled': 'rejected'
        };
        const projectCreatorStatus = statusMap[status || 'proposed'] || 'negotiating';

        await db.run(
          `INSERT INTO ugc_project_creators (project_id, creator_id, status, agreed_value, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [project_id, creator_id, projectCreatorStatus, agreed_value || 0, notes]
        );
      }
    }

    const assignment = await db.get('SELECT * FROM ugc_assignments WHERE id = ?', [result.lastID]);
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ugc/assignments/:id - Update assignment
router.put('/assignments/:id', async (req, res) => {
  try {
    const {
      title, description, deliverables, start_date, end_date,
      agreed_value, currency, status, delivery_url, notes
    } = req.body;

    await db.run(
      `UPDATE ugc_assignments SET
        title = ?, description = ?, deliverables = ?, start_date = ?, end_date = ?,
        agreed_value = ?, currency = ?, status = ?, delivery_url = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?`,
      [
        title, description, deliverables, start_date, end_date,
        agreed_value, currency, status, delivery_url, notes,
        req.params.id, req.orgId
      ]
    );

    const assignment = await db.get('SELECT * FROM ugc_assignments WHERE id = ?', [req.params.id]);
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/ugc/assignments/:id/status - Change status
router.patch('/assignments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updates = { status };

    if (status === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    }

    await db.run(
      `UPDATE ugc_assignments SET status = ?, delivered_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [status, updates.delivered_at || null, req.params.id, req.orgId]
    );

    const assignment = await db.get('SELECT * FROM ugc_assignments WHERE id = ?', [req.params.id]);
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/assignments/:id - Delete assignment
router.delete('/assignments/:id', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM ugc_assignments WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PAYMENTS
// ========================================

// GET /api/ugc/payments - List payments
router.get('/payments', async (req, res) => {
  try {
    const { creator_id, assignment_id, status } = req.query;

    let query = `
      SELECT p.*, c.full_name as creator_name, a.title as assignment_title
      FROM ugc_creator_payments p
      LEFT JOIN ugc_creators c ON p.creator_id = c.id
      LEFT JOIN ugc_assignments a ON p.assignment_id = a.id
      WHERE p.organization_id = ?
    `;
    const params = [req.orgId];

    if (creator_id) {
      query += ' AND p.creator_id = ?';
      params.push(creator_id);
    }

    if (assignment_id) {
      query += ' AND p.assignment_id = ?';
      params.push(assignment_id);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.payment_date DESC';

    const payments = await db.all(query, params);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/payments - Create payment
router.post('/payments', async (req, res) => {
  try {
    const {
      creator_id, assignment_id, amount, currency, payment_date,
      payment_method, reference_number, status, receipt_url, notes
    } = req.body;

    if (!creator_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'Creador, monto y fecha son obligatorios' });
    }

    const result = await db.run(
      `INSERT INTO ugc_creator_payments (
        creator_id, assignment_id, amount, currency, payment_date,
        payment_method, reference_number, status, receipt_url, notes,
        organization_id, paid_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        creator_id, assignment_id || null, amount, currency || 'COP', payment_date,
        payment_method, reference_number, status || 'completed', receipt_url, notes,
        req.orgId, req.user?.id
      ]
    );

    // If payment completed and linked to assignment, update assignment status
    if ((status === 'completed' || !status) && assignment_id) {
      await db.run(
        'UPDATE ugc_assignments SET status = ? WHERE id = ? AND organization_id = ?',
        ['paid', assignment_id, req.orgId]
      );
    }

    const payment = await db.get('SELECT * FROM ugc_creator_payments WHERE id = ?', [result.lastID]);
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ugc/payments/:id - Update payment
router.put('/payments/:id', async (req, res) => {
  try {
    const {
      amount, currency, payment_date, payment_method,
      reference_number, status, receipt_url, notes
    } = req.body;

    await db.run(
      `UPDATE ugc_creator_payments SET
        amount = ?, currency = ?, payment_date = ?, payment_method = ?,
        reference_number = ?, status = ?, receipt_url = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?`,
      [
        amount, currency, payment_date, payment_method,
        reference_number, status, receipt_url, notes,
        req.params.id, req.orgId
      ]
    );

    const payment = await db.get('SELECT * FROM ugc_creator_payments WHERE id = ?', [req.params.id]);
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/payments/:id - Delete payment
router.delete('/payments/:id', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM ugc_creator_payments WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// REGISTRATION LINKS
// ========================================

// GET /api/ugc/registration-links - List registration links
router.get('/registration-links', async (req, res) => {
  try {
    const links = await db.all(
      'SELECT * FROM ugc_registration_tokens WHERE organization_id = ? ORDER BY created_at DESC',
      [req.orgId]
    );
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/registration-links - Create registration link
router.post('/registration-links', async (req, res) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');

    const result = await db.run(
      'INSERT INTO ugc_registration_tokens (token, organization_id) VALUES (?, ?)',
      [token, req.orgId]
    );

    const link = await db.get('SELECT * FROM ugc_registration_tokens WHERE id = ?', [result.lastID]);
    res.status(201).json({
      ...link,
      url: `${process.env.FRONTEND_URL || 'https://orbit.larealmarketing.com'}/ugc/register/${token}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/registration-links/:id - Deactivate link
router.delete('/registration-links/:id', async (req, res) => {
  try {
    await db.run(
      'UPDATE ugc_registration_tokens SET status = ? WHERE id = ? AND organization_id = ?',
      ['inactive', req.params.id, req.orgId]
    );
    res.json({ message: 'Link deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CLIENTS WITH UGC ENABLED
// ========================================

// GET /api/ugc/clients - List all active clients for UGC assignments
router.get('/clients', async (req, res) => {
  try {
    const clients = await db.all(
      `SELECT c.id, c.company, c.name, c.email, c.nickname
       FROM clients c
       WHERE c.organization_id = ?
       AND c.status = 'active'
       ORDER BY c.company, c.name`,
      [req.orgId]
    );
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// STATS / DASHBOARD
// ========================================

// GET /api/ugc/stats - Get UGC statistics
router.get('/stats', async (req, res) => {
  try {
    // Creators by stage
    const creatorsByStage = await db.all(
      `SELECT s.id, s.name, s.color, COUNT(c.id) as count
       FROM ugc_creator_stages s
       LEFT JOIN ugc_creators c ON s.id = c.stage_id AND c.organization_id = ?
       WHERE s.organization_id = ?
       GROUP BY s.id
       ORDER BY s.position`,
      [req.orgId, req.orgId]
    );

    // Total creators
    const totalCreators = await db.get(
      'SELECT COUNT(*) as count FROM ugc_creators WHERE organization_id = ?',
      [req.orgId]
    );

    // Active assignments
    const activeAssignments = await db.get(
      `SELECT COUNT(*) as count FROM ugc_assignments
       WHERE organization_id = ? AND status IN ('accepted', 'in_production')`,
      [req.orgId]
    );

    // Pending payments (assignments delivered but not paid)
    const pendingPayments = await db.get(
      `SELECT COALESCE(SUM(agreed_value), 0) as total FROM ugc_assignments
       WHERE organization_id = ? AND status = 'delivered'`,
      [req.orgId]
    );

    // Total paid this month
    const paidThisMonth = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM ugc_creator_payments
       WHERE organization_id = ? AND status = 'completed'
       AND payment_date >= date_trunc('month', CURRENT_DATE)`,
      [req.orgId]
    );

    res.json({
      creators_by_stage: creatorsByStage,
      total_creators: totalCreators?.count || 0,
      active_assignments: activeAssignments?.count || 0,
      pending_payments: pendingPayments?.total || 0,
      paid_this_month: paidThisMonth?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PROJECTS (UGC Campaigns)
// ========================================

// Project creator statuses with labels
const PROJECT_CREATOR_STATUSES = [
  { id: 'contacted', name: 'Contactado', color: '#9CA3AF' },
  { id: 'negotiating', name: 'Negociando', color: '#F59E0B' },
  { id: 'confirmed', name: 'Confirmado', color: '#3B82F6' },
  { id: 'producing', name: 'Produciendo', color: '#8B5CF6' },
  { id: 'delivered', name: 'Entregado', color: '#10B981' },
  { id: 'paid', name: 'Pagado', color: '#059669' },
  { id: 'rejected', name: 'Rechazado', color: '#EF4444' }
];

// GET /api/ugc/projects/statuses - Get available statuses
router.get('/projects/statuses', (req, res) => {
  res.json(PROJECT_CREATOR_STATUSES);
});

// ========================================
// UGC PACKAGES
// ========================================

// GET /api/ugc/packages - List all packages
router.get('/packages', async (req, res) => {
  try {
    const packages = await db.all(
      `SELECT * FROM ugc_packages WHERE organization_id = ? ORDER BY is_custom ASC, total_price ASC`,
      [req.orgId]
    );
    res.json(packages);
  } catch (error) {
    console.error('Error getting packages:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/packages - Create a new package
router.post('/packages', async (req, res) => {
  try {
    const { name, video_count, price_per_video, description, is_custom } = req.body;
    const total_price = video_count * price_per_video;

    const result = await db.run(
      `INSERT INTO ugc_packages (name, video_count, price_per_video, total_price, description, is_custom, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, video_count, price_per_video, total_price, description, is_custom || false, req.orgId]
    );

    const newPackage = await db.get(`SELECT * FROM ugc_packages WHERE id = ?`, [result.lastInsertRowid]);
    res.status(201).json(newPackage);
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// UGC PROJECTS
// ========================================

// GET /api/ugc/projects - List all projects
router.get('/projects', async (req, res) => {
  try {
    const { client_id, status } = req.query;

    let query = `
      SELECT p.*, c.company as client_name, c.nickname as client_nickname,
             tm.name as created_by_name,
             (SELECT COUNT(*) FROM ugc_project_creators pc WHERE pc.project_id = p.id) as creator_count
      FROM ugc_projects p
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN team_members tm ON p.created_by = tm.id
      WHERE p.organization_id = ?
    `;
    const params = [req.orgId];

    if (client_id) {
      query += ' AND p.client_id = ?';
      params.push(client_id);
    }
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const projects = await db.all(query, params);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ugc/projects/:id - Get project details with creators
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await db.get(
      `SELECT p.*, c.company as client_name, c.nickname as client_nickname, c.website as client_website,
              tm.name as created_by_name
       FROM ugc_projects p
       JOIN clients c ON p.client_id = c.id
       LEFT JOIN team_members tm ON p.created_by = tm.id
       WHERE p.id = ? AND p.organization_id = ?`,
      [req.params.id, req.orgId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Get creators assigned to this project
    const creators = await db.all(
      `SELECT pc.*, cr.full_name, cr.email, cr.phone, cr.city, cr.department,
              cr.profile_photo_url, cr.social_networks, cr.industries
       FROM ugc_project_creators pc
       JOIN ugc_creators cr ON pc.creator_id = cr.id
       WHERE pc.project_id = ?
       ORDER BY pc.created_at ASC`,
      [req.params.id]
    );

    res.json({ project, creators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/projects - Create project
router.post('/projects', async (req, res) => {
  try {
    const {
      client_id, title, description, brief_url, brief_content,
      budget, currency, start_date, deadline,
      package_id, video_count, price_per_video, creator_cost_per_video, product_value
    } = req.body;

    if (!client_id || !title) {
      return res.status(400).json({ error: 'Cliente y título son requeridos' });
    }

    const result = await db.run(
      `INSERT INTO ugc_projects (client_id, title, description, brief_url, brief_content, budget, currency, start_date, deadline, package_id, video_count, price_per_video, creator_cost_per_video, product_value, organization_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, title, description, brief_url, brief_content, budget || 0, currency || 'COP', start_date, deadline, package_id, video_count || 0, price_per_video || 0, creator_cost_per_video || 0, product_value || 0, req.orgId, req.userId]
    );

    const project = await db.get('SELECT * FROM ugc_projects WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ugc/projects/:id - Update project
router.put('/projects/:id', async (req, res) => {
  try {
    const { title, description, brief_url, brief_content, budget, currency, start_date, deadline, status } = req.body;

    await db.run(
      `UPDATE ugc_projects SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        brief_url = COALESCE(?, brief_url),
        brief_content = COALESCE(?, brief_content),
        budget = COALESCE(?, budget),
        currency = COALESCE(?, currency),
        start_date = COALESCE(?, start_date),
        deadline = COALESCE(?, deadline),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [title, description, brief_url, brief_content, budget, currency, start_date, deadline, status, req.params.id, req.orgId]
    );

    const project = await db.get('SELECT * FROM ugc_projects WHERE id = ?', [req.params.id]);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/projects/:id - Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM ugc_projects WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    res.json({ message: 'Proyecto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/projects/:id/creators - Add creators to project
router.post('/projects/:id/creators', async (req, res) => {
  try {
    const { creator_ids, deliverables, agreed_rate, currency } = req.body;

    if (!creator_ids || !Array.isArray(creator_ids) || creator_ids.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos un creador' });
    }

    // Verify project exists and belongs to org
    const project = await db.get('SELECT id FROM ugc_projects WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const added = [];
    const skipped = [];

    for (const creatorId of creator_ids) {
      try {
        // Generate unique contract token for each creator
        const contractToken = generateContractToken();

        await db.run(
          `INSERT INTO ugc_project_creators (project_id, creator_id, status, deliverables, agreed_rate, currency, contract_token)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [req.params.id, creatorId, 'presented', deliverables, agreed_rate || 0, currency || 'COP', contractToken]
        );
        added.push(creatorId);
      } catch (e) {
        // Probably duplicate, skip
        skipped.push(creatorId);
      }
    }

    res.json({ added, skipped, message: `${added.length} creadores agregados` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/ugc/projects/:projectId/creators/:creatorId - Update creator status in project
router.put('/projects/:projectId/creators/:creatorId', async (req, res) => {
  try {
    const { status, agreed_rate, currency, deliverables, delivery_url, brief_url, video_count, notes } = req.body;

    let extraFields = '';
    if (status === 'delivered') {
      extraFields = ', delivered_at = CURRENT_TIMESTAMP';
    } else if (status === 'paid') {
      extraFields = ', paid_at = CURRENT_TIMESTAMP';
    }

    await db.run(
      `UPDATE ugc_project_creators SET
        status = COALESCE(?, status),
        agreed_rate = COALESCE(?, agreed_rate),
        currency = COALESCE(?, currency),
        deliverables = COALESCE(?, deliverables),
        delivery_url = COALESCE(?, delivery_url),
        brief_url = COALESCE(?, brief_url),
        video_count = COALESCE(?, video_count),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
        ${extraFields}
       WHERE project_id = ? AND creator_id = ?`,
      [status, agreed_rate, currency, deliverables, delivery_url, brief_url, video_count, notes, req.params.projectId, req.params.creatorId]
    );

    // Auto-create Drive folder when status changes to confirmed or contract_signed
    if ((status === 'confirmed' || status === 'contract_signed') && googleDriveService.isConfigured()) {
      const projectCreator = await db.get(
        'SELECT drive_folder_id FROM ugc_project_creators WHERE project_id = ? AND creator_id = ?',
        [req.params.projectId, req.params.creatorId]
      );

      // Only create if folder doesn't exist yet
      if (!projectCreator?.drive_folder_id) {
        try {
          const project = await db.get(
            `SELECT p.*, c.company as client_name, c.nickname as client_nickname
             FROM ugc_projects p
             JOIN clients c ON p.client_id = c.id
             WHERE p.id = ?`,
            [req.params.projectId]
          );
          const creator = await db.get('SELECT full_name FROM ugc_creators WHERE id = ?', [req.params.creatorId]);

          if (project && creator) {
            const clientName = project.client_nickname || project.client_name;
            const result = await googleDriveService.createCreatorFolder(clientName, creator.full_name);

            if (result.success) {
              await db.run(
                `UPDATE ugc_project_creators SET drive_folder_id = ?, drive_folder_url = ? WHERE project_id = ? AND creator_id = ?`,
                [result.creatorFolder.id, result.creatorFolder.url, req.params.projectId, req.params.creatorId]
              );
              console.log(`Drive folder created for ${creator.full_name}: ${result.creatorFolder.url}`);
            }
          }
        } catch (driveError) {
          console.error('Error auto-creating Drive folder:', driveError.message);
          // Don't fail the request, just log the error
        }
      }
    }

    const updated = await db.get(
      `SELECT pc.*, cr.full_name, cr.email, cr.phone, cr.profile_photo_url
       FROM ugc_project_creators pc
       JOIN ugc_creators cr ON pc.creator_id = cr.id
       WHERE pc.project_id = ? AND pc.creator_id = ?`,
      [req.params.projectId, req.params.creatorId]
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ugc/projects/:projectId/creators/:creatorId - Remove creator from project
router.delete('/projects/:projectId/creators/:creatorId', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM ugc_project_creators WHERE project_id = ? AND creator_id = ?',
      [req.params.projectId, req.params.creatorId]
    );
    res.json({ message: 'Creador removido del proyecto' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// GOOGLE DRIVE INTEGRATION
// ========================================

// GET /api/ugc/drive/status - Check Google Drive configuration status
router.get('/drive/status', (req, res) => {
  res.json({
    configured: googleDriveService.isConfigured(),
    rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null
  });
});

// POST /api/ugc/projects/:projectId/creators/:creatorId/drive-folder - Create Drive folder for creator
router.post('/projects/:projectId/creators/:creatorId/drive-folder', async (req, res) => {
  try {
    // Check if Drive is configured
    if (!googleDriveService.isConfigured()) {
      return res.status(400).json({ error: 'Google Drive no está configurado' });
    }

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.company as client_name, c.nickname as client_nickname
       FROM ugc_projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = ? AND p.organization_id = ?`,
      [req.params.projectId, req.orgId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Get creator info
    const creator = await db.get(
      'SELECT * FROM ugc_creators WHERE id = ? AND organization_id = ?',
      [req.params.creatorId, req.orgId]
    );

    if (!creator) {
      return res.status(404).json({ error: 'Creador no encontrado' });
    }

    // Get project-creator assignment
    const projectCreator = await db.get(
      'SELECT * FROM ugc_project_creators WHERE project_id = ? AND creator_id = ?',
      [req.params.projectId, req.params.creatorId]
    );

    if (!projectCreator) {
      return res.status(404).json({ error: 'El creador no está asignado a este proyecto' });
    }

    // Check if folder already exists
    if (projectCreator.drive_folder_id) {
      return res.json({
        message: 'La carpeta ya existe',
        drive_folder_id: projectCreator.drive_folder_id,
        drive_folder_url: projectCreator.drive_folder_url
      });
    }

    // Create folder in Drive
    const clientName = project.client_nickname || project.client_name;
    const result = await googleDriveService.createCreatorFolder(clientName, creator.full_name);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Error creando carpeta en Drive' });
    }

    // Update project-creator with folder info
    await db.run(
      `UPDATE ugc_project_creators SET
        drive_folder_id = ?,
        drive_folder_url = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE project_id = ? AND creator_id = ?`,
      [result.creatorFolder.id, result.creatorFolder.url, req.params.projectId, req.params.creatorId]
    );

    res.json({
      success: true,
      message: 'Carpeta creada exitosamente',
      drive_folder_id: result.creatorFolder.id,
      drive_folder_url: result.creatorFolder.url,
      client_folder: result.clientFolder
    });
  } catch (error) {
    console.error('Error creating Drive folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/projects/:projectId/create-all-folders - Create Drive folders for all creators in project
router.post('/projects/:projectId/create-all-folders', async (req, res) => {
  try {
    // Check if Drive is configured
    if (!googleDriveService.isConfigured()) {
      return res.status(400).json({ error: 'Google Drive no está configurado' });
    }

    // Get project with client info
    const project = await db.get(
      `SELECT p.*, c.company as client_name, c.nickname as client_nickname
       FROM ugc_projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = ? AND p.organization_id = ?`,
      [req.params.projectId, req.orgId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Get all creators without folders
    const creators = await db.all(
      `SELECT pc.*, cr.full_name
       FROM ugc_project_creators pc
       JOIN ugc_creators cr ON pc.creator_id = cr.id
       WHERE pc.project_id = ? AND pc.drive_folder_id IS NULL`,
      [req.params.projectId]
    );

    if (creators.length === 0) {
      return res.json({ message: 'Todos los creadores ya tienen carpeta', created: 0 });
    }

    const clientName = project.client_nickname || project.client_name;
    const results = { created: 0, failed: 0, errors: [] };

    for (const creator of creators) {
      try {
        const result = await googleDriveService.createCreatorFolder(clientName, creator.full_name);

        if (result.success) {
          await db.run(
            `UPDATE ugc_project_creators SET
              drive_folder_id = ?,
              drive_folder_url = ?,
              updated_at = CURRENT_TIMESTAMP
             WHERE project_id = ? AND creator_id = ?`,
            [result.creatorFolder.id, result.creatorFolder.url, req.params.projectId, creator.creator_id]
          );
          results.created++;
        } else {
          results.failed++;
          results.errors.push({ creator: creator.full_name, error: result.error });
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ creator: creator.full_name, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `${results.created} carpetas creadas`,
      ...results
    });
  } catch (error) {
    console.error('Error creating Drive folders:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CONTRACT MANAGEMENT
// ========================================

// POST /api/ugc/projects/:projectId/creators/:creatorId/generate-contract-token - Generate/regenerate contract token
router.post('/projects/:projectId/creators/:creatorId/generate-contract-token', async (req, res) => {
  try {
    const { projectId, creatorId } = req.params;

    // Verify project belongs to org
    const project = await db.get('SELECT id FROM ugc_projects WHERE id = ? AND organization_id = ?', [projectId, req.orgId]);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Generate new token
    const newToken = generateContractToken();

    await db.run(
      'UPDATE ugc_project_creators SET contract_token = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND creator_id = ?',
      [newToken, projectId, creatorId]
    );

    res.json({
      success: true,
      contract_token: newToken,
      message: 'Token de contrato generado'
    });
  } catch (error) {
    console.error('Error generating contract token:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ugc/projects/:projectId/generate-all-contract-tokens - Generate tokens for all creators without one
router.post('/projects/:projectId/generate-all-contract-tokens', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project belongs to org
    const project = await db.get('SELECT id FROM ugc_projects WHERE id = ? AND organization_id = ?', [projectId, req.orgId]);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Get all creators without a token
    const creatorsWithoutToken = await db.all(
      'SELECT id, creator_id FROM ugc_project_creators WHERE project_id = ? AND (contract_token IS NULL OR contract_token = \'\')',
      [projectId]
    );

    let updated = 0;
    for (const pc of creatorsWithoutToken) {
      const newToken = generateContractToken();
      await db.run(
        'UPDATE ugc_project_creators SET contract_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newToken, pc.id]
      );
      updated++;
    }

    res.json({
      success: true,
      updated,
      message: `${updated} tokens generados`
    });
  } catch (error) {
    console.error('Error generating contract tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ugc/projects/:projectId/creators/:creatorId/contract - Get contract info including token and signed status
router.get('/projects/:projectId/creators/:creatorId/contract', async (req, res) => {
  try {
    const { projectId, creatorId } = req.params;

    // Get project creator with contract info
    const projectCreator = await db.get(`
      SELECT
        pc.id,
        pc.contract_token,
        pc.contract_url,
        pc.status,
        pc.agreed_rate,
        pc.video_count,
        c.full_name as creator_name,
        p.title as project_title,
        cl.company as client_name
      FROM ugc_project_creators pc
      JOIN ugc_creators c ON pc.creator_id = c.id
      JOIN ugc_projects p ON pc.project_id = p.id
      JOIN clients cl ON p.client_id = cl.id
      WHERE pc.project_id = ? AND pc.creator_id = ? AND p.organization_id = ?
    `, [projectId, creatorId, req.orgId]);

    if (!projectCreator) {
      return res.status(404).json({ error: 'Creador no encontrado en el proyecto' });
    }

    // Check if contract is signed
    const signedContract = await db.get(
      'SELECT id, signed_at, signer_name FROM ugc_signed_contracts WHERE project_creator_id = ?',
      [projectCreator.id]
    );

    res.json({
      contract_token: projectCreator.contract_token,
      contract_url: projectCreator.contract_url,
      is_signed: !!signedContract,
      signed_at: signedContract?.signed_at || null,
      signer_name: signedContract?.signer_name || null,
      creator_name: projectCreator.creator_name,
      project_title: projectCreator.project_title,
      client_name: projectCreator.client_name,
      status: projectCreator.status
    });
  } catch (error) {
    console.error('Error getting contract info:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ugc/signed-contracts/:projectCreatorId - Get signed contract details
router.get('/signed-contracts/:projectCreatorId', async (req, res) => {
  try {
    const { projectCreatorId } = req.params;

    const signedContract = await db.get(`
      SELECT
        sc.*,
        c.full_name as creator_name,
        p.title as project_title,
        cl.company as client_name
      FROM ugc_signed_contracts sc
      JOIN ugc_project_creators pc ON sc.project_creator_id = pc.id
      JOIN ugc_creators c ON pc.creator_id = c.id
      JOIN ugc_projects p ON pc.project_id = p.id
      JOIN clients cl ON p.client_id = cl.id
      WHERE sc.project_creator_id = ? AND sc.organization_id = ?
    `, [projectCreatorId, req.orgId]);

    if (!signedContract) {
      return res.status(404).json({ error: 'Contrato firmado no encontrado' });
    }

    // Parse project_details JSON
    if (signedContract.project_details) {
      try {
        signedContract.project_details = JSON.parse(signedContract.project_details);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    res.json(signedContract);
  } catch (error) {
    console.error('Error getting signed contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ugc/projects/:projectId/signed-contracts - Get all signed contracts for a project
router.get('/projects/:projectId/signed-contracts', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project belongs to org
    const project = await db.get('SELECT id FROM ugc_projects WHERE id = ? AND organization_id = ?', [projectId, req.orgId]);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const signedContracts = await db.all(`
      SELECT
        sc.id,
        sc.project_creator_id,
        sc.signer_name,
        sc.signer_cedula,
        sc.signer_email,
        sc.signer_phone,
        sc.bank_name,
        sc.bank_account_type,
        sc.bank_account_number,
        sc.signed_at,
        sc.project_details,
        c.full_name as creator_name,
        c.id as creator_id
      FROM ugc_signed_contracts sc
      JOIN ugc_project_creators pc ON sc.project_creator_id = pc.id
      JOIN ugc_creators c ON pc.creator_id = c.id
      WHERE pc.project_id = ? AND sc.organization_id = ?
      ORDER BY sc.signed_at DESC
    `, [projectId, req.orgId]);

    // Parse project_details JSON for each contract
    for (const contract of signedContracts) {
      if (contract.project_details) {
        try {
          contract.project_details = JSON.parse(contract.project_details);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
    }

    res.json(signedContracts);
  } catch (error) {
    console.error('Error getting signed contracts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
