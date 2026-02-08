import express from 'express';
import db from '../config/database.js';
import { notifyTaskAssigned, notifyTaskUpdated, notifyTaskCompleted } from '../utils/notificationHelper.js';
import { processTaskCreated, processTaskUpdated } from '../services/automationEngine.js';

const router = express.Router();

// Get all tasks (scoped to organization directly)
router.get('/', async (req, res) => {
  try {
    const { status, project_id, assigned_to, client_id } = req.query;
    let query = `
      SELECT t.*, p.name as project_name, p.client_id,
             tm.name as assigned_to_name,
             cb.name as created_by_name,
             (SELECT json_agg(json_build_object('id', ta.team_member_id, 'name', tm2.name))
              FROM task_assignees ta
              JOIN team_members tm2 ON ta.team_member_id = tm2.id
              WHERE ta.task_id = t.id) as assignees
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      LEFT JOIN team_members cb ON t.created_by = cb.id
      WHERE t.organization_id = ?
    `;
    const params = [req.orgId];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (project_id) {
      query += ' AND t.project_id = ?';
      params.push(project_id);
    }

    if (assigned_to) {
      query += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }

    if (client_id) {
      query += ' AND p.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY t.created_at DESC';
    const tasks = await db.all(query, params);
    // Ensure assignees is always an array
    tasks.forEach(t => { t.assignees = t.assignees || []; });
    res.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task by ID (scoped to organization directly)
router.get('/:id', async (req, res) => {
  try {
    const task = await db.get(`
      SELECT t.*, p.name as project_name,
             tm.name as assigned_to_name,
             cb.name as created_by_name,
             (SELECT json_agg(json_build_object('id', ta.team_member_id, 'name', tm2.name))
              FROM task_assignees ta
              JOIN team_members tm2 ON ta.team_member_id = tm2.id
              WHERE ta.task_id = t.id) as assignees
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      LEFT JOIN team_members cb ON t.created_by = cb.id
      WHERE t.id = ? AND t.organization_id = ?
    `, [req.params.id, req.orgId]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    task.assignees = task.assignees || [];
    res.json(task);
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new task (project is optional, organization_id is required)
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      project_id,
      assigned_to,
      assignee_ids,
      status,
      priority,
      due_date,
      is_recurring,
      recurrence_pattern,
      timeline_start,
      timeline_end,
      progress,
      color,
      estimated_hours,
      delivery_url,
      created_by
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify project belongs to this organization (if provided)
    if (project_id) {
      const project = await db.get(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [project_id, req.orgId]
      );
      if (!project) {
        return res.status(403).json({ error: 'Project does not belong to this organization' });
      }
    }

    // Resolve assignees: prefer assignee_ids array, fallback to assigned_to for backwards compat
    const resolvedAssigneeIds = Array.isArray(assignee_ids) && assignee_ids.length > 0
      ? assignee_ids.map(Number)
      : (assigned_to ? [Number(assigned_to)] : []);

    // Primary assignee for backwards-compatible assigned_to column
    const primaryAssignee = resolvedAssigneeIds.length > 0 ? resolvedAssigneeIds[0] : null;

    // Verify all assigned team members belong to this organization
    for (const memberId of resolvedAssigneeIds) {
      const member = await db.get(
        'SELECT id FROM team_members WHERE id = ? AND organization_id = ?',
        [memberId, req.orgId]
      );
      if (!member) {
        return res.status(403).json({ error: `Team member ${memberId} does not belong to this organization` });
      }
    }

    const result = await db.run(`
      INSERT INTO tasks (
        title, description, project_id, assigned_to, status, priority, due_date,
        is_recurring, recurrence_pattern, timeline_start, timeline_end,
        progress, color, estimated_hours, delivery_url, created_by, organization_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description || null,
      project_id || null,
      primaryAssignee,
      status || 'todo',
      priority || 'medium',
      due_date || null,
      is_recurring ? 1 : 0,
      recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
      timeline_start || null,
      timeline_end || null,
      progress || 0,
      color || null,
      estimated_hours || null,
      delivery_url || null,
      created_by || null,
      req.orgId
    ]);

    const taskId = result.lastInsertRowid;

    // Insert into task_assignees junction table
    for (const memberId of resolvedAssigneeIds) {
      await db.run(
        'INSERT INTO task_assignees (task_id, team_member_id, organization_id) VALUES (?, ?, ?) ON CONFLICT (task_id, team_member_id) DO NOTHING',
        [taskId, memberId, req.orgId]
      );
    }

    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND organization_id = ?', [taskId, req.orgId]);

    // Notify all assignees
    if (resolvedAssigneeIds.length > 0) {
      notifyTaskAssigned(taskId, title, resolvedAssigneeIds, created_by || 0);
    }

    // Process automations for new task
    processTaskCreated(task);

    task.assignees = resolvedAssigneeIds.length > 0
      ? await db.all('SELECT ta.team_member_id as id, tm.name FROM task_assignees ta JOIN team_members tm ON ta.team_member_id = tm.id WHERE ta.task_id = ?', [taskId])
      : [];

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update task (verify org ownership directly)
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      project_id,
      assigned_to,
      assignee_ids,
      status,
      priority,
      due_date,
      is_recurring,
      recurrence_pattern,
      timeline_start,
      timeline_end,
      progress,
      color,
      estimated_hours,
      delivery_url
    } = req.body;

    // Get old task data and verify it belongs to this org
    const oldTask = await db.get(
      'SELECT * FROM tasks WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );

    if (!oldTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // If changing project, verify new project belongs to this org
    if (project_id && project_id !== oldTask.project_id) {
      const newProject = await db.get(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [project_id, req.orgId]
      );
      if (!newProject) {
        return res.status(403).json({ error: 'Target project does not belong to this organization' });
      }
    }

    // Resolve assignees: prefer assignee_ids array, fallback to assigned_to for backwards compat
    const resolvedAssigneeIds = Array.isArray(assignee_ids)
      ? assignee_ids.map(Number)
      : (assigned_to !== undefined ? (assigned_to ? [Number(assigned_to)] : []) : null);

    // If assignee_ids was provided, sync task_assignees
    if (resolvedAssigneeIds !== null) {
      // Verify all new assignees belong to this org
      for (const memberId of resolvedAssigneeIds) {
        const member = await db.get(
          'SELECT id FROM team_members WHERE id = ? AND organization_id = ?',
          [memberId, req.orgId]
        );
        if (!member) {
          return res.status(403).json({ error: `Team member ${memberId} does not belong to this organization` });
        }
      }

      // Get current assignees
      const currentAssignees = await db.all(
        'SELECT team_member_id FROM task_assignees WHERE task_id = ?',
        [req.params.id]
      );
      const currentIds = currentAssignees.map(a => a.team_member_id);

      // Determine added and removed
      const addedIds = resolvedAssigneeIds.filter(id => !currentIds.includes(id));
      const removedIds = currentIds.filter(id => !resolvedAssigneeIds.includes(id));

      // Remove old assignees
      for (const memberId of removedIds) {
        await db.run('DELETE FROM task_assignees WHERE task_id = ? AND team_member_id = ?', [req.params.id, memberId]);
      }

      // Add new assignees
      for (const memberId of addedIds) {
        await db.run(
          'INSERT INTO task_assignees (task_id, team_member_id, organization_id) VALUES (?, ?, ?) ON CONFLICT (task_id, team_member_id) DO NOTHING',
          [req.params.id, memberId, req.orgId]
        );
      }

      // Notify newly added assignees
      if (addedIds.length > 0) {
        notifyTaskAssigned(req.params.id, title, addedIds, 0);
      }
    }

    // Primary assignee for backwards-compatible assigned_to column
    const primaryAssignee = resolvedAssigneeIds !== null
      ? (resolvedAssigneeIds.length > 0 ? resolvedAssigneeIds[0] : null)
      : (assigned_to !== undefined ? (assigned_to || null) : oldTask.assigned_to);

    await db.run(`
      UPDATE tasks
      SET title = ?, description = ?, project_id = ?, assigned_to = ?,
          status = ?, priority = ?, due_date = ?, is_recurring = ?,
          recurrence_pattern = ?, timeline_start = ?, timeline_end = ?,
          progress = ?, color = ?, estimated_hours = ?, delivery_url = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [
      title,
      description || null,
      project_id || null,
      primaryAssignee,
      status,
      priority,
      due_date || null,
      is_recurring ? 1 : 0,
      recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
      timeline_start || null,
      timeline_end || null,
      progress || null,
      color || null,
      estimated_hours || null,
      delivery_url || null,
      req.params.id,
      req.orgId
    ]);

    const task = await db.get('SELECT * FROM tasks WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);

    // Get all current assignees for notifications
    const allAssignees = await db.all(
      'SELECT ta.team_member_id as id, tm.name FROM task_assignees ta JOIN team_members tm ON ta.team_member_id = tm.id WHERE ta.task_id = ?',
      [req.params.id]
    );
    task.assignees = allAssignees;
    const allAssigneeIds = allAssignees.map(a => a.id);

    // Notification logic
    if (oldTask) {
      // Check if task was completed
      if (status === 'done' && oldTask.status !== 'done') {
        notifyTaskCompleted(req.params.id, title, 0);
      }

      // Check if other important fields changed
      const changes = {};
      if (title !== oldTask.title) changes.título = true;
      if (priority !== oldTask.priority) changes.prioridad = true;
      if (due_date !== oldTask.due_date) changes.fecha_vencimiento = true;
      if (status !== oldTask.status && status !== 'done') changes.estado = true;

      if (Object.keys(changes).length > 0 && allAssigneeIds.length > 0 && status !== 'done') {
        notifyTaskUpdated(req.params.id, title, allAssigneeIds, 0, changes);
      }

      // Process automations for task update
      processTaskUpdated(oldTask, task);
    }

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete task (verify org ownership directly)
router.delete('/:id', async (req, res) => {
  try {
    // Verify the task belongs to this org before deleting
    const task = await db.get(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [req.params.id, req.orgId]
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.run('DELETE FROM tasks WHERE id = ? AND organization_id = ?', [req.params.id, req.orgId]);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
