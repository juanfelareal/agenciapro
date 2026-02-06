import express from 'express';
import db from '../../config/database.js';
import { clientAuthMiddleware, requirePortalPermission } from '../../middleware/clientAuth.js';

const router = express.Router();

/**
 * GET /api/portal/tasks
 * Get all tasks from client's projects
 */
router.get('/', clientAuthMiddleware, requirePortalPermission('can_view_tasks'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { project_id, status, requires_approval } = req.query;

    let query = `
      SELECT
        t.*,
        p.name as project_name,
        tm.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE p.client_id = ?
        AND t.visible_to_client = 1
    `;
    const params = [clientId];

    if (project_id) {
      query += ' AND t.project_id = ?';
      params.push(project_id);
    }

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (requires_approval === '1') {
      query += ' AND t.requires_client_approval = 1 AND (t.client_approval_status IS NULL OR t.client_approval_status = ?)';
      params.push('pending');
    }

    query += ' ORDER BY t.updated_at DESC';

    const tasks = await db.all(query, params);

    // Get subtask progress for each task
    for (const task of tasks) {
      const subtaskProgress = await db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
        FROM subtasks
        WHERE task_id = ?
      `, [task.id]);
      task.subtask_total = subtaskProgress?.total || 0;
      task.subtask_completed = subtaskProgress?.completed || 0;
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Error getting portal tasks:', error);
    res.status(500).json({ error: 'Error al cargar tareas' });
  }
});

/**
 * GET /api/portal/tasks/:id
 * Get task details
 */
router.get('/:id', clientAuthMiddleware, requirePortalPermission('can_view_tasks'), async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.client.id;

    // Get task (verify ownership through project)
    const task = await db.get(`
      SELECT
        t.*,
        p.name as project_name,
        p.client_id,
        tm.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE t.id = ?
        AND p.client_id = ?
        AND t.visible_to_client = 1
    `, [id, clientId]);

    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Get subtasks
    const subtasks = await db.all(`
      SELECT * FROM subtasks WHERE task_id = ? ORDER BY position
    `, [id]);

    // Get team comments (if allowed)
    let teamComments = [];
    if (req.client.permissions.can_view_team) {
      teamComments = await db.all(`
        SELECT tc.*, tm.name as user_name
        FROM task_comments tc
        JOIN team_members tm ON tc.user_id = tm.id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC
      `, [id]);
    }

    // Get client comments
    const clientComments = await db.all(`
      SELECT cc.*, c.name as client_name
      FROM client_comments cc
      JOIN clients c ON cc.client_id = c.id
      WHERE cc.task_id = ?
      ORDER BY cc.created_at ASC
    `, [id]);

    // Get files (if allowed)
    let files = [];
    if (req.client.permissions.can_download_files) {
      files = await db.all(`
        SELECT * FROM task_files WHERE task_id = ?
        ORDER BY created_at DESC
      `, [id]);
    }

    // Merge all comments with is_client_comment flag
    const comments = [
      ...teamComments.map(c => ({ ...c, is_client_comment: false, author_name: c.user_name })),
      ...clientComments.map(c => ({ ...c, is_client_comment: true, author_name: c.client_name }))
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.json({
      task: {
        ...task,
        subtasks,
        files
      },
      comments
    });
  } catch (error) {
    console.error('Error getting portal task:', error);
    res.status(500).json({ error: 'Error al cargar tarea' });
  }
});

/**
 * PUT /api/portal/tasks/:id/approval
 * Submit approval decision for a task
 */
router.put('/:id/approval', clientAuthMiddleware, requirePortalPermission('can_approve_tasks'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const clientId = req.client.id;

    // Validate action
    const validActions = ['approved', 'rejected', 'changes_requested'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Acción inválida. Use: approved, rejected, o changes_requested' });
    }

    // Verify task ownership and requires approval
    const task = await db.get(`
      SELECT t.*, p.client_id
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
        AND p.client_id = ?
        AND t.visible_to_client = 1
        AND t.requires_client_approval = 1
    `, [id, clientId]);

    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada o no requiere aprobación' });
    }

    // Update approval status
    await db.run(`
      UPDATE tasks SET
        client_approval_status = ?,
        client_approval_date = ?,
        client_approval_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [action, new Date().toISOString(), notes || null, id]);

    // Create notification for team (assigned user or all)
    if (task.assigned_to) {
      await db.run(`
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, related_task_id)
        VALUES (?, 'task_updated', ?, ?, 'task', ?, ?)
      `, [
        task.assigned_to,
        `Cliente ${action === 'approved' ? 'aprobó' : action === 'rejected' ? 'rechazó' : 'solicitó cambios en'} tarea`,
        `${req.client.name} ${action === 'approved' ? 'aprobó' : action === 'rejected' ? 'rechazó' : 'solicitó cambios en'} la tarea "${task.title}"${notes ? `: ${notes}` : ''}`,
        id,
        id
      ]);
    }

    // Get updated task
    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `Tarea ${action === 'approved' ? 'aprobada' : action === 'rejected' ? 'rechazada' : 'marcada para cambios'}`,
      task: updatedTask
    });
  } catch (error) {
    console.error('Error updating task approval:', error);
    res.status(500).json({ error: 'Error al actualizar aprobación' });
  }
});

