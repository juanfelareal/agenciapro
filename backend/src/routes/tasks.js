import express from 'express';
import db from '../config/database.js';
import { notifyTaskAssigned, notifyTaskUpdated, notifyTaskCompleted } from '../utils/notificationHelper.js';
import { processTaskCreated, processTaskUpdated } from '../services/automationEngine.js';

const router = express.Router();

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const { status, project_id, assigned_to, client_id } = req.query;
    let query = `
      SELECT t.*, p.name as project_name, p.client_id, tm.name as assigned_to_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE 1=1
    `;
    const params = [];

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
    const tasks = await db.prepare(query).all(...params);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task by ID
router.get('/:id', async (req, res) => {
  try {
    const task = await db.prepare(`
      SELECT t.*, p.name as project_name, tm.name as assigned_to_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN team_members tm ON t.assigned_to = tm.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new task
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      project_id,
      assigned_to,
      status,
      priority,
      due_date,
      is_recurring,
      recurrence_pattern,
      timeline_start,
      timeline_end,
      progress,
      color,
      estimated_hours
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await db.prepare(`
      INSERT INTO tasks (
        title, description, project_id, assigned_to, status, priority, due_date,
        is_recurring, recurrence_pattern, timeline_start, timeline_end,
        progress, color, estimated_hours
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      description,
      project_id || null,
      assigned_to || null,
      status || 'todo',
      priority || 'medium',
      due_date,
      is_recurring ? 1 : 0,
      recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
      timeline_start,
      timeline_end,
      progress || 0,
      color,
      estimated_hours
    );

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

    // Notify user if task was assigned
    // Note: We don't have the current user context, so we pass 0 as placeholder
    // In production, this should come from authentication middleware
    if (assigned_to) {
      notifyTaskAssigned(result.lastInsertRowid, title, assigned_to, 0);
    }

    // Process automations for new task
    processTaskCreated(task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      project_id,
      assigned_to,
      status,
      priority,
      due_date,
      is_recurring,
      recurrence_pattern,
      timeline_start,
      timeline_end,
      progress,
      color,
      estimated_hours
    } = req.body;

    // Get old task data for comparison
    const oldTask = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    await db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, project_id = ?, assigned_to = ?,
          status = ?, priority = ?, due_date = ?, is_recurring = ?,
          recurrence_pattern = ?, timeline_start = ?, timeline_end = ?,
          progress = ?, color = ?, estimated_hours = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title,
      description,
      project_id || null,
      assigned_to || null,
      status,
      priority,
      due_date,
      is_recurring ? 1 : 0,
      recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
      timeline_start,
      timeline_end,
      progress,
      color,
      estimated_hours,
      req.params.id
    );

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    // Notification logic
    if (oldTask) {
      // Check if task was reassigned
      if (assigned_to && assigned_to !== oldTask.assigned_to) {
        notifyTaskAssigned(req.params.id, title, assigned_to, 0);
      }

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

      if (Object.keys(changes).length > 0 && assigned_to && status !== 'done') {
        notifyTaskUpdated(req.params.id, title, assigned_to, 0, changes);
      }

      // Process automations for task update
      processTaskUpdated(oldTask, task);
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
