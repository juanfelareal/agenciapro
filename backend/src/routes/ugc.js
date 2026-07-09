import express from 'express';
import crypto from 'crypto';
import db from '../config/database.js';

const router = express.Router();

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

// POST /api/ugc/creators/:id/fetch-instagram - Fetch Instagram profile picture
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

    // Fetch Instagram profile page to get profile picture
    const response = await fetch(`https://www.instagram.com/${instagramUsername}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'Instagram profile not found' });
    }

    const html = await response.text();

    // Extract profile picture from og:image meta tag
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

    if (!ogImageMatch || !ogImageMatch[1]) {
      return res.status(404).json({ error: 'Could not extract profile picture' });
    }

    const profilePictureUrl = ogImageMatch[1];

    // Update creator with the profile picture
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

      const instagramUsername = socialNetworks?.instagram?.replace('@', '').trim();

      if (!instagramUsername) {
        results.skipped++;
        continue;
      }

      try {
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const response = await fetch(`https://www.instagram.com/${instagramUsername}/`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          }
        });

        if (!response.ok) {
          results.failed++;
          continue;
        }

        const html = await response.text();
        const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

        if (ogImageMatch && ogImageMatch[1]) {
          await db.run(
            'UPDATE ugc_creators SET profile_photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [ogImageMatch[1], creator.id]
          );
          results.updated++;
        } else {
          results.failed++;
        }
      } catch (err) {
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

// GET /api/ugc/clients - List clients with UGC enabled
router.get('/clients', async (req, res) => {
  try {
    const clients = await db.all(
      `SELECT c.id, c.company, c.name, c.email
       FROM clients c
       INNER JOIN client_portal_settings cps ON c.id = cps.client_id
       WHERE c.organization_id = ?
       AND c.status = 'active'
       AND cps.can_view_ugc = 1
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

export default router;