/**
 * GET /api/portal/tasks/:id/comments
 * Get comments for a task
 */
router.get('/:id/comments', clientAuthMiddleware, requirePortalPermission('can_view_tasks'), async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.client.id;

    // Verify ownership
    const task = await db.get(`
      SELECT t.id
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.client_id = ? AND t.visible_to_client = 1
    `, [id, clientId]);

    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Get all comments (team + client)
    const teamComments = req.client.permissions.can_view_team
      ? await db.all(`
          SELECT tc.*, tm.name as author_name, 'team' as author_type
          FROM task_comments tc
          JOIN team_members tm ON tc.user_id = tm.id
          WHERE tc.task_id = ?
        `, [id])
      : [];

    const clientComments = await db.all(`
      SELECT cc.*, c.name as author_name, 'client' as author_type
      FROM client_comments cc
      JOIN clients c ON cc.client_id = c.id
      WHERE cc.task_id = ?
    `, [id]);

    // Merge and sort by date
    const allComments = [...teamComments, ...clientComments]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.json(allComments);
  } catch (error) {
    console.error('Error getting task comments:', error);
    res.status(500).json({ error: 'Error al cargar comentarios' });
  }
});

/**
 * POST /api/portal/tasks/:id/comments
 * Add a comment to a task
 */
router.post('/:id/comments', clientAuthMiddleware, requirePortalPermission('can_comment_tasks'), async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const clientId = req.client.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comentario requerido' });
    }

    // Verify ownership
    const task = await db.get(`
      SELECT t.*, p.client_id
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.client_id = ? AND t.visible_to_client = 1
    `, [id, clientId]);

    if (!task) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Create client comment
    const result = await db.run(`
      INSERT INTO client_comments (task_id, client_id, comment)
      VALUES (?, ?, ?)
    `, [id, clientId, comment.trim()]);

    // Notify assigned team member
    if (task.assigned_to) {
      await db.run(`
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, related_task_id)
        VALUES (?, 'comment', ?, ?, 'task', ?, ?)
      `, [
        task.assigned_to,
        'Nuevo comentario de cliente',
        `${req.client.name} comentó en la tarea "${task.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
        id,
        id
      ]);
    }

    // Get the created comment
    const newComment = await db.get(`
      SELECT cc.*, c.name as author_name, 'client' as author_type
      FROM client_comments cc
      JOIN clients c ON cc.client_id = c.id
      WHERE cc.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

/**
 * POST /api/portal/tasks
 * Create a new task from the client portal
 */
router.post('/', clientAuthMiddleware, requirePortalPermission('can_view_tasks'), async (req, res) => {
  try {
    const clientId = req.client.id;
    const { title, description, project_id, priority } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'El titulo es requerido' });
    }

    if (!project_id) {
      return res.status(400).json({ error: 'El proyecto es requerido' });
    }

    // Verify the project belongs to this client
    const project = await db.get(
      'SELECT id, name FROM projects WHERE id = ? AND client_id = ?',
      [project_id, clientId]
    );

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

    const result = await db.run(`
      INSERT INTO tasks (title, description, project_id, status, priority, visible_to_client, created_by)
      VALUES (?, ?, ?, 'todo', ?, 1, NULL)
    `, [title.trim(), description?.trim() || null, project_id, taskPriority]);

    // Notify team members assigned to this project
    const projectMembers = await db.all(`
      SELECT tm.id FROM project_team pt
      JOIN team_members tm ON pt.team_member_id = tm.id
      WHERE pt.project_id = ?
    `, [project_id]);

    for (const member of projectMembers) {
      await db.run(`
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, related_task_id)
        VALUES (?, 'task_created', ?, ?, 'task', ?, ?)
      `, [
        member.id,
        'Nueva tarea de cliente',
        `${req.client.name} creo una tarea en "${project.name}": ${title.trim()}`,
        result.lastInsertRowid,
        result.lastInsertRowid
      ]);
    }

    const newTask = await db.get(`
      SELECT t.*, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({ task: newTask });
  } catch (error) {
    console.error('Error creating portal task:', error);
    res.status(500).json({ error: 'Error al crear tarea' });
  }
});

export default router;
