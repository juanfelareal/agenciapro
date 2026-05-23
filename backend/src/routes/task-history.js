import express from 'express';
import db from '../config/database.js';

const router = express.Router();

/**
 * GET /api/task-history/:taskId
 * Returns the unified history feed for a task:
 *   - activity_log entries (status changes, assignment changes, client actions, etc.)
 *   - team comments (from task_comments)
 *   - client comments (from client_comments)
 *
 * Sorted newest first. Each entry has a normalized shape:
 *   { id, kind, action, description, body, author_type, author_id, author_name,
 *     created_at, metadata }
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    // Verify task is in this org
    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [taskId, req.orgId]
    );
    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // 1. Activity log entries
    const activityRows = await db.all(`
      SELECT al.id, al.action, al.description, al.metadata, al.created_at,
             al.user_id, tm.name AS user_name
      FROM activity_log al
      LEFT JOIN team_members tm ON tm.id = al.user_id
      WHERE al.entity_type = 'task' AND al.entity_id = ?
      ORDER BY al.created_at DESC
    `, [taskId]);

    const activityEntries = activityRows.map(r => {
      let meta = null;
      try { meta = r.metadata ? JSON.parse(r.metadata) : null; } catch {}
      const isClientAction = (r.action || '').startsWith('client_');
      return {
        id: `act-${r.id}`,
        kind: 'activity',
        action: r.action,
        description: r.description,
        body: null,
        author_type: isClientAction ? 'client' : (r.user_id ? 'team' : 'system'),
        author_id: r.user_id || null,
        author_name: r.user_name || (isClientAction ? 'Cliente' : 'Sistema'),
        created_at: r.created_at,
        metadata: meta,
      };
    });

    // 2. Team comments
    const teamComments = await db.all(`
      SELECT tc.id, tc.comment, tc.created_at, tc.user_id,
             tm.name AS user_name
      FROM task_comments tc
      LEFT JOIN team_members tm ON tm.id = tc.user_id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at DESC
    `, [taskId]);

    const teamCommentEntries = teamComments.map(c => ({
      id: `tcom-${c.id}`,
      kind: 'comment',
      action: 'team_comment',
      description: null,
      body: c.comment,
      author_type: 'team',
      author_id: c.user_id,
      author_name: c.user_name || 'Equipo',
      created_at: c.created_at,
      metadata: null,
    }));

    // 3. Client comments
    const clientComments = await db.all(`
      SELECT cc.id, cc.comment, cc.created_at, cc.client_id,
             c.name AS client_name, c.company AS client_company
      FROM client_comments cc
      LEFT JOIN clients c ON c.id = cc.client_id
      WHERE cc.task_id = ?
      ORDER BY cc.created_at DESC
    `, [taskId]);

    const clientCommentEntries = clientComments.map(c => ({
      id: `ccom-${c.id}`,
      kind: 'comment',
      action: 'client_comment',
      description: null,
      body: c.comment,
      author_type: 'client',
      author_id: c.client_id,
      author_name: c.client_company || c.client_name || 'Cliente',
      created_at: c.created_at,
      metadata: null,
    }));

    // Merge + sort desc by created_at
    const all = [...activityEntries, ...teamCommentEntries, ...clientCommentEntries];
    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(all);
  } catch (error) {
    console.error('Error fetching task history:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
