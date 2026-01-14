import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/notifications
 * Get notifications for the client
 */
router.get('/', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;
    const { unread_only, limit = 50 } = req.query;

    let query = `
      SELECT *
      FROM client_notifications
      WHERE client_id = ?
    `;
    const params = [clientId];

    if (unread_only === '1') {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const notifications = await db.all(query, params);

    // Get unread count
    const unreadCount = await db.get(`
      SELECT COUNT(*) as count
      FROM client_notifications
      WHERE client_id = ? AND is_read = 0
    `, [clientId]);

    res.json({
      notifications,
      unread_count: unreadCount?.count || 0
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Error al cargar notificaciones' });
  }
});

/**
 * PUT /api/portal/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', clientAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.client.id;

    const notification = await db.get(
      'SELECT id FROM client_notifications WHERE id = ? AND client_id = ?',
      [id, clientId]
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await db.run(`
      UPDATE client_notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

/**
 * PUT /api/portal/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', clientAuthMiddleware, async (req, res) => {
  try {
    const clientId = req.client.id;

    await db.run(`
      UPDATE client_notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE client_id = ? AND is_read = 0
    `, [clientId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

export default router;
