import express from 'express';
import db from '../config/database.js';

const router = express.Router();

// Get all notifications for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unread_only } = req.query;

    let query = `
      SELECT n.*, tm.name as actor_name
      FROM notifications n
      LEFT JOIN team_members tm ON n.user_id = tm.id
      WHERE n.user_id = ? AND n.organization_id = ?
    `;

    const params = [userId, req.orgId];

    if (unread_only === 'true') {
      query += ' AND n.is_read = 0';
    }

    query += ' ORDER BY n.created_at DESC';

    const notifications = await db.prepare(query).all(...params);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count for a user
router.get('/user/:userId/unread-count', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await db.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0 AND organization_id = ?
    `).get(userId, req.orgId);

    res.json({ count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    await db.prepare(`
      UPDATE notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(id, req.orgId);

    const notification = await db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND organization_id = ?'
    ).get(id, req.orgId);

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read for a user
router.put('/user/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params;

    await db.prepare(`
      UPDATE notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_read = 0 AND organization_id = ?
    `).run(userId, req.orgId);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare(
      'DELETE FROM notifications WHERE id = ? AND organization_id = ?'
    ).run(id, req.orgId);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create notification (for manual/testing purposes)
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    } = req.body;

    if (!user_id || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.prepare(`
      INSERT INTO notifications (
        user_id, type, title, message, entity_type, entity_id, metadata, organization_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      metadata ? JSON.stringify(metadata) : null,
      req.orgId
    );

    const notification = await db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND organization_id = ?'
    ).get(result.lastInsertRowid, req.orgId);

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
