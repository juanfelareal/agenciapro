import express from 'express';
import db from '../config/database.js';

const router = express.Router();

const numeric = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// GET /api/email-marketing/:clientId?start_date=&end_date=
router.get('/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?')
      .get(req.params.clientId, orgId);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { start_date, end_date } = req.query;
    let sql = 'SELECT * FROM email_marketing_campaigns WHERE client_id = ? AND organization_id = ?';
    const params = [req.params.clientId, orgId];
    if (start_date) { sql += ' AND sent_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND sent_date <= ?'; params.push(end_date); }
    sql += ' ORDER BY sent_date DESC';

    const campaigns = await db.prepare(sql).all(...params);
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/email-marketing/:clientId
router.post('/:clientId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const client = await db.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?')
      .get(req.params.clientId, orgId);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const b = req.body || {};
    if (!b.campaign_name || !b.sent_date) {
      return res.status(400).json({ error: 'campaign_name y sent_date son obligatorios' });
    }

    const result = await db.prepare(`
      INSERT INTO email_marketing_campaigns (
        client_id, organization_id, campaign_name, subject, sent_date,
        recipients, delivered, opens, clicks, unsubscribes, orders, revenue, notes,
        delivery_rate, bounce_rate, open_rate, unsubscribe_rate, spam_rate,
        click_rate, conversion_rate, sessions, unique_visitors, added_to_cart
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.clientId, orgId,
      b.campaign_name, b.subject || null, b.sent_date,
      numeric(b.recipients), numeric(b.delivered), numeric(b.opens),
      numeric(b.clicks), numeric(b.unsubscribes), numeric(b.orders),
      numeric(b.revenue), b.notes || null,
      numeric(b.delivery_rate), numeric(b.bounce_rate), numeric(b.open_rate),
      numeric(b.unsubscribe_rate), numeric(b.spam_rate),
      numeric(b.click_rate), numeric(b.conversion_rate),
      numeric(b.sessions), numeric(b.unique_visitors), numeric(b.added_to_cart),
    );

    const created = await db.prepare('SELECT * FROM email_marketing_campaigns WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/email-marketing/:clientId/:campaignId
router.put('/:clientId/:campaignId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const existing = await db.prepare(
      'SELECT * FROM email_marketing_campaigns WHERE id = ? AND client_id = ? AND organization_id = ?'
    ).get(req.params.campaignId, req.params.clientId, orgId);
    if (!existing) return res.status(404).json({ error: 'Campaña no encontrada' });

    const b = req.body || {};
    await db.prepare(`
      UPDATE email_marketing_campaigns
      SET campaign_name = ?, subject = ?, sent_date = ?,
          recipients = ?, delivered = ?, opens = ?, clicks = ?,
          unsubscribes = ?, orders = ?, revenue = ?, notes = ?,
          delivery_rate = ?, bounce_rate = ?, open_rate = ?,
          unsubscribe_rate = ?, spam_rate = ?,
          click_rate = ?, conversion_rate = ?,
          sessions = ?, unique_visitors = ?, added_to_cart = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      b.campaign_name ?? existing.campaign_name,
      b.subject ?? existing.subject,
      b.sent_date ?? existing.sent_date,
      numeric(b.recipients ?? existing.recipients),
      numeric(b.delivered ?? existing.delivered),
      numeric(b.opens ?? existing.opens),
      numeric(b.clicks ?? existing.clicks),
      numeric(b.unsubscribes ?? existing.unsubscribes),
      numeric(b.orders ?? existing.orders),
      numeric(b.revenue ?? existing.revenue),
      b.notes ?? existing.notes,
      numeric(b.delivery_rate ?? existing.delivery_rate),
      numeric(b.bounce_rate ?? existing.bounce_rate),
      numeric(b.open_rate ?? existing.open_rate),
      numeric(b.unsubscribe_rate ?? existing.unsubscribe_rate),
      numeric(b.spam_rate ?? existing.spam_rate),
      numeric(b.click_rate ?? existing.click_rate),
      numeric(b.conversion_rate ?? existing.conversion_rate),
      numeric(b.sessions ?? existing.sessions),
      numeric(b.unique_visitors ?? existing.unique_visitors),
      numeric(b.added_to_cart ?? existing.added_to_cart),
      req.params.campaignId,
    );

    const updated = await db.prepare('SELECT * FROM email_marketing_campaigns WHERE id = ?')
      .get(req.params.campaignId);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/email-marketing/:clientId/:campaignId
router.delete('/:clientId/:campaignId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const result = await db.prepare(
      'DELETE FROM email_marketing_campaigns WHERE id = ? AND client_id = ? AND organization_id = ?'
    ).run(req.params.campaignId, req.params.clientId, orgId);
    if (!result.changes) return res.status(404).json({ error: 'Campaña no encontrada' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
